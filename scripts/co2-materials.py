"""Restore EasyEDA PCB finishes using the supplied top-view reference image.

Usage: python scripts/co2-materials.py mesh.json reference.webp materials.json
"""
import json
import sys
from PIL import Image
from PIL import ImageFilter, ImageDraw
from pathlib import Path
import numpy as np

model = json.load(open(sys.argv[1], encoding='utf-8'))
image = Image.open(sys.argv[2]).convert('RGB')
back = Image.open(Path(__file__).resolve().parents[1] / 'images/making/pcb-back.png').convert('RGB')
pixels = np.asarray(back)
purple = (pixels[:, :, 0] == 127) & (pixels[:, :, 1] == 0) & (pixels[:, :, 2] == 127)
ys, xs = np.nonzero(purple)
left, right, top, bottom = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
# Bright blue in the rear CAD layout denotes pads. Remove thin routing edges
# and fill small annotation gaps to obtain a surface mask, not triangle colors.
pad_pixels = (pixels[:, :, 0] < 20) & (pixels[:, :, 1] < 12) & (pixels[:, :, 2] > 242)
pad_mask = Image.fromarray((pad_pixels * 255).astype('uint8')).filter(ImageFilter.MinFilter(15)).filter(ImageFilter.MaxFilter(15))
pad_mask = pad_mask.filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.MinFilter(21))
draw = ImageDraw.Draw(pad_mask)
def rear_uv(x, y):
    return (right - (x - .01) / 32.18 * (right-left), bottom - (y - .01) / 32.18 * (bottom-top))
for x in (1.27, 30.93):
    for y in (8.65, 11.19, 13.73, 16.27, 18.81, 21.35):
        u, v = rear_uv(x, y)
        radius = (right-left) / 32.18 * .86
        draw.ellipse((u-radius, v-radius, u+radius, v+radius), fill=255)
texture = Image.new('RGB', back.size, (5, 97, 176))
texture.paste((219, 181, 51), mask=pad_mask)
texture_path = Path(__file__).resolve().parents[1] / 'models/co2-rear-finish.png'
texture.resize((2048, 2048), Image.Resampling.NEAREST).save(texture_path, optimize=True)
profiles = {
    'board': {'color': [0.025, 0.15, 0.36], 'metallic': 0, 'roughness': .65},
    'mask': {'color': [0.02, 0.38, 0.69], 'metallic': 0, 'roughness': .46},
    'gold': {'color': [.86, .71, .20], 'metallic': .72, 'roughness': .36},
    'silk': {'color': [.97, .98, .98], 'metallic': 0, 'roughness': .75},
    'substrate': {'color': [.075, .075, .075], 'metallic': 0, 'roughness': .7},
    'shield': {'color': [.74, .73, .69], 'metallic': .7, 'roughness': .42},
    'rear': {'color': [1, 1, 1], 'metallic': .2, 'roughness': .46, 'texture': 'models/co2-rear-finish.png'},
}
overrides = {}
for i, mesh in enumerate(model['meshes']):
    name = mesh['name']
    entry = {}
    if name.startswith('Board~'):
        entry['profile'] = 'board'
    elif 'Copper~' in name:
        entry['profile'] = 'mask'
        if name.startswith('BottomCopper'):
            entry['profile'] = 'rear'
            entry['uv'] = {'left': left, 'right': right, 'top': top, 'bottom': bottom, 'width': back.width, 'height': back.height}
            overrides[str(i)] = entry
            continue
        # STEP omits the solder-mask distinction. Sample exposed-pad locations
        # from the orthographic reference, registered to the 32.18 mm board.
        p, ix = mesh['attributes']['position']['array'], mesh['index']['array']
        gold = []
        for j in range(0, len(ix), 3):
            x = sum(p[k * 3] for k in ix[j:j+3]) / 3
            y = sum(p[k * 3 + 1] for k in ix[j:j+3]) / 3
            u = max(0, min(image.width - 1, round(13 + (x - .01) / 32.18 * 838)))
            v = max(0, min(image.height - 1, round(843 - (y - .01) / 32.18 * 838)))
            r, g, b = image.getpixel((u, v))
            if r > 100 and g > 80 and b < g * .65 and r > b * 1.6:
                gold.append(j // 3)
        entry['goldTriangles'] = gold
    elif 'Silkscreen~' in name:
        entry['profile'] = 'silk'
    elif name.startswith('HDR-TH_'):
        # Plastic spacer occupies z=-2.5..0 mm. Faces extending beyond it
        # belong to the metal contacts and retain their original finish.
        p = mesh['attributes']['position']['array']
        ix = mesh['index']['array']
        plastic = []
        for face in mesh['brep_faces']:
            zs = [p[k * 3 + 2] for k in ix[face['first']*3:(face['last']+1)*3]]
            if min(zs) >= -2.501 and max(zs) <= .001:
                plastic.extend(range(face['first'], face['last'] + 1))
        entry['triangleProfiles'] = {'substrate': plastic}
    elif 'WIRELM' in name:
        c = mesh.get('color', [.5, .5, .5])
        if i == 208:
            entry['profile'] = 'substrate'
        elif i == 209 or c[0] > .2 and c[1] > .2 and c[2] < .01:
            entry['profile'] = 'gold'
        elif c[2] > .7 and c[0] < .8:
            entry['profile'] = 'substrate'
        elif c[0] < .5 and .2 < c[2] < .4:
            entry['profile'] = 'shield'
    if entry:
        overrides[str(i)] = entry
with open(sys.argv[3], 'w', encoding='utf-8') as f:
    json.dump({'profiles': profiles, 'meshes': overrides}, f, separators=(',', ':'))
print('Restored finishes for', len(overrides), 'mesh parts.')
