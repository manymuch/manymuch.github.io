"""Bake theme-aware SVG snapshots into the page; live data is an enhancement."""
import html
import json
from datetime import date
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'data/smart-home.json').read_text(encoding='utf-8'))
world = json.loads((ROOT / 'data/world-map.json').read_text(encoding='utf-8'))


def tag(name, text='', **attrs):
    attributes = ' '.join(f'{k.replace("_", "-")}="{html.escape(str(v), quote=True)}"' for k, v in attrs.items())
    return f'<{name} {attributes}>{text}</{name}>'


start = date.fromisoformat(data['repos'][0]['history'][0]['date'])
end = date.fromisoformat(data['updated'])
dates = []
while start <= end:
    dates.append(start.isoformat())
    start = date(start.year + (start.month == 12), start.month % 12 + 1, 1)
series = []
for repo in data['repos']:
    series.append([next((int(row['stargazers']) for row in reversed(repo['history']) if row['date'] <= month), 0) for month in dates])
maximum = max(50, ((max(map(max, series)) + 49) // 50) * 50)
x = lambda i: round(40 + i / (len(dates) - 1) * 560, 2)
y = lambda value: round(244 - value / maximum * 210, 2)
chart = []
for value in range(0, maximum + 1, 50):
    chart.append(tag('path', d=f'M40 {y(value)}H600', **{'class': 'chart-grid'}))
    chart.append(tag('text', str(value), x=30, y=y(value) + 4, text_anchor='end', **{'class': 'chart-label'}))
for i, month in enumerate(dates):
    if i == 0 or month[5:7] == '01':
        chart.append(tag('text', month[:4], x=x(i), y=271, text_anchor='middle', **{'class': 'chart-label'}))
for i, values in enumerate(series):
    path = ' '.join(f'{"L" if j else "M"}{x(j)} {y(value)}' for j, value in enumerate(values))
    chart.append(tag('path', d=path, **{'class': f'star-line star-series-{i}'}))
    chart.append(tag('circle', cx=x(len(dates)-1), cy=y(values[-1]), r=4.5, **{'class': f'star-dot star-series-{i}'}))

map_svg = []
for country in world:
    map_svg.append(tag('path', d=country['path'], fill_rule='evenodd', data_code=country['code'], data_name=country['name'], data_x=country['x'], data_y=country['y'], **{'class': 'map-land'}))
for row in reversed(data['countries']):
    country = next((c for c in world if c['code'] == row['country_code']), None)
    if country is None:
        continue
    count = int(row['stargazers'])
    label = f'{country["name"]}: {count} recorded stargazers'
    radius = round(4 + count ** .5 * 3, 2)
    circles = tag('circle', cx=country['x'], cy=country['y'], r=radius+5, **{'class': 'map-halo'})
    circles += tag('circle', cx=country['x'], cy=country['y'], r=radius, **{'class': 'map-bubble'})
    circles += tag('title', html.escape(label))
    map_svg.append(tag('g', circles, tabindex=0, role='img', aria_label=label, **{'class': 'map-marker'}))

page = ROOT / 'index.html'
source = page.read_text(encoding='utf-8')
source = re.sub(r'(<svg class="star-chart"[^>]*>).*?(</svg>)', lambda m: m[1] + ''.join(chart) + m[2], source, flags=re.S)
source = source.replace('aria-label="Loading recorded star history"', 'aria-label="Recorded star history for XGIMI4HA and HisenseHA, May 2022 to October 2026"')
source = re.sub(r'(<svg class="community-map"[^>]*>).*?(</svg>)', lambda m: m[1] + ''.join(map_svg) + m[2], source, flags=re.S)
source = re.sub(r'\s*<script type="application/json" id="smart-home-snapshot">.*?</script>', '', source, flags=re.S)
snapshot = '<script type="application/json" id="smart-home-snapshot">' + json.dumps(data, separators=(',', ':')).replace('<', '\\u003c') + '</script>'
source = re.sub(r'<script src="js/smart-home\.js(?:\?[^\"]*)?"></script>', lambda m: snapshot + '\n\t' + m[0], source)
page.write_text(source, encoding='utf-8')
print('Embedded star chart, world map, and local data snapshot in index.html.')
