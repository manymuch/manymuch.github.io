"""Pair board photographs with consistent scale and vertical alignment."""
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
panel = Image.new('RGB', (2000, 940), 'white')
for i, (side, crop) in enumerate((('front', (80, 0, 1740, 1660)), ('back', (100, 70, 1700, 1670)))):
    path = root / f'images/making/co2-board-{side}.webp'
    image = Image.open(path).convert('RGB').crop(crop)
    panel.paste(ImageOps.fit(image, (1000, 940), Image.Resampling.LANCZOS), (i * 1000, 0))
panel.save(root / 'images/making/co2-board-photos.webp', quality=92, method=6)
panel.resize((1100, 517), Image.Resampling.LANCZOS).save(root / 'images/making/co2-board-photos-preview.webp', quality=86, method=6)
print('Saved aligned board photographs panel (2000 x 940).')
