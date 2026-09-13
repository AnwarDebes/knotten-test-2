"""Make the WebP copies the website serves, from the renders and the incoming originals.

Run from anywhere:  python pipeline/optimise_images.py
Only files newer than their WebP copy are redone.
"""
import os
from pathlib import Path
from PIL import Image

KN = Path(__file__).resolve().parent.parent
REN = KN / "renders"
PUB = KN / "site" / "public"
JOBS = [
    (REN / "site_after.png", PUB / "renders/web/site_after.webp", 1920),
    (REN / "site_after.png", PUB / "renders/web/site_after_960.webp", 960),
    (REN / "site_before.png", PUB / "renders/web/site_before.webp", 1920),
    (REN / "site_before.png", PUB / "renders/web/site_before_960.webp", 960),
    (REN / "drone_after.png", PUB / "renders/web/drone_after.webp", 1600),
    (REN / "drone_before.png", PUB / "renders/web/drone_before.webp", 1600),
    (REN / "grillbu_photo_match.png", PUB / "renders/web/grillbu_photo_match.webp", 1600),
    (REN / "knoll_view_after.png", PUB / "renders/web/knoll_view_after.webp", 1600),
    (REN / "farms_after.png", PUB / "renders/web/farms_after.webp", 1600),
    (REN / "site_map.png", PUB / "renders/web/site_map.webp", 1400),
    (REN / "plan_topdown_before.jpg", PUB / "renders/web/plan_topdown_before.webp", 1400),
    (REN / "knotten_view_model.jpg", PUB / "renders/web/knotten_view_model.webp", 1600),
    (PUB / "assets/incoming/view_from_grillbu.jpg", PUB / "assets/incoming/web/view_from_grillbu.webp", 1600),
    (PUB / "assets/incoming/cadastral_map.png", PUB / "assets/incoming/web/cadastral_map.webp", 1400),
    (PUB / "assets/incoming/knotten_map.png", PUB / "assets/incoming/web/knotten_map.webp", 1400),
    (PUB / "assets/incoming/norgeskart_property.png", PUB / "assets/incoming/web/norgeskart_property.webp", 1400),
    (PUB / "assets/incoming/site_plan_sketch.png", PUB / "assets/incoming/web/site_plan_sketch.webp", 1400),
    (PUB / "assets/incoming/drone_outline.jpg", PUB / "assets/incoming/web/drone_outline.webp", 1600),
    (PUB / "assets/incoming/sightline_map.png", PUB / "assets/incoming/web/sightline_map.webp", 1400),
]
Image.MAX_IMAGE_PIXELS = None
for src, dst, w in JOBS:
    if not src.exists():
        continue
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        continue
    dst.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src).convert("RGB")
    if im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=82, method=6)
    print(f"{dst.relative_to(PUB)}  {im.size}  {os.path.getsize(dst) // 1024} KB")
print("done")
