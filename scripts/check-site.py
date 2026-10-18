"""Static deployment checks, image integrity, and asset budgets; no dependencies.

Run with --images for optional Pillow decode/animation checks.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import re
import struct
import sys

root = Path(__file__).resolve().parents[1]
errors = []
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs = []; self.ids = set(); self.anchors = []; self.viewport = ''
    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if 'id' in attrs:
            if attrs['id'] in self.ids: errors.append('Duplicate ID: ' + attrs['id'])
            self.ids.add(attrs['id'])
        if tag == 'meta' and attrs.get('name') == 'viewport': self.viewport = attrs.get('content', '')
        if tag == 'img' and not all(key in attrs for key in ('alt', 'width', 'height')): errors.append('Image missing alt/dimensions: ' + attrs.get('src', ''))
        for key in ('src', 'href', 'srcset', 'data-srcset', 'poster', 'data-poster', 'data-full-src', 'data-original'):
            value = attrs.get(key, '')
            if not value: continue
            values = value.split(',') if key.endswith('srcset') else [value]
            for item in values:
                url = urlsplit(item.strip().split(' ')[0])
                if url.scheme or url.netloc: continue
                if url.path: self.refs.append(unquote(url.path))
                elif url.fragment and key == 'href': self.anchors.append(url.fragment)

page = Page(); page.feed((root/'index.html').read_text(encoding='utf8'))
for ref in page.refs:
    current = root
    for component in Path(ref).parts:
        if not current.is_dir() or component not in {p.name for p in current.iterdir()}:
            errors.append('Missing or case-mismatched reference: ' + ref); break
        current /= component
for anchor in page.anchors:
    if anchor not in page.ids: errors.append('Missing anchor: ' + anchor)
assert page.viewport == 'width=1280', page.viewport
assert not (root/'chn.html').exists(), 'Chinese version still present'
assert not (root/'models/co2-sensor-data.js').exists(), 'Obsolete file payload present'
for name in ('model-viewer.umd.js', 'embla-carousel.umd.js', 'model-viewer.LICENSE', 'embla-carousel.LICENSE'):
    if not (root/'js'/name).is_file(): errors.append('Missing runtime dependency/license: ' + name)
glb = (root/'models/co2-sensor.glb').read_bytes()
magic, version, length = struct.unpack_from('<III', glb)
assert magic == 0x46546C67 and version == 2 and length == len(glb), 'Invalid GLB header'
json_length = struct.unpack_from('<I', glb, 12)[0]
model = json.loads(glb[20:20+json_length])
assert not any('uri' in b for b in model['buffers']), 'GLB has external buffers'
assert not any('uri' in image for image in model.get('images', [])), 'GLB has external textures'
if '--images' in sys.argv:
    from PIL import Image
    for path in (root/'images').rglob('*'):
        if not path.is_file() or path.suffix == '.svg': continue
        try:
            with Image.open(path) as image:
                for index in range(getattr(image, 'n_frames', 1)): image.seek(index); image.load()
                if re.search(r'(cad-animation|ros-arm|ros-gripper|physical-arm)(-preview)?\.webp$', path.name):
                    assert image.n_frames > 1, 'Animation became static'
        except Exception as error: errors.append(str(path.relative_to(root)) + ': ' + str(error))
files = [p for p in root.rglob('*') if p.is_file() and '.git' not in p.parts and '__pycache__' not in p.parts]
print('Files:', len(files), 'Total MiB:', round(sum(p.stat().st_size for p in files)/1048576, 2))
print('HTML asset references:', len(page.refs), 'Anchors:', len(page.anchors))
print('Embedded model:', len(model['meshes']), 'material meshes;', len(model['materials']), 'materials')
for error in errors: print('ERROR:', error)
if errors: sys.exit(1)
print('Site checks passed.')
