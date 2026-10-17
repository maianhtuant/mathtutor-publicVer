import pytest
import sympy as sp
from fastapi.testclient import TestClient

from app.engine import formula as fx
from app.engine.generator import GenerationError, TemplateConfig, generate, validate
from app.engine.numbers import format_fixed, is_correct, round_half_up
from app.main import app

LCM = TemplateConfig(
    prompt_template="Find the least common multiple of {a:2–20} and {b:2-20}.",
    answer_formula="lcm(a, b)", answer_mode="numeric", constraints=["a != b"])

DECIMAL = TemplateConfig(
    prompt_template=r"Calculate {a} \times {b}.", answer_formula="a * b", answer_mode="numeric",
    variables={"a": {"type": "decimal", "min": 1.1, "max": 9.9, "scale": 1},
               "b": {"type": "decimal", "min": 1.1, "max": 9.9, "scale": 1}})


def test_lcm_generates_distinct_questions_without_swapped_duplicates():
    result = generate(LCM, count=5, seed="s1", salt="v1")
    assert len(result["items"]) == 5
    assert result["interchangeableGroups"] == [["a", "b"]]
    pairs = {tuple(sorted((int(i["variables"]["a"]), int(i["variables"]["b"])))) for i in result["items"]}
    assert len(pairs) == 5
    for item in result["items"]:
        a, b = int(item["variables"]["a"]), int(item["variables"]["b"])
        assert a != b and 2 <= a <= 20
        assert item["expectedNumerator"] == str(sp.ilcm(a, b))
        assert item["expectedDenominator"] == "1"
        assert f"of {a} and {b}." in item["promptLatex"]


def test_generation_is_reproducible_from_seed():
    assert generate(LCM, count=3, seed="x", salt="v")["items"] == generate(LCM, count=3, seed="x", salt="v")["items"]


def test_decimal_multiplication_is_exact():
    item = generate(DECIMAL, count=1, seed="d", overrides={"a": {"min": 2.4, "max": 2.4}, "b": {"min": 1.5, "max": 1.5}})["items"][0]
    assert item["promptLatex"] == r"Calculate 2.4 \times 1.5."
    assert (item["expectedNumerator"], item["expectedDenominator"]) == ("18", "5")
    assert item["answerDisplay"] == "3.6"


def test_fraction_braces_and_repeated_placeholders():
    cfg = TemplateConfig(prompt_template=r"\frac{{a}}{{b}} + \frac{{c}}{{d}} \text{ and {a}}",
                         answer_formula="a / b + c / d", answer_mode="numeric",
                         constraints=["b != 0", "d != 0"])
    item = generate(cfg, count=1, seed="f")["items"][0]
    v = item["variables"]
    assert item["promptLatex"] == rf"\frac{{{v['a']}}}{{{v['b']}}} + \frac{{{v['c']}}}{{{v['d']}}} \text{{ and {v['a']}}}"
    expected = sp.Rational(int(v["a"]), int(v["b"])) + sp.Rational(int(v["c"]), int(v["d"]))
    assert sp.Rational(int(item["expectedNumerator"]), int(item["expectedDenominator"])) == expected


def test_literal_latex_braces_are_untouched():
    cfg = TemplateConfig(prompt_template=r"\text{Compute} {x} + \mathrm{{y}}", answer_formula="x + 1",
                         answer_mode="numeric")
    item = generate(cfg, count=1, seed="l")["items"][0]
    assert item["promptLatex"].startswith(r"\text{Compute} ")
    assert item["promptLatex"].endswith(r"\mathrm{{y}}")


def test_sign_placeholder():
    cfg = TemplateConfig(prompt_template="{a}x {+-} {b} = {c}", answer_formula="(c - s*b)/a",
                         answer_mode="numeric", constraints=["a != 0"], default_min=-9, default_max=9)
    for item in generate(cfg, count=10, seed="sg")["items"]:
        v = {k: sp.Rational(x) for k, x in item["variables"].items()}
        # A negative b flips the shown sign: "4x + -1" is written "4x - 1".
        shown = v["s"] * (1 if v["b"] >= 0 else -1)
        assert f" {'+' if shown == 1 else '-'} {abs(v['b'])} = " in item["promptLatex"]
        assert sp.Rational(int(item["expectedNumerator"]), int(item["expectedDenominator"])) == (v["c"] - v["s"] * v["b"]) / v["a"]


def test_negative_inline_range():
    cfg = TemplateConfig(prompt_template="{a:-5–-1} + 1", answer_formula="a + 1", answer_mode="numeric")
    for item in generate(cfg, count=5, seed="n")["items"]:
        assert -5 <= int(item["variables"]["a"]) <= -1


def test_insufficient_variants():
    cfg = TemplateConfig(prompt_template="{a:1-3} + {b:1-3}", answer_formula="a+b", answer_mode="numeric")
    with pytest.raises(GenerationError) as e:
        generate(cfg, count=7, seed="i")  # only 6 distinct pairs once swaps are merged
    assert e.value.code == "insufficient_variants"


def test_inline_and_declared_conflict():
    cfg = TemplateConfig(prompt_template="{a:1-3}", answer_formula="a", answer_mode="numeric",
                         variables={"a": {"min": 1, "max": 9}})
    with pytest.raises(GenerationError) as e:
        generate(cfg, count=1, seed="c")
    assert e.value.code == "invalid_variables"


@pytest.mark.parametrize("formula,code", [
    ("__import__('os')", "invalid_formula"),
    ("a.real", "invalid_formula"),
    ("(lambda: 1)()", "invalid_formula"),
    ("a +", "invalid_formula"),
    ("a + zz", "missing_variables"),
    ("a" + "+a" * 300, "invalid_formula"),
])
def test_rejects_unsafe_or_invalid_formulas(formula, code):
    cfg = TemplateConfig(prompt_template="{a}", answer_formula=formula, answer_mode="numeric")
    with pytest.raises(GenerationError) as e:
        generate(cfg, count=1, seed="u")
    assert e.value.code == code


def test_division_by_zero_is_skipped_then_reported():
    cfg = TemplateConfig(prompt_template="{a:0-0}", answer_formula="1/a", answer_mode="numeric")
    with pytest.raises(GenerationError) as e:
        generate(cfg, count=1, seed="z")
    assert "division by zero" in e.value.message


def test_multiple_choice_has_four_distinct_options_one_correct():
    cfg = TemplateConfig(prompt_template=DECIMAL.prompt_template, answer_formula="a*b",
                         answer_mode="multiple_choice", variables=DECIMAL.variables)
    for item in generate(cfg, count=10, seed="mc")["items"]:
        opts = item["options"]
        assert len(opts) == 4 and len({o["latex"] for o in opts}) == 4
        assert sum(o["isCorrect"] for o in opts) == 1


def test_multiple_choice_uses_author_wrong_answers():
    cfg = TemplateConfig(prompt_template=LCM.prompt_template, answer_formula="lcm(a, b)", constraints=["a != b"],
                         answer_mode="multiple_choice", wrong_answer_formulas=["a + b", "gcd(a, b)", "max(a, b)"])
    for item in generate(cfg, count=10, seed="mcw")["items"]:
        a, b = int(item["variables"]["a"]), int(item["variables"]["b"])
        right = sp.ilcm(a, b)
        wrong = {o["value"] for o in item["options"] if not o["isCorrect"]}
        assert len(item["options"]) == 4 and len(wrong) == 3
        mine = {str(v) for v in (a + b, sp.igcd(a, b), max(a, b)) if v != right}
        assert mine <= wrong  # author answers are always used when they differ from the right one


def test_fixed_wrong_answers_for_a_single_question():
    cfg = TemplateConfig(prompt_template="Find the least common multiple of 11 and 2.", answer_formula="lcm(11, 2)",
                         answer_mode="multiple_choice", wrong_answer_formulas=["13", "11", "2"])
    opts = generate(cfg, count=1, seed="one")["items"][0]["options"]
    assert sorted(o["value"] for o in opts) == ["11", "13", "2", "22"]
    assert [o["value"] for o in opts if o["isCorrect"]] == ["22"]


def test_wrong_answer_formula_with_unknown_variable_is_rejected():
    cfg = TemplateConfig(prompt_template="LCM of {a} and {b}", answer_formula="lcm(a,b)",
                         answer_mode="multiple_choice", wrong_answer_formulas=["a + c"])
    assert not validate(cfg)["valid"]


def test_fraction_options_are_written_consistently():
    cfg = TemplateConfig(prompt_template=r"Simplify \(\frac{{n}}{{d}}\).", answer_formula="a / b", answer_mode="multiple_choice",
                         variables={"a": {"min": 1, "max": 9}, "b": {"min": 2, "max": 10}, "k": {"min": 2, "max": 6},
                                    "n": {"type": "derived", "formula": "a*k"}, "d": {"type": "derived", "formula": "b*k"}},
                         constraints=["a < b", "gcd(a, b) == 1"], wrong_answer_formulas=["(a + 1) / b", "b / a"])
    for item in generate(cfg, count=10, seed="frac")["items"]:
        assert not any("." in o["latex"] for o in item["options"]), item["options"]


@pytest.mark.parametrize("prompt,values,expected", [
    (r"Solve \(x+{b}={c}\).", {"b": "-3", "c": "19"}, r"Solve \(x-3=19\)."),
    (r"Solve \(x + {b} = {c}\).", {"b": "-3", "c": "-5"}, r"Solve \(x - 3 = -5\)."),
    (r"\(x-{b}\)", {"b": "-4"}, r"\(x+4\)"),
    (r"\({a} \times {b}\)", {"a": "4", "b": "-3"}, r"\(4 \times (-3)\)"),
    (r"\(({b})\)", {"b": "-3"}, r"\((-3)\)"),
    (r"\(={b}\)", {"b": "-3"}, r"\(=-3\)"),
    (r"\(x+{b}\)", {"b": "3"}, r"\(x+3\)"),
])
def test_negative_values_read_naturally(prompt, values, expected):
    from app.engine.template_parser import parse_template, render
    assert render(parse_template(prompt, set(values)), values) == expected


def test_display_only_has_no_answer():
    cfg = TemplateConfig(prompt_template="Example {a}", answer_formula=None, answer_mode="display_only",
                         variables={"a": {"min": 1, "max": 5}})
    item = generate(cfg, count=1, seed="d")["items"][0]
    assert item["expectedNumerator"] is None


def test_round_half_up_and_grading():
    assert round_half_up(sp.Rational("2.345"), 2) == sp.Rational("2.35")
    assert round_half_up(sp.Rational("-2.345"), 2) == sp.Rational("-2.35")
    assert format_fixed(sp.Rational(1, 3), 2) == "0.33"
    y = sp.Rational("3.6")
    kw = dict(relative_tolerance_percent=0, absolute_tolerance=0, decimal_places=2, accept_rounded_decimal=False)
    assert is_correct(sp.Rational(18, 5), y, **kw)
    assert not is_correct(sp.Rational("3.61"), y, **kw)
    assert is_correct(sp.Rational("3.61"), y, **{**kw, "absolute_tolerance": "0.01"})
    assert is_correct(sp.Rational("0.33"), sp.Rational(1, 3), **{**kw, "accept_rounded_decimal": True})


def test_formula_latex():
    assert fx.parse("lcm(a, b)").to_latex() == r"\operatorname{lcm}{\left(a,b \right)}"


def test_validate_reports_errors_and_samples():
    ok = validate(LCM)
    assert ok["valid"] and len(ok["samples"]) == 5
    bad = validate(TemplateConfig(prompt_template="{a}", answer_formula="a/", answer_mode="numeric"))
    assert not bad["valid"] and bad["errors"][0]["code"] == "invalid_formula"


def test_http_api():
    client = TestClient(app)
    assert client.get("/health").json()["status"] == "ok"
    body = {"template": {"promptTemplate": LCM.prompt_template, "answerFormula": "lcm(a, b)",
                         "answerMode": "numeric", "constraints": ["a != b"]},
            "count": 5, "seed": "abc", "salt": "v1"}
    r = client.post("/v1/generate", json=body)
    assert r.status_code == 200 and len(r.json()["items"]) == 5
    body["count"] = 100
    body["template"]["promptTemplate"] = "{a:1-2} {b:1-2}"
    r = client.post("/v1/generate", json=body)
    assert r.status_code == 422 and r.json()["error"] == "insufficient_variants"


def test_derived_variables_make_decimals_and_are_shown():
    cfg = TemplateConfig(prompt_template="Compute \\({a} + {b}\\).", answer_formula="a + b", answer_mode="numeric",
                         variables={"u": {"type": "integer", "min": 11, "max": 99}, "v": {"type": "integer", "min": 11, "max": 99},
                                    "a": {"type": "derived", "formula": "u/10"}, "b": {"type": "derived", "formula": "v/10"}})
    for item in generate(cfg, count=5, seed="d")["items"]:
        a, b = sp.Rational(item["variables"]["a"]), sp.Rational(item["variables"]["b"])
        assert f"{item['variables']['a']} + {item['variables']['b']}" in item["promptLatex"]
        assert sp.Rational(int(item["expectedNumerator"]), int(item["expectedDenominator"])) == a + b


def test_derived_variables_can_chain_and_loops_are_rejected():
    cfg = TemplateConfig(prompt_template="{q3} - {q1}", answer_formula="q3 - q1", answer_mode="numeric",
                         variables={"lo": {"min": 1, "max": 5}, "a": {"min": 1, "max": 5}, "c": {"min": 1, "max": 5},
                                    "q3": {"type": "derived", "formula": "q1 + c"}, "q1": {"type": "derived", "formula": "lo + a"}})
    item = generate(cfg, count=1, seed="c")["items"][0]
    assert sp.Rational(item["expectedNumerator"]) == sp.Rational(item["variables"]["c"])
    loop = TemplateConfig(prompt_template="{x}", answer_formula="x", answer_mode="numeric",
                          variables={"x": {"type": "derived", "formula": "y"}, "y": {"type": "derived", "formula": "x"}})
    with pytest.raises(GenerationError):
        generate(loop, count=1, seed="l")


@pytest.mark.parametrize("formula,values,expected", [
    ("pow(a, 3)", {"a": 2}, 8), ("mean(a, b, c)", {"a": 1, "b": 2, "c": 6}, 3),
    ("median(a, b, c, d)", {"a": 4, "b": 1, "c": 3, "d": 2}, sp.Rational(5, 2)),
    ("nCr(a, b)", {"a": 8, "b": 3}, 56), ("nPr(a, b)", {"a": 5, "b": 2}, 20),
])
def test_new_functions(formula, values, expected):
    assert fx.parse(formula).evaluate({k: sp.Integer(v) for k, v in values.items()}) == expected


def test_irrational_answers_need_rounding_enabled():
    base = dict(prompt_template="Hypotenuse for legs {a:1-9} and {b:1-9}", answer_formula="sqrt(a*a+b*b)", answer_mode="numeric",
                constraints=["a != b"], decimal_places=2)
    items = generate(TemplateConfig(**base, accept_rounded_decimal=True), count=5, seed="h")["items"]
    approx = [i for i in items if i["approximate"]]
    assert approx and all(i["answerDisplay"].startswith("≈ ") for i in approx)
    i = approx[0]
    a, b = int(i["variables"]["a"]), int(i["variables"]["b"])
    rounded = sp.Rational(i["roundedAnswer"])
    expected = sp.Rational(int(i["expectedNumerator"]), int(i["expectedDenominator"]))
    assert abs(expected - sp.sqrt(a * a + b * b)) < sp.Rational(1, 10**11)
    assert is_correct(rounded, expected, relative_tolerance_percent=0, absolute_tolerance=0, decimal_places=2, accept_rounded_decimal=True)
    # Without "accept rounded decimal" only exact (perfect-square) cases can be generated.
    exact_only = generate(TemplateConfig(**base, accept_rounded_decimal=False), count=1, seed="h2")["items"][0]
    assert not exact_only["approximate"]


STORIES = TemplateConfig(
    prompt_template="{story}", answer_formula="story.answer_formula", answer_mode="numeric",
    variables={"story": {"type": "text_choice", "options": [
        {"text": "Maria had some stickers. A friend gave her {a} more; now she has {c}. How many at first?",
         "variables": {"a": {"type": "integer", "min": 3, "max": 25}, "n": {"type": "integer", "min": 5, "max": 40}},
         "derived_variables": {"c": "n+a"}, "answer_formula": "c-a"},
        {"text": "Tickets cost {p} each. A group paid {t}. How many tickets?",
         "variables": {"p": {"type": "integer", "min": 6, "max": 15}, "n": {"type": "integer", "min": 2, "max": 12}},
         "derived_variables": {"t": "p*n"}, "answer_formula": "t/p"},
    ]}})


def test_text_choice_picks_a_story_per_question_with_its_own_answer():
    items = generate(STORIES, count=20, seed="st", salt="v")["items"]
    assert {i["variables"]["story"] for i in items} == {"1", "2"}
    assert len({i["fingerprint"] for i in items}) == 20
    for i in items:
        v = {k: sp.Rational(x) for k, x in i["variables"].items()}
        expected = v["c"] - v["a"] if i["variables"]["story"] == "1" else v["t"] / v["p"]
        assert sp.Rational(int(i["expectedNumerator"]), int(i["expectedDenominator"])) == expected == v["n"]
        assert "{" not in i["promptLatex"]
    again = generate(STORIES, count=20, seed="st", salt="v")["items"]
    assert [i["promptLatex"] for i in again] == [i["promptLatex"] for i in items]


def test_text_choice_validate_shows_every_story_and_reports_option_errors():
    r = validate(STORIES)
    assert r["valid"] and [s["variables"]["story"] for s in r["samples"]] == ["1", "2"]
    def story(*options):
        return TemplateConfig(**{**STORIES.__dict__, "variables": {"story": {"type": "text_choice", "options": list(options)}}})
    r = validate(story({"text": "{a} apples", "answer_formula": "a+1"}, {"text": "{a} pears", "answer_formula": "a+"}))
    assert not r["valid"] and [e["message"].split(":")[0] for e in r["errors"]] == ["story option 2"]
    r = validate(story({"text": "{a} apples", "answer_formula": "a+1"}, "plain text without a formula"))
    assert not r["valid"] and "story option 2: needs an answer_formula" in r["errors"][0]["message"]


def test_text_choice_plain_words_with_shared_formula():
    cfg = TemplateConfig(prompt_template="{name} has {a:1-9} apples and buys {b:1-9} more. How many now?",
                         answer_formula="a+b", answer_mode="numeric",
                         variables={"name": {"type": "text_choice", "options": ["Maria", "Jamal", "Ana"]}})
    items = generate(cfg, count=12, seed="w")["items"]
    assert all(i["promptLatex"].split(" ")[0] in ("Maria", "Jamal", "Ana") for i in items)
    assert validate(cfg)["answerFormulaLatex"] is not None


FIGURES = {
    "rectangle": {"labels": {"width": "{a} cm", "height": "{b} cm", "inside": "A"}, "size": {"width": "a", "height": "b"}},
    "square": {"labels": {"side": "{a} m"}},
    "triangle": {"labels": {"base": "{a}", "height": "{b}", "left": "x", "right": "y"}, "size": {"base": "a", "height": "b"}},
    "right_triangle": {"labels": {"base": "{a}", "height": "{b}", "hypotenuse": "?"}},
    "circle": {"labels": {"radius": "r = {a}"}},
    "trapezoid": {"labels": {"top": "{a}", "bottom": "{b}", "height": "4"}, "size": {"top": "a", "bottom": "b"}},
    "ellipse": {"labels": {"a": "{a} cm", "b": "{b} cm"}, "size": {"a": "a", "b": "b"}},
}


@pytest.mark.parametrize("shape", sorted(FIGURES))
def test_figure_is_drawn_with_the_question_values(shape):
    import xml.etree.ElementTree as ET
    cfg = TemplateConfig(prompt_template="Sides {a:2-30} and {b:2-30}.", answer_formula="a*b", answer_mode="numeric",
                         figure={"shape": shape, **FIGURES[shape]})
    assert validate(cfg)["valid"]
    for item in generate(cfg, count=3, seed=shape)["items"]:
        svg = ET.fromstring(item["figureSvg"])
        texts = [t.text for t in svg.iter("{http://www.w3.org/2000/svg}text")]
        assert any(item["variables"]["a"] in (t or "") for t in texts)


def test_figure_labels_are_escaped_and_specs_are_checked():
    def cfg(figure):
        return TemplateConfig(prompt_template="Side {a:2-9}", answer_formula="a*a", answer_mode="numeric", figure=figure)
    svg = generate(cfg({"shape": "square", "labels": {"side": "<script>{a}"}}), count=1, seed="e")["items"][0]["figureSvg"]
    assert "<script>" not in svg and "&lt;script&gt;" in svg
    for figure, message in [({"shape": "hexagon"}, "shape must be one of"),
                            ({"shape": "square", "labels": {"base": "x"}}, "square labels can be"),
                            ({"shape": "square", "labels": {"side": "{z} m"}}, "undefined variables: z"),
                            ({"shape": "circle", "labels": {"radius": "r", "diameter": "d"}}, "not both")]:
        r = validate(cfg(figure))
        assert not r["valid"] and message in r["errors"][0]["message"], (figure, r["errors"])
    assert generate(cfg(None), count=1, seed="n")["items"][0]["figureSvg"] is None


def test_text_choice_option_can_bring_its_own_figure():
    cfg = TemplateConfig(prompt_template="{q}", answer_formula="q.answer_formula", answer_mode="numeric",
                         variables={"q": {"type": "text_choice", "options": [
                             {"text": "Square side {a:2-9}. Area?", "answer_formula": "a*a",
                              "figure": {"shape": "square", "labels": {"side": "{a}"}}},
                             {"text": "Circle radius {a:2-9}. Diameter?", "answer_formula": "2*a",
                              "figure": {"shape": "circle", "labels": {"radius": "{a}"}}}]}})
    items = generate(cfg, count=10, seed="f")["items"]
    for i in items:
        assert ("<circle" in i["figureSvg"]) == (i["variables"]["q"] == "2")


def test_text_choice_fills_a_small_variant_from_the_others():
    # Option 1 has only 2 distinct questions; asking for 20 must still work, using option 2 for the rest.
    cfg = TemplateConfig(prompt_template="{q}", answer_formula="q.answer_formula", answer_mode="numeric",
                         variables={"q": {"type": "text_choice", "options": [
                             {"text": "Tiny {a:1-2}", "answer_formula": "a"},
                             {"text": "Big {b:1-50}", "answer_formula": "b"}]}})
    items = generate(cfg, count=20, seed="fill")["items"]
    assert len({i["promptLatex"] for i in items}) == 20
    assert sum(i["variables"]["q"] == "1" for i in items) <= 2
    assert [i["promptLatex"] for i in generate(cfg, count=20, seed="fill")["items"]] == [i["promptLatex"] for i in items]
    with pytest.raises(GenerationError, match="Only 52 distinct"):
        generate(cfg, count=53, seed="fill")
