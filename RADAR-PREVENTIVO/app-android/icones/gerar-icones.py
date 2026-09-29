import numpy as np, os, sys
from PIL import Image, ImageDraw, ImageFilter

# Gera os ícones do Android, o ícone "maskable" do site e a imagem de abertura
# a partir do símbolo oficial (simbolo-1024.png = frontend/public/simbolo.svg em 1024px).
# Uso: python3 app-android/icones/gerar-icones.py
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
simbolo = Image.open(os.path.join(AQUI, 'simbolo-1024.png')).convert('RGBA')
simbolo = simbolo.crop(simbolo.getbbox())

CENTRO = np.array([12, 86, 196])   # azul claro do centro do ícone oficial
BORDA = np.array([2, 30, 92])      # azul escuro das bordas
FUNDO_APP = (2, 11, 34)            # #020b22, o mesmo do fundo do app

def fundo_icone(n):
    """Fundo azul do ícone: gradiente radial com anéis e cruz discretos (como o radar do ícone oficial)."""
    y, x = np.mgrid[0:n, 0:n] / (n - 1) - 0.5
    r = np.sqrt(x * x + y * y) / 0.7071
    t = np.clip(r, 0, 1)[..., None] ** 0.9
    img = (CENTRO * (1 - t) + BORDA * t).astype(np.uint8)
    im = Image.fromarray(img, 'RGB').convert('RGBA')
    camada = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    c = n / 2
    for k in (0.16, 0.27, 0.38, 0.49):
        rr = k * n
        d.ellipse([c - rr, c - rr, c + rr, c + rr], outline=(90, 190, 255, 38), width=max(1, n // 300))
    d.line([0, c, n, c], fill=(90, 190, 255, 30), width=max(1, n // 400))
    d.line([c, 0, c, n], fill=(90, 190, 255, 30), width=max(1, n // 400))
    im.alpha_composite(camada)
    return im

def simbolo_em(n, fracao):
    """Símbolo (R + radar) centralizado ocupando `fracao` do quadrado, com um leve brilho."""
    lado = round(n * fracao)
    s = simbolo.resize((round(lado * simbolo.width / max(simbolo.size)), round(lado * simbolo.height / max(simbolo.size))), Image.LANCZOS)
    camada = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    pos = ((n - s.width) // 2, (n - s.height) // 2)
    brilho = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    alfa = s.split()[3]
    brilho.paste(Image.new('RGBA', s.size, (60, 170, 255, 110)), pos, alfa)
    brilho = brilho.filter(ImageFilter.GaussianBlur(n * 0.02))
    camada.alpha_composite(brilho)
    camada.alpha_composite(s, pos)
    return camada

def mascara(n, forma):
    m = Image.new('L', (n * 4, n * 4), 0)
    d = ImageDraw.Draw(m)
    if forma == 'circulo':
        d.ellipse([0, 0, n * 4 - 1, n * 4 - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, n * 4 - 1, n * 4 - 1], radius=n * 4 * 0.22, fill=255)
    return m.resize((n, n), Image.LANCZOS)

# Ícone adaptável do Android (camadas de 108dp; o Android recorta a área central de 72dp).
# O símbolo ocupa 46% da camada: cabe inteiro até na máscara redonda, sem cortar as pontas do R.
DENSIDADES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
destino = f'{RAIZ}/app-android/icones'
for nome, f in DENSIDADES.items():
    pasta = f'{destino}/mipmap-{nome}'
    os.makedirs(pasta, exist_ok=True)
    camada = round(108 * f)
    fundo_icone(camada).convert('RGB').save(f'{pasta}/ic_launcher_background.png', optimize=True)
    simbolo_em(camada, 0.46).save(f'{pasta}/ic_launcher_foreground.png', optimize=True)
    legado = round(48 * f)
    completo = fundo_icone(legado * 2)
    completo.alpha_composite(simbolo_em(legado * 2, 0.64))
    completo = completo.resize((legado, legado), Image.LANCZOS)
    for arquivo, forma in (('ic_launcher.png', 'quadrado'), ('ic_launcher_round.png', 'circulo')):
        saida = Image.new('RGBA', (legado, legado), (0, 0, 0, 0))
        saida.paste(completo, (0, 0), mascara(legado, forma))
        saida.save(f'{pasta}/{arquivo}', optimize=True)

# Ícone "maskable" do site (o celular recorta até 20% das bordas): símbolo em 54%.
m = fundo_icone(512); m.alpha_composite(simbolo_em(512, 0.54))
m.convert('RGB').save(f'{RAIZ}/frontend/public/icone-maskable-512.png', optimize=True)

print('ok')
