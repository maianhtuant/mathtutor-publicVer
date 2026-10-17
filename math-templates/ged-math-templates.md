# GED math template catalog

163 original template families covering 62 content indicators. Each includes a LaTeX question, answer rule, variable specification, explanation, and generated example.

These are original practice items, not official GED questions. This bank covers the listed skills but does not exhaust the possible contexts, reasoning tasks, or interactive exam formats.

## How to use

- Copy **Template** into the question field and **Answer formula** into the formula field for compatible numeric entries. Keep relative tolerance at 0; use rounded-decimal acceptance only where stated.
- Inline `{name:min–max}` ranges are included for independent integer variables. Repeated placeholders reuse the same value.
- JSON is a proposed interchange format, not a guaranteed one-click import for your existing application. It needs an adapter.
- Derived variables must be calculated before rendering. Constraints require filtered sampling. Numeric formulas that reference derived variables cannot simply be pasted into the pictured integer-only form.
- Expression, factoring, equation, inequality, solution-set, ordered-pair, graph and category answers require their listed grader/UI capabilities. Do not treat them as display-only questions.
- Use the full JSON bank for the Spring Boot + Python math-service design. Use `ged-numeric-form-templates.json` for the simpler subset.
- The LaTeX catalog shows a resolved example for every family; the JSON/Markdown retain the reusable placeholder syntax.
- Keep correct answers and answer rules server-side during student attempts. Assign published practice sets through admin access controls.

## Answer and generation conventions

Numeric answers use exact rational values where possible. Irrational square roots retain an exact expression and a 50-digit evaluation for the rounded example. Rounded answers use ROUND_HALF_UP. A numeric entry records both the exact result and a rounded sample where applicable. Circle/solid questions explicitly specify pi = 3.14.

Symbolic graders must check equivalence on the stated domain. Factoring graders must additionally require factored structure; graph graders must check the requested graph; solution-set graders ignore order and duplicate roots. For inequalities, check direction and endpoint inclusion. Budget answers also retain the integer/nonnegative domain.

A graph/diagram field is a rendering specification rather than an image. Render it when generating an item; freeze it with the item snapshot. The LaTeX catalog includes example input graphs for graph-reading items.

The symbolic rule in F15 uses x0/y0 for stored point coordinates, avoiding collisions with the answer variables x/y. Preserve that distinction in your grading adapter. `domain_restrictions` and `grading_requirements` define additional grading checks for each family.

## Sources

[GED assessment guide](https://www.ged.com/content/dam/websites/ged/resources/en/assessment-guide-for-educators-math.pdf) supplies the topic/indicator framework; [GED formula sheet](https://www.ged.com/content/dam/websites/ged/post/math-formula-sheet.pdf) is a reference for supplied formulas. The catalog questions and explanations are newly authored.

## Skill coverage

| Indicator | Template IDs |
|---|---|
| Q.1.a | N13 |
| Q.1.b | N14, N15 |
| Q.1.c | N19, N20, N21, N24 |
| Q.1.d | N16, N17 |
| Q.2.a | N01, N02, N03, N04, N05, N06, N07, N08, N09, N10, N11, N12 |
| Q.2.b | N22 |
| Q.2.c | N23 |
| Q.2.d | N25 |
| Q.2.e | N18, N26, R18 |
| Q.3.a | R01, R02 |
| Q.3.b | R03, R04 |
| Q.3.c | R05, R06, R07, R18 |
| Q.3.d | R08, R09, R10, R11, R12, R13, R14, R15, R16, R17 |
| Q.4.a | G01, G02, G03, G04, G05, G06 |
| Q.4.b | G07, G08, G09, G10 |
| Q.4.c | G11, G12, G13 |
| Q.4.d | G14, G15 |
| Q.4.e | G16, G17 |
| Q.5.a | G18, G19, G20 |
| Q.5.b | G21, G22, G23 |
| Q.5.c | G24, G25 |
| Q.5.d | G26, G27, G28, G29 |
| Q.5.e | G30, G31, G32 |
| Q.5.f | G33, G34 |
| Q.6.a | D09, D10 |
| Q.6.b | D08, D11, D12 |
| Q.6.c | D13 |
| Q.7.a | D01, D02, D03, D04, D05, D06, D07, D08 |
| Q.8.a | P01, P02, P03 |
| Q.8.b | P04, P05, P06, P07 |
| A.1.a | E01, E02 |
| A.1.b | E03 |
| A.1.c | E04 |
| A.1.d | E05, E06, E07, E08 |
| A.1.e | E09 |
| A.1.f | E10, E11, E12 |
| A.1.g | E13 |
| A.1.h | E14, E15 |
| A.1.i | E16 |
| A.1.j | E17 |
| A.2.a | L01, L02, L03, L04, L05, L06, L07 |
| A.2.b | L08 |
| A.2.c | L09, L10 |
| A.2.d | L11, L12, L13 |
| A.3.a | I01, I02 |
| A.3.b | I03, I04 |
| A.3.c | I05 |
| A.3.d | I06 |
| A.4.a | Q01, Q02, Q03, Q04, Q05, Q07 |
| A.4.b | Q06, Q07 |
| A.5.a | F01 |
| A.5.b | F02, F03, F04, F05 |
| A.5.c | F06 |
| A.5.d | F07 |
| A.5.e | F08, F09, F10, F11, F12, F13 |
| A.6.a | F14 |
| A.6.b | F15 |
| A.6.c | F16, F17 |
| A.7.a | F18 |
| A.7.b | F19 |
| A.7.c | F20, F21 |
| A.7.d | F22 |

## Number sense and arithmetic


### N01 — Integer addition

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Compute \({a:-30–30}+({b:-30–30})\).
```

**Answer formula/rule:**
```text
a+b
```

**Variables:** `{"a": {"type": "integer", "min": -30, "max": 30}, "b": {"type": "integer", "min": -30, "max": 30}}`

**Explanation:** Add the signed values.

**Example question:** Compute \(-9+(7)\).

**Example answer:** -2

### N02 — Integer subtraction

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Compute \({a:-30–30}-({b:-30–30})\).
```

**Answer formula/rule:**
```text
a-b
```

**Variables:** `{"a": {"type": "integer", "min": -30, "max": 30}, "b": {"type": "integer", "min": -30, "max": 30}}`

**Explanation:** Subtracting a number is adding its opposite.

**Example question:** Compute \(-27-(12)\).

**Example answer:** -39

### N03 — Integer multiplication

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Compute \(({a:-12–12})\times({b:-12–12})\).
```

**Answer formula/rule:**
```text
a*b
```

**Variables:** `{"a": {"type": "integer", "min": -12, "max": 12}, "b": {"type": "integer", "min": -12, "max": 12}}`

**Explanation:** Multiply magnitudes and apply the sign rule.

**Example question:** Compute \((-4)\times(8)\).

**Example answer:** -32

### N04 — Integer division

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Compute \({a:-100–100}\div {b:1–12}\).
```

**Answer formula/rule:**
```text
a/b
```

**Variables:** `{"a": {"type": "integer", "min": -100, "max": 100}, "b": {"type": "integer", "min": 1, "max": 12}}`

**Explanation:** Write the quotient as a reduced fraction if necessary.

**Example question:** Compute \(-49\div 3\).

**Example answer:** -49/3

### N05 — Fraction addition

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Compute \(\frac{{a:1–12}}{{b:2–12}} + \frac{{c:1–12}}{{d:2–12}}\).
```

**Answer formula/rule:**
```text
a/b + c/d
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": 2, "max": 12}, "c": {"type": "integer", "min": 1, "max": 12}, "d": {"type": "integer", "min": 2, "max": 12}}`

**Explanation:** Use fraction arithmetic and reduce the result.

**Example question:** Compute \(\frac{7}{9} + \frac{2}{2}\).

**Example answer:** 16/9

### N06 — Fraction subtraction

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Compute \(\frac{{a:1–12}}{{b:2–12}} - \frac{{c:1–12}}{{d:2–12}}\).
```

**Answer formula/rule:**
```text
a/b - c/d
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": 2, "max": 12}, "c": {"type": "integer", "min": 1, "max": 12}, "d": {"type": "integer", "min": 2, "max": 12}}`

**Explanation:** Use fraction arithmetic and reduce the result.

**Example question:** Compute \(\frac{2}{3} - \frac{1}{4}\).

**Example answer:** 5/12

### N07 — Fraction multiplication

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Compute \(\frac{{a:1–12}}{{b:2–12}} \times \frac{{c:1–12}}{{d:2–12}}\).
```

**Answer formula/rule:**
```text
a/b * c/d
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": 2, "max": 12}, "c": {"type": "integer", "min": 1, "max": 12}, "d": {"type": "integer", "min": 2, "max": 12}}`

**Explanation:** Use fraction arithmetic and reduce the result.

**Example question:** Compute \(\frac{2}{5} \times \frac{9}{6}\).

**Example answer:** 0.6

### N08 — Fraction division

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Compute \(\frac{{a:1–12}}{{b:2–12}}\div\frac{{c:1–12}}{{d:2–12}}\).
```

**Answer formula/rule:**
```text
(a/b)/(c/d)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": 2, "max": 12}, "c": {"type": "integer", "min": 1, "max": 12}, "d": {"type": "integer", "min": 2, "max": 12}}`

**Explanation:** Multiply the first fraction by the reciprocal of the second.

**Example question:** Compute \(\frac{12}{9}\div\frac{11}{10}\).

**Example answer:** 40/33

### N09 — Decimal addition

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Compute \({a} + {b}\).
```

**Answer formula/rule:**
```text
a + b
```

**Variables:** `{"u": {"type": "integer", "min": 11, "max": 99}, "v": {"type": "integer", "min": 11, "max": 99}}`

**Derived variables, in order:** `{"a": "u/10", "b": "v/10"}`

**Explanation:** Treat the decimals as exact fractions, then calculate.

**Example question:** Compute \(4.9 + 9.5\).

**Example answer:** 14.4

### N10 — Decimal subtraction

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Compute \({a} - {b}\).
```

**Answer formula/rule:**
```text
a - b
```

**Variables:** `{"u": {"type": "integer", "min": 11, "max": 99}, "v": {"type": "integer", "min": 11, "max": 99}}`

**Derived variables, in order:** `{"a": "u/10", "b": "v/10"}`

**Explanation:** Treat the decimals as exact fractions, then calculate.

**Example question:** Compute \(5.9 - 3.3\).

**Example answer:** 2.6

### N11 — Decimal multiplication

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Compute \({a} \times {b}\).
```

**Answer formula/rule:**
```text
a * b
```

**Variables:** `{"u": {"type": "integer", "min": 11, "max": 99}, "v": {"type": "integer", "min": 11, "max": 99}}`

**Derived variables, in order:** `{"a": "u/10", "b": "v/10"}`

**Explanation:** Treat the decimals as exact fractions, then calculate.

**Example question:** Compute \(6.3 \times 5.6\).

**Example answer:** 35.28

### N12 — Decimal division

**Targets:** Q.2.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Compute \({a} \div {b}\).
```

**Answer formula/rule:**
```text
a / b
```

**Variables:** `{"u": {"type": "integer", "min": 11, "max": 99}, "v": {"type": "integer", "min": 11, "max": 99}}`

**Derived variables, in order:** `{"a": "u/10", "b": "v/10"}`

**Explanation:** Treat the decimals as exact fractions, then calculate.

**Example question:** Compute \(2.1 \div 2.1\).

**Example answer:** 1

### N13 — Order rational numbers

**Targets:** Q.1.a  
**Answer mode:** ordered_list  
**Required extensions:** derived_variables, ordered_list_grading

**Template:**
```text
Order \(\frac{{a:1–9}}{{b:2–10}},\ \frac{{c:1–9}}{{d:2–10}},\ {e}\) from least to greatest.
```

**Answer formula/rule:**
```text
sort([a/b,c/d,e])
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 9}, "b": {"type": "integer", "min": 2, "max": 10}, "c": {"type": "integer", "min": 1, "max": 9}, "d": {"type": "integer", "min": 2, "max": 10}, "u": {"type": "integer", "min": 1, "max": 99}}`

**Derived variables, in order:** `{"e": "u/100"}`

**Explanation:** Compare the exact rational values; accept ties in either order.

**Example question:** Order \(\frac{7}{9},\ \frac{8}{4},\ 0.96\) from least to greatest.

**Example answer:** (7/9, 0.96, 2)

### N14 — LCM

**Targets:** Q.1.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find the least common multiple of \({a:2–20}\) and \({b:2–20}\).
```

**Answer formula/rule:**
```text
lcm(a,b)
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 20}, "b": {"type": "integer", "min": 2, "max": 20}}`

**Explanation:** Use LCM(a,b) = a*b/GCD(a,b).

**Example question:** Find the least common multiple of \(19\) and \(2\).

**Example answer:** 38

### N15 — Greatest common factor

**Targets:** Q.1.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find the greatest common factor of \({a:6–60}\) and \({b:6–60}\).
```

**Answer formula/rule:**
```text
gcd(a,b)
```

**Variables:** `{"a": {"type": "integer", "min": 6, "max": 60}, "b": {"type": "integer", "min": 6, "max": 60}}`

**Explanation:** Find the greatest positive integer dividing both numbers.

**Example question:** Find the greatest common factor of \(50\) and \(27\).

**Example answer:** 1

### N16 — Absolute value

**Targets:** Q.1.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Evaluate \(\left|{a:-50–50}\right|\).
```

**Answer formula/rule:**
```text
abs(a)
```

**Variables:** `{"a": {"type": "integer", "min": -50, "max": 50}}`

**Explanation:** Absolute value is distance from zero.

**Example question:** Evaluate \(\left|-31\right|\).

**Example answer:** 31

### N17 — Distance on a number line

**Targets:** Q.1.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find the distance between \({a:-30–30}\) and \({b:-30–30}\) on a number line.
```

**Answer formula/rule:**
```text
abs(a-b)
```

**Variables:** `{"a": {"type": "integer", "min": -30, "max": 30}, "b": {"type": "integer", "min": -30, "max": 30}}`

**Explanation:** Take the absolute value of the difference.

**Example question:** Find the distance between \(-6\) and \(11\) on a number line.

**Example answer:** 17

### N18 — Order of operations

**Targets:** Q.2.e  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Evaluate \({a:1–20}+{b:2–10}\times({c:5–20}-{d:1–4})\).
```

**Answer formula/rule:**
```text
a+b*(c-d)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 20}, "b": {"type": "integer", "min": 2, "max": 10}, "c": {"type": "integer", "min": 5, "max": 20}, "d": {"type": "integer", "min": 1, "max": 4}}`

**Explanation:** Evaluate parentheses, multiplication, then addition.

**Example question:** Evaluate \(10+2\times(9-1)\).

**Example answer:** 26

### N19 — Product of powers

**Targets:** Q.1.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Evaluate \({a:2–5}^{ {m:1–3}}\times {a}^{ {n:1–3}}\).
```

**Answer formula/rule:**
```text
pow(a,m+n)
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 5}, "m": {"type": "integer", "min": 1, "max": 3}, "n": {"type": "integer", "min": 1, "max": 3}}`

**Explanation:** Add exponents for the same base.

**Example question:** Evaluate \(4^{ 2}\times 4^{ 2}\).

**Example answer:** 256

### N20 — Quotient of powers

**Targets:** Q.1.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Evaluate \(\frac{{a:2–5}^{ {m:1–5}}}{{a}^{ {n:1–5}}}\).
```

**Answer formula/rule:**
```text
pow(a,m-n)
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 5}, "m": {"type": "integer", "min": 1, "max": 5}, "n": {"type": "integer", "min": 1, "max": 5}}`

**Explanation:** Subtract exponents; negative exponents give reciprocals.

**Example question:** Evaluate \(\frac{2^{ 4}}{2^{ 3}}\).

**Example answer:** 2

### N21 — Negative exponent

**Targets:** Q.1.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Evaluate \({a:2–10}^{-{n:1–3}}\).
```

**Answer formula/rule:**
```text
1/pow(a,n)
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 10}, "n": {"type": "integer", "min": 1, "max": 3}}`

**Explanation:** A negative exponent gives the reciprocal.

**Example question:** Evaluate \(4^{-1}\).

**Example answer:** 0.25

### N22 — Square root of a perfect square

**Targets:** Q.2.b  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Evaluate \(\sqrt{{k}}\).
```

**Answer formula/rule:**
```text
sqrt(k)
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 20}}`

**Derived variables, in order:** `{"k": "a*a"}`

**Explanation:** The principal square root is nonnegative.

**Example question:** Evaluate \(\sqrt{121}\).

**Example answer:** 11

### N23 — Cube root

**Targets:** Q.2.c  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Evaluate \(\sqrt[3]{{k}}\).
```

**Answer formula/rule:**
```text
a
```

**Variables:** `{"a": {"type": "integer", "min": -10, "max": 10}}`

**Derived variables, in order:** `{"k": "a*a*a"}`

**Explanation:** The real cube root preserves the sign.

**Example question:** Evaluate \(\sqrt[3]{-512}\).

**Example answer:** -8

### N24 — Rational exponent

**Targets:** Q.1.c  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Evaluate \({k}^{3/2}\).
```

**Answer formula/rule:**
```text
pow(a,3)
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 10}}`

**Derived variables, in order:** `{"k": "a*a"}`

**Explanation:** Take the square root, then cube the result.

**Example question:** Evaluate \(81^{3/2}\).

**Example answer:** 729

### N25 — Undefined expression

**Targets:** Q.2.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
At what value of \(x\) is \(\frac{1}{x-{a:-20–20}}\) undefined?
```

**Answer formula/rule:**
```text
a
```

**Variables:** `{"a": {"type": "integer", "min": -20, "max": 20}}`

**Explanation:** The denominator must not equal zero.

**Example question:** At what value of \(x\) is \(\frac{1}{x-1}\) undefined?

**Example answer:** 1

### N26 — Scientific notation product

**Targets:** Q.2.e  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Compute \(({a:1–9}\times10^{ {m:-3–3}})({b:1–9}\times10^{ {n:-3–3}})\). Enter the numeric value.
```

**Answer formula/rule:**
```text
a*b*pow(10,m+n)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 9}, "b": {"type": "integer", "min": 1, "max": 9}, "m": {"type": "integer", "min": -3, "max": 3}, "n": {"type": "integer", "min": -3, "max": 3}}`

**Explanation:** Multiply coefficients and add powers of ten.

**Example question:** Compute \((6\times10^{ -1})(9\times10^{ 0})\). Enter the numeric value.

**Example answer:** 5.4

## Ratios, rates, percents, and applications


### R01 — Unit price

**Targets:** Q.3.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A pack of {n:2–12} notebooks costs \(\${c:5–60}\). Find the cost per notebook.
```

**Answer formula/rule:**
```text
c/n
```

**Variables:** `{"n": {"type": "integer", "min": 2, "max": 12}, "c": {"type": "integer", "min": 5, "max": 60}}`

**Explanation:** Divide total cost by the number of items.

**Example question:** A pack of 3 notebooks costs \(\$49\). Find the cost per notebook.

**Example answer:** 49/3

### R02 — Average speed

**Targets:** Q.3.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A vehicle travels {d:30–300} miles in {t:1–6} hours. Find its average speed in miles per hour.
```

**Answer formula/rule:**
```text
d/t
```

**Variables:** `{"d": {"type": "integer", "min": 30, "max": 300}, "t": {"type": "integer", "min": 1, "max": 6}}`

**Explanation:** Speed = distance/time.

**Example question:** A vehicle travels 100 miles in 5 hours. Find its average speed in miles per hour.

**Example answer:** 20

### R03 — Scale drawing to actual length

**Targets:** Q.3.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A drawing uses {s:2–20} feet per inch. A length measures {l:2–15} inches. Find the actual length in feet.
```

**Answer formula/rule:**
```text
s*l
```

**Variables:** `{"s": {"type": "integer", "min": 2, "max": 20}, "l": {"type": "integer", "min": 2, "max": 15}}`

**Explanation:** Multiply drawing length by the scale.

**Example question:** A drawing uses 11 feet per inch. A length measures 11 inches. Find the actual length in feet.

**Example answer:** 121

### R04 — Actual length to drawing length

**Targets:** Q.3.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A drawing uses {s:2–20} feet per inch. The actual length is {l:10–120} feet. Find its drawing length in inches.
```

**Answer formula/rule:**
```text
l/s
```

**Variables:** `{"s": {"type": "integer", "min": 2, "max": 20}, "l": {"type": "integer", "min": 10, "max": 120}}`

**Explanation:** Divide actual length by the scale.

**Example question:** A drawing uses 20 feet per inch. The actual length is 49 feet. Find its drawing length in inches.

**Example answer:** 2.45

### R05 — Solve a proportion

**Targets:** Q.3.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Solve \(\frac{x}{{a:2–20}}=\frac{{b:1–15}}{{c:2–15}}\).
```

**Answer formula/rule:**
```text
a*b/c
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 20}, "b": {"type": "integer", "min": 1, "max": 15}, "c": {"type": "integer", "min": 2, "max": 15}}`

**Explanation:** Cross-multiply, then isolate x.

**Example question:** Solve \(\frac{x}{13}=\frac{2}{5}\).

**Example answer:** 5.2

### R06 — Recipe scaling

**Targets:** Q.3.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A recipe uses {c:1–6} cups of flour for {s:2–12} servings. How many cups are needed for {n:4–30} servings?
```

**Answer formula/rule:**
```text
c*n/s
```

**Variables:** `{"c": {"type": "integer", "min": 1, "max": 6}, "s": {"type": "integer", "min": 2, "max": 12}, "n": {"type": "integer", "min": 4, "max": 30}}`

**Explanation:** Multiply cups per serving by the new serving count.

**Example question:** A recipe uses 5 cups of flour for 2 servings. How many cups are needed for 11 servings?

**Example answer:** 27.5

### R07 — Unit conversion

**Targets:** Q.3.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Convert {f:1–12} feet {i:0–11} inches to inches.
```

**Answer formula/rule:**
```text
12*f+i
```

**Variables:** `{"f": {"type": "integer", "min": 1, "max": 12}, "i": {"type": "integer", "min": 0, "max": 11}}`

**Explanation:** Each foot contains twelve inches.

**Example question:** Convert 8 feet 3 inches to inches.

**Example answer:** 99

### R08 — Percent of a quantity

**Targets:** Q.3.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find \({p:5–90}\%\) of \({a:20–500}\).
```

**Answer formula/rule:**
```text
p*a/100
```

**Variables:** `{"p": {"type": "integer", "min": 5, "max": 90}, "a": {"type": "integer", "min": 20, "max": 500}}`

**Explanation:** Convert the percent to a fraction over 100.

**Example question:** Find \(55\%\) of \(116\).

**Example answer:** 63.8

### R09 — Find a percentage

**Targets:** Q.3.d  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
{a} out of {b} items passed inspection. What percentage passed?
```

**Answer formula/rule:**
```text
100*a/b
```

**Variables:** `{"n": {"type": "integer", "min": 2, "max": 20}, "k": {"type": "integer", "min": 1, "max": 9}}`

**Derived variables, in order:** `{"b": "10*n", "p": "10*k", "a": "n*k"}`

**Explanation:** Divide the part by the whole, then multiply by 100.

**Example question:** 19 out of 190 items passed inspection. What percentage passed?

**Example answer:** 10

### R10 — Find the original whole

**Targets:** Q.3.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
\({p:5–90}\%\) of a quantity is {a:10–200}. Find the quantity.
```

**Answer formula/rule:**
```text
100*a/p
```

**Variables:** `{"p": {"type": "integer", "min": 5, "max": 90}, "a": {"type": "integer", "min": 10, "max": 200}}`

**Explanation:** Divide the part by the percentage written as a decimal.

**Example question:** \(23\%\) of a quantity is 74. Find the quantity.

**Example answer:** 7400/23

### R11 — Sales tax

**Targets:** Q.3.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
An item costs \(\${c:10–250}\) before a {p:1–12}\% sales tax. Find the total price, rounded to cents.
```

**Answer formula/rule:**
```text
c*(1+p/100)
```

**Variables:** `{"c": {"type": "integer", "min": 10, "max": 250}, "p": {"type": "integer", "min": 1, "max": 12}}`

**Explanation:** Add the tax to the original price and round to cents.

**Example question:** An item costs \(\$137\) before a 10\% sales tax. Find the total price, rounded to cents.

**Example answer:** 150.7

**Accepted rounded example:** 150.70 (exact answers are also accepted).

### R12 — Discount then tax

**Targets:** Q.3.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
An item costs \(\${c:20–300}\). Apply a {d:5–50}\% discount, then a {t:1–12}\% tax to the discounted price. Find the final price, rounded to cents.
```

**Answer formula/rule:**
```text
c*(1-d/100)*(1+t/100)
```

**Variables:** `{"c": {"type": "integer", "min": 20, "max": 300}, "d": {"type": "integer", "min": 5, "max": 50}, "t": {"type": "integer", "min": 1, "max": 12}}`

**Explanation:** Apply the discount factor first, then the tax factor.

**Example question:** An item costs \(\$229\). Apply a 31\% discount, then a 1\% tax to the discounted price. Find the final price, rounded to cents.

**Example answer:** 159.5901

**Accepted rounded example:** 159.59 (exact answers are also accepted).

### R13 — Tip and total

**Targets:** Q.3.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A meal costs \(\${c:10–150}\) before a {p:10–25}\% tip. Ignoring tax, find the total, rounded to cents.
```

**Answer formula/rule:**
```text
c*(1+p/100)
```

**Variables:** `{"c": {"type": "integer", "min": 10, "max": 150}, "p": {"type": "integer", "min": 10, "max": 25}}`

**Explanation:** Total = bill times one plus the tip rate.

**Example question:** A meal costs \(\$18\) before a 10\% tip. Ignoring tax, find the total, rounded to cents.

**Example answer:** 19.8

**Accepted rounded example:** 19.80 (exact answers are also accepted).

### R14 — Simple interest

**Targets:** Q.3.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find simple interest on \(\${p:100–5000}\) at {r:1–12}\% per year for {t:1–5} years.
```

**Answer formula/rule:**
```text
p*r*t/100
```

**Variables:** `{"p": {"type": "integer", "min": 100, "max": 5000}, "r": {"type": "integer", "min": 1, "max": 12}, "t": {"type": "integer", "min": 1, "max": 5}}`

**Explanation:** Use I = Prt with the rate as a decimal.

**Example question:** Find simple interest on \(\$3146\) at 4\% per year for 3 years.

**Example answer:** 377.52

### R15 — Percent increase

**Targets:** Q.3.d  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A price rises from \(\${a:20–200}\) to \(\${b}\). Find the percentage increase.
```

**Answer formula/rule:**
```text
100*(b-a)/a
```

**Variables:** `{"a": {"type": "integer", "min": 20, "max": 200}, "k": {"type": "integer", "min": 1, "max": 80}}`

**Derived variables, in order:** `{"b": "a+k"}`

**Explanation:** Divide the increase by the original amount.

**Example question:** A price rises from \(\$149\) to \(\$152\). Find the percentage increase.

**Example answer:** 300/149

### R16 — Percent decrease

**Targets:** Q.3.d  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A quantity falls from {a} to {b:10–100}. Find the percentage decrease.
```

**Answer formula/rule:**
```text
100*(a-b)/a
```

**Variables:** `{"b": {"type": "integer", "min": 10, "max": 100}, "k": {"type": "integer", "min": 1, "max": 80}}`

**Derived variables, in order:** `{"a": "b+k"}`

**Explanation:** Divide the decrease by the original amount.

**Example question:** A quantity falls from 59 to 52. Find the percentage decrease.

**Example answer:** 700/59

### R17 — Commission

**Targets:** Q.3.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A salesperson earns {p:1–20}\% commission on \(\${s:100–5000}\) in sales. Find the commission.
```

**Answer formula/rule:**
```text
p*s/100
```

**Variables:** `{"p": {"type": "integer", "min": 1, "max": 20}, "s": {"type": "integer", "min": 100, "max": 5000}}`

**Explanation:** Multiply sales by the commission rate.

**Example question:** A salesperson earns 10\% commission on \(\$1646\) in sales. Find the commission.

**Example answer:** 164.6

### R18 — Multistep purchase

**Targets:** Q.2.e, Q.3.c  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
You buy {n:2–10} items at \(\${p:2–20}\) each and pay with \(\${cash}\). Find the change.
```

**Answer formula/rule:**
```text
cash-n*p
```

**Variables:** `{"n": {"type": "integer", "min": 2, "max": 10}, "p": {"type": "integer", "min": 2, "max": 20}, "extra": {"type": "integer", "min": 1, "max": 50}}`

**Derived variables, in order:** `{"cash": "n*p+extra"}`

**Explanation:** Subtract the total purchase cost from the amount paid.

**Example question:** You buy 10 items at \(\$7\) each and pay with \(\$111\). Find the change.

**Example answer:** 41

## Geometry and measurement


### G01 — Rectangle area

**Targets:** Q.4.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A rectangle has length {l:2–30} cm and width {w:2–20} cm. Find its area in square centimeters.
```

**Answer formula/rule:**
```text
l*w
```

**Variables:** `{"l": {"type": "integer", "min": 2, "max": 30}, "w": {"type": "integer", "min": 2, "max": 20}}`

**Explanation:** Area = length times width.

**Example question:** A rectangle has length 13 cm and width 18 cm. Find its area in square centimeters.

**Example answer:** 234

### G02 — Rectangle perimeter

**Targets:** Q.4.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A rectangle measures {l:2–30} cm by {w:2–20} cm. Find its perimeter in centimeters.
```

**Answer formula/rule:**
```text
2*(l+w)
```

**Variables:** `{"l": {"type": "integer", "min": 2, "max": 30}, "w": {"type": "integer", "min": 2, "max": 20}}`

**Explanation:** Add all four side lengths.

**Example question:** A rectangle measures 7 cm by 13 cm. Find its perimeter in centimeters.

**Example answer:** 40

### G03 — Rectangle missing width

**Targets:** Q.4.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A rectangle has area {A} square centimeters and length {l:2–30} cm. Find its width.
```

**Answer formula/rule:**
```text
A/l
```

**Variables:** `{"l": {"type": "integer", "min": 2, "max": 30}, "w": {"type": "integer", "min": 2, "max": 20}}`

**Derived variables, in order:** `{"A": "l*w"}`

**Explanation:** Width = area/length.

**Example question:** A rectangle has area 117 square centimeters and length 13 cm. Find its width.

**Example answer:** 9

### G04 — Triangle area

**Targets:** Q.4.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A triangle has base {b:2–30} cm and perpendicular height {h:2–20} cm. Find its area.
```

**Answer formula/rule:**
```text
b*h/2
```

**Variables:** `{"b": {"type": "integer", "min": 2, "max": 30}, "h": {"type": "integer", "min": 2, "max": 20}}`

**Explanation:** Use half the base times the height.

**Example question:** A triangle has base 20 cm and perpendicular height 14 cm. Find its area.

**Example answer:** 140

### G05 — Triangle perimeter

**Targets:** Q.4.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A triangle has side lengths {a}, {b}, and {c} cm. Find its perimeter.
```

**Answer formula/rule:**
```text
a+b+c
```

**Variables:** `{"k": {"type": "integer", "min": 1, "max": 10}}`

**Derived variables, in order:** `{"a": "3*k", "b": "4*k", "c": "5*k"}`

**Explanation:** Add the three side lengths.

**Example question:** A triangle has side lengths 27, 36, and 45 cm. Find its perimeter.

**Example answer:** 108

### G06 — Triangle missing height

**Targets:** Q.4.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A triangle has area {A} square centimeters and base {b:2–20} cm. Find its perpendicular height.
```

**Answer formula/rule:**
```text
2*A/b
```

**Variables:** `{"b": {"type": "integer", "min": 2, "max": 20}, "h": {"type": "integer", "min": 2, "max": 20}}`

**Derived variables, in order:** `{"A": "b*h/2"}`

**Explanation:** Rearrange A = bh/2.

**Example question:** A triangle has area 80 square centimeters and base 20 cm. Find its perpendicular height.

**Example answer:** 8

### G07 — Circle area

**Targets:** Q.4.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A circle has radius {r:1–20} cm. Use \(\pi=3.14\). Find its area.
```

**Answer formula/rule:**
```text
3.14*r*r
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 20}}`

**Explanation:** Use A = pi*r squared with the stated value of pi.

**Example question:** A circle has radius 6 cm. Use \(\pi=3.14\). Find its area.

**Example answer:** 113.04

### G08 — Circle circumference

**Targets:** Q.4.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A circle has radius {r:1–20} cm. Use \(\pi=3.14\). Find its circumference.
```

**Answer formula/rule:**
```text
2*3.14*r
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 20}}`

**Explanation:** Use C = 2*pi*r.

**Example question:** A circle has radius 7 cm. Use \(\pi=3.14\). Find its circumference.

**Example answer:** 43.96

### G09 — Radius from circumference

**Targets:** Q.4.b  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A circle has circumference {C} cm. Use \(\pi=3.14\). Find its radius.
```

**Answer formula/rule:**
```text
C/(2*3.14)
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 20}}`

**Derived variables, in order:** `{"C": "2*3.14*r"}`

**Explanation:** Divide circumference by 2*pi.

**Example question:** A circle has circumference 75.36 cm. Use \(\pi=3.14\). Find its radius.

**Example answer:** 12

### G10 — Radius from area

**Targets:** Q.4.b  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A circle has area {A} square centimeters. Use \(\pi=3.14\). Find its radius.
```

**Answer formula/rule:**
```text
sqrt(A/3.14)
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 20}}`

**Derived variables, in order:** `{"A": "3.14*r*r"}`

**Explanation:** Take the nonnegative square root of area/pi.

**Example question:** A circle has area 12.56 square centimeters. Use \(\pi=3.14\). Find its radius.

**Example answer:** 2

### G11 — Trapezoid area

**Targets:** Q.4.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A trapezoid has parallel bases {a:2–20} and {b:2–20} cm and perpendicular height {h:2–15} cm. Find its area.
```

**Answer formula/rule:**
```text
(a+b)*h/2
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 20}, "b": {"type": "integer", "min": 2, "max": 20}, "h": {"type": "integer", "min": 2, "max": 15}}`

**Explanation:** Multiply the average base length by the height.

**Example question:** A trapezoid has parallel bases 7 and 2 cm and perpendicular height 11 cm. Find its area.

**Example answer:** 49.5

### G12 — Regular polygon perimeter

**Targets:** Q.4.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A regular polygon has {n:3–10} sides, each {s:2–20} cm long. Find its perimeter.
```

**Answer formula/rule:**
```text
n*s
```

**Variables:** `{"n": {"type": "integer", "min": 3, "max": 10}, "s": {"type": "integer", "min": 2, "max": 20}}`

**Explanation:** Multiply the number of sides by their common length.

**Example question:** A regular polygon has 8 sides, each 12 cm long. Find its perimeter.

**Example answer:** 96

### G13 — Regular polygon area

**Targets:** Q.4.c  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A regular polygon has perimeter {p} cm and apothem {a:2–12} cm. Given \(A=\frac12 pa\), calculate its area.
```

**Answer formula/rule:**
```text
p*a/2
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 12}}`

**Derived variables, in order:** `{"p": "8*a"}`

**Explanation:** Substitute in the supplied formula; the generated dimensions are consistent with a square.

**Example question:** A regular polygon has perimeter 80 cm and apothem 10 cm. Given \(A=\frac12 pa\), calculate its area.

**Example answer:** 400

### G14 — Composite rectangle area

**Targets:** Q.4.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A {L:15–30} cm by {W:15–30} cm rectangle has a {l:2–10} cm by {w:2–10} cm rectangular corner removed. Find the remaining area.
```

**Answer formula/rule:**
```text
L*W-l*w
```

**Variables:** `{"L": {"type": "integer", "min": 15, "max": 30}, "W": {"type": "integer", "min": 15, "max": 30}, "l": {"type": "integer", "min": 2, "max": 10}, "w": {"type": "integer", "min": 2, "max": 10}}`

**Explanation:** Subtract the removed area from the whole rectangle.

**Example question:** A 24 cm by 25 cm rectangle has a 5 cm by 7 cm rectangular corner removed. Find the remaining area.

**Example answer:** 565

### G15 — Rectangle and semicircle area

**Targets:** Q.4.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A rectangle is {l:5–25} cm long and {d:2–20} cm wide. A semicircle of diameter {d} cm is attached outside one width edge with no overlap. Use \(\pi=3.14\). Find the total area.
```

**Answer formula/rule:**
```text
l*d+3.14*pow(d/2,2)/2
```

**Variables:** `{"l": {"type": "integer", "min": 5, "max": 25}, "d": {"type": "integer", "min": 2, "max": 20}}`

**Explanation:** Add the rectangle area and half the circle area.

**Example question:** A rectangle is 17 cm long and 9 cm wide. A semicircle of diameter 9 cm is attached outside one width edge with no overlap. Use \(\pi=3.14\). Find the total area.

**Example answer:** 184.7925

### G16 — Pythagorean hypotenuse

**Targets:** Q.4.e  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A right triangle has legs {a:3–20} cm and {b:3–20} cm. Find its hypotenuse, rounded to two decimal places.
```

**Answer formula/rule:**
```text
sqrt(a*a+b*b)
```

**Variables:** `{"a": {"type": "integer", "min": 3, "max": 20}, "b": {"type": "integer", "min": 3, "max": 20}}`

**Explanation:** Use c = sqrt(a squared + b squared).

**Example question:** A right triangle has legs 8 cm and 9 cm. Find its hypotenuse, rounded to two decimal places.

**Example answer:** approx. 12.0415945788

**Accepted rounded example:** 12.04 (exact answers are also accepted).

### G17 — Pythagorean missing leg

**Targets:** Q.4.e  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A right triangle has hypotenuse {c} cm and one leg {a} cm. Find the other leg.
```

**Answer formula/rule:**
```text
sqrt(c*c-a*a)
```

**Variables:** `{"k": {"type": "integer", "min": 1, "max": 10}}`

**Derived variables, in order:** `{"c": "5*k", "a": "3*k"}`

**Explanation:** Use the positive square root of c squared minus a squared.

**Example question:** A right triangle has hypotenuse 50 cm and one leg 30 cm. Find the other leg.

**Example answer:** 40

### G18 — Rectangular prism volume

**Targets:** Q.5.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A rectangular prism measures {l:2–20} by {w:2–15} by {h:2–15} cm. Find its volume.
```

**Answer formula/rule:**
```text
l*w*h
```

**Variables:** `{"l": {"type": "integer", "min": 2, "max": 20}, "w": {"type": "integer", "min": 2, "max": 15}, "h": {"type": "integer", "min": 2, "max": 15}}`

**Explanation:** Multiply all three dimensions.

**Example question:** A rectangular prism measures 6 by 12 by 2 cm. Find its volume.

**Example answer:** 144

### G19 — Rectangular prism surface area

**Targets:** Q.5.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A rectangular prism measures {l:2–20} by {w:2–15} by {h:2–15} cm. Find its total surface area.
```

**Answer formula/rule:**
```text
2*(l*w+l*h+w*h)
```

**Variables:** `{"l": {"type": "integer", "min": 2, "max": 20}, "w": {"type": "integer", "min": 2, "max": 15}, "h": {"type": "integer", "min": 2, "max": 15}}`

**Explanation:** Add the areas of the six faces.

**Example question:** A rectangular prism measures 8 by 2 by 5 cm. Find its total surface area.

**Example answer:** 132

### G20 — Prism missing height

**Targets:** Q.5.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A rectangular prism has volume {V} cubic centimeters, length {l:2–15} cm and width {w:2–12} cm. Find its height.
```

**Answer formula/rule:**
```text
V/(l*w)
```

**Variables:** `{"l": {"type": "integer", "min": 2, "max": 15}, "w": {"type": "integer", "min": 2, "max": 12}, "h": {"type": "integer", "min": 2, "max": 12}}`

**Derived variables, in order:** `{"V": "l*w*h"}`

**Explanation:** Divide the volume by the base area.

**Example question:** A rectangular prism has volume 160 cubic centimeters, length 4 cm and width 10 cm. Find its height.

**Example answer:** 4

### G21 — Cylinder volume

**Targets:** Q.5.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A cylinder has radius {r:1–10} cm and height {h:2–20} cm. Use \(\pi=3.14\). Find its volume.
```

**Answer formula/rule:**
```text
3.14*r*r*h
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 10}, "h": {"type": "integer", "min": 2, "max": 20}}`

**Explanation:** Use V = pi*r squared*h.

**Example question:** A cylinder has radius 8 cm and height 7 cm. Use \(\pi=3.14\). Find its volume.

**Example answer:** 1406.72

### G22 — Cylinder surface area

**Targets:** Q.5.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A closed cylinder has radius {r:1–10} cm and height {h:2–20} cm. Use \(\pi=3.14\). Find its total surface area.
```

**Answer formula/rule:**
```text
2*3.14*r*h+2*3.14*r*r
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 10}, "h": {"type": "integer", "min": 2, "max": 20}}`

**Explanation:** Add the curved surface and both circular bases.

**Example question:** A closed cylinder has radius 1 cm and height 18 cm. Use \(\pi=3.14\). Find its total surface area.

**Example answer:** 119.32

### G23 — Cylinder missing height

**Targets:** Q.5.b  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A cylinder has volume {V} cubic centimeters and radius {r:1–10} cm. Use \(\pi=3.14\). Find its height.
```

**Answer formula/rule:**
```text
V/(3.14*r*r)
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 10}, "h": {"type": "integer", "min": 2, "max": 20}}`

**Derived variables, in order:** `{"V": "3.14*r*r*h"}`

**Explanation:** Divide the volume by the circular base area.

**Example question:** A cylinder has volume 423.9 cubic centimeters and radius 3 cm. Use \(\pi=3.14\). Find its height.

**Example answer:** 15

### G24 — Right prism volume

**Targets:** Q.5.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A right prism has base area {B:5–100} square centimeters and height {h:2–20} cm. Find its volume.
```

**Answer formula/rule:**
```text
B*h
```

**Variables:** `{"B": {"type": "integer", "min": 5, "max": 100}, "h": {"type": "integer", "min": 2, "max": 20}}`

**Explanation:** Volume = base area times height.

**Example question:** A right prism has base area 72 square centimeters and height 12 cm. Find its volume.

**Example answer:** 864

### G25 — Right prism surface area

**Targets:** Q.5.c  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A right triangular prism has base side lengths {a}, {b}, {c} cm, base area {B} square centimeters, and prism height {h:2–20} cm. Find its total surface area.
```

**Answer formula/rule:**
```text
(a+b+c)*h+2*B
```

**Variables:** `{"k": {"type": "integer", "min": 1, "max": 6}, "h": {"type": "integer", "min": 2, "max": 20}}`

**Derived variables, in order:** `{"a": "3*k", "b": "4*k", "c": "5*k", "B": "a*b/2"}`

**Explanation:** Use lateral area plus twice the base area.

**Example question:** A right triangular prism has base side lengths 6, 8, 10 cm, base area 24 square centimeters, and prism height 17 cm. Find its total surface area.

**Example answer:** 456

### G26 — Pyramid volume

**Targets:** Q.5.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A pyramid has base area {B:9–120} square centimeters and perpendicular height {h:3–18} cm. Find its volume.
```

**Answer formula/rule:**
```text
B*h/3
```

**Variables:** `{"B": {"type": "integer", "min": 9, "max": 120}, "h": {"type": "integer", "min": 3, "max": 18}}`

**Explanation:** Volume = one third of base area times height.

**Example question:** A pyramid has base area 52 square centimeters and perpendicular height 12 cm. Find its volume.

**Example answer:** 208

### G27 — Square pyramid surface area

**Targets:** Q.5.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A right square pyramid has base side {s:2–10} cm and slant height {l:6–15} cm. Find its total surface area.
```

**Answer formula/rule:**
```text
s*s+2*s*l
```

**Variables:** `{"s": {"type": "integer", "min": 2, "max": 10}, "l": {"type": "integer", "min": 6, "max": 15}}`

**Explanation:** Add the square base and four triangular faces.

**Example question:** A right square pyramid has base side 4 cm and slant height 14 cm. Find its total surface area.

**Example answer:** 128

### G28 — Cone volume

**Targets:** Q.5.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A cone has radius {r:1–10} cm and perpendicular height {h:3–18} cm. Use \(\pi=3.14\). Find its volume.
```

**Answer formula/rule:**
```text
3.14*r*r*h/3
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 10}, "h": {"type": "integer", "min": 3, "max": 18}}`

**Explanation:** Use one third of the circular base area times height.

**Example question:** A cone has radius 4 cm and perpendicular height 16 cm. Use \(\pi=3.14\). Find its volume.

**Example answer:** 20096/75

### G29 — Cone surface area

**Targets:** Q.5.d  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A cone has radius {r:1–5} cm and slant height {l:6–15} cm. Use \(\pi=3.14\). Find its total surface area.
```

**Answer formula/rule:**
```text
3.14*r*l+3.14*r*r
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 5}, "l": {"type": "integer", "min": 6, "max": 15}}`

**Explanation:** Add lateral area pi*r*l and base area pi*r squared.

**Example question:** A cone has radius 4 cm and slant height 13 cm. Use \(\pi=3.14\). Find its total surface area.

**Example answer:** 213.52

### G30 — Sphere volume

**Targets:** Q.5.e  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A sphere has radius {r:1–12} cm. Use \(\pi=3.14\). Find its volume, rounded to two decimal places.
```

**Answer formula/rule:**
```text
4*3.14*pow(r,3)/3
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 12}}`

**Explanation:** Use V = (4/3)*pi*r cubed.

**Example question:** A sphere has radius 8 cm. Use \(\pi=3.14\). Find its volume, rounded to two decimal places.

**Example answer:** 160768/75

**Accepted rounded example:** 2143.57 (exact answers are also accepted).

### G31 — Sphere surface area

**Targets:** Q.5.e  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A sphere has radius {r:1–12} cm. Use \(\pi=3.14\). Find its surface area.
```

**Answer formula/rule:**
```text
4*3.14*r*r
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 12}}`

**Explanation:** Use A = 4*pi*r squared.

**Example question:** A sphere has radius 2 cm. Use \(\pi=3.14\). Find its surface area.

**Example answer:** 50.24

### G32 — Sphere radius from area

**Targets:** Q.5.e  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A sphere has surface area {A} square centimeters. Use \(\pi=3.14\). Find its radius.
```

**Answer formula/rule:**
```text
sqrt(A/(4*3.14))
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 12}}`

**Derived variables, in order:** `{"A": "4*3.14*r*r"}`

**Explanation:** Rearrange the surface area formula and take the positive root.

**Example question:** A sphere has surface area 113.04 square centimeters. Use \(\pi=3.14\). Find its radius.

**Example answer:** 3

### G33 — Composite cylinder and hemisphere volume

**Targets:** Q.5.f  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A cylinder of radius {r:1–8} cm and height {h:2–15} cm has a hemisphere of the same radius attached on top, with no overlap. Use \(\pi=3.14\). Find the volume, rounded to two decimal places.
```

**Answer formula/rule:**
```text
3.14*r*r*h+2*3.14*pow(r,3)/3
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 8}, "h": {"type": "integer", "min": 2, "max": 15}}`

**Explanation:** Add cylinder volume and half a sphere volume.

**Example question:** A cylinder of radius 2 cm and height 15 cm has a hemisphere of the same radius attached on top, with no overlap. Use \(\pi=3.14\). Find the volume, rounded to two decimal places.

**Example answer:** 15386/75

**Accepted rounded example:** 205.15 (exact answers are also accepted).

### G34 — Composite cylinder and hemisphere surface area

**Targets:** Q.5.f  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A solid has a cylinder of radius {r:1–8} cm and height {h:2–15} cm, a hemisphere on top, and a flat circular bottom. Use \(\pi=3.14\). Find the external surface area.
```

**Answer formula/rule:**
```text
2*3.14*r*h+3*3.14*r*r
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 8}, "h": {"type": "integer", "min": 2, "max": 15}}`

**Explanation:** Add the cylinder side, hemisphere curved area, and bottom; exclude the joined face.

**Example question:** A solid has a cylinder of radius 1 cm and height 4 cm, a hemisphere on top, and a flat circular bottom. Use \(\pi=3.14\). Find the external surface area.

**Example answer:** 34.54

## Data, statistics, and probability


### D01 — Mean

**Targets:** Q.7.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find the mean of \({a:1–30},{b:1–30},{c:1–30},{d:1–30}\).
```

**Answer formula/rule:**
```text
mean(a,b,c,d)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 30}, "b": {"type": "integer", "min": 1, "max": 30}, "c": {"type": "integer", "min": 1, "max": 30}, "d": {"type": "integer", "min": 1, "max": 30}}`

**Explanation:** Sum the values and divide by four.

**Example question:** Find the mean of \(12,22,27,6\).

**Example answer:** 16.75

### D02 — Median of five values

**Targets:** Q.7.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find the median of \({a:1–30},{b:1–30},{c:1–30},{d:1–30},{e:1–30}\).
```

**Answer formula/rule:**
```text
median(a,b,c,d,e)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 30}, "b": {"type": "integer", "min": 1, "max": 30}, "c": {"type": "integer", "min": 1, "max": 30}, "d": {"type": "integer", "min": 1, "max": 30}, "e": {"type": "integer", "min": 1, "max": 30}}`

**Explanation:** Sort the values and take the third.

**Example question:** Find the median of \(26,7,1,20,17\).

**Example answer:** 17

### D03 — Median of four values

**Targets:** Q.7.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find the median of \({a:1–30},{b:1–30},{c:1–30},{d:1–30}\).
```

**Answer formula/rule:**
```text
median(a,b,c,d)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 30}, "b": {"type": "integer", "min": 1, "max": 30}, "c": {"type": "integer", "min": 1, "max": 30}, "d": {"type": "integer", "min": 1, "max": 30}}`

**Explanation:** Sort and average the second and third values.

**Example question:** Find the median of \(9,19,12,6\).

**Example answer:** 10.5

### D04 — Range

**Targets:** Q.7.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find the range of \({a:1–50},{b:1–50},{c:1–50},{d:1–50}\).
```

**Answer formula/rule:**
```text
max(a,b,c,d)-min(a,b,c,d)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 50}, "b": {"type": "integer", "min": 1, "max": 50}, "c": {"type": "integer", "min": 1, "max": 50}, "d": {"type": "integer", "min": 1, "max": 50}}`

**Explanation:** Subtract the minimum from the maximum.

**Example question:** Find the range of \(37,21,38,24\).

**Example answer:** 17

### D05 — Mode with a unique winner

**Targets:** Q.7.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Find the mode of \({a:1–10},{b},{a},{c},{a},{b}\).
```

**Answer formula/rule:**
```text
a
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 10}, "u": {"type": "integer", "min": 1, "max": 10}, "v": {"type": "integer", "min": 1, "max": 10}}`

**Derived variables, in order:** `{"b": "a+u", "c": "b+v"}`

**Explanation:** The value a appears three times; b twice and c once.

**Example question:** Find the mode of \(1,2,1,6,1,2\).

**Example answer:** 1

### D06 — Missing value from mean

**Targets:** Q.7.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
The mean of \({a:1–30},{b:1–30},{c:1–30},x\) is {m:10–30}. Find \(x\).
```

**Answer formula/rule:**
```text
4*m-a-b-c
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 30}, "b": {"type": "integer", "min": 1, "max": 30}, "c": {"type": "integer", "min": 1, "max": 30}, "m": {"type": "integer", "min": 10, "max": 30}}`

**Explanation:** The total must be four times the mean.

**Example question:** The mean of \(5,4,26,x\) is 15. Find \(x\).

**Example answer:** 25

### D07 — Weighted mean

**Targets:** Q.7.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A score of {a:40–100} has weight {u:1–5} and a score of {b:40–100} has weight {v:1–5}. Find the weighted mean.
```

**Answer formula/rule:**
```text
(a*u+b*v)/(u+v)
```

**Variables:** `{"a": {"type": "integer", "min": 40, "max": 100}, "b": {"type": "integer", "min": 40, "max": 100}, "u": {"type": "integer", "min": 1, "max": 5}, "v": {"type": "integer", "min": 1, "max": 5}}`

**Explanation:** Divide the weighted sum by the sum of the weights.

**Example question:** A score of 41 has weight 3 and a score of 86 has weight 5. Find the weighted mean.

**Example answer:** 69.125

### D08 — Frequency table mean

**Targets:** Q.6.b, Q.7.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
The table gives value and frequency: \(\begin{array}{c|cc} \text{Value}&{a:1–10}&{b}\\ \text{Frequency}&{u:1–8}&{v:1–8}\end{array}\). Find the mean.
```

**Answer formula/rule:**
```text
(a*u+b*v)/(u+v)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 10}, "k": {"type": "integer", "min": 1, "max": 10}, "u": {"type": "integer", "min": 1, "max": 8}, "v": {"type": "integer", "min": 1, "max": 8}}`

**Derived variables, in order:** `{"b": "a+k"}`

**Explanation:** Multiply each value by its frequency, sum, and divide by the total frequency.

**Example question:** The table gives value and frequency: \(\begin{array}{c|cc} \text{Value}&8&14\\ \text{Frequency}&5&8\end{array}\). Find the mean.

**Example answer:** 152/13

### D09 — Bar graph comparison

**Targets:** Q.6.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables, diagram_renderer

**Template:**
```text
The bar graph shows books sold on two days. How many more were sold on day B than day A?
```

**Answer formula/rule:**
```text
b-a
```

**Variables:** `{"a": {"type": "integer", "min": 5, "max": 20}, "k": {"type": "integer", "min": 1, "max": 15}}`

**Derived variables, in order:** `{"b": "a+k"}`

**Explanation:** Read both bar heights and subtract A from B.

**Example question:** The bar graph shows books sold on two days. How many more were sold on day B than day A?

**Example answer:** 12

**Example diagram specification:**
```json
{
  "kind": "bar",
  "labels": [
    "A",
    "B"
  ],
  "values": [
    13.0,
    25.0
  ]
}
```

### D10 — Circle graph sector angle

**Targets:** Q.6.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A category occupies {p:5–80}\% of a circle graph. Find its central angle in degrees.
```

**Answer formula/rule:**
```text
360*p/100
```

**Variables:** `{"p": {"type": "integer", "min": 5, "max": 80}}`

**Explanation:** Multiply the fraction of the whole by 360 degrees.

**Example question:** A category occupies 75\% of a circle graph. Find its central angle in degrees.

**Example answer:** 270

### D11 — Histogram frequency

**Targets:** Q.6.b  
**Answer mode:** numeric  
**Required extensions:** diagram_renderer

**Template:**
```text
The histogram shows counts in three score intervals. How many scores lie in the middle interval?
```

**Answer formula/rule:**
```text
b
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 12}, "b": {"type": "integer", "min": 2, "max": 12}, "c": {"type": "integer", "min": 2, "max": 12}}`

**Explanation:** Read the height of the middle bin.

**Example question:** The histogram shows counts in three score intervals. How many scores lie in the middle interval?

**Example answer:** 4

**Example diagram specification:**
```json
{
  "kind": "histogram",
  "labels": [
    "0-9",
    "10-19",
    "20-29"
  ],
  "values": [
    4.0,
    4.0,
    11.0
  ]
}
```

### D12 — Box plot interquartile range

**Targets:** Q.6.b  
**Answer mode:** numeric  
**Required extensions:** derived_variables, diagram_renderer

**Template:**
```text
The box plot shows a five-number summary. Find the interquartile range.
```

**Answer formula/rule:**
```text
q3-q1
```

**Variables:** `{"lo": {"type": "integer", "min": 0, "max": 10}, "a": {"type": "integer", "min": 1, "max": 8}, "b": {"type": "integer", "min": 1, "max": 8}, "c": {"type": "integer", "min": 1, "max": 8}, "d": {"type": "integer", "min": 1, "max": 8}}`

**Derived variables, in order:** `{"q1": "lo+a", "med": "q1+b", "q3": "med+c", "hi": "q3+d"}`

**Explanation:** Subtract Q1 from Q3.

**Example question:** The box plot shows a five-number summary. Find the interquartile range.

**Example answer:** 7

**Example diagram specification:**
```json
{
  "kind": "box",
  "values": [
    0.0,
    4.0,
    9.0,
    11.0,
    13.0
  ]
}
```

### D13 — Scatter plot interpretation

**Targets:** Q.6.c  
**Answer mode:** category  
**Required extensions:** derived_variables, category_grading, diagram_renderer

**Template:**
```text
The plotted points are \(({a:1–3},{u}),({b},{v}),({c},{w})\). Classify their association as positive, negative, or neither.
```

**Answer formula/rule:**
```text
positive
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 3}, "k": {"type": "integer", "min": 1, "max": 3}, "m": {"type": "integer", "min": 1, "max": 5}, "p": {"type": "integer", "min": 0, "max": 5}}`

**Derived variables, in order:** `{"b": "a+k", "c": "b+k", "u": "m*a+p", "v": "m*b+p", "w": "m*c+p"}`

**Explanation:** Both coordinates increase together, so the association is positive.

**Example question:** The plotted points are \((3,3),(4,4),(5,5)\). Classify their association as positive, negative, or neither.

**Example answer:** positive

**Example diagram specification:**
```json
{
  "kind": "scatter",
  "points": [
    [
      3.0,
      3.0
    ],
    [
      4.0,
      4.0
    ],
    [
      5.0,
      5.0
    ]
  ]
}
```

### P01 — Fundamental counting principle

**Targets:** Q.8.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A meal offers {a:2–8} main dishes, {b:2–6} sides, and {c:2–5} drinks. Choose one of each. How many meals are possible?
```

**Answer formula/rule:**
```text
a*b*c
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 8}, "b": {"type": "integer", "min": 2, "max": 6}, "c": {"type": "integer", "min": 2, "max": 5}}`

**Explanation:** Multiply the independent numbers of choices.

**Example question:** A meal offers 5 main dishes, 3 sides, and 5 drinks. Choose one of each. How many meals are possible?

**Example answer:** 75

### P02 — Combinations

**Targets:** Q.8.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Choose a committee of {r:2–5} people from {n:6–15} people. Order does not matter. How many committees are possible?
```

**Answer formula/rule:**
```text
nCr(n,r)
```

**Variables:** `{"n": {"type": "integer", "min": 6, "max": 15}, "r": {"type": "integer", "min": 2, "max": 5}}`

**Explanation:** Use the combination formula n!/(r!(n-r)!).

**Example question:** Choose a committee of 5 people from 12 people. Order does not matter. How many committees are possible?

**Example answer:** 792

### P03 — Permutations

**Targets:** Q.8.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Assign {r:2–5} distinct ranked positions to {n:6–15} people, with no person repeated. How many assignments are possible?
```

**Answer formula/rule:**
```text
nPr(n,r)
```

**Variables:** `{"n": {"type": "integer", "min": 6, "max": 15}, "r": {"type": "integer", "min": 2, "max": 5}}`

**Explanation:** Use the permutation formula n!/(n-r)!.

**Example question:** Assign 5 distinct ranked positions to 9 people, with no person repeated. How many assignments are possible?

**Example answer:** 15120

### P04 — Simple probability

**Targets:** Q.8.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A bag contains {r:1–12} red and {b:1–12} blue counters. One is chosen at random. Find the probability of red.
```

**Answer formula/rule:**
```text
r/(r+b)
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": 1, "max": 12}}`

**Explanation:** Favorable outcomes divided by total outcomes.

**Example question:** A bag contains 9 red and 4 blue counters. One is chosen at random. Find the probability of red.

**Example answer:** 9/13

### P05 — Independent events with replacement

**Targets:** Q.8.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A bag contains {r:1–12} red and {b:1–12} blue counters. Draw twice, replacing the first counter. Find the probability both are red.
```

**Answer formula/rule:**
```text
pow(r/(r+b),2)
```

**Variables:** `{"r": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": 1, "max": 12}}`

**Explanation:** The draws are independent; multiply the two probabilities.

**Example question:** A bag contains 6 red and 5 blue counters. Draw twice, replacing the first counter. Find the probability both are red.

**Example answer:** 36/121

### P06 — Dependent events without replacement

**Targets:** Q.8.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A bag contains {r:2–12} red and {b:1–12} blue counters. Draw twice without replacement. Find the probability both are red.
```

**Answer formula/rule:**
```text
r/(r+b)*(r-1)/(r+b-1)
```

**Variables:** `{"r": {"type": "integer", "min": 2, "max": 12}, "b": {"type": "integer", "min": 1, "max": 12}}`

**Explanation:** After the first red draw, one fewer red and total counter remain.

**Example question:** A bag contains 12 red and 3 blue counters. Draw twice without replacement. Find the probability both are red.

**Example answer:** 22/35

### P07 — Complement probability

**Targets:** Q.8.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
The probability of rain is \(\frac{{a:1–5}}{{b:6–12}}\). Find the probability of no rain.
```

**Answer formula/rule:**
```text
1-a/b
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 5}, "b": {"type": "integer", "min": 6, "max": 12}}`

**Explanation:** Subtract the event probability from one.

**Example question:** The probability of rain is \(\frac{1}{8}\). Find the probability of no rain.

**Example answer:** 0.875

## Expressions and polynomials


### E01 — Combine like terms

**Targets:** A.1.a  
**Answer mode:** expression  
**Required extensions:** expression_grading, derived_variables

**Template:**
```text
Simplify \({a:1–10}x+{b:1–10}x+{c:-10–10}\).
```

**Answer formula/rule:**
```text
(a+b)*x+c
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 10}, "b": {"type": "integer", "min": 1, "max": 10}, "c": {"type": "integer", "min": -10, "max": 10}}`

**Derived variables, in order:** `{"coef": "a+b"}`

**Explanation:** Add the coefficients of x.

**Example question:** Simplify \(4x+6x+6\).

**Example answer:** 10x+(6)

### E02 — Distribute a coefficient

**Targets:** A.1.a  
**Answer mode:** expression  
**Required extensions:** expression_grading, derived_variables

**Template:**
```text
Expand \({a:2–10}({b:1–10}x+{c:1–10})\).
```

**Answer formula/rule:**
```text
a*b*x+a*c
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 10}, "b": {"type": "integer", "min": 1, "max": 10}, "c": {"type": "integer", "min": 1, "max": 10}}`

**Derived variables, in order:** `{"coef": "a*b", "constant": "a*c"}`

**Explanation:** Multiply both terms by the outside coefficient.

**Example question:** Expand \(10(10x+2)\).

**Example answer:** 100x+20

### E03 — Evaluate a linear expression

**Targets:** A.1.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Evaluate \({a:-10–10}x+{b:-20–20}\) at \(x={v:-10–10}\).
```

**Answer formula/rule:**
```text
a*v+b
```

**Variables:** `{"a": {"type": "integer", "min": -10, "max": 10}, "b": {"type": "integer", "min": -20, "max": 20}, "v": {"type": "integer", "min": -10, "max": 10}}`

**Explanation:** Substitute v for x and calculate.

**Example question:** Evaluate \(-6x+9\) at \(x=4\).

**Example answer:** -15

### E04 — Translate a linear cost expression

**Targets:** A.1.c  
**Answer mode:** expression  
**Required extensions:** expression_grading

**Template:**
```text
A rental has a fixed fee of \(\${b:5–50}\) plus \(\${a:2–20}\) per hour. Write total cost as an expression in hours \(h\).
```

**Answer formula/rule:**
```text
a*h+b
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 20}, "b": {"type": "integer", "min": 5, "max": 50}}`

**Explanation:** Variable cost plus fixed fee.

**Example question:** A rental has a fixed fee of \(\$18\) plus \(\$5\) per hour. Write total cost as an expression in hours \(h\).

**Example answer:** 5h+18

### E05 — Add polynomials

**Targets:** A.1.d  
**Answer mode:** expression  
**Required extensions:** expression_grading, derived_variables

**Template:**
```text
Simplify \(({a:1–8}x^2+{b:1–8}x+{c:1–8})+({d:1–8}x^2+{e:1–8}x+{f:1–8})\).
```

**Answer formula/rule:**
```text
(a+d)*x*x+(b+e)*x+c+f
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 8}, "b": {"type": "integer", "min": 1, "max": 8}, "c": {"type": "integer", "min": 1, "max": 8}, "d": {"type": "integer", "min": 1, "max": 8}, "e": {"type": "integer", "min": 1, "max": 8}, "f": {"type": "integer", "min": 1, "max": 8}}`

**Derived variables, in order:** `{"coef2": "a+d", "coef1": "b+e", "constant": "c+f"}`

**Explanation:** Combine terms with the same power of x.

**Example question:** Simplify \((2x^2+1x+5)+(6x^2+3x+5)\).

**Example answer:** 8x^2+4x+10

### E06 — Subtract polynomials

**Targets:** A.1.d  
**Answer mode:** expression  
**Required extensions:** expression_grading, derived_variables

**Template:**
```text
Simplify \(({a:1–8}x^2+{b:1–8}x+{c:1–8})-({d:1–8}x^2+{e:1–8}x+{f:1–8})\).
```

**Answer formula/rule:**
```text
(a-d)*x*x+(b-e)*x+c-f
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 8}, "b": {"type": "integer", "min": 1, "max": 8}, "c": {"type": "integer", "min": 1, "max": 8}, "d": {"type": "integer", "min": 1, "max": 8}, "e": {"type": "integer", "min": 1, "max": 8}, "f": {"type": "integer", "min": 1, "max": 8}}`

**Derived variables, in order:** `{"coef2": "a-d", "coef1": "b-e", "constant": "c-f"}`

**Explanation:** Distribute the minus sign before combining terms.

**Example question:** Simplify \((1x^2+6x+4)-(1x^2+6x+3)\).

**Example answer:** (0)x^2+(0)x+(1)

### E07 — Multiply binomials

**Targets:** A.1.d  
**Answer mode:** expression  
**Required extensions:** expression_grading, derived_variables

**Template:**
```text
Expand \((x+{a:1–12})(x+{b:1–12})\).
```

**Answer formula/rule:**
```text
x*x+(a+b)*x+a*b
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": 1, "max": 12}}`

**Derived variables, in order:** `{"coef": "a+b", "constant": "a*b"}`

**Explanation:** Multiply all pairs of terms and combine.

**Example question:** Expand \((x+9)(x+6)\).

**Example answer:** x^2+15x+54

### E08 — Divide factorable polynomials

**Targets:** A.1.d  
**Answer mode:** expression  
**Required extensions:** derived_variables, expression_grading

**Template:**
```text
Simplify \(\frac{x^2-{k}}{x-{a:1–12}}\), retaining the restriction \(x\ne {a}\).
```

**Answer formula/rule:**
```text
x+a
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}}`

**Derived variables, in order:** `{"k": "a*a"}`

**Explanation:** Factor the numerator as (x-a)(x+a); preserve the original domain.

**Example question:** Simplify \(\frac{x^2-49}{x-7}\), retaining the restriction \(x\ne 7\).

**Example answer:** x+7,\quad x\ne 7

### E09 — Evaluate a polynomial

**Targets:** A.1.e  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Evaluate \({a:1–8}x^2+{b:-10–10}x+{c:-20–20}\) at \(x={v:-6–6}\).
```

**Answer formula/rule:**
```text
a*v*v+b*v+c
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 8}, "b": {"type": "integer", "min": -10, "max": 10}, "c": {"type": "integer", "min": -20, "max": 20}, "v": {"type": "integer", "min": -6, "max": 6}}`

**Explanation:** Substitute v for x, square before multiplying.

**Example question:** Evaluate \(6x^2+-5x+-19\) at \(x=-1\).

**Example answer:** -8

### E10 — Factor a common factor

**Targets:** A.1.f  
**Answer mode:** factored_expression  
**Required extensions:** derived_variables, constraint_filtering, factored_expression_grading

**Template:**
```text
Factor completely over the integers: \({A}x+{B}\).
```

**Answer formula/rule:**
```text
g*(a*x+b)
```

**Variables:** `{"g": {"type": "integer", "min": 2, "max": 10}, "a": {"type": "integer", "min": 1, "max": 9}, "b": {"type": "integer", "min": 1, "max": 9}}`

**Derived variables, in order:** `{"A": "g*a", "B": "g*b"}`

**Constraints:** `gcd(a,b)==1`

**Explanation:** Take out the greatest common factor; the remaining coefficients are coprime.

**Example question:** Factor completely over the integers: \(24x+15\).

**Example answer:** 3(8x+5)

### E11 — Factor a monic quadratic

**Targets:** A.1.f  
**Answer mode:** factored_expression  
**Required extensions:** derived_variables, factored_expression_grading

**Template:**
```text
Factor completely: \(x^2+{s}x+{p}\).
```

**Answer formula/rule:**
```text
(x+a)*(x+b)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": 1, "max": 12}}`

**Derived variables, in order:** `{"s": "a+b", "p": "a*b"}`

**Explanation:** Find two integers whose sum is s and product is p.

**Example question:** Factor completely: \(x^2+18x+72\).

**Example answer:** (x+6)(x+12)

### E12 — Factor difference of squares

**Targets:** A.1.f  
**Answer mode:** factored_expression  
**Required extensions:** derived_variables, factored_expression_grading

**Template:**
```text
Factor completely: \(x^2-{k}\).
```

**Answer formula/rule:**
```text
(x-a)*(x+a)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}}`

**Derived variables, in order:** `{"k": "a*a"}`

**Explanation:** Use the difference-of-squares identity.

**Example question:** Factor completely: \(x^2-36\).

**Example answer:** (x-6)(x+6)

### E13 — Translate a polynomial area expression

**Targets:** A.1.g  
**Answer mode:** expression  
**Required extensions:** expression_grading, derived_variables

**Template:**
```text
A rectangle has side lengths \(x+{a:1–12}\) and \(x+{b:1–12}\), where \(x\ge0\). Write its area as a polynomial in \(x\).
```

**Answer formula/rule:**
```text
x*x+(a+b)*x+a*b
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": 1, "max": 12}}`

**Derived variables, in order:** `{"coef": "a+b", "constant": "a*b"}`

**Explanation:** Multiply length and width, then expand.

**Example question:** A rectangle has side lengths \(x+4\) and \(x+4\), where \(x\ge0\). Write its area as a polynomial in \(x\).

**Example answer:** x^2+8x+16

### E14 — Add rational expressions

**Targets:** A.1.h  
**Answer mode:** expression  
**Required extensions:** expression_grading, derived_variables

**Template:**
```text
Simplify \(\frac{{a:1–12}}{x}+\frac{{b:1–12}}{x}\), where \(x\ne0\).
```

**Answer formula/rule:**
```text
(a+b)/x
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": 1, "max": 12}}`

**Derived variables, in order:** `{"total": "a+b"}`

**Explanation:** Add numerators over the common denominator.

**Example question:** Simplify \(\frac{11}{x}+\frac{8}{x}\), where \(x\ne0\).

**Example answer:** \frac{19}{x},\quad x\ne0

### E15 — Multiply rational expressions

**Targets:** A.1.h  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Simplify \(\frac{{a:1–12}x}{{b:1–12}}\cdot\frac{{c:1–12}}{{d:1–12}x}\), where \(x\ne0\).
```

**Answer formula/rule:**
```text
a*c/(b*d)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": 1, "max": 12}, "c": {"type": "integer", "min": 1, "max": 12}, "d": {"type": "integer", "min": 1, "max": 12}}`

**Explanation:** Cancel nonzero x, multiply numerators and denominators.

**Example question:** Simplify \(\frac{6x}{6}\cdot\frac{12}{1x}\), where \(x\ne0\).

**Example answer:** 12

### E16 — Evaluate a rational expression

**Targets:** A.1.i  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Evaluate \(\frac{{a:1–10}x+{b:1–15}}{x+{c:1–10}}\) at \(x={v:0–10}\).
```

**Answer formula/rule:**
```text
(a*v+b)/(v+c)
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 10}, "b": {"type": "integer", "min": 1, "max": 15}, "c": {"type": "integer", "min": 1, "max": 10}, "v": {"type": "integer", "min": 0, "max": 10}}`

**Explanation:** Substitute v; the generated denominator is positive.

**Example question:** Evaluate \(\frac{2x+8}{x+5}\) at \(x=1\).

**Example answer:** 5/3

### E17 — Translate a rational rate expression

**Targets:** A.1.j  
**Answer mode:** expression  
**Required extensions:** expression_grading

**Template:**
```text
A trip covers {d:20–300} miles in \(t\) hours, with \(t>0\). Write the average speed as an expression in \(t\).
```

**Answer formula/rule:**
```text
d/t
```

**Variables:** `{"d": {"type": "integer", "min": 20, "max": 300}}`

**Explanation:** Average speed equals distance divided by time.

**Example question:** A trip covers 238 miles in \(t\) hours, with \(t>0\). Write the average speed as an expression in \(t\).

**Example answer:** \frac{238}{t},\quad t>0

## Linear equations and systems


### L01 — One-step addition equation

**Targets:** A.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Solve \(x+{b:-20–20}={c:-20–20}\).
```

**Answer formula/rule:**
```text
c-b
```

**Variables:** `{"b": {"type": "integer", "min": -20, "max": 20}, "c": {"type": "integer", "min": -20, "max": 20}}`

**Explanation:** Subtract b from both sides.

**Example question:** Solve \(x+1=10\).

**Example answer:** 9

### L02 — One-step multiplication equation

**Targets:** A.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Solve \({a:1–12}x={b:-30–30}\).
```

**Answer formula/rule:**
```text
b/a
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": -30, "max": 30}}`

**Explanation:** Divide both sides by a.

**Example question:** Solve \(5x=19\).

**Example answer:** 3.8

### L03 — Two-step equation

**Targets:** A.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Solve \({a:1–12}x+({b:-20–20})={c:-30–30}\).
```

**Answer formula/rule:**
```text
(c-b)/a
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 12}, "b": {"type": "integer", "min": -20, "max": 20}, "c": {"type": "integer", "min": -30, "max": 30}}`

**Explanation:** Subtract b and divide by a.

**Example question:** Solve \(11x+(-13)=-15\).

**Example answer:** -2/11

### L04 — Equation with parentheses

**Targets:** A.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Solve \({a:2–10}(x+{b:1–12})={c:1–100}\).
```

**Answer formula/rule:**
```text
c/a-b
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 10}, "b": {"type": "integer", "min": 1, "max": 12}, "c": {"type": "integer", "min": 1, "max": 100}}`

**Explanation:** Divide by a, then subtract b.

**Example question:** Solve \(4(x+10)=93\).

**Example answer:** 13.25

### L05 — Variables on both sides

**Targets:** A.2.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Solve \({a}x+{b:-20–20}={c:1–8}x+{d:-20–20}\).
```

**Answer formula/rule:**
```text
(d-b)/(a-c)
```

**Variables:** `{"c": {"type": "integer", "min": 1, "max": 8}, "k": {"type": "integer", "min": 1, "max": 8}, "b": {"type": "integer", "min": -20, "max": 20}, "d": {"type": "integer", "min": -20, "max": 20}}`

**Derived variables, in order:** `{"a": "c+k"}`

**Explanation:** Collect x terms; a-c is nonzero by construction.

**Example question:** Solve \(12x+-1=8x+11\).

**Example answer:** 3

### L06 — Rational-coefficient equation

**Targets:** A.2.a  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Solve \(\frac{{a:1–10}}{{b:2–12}}x+{c:-10–10}={d:-20–20}\).
```

**Answer formula/rule:**
```text
(d-c)*b/a
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 10}, "b": {"type": "integer", "min": 2, "max": 12}, "c": {"type": "integer", "min": -10, "max": 10}, "d": {"type": "integer", "min": -20, "max": 20}}`

**Explanation:** Subtract c, then multiply by b/a.

**Example question:** Solve \(\frac{10}{5}x+-8=-9\).

**Example answer:** -0.5

### L07 — Literal equation

**Targets:** A.2.a  
**Answer mode:** expression  
**Required extensions:** expression_grading

**Template:**
```text
Rearrange \(y=ax+b\) to solve for \(x\), assuming \(a\ne0\).
```

**Answer formula/rule:**
```text
(y-b)/a
```

**Variables:** `{}`

**Explanation:** Subtract b and divide by a; this template has symbolic coefficients.

**Example question:** Rearrange \(y=ax+b\) to solve for \(x\), assuming \(a\ne0\).

**Example answer:** x=\frac{y-b}{a}

### L08 — Rental time from total cost

**Targets:** A.2.b  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A rental costs \(\${b:5–50}\) plus \(\${a:2–20}\) per hour. The total is \(\${c}\). Find the rental time in hours.
```

**Answer formula/rule:**
```text
(c-b)/a
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 20}, "b": {"type": "integer", "min": 5, "max": 50}, "h": {"type": "integer", "min": 1, "max": 12}}`

**Derived variables, in order:** `{"c": "a*h+b"}`

**Explanation:** Set variable cost plus fixed fee equal to the total.

**Example question:** A rental costs \(\$24\) plus \(\$12\) per hour. The total is \(\$144\). Find the rental time in hours.

**Example answer:** 10

### L09 — Write a cost equation

**Targets:** A.2.c  
**Answer mode:** equation  
**Required extensions:** equation_grading

**Template:**
```text
A service charges \(\${b:5–50}\) plus \(\${a:2–20}\) per hour. Write an equation for total cost \(C\) in hours \(h\).
```

**Answer formula/rule:**
```text
C=a*h+b
```

**Variables:** `{"a": {"type": "integer", "min": 2, "max": 20}, "b": {"type": "integer", "min": 5, "max": 50}}`

**Explanation:** Relate total cost to hours and the fixed charge.

**Example question:** A service charges \(\$26\) plus \(\$6\) per hour. Write an equation for total cost \(C\) in hours \(h\).

**Example answer:** C=6h+26

### L10 — Write a two-variable purchase equation

**Targets:** A.2.c  
**Answer mode:** equation  
**Required extensions:** derived_variables, equation_grading

**Template:**
```text
Adult tickets cost \(\${a:10–20}\), child tickets cost \(\${b:3–9}\), and total revenue is \(\${t}\). Write an equation using adult count \(x\) and child count \(y\).
```

**Answer formula/rule:**
```text
a*x+b*y=t
```

**Variables:** `{"a": {"type": "integer", "min": 10, "max": 20}, "b": {"type": "integer", "min": 3, "max": 9}, "u": {"type": "integer", "min": 2, "max": 10}, "v": {"type": "integer", "min": 2, "max": 10}}`

**Derived variables, in order:** `{"t": "a*u+b*v"}`

**Explanation:** Sum the revenue from the two ticket types.

**Example question:** Adult tickets cost \(\$11\), child tickets cost \(\$4\), and total revenue is \(\$41\). Write an equation using adult count \(x\) and child count \(y\).

**Example answer:** 11x+4y=41

### L11 — Solve a system: x component

**Targets:** A.2.d  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Solve \(x+y={s}\), \({a}x+{b:1–5}y={t}\). Enter only \(x\).
```

**Answer formula/rule:**
```text
(t-b*s)/(a-b)
```

**Variables:** `{"b": {"type": "integer", "min": 1, "max": 5}, "k": {"type": "integer", "min": 1, "max": 5}, "u": {"type": "integer", "min": 1, "max": 10}, "v": {"type": "integer", "min": 1, "max": 10}}`

**Derived variables, in order:** `{"a": "b+k", "s": "u+v", "t": "a*u+b*v"}`

**Explanation:** Substitute y=s-x in the second equation.

**Example question:** Solve \(x+y=5\), \(7x+2y=20\). Enter only \(x\).

**Example answer:** 2

### L12 — Solve a system: ordered pair

**Targets:** A.2.d  
**Answer mode:** ordered_pair  
**Required extensions:** derived_variables, ordered_pair_grading

**Template:**
```text
Solve \(x+y={s}\), \({a}x+{b:1–5}y={t}\). Enter \((x,y)\).
```

**Answer formula/rule:**
```text
[u,v]
```

**Variables:** `{"b": {"type": "integer", "min": 1, "max": 5}, "k": {"type": "integer", "min": 1, "max": 5}, "u": {"type": "integer", "min": 1, "max": 10}, "v": {"type": "integer", "min": 1, "max": 10}}`

**Derived variables, in order:** `{"a": "b+k", "s": "u+v", "t": "a*u+b*v"}`

**Explanation:** Eliminate one variable, then substitute to find the other.

**Example question:** Solve \(x+y=17\), \(6x+2y=70\). Enter \((x,y)\).

**Example answer:** (9, 8)

### L13 — Ticket system word problem

**Targets:** A.2.d  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
{s} tickets were sold. Adult tickets cost \(\${a}\), child tickets cost \(\${b:3–8}\), and revenue was \(\${t}\). How many adult tickets were sold?
```

**Answer formula/rule:**
```text
(t-b*s)/(a-b)
```

**Variables:** `{"b": {"type": "integer", "min": 3, "max": 8}, "k": {"type": "integer", "min": 2, "max": 8}, "u": {"type": "integer", "min": 2, "max": 20}, "v": {"type": "integer", "min": 2, "max": 20}}`

**Derived variables, in order:** `{"a": "b+k", "s": "u+v", "t": "a*u+b*v"}`

**Explanation:** Use the ticket-count and revenue equations.

**Example question:** 9 tickets were sold. Adult tickets cost \(\$6\), child tickets cost \(\$4\), and revenue was \(\$42\). How many adult tickets were sold?

**Example answer:** 3

## Linear inequalities


### I01 — Solve a positive-coefficient inequality

**Targets:** A.3.a  
**Answer mode:** inequality  
**Required extensions:** inequality_grading

**Template:**
```text
Solve \({a:1–10}x+{b:-20–20}<{c:-20–20}\).
```

**Answer formula/rule:**
```text
x < (c-b)/a
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 10}, "b": {"type": "integer", "min": -20, "max": 20}, "c": {"type": "integer", "min": -20, "max": 20}}`

**Explanation:** Subtract b and divide by positive a; keep the inequality direction.

**Example question:** Solve \(3x+3<-1\).

**Example answer:** x<\frac{-1-(3)}{3}

### I02 — Solve a negative-coefficient inequality

**Targets:** A.3.a  
**Answer mode:** inequality  
**Required extensions:** inequality_grading

**Template:**
```text
Solve \(-{a:1–10}x+{b:-20–20}\le {c:-20–20}\).
```

**Answer formula/rule:**
```text
x >= (b-c)/a
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 10}, "b": {"type": "integer", "min": -20, "max": 20}, "c": {"type": "integer", "min": -20, "max": 20}}`

**Explanation:** Dividing by a negative coefficient reverses the inequality.

**Example question:** Solve \(-5x+13\le -2\).

**Example answer:** x\ge\frac{13-(-2)}{5}

### I03 — Graph a strict inequality

**Targets:** A.3.b  
**Answer mode:** number_line  
**Required extensions:** number_line_grading

**Template:**
```text
Graph \(x>{a:-10–10}\) on a number line.
```

**Answer formula/rule:**
```text
open endpoint a; shade right
```

**Variables:** `{"a": {"type": "integer", "min": -10, "max": 10}}`

**Explanation:** Use an open circle at a and shade to the right.

**Example question:** Graph \(x>-10\) on a number line.

**Example answer:** (-10,\infty)

### I04 — Graph an inclusive inequality

**Targets:** A.3.b  
**Answer mode:** number_line  
**Required extensions:** number_line_grading

**Template:**
```text
Graph \(x\le {a:-10–10}\) on a number line.
```

**Answer formula/rule:**
```text
closed endpoint a; shade left
```

**Variables:** `{"a": {"type": "integer", "min": -10, "max": 10}}`

**Explanation:** Use a filled circle at a and shade to the left.

**Example question:** Graph \(x\le 5\) on a number line.

**Example answer:** (-\infty,5]

### I05 — Budget maximum whole items

**Targets:** A.3.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
You have \(\${B:50–200}\), pay a fixed fee of \(\${f:5–20}\), and each item costs \(\${p:2–15}\). What is the maximum whole number of items you can buy?
```

**Answer formula/rule:**
```text
floor((B-f)/p)
```

**Variables:** `{"B": {"type": "integer", "min": 50, "max": 200}, "f": {"type": "integer", "min": 5, "max": 20}, "p": {"type": "integer", "min": 2, "max": 15}}`

**Explanation:** Solve f+p*n <= B, then take the floor.

**Example question:** You have \(\$181\), pay a fixed fee of \(\$20\), and each item costs \(\$14\). What is the maximum whole number of items you can buy?

**Example answer:** 11

### I06 — Write a budget inequality

**Targets:** A.3.d  
**Answer mode:** inequality  
**Required extensions:** inequality_grading

**Template:**
```text
A fixed fee is \(\${f:5–20}\), each item costs \(\${p:2–15}\), and the budget is \(\${B:50–200}\). Write an inequality for the nonnegative whole number \(n\) of items.
```

**Answer formula/rule:**
```text
f+p*n <= B
```

**Variables:** `{"B": {"type": "integer", "min": 50, "max": 200}, "f": {"type": "integer", "min": 5, "max": 20}, "p": {"type": "integer", "min": 2, "max": 15}}`

**Explanation:** Total cost must not exceed the budget; counts are nonnegative integers.

**Example question:** A fixed fee is \(\$16\), each item costs \(\$7\), and the budget is \(\$130\). Write an inequality for the nonnegative whole number \(n\) of items.

**Example answer:** 16+7n\le 130,\quad n\in\mathbb Z_{\ge0}

## Quadratic equations


### Q01 — Quadratic square equation, positive root

**Targets:** A.4.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Solve \(x^2={k}\). Enter only the positive solution.
```

**Answer formula/rule:**
```text
a
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 20}}`

**Derived variables, in order:** `{"k": "a*a"}`

**Explanation:** The solutions are plus/minus a; only the positive one is requested.

**Example question:** Solve \(x^2=196\). Enter only the positive solution.

**Example answer:** 14

### Q02 — Factorable quadratic, all real roots

**Targets:** A.4.a  
**Answer mode:** solution_set  
**Required extensions:** derived_variables, solution_set_grading

**Template:**
```text
Solve \(x^2-({s})x+({p})=0\). Enter all distinct real solutions.
```

**Answer formula/rule:**
```text
set([a,b])
```

**Variables:** `{"a": {"type": "integer", "min": -12, "max": 12}, "b": {"type": "integer", "min": -12, "max": 12}}`

**Derived variables, in order:** `{"s": "a+b", "p": "a*b"}`

**Explanation:** Factor as (x-a)(x-b); repeated roots count once.

**Example question:** Solve \(x^2-(11)x+(10)=0\). Enter all distinct real solutions.

**Example answer:** (1, 10)

### Q03 — Quadratic formula, larger root

**Targets:** A.4.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Solve \(x^2-({s})x+({p})=0\). Enter only the larger real solution.
```

**Answer formula/rule:**
```text
(s+sqrt(s*s-4*p))/2
```

**Variables:** `{"a": {"type": "integer", "min": -12, "max": 12}, "b": {"type": "integer", "min": -12, "max": 12}}`

**Derived variables, in order:** `{"s": "a+b", "p": "a*b"}`

**Explanation:** Use the plus sign in the quadratic formula for a monic quadratic.

**Example question:** Solve \(x^2-(8)x+(-48)=0\). Enter only the larger real solution.

**Example answer:** 12

### Q04 — Complete the square

**Targets:** A.4.a  
**Answer mode:** solution_set  
**Required extensions:** derived_variables, solution_set_grading

**Template:**
```text
Solve \((x-({h:-10–10}))^2={k}\). Enter both real solutions.
```

**Answer formula/rule:**
```text
set([h-a,h+a])
```

**Variables:** `{"h": {"type": "integer", "min": -10, "max": 10}, "a": {"type": "integer", "min": 1, "max": 10}}`

**Derived variables, in order:** `{"k": "a*a"}`

**Explanation:** Take both square-root signs before adding h.

**Example question:** Solve \((x-(-9))^2=16\). Enter both real solutions.

**Example answer:** (-13, -5)

### Q05 — Repeated quadratic root

**Targets:** A.4.a  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Solve \(x^2-({s})x+({p})=0\).
```

**Answer formula/rule:**
```text
a
```

**Variables:** `{"a": {"type": "integer", "min": -12, "max": 12}}`

**Derived variables, in order:** `{"s": "2*a", "p": "a*a"}`

**Explanation:** The quadratic is (x-a) squared, so there is one distinct root.

**Example question:** Solve \(x^2-(-2)x+(1)=0\).

**Example answer:** -1

### Q06 — Write a quadratic area equation

**Targets:** A.4.b  
**Answer mode:** equation  
**Required extensions:** derived_variables, equation_grading

**Template:**
```text
A rectangle has sides \(x\) and \(x+{d:1–10}\) cm and area {A} square centimeters. Write a quadratic equation for \(x>0\).
```

**Answer formula/rule:**
```text
x*x+d*x=A
```

**Variables:** `{"d": {"type": "integer", "min": 1, "max": 10}, "u": {"type": "integer", "min": 2, "max": 15}}`

**Derived variables, in order:** `{"A": "u*(u+d)"}`

**Explanation:** Multiply the two side lengths and equate to the area.

**Example question:** A rectangle has sides \(x\) and \(x+9\) cm and area 190 square centimeters. Write a quadratic equation for \(x>0\).

**Example answer:** x^2+9x=190,\quad x>0

### Q07 — Quadratic area word problem

**Targets:** A.4.a, A.4.b  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
A rectangle has sides \(x\) and \(x+{d:1–10}\) cm and area {A} square centimeters. Find the positive value of \(x\).
```

**Answer formula/rule:**
```text
(-d+sqrt(d*d+4*A))/2
```

**Variables:** `{"d": {"type": "integer", "min": 1, "max": 10}, "u": {"type": "integer", "min": 2, "max": 15}}`

**Derived variables, in order:** `{"A": "u*(u+d)"}`

**Explanation:** Solve x squared + d*x - A = 0 and retain the positive root.

**Example question:** A rectangle has sides \(x\) and \(x+10\) cm and area 299 square centimeters. Find the positive value of \(x\).

**Example answer:** 13

## Coordinates, lines, graphs, and functions


### F01 — Locate a point

**Targets:** A.5.a  
**Answer mode:** coordinate_plot  
**Required extensions:** coordinate_plot_grading

**Template:**
```text
Plot \(({a:-8–8},{b:-8–8})\) on the coordinate plane.
```

**Answer formula/rule:**
```text
[a,b]
```

**Variables:** `{"a": {"type": "integer", "min": -8, "max": 8}, "b": {"type": "integer", "min": -8, "max": 8}}`

**Explanation:** Move a units horizontally and b units vertically.

**Example question:** Plot \((-5,4)\) on the coordinate plane.

**Example answer:** (-5, 4)

### F02 — Slope from two points

**Targets:** A.5.b  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Find the slope through \(({x:-5–5},{y:-10–10})\) and \(({u},{v})\).
```

**Answer formula/rule:**
```text
(v-y)/(u-x)
```

**Variables:** `{"x": {"type": "integer", "min": -5, "max": 5}, "y": {"type": "integer", "min": -10, "max": 10}, "dx": {"type": "integer", "min": 1, "max": 6}, "dy": {"type": "integer", "min": -8, "max": 8}}`

**Derived variables, in order:** `{"u": "x+dx", "v": "y+dy"}`

**Explanation:** Use change in y divided by change in x.

**Example question:** Find the slope through \((-4,4)\) and \((1,12)\).

**Example answer:** 1.6

### F03 — Slope from an equation

**Targets:** A.5.b  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find the slope of \(y={m:-8–8}x+({b:-10–10})\).
```

**Answer formula/rule:**
```text
m
```

**Variables:** `{"m": {"type": "integer", "min": -8, "max": 8}, "b": {"type": "integer", "min": -10, "max": 10}}`

**Explanation:** In slope-intercept form, the x coefficient is the slope.

**Example question:** Find the slope of \(y=-1x+(-9)\).

**Example answer:** -1

### F04 — Slope from a table

**Targets:** A.5.b  
**Answer mode:** numeric  
**Required extensions:** derived_variables

**Template:**
```text
Find the slope represented by \(\begin{array}{c|cc}x&{a:0–5}&{b}\\y&{u}&{v}\end{array}\).
```

**Answer formula/rule:**
```text
(v-u)/(b-a)
```

**Variables:** `{"a": {"type": "integer", "min": 0, "max": 5}, "k": {"type": "integer", "min": 1, "max": 5}, "m": {"type": "integer", "min": -6, "max": 6}, "c": {"type": "integer", "min": -10, "max": 10}}`

**Derived variables, in order:** `{"b": "a+k", "u": "m*a+c", "v": "m*b+c"}`

**Explanation:** Calculate the ratio of output change to input change.

**Example question:** Find the slope represented by \(\begin{array}{c|cc}x&1&5\\y&-1&7\end{array}\).

**Example answer:** 2

### F05 — Slope from a graph

**Targets:** A.5.b  
**Answer mode:** numeric  
**Required extensions:** diagram_renderer

**Template:**
```text
Find the slope of the line in the graph.
```

**Answer formula/rule:**
```text
m
```

**Variables:** `{"m": {"type": "integer", "min": -3, "max": 3}, "b": {"type": "integer", "min": -4, "max": 4}}`

**Explanation:** Read two points and calculate rise/run.

**Example question:** Find the slope of the line in the graph.

**Example answer:** 3

**Example diagram specification:**
```json
{
  "kind": "line",
  "m": 3.0,
  "b": -4.0,
  "x_min": -4,
  "x_max": 4
}
```

### F06 — Interpret proportional slope

**Targets:** A.5.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
The distance-time equation is \(d={r:10–80}t\), with miles and hours. What is the speed in miles per hour?
```

**Answer formula/rule:**
```text
r
```

**Variables:** `{"r": {"type": "integer", "min": 10, "max": 80}}`

**Explanation:** The coefficient is distance per unit time.

**Example question:** The distance-time equation is \(d=60t\), with miles and hours. What is the speed in miles per hour?

**Example answer:** 60

### F07 — Graph a linear equation

**Targets:** A.5.d  
**Answer mode:** line_graph  
**Required extensions:** line_graph_grading

**Template:**
```text
Graph \(y={m:-4–4}x+({b:-6–6})\).
```

**Answer formula/rule:**
```text
y=m*x+b
```

**Variables:** `{"m": {"type": "integer", "min": -4, "max": 4}, "b": {"type": "integer", "min": -6, "max": 6}}`

**Explanation:** Plot the y-intercept and another point using the slope.

**Example question:** Graph \(y=-2x+(-1)\).

**Example answer:** y=-2x+(-1)

### F08 — Linear y-intercept

**Targets:** A.5.e  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A balance follows \(B(t)={m:1–20}t+{b:10–100}\). Find the initial balance \(B(0)\).
```

**Answer formula/rule:**
```text
b
```

**Variables:** `{"m": {"type": "integer", "min": 1, "max": 20}, "b": {"type": "integer", "min": 10, "max": 100}}`

**Explanation:** Evaluate at t=0; the intercept is the initial value.

**Example question:** A balance follows \(B(t)=7t+79\). Find the initial balance \(B(0)\).

**Example answer:** 79

### F09 — Linear x-intercept

**Targets:** A.5.e  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find the x-intercept coordinate of \(y={m:1–10}x+({b:-20–20})\). Enter only its x-coordinate.
```

**Answer formula/rule:**
```text
-b/m
```

**Variables:** `{"m": {"type": "integer", "min": 1, "max": 10}, "b": {"type": "integer", "min": -20, "max": 20}}`

**Explanation:** Set y=0 and solve for x.

**Example question:** Find the x-intercept coordinate of \(y=9x+(9)\). Enter only its x-coordinate.

**Example answer:** -1

### F10 — Quadratic vertex

**Targets:** A.5.e  
**Answer mode:** ordered_pair  
**Required extensions:** ordered_pair_grading

**Template:**
```text
Find the vertex of \(y={a:1–5}(x-({h:-6–6}))^2+({k:-10–10})\).
```

**Answer formula/rule:**
```text
[h,k]
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 5}, "h": {"type": "integer", "min": -6, "max": 6}, "k": {"type": "integer", "min": -10, "max": 10}}`

**Explanation:** Vertex form gives vertex coordinates directly.

**Example question:** Find the vertex of \(y=2(x-(-1))^2+(-10)\).

**Example answer:** (-1, -10)

### F11 — Quadratic minimum

**Targets:** A.5.e  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find the minimum value of \(y={a:1–5}(x-({h:-6–6}))^2+({k:-10–10})\).
```

**Answer formula/rule:**
```text
k
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 5}, "h": {"type": "integer", "min": -6, "max": 6}, "k": {"type": "integer", "min": -10, "max": 10}}`

**Explanation:** A positive squared-term coefficient gives minimum k.

**Example question:** Find the minimum value of \(y=3(x-(-5))^2+(10)\).

**Example answer:** 10

### F12 — Quadratic symmetry axis

**Targets:** A.5.e  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
Find the axis of symmetry of \(y={a:1–5}(x-({h:-6–6}))^2+({k:-10–10})\). Enter the x-value of the axis.
```

**Answer formula/rule:**
```text
h
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 5}, "h": {"type": "integer", "min": -6, "max": 6}, "k": {"type": "integer", "min": -10, "max": 10}}`

**Explanation:** The symmetry axis passes through the vertex.

**Example question:** Find the axis of symmetry of \(y=3(x-(4))^2+(3)\). Enter the x-value of the axis.

**Example answer:** 4

### F13 — Increasing interval of a quadratic

**Targets:** A.5.e  
**Answer mode:** interval  
**Required extensions:** interval_grading

**Template:**
```text
For \(y=(x-({h:-6–6}))^2+{k:-10–10}\), give the open interval where the function is increasing.
```

**Answer formula/rule:**
```text
(h,infinity)
```

**Variables:** `{"h": {"type": "integer", "min": -6, "max": 6}, "k": {"type": "integer", "min": -10, "max": 10}}`

**Explanation:** The upward-opening parabola increases to the right of its vertex.

**Example question:** For \(y=(x-(-3))^2+-8\), give the open interval where the function is increasing.

**Example answer:** (-3,\infty)

### F14 — Line through slope and point

**Targets:** A.6.a  
**Answer mode:** equation  
**Required extensions:** equation_grading

**Template:**
```text
Write an equation for the line with slope {m:-6–6} through \(({a:-6–6},{b:-10–10})\).
```

**Answer formula/rule:**
```text
y=m*(x-a)+b
```

**Variables:** `{"m": {"type": "integer", "min": -6, "max": 6}, "a": {"type": "integer", "min": -6, "max": 6}, "b": {"type": "integer", "min": -10, "max": 10}}`

**Explanation:** Use point-slope form; equivalent line equations are accepted.

**Example question:** Write an equation for the line with slope 5 through \((0,5)\).

**Example answer:** y=5(x-(0))+(5)

### F15 — Line through two points

**Targets:** A.6.b  
**Answer mode:** equation  
**Required extensions:** derived_variables, equation_grading

**Template:**
```text
Write an equation for the line through \(({x0:-5–5},{y0:-10–10})\) and \(({u},{v})\).
```

**Answer formula/rule:**
```text
y=((v-y0)/(u-x0))*(x-x0)+y0
```

**Variables:** `{"x0": {"type": "integer", "min": -5, "max": 5}, "y0": {"type": "integer", "min": -10, "max": 10}, "dx": {"type": "integer", "min": 1, "max": 6}, "m": {"type": "integer", "min": -5, "max": 5}}`

**Derived variables, in order:** `{"u": "x0+dx", "v": "y0+m*dx"}`

**Explanation:** Find the slope, then use point-slope form; symbols x0,y0 are stored point values.

**Example question:** Write an equation for the line through \((-5,-5)\) and \((0,15)\).

**Example answer:** y=4(x-(-5))+(-5)

### F16 — Parallel line slope

**Targets:** A.6.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A line has slope {m:-8–8}. Find the slope of any distinct parallel line.
```

**Answer formula/rule:**
```text
m
```

**Variables:** `{"m": {"type": "integer", "min": -8, "max": 8}}`

**Explanation:** Nonvertical parallel lines have equal slopes.

**Example question:** A line has slope -4. Find the slope of any distinct parallel line.

**Example answer:** -4

### F17 — Perpendicular line slope

**Targets:** A.6.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
A line has nonzero slope {m:1–10}. Find the slope of a perpendicular line.
```

**Answer formula/rule:**
```text
-1/m
```

**Variables:** `{"m": {"type": "integer", "min": 1, "max": 10}}`

**Explanation:** Use the negative reciprocal.

**Example question:** A line has nonzero slope 9. Find the slope of a perpendicular line.

**Example answer:** -1/9

### F18 — Compare proportional speeds

**Targets:** A.7.a  
**Answer mode:** category  
**Required extensions:** category_grading

**Template:**
```text
Car A travels {d:30–180} miles in {t:1–4} hours at constant speed. Car B obeys \(d_B={r:10–80}t_B\). Which car is faster: A, B, or equal?
```

**Answer formula/rule:**
```text
compare(d/t,r)
```

**Variables:** `{"d": {"type": "integer", "min": 30, "max": 180}, "t": {"type": "integer", "min": 1, "max": 4}, "r": {"type": "integer", "min": 10, "max": 80}}`

**Explanation:** Compare A speed d/t with B slope r.

**Example question:** Car A travels 155 miles in 3 hours at constant speed. Car B obeys \(d_B=72t_B\). Which car is faster: A, B, or equal?

**Example answer:** B

### F19 — Identify a function from a table

**Targets:** A.7.b  
**Answer mode:** category  
**Required extensions:** derived_variables, category_grading

**Template:**
```text
Does this table define y as a function of x? Answer yes or no. \(\begin{array}{c|ccc}x&{a:1–5}&{a}&{b}\\y&{u:1–10}&{v}&{w:1–10}\end{array}\)
```

**Answer formula/rule:**
```text
no
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 5}, "k": {"type": "integer", "min": 1, "max": 5}, "u": {"type": "integer", "min": 1, "max": 10}, "j": {"type": "integer", "min": 1, "max": 5}, "w": {"type": "integer", "min": 1, "max": 10}}`

**Derived variables, in order:** `{"b": "a+k", "v": "u+j"}`

**Explanation:** The input a has two different outputs, u and v.

**Example question:** Does this table define y as a function of x? Answer yes or no. \(\begin{array}{c|ccc}x&5&5&8\\y&4&6&3\end{array}\)

**Example answer:** no

### F20 — Evaluate a linear function

**Targets:** A.7.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
If \(f(x)={a:-8–8}x+({b:-15–15})\), find \(f({v:-10–10})\).
```

**Answer formula/rule:**
```text
a*v+b
```

**Variables:** `{"a": {"type": "integer", "min": -8, "max": 8}, "b": {"type": "integer", "min": -15, "max": 15}, "v": {"type": "integer", "min": -10, "max": 10}}`

**Explanation:** Substitute v for x.

**Example question:** If \(f(x)=5x+(6)\), find \(f(9)\).

**Example answer:** 51

### F21 — Evaluate a quadratic function

**Targets:** A.7.c  
**Answer mode:** numeric  
**Required extensions:** None beyond listed formula functions

**Template:**
```text
If \(f(x)={a:1–5}x^2+({b:-10–10})x+({c:-15–15})\), find \(f({v:-6–6})\).
```

**Answer formula/rule:**
```text
a*v*v+b*v+c
```

**Variables:** `{"a": {"type": "integer", "min": 1, "max": 5}, "b": {"type": "integer", "min": -10, "max": 10}, "c": {"type": "integer", "min": -15, "max": 15}, "v": {"type": "integer", "min": -6, "max": 6}}`

**Explanation:** Substitute the input and evaluate the polynomial.

**Example question:** If \(f(x)=5x^2+(-5)x+(-15)\), find \(f(-4)\).

**Example answer:** 85

### F22 — Compare rates from table and equation

**Targets:** A.7.d  
**Answer mode:** category  
**Required extensions:** derived_variables, category_grading

**Template:**
```text
Function A is \(y={r:-6–6}x+{c:-10–10}\). Function B has table \(\begin{array}{c|cc}x&0&{d:1–5}\\y&{u:-10–10}&{v}\end{array}\). Which has the greater slope: A, B, or equal?
```

**Answer formula/rule:**
```text
compare(r,(v-u)/d)
```

**Variables:** `{"r": {"type": "integer", "min": -6, "max": 6}, "c": {"type": "integer", "min": -10, "max": 10}, "d": {"type": "integer", "min": 1, "max": 5}, "u": {"type": "integer", "min": -10, "max": 10}, "m": {"type": "integer", "min": -6, "max": 6}}`

**Derived variables, in order:** `{"v": "u+m*d"}`

**Explanation:** Compare r with the table rate (v-u)/d.

**Example question:** Function A is \(y=-3x+-1\). Function B has table \(\begin{array}{c|cc}x&0&2\\y&-5&-5\end{array}\). Which has the greater slope: A, B, or equal?

**Example answer:** B
