"""Text-choice variables: one template that picks one of several stories (or words) per question.

    "template": "{story}",
    "answer_formula": "story.answer_formula",
    "variables": {"story": {"type": "text_choice", "options": [
        {"text": "Maria had some stickers ... {a} more ... {c} stickers ...",
         "variables": {"a": {"type": "integer", "min": 3, "max": 25}, ...},
         "derived_variables": {"c": "n+a"},
         "answer_formula": "c-a"},
        ...]}}

An option is either plain text ("Maria") or an object with "text" and optionally its own "variables",
"derived_variables", "constraints", "answer_formula" and "wrong_answer_formulas". The template is expanded into one
ordinary template per combination of options (a variant); each question comes from one variant picked at random.
An option may also carry its own "figure", which replaces the template's figure for that story.
An answer formula written as "<choice>.answer_formula" (or left empty) uses the chosen option's formula.
"""
from __future__ import annotations

import itertools
import re
from dataclasses import dataclass, replace

MAX_OPTIONS = 30
MAX_VARIANTS = 50
OPTION_KEYS = {"text", "variables", "derived_variables", "constraints", "answer_formula", "wrong_answer_formulas",
               "figure",
               # Documentation only; accepted so bank files can keep them.
               "explanation", "validation_identity", "label"}


@dataclass(frozen=True)
class Variant:
    picks: dict  # choice variable -> 1-based option number
    config: object  # TemplateConfig without text-choice variables


def is_choice(spec) -> bool:
    return isinstance(spec, dict) and spec.get("type") == "text_choice"


def expand(config, error) -> list[Variant] | None:
    """None when the template has no text-choice variables; otherwise its variants. `error(code, msg)` raises."""
    choices = {n: v for n, v in (config.variables or {}).items() if is_choice(v)}
    if not choices:
        return None
    options = {n: _options(n, spec, error) for n, spec in choices.items()}
    total = 1
    for opts in options.values():
        total *= len(opts)
    if total > MAX_VARIANTS:
        raise error("invalid_variables", f"text choices make {total} combinations; at most {MAX_VARIANTS} are allowed")

    base_vars = {n: v for n, v in config.variables.items() if n not in choices}
    formula = (config.answer_formula or "").strip()
    ref = re.fullmatch(r"([A-Za-z_][A-Za-z0-9_]*)\.answer_formula", formula)
    if ref and ref.group(1) not in choices:
        raise error("invalid_formula", f"answer formula: '{ref.group(1)}' is not a text-choice variable")

    variants = []
    for combo in itertools.product(*[list(enumerate(o, 1)) for o in options.values()]):
        picks = dict(zip(options, combo))
        prompt = config.prompt_template
        variables = dict(base_vars)
        constraints = list(config.constraints or [])
        own_formulas, own_wrong, own_figure = {}, None, None
        for name, (_, opt) in picks.items():
            # Replace {{story}} / {story} with the option text; the text's own placeholders then parse as usual.
            prompt = prompt.replace("{{" + name + "}}", "{" + opt["text"] + "}").replace("{" + name + "}", opt["text"])
            variables.update(opt.get("variables") or {})
            for k, f in (opt.get("derived_variables") or {}).items():
                variables[k] = {"type": "derived", "formula": str(f)}
            constraints += [str(c) for c in opt.get("constraints") or []]
            if str(opt.get("answer_formula") or "").strip():
                own_formulas[name] = str(opt["answer_formula"]).strip()
            if opt.get("figure"):
                own_figure = opt["figure"]
            if opt.get("wrong_answer_formulas"):
                own_wrong = [str(w) for w in opt["wrong_answer_formulas"]]
        label = ", ".join(f"{n} option {i}" for n, (i, _) in picks.items())
        if ref:
            answer = own_formulas.get(ref.group(1))
            if not answer and config.answer_mode != "display_only":
                raise error("invalid_formula", f"{label}: needs an answer_formula")
        elif formula:
            answer = formula
        elif len(own_formulas) > 1:
            raise error("invalid_formula", f"{label}: several options give an answer formula; "
                                           "write the template's answer formula as '<choice>.answer_formula'")
        else:
            answer = next(iter(own_formulas.values()), None)
        cfg = replace(config, prompt_template=prompt, answer_formula=answer, variables=variables,
                      constraints=constraints, figure=own_figure if own_figure is not None else config.figure,
                      wrong_answer_formulas=own_wrong if own_wrong is not None else config.wrong_answer_formulas)
        variants.append(Variant({n: i for n, (i, _) in picks.items()}, cfg))
    return variants


def _options(name: str, spec: dict, error) -> list[dict]:
    unknown = set(spec) - {"type", "options"}
    if unknown:
        raise error("invalid_variables", f"variable '{name}' has unknown keys: {sorted(unknown)}")
    raw = spec.get("options")
    if not isinstance(raw, list) or not raw:
        raise error("invalid_variables", f"variable '{name}': text_choice needs a non-empty 'options' list")
    if len(raw) > MAX_OPTIONS:
        raise error("invalid_variables", f"variable '{name}': at most {MAX_OPTIONS} options are allowed")
    out = []
    for i, o in enumerate(raw, 1):
        if isinstance(o, str):
            o = {"text": o}
        if not isinstance(o, dict) or not isinstance(o.get("text"), str) or not o["text"].strip():
            raise error("invalid_variables", f"variable '{name}' option {i}: needs a 'text'")
        unknown = set(o) - OPTION_KEYS
        if unknown:
            raise error("invalid_variables", f"variable '{name}' option {i} has unknown keys: {sorted(unknown)}")
        for key in ("variables", "derived_variables"):
            if o.get(key) is not None and not isinstance(o[key], dict):
                raise error("invalid_variables", f"variable '{name}' option {i}: '{key}' must be an object")
        nested = [k for k, v in (o.get("variables") or {}).items() if is_choice(v)]
        if nested:
            raise error("invalid_variables", f"variable '{name}' option {i}: text choices cannot be nested ({nested[0]})")
        out.append(o)
    return out
