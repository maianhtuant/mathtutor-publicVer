"""Builds one-step-equations-templates.json — a template bank for
Math-Template / Common-Math / Solve-Easy-Equations / One-Step-Equations.

Same file format as ged-numeric-form-templates.json, so it imports through
POST /api/admin/math-templates/import?subject=Solve-Easy-Equations
(the "category" of every template is "One-Step-Equations").

Design notes
* The solution is sampled first (hidden variable k, or m) and the numbers shown in the
  equation are derived from it, so most answers are clean integers.
  The hidden variable is never called x, because "{x}" inside \\frac{x}{...} would be
  replaced by its value.
* Every template is validated with the real math-service engine, and every generated
  question is re-checked independently: the expected answer is substituted back into the
  equation with Python Fractions.

Run:  python3 build_one_step_equations.py
"""
from __future__ import annotations

import json
import sys
from fractions import Fraction as F
from math import gcd
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENGINE = HERE.parent / "math-service"
OUT = HERE / "one-step-equations-templates.json"
CATEGORY = "One-Step-Equations"

TEMPLATES: list[dict] = []
CHECKS: dict[str, callable] = {}


def I(lo, hi, exclude=()):
    v = {"type": "integer", "min": lo, "max": hi}
    if exclude:
        v["exclude"] = list(exclude)
    return v


def D(lo, hi, scale=1, exclude=()):
    v = {"type": "decimal", "min": lo, "max": hi, "scale": scale}
    if exclude:
        v["exclude"] = list(exclude)
    return v


def add(id, group, label, prompt, formula, variables, check, *, derived=None, constraints=None,
        explanation="", fraction_answer=False):
    if fraction_answer:
        prompt += r" Write your answer as a fraction in simplest form or as a decimal."
    TEMPLATES.append({
        "id": id,
        "label": label,
        "category": CATEGORY,
        "group": group,
        "subject": "Math",
        "active": True,
        "path": "Math-Template/Common-Math/Solve-Easy-Equations/One-Step-Equations",
        "template": prompt,
        "template_latex": prompt,
        "answer_formula": formula,
        "answer_rule": formula,
        "answer_latex_template": None,
        "answer_mode": "numeric",
        "min_value": 1,
        "max_value": 10,
        "variables": variables,
        "derived_variables": derived or {},
        "constraints": constraints or [],
        "grading_tolerance_percent": 0,
        "absolute_tolerance": 0,
        "decimal_places": 2,
        "accept_rounded_decimal": False,
        "grading_policy": "exact",
        "requires_engine_features": ["derived_variables"] if derived else [],
        "explanation": explanation,
        "diagram": None,
        "domain_restrictions": [],
        "grading_requirements": "Exact value; fractions (e.g. 7/3) and exact decimals are both accepted.",
        "numeric_form_compatible": True,
    })
    CHECKS[id] = check


SOLVE = r"Solve for \(x\): "

# ---------------------------------------------------------------- 1. Addition / subtraction
G1 = "Addition and subtraction"
add("OSE01", G1, "Solve x + a = b", SOLVE + r"\(x + {a} = {b}\)", "b - a",
    {"k": I(-20, 20), "a": I(-20, 20, [0])}, lambda v, x: x + v["a"] == v["b"],
    derived={"b": "k + a"}, explanation="Undo the addition: subtract a from both sides, so x = b − a.")
add("OSE02", G1, "Solve x − a = b", SOLVE + r"\(x - {a} = {b}\)", "b + a",
    {"k": I(-20, 20), "a": I(1, 20)}, lambda v, x: x - v["a"] == v["b"],
    derived={"b": "k - a"}, explanation="Undo the subtraction: add a to both sides, so x = b + a.")
add("OSE03", G1, "Solve a + x = b", SOLVE + r"\({a} + x = {b}\)", "b - a",
    {"k": I(-20, 20), "a": I(-20, 20, [0])}, lambda v, x: v["a"] + x == v["b"],
    derived={"b": "a + k"}, explanation="Subtract a from both sides, so x = b − a.")
add("OSE04", G1, "Solve b = x + a (variable on the right)", SOLVE + r"\({b} = x + {a}\)", "b - a",
    {"k": I(-20, 20), "a": I(-20, 20, [0])}, lambda v, x: v["b"] == x + v["a"],
    derived={"b": "k + a"}, explanation="Subtract a from both sides, so x = b − a.")
add("OSE05", G1, "Solve x + (−a) = b", SOLVE + r"\(x + (-{a}) = {b}\)", "b + a",
    {"k": I(-20, 20), "a": I(1, 20)}, lambda v, x: x + (-v["a"]) == v["b"],
    derived={"b": "k - a"}, explanation="Adding −a is the same as subtracting a. Add a to both sides, so x = b + a.")
add("OSE06", G1, "Solve x − (−a) = b", SOLVE + r"\(x - (-{a}) = {b}\)", "b - a",
    {"k": I(-20, 20), "a": I(1, 20)}, lambda v, x: x - (-v["a"]) == v["b"],
    derived={"b": "k + a"}, explanation="Subtracting −a is the same as adding a. Subtract a from both sides, so x = b − a.")
add("OSE07", G1, "Solve x + a = b with decimals", SOLVE + r"\(x + {a} = {b}\)", "b - a",
    {"k": D(-10, 10, 1), "a": D(-9.9, 9.9, 1, [0])}, lambda v, x: x + v["a"] == v["b"],
    derived={"b": "k + a"}, explanation="Subtract a from both sides and line up the decimal points: x = b − a.")

# ---------------------------------------------------------------- 2. Multiplication / division
G2 = "Multiplication and division"
add("OSE08", G2, "Solve ax = b", SOLVE + r"\({a}x = {b}\)", "b / a",
    {"k": I(-12, 12, [0]), "a": I(-12, 12, [-1, 0, 1])}, lambda v, x: v["a"] * x == v["b"],
    derived={"b": "a * k"}, explanation="Undo the multiplication: divide both sides by a, so x = b ÷ a.")
add("OSE09", G2, "Solve x/a = b", SOLVE + r"\(\frac{x}{{a}} = {b}\)", "a * b",
    {"a": I(-12, 12, [-1, 0, 1]), "b": I(-12, 12, [0])}, lambda v, x: x / v["a"] == v["b"],
    explanation="Undo the division: multiply both sides by a, so x = a · b.")
add("OSE10", G2, "Solve −x = b", SOLVE + r"\(-x = {b}\)", "-b",
    {"b": I(-25, 25, [0])}, lambda v, x: -x == v["b"],
    explanation="−x means −1 · x. Divide (or multiply) both sides by −1, so x = −b.")
add("OSE11", G2, "Solve ax = b (fraction answer)", SOLVE + r"\({a}x = {b}\)", "b / a",
    {"a": I(2, 12), "b": I(-30, 30, [0])}, lambda v, x: v["a"] * x == v["b"],
    constraints=["b % a != 0"], fraction_answer=True,
    explanation="Divide both sides by a. The quotient is not a whole number, so write x = b/a in lowest terms.")
add("OSE12", G2, "Solve ax = b with a decimal coefficient", SOLVE + r"\({a}x = {b}\)", "b / a",
    {"a": D(0.2, 2.5, 1, [1]), "k": I(1, 20)}, lambda v, x: v["a"] * x == v["b"],
    derived={"b": "a * k"}, explanation="Divide both sides by the decimal a, so x = b ÷ a.")

# ---------------------------------------------------------------- 3. Two-step (ax − b = c)
G3 = "Two-step equations"
add("OSE13", G3, "Solve ax − b = c", SOLVE + r"\({a}x - {b} = {c}\)", "(c + b) / a",
    {"k": I(-10, 10), "a": I(2, 9), "b": I(1, 20)}, lambda v, x: v["a"] * x - v["b"] == v["c"],
    derived={"c": "a * k - b"},
    explanation="First add b to both sides (ax = c + b), then divide by a: x = (c + b) ÷ a.")
add("OSE14", G3, "Solve ax + b = c", SOLVE + r"\({a}x + {b} = {c}\)", "(c - b) / a",
    {"k": I(-10, 10), "a": I(-9, 9, [-1, 0, 1]), "b": I(-20, 20, [0])},
    lambda v, x: v["a"] * x + v["b"] == v["c"], derived={"c": "a * k + b"},
    explanation="First subtract b from both sides (ax = c − b), then divide by a: x = (c − b) ÷ a.")
add("OSE15", G3, "Solve x/a + b = c", SOLVE + r"\(\frac{x}{{a}} + {b} = {c}\)", "a * (c - b)",
    {"m": I(-10, 10), "a": I(2, 9), "b": I(-15, 15, [0])},
    lambda v, x: x / v["a"] + v["b"] == v["c"], derived={"c": "m + b"},
    explanation="First subtract b from both sides (x/a = c − b), then multiply by a: x = a(c − b).")

# ---------------------------------------------------------------- 4. Fractions / proportions
G4 = "Fractions and proportions"
add("OSE16", G4, "Solve x/a = b/c (whole-number answer)", SOLVE + r"\(\frac{x}{{a}} = \frac{{b}}{{c}}\)", "a * b / c",
    {"a": I(2, 24), "b": I(1, 11), "c": I(2, 12)}, lambda v, x: x / v["a"] == F(v["b"]) / v["c"],
    constraints=["gcd(b, c) == 1", "(a * b) % c == 0"],
    explanation="Multiply both sides by a (or cross-multiply: c·x = a·b), so x = a·b ÷ c.")
add("OSE17", G4, "Solve x/a = b/c (fraction answer)", SOLVE + r"\(\frac{x}{{a}} = \frac{{b}}{{c}}\)", "a * b / c",
    {"a": I(2, 12), "b": I(1, 11), "c": I(2, 12)}, lambda v, x: x / v["a"] == F(v["b"]) / v["c"],
    constraints=["gcd(b, c) == 1", "(a * b) % c != 0"], fraction_answer=True,
    explanation="Multiply both sides by a: x = a·b/c, then simplify the fraction.")
add("OSE18", G4, "Solve a/x = b/c", SOLVE + r"\(\frac{{a}}{x} = \frac{{b}}{{c}}\)", "a * c / b",
    {"a": I(1, 20), "b": I(2, 9), "c": I(1, 12)}, lambda v, x: x != 0 and F(v["a"]) / x == F(v["b"]) / v["c"],
    constraints=["gcd(b, c) == 1", "(a * c) % b == 0", "b != c"],
    explanation="Cross-multiply: b·x = a·c, then divide by b, so x = a·c ÷ b.")
add("OSE19", G4, "Solve (a/b)x = c", SOLVE + r"\(\frac{{a}}{{b}}x = {c}\)", "c * b / a",
    {"a": I(2, 9), "b": I(2, 9), "c": I(-30, 30, [0])}, lambda v, x: F(v["a"], v["b"]) * x == v["c"],
    constraints=["gcd(a, b) == 1", "(c * b) % a == 0"],
    explanation="Multiply both sides by the reciprocal b/a, so x = c · b/a.")
add("OSE20", G4, "Solve x + a/b = c/d", SOLVE + r"\(x + \frac{{a}}{{b}} = \frac{{c}}{{d}}\)", "c / d - a / b",
    {"a": I(1, 9), "b": I(2, 9), "c": I(1, 9), "d": I(2, 9)},
    lambda v, x: x + F(v["a"], v["b"]) == F(v["c"], v["d"]),
    constraints=["gcd(a, b) == 1", "gcd(c, d) == 1", "b != d"], fraction_answer=True,
    explanation="Subtract a/b from both sides with a common denominator: x = c/d − a/b.")

# ---------------------------------------------------------------- 5. Word problems
G5 = "Word problems"
add("OSE21", G5, "Word problem: age difference (x + a = b)",
    r"Tom is {a} years older than his sister Mia. Tom is {b} years old. Write an equation and solve it to find Mia's age.",
    "b - a", {"k": I(3, 40), "a": I(2, 15)}, lambda v, x: x + v["a"] == v["b"], derived={"b": "k + a"},
    explanation="Let x be Mia's age. Then x + a = b, so x = b − a.")
add("OSE22", G5, "Word problem: money spent (x − a = b)",
    r"After spending \(\${a}\) on a jacket, Ana has \(\${b}\) left. How many dollars did she have before buying the jacket?",
    "b + a", {"k": I(40, 200), "a": I(10, 120)}, lambda v, x: x - v["a"] == v["b"],
    derived={"b": "k - a"}, constraints=["a < k"],
    explanation="Let x be the starting amount. Then x − a = b, so x = b + a.")
add("OSE23", G5, "Word problem: temperature drop (x − a = b)",
    r"The temperature dropped {a}\(^\circ\)F overnight. In the morning it was {b}\(^\circ\)F. What was the temperature the evening before, in \(^\circ\)F?",
    "b + a", {"k": I(-10, 50), "a": I(3, 25)}, lambda v, x: x - v["a"] == v["b"], derived={"b": "k - a"},
    explanation="Let x be the evening temperature. Then x − a = b, so x = b + a.")
add("OSE24", G5, "Word problem: price of one item (ax = b)",
    r"{a} movie tickets cost \(\${b}\) in total. Each ticket costs the same. What is the price of one ticket, in dollars?",
    "b / a", {"k": I(5, 25), "a": I(2, 9)}, lambda v, x: v["a"] * x == v["b"], derived={"b": "a * k"},
    explanation="Let x be the price of one ticket. Then a·x = b, so x = b ÷ a.")
add("OSE25", G5, "Word problem: splitting a bill (x/a = b)",
    r"{a} friends split a restaurant bill equally. Each friend pays \(\${b}\). What was the total bill, in dollars?",
    "a * b", {"a": I(2, 8), "b": I(8, 40)}, lambda v, x: x / v["a"] == v["b"],
    explanation="Let x be the total bill. Then x/a = b, so x = a · b.")
add("OSE26", G5, "Word problem: rectangle length (wx = A)",
    r"A rectangle has an area of {A} square feet and a width of {w} feet. What is its length, in feet?",
    "A / w", {"k": I(3, 20), "w": I(2, 12)}, lambda v, x: v["w"] * x == v["A"], derived={"A": "w * k"},
    explanation="Area = length × width, so w·x = A and x = A ÷ w.")
add("OSE27", G5, "Word problem: constant speed (tx = d)",
    r"A car travels {d} miles in {t} hours at a constant speed. What is its speed, in miles per hour?",
    "d / t", {"k": I(30, 70), "t": I(2, 8)}, lambda v, x: v["t"] * x == v["d"], derived={"d": "t * k"},
    explanation="Distance = speed × time, so t·x = d and x = d ÷ t.")
add("OSE28", G5, "Word problem: recipe proportion (x/c = a/b)",
    r"A recipe uses {a} cups of flour to make {b} muffins. How many cups of flour are needed to make {c} muffins?",
    "a * c / b", {"a": I(1, 4), "b": I(6, 12), "c": I(12, 48)},
    lambda v, x: x / v["c"] == F(v["a"], v["b"]), constraints=["(a * c) % b == 0", "c != b"],
    explanation="Set up the proportion x/c = a/b and multiply both sides by c: x = a·c ÷ b.")
add("OSE29", G5, "Word problem: map scale (ax = b)",
    r"On a map, 1 inch represents {a} miles. Two towns are {b} miles apart. How many inches apart are they on the map?",
    "b / a", {"a": I(5, 50), "b": I(10, 300)}, lambda v, x: v["a"] * x == v["b"],
    constraints=["(2 * b) % a == 0", "b > a"],
    explanation="Let x be the map distance. Then a·x = b, so x = b ÷ a (a decimal such as 2.5 is fine).")
add("OSE30", G5, "Word problem: gym membership (ax + b = c)",
    r"A gym charges a \(\${b}\) sign-up fee plus \(\${a}\) per month. Jordan paid \(\${c}\) in total. For how many months did Jordan pay?",
    "(c - b) / a", {"k": I(2, 12), "a": I(15, 45), "b": I(20, 99)},
    lambda v, x: v["a"] * x + v["b"] == v["c"], derived={"c": "a * k + b"},
    explanation="Let x be the number of months. Then a·x + b = c; subtract b, then divide by a.")
add("OSE31", G5, "Word problem: taxi fare (ax + b = c)",
    r"A taxi charges \(\${b}\) to start plus \(\${a}\) per mile. A ride costs \(\${c}\). How many miles long was the ride?",
    "(c - b) / a", {"k": I(2, 20), "q": I(6, 14), "b": I(2, 6)},
    lambda v, x: v["a"] * x + v["b"] == v["c"], derived={"a": "q / 4", "c": "a * k + b"},
    constraints=["q % 2 == 1", "(q * k) % 4 == 0"],
    explanation="Let x be the miles. Then a·x + b = c; subtract b, then divide by a.")
add("OSE32", G5, "Word problem: shared candy (x/a = b)",
    r"A bag of candy is shared equally among {a} students, and each student gets {b} pieces. How many pieces were in the bag?",
    "a * b", {"a": I(3, 30), "b": I(2, 12)}, lambda v, x: x / v["a"] == v["b"],
    explanation="Let x be the number of pieces. Then x/a = b, so x = a · b.")


# ---------------------------------------------------------------- validation with the real engine
def engine_config(t: dict) -> dict:
    """Same mapping as TemplateImportService.content()."""
    variables = dict(t["variables"])
    for k, f in t["derived_variables"].items():
        variables[k] = {"type": "derived", "formula": f}
    return dict(prompt_template=t["template"], answer_formula=t["answer_formula"], answer_mode="numeric",
                default_min=t["min_value"], default_max=t["max_value"], variables=variables,
                constraints=t["constraints"], relative_tolerance_percent=0, absolute_tolerance=0,
                decimal_places=t["decimal_places"], accept_rounded_decimal=False)


def main() -> int:
    sys.path.insert(0, str(ENGINE))
    from app.engine.generator import config_from, generate, validate  # noqa: E402

    problems, report = [], []
    for t in TEMPLATES:
        cfg = config_from(engine_config(t))
        v = validate(cfg, 5)
        if not v["valid"]:
            problems.append(f"{t['id']}: {v['errors']}")
            continue
        for w in v["warnings"]:
            if "not shown" not in w:
                report.append(f"{t['id']} warning: {w}")
        items = generate(cfg, count=40, seed=f"check:{t['id']}", salt="check")["items"]
        for it in items:
            vals = {k: F(s) for k, s in it["variables"].items()}
            x = F(int(it["expectedNumerator"]), int(it["expectedDenominator"]))
            if not CHECKS[t["id"]](vals, x):
                problems.append(f"{t['id']}: wrong answer {x} for {it['promptLatex']}")
        ex = items[0]
        t["example"] = {
            "variables": ex["variables"],
            "question_latex": ex["promptLatex"],
            "answer": ex["answerDisplay"],
            "exact_answer": {"numerator": ex["expectedNumerator"], "denominator": ex["expectedDenominator"]},
        }
        print(f"{t['id']}  {ex['promptLatex']}   ->  {ex['answerDisplay']}")
    for r in report:
        print(r)
    if problems:
        print("\nPROBLEMS:\n" + "\n".join(problems))
        return 1
    bank = {
        "schema_version": "1.0",
        "title": "One-Step Equations",
        "subject_path": "Math-Template/Common-Math/Solve-Easy-Equations/One-Step-Equations",
        "note": "Import with POST /api/admin/math-templates/import?subject=Solve-Easy-Equations . "
                "Every template's category is One-Step-Equations. Subject names are unique, so the existing "
                "Solve-Easy-Equations and One-Step-Equations folders are reused when they already exist.",
        "templates": TEMPLATES,
    }
    OUT.write_text(json.dumps(bank, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\n{len(TEMPLATES)} templates validated (40 questions each re-checked) -> {OUT.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
