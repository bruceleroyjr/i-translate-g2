"""i-translate store icon candidates: 12x12 designs -> 24x24 PNGs (#F4F4F4 on transparent, 2x2 blocks) + previews,
checked with the Even Hub CLI's own rules (README 'Icon rules')."""
import pathlib
from PIL import Image

OUT = pathlib.Path(__file__).parent / "icons"
OUT.mkdir(exist_ok=True)
LIT = (0xF4, 0xF4, 0xF4, 255)

DESIGNS = {
    # A: two solid speech bubbles, A and 가 cut out (old store icon, store/icon.png)
    # B1: solid pop-up bubble, speaker + one sound wave cut out
    "B1-bubble-speaker": """
.##########.
#####.######
####..##.###
##....###.##
##....###.##
####..##.###
#####.######
.##########.
..###.......
..##........
..#.........
............""",
    # B2: pop-up message ("...") top-left, speaker with waves bottom-right
    "B2-popup-and-speaker": """
.#######....
#########...
#.##.##.#...
#########...
.#######....
..##........
..#.........
........#.#.
......###..#
......###..#
........#.#.
............""",
    # B3: solid bubble, speaker + two sound waves cut out
    "B3-bubble-two-waves": """
.##########.
####.###.###
###..#.##.##
#....##.##.#
#....##.##.#
###..#.##.##
####.###.###
.##########.
..###.......
..##........
..#.........
............""",
}


def grid(text):
    rows = [r for r in text.strip("\n").split("\n")]
    assert len(rows) == 12 and all(len(r) == 12 for r in rows), [len(r) for r in rows]
    return rows


def png(rows, path):
    im = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c == "#":
                for dy in (0, 1):
                    for dx in (0, 1):
                        im.putpixel((2 * x + dx, 2 * y + dy), LIT)
    im.save(path)
    return im


def check(path):
    """The CLI's rules: 24x24, each pixel transparent or opaque F4F4F4, lit pixels consumed as raster-aligned 2x2 blocks."""
    im = Image.open(path).convert("RGBA")
    if im.size != (24, 24):
        return f"size {im.size}"
    lit = [[False] * 24 for _ in range(24)]
    for y in range(24):
        for x in range(24):
            p = im.getpixel((x, y))
            if p[3] == 0:
                continue
            if p != LIT:
                return f"bad colour {p} at {x},{y}"
            lit[y][x] = True
    used = [[False] * 24 for _ in range(24)]
    for y in range(24):
        for x in range(24):
            if lit[y][x] and not used[y][x]:
                if x == 23 or y == 23 or not (lit[y][x + 1] and lit[y + 1][x] and lit[y + 1][x + 1]):
                    return f"not a 2x2 block at {x},{y}"
                for dy in (0, 1):
                    for dx in (0, 1):
                        used[y + dy][x + dx] = True
    return "ok"


previews = []
for name, text in DESIGNS.items():
    rows = grid(text)
    path = OUT / f"icon-{name}.png"
    im = png(rows, path)
    print(name, check(path), path)
    # preview: 10x on dark and on light, plus actual size
    big = im.resize((240, 240), Image.NEAREST)
    tile = Image.new("RGBA", (520, 260), (20, 22, 26, 255))
    tile.alpha_composite(big, (10, 10))
    light = Image.new("RGBA", (240, 240), (60, 64, 70, 255))
    light.alpha_composite(big)
    tile.alpha_composite(light, (270, 10))
    previews.append(tile)
sheet = Image.new("RGBA", (520, 260 * len(previews)), (20, 22, 26, 255))
for i, t in enumerate(previews):
    sheet.alpha_composite(t, (0, 260 * i))
sheet.save(OUT / "sheet.png")
