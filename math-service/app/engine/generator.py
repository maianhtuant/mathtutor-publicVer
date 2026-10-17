"""Question generation: sample variables, check constraints, evaluate answers with
SymPy, render LaTeX, build options and de-duplicate by fingerprint."""
from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass, field
from typing import Any

import sympy as sp

from . import choices as cx
from . import figures as fg
from . import formula as fx
from .numbers import (NumberError, format_fixed, format_plain, is_correct, is_terminating,
                      round_half_up, to_latex, to_rational)
from .template_parser import ParsedTemplate, TemplateError, parse_template, render

ENGINE_VERSION = "mathengine-1.0"
TRIES_PER_QUESTION = 100
MAX_COUNT = 100
MAX_RANGE_SPAN = 10**9
MAX_SCALE = 6


class GenerationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class VarSpec:
    name: str
    type: str  # integer | decimal
    min: sp.Rational
    max: sp.Rational
    scale: int = 0
    exclude: tuple = ()

    def sample(self, rng: random.Random) -> sp.Rational:
        factor = 10**self.scale
        lo = int(sp.ceiling(self.min * factor))
        hi = int(sp.floor(self.max * factor))
        while True:
            v = sp.Rational(rng.randint(lo, hi), factor)
            if v not in self.exclude:
                return v

    def size(self) -> int:
        factor = 10**self.scale
        return int(sp.floor(self.max * factor)) - int(sp.ceiling(self.min * factor)) + 1

    def display(self, v: sp.Rational) -> str:
        return format_plain(v)

    def key(self):
        return (self.type, self.min, self.max, self.scale, self.exclude)


MAX_WRONG = 6


@dataclass
class TemplateConfig:
    prompt_template: str
    answer_formula: str | None
    answer_mode: str
    default_min: Any = 1
    default_max: Any = 10
    variables: dict = field(default_factory=dict)
    constraints: list = field(default_factory=list)
    relative_tolerance_percent: Any = 0
    absolute_tolerance: Any = 0
    decimal_places: int = 2
    accept_rounded_decimal: bool = False
    # Multiple choice only: formulas for wrong answers, e.g. ["a+b", "a*b+1", "max(a,b)"].
    wrong_answer_formulas: list = field(default_factory=list)
    # Optional labelled shape drawn for every question, e.g. {"shape": "rectangle", "labels": {"width": "{l} cm"}}.
    figure: dict | None = None


@dataclass
class Compiled:
    config: TemplateConfig
    parsed: ParsedTemplate
    formula: fx.Formula | None
    constraints: list[fx.Formula]
    specs: dict[str, VarSpec]
    sign_names: list[str]
    warnings: list[str]
    # Derived variables in evaluation order, e.g. {"a": u/10}; computed from the sampled ones.
    derived: dict[str, fx.Formula] = field(default_factory=dict)
    wrong: list[fx.Formula] = field(default_factory=list)
    figure: fg.Figure | None = None


def _spec_from(name: str, raw: dict, default: VarSpec | None) -> VarSpec:
    if not isinstance(raw, dict):
        raise GenerationError("invalid_variables", f"variable '{name}' must be an object")
    unknown = set(raw) - {"type", "min", "max", "scale", "exclude"}
    if unknown:
        raise GenerationError("invalid_variables", f"variable '{name}' has unknown keys: {sorted(unknown)}")
    vtype = raw.get("type", default.type if default else "integer")
    if vtype not in ("integer", "decimal"):
        raise GenerationError("invalid_variables", f"variable '{name}': type must be integer or decimal")
    try:
        lo = to_rational(raw["min"]) if "min" in raw else (default.min if default else None)
        hi = to_rational(raw["max"]) if "max" in raw else (default.max if default else None)
        exclude = tuple(to_rational(x) for x in raw.get("exclude", default.exclude if default else ()))
    except NumberError as exc:
        raise GenerationError("invalid_variables", f"variable '{name}': {exc}") from exc
    if lo is None or hi is None:
        raise GenerationError("invalid_variables", f"variable '{name}' needs min and max")
    scale = int(raw.get("scale", default.scale if default and vtype == "decimal" else (1 if vtype == "decimal" else 0)))
    if vtype == "integer":
        scale = 0
    if not 0 <= scale <= MAX_SCALE:
        raise GenerationError("invalid_variables", f"variable '{name}': scale must be 0..{MAX_SCALE}")
    if lo > hi:
        raise GenerationError("invalid_variables", f"variable '{name}': min > max")
    spec = VarSpec(name, vtype, lo, hi, scale, exclude)
    if spec.size() <= 0:
        raise GenerationError("invalid_variables", f"variable '{name}': range contains no values")
    if spec.size() > MAX_RANGE_SPAN:
        raise GenerationError("invalid_variables", f"variable '{name}': range is too large")
    return spec


def compile_template(config: TemplateConfig, overrides: dict | None = None) -> Compiled:
    overrides = overrides or {}
    warnings: list[str] = []
    mode = config.answer_mode
    if mode not in ("numeric", "multiple_choice", "display_only"):
        raise GenerationError("invalid_template", "answer mode must be numeric, multiple_choice or display_only")
    if not isinstance(config.variables, dict) or not isinstance(overrides, dict):
        raise GenerationError("invalid_variables", "variables must be an object")
    if not isinstance(config.constraints, list):
        raise GenerationError("invalid_template", "constraints must be a list")

    formula = None
    try:
        if mode == "display_only":
            if config.answer_formula and config.answer_formula.strip():
                raise GenerationError("invalid_template", "display-only templates must not have an answer formula")
        else:
            formula = fx.parse(config.answer_formula or "", kind="answer formula")
        constraints = [fx.parse(c, kind=f"constraint '{c}'") for c in config.constraints if str(c).strip()]
        if not isinstance(config.wrong_answer_formulas or [], list) or len(config.wrong_answer_formulas or []) > MAX_WRONG:
            raise GenerationError("invalid_template", f"at most {MAX_WRONG} wrong-answer formulas are allowed")
        wrong = [fx.parse(str(w), kind=f"wrong answer '{w}'") for w in (config.wrong_answer_formulas or []) if str(w).strip()]
    except fx.FormulaError as exc:
        raise GenerationError("invalid_formula", str(exc)) from exc

    # Variables declared as {"type": "derived", "formula": "u/10"} are computed, not sampled.
    derived_raw = {n: v for n, v in config.variables.items() if isinstance(v, dict) and v.get("type") == "derived"}
    base_vars = {n: v for n, v in config.variables.items() if n not in derived_raw}
    derived = _compile_derived(derived_raw)
    referenced = (set(formula.names if formula else ()) | {n for c in constraints for n in c.names}
                  | {n for w in wrong for n in w.names})
    declared = set(base_vars) | set(overrides) | set(derived)
    try:
        parsed = parse_template(config.prompt_template, referenced | declared)
    except TemplateError as exc:
        raise GenerationError("invalid_template", str(exc)) from exc

    try:
        dmin, dmax = to_rational(config.default_min), to_rational(config.default_max)
    except NumberError as exc:
        raise GenerationError("invalid_variables", f"default range: {exc}") from exc
    if dmin > dmax:
        raise GenerationError("invalid_variables", "default min > default max")

    for name in derived:
        if name in parsed.inline_ranges:
            raise GenerationError("invalid_variables", f"variable '{name}' is derived and cannot have an inline range")
        if name in overrides:
            raise GenerationError("invalid_variables", f"variable '{name}' is derived and cannot be overridden")
    derived_deps = {n for f in derived.values() for n in f.names}
    sampled = [n for n in parsed.placeholders + sorted(declared - set(parsed.placeholders)) if n not in derived]
    sampled += sorted(derived_deps - set(sampled) - set(derived) - set(parsed.sign_names))

    specs: dict[str, VarSpec] = {}
    for name in sampled:
        base = VarSpec(name, "integer", dmin, dmax)
        if name in parsed.inline_ranges:
            lo, hi = parsed.inline_ranges[name]
            base = VarSpec(name, "integer", sp.Rational(str(lo)), sp.Rational(str(hi)))
        if name in base_vars:
            declared_spec = _spec_from(name, base_vars[name], base)
            if name in parsed.inline_ranges and (declared_spec.type != "integer"
                                                 or (declared_spec.min, declared_spec.max) != (base.min, base.max)):
                raise GenerationError("invalid_variables",
                                      f"variable '{name}': inline range conflicts with the Variables declaration")
            base = declared_spec
        if name in overrides:
            base = _spec_from(name, overrides[name], base)
        specs[name] = base

    sign_names = parsed.sign_names
    known = set(specs) | set(sign_names) | set(derived)
    missing = sorted((referenced | derived_deps) - known)
    if missing:
        raise GenerationError("missing_variables", f"formula/constraints use undefined variables: {', '.join(missing)}")
    figure = fg.compile_figure(config.figure, GenerationError)
    if figure:
        missing = sorted(figure.names - known)
        if missing:
            raise GenerationError("invalid_figure", f"figure uses undefined variables: {', '.join(missing)}")
    shown = set(parsed.placeholders) | (figure.names if figure else set())
    for name in sorted(set(specs) - shown - derived_deps):
        warnings.append(f"variable '{name}' is declared but not shown in the template")
    if formula:
        used = set(formula.names) | {d for n in formula.names if n in derived for d in derived[n].names}
        unused = sorted(set(parsed.placeholders) - used - set(derived))
        if unused:
            warnings.append(f"variables not used by the answer formula: {', '.join(unused)}")
    return Compiled(config, parsed, formula, constraints, specs, sign_names, warnings, derived, wrong, figure)


def _compile_derived(raw: dict) -> dict[str, fx.Formula]:
    """Parse derived-variable formulas and order them so each only uses earlier ones."""
    parsed: dict[str, fx.Formula] = {}
    for name, spec in raw.items():
        unknown = set(spec) - {"type", "formula"}
        if unknown:
            raise GenerationError("invalid_variables", f"derived variable '{name}' has unknown keys: {sorted(unknown)}")
        try:
            parsed[name] = fx.parse(str(spec.get("formula", "")), kind=f"derived variable '{name}'")
        except fx.FormulaError as exc:
            raise GenerationError("invalid_formula", str(exc)) from exc
    ordered: dict[str, fx.Formula] = {}
    pending = dict(parsed)
    while pending:
        ready = [n for n, f in pending.items() if not (f.names & set(pending) - {n}) and n not in f.names]
        if not ready:
            raise GenerationError("invalid_variables", f"derived variables depend on each other in a loop: {', '.join(sorted(pending))}")
        for n in ready:
            ordered[n] = pending.pop(n)
    return ordered


def _complete(compiled: Compiled, values: dict) -> dict | None:
    """Add derived variables to sampled values; None when one cannot be computed exactly."""
    if not compiled.derived:
        return values
    full = dict(values)
    for name, f in compiled.derived.items():
        try:
            v = f.evaluate(full)
        except fx.EvalError:
            return None
        if isinstance(v, bool) or not getattr(v, "is_Rational", False):
            return None  # shown in the question, so it must be an exact number
        full[name] = sp.Rational(v)
    return full


def _sample(compiled: Compiled, rng: random.Random) -> dict[str, sp.Rational]:
    values = {name: spec.sample(rng) for name, spec in compiled.specs.items()}
    for s in compiled.sign_names:
        values[s] = sp.Integer(rng.choice((1, -1)))
    return values


def _passes(compiled: Compiled, values) -> bool:
    for c in compiled.constraints:
        try:
            if not fx._truthy(c.evaluate(values)):
                return False
        except fx.EvalError:
            return False
    return True


def interchangeable_groups(compiled: Compiled, seed: str) -> list[list[str]]:
    """Variables that can be swapped without changing the answer or constraints,
    e.g. a and b in lcm(a, b) or a*b. Checked numerically on sample points."""
    if not compiled.formula:
        return []
    rng = random.Random(f"symmetry:{seed}")
    names = list(compiled.specs)
    points = []
    for _ in range(200):
        values = _complete(compiled, _sample(compiled, rng))
        if values is not None and _passes(compiled, values):
            try:
                compiled.formula.evaluate(values)
                points.append(values)
            except fx.EvalError:
                continue
        if len(points) >= 8:
            break
    if len(points) < 3:
        return []

    def symmetric(x: str, y: str) -> bool:
        if compiled.specs[x].key() != compiled.specs[y].key():
            return False
        for p in points:
            q = {k: v for k, v in p.items() if k not in compiled.derived}
            q[x], q[y] = p[y], p[x]
            q = _complete(compiled, q)
            if q is None:
                return False
            try:
                if compiled.formula.evaluate(p) != compiled.formula.evaluate(q):
                    return False
            except fx.EvalError:
                return False
            if _passes(compiled, p) != _passes(compiled, q):
                return False
        return True

    groups: list[list[str]] = []
    for n in names:
        for g in groups:
            if all(symmetric(n, m) for m in g):
                g.append(n)
                break
        else:
            groups.append([n])
    return [g for g in groups if len(g) > 1]


def fingerprint(salt: str, values: dict[str, sp.Rational], groups: list[list[str]], skip=()) -> str:
    canon = {k: str(v) for k, v in values.items() if k not in skip}
    for g in groups:
        sorted_vals = sorted((values[n] for n in g))
        for n, v in zip(sorted(g), sorted_vals):
            canon[n] = str(v)
    payload = json.dumps({"salt": salt, "values": canon}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def _grading(cfg: TemplateConfig) -> dict:
    return dict(relative_tolerance_percent=cfg.relative_tolerance_percent,
                absolute_tolerance=cfg.absolute_tolerance,
                decimal_places=cfg.decimal_places,
                accept_rounded_decimal=cfg.accept_rounded_decimal)


def wrong_values(compiled: Compiled, values: dict) -> list[sp.Rational]:
    """Evaluate the author's wrong-answer formulas; ones that fail or are not numbers are skipped."""
    out = []
    for w in compiled.wrong:
        try:
            r = w.evaluate(values)
        except fx.EvalError:
            continue
        if isinstance(r, bool):
            continue
        if getattr(r, "is_Rational", False):
            out.append(sp.Rational(r))
        elif getattr(r, "is_real", False):
            out.append(round_half_up(sp.Rational(str(sp.N(r, 40))), int(compiled.config.decimal_places)))
    return out


def make_options(answer: sp.Rational, cfg: TemplateConfig, rng: random.Random,
                 custom: list[sp.Rational] | tuple = ()) -> list[dict]:
    """Exactly four distinct options with one correct answer.

    The author's wrong answers come first (three picked at random if there are more);
    automatic distractors fill any remaining places."""
    if answer.q == 1:
        unit = sp.Integer(1)
        step = max(unit, sp.Integer(abs(answer.p) // 10))
        extra = [answer + 1, answer - 1]
    elif is_terminating(answer):
        unit = sp.Rational(1, 10 ** len(format_plain(abs(answer)).split(".")[1]))
        step = unit
        extra = [answer + 1, answer - 1]
    else:  # fraction: off-by-one numerator/denominator mistakes
        unit = sp.Integer(1)
        step = sp.Rational(1, answer.q)
        extra = [sp.Rational(answer.p + 1, answer.q), sp.Rational(answer.p, answer.q + 1)]
    candidates = extra + [answer + unit, answer - unit, answer + 2 * unit, answer - 2 * unit,
                          answer + step, answer - step, answer * 2, -answer, answer * 10,
                          answer / 10, answer + 10 * unit, answer - 10 * unit, answer + 3 * unit]
    grading = _grading(cfg)
    seen = {to_latex(answer)}

    def distinct(values):
        out = []
        for c in values:
            c = sp.Rational(c)
            latex = to_latex(c)
            if latex in seen or is_correct(c, answer, **grading):
                continue
            seen.add(latex)
            out.append(c)
        return out

    mine = distinct(custom)
    mine = rng.sample(mine, 3) if len(mine) > 3 else mine
    valid = distinct(candidates)
    if len(mine) + len(valid) < 3:
        raise GenerationError("invalid_distractors", "could not build three distinct distractors")
    chosen = mine + rng.sample(valid, 3 - len(mine)) + [answer]
    rng.shuffle(chosen)
    # Write all options the same way: mixing 0.8 with 2/3 would give the answer away.
    fractions = "\\frac" in cfg.prompt_template or any(c.q != 1 and not is_terminating(c) for c in chosen)
    return [{"latex": to_latex(c, fractions), "value": format_plain(c), "isCorrect": c == answer} for c in chosen]


def generate(config: TemplateConfig, *, count: int, seed: str, salt: str = "",
             overrides: dict | None = None) -> dict:
    variants = _variants(config)
    if variants is None:
        return _generate(config, count=count, seed=seed, salt=salt, overrides=overrides)
    if not 1 <= count <= MAX_COUNT:
        raise GenerationError("invalid_count", f"count must be between 1 and {MAX_COUNT}")
    # Each question picks a variant at random; each variant then generates its share with its own seed and salt,
    # so fingerprints of different stories never collide.
    rng = random.Random(seed)
    order = [rng.randrange(len(variants)) for _ in range(count)]
    want = {i: order.count(i) for i in set(order)}

    def run(i: int, n: int) -> dict:
        v = variants[i]
        tag = ":" + ",".join(f"{name}{k}" for name, k in v.picks.items())
        try:
            r = _generate(v.config, count=n, seed=seed + tag, salt=salt + tag,
                          overrides=_overrides_for(v.config, overrides), partial=True)
        except GenerationError as exc:
            raise GenerationError(exc.code, f"{_label(v)}: {exc.message}") from exc
        for item in r["items"]:
            item["variables"].update({name: str(k) for name, k in v.picks.items()})
        return r

    made: dict[int, list] = {}
    warnings: list[str] = []
    for i in sorted(want):
        r = run(i, want[i])
        made[i] = r["items"]
        warnings += [f"{_label(variants[i])}: {w}" for w in r["warnings"] if f"{_label(variants[i])}: {w}" not in warnings]
    # A variant with fewer distinct questions than its random share leaves a gap; the variants with questions to
    # spare fill it. (Asking a variant for more questions repeats its first ones, so only the new ones are taken.)
    missing = sum(want[i] - len(made[i]) for i in want)
    extra: list = []
    for i in range(len(variants)):
        if len(extra) >= missing:
            break
        have = made.get(i, [])
        if i in want and len(have) < want[i]:
            continue  # this variant is already used up
        extra += run(i, min(MAX_COUNT, len(have) + missing - len(extra)))["items"][len(have):]
    if len(extra) < missing:
        raise GenerationError(
            "insufficient_variants",
            f"Only {count - missing + len(extra)} distinct valid questions could be generated out of {count} requested. "
            "Widen the variable ranges, relax constraints or reduce the count.")
    rng.shuffle(extra)
    items = [made[i].pop(0) if made[i] else extra.pop() for i in order]
    formulas = {v.config.answer_formula for v in variants}
    latex = None
    if len(formulas) == 1 and next(iter(formulas)):
        latex = compile_template(variants[0].config).formula.to_latex()
    return {"engineVersion": ENGINE_VERSION, "items": items, "warnings": warnings,
            "interchangeableGroups": [], "answerFormulaLatex": latex}


def _variants(config: TemplateConfig):
    def error(code, message):
        return GenerationError(code, message)
    return cx.expand(config, error)


def _label(v) -> str:
    return ", ".join(f"{n} option {k}" for n, k in v.picks.items())


def _overrides_for(config: TemplateConfig, overrides: dict | None) -> dict:
    """Practice-set range overrides apply to the variants that use that variable; the others ignore them."""
    used = {n for n, v in config.variables.items() if not (isinstance(v, dict) and v.get("type") == "derived")}
    return {n: o for n, o in (overrides or {}).items()
            if n in used or f"{{{n}}}" in config.prompt_template or f"{{{n}:" in config.prompt_template}


def _generate(config: TemplateConfig, *, count: int, seed: str, salt: str = "",
              overrides: dict | None = None, partial: bool = False) -> dict:
    """partial: return the distinct questions found even when fewer than `count` (instead of raising)."""
    if not 1 <= count <= MAX_COUNT:
        raise GenerationError("invalid_count", f"count must be between 1 and {MAX_COUNT}")
    compiled = compile_template(config, overrides)
    groups = interchangeable_groups(compiled, seed)
    rng = random.Random(seed)
    items, seen = [], set()
    tries, max_tries = 0, TRIES_PER_QUESTION * count
    last_error = None
    while len(items) < count and tries < max_tries:
        tries += 1
        values = _complete(compiled, _sample(compiled, rng))
        if values is None:
            last_error = "a derived variable could not be computed exactly"
            continue
        if not _passes(compiled, values):
            continue
        fp = fingerprint(salt, values, groups, skip=compiled.derived)
        if fp in seen:
            continue
        answer = None
        approximate = False
        if compiled.formula:
            try:
                result = compiled.formula.evaluate(values)
            except fx.EvalError as exc:
                last_error = str(exc)
                continue
            if isinstance(result, bool):
                raise GenerationError("invalid_formula", "answer formula must produce a number, not a condition")
            if getattr(result, "is_Rational", False):
                answer = sp.Rational(result)
            elif config.accept_rounded_decimal:
                # Irrational (e.g. sqrt(41)): keep 12 decimals; students are graded on the rounded value.
                answer = round_half_up(sp.Rational(str(sp.N(result, 40))), 12)
                approximate = True
            else:
                last_error = "the answer is not an exact number; enable 'Accept rounded decimal' for answers like sqrt(2)"
                continue
        display = {n: compiled.specs[n].display(values[n]) for n in compiled.specs}
        display.update({n: format_plain(values[n]) for n in compiled.derived})
        display.update({s: str(values[s]) for s in compiled.sign_names})
        item = {
            "variables": {k: format_plain(v) for k, v in values.items()},
            "promptLatex": render(compiled.parsed, display),
            "fingerprint": fp,
            "expectedNumerator": None,
            "expectedDenominator": None,
            "answerDisplay": None,
            "roundedAnswer": None,
            "options": [],
            "figureSvg": fg.render(compiled.figure, values, display) if compiled.figure else None,
        }
        if answer is not None:
            item.update(expectedNumerator=str(answer.p), expectedDenominator=str(answer.q),
                        answerDisplay=("≈ " + format_fixed(answer, int(config.decimal_places))) if approximate else format_plain(answer),
                        approximate=approximate,
                        roundedAnswer=format_fixed(answer, int(config.decimal_places)))
            if config.answer_mode == "multiple_choice":
                item["options"] = make_options(answer, config, rng, wrong_values(compiled, values))
        seen.add(fp)
        items.append(item)

    if len(items) < count and not partial:
        detail = f" Last evaluation error: {last_error}." if last_error else ""
        raise GenerationError(
            "insufficient_variants",
            f"Only {len(items)} distinct valid questions could be generated out of {count} requested "
            f"after {tries} tries. Widen the variable ranges, relax constraints or reduce the count.{detail}")
    return {
        "engineVersion": ENGINE_VERSION,
        "items": items,
        "warnings": compiled.warnings,
        "interchangeableGroups": groups,
        "answerFormulaLatex": compiled.formula.to_latex() if compiled.formula else None,
    }


def validate(config: TemplateConfig, sample_count: int = 5) -> dict:
    try:
        variants = _variants(config)
    except GenerationError as exc:
        return {"valid": False, "errors": [{"code": exc.code, "message": exc.message}], "warnings": [], "variables": {},
                "answerFormulaLatex": None, "samples": [], "engineVersion": ENGINE_VERSION}
    if variants is None:
        return _validate(config, sample_count)
    # Validate every variant; samples show one question per variant (up to 20) so each story can be checked.
    out = {"valid": True, "errors": [], "warnings": [], "variables": {}, "answerFormulaLatex": None, "samples": [],
           "engineVersion": ENGINE_VERSION}
    for v in variants:
        r = _validate(v.config, 1)
        out["errors"] += [{**e, "message": f"{_label(v)}: {e['message']}"} for e in r["errors"]]
        out["warnings"] += [f"{_label(v)}: {w}" for w in r["warnings"]]
        for n, spec in r["variables"].items():
            out["variables"].setdefault(n, spec)
        for item in r["samples"][:1]:
            if len(out["samples"]) < 20:
                item["variables"].update({n: str(k) for n, k in v.picks.items()})
                out["samples"].append(item)
    out["valid"] = not out["errors"]
    formulas = {v.config.answer_formula for v in variants}
    if out["valid"] and len(formulas) == 1 and next(iter(formulas)):
        out["answerFormulaLatex"] = compile_template(variants[0].config).formula.to_latex()
    return out


def _validate(config: TemplateConfig, sample_count: int = 5) -> dict:
    errors: list[dict] = []
    warnings: list[str] = []
    variables: dict = {}
    formula_latex = None
    samples: list = []
    try:
        compiled = compile_template(config)
        warnings.extend(compiled.warnings)
        variables = {n: {"type": s.type, "min": format_plain(s.min), "max": format_plain(s.max), "scale": s.scale}
                     for n, s in compiled.specs.items()}
        formula_latex = compiled.formula.to_latex() if compiled.formula else None
        try:
            result = generate(config, count=sample_count, seed="validate", salt="validate")
            samples = result["items"]
        except GenerationError as exc:
            if exc.code == "insufficient_variants":
                warnings.append(exc.message)
                try:
                    samples = generate(config, count=1, seed="validate", salt="validate")["items"]
                except GenerationError as exc2:
                    errors.append({"code": exc2.code, "message": exc2.message})
            else:
                errors.append({"code": exc.code, "message": exc.message})
    except GenerationError as exc:
        errors.append({"code": exc.code, "message": exc.message})
    return {"valid": not errors, "errors": errors, "warnings": warnings, "variables": variables,
            "answerFormulaLatex": formula_latex, "samples": samples, "engineVersion": ENGINE_VERSION}


def config_from(data: dict) -> TemplateConfig:
    return TemplateConfig(**{k: v for k, v in data.items() if k in TemplateConfig.__dataclass_fields__})


__all__ = ["TemplateConfig", "GenerationError", "generate", "validate", "ENGINE_VERSION", "config_from"]
