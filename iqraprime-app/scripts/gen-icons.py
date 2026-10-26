#!/usr/bin/env python3
"""Generate IQRAPRIME PWA icons from the official logo."""
from PIL import Image, ImageDraw, ImageOps
import os

LOGO = "/home/z/my-project/upload/IQRA prime logo.png"
OUT = "/home/z/my-project/iqraprime-app/public/icons"
os.makedirs(OUT, exist_ok=True)

GOLD = (255, 189, 36)
DARK = (8, 11, 18)

src = Image.open(LOGO).convert("RGBA")

# The logo is 1536x1024 with the wordmark somewhere in the frame.
# Trim transparent/flat margins by finding bounding box of non-background pixels.
gray = ImageOps.grayscale(src)
# Background is near-black; find pixels brighter than threshold
bw = gray.point(lambda p: 255 if p > 40 else 0)
bbox = bw.getbbox()
print("content bbox:", bbox)
if bbox:
    pad = 24
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(src.width, r + pad); b = min(src.height, b + pad)
    crop = src.crop((l, t, r, b))
else:
    crop = src

# Fit the (wide) wordmark into a square canvas centered
def square_image(img, size, bg=(5, 7, 11, 255), scale=0.78):
    canvas = Image.new("RGBA", (size, size), bg)
    ratio = min(size * scale / img.width, size * scale / img.height)
    w, h = int(img.width * ratio), int(img.height * ratio)
    im2 = img.resize((w, h), Image.LANCZOS)
    canvas.paste(im2, ((size - w) // 2, (size - h) // 2), im2)
    return canvas

def rounded(img, radius_ratio=0.22):
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out

# Standard icons: dark bg + gold border ring
def make_icon(size):
    base = square_image(crop, size, bg=DARK, scale=0.74)
    d = ImageDraw.Draw(base)
    m = max(2, size // 42)
    d.rounded_rectangle([m, m, size - m - 1, size - m - 1], radius=int(size * 0.20), outline=GOLD, width=m)
    return rounded(base, 0.2)

for s in (192, 512):
    make_icon(s).convert("RGB").save(f"{OUT}/icon-{s}.png")
    print("icon", s)

# Maskable: safe zone = content within 80% center; bigger padding
for s in (192, 512):
    m = square_image(crop, s, bg=DARK, scale=0.56)
    d = ImageDraw.Draw(m)
    d.rectangle([0, 0, s - 1, s - 1], fill=None, outline=None)
    m.convert("RGB").save(f"{OUT}/maskable-{s}.png")
    print("maskable", s)

# Apple touch icon 180
make_icon(180).convert("RGB").save(f"{OUT}/apple-touch-icon.png")
print("apple 180")

# Favicon 32/16 square of gold "IQ" mark: just use icon
make_icon(48).save(f"{OUT}/favicon-48.png")
icon32 = make_icon(32)
icon32.save(f"{OUT}/favicon-32.png")
icon16 = make_icon(16)
icon16.save(f"{OUT}/favicon-16.png")
print("favicons done")
print("FILES:", sorted(os.listdir(OUT)))
