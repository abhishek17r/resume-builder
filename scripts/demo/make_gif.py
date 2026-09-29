"""Frames + captions → an optimised GIF for the landing page.
Usage: python3 make_gif.py <work dir> <output.gif>   (needs Pillow)"""
import json, os, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.gettempdir()) / 'resume-demo'
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('public/demo/tailor-journey.gif')
W, H = 960, 600
FONT = ImageFont.truetype(os.environ.get('CAPTION_FONT', '/System/Library/Fonts/SFNS.ttf'), 17)
INK, PAPER = (23, 23, 27), (244, 241, 234)

frames = json.loads((HERE / 'frames.json').read_text())

def caption(img, text):
    d = ImageDraw.Draw(img)
    pad_x, pad_y = 14, 9
    tw = d.textlength(text, font=FONT)
    x0, y1 = 190, H - 18  # right of the sidebar
    box = (x0, y1 - 17 - pad_y * 2, x0 + tw + pad_x * 2, y1)
    d.rounded_rectangle(box, radius=8, fill=INK)
    d.text((x0 + pad_x, box[1] + pad_y - 1), text, font=FONT, fill=PAPER)
    return img

images, durations = [], []
for f in frames:
    im = Image.open(HERE / 'frames' / f['file']).convert('RGB').resize((W, H), Image.LANCZOS)
    im = caption(im, f['caption'])
    images.append(im)
    durations.append(f['ms'])

# One shared palette keeps colours steady from frame to frame and the file small.
palette_src = Image.new('RGB', (W, H * 3))
for i, idx in enumerate([0, len(images) // 2, len(images) - 2]):
    palette_src.paste(images[idx], (0, H * i))
palette = palette_src.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
quantised = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in images]

quantised[0].save(OUT, save_all=True, append_images=quantised[1:], duration=durations, loop=0, optimize=True, disposal=1)
print(OUT, f'{OUT.stat().st_size / 1e6:.2f} MB', f'{len(images)} frames', f'{sum(durations) / 1000:.1f}s')
