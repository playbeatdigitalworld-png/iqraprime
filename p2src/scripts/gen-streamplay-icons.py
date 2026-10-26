#!/usr/bin/env python3
"""StreamPlay brand icon rasterizer.
Renders the original folded-ribbon "S" mark (SVG) to PWA / favicon /
Apple-touch PNGs using Playwright (Chromium). No new project dependencies.

Tile variants (per brand sheet):
- App / mobile icon  -> obsidian rounded square
- Favicon / PWA icon -> obsidian circle
- Maskable           -> full-bleed square, mark scaled into 80% safe zone
"""
import pathlib

from playwright.sync_api import sync_playwright

PUBLIC = pathlib.Path("/home/z/my-project/public")

MARK = """
  <g stroke-linejoin='round' stroke-width='14'>
    <path d='M118,96 L154,64 L408,64 L408,148 L270,148 L270,258 L128,206 Z'
          fill='url(#spTop)' stroke='url(#spTop)'/>
    <path d='M408,148 L270,148 L408,262 Z' fill='#A10732'/>
    <path d='M394,416 L358,448 L104,448 L104,364 L242,364 L242,254 L384,306 Z'
          fill='url(#spBot)' stroke='url(#spBot)'/>
    <path d='M104,364 L242,364 L104,250 Z' fill='#A10732'/>
  </g>"""

DEFS = """
  <defs>
    <linearGradient id='tile' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#141B25'/>
      <stop offset='0.55' stop-color='#0B1018'/>
      <stop offset='1' stop-color='#04070B'/>
    </linearGradient>
    <linearGradient id='spTop' x1='0.3' y1='0' x2='0.7' y2='1'>
      <stop offset='0' stop-color='#FF4D6F'/>
      <stop offset='1' stop-color='#E5093A'/>
    </linearGradient>
    <linearGradient id='spBot' x1='0.7' y1='1' x2='0.3' y2='0'>
      <stop offset='0' stop-color='#B90732'/>
      <stop offset='1' stop-color='#E5093A'/>
    </linearGradient>
    <radialGradient id='toplight' cx='0.5' cy='0.04' r='0.9'>
      <stop offset='0' stop-color='#3A4A63' stop-opacity='0.55'/>
      <stop offset='0.5' stop-color='#1B2D4A' stop-opacity='0.12'/>
      <stop offset='1' stop-color='#1B2D4A' stop-opacity='0'/>
    </radialGradient>
  </defs>"""


def svg_square(mark_transform: str = "") -> str:
    """Obsidian rounded-square tile (app / mobile icon)."""
    return (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='100%' height='100%'>"
        + DEFS
        + "<rect x='16' y='16' width='480' height='480' rx='112' fill='url(#tile)'/>"
        + "<rect x='16' y='16' width='480' height='480' rx='112' fill='url(#toplight)'/>"
        + "<rect x='17.5' y='17.5' width='477' height='477' rx='110.5' fill='none' "
        + "stroke='#FFFFFF' stroke-opacity='0.09' stroke-width='3'/>"
        + f"<g {mark_transform}>{MARK}</g>"
        + "</svg>"
    )


def svg_circle(mark_transform: str = "") -> str:
    """Obsidian circle tile (favicon / PWA icon per brand sheet)."""
    return (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='100%' height='100%'>"
        + DEFS
        + "<circle cx='256' cy='256' r='246' fill='url(#tile)'/>"
        + "<circle cx='256' cy='256' r='246' fill='url(#toplight)'/>"
        + "<circle cx='256' cy='256' r='244.5' fill='none' "
        + "stroke='#FFFFFF' stroke-opacity='0.09' stroke-width='3'/>"
        + f"<g {mark_transform}>{MARK}</g>"
        + "</svg>"
    )


def svg_maskable() -> str:
    """Full-bleed square, mark at 80% around center (512 safe zone)."""
    return (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='100%' height='100%'>"
        + DEFS
        + "<rect width='512' height='512' fill='#070B12'/>"
        + "<g transform='translate(51.2 51.2) scale(0.8)'>" + MARK + "</g>"
        + "</svg>"
    )


HTML = """<!doctype html><html><head><style>
html,body{{margin:0;padding:0;width:{size}px;height:{size}px;overflow:hidden;background:transparent}}
svg{{display:block;width:{size}px;height:{size}px}}
</style></head><body>{svg}</body></html>"""


def render(size: int, svg: str, out: pathlib.Path) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--force-color-profile=srgb", "--disable-lcd-text"])
        page = browser.new_page(viewport={"width": size, "height": size}, device_scale_factor=1)
        page.set_content(HTML.format(size=size, svg=svg))
        page.wait_for_timeout(120)
        page.screenshot(path=str(out), omit_background=False, clip={"x": 0, "y": 0, "width": size, "height": size})
        browser.close()
    print(f"wrote {out.name} ({size}x{size})")


def main() -> None:
    render(512, svg_square(), PUBLIC / "pwa-512x512.png")
    render(192, svg_square(), PUBLIC / "pwa-192x192.png")
    render(512, svg_maskable(), PUBLIC / "pwa-maskable-512x512.png")
    render(180, svg_square(), PUBLIC / "apple-touch-icon.png")

    # favicon: render 32px PNG bytes, then write as .ico payload
    # (PNG-in-.ico is accepted by all modern browsers; same approach as before)
    tmp = PUBLIC / ".favicon-32.tmp.png"
    render(32, svg_circle(), tmp)
    tmp.replace(PUBLIC / "favicon.ico")
    print("wrote favicon.ico (32x32 PNG payload, circle tile)")


if __name__ == "__main__":
    main()
