"""Record publishable asset provenance/size without exposing raw files or EXIF."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = []
for path in sorted((root / 'public/assets').rglob('*.webp')):
    relative = path.relative_to(root / 'public').as_posix()
    with Image.open(path) as image:
        width, height = image.size
        if image.getexif() or image.info.get('exif') or image.info.get('xmp'):
            raise ValueError(f'Metadata remains in {relative}')
        row = dict(path=relative, width=width, height=height, bytes=path.stat().st_size,
                   kind='original' if '-original.' in path.name else 'character' if 'characters' in path.parts else 'environment' if 'world' in path.parts else 'illustration',
                   provenance='Owner-supplied photograph; resized without cropping' if '-original.' in path.name else 'Built-in ImageGen; optimized for this game')
        if row['kind'] == 'character':
            if width != 1024 or height != 1024:
                raise ValueError(f'Character sheet must have sixteen 256px frames: {relative}')
            row.update(frameWidth=256, frameHeight=256, directions=['south', 'north', 'west', 'east'])
        elif row['kind'] == 'environment' and abs(width / height - 16 / 9) > .01:
            raise ValueError(f'Background must have a 16:9 composition: {relative}')
        assets.append(row)
manifest = dict(tool='Built-in ImageGen', metadata='EXIF/XMP removed; source originals unchanged',
                photoBooth='real-austin-1-original.webp intentionally original only; themed generation unavailable',
                assets=assets, totalBytes=sum(asset['bytes'] for asset in assets))
(root / 'public/content/assets.json').write_text(json.dumps(manifest, indent=2) + '\n', 'utf-8')
print(f'{len(assets)} WebP assets, {manifest["totalBytes"] / 1024**2:.2f} MiB total; metadata checked.')
