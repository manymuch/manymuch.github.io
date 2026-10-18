"""Generate static preview variants from the full-size assets linked by the page."""
from html.parser import HTMLParser
from pathlib import Path
from PIL import Image
import re

root = Path(__file__).resolve().parents[1]
class Images(HTMLParser):
    def __init__(self): super().__init__(); self.paths = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'img':
            source = attrs.get('data-original', attrs.get('src', '')).split('?')[0]
            if source.startswith('images/') and not re.search(r'-(?:preview|still)\.', source): self.paths.add(source)
parser = Images()
parser.feed((root/'index.html').read_text(encoding='utf8'))
for source in parser.paths:
    path = root / source
    if not path.is_file() or path.suffix == '.svg': continue
    with Image.open(path) as image:
        if getattr(image, 'n_frames', 1) > 1 or max(image.size) <= 1000: continue
        image.thumbnail((1100, 900), Image.Resampling.LANCZOS)
        output = path.with_name(path.stem + '-preview.webp')
        image.save(output, quality=88, method=6)
        print(output.relative_to(root))
