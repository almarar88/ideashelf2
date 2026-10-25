#!/usr/bin/env python3
"""
يولّد علامة «عون» من ملفّ الخطّ مباشرة.

العلامة ليست رسمًا يدويًا بل حرف العين من IBM Plex Sans Arabic Bold — خطّ
التطبيق نفسه. فإن تغيّر الخطّ أو وزنه أُعيد توليد كل شيء بأمرٍ واحد، ولا
تنفصل العلامة عن النصّ حولها.

    pip install fonttools uharfbuzz
    python3 scripts/brand.py

يكتب: brand/*.svg، أيقونة أندرويد التكيّفية. أمّا PNG لويندوز فيُرسَّم من
brand/awn-icon.svg (أيّ مُحوِّل SVG→PNG يفي، والمستودع يستعمل Chromium).
"""
import math
import pathlib

import uharfbuzz as hb
from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = ROOT / "daily-companion/app/src/main/res/font/plex_arabic_bold.ttf"
OUT = ROOT / "brand"
ANDROID = ROOT / "daily-companion/app/src/main/res/drawable"

ACCENT = "#0A6CFF"
ACCENT_TOP = "#3E8CFF"
ACCENT_BOT = "#0A52D6"


def outline(text: str):
    """يُشكّل النصّ بـ HarfBuzz ثم يعيد مساره كـ SVG، مقلوبَ المحور الرأسي."""
    blob = hb.Blob.from_file_path(str(FONT))
    face = hb.Face(blob)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb.Font(face), buf, {})
    runs = list(zip(buf.glyph_infos, buf.glyph_positions))

    tt = TTFont(str(FONT))
    glyphs, order = tt.getGlyphSet(), tt.getGlyphOrder()

    def draw(pen):
        x = 0.0
        for info, pos in runs:
            t = Transform(1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)
            glyphs[order[info.codepoint]].draw(TransformPen(pen, t))
            x += pos.x_advance

    path = SVGPathPen(glyphs, ntos=lambda v: f"{v:.1f}")
    draw(path)
    bounds = BoundsPen(glyphs)
    draw(bounds)
    return path.getCommands(), bounds.bounds


def superellipse(size: float, n: float = 4.6, segs: int = 28) -> str:
    """
    حافّة الأيقونة.

    مستطيلٌ مُدوَّر الزوايا ينتقل من مستقيمٍ إلى قوسٍ فجأةً، فتُرى الزاوية
    نقطةَ انكسار. القطع الناقص الفائق يُغيّر انحناءه تدريجيًا — وهو الفرق
    بين حافّةٍ مرسومة وحافّةٍ مقتطعة. n≈4.6 قريبٌ من أيقونات iOS.
    """
    r = size / 2
    pts = []
    for i in range(segs):
        th = 2 * math.pi * i / segs
        c, s = math.cos(th), math.sin(th)
        pts.append((
            r + r * math.copysign(abs(c) ** (2 / n), c),
            r + r * math.copysign(abs(s) ** (2 / n), s),
        ))
    # مماسّات بفروق مركزية ثم مكعّبات هيرميت — أدقّ من تقريب الأقواس بقوسين
    d = [f"M{pts[0][0]:.2f} {pts[0][1]:.2f}"]
    for i in range(segs):
        p0, p1 = pts[i], pts[(i + 1) % segs]
        pm1, p2 = pts[(i - 1) % segs], pts[(i + 2) % segs]
        t0 = ((p1[0] - pm1[0]) / 2, (p1[1] - pm1[1]) / 2)
        t1 = ((p2[0] - p0[0]) / 2, (p2[1] - p0[1]) / 2)
        d.append(
            f"C{p0[0] + t0[0] / 3:.2f} {p0[1] + t0[1] / 3:.2f} "
            f"{p1[0] - t1[0] / 3:.2f} {p1[1] - t1[1] / 3:.2f} {p1[0]:.2f} {p1[1]:.2f}"
        )
    return " ".join(d) + "Z"


def fit(bounds, size: float, box: float, dy: float = 0.0) -> str:
    x0, y0, x1, y1 = bounds
    w, h = x1 - x0, y1 - y0
    s = (size * box) / max(w, h)
    return (f"translate({(size - w * s) / 2 - x0 * s:.2f} "
            f"{(size - h * s) / 2 - y0 * s + dy * size:.2f}) scale({s:.5f})")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    ayn, ayn_box = outline("ع")
    word, word_box = outline("عون")

    # ── الأيقونة ───────────────────────────────────────────────────────
    size = 1024
    # الحرف يميل بصريًا إلى أعلى لأن ذيله ينزل تحت السطر، فيُنزَل قليلًا.
    icon = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">\n'
        f'  <title>عون</title>\n'
        f'  <defs>\n'
        f'    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">\n'
        f'      <stop offset="0" stop-color="{ACCENT_TOP}"/>\n'
        f'      <stop offset="1" stop-color="{ACCENT_BOT}"/>\n'
        f'    </linearGradient>\n'
        f'  </defs>\n'
        f'  <path d="{superellipse(size)}" fill="url(#g)"/>\n'
        f'  <g transform="{fit(ayn_box, size, 0.58, dy=0.012)}">'
        f'<path d="{ayn}" fill="#FFFFFF"/></g>\n'
        f'</svg>\n'
    )
    (OUT / "awn-icon.svg").write_text(icon, encoding="utf-8")
    (OUT / "awn-icon-flat.svg").write_text(
        icon.replace('fill="url(#g)"', f'fill="{ACCENT}"'), encoding="utf-8")

    # ── الحرف وحده، بلون النصّ المحيط ──────────────────────────────────
    (OUT / "awn-mark.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n'
        '  <title>عون</title>\n'
        f'  <g transform="{fit(ayn_box, 100, 0.92)}">'
        f'<path d="{ayn}" fill="currentColor"/></g>\n'
        '</svg>\n', encoding="utf-8")

    # ── كلمة «عون» ─────────────────────────────────────────────────────
    x0, y0, x1, y1 = word_box
    s = 100 / (y1 - y0)
    (OUT / "awn-wordmark.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {(x1 - x0) * s:.1f} 100">\n'
        '  <title>عون</title>\n'
        f'  <g transform="translate({-x0 * s:.2f} {-y0 * s:.2f}) scale({s:.5f})">'
        f'<path d="{word}" fill="currentColor"/></g>\n'
        '</svg>\n', encoding="utf-8")

    # ── أيقونة أندرويد التكيّفية ───────────────────────────────────────
    # 108dp فيها دائرة آمنة قطرها 66dp. ارتفاع 52dp يُبقي قُطر المحتوى 63dp،
    # فلا يقصّ أيّ قناع مشغّل الحرف مهما كان شكله.
    bx0, by0, bx1, by1 = ayn_box
    gw, gh = bx1 - bx0, by1 - by0
    k = 52.0 / gh
    tx = 54 - (gw * k) / 2 - bx0 * k
    ty = 54 - (gh * k) / 2 - by0 * k + 0.6  # إنزال بصري: كتلة الحرف في أعلاه
    (ANDROID / "ic_launcher_foreground.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!-- مولَّد من scripts/brand.py — حرف العين من خطّ التطبيق نفسه. -->\n'
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '    android:width="108dp" android:height="108dp"\n'
        '    android:viewportWidth="108" android:viewportHeight="108">\n'
        f'    <group android:translateX="{tx:.3f}" android:translateY="{ty:.3f}"\n'
        f'           android:scaleX="{k:.6f}" android:scaleY="{k:.6f}">\n'
        f'        <path android:fillColor="#FFFFFFFF" android:pathData="{ayn}" />\n'
        '    </group>\n'
        '</vector>\n', encoding="utf-8")

    (ANDROID / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!-- مولَّد من scripts/brand.py — درجةٌ واحدة من الأزرق: الأيقونة تُرى\n'
        '     بحجم ظفر، والتدرّج متعدّد الألوان يتحوّل عندها إلى لطخة. -->\n'
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '    xmlns:aapt="http://schemas.android.com/aapt"\n'
        '    android:width="108dp" android:height="108dp"\n'
        '    android:viewportWidth="108" android:viewportHeight="108">\n'
        '    <path android:pathData="M0,0h108v108h-108z">\n'
        '        <aapt:attr name="android:fillColor">\n'
        '            <gradient android:type="linear"\n'
        '                android:startX="54" android:startY="0"\n'
        '                android:endX="54" android:endY="108">\n'
        f'                <item android:offset="0.0" android:color="#FF{ACCENT_TOP[1:]}" />\n'
        f'                <item android:offset="1.0" android:color="#FF{ACCENT_BOT[1:]}" />\n'
        '            </gradient>\n'
        '        </aapt:attr>\n'
        '    </path>\n'
        '</vector>\n', encoding="utf-8")

    print("brand/ و drawable/ مُحدَّثان")


if __name__ == "__main__":
    main()
