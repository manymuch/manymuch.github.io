"""Rebuild animated WebP assets from an external source directory (Pillow).

Usage: python scripts/optimize-animations.py /path/to/original/animations
The source directory must contain the four full-resolution .webp animations.
"""
from pathlib import Path
from PIL import Image
import sys
from bisect import bisect_right
from itertools import accumulate

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
target = root / 'images/making/manipulator'
if source == target.resolve():
    raise SystemExit('Use a separate source directory to avoid repeated lossy encoding.')
for name in ('cad-animation', 'ros-arm', 'ros-gripper', 'physical-arm'):
    with Image.open(source / f'{name}.webp') as image:
        frames, durations = [], []
        for index in range(image.n_frames):
            image.seek(index)
            image.load()
            frames.append(image.convert('RGB').copy())
            durations.append(image.info.get('duration', 67))
        if '--previews-only' not in sys.argv:
            frames[0].save(target / f'{name}.webp', save_all=True,
                           append_images=frames[1:], duration=durations, loop=0,
                           quality=82, method=4, minimize_size=True)
        preview, timings = [], []
        ends = list(accumulate(durations))
        for timestamp in range(0, sum(durations), 83):
            thumb = frames[min(bisect_right(ends, timestamp), len(frames) - 1)].copy()
            thumb.thumbnail((710, 400), Image.Resampling.LANCZOS)
            preview.append(thumb)
            timings.append(min(83, sum(durations) - timestamp))
        # Keep original timing; coalescing identical frames is handled by WebP.
        preview[0].save(target / f'{name}-preview.webp', save_all=True,
                        append_images=preview[1:], duration=timings, loop=0,
                        quality=76, method=4, minimize_size=True)
        still = frames[0].copy()
        still.thumbnail((710, 400), Image.Resampling.LANCZOS)
        still.save(target / f'{name}-still.webp', quality=86, method=6)
        print(name, 'frames', len(frames), 'duration_ms', sum(durations), flush=True)
