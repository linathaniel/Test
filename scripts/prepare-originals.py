"""Export uncropped, orientation-correct web copies. Source files remain untouched."""
from pathlib import Path
from PIL import Image, ImageOps
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'original_images'
DESTINATION = ROOT / 'public/assets/memories'
DESTINATION.mkdir(parents=True, exist_ok=True)

PORTUGAL_NAMES = {
    '20260302_142417.jpg': 'portugal-meal-1',
    '20260304_134938.jpg': 'portugal-meal-2',
    '20260307_150752.jpg': 'portugal-view',
    'funnypic_before_final.jpeg': 'portugal-before-proposal',
    'FINALPIC.jpg': 'portugal-proposal',
}

def asset_name(path):
    if path.parent.name.lower() == 'portugal':
        return PORTUGAL_NAMES[path.name]
    stem = re.sub(r'([a-z])([A-Z])', r'\1-\2', path.stem)
    return re.sub(r'([a-zA-Z])(\d)', r'\1-\2', stem).lower()

records = []
for source in sorted(SOURCE.rglob('*')):
    if not source.is_file() or source.suffix.lower() not in ['.jpg', '.jpeg', '.png', '.webp'] or 'sprite' in source.stem.lower() or source.stem.lower() in ['intro_bg', 'railcar']:
        continue
    image = ImageOps.exif_transpose(Image.open(source)).convert('RGB')
    original_size = list(image.size)
    image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    slug = asset_name(source)
    destination = DESTINATION / (slug + '-original.webp')
    image.save(destination, 'WEBP', quality=83, method=6)
    records.append({
        'source': source.relative_to(ROOT).as_posix(),
        'asset': destination.relative_to(ROOT / 'public').as_posix(),
        'sourceSize': original_size, 'webSize': list(image.size),
        'bytes': destination.stat().st_size,
    })
manifest = ROOT / 'art-work/asset-manifests/originals.json'
manifest.parent.mkdir(parents=True, exist_ok=True)
manifest.write_text(json.dumps(records, indent=2), encoding='utf8')
print(f'Exported {len(records)} original-view web copies; {sum(r["bytes"] for r in records) / 1024 / 1024:.2f} MiB total.')
