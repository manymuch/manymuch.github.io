"""Align original PCB layouts in one optimized raster panel."""
from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[1]
panel = Image.new('RGB', (2000, 940), 'black')
for i, side in enumerate(('front', 'back')):
    path = root / f'images/making/pcb-{side}.png'
    a = np.asarray(Image.open(path).convert('RGB'))
    purple = (a[:, :, 0] == 127) & (a[:, :, 1] == 0) & (a[:, :, 2] == 127)
    ys, xs = np.nonzero(purple)
    # Register by the board outline rather than the source image edges.
    x, y = int(xs.min()) - 35, int(ys.min()) - 35
    width, height = int(xs.max()) - x + 35, int(ys.max()) - y + 130
    image = Image.open(path).convert('RGB').crop((x, y, x + width, y + height))
    image.thumbnail((840, 880), Image.Resampling.LANCZOS)
    panel.paste(image, (i * 1000 + 80 + (840 - image.width) // 2, 35 + (880 - image.height) // 2))
panel.save(root / 'images/making/co2-pcb-layouts.webp', quality=96, method=6)
panel.resize((1100, 517), Image.Resampling.LANCZOS).save(root / 'images/making/co2-pcb-layouts-preview.webp', quality=92, method=6)
print('Saved aligned PCB layout panel (2000 x 940).')
