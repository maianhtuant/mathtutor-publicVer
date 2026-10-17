"""Figures: a labelled shape drawn for each generated question, as a standalone SVG.

    "figure": {"shape": "rectangle",
               "labels": {"width": "{l} cm", "height": "{w} cm"},
               "size": {"width": "l", "height": "w"}}

Labels use the question's values ({l} -> 12). "size" is optional: formulas whose values set the drawn proportions
(clamped so a shape never gets too thin); without it the shape uses a fixed, typical outline. The SVG is only ever
shown through an <img>, and every label is XML-escaped.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from xml.sax.saxutils import escape

from . import formula as fx

# shape -> (label slots, size keys)
SHAPES = {
    "rectangle": ({"width", "height", "top", "left", "inside"}, ("width", "height")),
    "square": ({"side", "inside"}, ()),
    # apex: where the top corner sits above the base, 0 (over the left end) to 1 (over the right end).
    "triangle": ({"base", "left", "right", "height", "inside"}, ("base", "height", "apex")),
    "right_triangle": ({"base", "height", "hypotenuse", "inside"}, ("base", "height")),
    "circle": ({"radius", "diameter", "inside"}, ()),
    "trapezoid": ({"top", "bottom", "height", "left", "right", "inside"}, ("top", "bottom", "height")),
    # a / b: the horizontal and vertical semi-axes, drawn from the centre.
    "ellipse": ({"a", "b", "inside"}, ("a", "b")),
}
DEFAULT_SIZE = {
    "rectangle": {"width": 5, "height": 3},
    "triangle": {"base": 6, "height": 4, "apex": 0.38},
    "right_triangle": {"base": 5, "height": 3.5},
    "trapezoid": {"top": 3, "bottom": 6, "height": 3},
    "ellipse": {"a": 5, "b": 3},
}
MAX_LABEL = 40
# Wide side margins leave room for labels such as "w = 14.5 cm" beside a vertical edge.
W, H, PAD_X, PAD_Y = 440, 250, 105, 42
INK, FILL, MUTED, BG = "#1f2937", "#e8eefc", "#6b7280", "#ffffff"
PLACEHOLDER = re.compile(r"\{\{?([A-Za-z_][A-Za-z0-9_]*)\}?\}")


@dataclass
class Figure:
    shape: str
    labels: dict
    size: dict = field(default_factory=dict)  # size key -> Formula

    @property
    def names(self) -> set:
        out = {m.group(1) for text in self.labels.values() for m in PLACEHOLDER.finditer(text)}
        return out | {n for f in self.size.values() for n in f.names}


def compile_figure(spec, error) -> Figure | None:
    """Checks a figure spec; `error(code, message)` returns the exception to raise."""
    if spec is None or spec == {}:
        return None
    if not isinstance(spec, dict):
        raise error("invalid_figure", "figure must be an object")
    unknown = set(spec) - {"shape", "labels", "size"}
    if unknown:
        raise error("invalid_figure", f"figure has unknown keys: {sorted(unknown)}")
    shape = spec.get("shape")
    if shape not in SHAPES:
        raise error("invalid_figure", f"figure shape must be one of: {', '.join(SHAPES)}")
    slots, size_keys = SHAPES[shape]
    labels = spec.get("labels") or {}
    if not isinstance(labels, dict):
        raise error("invalid_figure", "figure labels must be an object")
    bad = set(labels) - slots
    if bad:
        raise error("invalid_figure", f"{shape} labels can be: {', '.join(sorted(slots))} (not {', '.join(sorted(bad))})")
    for k, v in labels.items():
        if not isinstance(v, (str, int, float)) or len(str(v)) > MAX_LABEL:
            raise error("invalid_figure", f"figure label '{k}' must be text of at most {MAX_LABEL} characters")
    if shape == "circle" and {"radius", "diameter"} <= set(labels):
        raise error("invalid_figure", "a circle shows either a radius or a diameter label, not both")
    size_raw = spec.get("size") or {}
    if not isinstance(size_raw, dict) or set(size_raw) - set(size_keys):
        raise error("invalid_figure", f"{shape} size can only set: {', '.join(size_keys) or 'nothing'}")
    try:
        size = {k: fx.parse(str(v), kind=f"figure size '{k}'") for k, v in size_raw.items()}
    except fx.FormulaError as exc:
        raise error("invalid_figure", str(exc)) from exc
    return Figure(shape, {k: str(v) for k, v in labels.items()}, size)


def render(fig: Figure, values: dict, display: dict) -> str:
    labels = {k: PLACEHOLDER.sub(lambda m: display.get(m.group(1), m.group(0)), v) for k, v in fig.labels.items()}
    dims = dict(DEFAULT_SIZE.get(fig.shape, {}))
    for k, f in fig.size.items():
        try:
            v = float(f.evaluate(values))
        except Exception:  # an odd value only changes the drawing's proportions, never the question
            continue
        if math.isfinite(v) and v > 0:
            dims[k] = v
    parts = DRAW[fig.shape](dims, labels)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
            f'font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="15">'
            f'<rect width="{W}" height="{H}" rx="10" fill="{BG}"/>' + "".join(parts) + "</svg>")


# ---- drawing helpers -------------------------------------------------------------------------------------------

def _fit(w: float, h: float, labels: dict | None = None, max_ratio: float = 3.0, room: float = 1.0):
    """Scale a w x h box (aspect ratio clamped) to fit the canvas; returns pixel width, height and the top-left.
    A tall, thin shape is widened so its "inside" label fits; `room` is the share of the width the label can use."""
    ratio = min(max(w / h, 1 / max_ratio), max_ratio)
    bw, bh = W - 2 * PAD_X, H - 2 * PAD_Y
    pw, ph = (bw, bw / ratio) if bw / ratio <= bh else (bh * ratio, bh)
    need = (len(labels["inside"]) * 8 + 24) / room if labels and labels.get("inside") else 0
    if pw < need:
        pw = min(need, bw)
    return pw, ph, (W - pw) / 2, (H - ph) / 2


def _poly(points) -> str:
    pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    return f'<polygon points="{pts}" fill="{FILL}" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round"/>'


def _text(x, y, s, anchor="middle", color=INK, weight="600", size=15) -> str:
    # A white outline keeps a label readable where it crosses an edge (e.g. a long label in a narrow shape).
    return (f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" dominant-baseline="central" fill="{color}" '
            f'font-weight="{weight}" font-size="{size}" stroke="{BG}" stroke-width="4" stroke-linejoin="round" '
            f'paint-order="stroke">{escape(s)}</text>')


def _edge_label(p, q, centre, s) -> str:
    """Label beside the edge p-q, on the side away from the shape's centre."""
    mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
    dx, dy = q[0] - p[0], q[1] - p[1]
    length = math.hypot(dx, dy) or 1
    nx, ny = -dy / length, dx / length
    if (mx - centre[0]) * nx + (my - centre[1]) * ny < 0:
        nx, ny = -nx, -ny
    anchor = "start" if nx > 0.35 else "end" if nx < -0.35 else "middle"
    return _text(mx + nx * 14, my + ny * 16, s, anchor)


def _dashed(p, q) -> str:
    return (f'<line x1="{p[0]:.1f}" y1="{p[1]:.1f}" x2="{q[0]:.1f}" y2="{q[1]:.1f}" stroke="{MUTED}" '
            f'stroke-width="1.8" stroke-dasharray="6 5"/>')


def _right_angle(corner, a, b, size=12) -> str:
    """Small square marking the right angle at `corner` between the directions to a and b."""
    def unit(p):
        dx, dy = p[0] - corner[0], p[1] - corner[1]
        d = math.hypot(dx, dy) or 1
        return dx / d * size, dy / d * size
    (ux, uy), (vx, vy) = unit(a), unit(b)
    pts = [(corner[0] + ux, corner[1] + uy), (corner[0] + ux + vx, corner[1] + uy + vy), (corner[0] + vx, corner[1] + vy)]
    return (f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="none" stroke="{INK}" '
            f'stroke-width="1.5"/>')


def _centre(points):
    return sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points)


def _inside(points, labels) -> list:
    if "inside" not in labels:
        return []
    cx, cy = _centre(points)
    return [_text(cx, cy, labels["inside"], weight="500", size=14)]


# ---- shapes ---------------------------------------------------------------------------------------------------

def _rectangle(d, labels):
    pw, ph, x, y = _fit(d["width"], d["height"], labels)
    tl, tr, br, bl = (x, y), (x + pw, y), (x + pw, y + ph), (x, y + ph)
    pts = [tl, tr, br, bl]
    c = _centre(pts)
    out = [_poly(pts)]
    for slot, (p, q) in {"width": (bl, br), "height": (tr, br), "top": (tl, tr), "left": (tl, bl)}.items():
        if slot in labels:
            out.append(_edge_label(p, q, c, labels[slot]))
    return out + _inside(pts, labels)


def _square(d, labels):
    out = _rectangle({"width": 1, "height": 1}, {"width": labels["side"]} if "side" in labels else {})
    if "inside" in labels:
        out.append(_text(W / 2, H / 2, labels["inside"], weight="500", size=14))
    return out


def _triangle(d, labels):
    # With a height line, the inside label sits between that line and the right side, where it has ~40% of the base.
    pw, ph, x, y = _fit(d["base"], d["height"], labels, room=0.4 if "height" in labels else 0.6)
    t = min(max(d["apex"], 0.1), 0.9)
    a, b, apex = (x, y + ph), (x + pw, y + ph), (x + pw * t, y)
    pts = [a, b, apex]
    c = _centre(pts)
    out = [_poly(pts)]
    if "height" in labels:
        foot = (apex[0], a[1])
        # Low down, on the wider side of the height line, where the triangle has room for the label.
        right = t <= 0.5
        out += [_dashed(apex, foot), _right_angle(foot, apex, b if right else a, 10),
                _text(apex[0] + (7 if right else -7), apex[1] + ph * 0.8, labels["height"], "start" if right else "end")]
    for slot, (p, q) in {"base": (a, b), "left": (a, apex), "right": (apex, b)}.items():
        if slot in labels:
            out.append(_edge_label(p, q, c, labels[slot]))
    if "inside" in labels and "height" in labels:
        # Opposite the height label: above it, on the same wide side.
        ly = y + ph * 0.45
        far = b[0] if t <= 0.5 else a[0]
        return out + [_text(apex[0] + (far - apex[0]) * 0.3, ly, labels["inside"], weight="500", size=14)]
    return out + _inside(pts, labels)


def _right_triangle(d, labels):
    pw, ph, x, y = _fit(d["base"], d["height"], labels, room=0.6)
    corner, b, top = (x, y + ph), (x + pw, y + ph), (x, y)
    pts = [corner, b, top]
    c = _centre(pts)
    out = [_poly(pts), _right_angle(corner, b, top)]
    for slot, (p, q) in {"base": (corner, b), "height": (top, corner), "hypotenuse": (top, b)}.items():
        if slot in labels:
            out.append(_edge_label(p, q, c, labels[slot]))
    return out + _inside(pts, labels)


def _circle(d, labels):
    cx, cy, r = W / 2, H / 2, H / 2 - PAD_Y + 8
    out = [f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{FILL}" stroke="{INK}" stroke-width="2.5"/>',
           f'<circle cx="{cx}" cy="{cy}" r="3" fill="{INK}"/>']
    if "radius" in labels:
        out += [f'<line x1="{cx}" y1="{cy}" x2="{cx + r}" y2="{cy}" stroke="{INK}" stroke-width="2"/>',
                _text(cx + r / 2, cy - 13, labels["radius"])]
    if "diameter" in labels:
        out += [f'<line x1="{cx - r}" y1="{cy}" x2="{cx + r}" y2="{cy}" stroke="{INK}" stroke-width="2"/>',
                _text(cx, cy - 13, labels["diameter"])]
    if "inside" in labels:
        out.append(_text(cx, cy + r / 2, labels["inside"], weight="500", size=14))
    return out


def _trapezoid(d, labels):
    top, bottom = d["top"], d["bottom"]
    if not 0.2 <= top / bottom <= 5:
        top = bottom * (0.2 if top < bottom else 5)
    pw, ph, x, y = _fit(max(top, bottom), d["height"], labels)
    tw, bw = pw * top / max(top, bottom), pw * bottom / max(top, bottom)
    bl, br = (x + (pw - bw) / 2, y + ph), (x + (pw + bw) / 2, y + ph)
    tl, tr = (x + (pw - tw) / 2, y), (x + (pw + tw) / 2, y)
    pts = [bl, br, tr, tl]
    c = _centre(pts)
    out = [_poly(pts)]
    if "height" in labels:
        hx = (tl[0] + tr[0]) / 2 if abs(tw - bw) < 1 else tl[0] if bw > tw else bl[0]
        foot, head = (hx, bl[1]), (hx, tl[1])
        out += [_dashed(head, foot), _right_angle(foot, head, br, 10),
                _text(hx + 7, (head[1] + foot[1]) / 2, labels["height"], "start")]
    for slot, (p, q) in {"top": (tl, tr), "bottom": (bl, br), "left": (bl, tl), "right": (br, tr)}.items():
        if slot in labels:
            out.append(_edge_label(p, q, c, labels[slot]))
    return out + _inside(pts, labels)


def _ellipse(d, labels):
    pw, ph, x, y = _fit(d["a"], d["b"], labels, max_ratio=2.5)
    cx, cy, rx, ry = W / 2, H / 2, pw / 2, ph / 2
    out = [f'<ellipse cx="{cx}" cy="{cy}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{FILL}" stroke="{INK}" stroke-width="2.5"/>',
           f'<circle cx="{cx}" cy="{cy}" r="3" fill="{INK}"/>']
    if "a" in labels:
        out += [f'<line x1="{cx}" y1="{cy}" x2="{cx + rx:.1f}" y2="{cy}" stroke="{INK}" stroke-width="2"/>',
                _text(cx + rx / 2, cy + 14, labels["a"])]
    if "b" in labels:
        out += [f'<line x1="{cx}" y1="{cy}" x2="{cx}" y2="{cy - ry:.1f}" stroke="{INK}" stroke-width="2"/>',
                _text(cx + 7, cy - ry / 2, labels["b"], "start")]
    if "inside" in labels:
        out.append(_text(cx, cy + ry / 2, labels["inside"], weight="500", size=14))
    return out


DRAW = {"rectangle": _rectangle, "square": _square, "triangle": _triangle, "right_triangle": _right_triangle,
        "circle": _circle, "trapezoid": _trapezoid, "ellipse": _ellipse}
