"""Convert Microduck uploads: pip install pillow-heif imageio-ffmpeg."""
from pathlib import Path
import subprocess
import sys

import imageio_ffmpeg
import pillow_heif
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()
source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1]
images = root / 'images/making'
for name in ('building', 'servo'):
    with Image.open(source / (name + '.HEIC')) as original:
        photo = ImageOps.exif_transpose(original).convert('RGB')
        photo.thumbnail((1800, 1800))
        photo.save(images / ('microduck-' + name + '.webp'), quality=88)
        print(name, photo.size)
        photo.thumbnail((800, 800))
        photo.save(images / ('microduck-' + name + '-preview.webp'), quality=82)

ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
video = root / 'media/microduck-demo.mp4'
subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
    '-i', str(source / 'demo.mp4'), '-vf', 'crop=1080:1440:0:0,setsar=1',
    '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-map_metadata', '-1', '-movflags', '+faststart', str(video)], check=True)
subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
    '-i', str(video), '-frames:v', '1', '-vf', 'scale=600:800',
    str(images / 'microduck-demo-preview.webp')], check=True)

head_video = root / 'media/microduck-head.mp4'
subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
    '-i', str(source / 'robot_duck_head.mp4'), '-t', '3',
    '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-map_metadata', '-1', '-movflags', '+faststart', str(head_video)], check=True)
subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
    '-i', str(head_video), '-frames:v', '1', '-vf', 'scale=600:800',
    str(images / 'microduck-head-preview.webp')], check=True)
