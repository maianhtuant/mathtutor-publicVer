"""Build original GED practice templates and a LaTeX catalog. No eval/exec."""
from pathlib import Path
from fractions import Fraction as F
from decimal import Decimal, localcontext, ROUND_HALF_UP
from collections import Counter
import ast, json, math, random, re, textwrap
ROOT=Path(__file__).resolve().parent
BANK=[]

def calc(expr, env):
    """Small allowlisted evaluator used ONLY for catalog validation/generation."""
    def walk(n):
        if isinstance(n,ast.Constant) and isinstance(n.value,(int,float)):
            return F(str(n.value))
        if isinstance(n,ast.Name): return env[n.id]
        if isinstance(n,ast.UnaryOp):
            v=walk(n.operand)
            if isinstance(n.op,ast.USub): return -v
            if isinstance(n.op,ast.UAdd): return v
        if isinstance(n,ast.BinOp):
            a,b=walk(n.left),walk(n.right)
            if isinstance(n.op,ast.Add): return a+b
            if isinstance(n.op,ast.Sub): return a-b
            if isinstance(n.op,ast.Mult): return a*b
            if isinstance(n.op,ast.Div): return a/b
        if isinstance(n,ast.Compare):
            a=walk(n.left)
            for op,right in zip(n.ops,n.comparators):
                b=walk(right)
                ok={ast.Eq:lambda:a==b,ast.NotEq:lambda:a!=b,ast.Lt:lambda:a<b,
                    ast.LtE:lambda:a<=b,ast.Gt:lambda:a>b,ast.GtE:lambda:a>=b}[type(op)]()
                if not ok:return False
                a=b
            return True
        if isinstance(n,ast.Call) and isinstance(n.func,ast.Name):
            a=[walk(v) for v in n.args]; name=n.func.id
            if name=='pow':return a[0]**int(a[1])
            if name=='abs':return abs(a[0])
            if name=='min':return min(a)
            if name=='max':return max(a)
            if name=='floor':return F(math.floor(a[0]))
            if name=='ceil':return F(math.ceil(a[0]))
            if name=='gcd':return F(math.gcd(*(int(x) for x in a)))
            if name=='lcm':return F(math.lcm(*(int(x) for x in a)))
            if name=='nCr':return F(math.comb(int(a[0]),int(a[1])))
            if name=='nPr':return F(math.perm(int(a[0]),int(a[1])))
            if name=='mean':return sum(a)/len(a)
            if name=='median':
                a.sort(); m=len(a)//2
                return a[m] if len(a)%2 else (a[m-1]+a[m])/2
            if name=='sqrt':
                v=a[0]; p=math.isqrt(v.numerator); q=math.isqrt(v.denominator)
                if p*p==v.numerator and q*q==v.denominator:return F(p,q)
                with localcontext() as c:
                    c.prec=50
                    return F(str((Decimal(v.numerator)/Decimal(v.denominator)).sqrt()))
        raise ValueError('Unsupported catalog expression: '+ast.dump(n))
    return walk(ast.parse(expr,mode='eval').body)

def V(**kwargs):
    return {k:{'type':'integer','min':r[0],'max':r[1]} for k,r in kwargs.items()}

def add(id, category, label, targets, prompt, formula, variables, *, derived=None,
        constraints=None, mode='numeric', answer_latex=None, explanation='',
        diagram=None, validation=None, decimal_places=2, rounded=False, figure=None):
    derived=derived or {}; constraints=constraints or []
    # Inline ranges make independently sampled variables copyable into the pictured form.
    inline=prompt
    for name,spec in variables.items():
        token='{'+name+'}'
        inline=inline.replace(token,'{'+name+':'+str(spec['min'])+'–'+str(spec['max'])+'}',1)
    requires=[]
    if derived:requires.append('derived_variables')
    if constraints:requires.append('constraint_filtering')
    if mode!='numeric':requires.append(mode+'_grading')
    if diagram:requires.append('diagram_renderer')
    t={'id':id,'label':label,'category':category,'subject':'Math','active':True,
       'ged_targets':targets.split(), 'template':inline,'template_latex':prompt,
       'answer_formula':formula if mode=='numeric' else None,
       'answer_rule':formula,'answer_latex_template':answer_latex,
       'answer_mode':mode,'min_value':1,'max_value':10,'variables':variables,
       'derived_variables':derived,'constraints':constraints,'grading_tolerance_percent':0,
       'absolute_tolerance':0,'decimal_places':decimal_places,'accept_rounded_decimal':rounded,
       'grading_policy':('exact_or_round_half_up' if rounded else 'exact'),
       'requires_engine_features':requires,'explanation':explanation,
       'diagram':diagram,'validation_identity':validation}
    # Labelled shape the math-service draws with each question's values (see math-service/app/engine/figures.py).
    if figure:t['figure']=figure
    BANK.append(t)

# Number sense and arithmetic.
C='Number sense and arithmetic'
add('N01',C,'Integer addition','Q.2.a',r'Compute \({a}+({b})\).','a+b',V(a=(-30,30),b=(-30,30)),explanation='Add the signed values.')
add('N02',C,'Integer subtraction','Q.2.a',r'Compute \({a}-({b})\).','a-b',V(a=(-30,30),b=(-30,30)),explanation='Subtracting a number is adding its opposite.')
add('N03',C,'Integer multiplication','Q.2.a',r'Compute \(({a})\times({b})\).','a*b',V(a=(-12,12),b=(-12,12)),explanation='Multiply magnitudes and apply the sign rule.')
add('N04',C,'Integer division','Q.2.a',r'Compute \({a}\div {b}\).','a/b',V(a=(-100,100),b=(1,12)),explanation='Write the quotient as a reduced fraction if necessary.')
for id,label,op in [('N05','Fraction addition','+'),('N06','Fraction subtraction','-'),('N07','Fraction multiplication','*')]:
    add(id,C,label,'Q.2.a',rf'Compute \(\frac{{{{a}}}}{{{{b}}}} {op if op!="*" else chr(92)+"times"} \frac{{{{c}}}}{{{{d}}}}\).',f'a/b {op} c/d',V(a=(1,12),b=(2,12),c=(1,12),d=(2,12)),explanation='Use fraction arithmetic and reduce the result.')
add('N08',C,'Fraction division','Q.2.a',r'Compute \(\frac{{a}}{{b}}\div\frac{{c}}{{d}}\).','(a/b)/(c/d)',V(a=(1,12),b=(2,12),c=(1,12),d=(2,12)),explanation='Multiply the first fraction by the reciprocal of the second.')
for id,label,op in [('N09','Decimal addition','+'),('N10','Decimal subtraction','-'),('N11','Decimal multiplication','*'),('N12','Decimal division','/')]:
    add(id,C,label,'Q.2.a',rf'Compute \({{a}} { {"+":"+","-":"-","*":r"\times","/":r"\div"}[op]} {{b}}\).',f'a {op} b',V(u=(11,99),v=(11,99)),derived={'a':'u/10','b':'v/10'},explanation='Treat the decimals as exact fractions, then calculate.')
add('N13',C,'Order rational numbers','Q.1.a',r'Order \(\frac{{a}}{{b}},\ \frac{{c}}{{d}},\ {e}\) from least to greatest.','sort([a/b,c/d,e])',V(a=(1,9),b=(2,10),c=(1,9),d=(2,10),u=(1,99)),derived={'e':'u/100'},mode='ordered_list',explanation='Compare the exact rational values; accept ties in either order.')
add('N14',C,'LCM','Q.1.b',r'Find the least common multiple of \({a}\) and \({b}\).','lcm(a,b)',V(a=(2,20),b=(2,20)),explanation='Use LCM(a,b) = a*b/GCD(a,b).')
add('N15',C,'Greatest common factor','Q.1.b',r'Find the greatest common factor of \({a}\) and \({b}\).','gcd(a,b)',V(a=(6,60),b=(6,60)),explanation='Find the greatest positive integer dividing both numbers.')
add('N16',C,'Absolute value','Q.1.d',r'Evaluate \(\left|{a}\right|\).','abs(a)',V(a=(-50,50)),explanation='Absolute value is distance from zero.')
add('N17',C,'Distance on a number line','Q.1.d',r'Find the distance between \({a}\) and \({b}\) on a number line.','abs(a-b)',V(a=(-30,30),b=(-30,30)),explanation='Take the absolute value of the difference.')
add('N18',C,'Order of operations','Q.2.e',r'Evaluate \({a}+{b}\times({c}-{d})\).','a+b*(c-d)',V(a=(1,20),b=(2,10),c=(5,20),d=(1,4)),explanation='Evaluate parentheses, multiplication, then addition.')
add('N19',C,'Product of powers','Q.1.c',r'Evaluate \({a}^{ {m}}\times {a}^{ {n}}\).','pow(a,m+n)',V(a=(2,5),m=(1,3),n=(1,3)),explanation='Add exponents for the same base.')
add('N20',C,'Quotient of powers','Q.1.c',r'Evaluate \(\frac{{a}^{ {m}}}{{a}^{ {n}}}\).','pow(a,m-n)',V(a=(2,5),m=(1,5),n=(1,5)),explanation='Subtract exponents; negative exponents give reciprocals.')
add('N21',C,'Negative exponent','Q.1.c',r'Evaluate \({a}^{-{n}}\).','1/pow(a,n)',V(a=(2,10),n=(1,3)),explanation='A negative exponent gives the reciprocal.')
add('N22',C,'Square root of a perfect square','Q.2.b',r'Evaluate \(\sqrt{{k}}\).','sqrt(k)',V(a=(2,20)),derived={'k':'a*a'},explanation='The principal square root is nonnegative.')
add('N23',C,'Cube root','Q.2.c',r'Evaluate \(\sqrt[3]{{k}}\).','a',V(a=(-10,10)),derived={'k':'a*a*a'},explanation='The real cube root preserves the sign.')
add('N24',C,'Rational exponent','Q.1.c',r'Evaluate \({k}^{3/2}\).','pow(a,3)',V(a=(2,10)),derived={'k':'a*a'},explanation='Take the square root, then cube the result.')
add('N25',C,'Undefined expression','Q.2.d',r'At what value of \(x\) is \(\frac{1}{x-{a}}\) undefined?','a',V(a=(-20,20)),explanation='The denominator must not equal zero.')
add('N26',C,'Scientific notation product','Q.2.e',r'Compute \(({a}\times10^{ {m}})({b}\times10^{ {n}})\). Enter the numeric value.','a*b*pow(10,m+n)',V(a=(1,9),b=(1,9),m=(-3,3),n=(-3,3)),explanation='Multiply coefficients and add powers of ten.')

C='Ratios, rates, percents, and applications'
add('R01',C,'Unit price','Q.3.a',r'A pack of {n} notebooks costs \(\${c}\). Find the cost per notebook.','c/n',V(n=(2,12),c=(5,60)),explanation='Divide total cost by the number of items.')
add('R02',C,'Average speed','Q.3.a',r'A vehicle travels {d} miles in {t} hours. Find its average speed in miles per hour.','d/t',V(d=(30,300),t=(1,6)),explanation='Speed = distance/time.')
add('R03',C,'Scale drawing to actual length','Q.3.b',r'A drawing uses {s} feet per inch. A length measures {l} inches. Find the actual length in feet.','s*l',V(s=(2,20),l=(2,15)),explanation='Multiply drawing length by the scale.')
add('R04',C,'Actual length to drawing length','Q.3.b',r'A drawing uses {s} feet per inch. The actual length is {l} feet. Find its drawing length in inches.','l/s',V(s=(2,20),l=(10,120)),explanation='Divide actual length by the scale.')
add('R05',C,'Solve a proportion','Q.3.c',r'Solve \(\frac{x}{{a}}=\frac{{b}}{{c}}\).','a*b/c',V(a=(2,20),b=(1,15),c=(2,15)),explanation='Cross-multiply, then isolate x.')
add('R06',C,'Recipe scaling','Q.3.c',r'A recipe uses {c} cups of flour for {s} servings. How many cups are needed for {n} servings?','c*n/s',V(c=(1,6),s=(2,12),n=(4,30)),explanation='Multiply cups per serving by the new serving count.')
add('R07',C,'Unit conversion','Q.3.c',r'Convert {f} feet {i} inches to inches.','12*f+i',V(f=(1,12),i=(0,11)),explanation='Each foot contains twelve inches.')
add('R08',C,'Percent of a quantity','Q.3.d',r'Find \({p}\%\) of \({a}\).','p*a/100',V(p=(5,90),a=(20,500)),explanation='Convert the percent to a fraction over 100.')
add('R09',C,'Find a percentage','Q.3.d',r'{a} out of {b} items passed inspection. What percentage passed?','100*a/b',V(n=(2,20),k=(1,9)),derived={'b':'10*n','p':'10*k','a':'n*k'},explanation='Divide the part by the whole, then multiply by 100.')
add('R10',C,'Find the original whole','Q.3.d',r'\({p}\%\) of a quantity is {a}. Find the quantity.','100*a/p',V(p=(5,90),a=(10,200)),explanation='Divide the part by the percentage written as a decimal.')
add('R11',C,'Sales tax','Q.3.d',r'An item costs \(\${c}\) before a {p}\% sales tax. Find the total price, rounded to cents.','c*(1+p/100)',V(c=(10,250),p=(1,12)),rounded=True,explanation='Add the tax to the original price and round to cents.')
add('R12',C,'Discount then tax','Q.3.d',r'An item costs \(\${c}\). Apply a {d}\% discount, then a {t}\% tax to the discounted price. Find the final price, rounded to cents.','c*(1-d/100)*(1+t/100)',V(c=(20,300),d=(5,50),t=(1,12)),rounded=True,explanation='Apply the discount factor first, then the tax factor.')
add('R13',C,'Tip and total','Q.3.d',r'A meal costs \(\${c}\) before a {p}\% tip. Ignoring tax, find the total, rounded to cents.','c*(1+p/100)',V(c=(10,150),p=(10,25)),rounded=True,explanation='Total = bill times one plus the tip rate.')
add('R14',C,'Simple interest','Q.3.d',r'Find simple interest on \(\${p}\) at {r}\% per year for {t} years.','p*r*t/100',V(p=(100,5000),r=(1,12),t=(1,5)),explanation='Use I = Prt with the rate as a decimal.')
add('R15',C,'Percent increase','Q.3.d',r'A price rises from \(\${a}\) to \(\${b}\). Find the percentage increase.','100*(b-a)/a',V(a=(20,200),k=(1,80)),derived={'b':'a+k'},explanation='Divide the increase by the original amount.')
add('R16',C,'Percent decrease','Q.3.d',r'A quantity falls from {a} to {b}. Find the percentage decrease.','100*(a-b)/a',V(b=(10,100),k=(1,80)),derived={'a':'b+k'},explanation='Divide the decrease by the original amount.')
add('R17',C,'Commission','Q.3.d',r'A salesperson earns {p}\% commission on \(\${s}\) in sales. Find the commission.','p*s/100',V(p=(1,20),s=(100,5000)),explanation='Multiply sales by the commission rate.')
add('R18',C,'Multistep purchase','Q.2.e Q.3.c',r'You buy {n} items at \(\${p}\) each and pay with \(\${cash}\). Find the change.','cash-n*p',V(n=(2,10),p=(2,20),extra=(1,50)),derived={'cash':'n*p+extra'},explanation='Subtract the total purchase cost from the amount paid.')

C='Geometry and measurement'
add('G01',C,'Rectangle area','Q.4.a',r'A rectangle has length {l} cm and width {w} cm. Find its area in square centimeters.','l*w',V(l=(2,30),w=(2,20)),explanation='Area = length times width.',figure={'shape':'rectangle','labels':{'width':'{l} cm','height':'{w} cm'},'size':{'width':'l','height':'w'}})
add('G02',C,'Rectangle perimeter','Q.4.a',r'A rectangle measures {l} cm by {w} cm. Find its perimeter in centimeters.','2*(l+w)',V(l=(2,30),w=(2,20)),explanation='Add all four side lengths.',figure={'shape':'rectangle','labels':{'width':'{l} cm','height':'{w} cm'},'size':{'width':'l','height':'w'}})
add('G03',C,'Rectangle missing width','Q.4.a',r'A rectangle has area {A} square centimeters and length {l} cm. Find its width.','A/l',V(l=(2,30),w=(2,20)),derived={'A':'l*w'},explanation='Width = area/length.',figure={'shape':'rectangle','labels':{'width':'{l} cm','height':'?','inside':'A = {A} cm²'},'size':{'width':'l','height':'w'}})
add('G04',C,'Triangle area','Q.4.a',r'A triangle has base {b} cm and perpendicular height {h} cm. Find its area.','b*h/2',V(b=(2,30),h=(2,20)),explanation='Use half the base times the height.',figure={'shape':'triangle','labels':{'base':'{b} cm','height':'{h} cm'},'size':{'base':'b','height':'h'}})
add('G05',C,'Triangle perimeter','Q.4.a',r'A triangle has side lengths {a}, {b}, and {c} cm. Find its perimeter.','a+b+c',V(k=(1,10)),derived={'a':'3*k','b':'4*k','c':'5*k'},explanation='Add the three side lengths.',figure={'shape':'right_triangle','labels':{'base':'{b} cm','height':'{a} cm','hypotenuse':'{c} cm'},'size':{'base':'b','height':'a'}})
add('G06',C,'Triangle missing height','Q.4.a',r'A triangle has area {A} square centimeters and base {b} cm. Find its perpendicular height.','2*A/b',V(b=(2,20),h=(2,20)),derived={'A':'b*h/2'},explanation='Rearrange A = bh/2.',figure={'shape':'triangle','labels':{'base':'{b} cm','height':'?','inside':'A = {A} cm²'},'size':{'base':'b','height':'h'}})
add('G07',C,'Circle area','Q.4.b',r'A circle has radius {r} cm. Use \(\pi=3.14\). Find its area.','3.14*r*r',V(r=(1,20)),explanation='Use A = pi*r squared with the stated value of pi.',figure={'shape':'circle','labels':{'radius':'{r} cm'}})
add('G08',C,'Circle circumference','Q.4.b',r'A circle has radius {r} cm. Use \(\pi=3.14\). Find its circumference.','2*3.14*r',V(r=(1,20)),explanation='Use C = 2*pi*r.',figure={'shape':'circle','labels':{'radius':'{r} cm'}})
add('G09',C,'Radius from circumference','Q.4.b',r'A circle has circumference {C} cm. Use \(\pi=3.14\). Find its radius.','C/(2*3.14)',V(r=(1,20)),derived={'C':'2*3.14*r'},explanation='Divide circumference by 2*pi.',figure={'shape':'circle','labels':{'radius':'r = ?','inside':'C = {C} cm'}})
add('G10',C,'Radius from area','Q.4.b',r'A circle has area {A} square centimeters. Use \(\pi=3.14\). Find its radius.','sqrt(A/3.14)',V(r=(1,20)),derived={'A':'3.14*r*r'},explanation='Take the nonnegative square root of area/pi.',figure={'shape':'circle','labels':{'radius':'r = ?','inside':'A = {A} cm²'}})
add('G11',C,'Trapezoid area','Q.4.c',r'A trapezoid has parallel bases {a} and {b} cm and perpendicular height {h} cm. Find its area.','(a+b)*h/2',V(a=(2,20),b=(2,20),h=(2,15)),explanation='Multiply the average base length by the height.',figure={'shape':'trapezoid','labels':{'top':'{a} cm','bottom':'{b} cm','height':'{h} cm'},'size':{'top':'a','bottom':'b','height':'h'}})
add('G12',C,'Regular polygon perimeter','Q.4.c',r'A regular polygon has {n} sides, each {s} cm long. Find its perimeter.','n*s',V(n=(3,10),s=(2,20)),explanation='Multiply the number of sides by their common length.')
add('G13',C,'Regular polygon area','Q.4.c',r'A regular polygon has perimeter {p} cm and apothem {a} cm. Given \(A=\frac12 pa\), calculate its area.','p*a/2',V(a=(2,12)),derived={'p':'8*a'},explanation='Substitute in the supplied formula; the generated dimensions are consistent with a square.')
add('G14',C,'Composite rectangle area','Q.4.d',r'A {L} cm by {W} cm rectangle has a {l} cm by {w} cm rectangular corner removed. Find the remaining area.','L*W-l*w',V(L=(15,30),W=(15,30),l=(2,10),w=(2,10)),explanation='Subtract the removed area from the whole rectangle.')
add('G15',C,'Rectangle and semicircle area','Q.4.d',r'A rectangle is {l} cm long and {d} cm wide. A semicircle of diameter {d} cm is attached outside one width edge with no overlap. Use \(\pi=3.14\). Find the total area.','l*d+3.14*pow(d/2,2)/2',V(l=(5,25),d=(2,20)),explanation='Add the rectangle area and half the circle area.')
add('G16',C,'Pythagorean hypotenuse','Q.4.e',r'A right triangle has legs {a} cm and {b} cm. Find its hypotenuse, rounded to two decimal places.','sqrt(a*a+b*b)',V(a=(3,20),b=(3,20)),rounded=True,explanation='Use c = sqrt(a squared + b squared).')
add('G17',C,'Pythagorean missing leg','Q.4.e',r'A right triangle has hypotenuse {c} cm and one leg {a} cm. Find the other leg.','sqrt(c*c-a*a)',V(k=(1,10)),derived={'c':'5*k','a':'3*k'},explanation='Use the positive square root of c squared minus a squared.')
add('G18',C,'Rectangular prism volume','Q.5.a',r'A rectangular prism measures {l} by {w} by {h} cm. Find its volume.','l*w*h',V(l=(2,20),w=(2,15),h=(2,15)),explanation='Multiply all three dimensions.')
add('G19',C,'Rectangular prism surface area','Q.5.a',r'A rectangular prism measures {l} by {w} by {h} cm. Find its total surface area.','2*(l*w+l*h+w*h)',V(l=(2,20),w=(2,15),h=(2,15)),explanation='Add the areas of the six faces.')
add('G20',C,'Prism missing height','Q.5.a',r'A rectangular prism has volume {V} cubic centimeters, length {l} cm and width {w} cm. Find its height.','V/(l*w)',V(l=(2,15),w=(2,12),h=(2,12)),derived={'V':'l*w*h'},explanation='Divide the volume by the base area.')
add('G21',C,'Cylinder volume','Q.5.b',r'A cylinder has radius {r} cm and height {h} cm. Use \(\pi=3.14\). Find its volume.','3.14*r*r*h',V(r=(1,10),h=(2,20)),explanation='Use V = pi*r squared*h.')
add('G22',C,'Cylinder surface area','Q.5.b',r'A closed cylinder has radius {r} cm and height {h} cm. Use \(\pi=3.14\). Find its total surface area.','2*3.14*r*h+2*3.14*r*r',V(r=(1,10),h=(2,20)),explanation='Add the curved surface and both circular bases.')
add('G23',C,'Cylinder missing height','Q.5.b',r'A cylinder has volume {V} cubic centimeters and radius {r} cm. Use \(\pi=3.14\). Find its height.','V/(3.14*r*r)',V(r=(1,10),h=(2,20)),derived={'V':'3.14*r*r*h'},explanation='Divide the volume by the circular base area.')
add('G24',C,'Right prism volume','Q.5.c',r'A right prism has base area {B} square centimeters and height {h} cm. Find its volume.','B*h',V(B=(5,100),h=(2,20)),explanation='Volume = base area times height.')
add('G25',C,'Right prism surface area','Q.5.c',r'A right triangular prism has base side lengths {a}, {b}, {c} cm, base area {B} square centimeters, and prism height {h} cm. Find its total surface area.','(a+b+c)*h+2*B',V(k=(1,6),h=(2,20)),derived={'a':'3*k','b':'4*k','c':'5*k','B':'a*b/2'},explanation='Use lateral area plus twice the base area.')
add('G26',C,'Pyramid volume','Q.5.d',r'A pyramid has base area {B} square centimeters and perpendicular height {h} cm. Find its volume.','B*h/3',V(B=(9,120),h=(3,18)),explanation='Volume = one third of base area times height.')
add('G27',C,'Square pyramid surface area','Q.5.d',r'A right square pyramid has base side {s} cm and slant height {l} cm. Find its total surface area.','s*s+2*s*l',V(s=(2,10),l=(6,15)),explanation='Add the square base and four triangular faces.')
add('G28',C,'Cone volume','Q.5.d',r'A cone has radius {r} cm and perpendicular height {h} cm. Use \(\pi=3.14\). Find its volume.','3.14*r*r*h/3',V(r=(1,10),h=(3,18)),explanation='Use one third of the circular base area times height.')
add('G29',C,'Cone surface area','Q.5.d',r'A cone has radius {r} cm and slant height {l} cm. Use \(\pi=3.14\). Find its total surface area.','3.14*r*l+3.14*r*r',V(r=(1,5),l=(6,15)),explanation='Add lateral area pi*r*l and base area pi*r squared.')
add('G30',C,'Sphere volume','Q.5.e',r'A sphere has radius {r} cm. Use \(\pi=3.14\). Find its volume, rounded to two decimal places.','4*3.14*pow(r,3)/3',V(r=(1,12)),rounded=True,explanation='Use V = (4/3)*pi*r cubed.')
add('G31',C,'Sphere surface area','Q.5.e',r'A sphere has radius {r} cm. Use \(\pi=3.14\). Find its surface area.','4*3.14*r*r',V(r=(1,12)),explanation='Use A = 4*pi*r squared.')
add('G32',C,'Sphere radius from area','Q.5.e',r'A sphere has surface area {A} square centimeters. Use \(\pi=3.14\). Find its radius.','sqrt(A/(4*3.14))',V(r=(1,12)),derived={'A':'4*3.14*r*r'},explanation='Rearrange the surface area formula and take the positive root.')
add('G33',C,'Composite cylinder and hemisphere volume','Q.5.f',r'A cylinder of radius {r} cm and height {h} cm has a hemisphere of the same radius attached on top, with no overlap. Use \(\pi=3.14\). Find the volume, rounded to two decimal places.','3.14*r*r*h+2*3.14*pow(r,3)/3',V(r=(1,8),h=(2,15)),rounded=True,explanation='Add cylinder volume and half a sphere volume.')
add('G34',C,'Composite cylinder and hemisphere surface area','Q.5.f',r'A solid has a cylinder of radius {r} cm and height {h} cm, a hemisphere on top, and a flat circular bottom. Use \(\pi=3.14\). Find the external surface area.','2*3.14*r*h+3*3.14*r*r',V(r=(1,8),h=(2,15)),explanation='Add the cylinder side, hemisphere curved area, and bottom; exclude the joined face.')

C='Data, statistics, and probability'
add('D01',C,'Mean','Q.7.a',r'Find the mean of \({a},{b},{c},{d}\).','mean(a,b,c,d)',V(a=(1,30),b=(1,30),c=(1,30),d=(1,30)),explanation='Sum the values and divide by four.')
add('D02',C,'Median of five values','Q.7.a',r'Find the median of \({a},{b},{c},{d},{e}\).','median(a,b,c,d,e)',V(a=(1,30),b=(1,30),c=(1,30),d=(1,30),e=(1,30)),explanation='Sort the values and take the third.')
add('D03',C,'Median of four values','Q.7.a',r'Find the median of \({a},{b},{c},{d}\).','median(a,b,c,d)',V(a=(1,30),b=(1,30),c=(1,30),d=(1,30)),explanation='Sort and average the second and third values.')
add('D04',C,'Range','Q.7.a',r'Find the range of \({a},{b},{c},{d}\).','max(a,b,c,d)-min(a,b,c,d)',V(a=(1,50),b=(1,50),c=(1,50),d=(1,50)),explanation='Subtract the minimum from the maximum.')
add('D05',C,'Mode with a unique winner','Q.7.a',r'Find the mode of \({a},{b},{a},{c},{a},{b}\).','a',V(a=(1,10),u=(1,10),v=(1,10)),derived={'b':'a+u','c':'b+v'},explanation='The value a appears three times; b twice and c once.')
add('D06',C,'Missing value from mean','Q.7.a',r'The mean of \({a},{b},{c},x\) is {m}. Find \(x\).','4*m-a-b-c',V(a=(1,30),b=(1,30),c=(1,30),m=(10,30)),explanation='The total must be four times the mean.')
add('D07',C,'Weighted mean','Q.7.a',r'A score of {a} has weight {u} and a score of {b} has weight {v}. Find the weighted mean.','(a*u+b*v)/(u+v)',V(a=(40,100),b=(40,100),u=(1,5),v=(1,5)),explanation='Divide the weighted sum by the sum of the weights.')
add('D08',C,'Frequency table mean','Q.6.b Q.7.a',r'The table gives value and frequency: \(\begin{array}{c|cc} \text{Value}&{a}&{b}\\ \text{Frequency}&{u}&{v}\end{array}\). Find the mean.','(a*u+b*v)/(u+v)',V(a=(1,10),k=(1,10),u=(1,8),v=(1,8)),derived={'b':'a+k'},explanation='Multiply each value by its frequency, sum, and divide by the total frequency.')
add('D09',C,'Bar graph comparison','Q.6.a',r'The bar graph shows books sold on two days. How many more were sold on day B than day A?','b-a',V(a=(5,20),k=(1,15)),derived={'b':'a+k'},diagram={'kind':'bar','labels':['A','B'],'values':['a','b']},explanation='Read both bar heights and subtract A from B.')
add('D10',C,'Circle graph sector angle','Q.6.a',r'A category occupies {p}\% of a circle graph. Find its central angle in degrees.','360*p/100',V(p=(5,80)),explanation='Multiply the fraction of the whole by 360 degrees.')
add('D11',C,'Histogram frequency','Q.6.b',r'The histogram shows counts in three score intervals. How many scores lie in the middle interval?','b',V(a=(2,12),b=(2,12),c=(2,12)),diagram={'kind':'histogram','labels':['0-9','10-19','20-29'],'values':['a','b','c']},explanation='Read the height of the middle bin.')
add('D12',C,'Box plot interquartile range','Q.6.b',r'The box plot shows a five-number summary. Find the interquartile range.','q3-q1',V(lo=(0,10),a=(1,8),b=(1,8),c=(1,8),d=(1,8)),derived={'q1':'lo+a','med':'q1+b','q3':'med+c','hi':'q3+d'},diagram={'kind':'box','values':['lo','q1','med','q3','hi']},explanation='Subtract Q1 from Q3.')
add('D13',C,'Scatter plot interpretation','Q.6.c',r'The plotted points are \(({a},{u}),({b},{v}),({c},{w})\). Classify their association as positive, negative, or neither.','positive',V(a=(1,3),k=(1,3),m=(1,5),p=(0,5)),derived={'b':'a+k','c':'b+k','u':'m*a+p','v':'m*b+p','w':'m*c+p'},mode='category',diagram={'kind':'scatter','points':[['a','u'],['b','v'],['c','w']]},explanation='Both coordinates increase together, so the association is positive.')
add('P01',C,'Fundamental counting principle','Q.8.a',r'A meal offers {a} main dishes, {b} sides, and {c} drinks. Choose one of each. How many meals are possible?','a*b*c',V(a=(2,8),b=(2,6),c=(2,5)),explanation='Multiply the independent numbers of choices.')
add('P02',C,'Combinations','Q.8.a',r'Choose a committee of {r} people from {n} people. Order does not matter. How many committees are possible?','nCr(n,r)',V(n=(6,15),r=(2,5)),explanation='Use the combination formula n!/(r!(n-r)!).')
add('P03',C,'Permutations','Q.8.a',r'Assign {r} distinct ranked positions to {n} people, with no person repeated. How many assignments are possible?','nPr(n,r)',V(n=(6,15),r=(2,5)),explanation='Use the permutation formula n!/(n-r)!.')
add('P04',C,'Simple probability','Q.8.b',r'A bag contains {r} red and {b} blue counters. One is chosen at random. Find the probability of red.','r/(r+b)',V(r=(1,12),b=(1,12)),explanation='Favorable outcomes divided by total outcomes.')
add('P05',C,'Independent events with replacement','Q.8.b',r'A bag contains {r} red and {b} blue counters. Draw twice, replacing the first counter. Find the probability both are red.','pow(r/(r+b),2)',V(r=(1,12),b=(1,12)),explanation='The draws are independent; multiply the two probabilities.')
add('P06',C,'Dependent events without replacement','Q.8.b',r'A bag contains {r} red and {b} blue counters. Draw twice without replacement. Find the probability both are red.','r/(r+b)*(r-1)/(r+b-1)',V(r=(2,12),b=(1,12)),explanation='After the first red draw, one fewer red and total counter remain.')
add('P07',C,'Complement probability','Q.8.b',r'The probability of rain is \(\frac{{a}}{{b}}\). Find the probability of no rain.','1-a/b',V(a=(1,5),b=(6,12)),explanation='Subtract the event probability from one.')

C='Expressions and polynomials'
add('E01',C,'Combine like terms','A.1.a',r'Simplify \({a}x+{b}x+{c}\).','(a+b)*x+c',V(a=(1,10),b=(1,10),c=(-10,10)),mode='expression',answer_latex=r'({a}+{b})x+({c})',explanation='Add the coefficients of x.')
add('E02',C,'Distribute a coefficient','A.1.a',r'Expand \({a}({b}x+{c})\).','a*b*x+a*c',V(a=(2,10),b=(1,10),c=(1,10)),mode='expression',answer_latex=r'{a}\cdot{b}x+{a}\cdot{c}',explanation='Multiply both terms by the outside coefficient.')
add('E03',C,'Evaluate a linear expression','A.1.b',r'Evaluate \({a}x+{b}\) at \(x={v}\).','a*v+b',V(a=(-10,10),b=(-20,20),v=(-10,10)),explanation='Substitute v for x and calculate.')
add('E04',C,'Translate a linear cost expression','A.1.c',r'A rental has a fixed fee of \(\${b}\) plus \(\${a}\) per hour. Write total cost as an expression in hours \(h\).','a*h+b',V(a=(2,20),b=(5,50)),mode='expression',answer_latex=r'{a}h+{b}',explanation='Variable cost plus fixed fee.')
add('E05',C,'Add polynomials','A.1.d',r'Simplify \(({a}x^2+{b}x+{c})+({d}x^2+{e}x+{f})\).','(a+d)*x*x+(b+e)*x+c+f',V(a=(1,8),b=(1,8),c=(1,8),d=(1,8),e=(1,8),f=(1,8)),mode='expression',answer_latex=r'({a}+{d})x^2+({b}+{e})x+({c}+{f})',explanation='Combine terms with the same power of x.')
add('E06',C,'Subtract polynomials','A.1.d',r'Simplify \(({a}x^2+{b}x+{c})-({d}x^2+{e}x+{f})\).','(a-d)*x*x+(b-e)*x+c-f',V(a=(1,8),b=(1,8),c=(1,8),d=(1,8),e=(1,8),f=(1,8)),mode='expression',answer_latex=r'({a}-{d})x^2+({b}-{e})x+({c}-{f})',explanation='Distribute the minus sign before combining terms.')
add('E07',C,'Multiply binomials','A.1.d',r'Expand \((x+{a})(x+{b})\).','x*x+(a+b)*x+a*b',V(a=(1,12),b=(1,12)),mode='expression',answer_latex=r'x^2+({a}+{b})x+{a}\cdot{b}',explanation='Multiply all pairs of terms and combine.')
add('E08',C,'Divide factorable polynomials','A.1.d',r'Simplify \(\frac{x^2-{k}}{x-{a}}\), retaining the restriction \(x\ne {a}\).','x+a',V(a=(1,12)),derived={'k':'a*a'},mode='expression',answer_latex=r'x+{a},\quad x\ne {a}',explanation='Factor the numerator as (x-a)(x+a); preserve the original domain.')
add('E09',C,'Evaluate a polynomial','A.1.e',r'Evaluate \({a}x^2+{b}x+{c}\) at \(x={v}\).','a*v*v+b*v+c',V(a=(1,8),b=(-10,10),c=(-20,20),v=(-6,6)),explanation='Substitute v for x, square before multiplying.')
add('E10',C,'Factor a common factor','A.1.f',r'Factor completely over the integers: \({A}x+{B}\).','g*(a*x+b)',V(g=(2,10),a=(1,9),b=(1,9)),derived={'A':'g*a','B':'g*b'},constraints=['gcd(a,b)==1'],mode='factored_expression',answer_latex=r'{g}({a}x+{b})',explanation='Take out the greatest common factor; the remaining coefficients are coprime.')
add('E11',C,'Factor a monic quadratic','A.1.f',r'Factor completely: \(x^2+{s}x+{p}\).','(x+a)*(x+b)',V(a=(1,12),b=(1,12)),derived={'s':'a+b','p':'a*b'},mode='factored_expression',answer_latex=r'(x+{a})(x+{b})',explanation='Find two integers whose sum is s and product is p.')
add('E12',C,'Factor difference of squares','A.1.f',r'Factor completely: \(x^2-{k}\).','(x-a)*(x+a)',V(a=(1,12)),derived={'k':'a*a'},mode='factored_expression',answer_latex=r'(x-{a})(x+{a})',explanation='Use the difference-of-squares identity.')
add('E13',C,'Translate a polynomial area expression','A.1.g',r'A rectangle has side lengths \(x+{a}\) and \(x+{b}\), where \(x\ge0\). Write its area as a polynomial in \(x\).','x*x+(a+b)*x+a*b',V(a=(1,12),b=(1,12)),mode='expression',answer_latex=r'x^2+({a}+{b})x+{a}\cdot{b}',explanation='Multiply length and width, then expand.')
add('E14',C,'Add rational expressions','A.1.h',r'Simplify \(\frac{{a}}{x}+\frac{{b}}{x}\), where \(x\ne0\).','(a+b)/x',V(a=(1,12),b=(1,12)),mode='expression',answer_latex=r'\frac{{a}+{b}}{x},\quad x\ne0',explanation='Add numerators over the common denominator.')
add('E15',C,'Multiply rational expressions','A.1.h',r'Simplify \(\frac{{a}x}{{b}}\cdot\frac{{c}}{{d}x}\), where \(x\ne0\).','a*c/(b*d)',V(a=(1,12),b=(1,12),c=(1,12),d=(1,12)),explanation='Cancel nonzero x, multiply numerators and denominators.')
add('E16',C,'Evaluate a rational expression','A.1.i',r'Evaluate \(\frac{{a}x+{b}}{x+{c}}\) at \(x={v}\).','(a*v+b)/(v+c)',V(a=(1,10),b=(1,15),c=(1,10),v=(0,10)),explanation='Substitute v; the generated denominator is positive.')
add('E17',C,'Translate a rational rate expression','A.1.j',r'A trip covers {d} miles in \(t\) hours, with \(t>0\). Write the average speed as an expression in \(t\).','d/t',V(d=(20,300)),mode='expression',answer_latex=r'\frac{{d}}{t},\quad t>0',explanation='Average speed equals distance divided by time.')

C='Linear equations and systems'
add('L01',C,'One-step addition equation','A.2.a',r'Solve \(x+{b}={c}\).','c-b',V(b=(-20,20),c=(-20,20)),validation='answer+b==c',explanation='Subtract b from both sides.')
add('L02',C,'One-step multiplication equation','A.2.a',r'Solve \({a}x={b}\).','b/a',V(a=(1,12),b=(-30,30)),validation='a*answer==b',explanation='Divide both sides by a.')
add('L03',C,'Two-step equation','A.2.a',r'Solve \({a}x+({b})={c}\).','(c-b)/a',V(a=(1,12),b=(-20,20),c=(-30,30)),validation='a*answer+b==c',explanation='Subtract b and divide by a.')
add('L04',C,'Equation with parentheses','A.2.a',r'Solve \({a}(x+{b})={c}\).','c/a-b',V(a=(2,10),b=(1,12),c=(1,100)),validation='a*(answer+b)==c',explanation='Divide by a, then subtract b.')
add('L05',C,'Variables on both sides','A.2.a',r'Solve \({a}x+{b}={c}x+{d}\).','(d-b)/(a-c)',V(c=(1,8),k=(1,8),b=(-20,20),d=(-20,20)),derived={'a':'c+k'},validation='a*answer+b==c*answer+d',explanation='Collect x terms; a-c is nonzero by construction.')
add('L06',C,'Rational-coefficient equation','A.2.a',r'Solve \(\frac{{a}}{{b}}x+{c}={d}\).','(d-c)*b/a',V(a=(1,10),b=(2,12),c=(-10,10),d=(-20,20)),validation='a/b*answer+c==d',explanation='Subtract c, then multiply by b/a.')
add('L07',C,'Literal equation','A.2.a',r'Rearrange \(y=ax+b\) to solve for \(x\), assuming \(a\ne0\).','(y-b)/a',{},mode='expression',answer_latex=r'x=\frac{y-b}{a}',explanation='Subtract b and divide by a; this template has symbolic coefficients.')
add('L08',C,'Rental time from total cost','A.2.b',r'A rental costs \(\${b}\) plus \(\${a}\) per hour. The total is \(\${c}\). Find the rental time in hours.','(c-b)/a',V(a=(2,20),b=(5,50),h=(1,12)),derived={'c':'a*h+b'},validation='a*answer+b==c',explanation='Set variable cost plus fixed fee equal to the total.')
add('L09',C,'Write a cost equation','A.2.c',r'A service charges \(\${b}\) plus \(\${a}\) per hour. Write an equation for total cost \(C\) in hours \(h\).','C=a*h+b',V(a=(2,20),b=(5,50)),mode='equation',answer_latex=r'C={a}h+{b}',explanation='Relate total cost to hours and the fixed charge.')
add('L10',C,'Write a two-variable purchase equation','A.2.c',r'Adult tickets cost \(\${a}\), child tickets cost \(\${b}\), and total revenue is \(\${t}\). Write an equation using adult count \(x\) and child count \(y\).','a*x+b*y=t',V(a=(10,20),b=(3,9),u=(2,10),v=(2,10)),derived={'t':'a*u+b*v'},mode='equation',answer_latex=r'{a}x+{b}y={t}',explanation='Sum the revenue from the two ticket types.')
add('L11',C,'Solve a system: x component','A.2.d',r'Solve \(x+y={s}\), \({a}x+{b}y={t}\). Enter only \(x\).','(t-b*s)/(a-b)',V(b=(1,5),k=(1,5),u=(1,10),v=(1,10)),derived={'a':'b+k','s':'u+v','t':'a*u+b*v'},validation='answer==u',explanation='Substitute y=s-x in the second equation.')
add('L12',C,'Solve a system: ordered pair','A.2.d',r'Solve \(x+y={s}\), \({a}x+{b}y={t}\). Enter \((x,y)\).','[u,v]',V(b=(1,5),k=(1,5),u=(1,10),v=(1,10)),derived={'a':'b+k','s':'u+v','t':'a*u+b*v'},mode='ordered_pair',answer_latex=r'({u},{v})',explanation='Eliminate one variable, then substitute to find the other.')
add('L13',C,'Ticket system word problem','A.2.d',r'{s} tickets were sold. Adult tickets cost \(\${a}\), child tickets cost \(\${b}\), and revenue was \(\${t}\). How many adult tickets were sold?','(t-b*s)/(a-b)',V(b=(3,8),k=(2,8),u=(2,20),v=(2,20)),derived={'a':'b+k','s':'u+v','t':'a*u+b*v'},validation='answer==u',explanation='Use the ticket-count and revenue equations.')

C='Linear inequalities'
add('I01',C,'Solve a positive-coefficient inequality','A.3.a',r'Solve \({a}x+{b}<{c}\).','x < (c-b)/a',V(a=(1,10),b=(-20,20),c=(-20,20)),mode='inequality',answer_latex=r'x<\frac{{c}-({b})}{{a}}',explanation='Subtract b and divide by positive a; keep the inequality direction.')
add('I02',C,'Solve a negative-coefficient inequality','A.3.a',r'Solve \(-{a}x+{b}\le {c}\).','x >= (b-c)/a',V(a=(1,10),b=(-20,20),c=(-20,20)),mode='inequality',answer_latex=r'x\ge\frac{{b}-({c})}{{a}}',explanation='Dividing by a negative coefficient reverses the inequality.')
add('I03',C,'Graph a strict inequality','A.3.b',r'Graph \(x>{a}\) on a number line.','open endpoint a; shade right',V(a=(-10,10)),mode='number_line',answer_latex=r'({a},\infty)',explanation='Use an open circle at a and shade to the right.')
add('I04',C,'Graph an inclusive inequality','A.3.b',r'Graph \(x\le {a}\) on a number line.','closed endpoint a; shade left',V(a=(-10,10)),mode='number_line',answer_latex=r'(-\infty,{a}]',explanation='Use a filled circle at a and shade to the left.')
add('I05',C,'Budget maximum whole items','A.3.c',r'You have \(\${B}\), pay a fixed fee of \(\${f}\), and each item costs \(\${p}\). What is the maximum whole number of items you can buy?','floor((B-f)/p)',V(B=(50,200),f=(5,20),p=(2,15)),explanation='Solve f+p*n <= B, then take the floor.')
add('I06',C,'Write a budget inequality','A.3.d',r'A fixed fee is \(\${f}\), each item costs \(\${p}\), and the budget is \(\${B}\). Write an inequality for the nonnegative whole number \(n\) of items.','f+p*n <= B',V(B=(50,200),f=(5,20),p=(2,15)),mode='inequality',answer_latex=r'{f}+{p}n\le {B},\quad n\in\mathbb Z_{\ge0}',explanation='Total cost must not exceed the budget; counts are nonnegative integers.')

C='Quadratic equations'
add('Q01',C,'Quadratic square equation, positive root','A.4.a',r'Solve \(x^2={k}\). Enter only the positive solution.','a',V(a=(1,20)),derived={'k':'a*a'},validation='answer*answer==k',explanation='The solutions are plus/minus a; only the positive one is requested.')
add('Q02',C,'Factorable quadratic, all real roots','A.4.a',r'Solve \(x^2-({s})x+({p})=0\). Enter all distinct real solutions.','set([a,b])',V(a=(-12,12),b=(-12,12)),derived={'s':'a+b','p':'a*b'},mode='solution_set',answer_latex=r'\{{a},{b}\}',explanation='Factor as (x-a)(x-b); repeated roots count once.')
add('Q03',C,'Quadratic formula, larger root','A.4.a',r'Solve \(x^2-({s})x+({p})=0\). Enter only the larger real solution.','(s+sqrt(s*s-4*p))/2',V(a=(-12,12),b=(-12,12)),derived={'s':'a+b','p':'a*b'},validation='answer==max(a,b)',explanation='Use the plus sign in the quadratic formula for a monic quadratic.')
add('Q04',C,'Complete the square','A.4.a',r'Solve \((x-({h}))^2={k}\). Enter both real solutions.','set([h-a,h+a])',V(h=(-10,10),a=(1,10)),derived={'k':'a*a'},mode='solution_set',answer_latex=r'\{{h}-{a},{h}+{a}\}',explanation='Take both square-root signs before adding h.')
add('Q05',C,'Repeated quadratic root','A.4.a',r'Solve \(x^2-({s})x+({p})=0\).','a',V(a=(-12,12)),derived={'s':'2*a','p':'a*a'},validation='answer*answer-s*answer+p==0',explanation='The quadratic is (x-a) squared, so there is one distinct root.')
add('Q06',C,'Write a quadratic area equation','A.4.b',r'A rectangle has sides \(x\) and \(x+{d}\) cm and area {A} square centimeters. Write a quadratic equation for \(x>0\).','x*x+d*x=A',V(d=(1,10),u=(2,15)),derived={'A':'u*(u+d)'},mode='equation',answer_latex=r'x^2+{d}x={A},\quad x>0',explanation='Multiply the two side lengths and equate to the area.')
add('Q07',C,'Quadratic area word problem','A.4.a A.4.b',r'A rectangle has sides \(x\) and \(x+{d}\) cm and area {A} square centimeters. Find the positive value of \(x\).','(-d+sqrt(d*d+4*A))/2',V(d=(1,10),u=(2,15)),derived={'A':'u*(u+d)'},validation='answer==u',explanation='Solve x squared + d*x - A = 0 and retain the positive root.')

C='Coordinates, lines, graphs, and functions'
add('F01',C,'Locate a point','A.5.a',r'Plot \(({a},{b})\) on the coordinate plane.','[a,b]',V(a=(-8,8),b=(-8,8)),mode='coordinate_plot',answer_latex=r'({a},{b})',explanation='Move a units horizontally and b units vertically.')
add('F02',C,'Slope from two points','A.5.b',r'Find the slope through \(({x},{y})\) and \(({u},{v})\).','(v-y)/(u-x)',V(x=(-5,5),y=(-10,10),dx=(1,6),dy=(-8,8)),derived={'u':'x+dx','v':'y+dy'},explanation='Use change in y divided by change in x.')
add('F03',C,'Slope from an equation','A.5.b',r'Find the slope of \(y={m}x+({b})\).','m',V(m=(-8,8),b=(-10,10)),explanation='In slope-intercept form, the x coefficient is the slope.')
add('F04',C,'Slope from a table','A.5.b',r'Find the slope represented by \(\begin{array}{c|cc}x&{a}&{b}\\y&{u}&{v}\end{array}\).','(v-u)/(b-a)',V(a=(0,5),k=(1,5),m=(-6,6),c=(-10,10)),derived={'b':'a+k','u':'m*a+c','v':'m*b+c'},explanation='Calculate the ratio of output change to input change.')
add('F05',C,'Slope from a graph','A.5.b',r'Find the slope of the line in the graph.','m',V(m=(-3,3),b=(-4,4)),diagram={'kind':'line','m':'m','b':'b','x_min':-4,'x_max':4},explanation='Read two points and calculate rise/run.')
add('F06',C,'Interpret proportional slope','A.5.c',r'The distance-time equation is \(d={r}t\), with miles and hours. What is the speed in miles per hour?','r',V(r=(10,80)),explanation='The coefficient is distance per unit time.')
add('F07',C,'Graph a linear equation','A.5.d',r'Graph \(y={m}x+({b})\).','y=m*x+b',V(m=(-4,4),b=(-6,6)),mode='line_graph',answer_latex=r'y={m}x+({b})',explanation='Plot the y-intercept and another point using the slope.')
add('F08',C,'Linear y-intercept','A.5.e',r'A balance follows \(B(t)={m}t+{b}\). Find the initial balance \(B(0)\).','b',V(m=(1,20),b=(10,100)),explanation='Evaluate at t=0; the intercept is the initial value.')
add('F09',C,'Linear x-intercept','A.5.e',r'Find the x-intercept coordinate of \(y={m}x+({b})\). Enter only its x-coordinate.','-b/m',V(m=(1,10),b=(-20,20)),explanation='Set y=0 and solve for x.')
add('F10',C,'Quadratic vertex','A.5.e',r'Find the vertex of \(y={a}(x-({h}))^2+({k})\).','[h,k]',V(a=(1,5),h=(-6,6),k=(-10,10)),mode='ordered_pair',answer_latex=r'({h},{k})',explanation='Vertex form gives vertex coordinates directly.')
add('F11',C,'Quadratic minimum','A.5.e',r'Find the minimum value of \(y={a}(x-({h}))^2+({k})\).','k',V(a=(1,5),h=(-6,6),k=(-10,10)),explanation='A positive squared-term coefficient gives minimum k.')
add('F12',C,'Quadratic symmetry axis','A.5.e',r'Find the axis of symmetry of \(y={a}(x-({h}))^2+({k})\). Enter the x-value of the axis.','h',V(a=(1,5),h=(-6,6),k=(-10,10)),explanation='The symmetry axis passes through the vertex.')
add('F13',C,'Increasing interval of a quadratic','A.5.e',r'For \(y=(x-({h}))^2+{k}\), give the open interval where the function is increasing.','(h,infinity)',V(h=(-6,6),k=(-10,10)),mode='interval',answer_latex=r'({h},\infty)',explanation='The upward-opening parabola increases to the right of its vertex.')
add('F14',C,'Line through slope and point','A.6.a',r'Write an equation for the line with slope {m} through \(({a},{b})\).','y=m*(x-a)+b',V(m=(-6,6),a=(-6,6),b=(-10,10)),mode='equation',answer_latex=r'y={m}(x-({a}))+({b})',explanation='Use point-slope form; equivalent line equations are accepted.')
add('F15',C,'Line through two points','A.6.b',r'Write an equation for the line through \(({x0},{y0})\) and \(({u},{v})\).','y=((v-y0)/(u-x0))*(x-x0)+y0',V(x0=(-5,5),y0=(-10,10),dx=(1,6),m=(-5,5)),derived={'u':'x0+dx','v':'y0+m*dx'},mode='equation',answer_latex=r'y={m}(x-({x0}))+({y0})',explanation='Find the slope, then use point-slope form; symbols x0,y0 are stored point values.')
add('F16',C,'Parallel line slope','A.6.c',r'A line has slope {m}. Find the slope of any distinct parallel line.','m',V(m=(-8,8)),explanation='Nonvertical parallel lines have equal slopes.')
add('F17',C,'Perpendicular line slope','A.6.c',r'A line has nonzero slope {m}. Find the slope of a perpendicular line.','-1/m',V(m=(1,10)),explanation='Use the negative reciprocal.')
add('F18',C,'Compare proportional speeds','A.7.a',r'Car A travels {d} miles in {t} hours at constant speed. Car B obeys \(d_B={r}t_B\). Which car is faster: A, B, or equal?','compare(d/t,r)',V(d=(30,180),t=(1,4),r=(10,80)),mode='category',explanation='Compare A speed d/t with B slope r.')
add('F19',C,'Identify a function from a table','A.7.b',r'Does this table define y as a function of x? Answer yes or no. \(\begin{array}{c|ccc}x&{a}&{a}&{b}\\y&{u}&{v}&{w}\end{array}\)','no',V(a=(1,5),k=(1,5),u=(1,10),j=(1,5),w=(1,10)),derived={'b':'a+k','v':'u+j'},mode='category',explanation='The input a has two different outputs, u and v.')
add('F20',C,'Evaluate a linear function','A.7.c',r'If \(f(x)={a}x+({b})\), find \(f({v})\).','a*v+b',V(a=(-8,8),b=(-15,15),v=(-10,10)),explanation='Substitute v for x.')
add('F21',C,'Evaluate a quadratic function','A.7.c',r'If \(f(x)={a}x^2+({b})x+({c})\), find \(f({v})\).','a*v*v+b*v+c',V(a=(1,5),b=(-10,10),c=(-15,15),v=(-6,6)),explanation='Substitute the input and evaluate the polynomial.')
add('F22',C,'Compare rates from table and equation','A.7.d',r'Function A is \(y={r}x+{c}\). Function B has table \(\begin{array}{c|cc}x&0&{d}\\y&{u}&{v}\end{array}\). Which has the greater slope: A, B, or equal?','compare(r,(v-u)/d)',V(r=(-6,6),c=(-10,10),d=(1,5),u=(-10,10),m=(-6,6)),derived={'v':'u+m*d'},mode='category',explanation='Compare r with the table rate (v-u)/d.')

# Simplified rendered answers and explicit grading-domain metadata.
for t in BANK:
    modifications = {
        'E01': ({'coef':'a+b'}, r'{coef}x+({c})'),
        'E02': ({'coef':'a*b','constant':'a*c'}, r'{coef}x+{constant}'),
        'E05': ({'coef2':'a+d','coef1':'b+e','constant':'c+f'}, r'{coef2}x^2+{coef1}x+{constant}'),
        'E06': ({'coef2':'a-d','coef1':'b-e','constant':'c-f'}, r'({coef2})x^2+({coef1})x+({constant})'),
        'E07': ({'coef':'a+b','constant':'a*b'}, r'x^2+{coef}x+{constant}'),
        'E13': ({'coef':'a+b','constant':'a*b'}, r'x^2+{coef}x+{constant}'),
        'E14': ({'total':'a+b'}, r'\frac{{total}}{x},\quad x\ne0')
    }
    if t['id'] in modifications:
        d,a=modifications[t['id']]
        t['derived_variables'].update(d)
        t['answer_latex_template']=a
        if 'derived_variables' not in t['requires_engine_features']:
            t['requires_engine_features'].append('derived_variables')
    t['domain_restrictions']={
        'E08':['x != a'], 'E13':['x >= 0'], 'E14':['x != 0'],
        'E15':['x != 0'], 'E17':['t > 0'], 'L07':['a != 0'],
        'I06':['n is a nonnegative integer'], 'Q06':['x > 0']
    }.get(t['id'],[])
    t['grading_requirements']={
        'numeric':'Compare exact values; apply stated rounding only.',
        'expression':'Symbolic equivalence on the stated domain; respect the requested simplified/expanded form.',
        'factored_expression':'Symbolic equivalence plus completely factored integer structure.',
        'equation':'Equivalent relation on the stated domain, not just equivalent residual values.',
        'inequality':'Equivalent solution region, direction, strictness, and domain.',
        'ordered_list':'Compare sorted exact numeric values, allowing tied entries in either order.',
        'ordered_pair':'Compare coordinates in the specified order.',
        'coordinate_plot':'Compare the submitted point coordinates.',
        'solution_set':'Compare all distinct real solutions; ignore order.',
        'category':'Compare the specified category label; accept documented synonyms.',
        'number_line':'Check endpoint location, open/closed endpoint, and shading direction.',
        'line_graph':'Compare the line represented by two distinct points or its coefficients.',
        'interval':'Check both boundaries and endpoint inclusion.'
    }[t['answer_mode']]

# Required targets: every major content indicator from the educator guide.
TARGETS=[]
for prefix,counts in [('Q',[4,5,4,5,6,3,1,2]),('A',[10,4,4,2,5,3,4])]:
    for i,n in enumerate(counts,1):
        TARGETS.extend(f'{prefix}.{i}.{chr(97+j)}' for j in range(n))


def fmt(v, latex=False):
    if isinstance(v,bool):return 'true' if v else 'false'
    if isinstance(v,(list,tuple)):
        return '('+', '.join(fmt(x,latex) for x in v)+')'
    if isinstance(v,str):return v
    v=F(v)
    if v.denominator==1:return str(v.numerator)
    # Show terminating decimals exactly, otherwise a fraction.
    d=v.denominator
    for factor in [2,5]:
        while d%factor==0:d//=factor
    if d==1:
        with localcontext() as c:
            c.prec=80
            return format(Decimal(v.numerator)/Decimal(v.denominator),'f')
    return (r'\frac{'+str(v.numerator)+'}{'+str(v.denominator)+'}') if latex else f'{v.numerator}/{v.denominator}'

def substitute(text,env):
    return re.sub(r'\{([A-Za-z][A-Za-z0-9_]*)\}',lambda m:fmt(env[m[1]]) if m[1] in env else m[0],text)

def sample(t,rng):
    for _ in range(500):
        env={k:F(rng.randint(v['min'],v['max'])) for k,v in t['variables'].items()}
        for k,expr in t['derived_variables'].items():env[k]=calc(expr,env)
        if all(calc(c,env) for c in t['constraints']):return env
    raise ValueError('Unable to sample '+t['id'])

def expected(t,e):
    rule=t['answer_rule']; mode=t['answer_mode']
    if mode=='numeric':return calc(rule,e)
    if t['id']=='N13':return sorted([e['a']/e['b'],e['c']/e['d'],e['e']])
    if mode in ['ordered_pair','coordinate_plot']:return [e[x.strip()] for x in rule.strip('[]').split(',')]
    if mode=='solution_set':
        exprs=rule[len('set(['):-2].split(',')
        return sorted(set(calc(x,e) for x in exprs))
    if mode=='category':
        if rule in ['positive','no']:return rule
        args=rule[len('compare('):-1].split(',')
        a,b=(calc(v,e) for v in args)
        return 'A' if a>b else 'B' if a<b else 'equal'
    return substitute(t['answer_latex_template'],e)

def numeric_string(v):return {'numerator':str(v.numerator),'denominator':str(v.denominator)}

def example(t,e):
    answer=expected(t,e)
    raw=fmt(answer)
    out={'variables':{k:fmt(v) for k,v in e.items()},'question_latex':substitute(t['template_latex'],e),
         'answer':raw,'answer_latex':(substitute(t['answer_latex_template'],e) if t['answer_latex_template'] else fmt(answer,True))}
    if t['answer_mode']=='numeric':
        irrational=False
        for node in ast.walk(ast.parse(t['answer_rule'],mode='eval')):
            if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='sqrt':
                v=calc(ast.unparse(node.args[0]),e)
                if math.isqrt(v.numerator)**2!=v.numerator or math.isqrt(v.denominator)**2!=v.denominator:
                    irrational=True
        if irrational:
            out['exact_answer_expression']=t['answer_rule']
            out['evaluation_precision_digits']=50
            with localcontext() as c:
                c.prec=20
                approx=Decimal(answer.numerator)/Decimal(answer.denominator)
                out['answer']='approx. '+format(approx,'.12g')
        else:
            out['exact_answer']=numeric_string(answer)
        if t['accept_rounded_decimal']:
            with localcontext() as c:
                c.prec=80
                d=Decimal(answer.numerator)/Decimal(answer.denominator)
                out['rounded_answer']=str(d.quantize(Decimal(1).scaleb(-t['decimal_places']),rounding=ROUND_HALF_UP))
                out['answer_latex']=out['rounded_answer']
    if t['diagram']:
        out['diagram']=resolve_diagram(t['diagram'],e)
    return out

def resolve_diagram(d,e):
    if isinstance(d,dict):return {k:resolve_diagram(v,e) for k,v in d.items()}
    if isinstance(d,list):return [resolve_diagram(v,e) for v in d]
    if isinstance(d,str) and d in e:return float(e[d])
    return d

def tex_escape(s):
    return ''.join({'&':r'\&','%':r'\%','$':r'\$','#':r'\#','_':r'\_','{':r'\{','}':r'\}','~':r'\textasciitilde{}','^':r'\textasciicircum{}','\\':r'\textbackslash{}'}.get(c,c) for c in s)

def draw(d):
    kind=d['kind']
    if kind in ['bar','histogram']:
        vals=d['values']; labels=d['labels']; ymax=max(vals)+3
        gap='0' if kind=='histogram' else '0.3'
        bars=[]
        for i,(v,label) in enumerate(zip(vals,labels)):
            x=i*2+1; w=1.5 if kind=='histogram' else 1
            bars.append(rf'\draw[fill=blue!20] ({x},0) rectangle ({x+w},{v});\node[below] at ({x+w/2},0) {{{tex_escape(label)}}};\node[above] at ({x+w/2},{v}) {{{v:g}}};')
        return '\\begin{center}\\begin{tikzpicture}[x=0.65cm,y=0.17cm]\n'+rf'\draw[->] (0,0)--({len(vals)*2+2},0);\draw[->] (0,0)--(0,{ymax});'+'\n'+'\n'.join(bars)+'\n\\end{tikzpicture}\\end{center}'
    if kind=='box':
        lo,q1,med,q3,hi=d['values']
        return '\\begin{center}\\begin{tikzpicture}[x=0.15cm,y=0.5cm]\n'+rf'\draw ({lo},0)--({hi},0);\draw ({q1},-0.5) rectangle ({q3},0.5);\draw ({med},-0.5)--({med},0.5);\draw ({lo},-0.3)--({lo},0.3);\draw ({hi},-0.3)--({hi},0.3);'+'\n'+''.join(rf'\node[below] at ({v},-0.7) {{{v:g}}};' for v in [lo,q1,med,q3,hi])+'\n\\end{tikzpicture}\\end{center}'
    if kind=='scatter':
        pts=d['points']; xmax=max(p[0] for p in pts)+2; ymax=max(p[1] for p in pts)+3
        return '\\begin{center}\\begin{tikzpicture}[x=0.35cm,y=0.12cm]\n'+rf'\draw[->] (0,0)--({xmax},0) node[right] {{$x$}};\draw[->] (0,0)--(0,{ymax}) node[above] {{$y$}};'+'\n'+''.join(rf'\fill ({x},{y}) circle (3pt);\node[right] at ({x},{y}) {{$({x:g},{y:g})$}};' for x,y in pts)+'\n\\end{tikzpicture}\\end{center}'
    if kind=='line':
        m,b=d['m'],d['b']; lo,hi=d['x_min'],d['x_max']
        ymin=min(m*lo+b,m*hi+b,0)-1; ymax=max(m*lo+b,m*hi+b,0)+1
        return '\\begin{center}\\begin{tikzpicture}[x=0.5cm,y=0.17cm]\n'+rf'\draw[step=1,gray!20] ({lo},{ymin}) grid ({hi},{ymax});\draw[->] ({lo},0)--({hi+1},0) node[right] {{$x$}};\draw[->] (0,{ymin})--(0,{ymax+1}) node[above] {{$y$}};\draw[thick,blue] ({lo},{m*lo+b})--({hi},{m*hi+b});'+''.join(rf'\fill ({x},{m*x+b}) circle (2pt);\node[right] at ({x},{m*x+b}) {{$({x:g},{m*x+b:g})$}};' for x in [-2,2])+'\n\\end{tikzpicture}\\end{center}'
    return ''


def build():
    rng=random.Random(20261004)
    identities=0; total=0
    for t in BANK:
        for _ in range(30):
            e=sample(t,rng); ans=expected(t,e);total+=1
            if t['validation_identity']:
                assert calc(t['validation_identity'],dict(e,answer=ans)),t['id'];identities+=1
            if t['answer_mode']=='numeric':assert isinstance(ans,F),t['id']
        e=sample(t,rng);t['example']=example(t,e)
        if t['answer_mode']=='numeric':
            t['numeric_form_compatible']=not t['requires_engine_features']
        else:t['numeric_form_compatible']=False
    covered={x for t in BANK for x in t['ged_targets']}
    assert set(TARGETS)==covered,(set(TARGETS)-covered,covered-set(TARGETS))
    assert len({t['id'] for t in BANK})==len(BANK)
    payload={'schema_version':'1.0','title':'Original GED Math Template Bank',
        'scope':'Broad coverage of GED Mathematical Reasoning content indicators; not official exam items or an exhaustive collection of reasoning tasks.',
        'sources':['https://www.ged.com/content/dam/websites/ged/resources/en/assessment-guide-for-educators-math.pdf','https://www.ged.com/content/dam/websites/ged/post/math-formula-sheet.pdf'],
        'template_count':len(BANK),'templates':BANK}
    (ROOT/'ged-math-templates.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n')
    (ROOT/'ged-numeric-form-templates.json').write_text(json.dumps({'schema_version':'1.0','note':'Numeric templates without derived variables, constraints, diagrams or symbolic grading. Existing function support and an import adapter are still required.','templates':[t for t in BANK if t['numeric_form_compatible']]},indent=2,ensure_ascii=False)+'\n')
    lines=['# GED math template catalog','',f'{len(BANK)} original template families covering {len(TARGETS)} content indicators. Each includes a LaTeX question, answer rule, variable specification, explanation, and generated example.','',
           'These are original practice items, not official GED questions. This bank covers the listed skills but does not exhaust the possible contexts, reasoning tasks, or interactive exam formats.','',
           '## How to use','',
           '- Copy **Template** into the question field and **Answer formula** into the formula field for compatible numeric entries. Keep relative tolerance at 0; use rounded-decimal acceptance only where stated.',
           '- Inline `{name:min–max}` ranges are included for independent integer variables. Repeated placeholders reuse the same value.',
           '- JSON is a proposed interchange format, not a guaranteed one-click import for your existing application. It needs an adapter.',
           '- Derived variables must be calculated before rendering. Constraints require filtered sampling. Numeric formulas that reference derived variables cannot simply be pasted into the pictured integer-only form.',
           '- Expression, factoring, equation, inequality, solution-set, ordered-pair, graph and category answers require their listed grader/UI capabilities. Do not treat them as display-only questions.',
           '- Use the full JSON bank for the Spring Boot + Python math-service design. Use `ged-numeric-form-templates.json` for the simpler subset.',
           '- The LaTeX catalog shows a resolved example for every family; the JSON/Markdown retain the reusable placeholder syntax.',
           '- Keep correct answers and answer rules server-side during student attempts. Assign published practice sets through admin access controls.',
           '', '## Answer and generation conventions','',
           'Numeric answers use exact rational values where possible. Irrational square roots retain an exact expression and a 50-digit evaluation for the rounded example. Rounded answers use ROUND_HALF_UP. A numeric entry records both the exact result and a rounded sample where applicable. Circle/solid questions explicitly specify pi = 3.14.','',
           'Symbolic graders must check equivalence on the stated domain. Factoring graders must additionally require factored structure; graph graders must check the requested graph; solution-set graders ignore order and duplicate roots. For inequalities, check direction and endpoint inclusion. Budget answers also retain the integer/nonnegative domain.','',
           'A graph/diagram field is a rendering specification rather than an image. Render it when generating an item; freeze it with the item snapshot. The LaTeX catalog includes example input graphs for graph-reading items.','',
           'The symbolic rule in F15 uses x0/y0 for stored point coordinates, avoiding collisions with the answer variables x/y. Preserve that distinction in your grading adapter. `domain_restrictions` and `grading_requirements` define additional grading checks for each family.','',
           '## Sources','',
           '[GED assessment guide](https://www.ged.com/content/dam/websites/ged/resources/en/assessment-guide-for-educators-math.pdf) supplies the topic/indicator framework; [GED formula sheet](https://www.ged.com/content/dam/websites/ged/post/math-formula-sheet.pdf) is a reference for supplied formulas. The catalog questions and explanations are newly authored.','',
           '## Skill coverage','', '| Indicator | Template IDs |','|---|---|']
    for target in TARGETS:lines.append('| '+target+' | '+', '.join(t['id'] for t in BANK if target in t['ged_targets'])+' |')
    category=None
    for t in BANK:
        if t['category']!=category:category=t['category'];lines+=['','## '+category,'']
        lines+=['','### '+t['id']+' — '+t['label'],'', '**Targets:** '+', '.join(t['ged_targets'])+'  ', '**Answer mode:** '+t['answer_mode']+'  ', '**Required extensions:** '+(', '.join(t['requires_engine_features']) or 'None beyond listed formula functions'),'', '**Template:**','```text',t['template'],'```','', '**Answer formula/rule:**','```text',t['answer_rule'],'```','', '**Variables:** `'+json.dumps(t['variables'])+'`']
        if t['derived_variables']:lines+=['','**Derived variables, in order:** `'+json.dumps(t['derived_variables'])+'`']
        if t['constraints']:lines+=['','**Constraints:** `'+', '.join(t['constraints'])+'`']
        lines+=['','**Explanation:** '+t['explanation'],'','**Example question:** '+t['example']['question_latex'],'','**Example answer:** '+t['example']['answer']]
        if t['accept_rounded_decimal']:lines+=['','**Accepted rounded example:** '+t['example']['rounded_answer']+' (exact answers are also accepted).']
        if t['diagram']:lines+=['','**Example diagram specification:**','```json',json.dumps(t['example']['diagram'],indent=2),'```']
    (ROOT/'ged-math-templates.md').write_text('\n'.join(lines)+'\n')
    # Standalone LaTeX: resolved example questions are actual valid LaTeX.
    tex=[r'\documentclass[11pt]{article}',r'\usepackage[margin=0.8in]{geometry}',r'\usepackage{amsmath,amssymb}',r'\usepackage{tikz}',r'\usepackage{hyperref}',r'\usepackage{enumitem}',r'\setlength{\parindent}{0pt}',r'\setlength{\parskip}{6pt}',r'\hypersetup{colorlinks=true,urlcolor=blue,linkcolor=black}',r'\begin{document}',r'\title{GED Math Template Bank\\\large Questions, Answer Rules, and Examples}',r'\author{Math Tutor Website}',r'\date{October 4, 2026}',r'\maketitle',f'{len(BANK)} original template families, mapped to {len(TARGETS)} content indicators. This is a practice bank, not an official GED publication or a guarantee of exhaustive exam coverage.',
         'Reusable LaTeX strings, variable ranges, and machine-readable answer rules are in the accompanying JSON and Markdown files. This document includes reusable template source and one rendered example per family. Numeric-form compatibility depends on the listed engine features.',
         r'\textbf{Grading:} Exact rational arithmetic by default. Rounding is accepted only when the question requests it, using ROUND\_HALF\_UP. For circle and solid questions, use the stated value $\pi=3.14$. Symbolic answers require domain-aware equivalence checks; factoring also requires factored structure.',
         r'\textbf{Access:} Students must log in and receive an administrator assignment for each practice set. Freeze generated questions and answers per attempt; preserve all attempt results.',
         r'\textbf{Sources:} \href{https://www.ged.com/content/dam/websites/ged/resources/en/assessment-guide-for-educators-math.pdf}{GED assessment guide}; \href{https://www.ged.com/content/dam/websites/ged/post/math-formula-sheet.pdf}{GED formula sheet}. Questions and explanations in this bank are newly authored.',r'\tableofcontents',r'\newpage']
    category=None
    for t in BANK:
        if t['category']!=category:
            category=t['category'];tex += [r'\section{'+tex_escape(category)+'}']
        tex += [r'\subsection{'+tex_escape(t['id']+' — '+t['label']).replace('—','--')+'}',r'\textbf{Targets:} '+tex_escape(', '.join(t['ged_targets']))+r'\quad\textbf{Mode:} '+tex_escape(t['answer_mode']),r'\textbf{Question:} '+t['example']['question_latex']]
        if t['diagram']:tex += [draw(t['example']['diagram'])]
        answer=t['example']['answer_latex']
        if t['answer_mode']=='category':answer=r'\text{'+tex_escape(answer)+'}'
        if t['answer_mode']=='solution_set':
            vals=expected(t,{k:F(v) for k,v in t['example']['variables'].items()});answer=r'\left\{'+', '.join(fmt(v,True) for v in vals)+r'\right\}'
        tex += [r'\textbf{Answer:} \('+answer+r'\)',r'\textbf{Method:} '+tex_escape(t['explanation']),r'\textbf{Reusable LaTeX template:}',r'\begin{verbatim}',*textwrap.wrap(t['template'],width=88,break_long_words=False,break_on_hyphens=False),r'\end{verbatim}',r'\textbf{Answer formula/rule:}',r'\begin{verbatim}',*textwrap.wrap(t['answer_rule'],width=88,break_long_words=False,break_on_hyphens=False),r'\end{verbatim}',r'\textbf{Generation ranges:} '+tex_escape('; '.join(k+': '+str(v['min'])+' to '+str(v['max']) for k,v in t['variables'].items()) or 'Symbolic coefficients; no sampled variables.')]
        if t['derived_variables']:tex += [r'\textbf{Derived variables:} '+tex_escape('; '.join(k+' = '+v for k,v in t['derived_variables'].items()))]
        if t['constraints']:tex += [r'\textbf{Constraints:} '+tex_escape('; '.join(t['constraints']))]
        if t['requires_engine_features']:tex += [r'\textbf{Required extensions:} '+tex_escape(', '.join(t['requires_engine_features']))]
        tex += [r'\medskip\hrule\medskip']
    tex += [r'\end{document}']
    (ROOT/'ged-math-catalog.tex').write_text('\n'.join(tex)+'\n')
    report={'templates':len(BANK),'numeric':sum(t['answer_mode']=='numeric' for t in BANK),
       'numeric_form_subset':sum(t['numeric_form_compatible'] for t in BANK),
       'content_indicators':len(TARGETS),'sample_evaluations':total,'equation_identity_checks':identities,
       'verification':'30 sampled evaluations per template; numeric formula/domain checks and selected independent equation residual checks. Symbolic grading and rendering need implementation and further validation.'}
    (ROOT/'validation-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__':build()
