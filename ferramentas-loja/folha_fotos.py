#!/usr/bin/env python3
"""Folha com a 1ª foto de cada produto de uma loja (para conferir se tudo é do nicho).
Uso: python3 folha_fotos.py <produtos.json> <saida.jpg>"""
import io
import json
import sys
import urllib.request
from PIL import Image, ImageDraw, ImageFont

d = json.load(open(sys.argv[1]))
cols, w = 6, 220
rows = (len(d) + cols - 1) // cols
folha = Image.new('RGB', (cols * w, rows * (w + 44)), 'white')
dr = ImageDraw.Draw(folha)
try:
    fonte = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
except OSError:
    fonte = ImageFont.load_default()
for i, p in enumerate(d):
    x, y = (i % cols) * w, (i // cols) * (w + 44)
    try:
        req = urllib.request.Request(p['imagenes'][0], headers={'User-Agent': 'Mozilla/5.0'})
        im = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=20).read())).convert('RGB')
        im.thumbnail((w - 10, w - 10))
        folha.paste(im, (x + 5, y + 5))
    except Exception as e:  # foto que não abre não para a folha
        dr.text((x + 10, y + 100), 'sem foto', fill='red', font=fonte)
        print(f'::warning::foto {i + 1}: {e}')
    dr.text((x + 5, y + w + 2), f"{i + 1}. {p['es']['nombre'][:28]}", fill='black', font=fonte)
    dr.text((x + 5, y + w + 20), f"{p.get('categoria')} | {p.get('animal', '')} | {p.get('precio')}", fill='gray', font=fonte)
folha.save(sys.argv[2], quality=80)
print(len(d), 'produtos ->', sys.argv[2])
