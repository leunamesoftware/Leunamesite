#!/usr/bin/env python3
"""Vídeo curto em pé (1080×1920, 15 s, sem música) de um produto da loja, para TikTok/Reels/Pinterest.

Uso: python3 video_produto.py <produtos.json> <https://host> <id> [<id>...]   → saída em ./videos/
Se o produto tem vídeo da CJ (campo "video"), ele roda no quadro; senão, as fotos com zoom lento.
Texto em espanhol (público da Espanha): gancho → 3 pontos → preço + envio grátis + "link en la bio".
Sem "mais vendido", sem preço riscado, sem avaliação: só o que é verdade (regras da loja na UE).
Todo texto fica fora das faixas que o TikTok cobre (topo < 230, fundo > 1450, direita > 940).
A música entra no próprio TikTok/Instagram.
"""
import json, os, subprocess, sys, urllib.request
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
W, H, FPS, DUR = 1080, 1920, 30, 15.0
AZUL, ROSA, BRANCO = (15, 30, 68), (230, 46, 115), (255, 255, 255)
MIDIA_Y, MIDIA_H = 250, 900          # quadro do produto: y 250–1150
TXT_Y = 1190                         # textos: y 1190–1440
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')

# Textos revisados (o texto da CJ às vezes vem com inglês no meio). Sem entrada aqui, usa o da loja.
TEXTOS = {
    'FF10D3C0-679C-4C38-8F48-8961E85AE312': {
        'gancho': 'Lleva a tu perro a todas partes',
        'puntos': ['Transpirable y cómoda', 'Varios tamaños y colores', 'Para perros pequeños'],
        'legenda': 'Bolsa de viaje para perro 🐶 Transpirable y cómoda, en varios tamaños y colores. Ideal para perros pequeños y cachorros.',
        'tags': '#perros #perrospequeños #cachorros #viajarconperro #mascotas #accesoriosparaperros'},
    '1378250073569366016': {
        'gancho': 'Pasea con tu mascota a la espalda',
        'puntos': ['Para perros y gatos pequeños', 'Capacidad de 15 a 22 L', 'Tallas S y L'],
        'legenda': 'Mochila para mascotas 🐾 Para perros y gatos pequeños, de 15 a 22 L, en tallas S y L. Perfecta para paseos, viajes y el veterinario.',
        'tags': '#gatos #perros #mascotas #mochilaparamascotas #gatosdeinstagram #viajarconmascotas'},
    'C2D6A8F9-5B28-4E10-8D1A-D37C4D003C42': {
        'gancho': '¿Arena de gato por toda la casa?',
        'puntos': ['Atrapa la arena de las patas', 'Fácil de limpiar', 'Se seca rápido'],
        'legenda': 'Alfombrilla para arena de gato 🐱 Atrapa la arena de las patas para que no acabe por toda la casa. Fácil de limpiar y de secado rápido.',
        'tags': '#gatos #arenadegato #gatosdeinstagram #hogar #mascotas #trucosparagatos'},
    '2091008191094771714': {
        'gancho': '¿Tu mascota se aburre en casa?',
        'puntos': ['Juego interactivo', 'Para perros y gatos', 'Más ejercicio cada día'],
        'legenda': 'Varita de juego interactivo 🐾 Para jugar con tu perro o gato y que haga ejercicio cada día.',
        'tags': '#gatos #perros #juguetesparagatos #mascotas #gatosjugando #perrosfelices'},
    '1783438407037890560': {
        'gancho': 'El baño, sin estrés',
        'puntos': ['Para perros y gatos', 'Pelaje limpio y sano', 'Tres colores'],
        'legenda': 'Cepillo de baño para mascotas 🛁 Ayuda a mantener el pelaje limpio y sano de tu perro o gato. En tres colores.',
        'tags': '#perros #gatos #bañodeperro #cuidadodemascotas #mascotas #peluqueriacanina'},
    '1417420340908396544': {
        'gancho': 'Pasear sin agacharte',
        'puntos': ['Plegable, cabe en el bolso', 'Incluye 60 bolsas', 'Tres colores'],
        'legenda': 'Recogedor de heces plegable 🐶 Recoge sin agacharte y guárdalo en el bolso. Incluye 60 bolsas.',
        'tags': '#perros #paseoconperro #perrosdeespaña #mascotas #perrosfelices #tipsparaperros'},
    'C8049CD1-F0D3-4B8E-8EBD-8B7881656DC9': {
        'gancho': 'Agua para tu perro en cada paseo',
        'puntos': ['Portátil y ligera', 'Fácil de usar', 'Material antibacteriano'],
        'legenda': 'Taza de agua portátil 💧 Ligera y fácil de usar: agua para tu perro en cada paseo y excursión.',
        'tags': '#perros #paseoconperro #senderismoconperro #mascotas #perrosfelices #verano'},
    '1714195354230460416': {
        'gancho': 'Calentito todo el invierno',
        'puntos': ['Manta suave de fleece', 'Para perros y gatos', 'Varios tamaños y diseños'],
        'legenda': 'Manta de fleece para mascotas 🧸 Suave y calentita para el invierno. Para perros y gatos, en varios tamaños y diseños.',
        'tags': '#perros #gatos #invierno #mantaparaperros #mascotas #gatosdeinstagram'},
    '2407280815131620600': {
        'gancho': 'Un gatito que alegra tu casa',
        'puntos': ['Decoración divertida', 'Tamaño compacto', 'Fácil de limpiar'],
        'legenda': 'Juguete gato de pie 😺 Una decoración divertida para tu casa y tu gato. Compacto y fácil de limpiar.',
        'tags': '#gatos #gatosdeinstagram #decoracion #amantesdelosgatos #mascotas #regalos'},
    '1653041912300969984': {
        'gancho': '¿Tu perro come demasiado rápido?',
        'puntos': ['Hace que coma más despacio', 'Divertido e interactivo', 'Material seguro'],
        'legenda': 'Tazón comedor lento 🍽️ Ayuda a que tu mascota coma más despacio, de forma divertida y con material seguro.',
        'tags': '#perros #gatos #comederolento #saludanimal #mascotas #perrosfelices'},
    'FF10D3C0-679C-4C38-8F48-8961E85AE312@2': {
        'gancho': '¿Tu perro odia el transportín?',
        'puntos': ['Va a tu espalda, contigo', 'Cabeza fuera, tranquilo', 'Transpirable y cómoda'],
        'legenda': '¿Tu perro odia el transportín? 🐶 Con esta mochila va pegado a ti, con la cabeza fuera y tranquilo.',
        'tags': '#perros #perrosdeespaña #viajarconperro #perrospequeños #mascotas #metroconperro'},
    'FF10D3C0-679C-4C38-8F48-8961E85AE312@3': {
        'gancho': 'Metro, bus y tren con tu perro',
        'puntos': ['Manos libres', 'Tu perro seguro y cerca', 'Varios tamaños y colores'],
        'legenda': 'Metro, bus y tren con tu perro, con las manos libres 🚇🐶 Mochila transpirable en varios tamaños y colores.',
        'tags': '#perros #perrosdeespaña #viajarconperro #perrospequeños #mascotas #metroconperro'},
    'FF10D3C0-679C-4C38-8F48-8961E85AE312@4': {
        'gancho': 'Paseos largos sin cansarle',
        'puntos': ['Descansa cuando se cansa', 'Ideal para perros pequeños', 'Rutas, ciudad y viajes'],
        'legenda': 'Para paseos largos: cuando tu perro se cansa, descansa en la mochila 🐾 Ideal para perros pequeños.',
        'tags': '#perros #perrosdeespaña #viajarconperro #perrospequeños #mascotas #metroconperro'},
    'FF10D3C0-679C-4C38-8F48-8961E85AE312@5': {
        'gancho': 'Llévalo a todas partes',
        'puntos': ['Compras, terrazas y viajes', 'Cómoda para los dos', 'Envío gratis a España'],
        'legenda': 'Llévalo a todas partes: compras, terrazas, viajes 🐶❤️ Mochila cómoda para ti y para él.',
        'tags': '#perros #perrosdeespaña #viajarconperro #perrospequeños #mascotas #metroconperro'},
}

# Vídeo da CJ com marca d'água, legenda em chinês/inglês ou texto queimado: usa as fotos.
SO_FOTOS = {'C2D6A8F9-5B28-4E10-8D1A-D37C4D003C42', '2091008191094771714', 'C8049CD1-F0D3-4B8E-8EBD-8B7881656DC9'}


def fonte(peso, px):
    return ImageFont.truetype(str(AQUI / 'fontes' / f'Poppins-{peso}.ttf'), px)


def baixar(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(req, timeout=60).read()


def cobrir(img, w, h, zoom=1.0):
    """Recorta a imagem para preencher w×h (como object-fit: cover), com zoom no centro."""
    img = img.convert('RGB')
    esc = max(w / img.width, h / img.height) * zoom
    nw, nh = int(img.width * esc + 1), int(img.height * esc + 1)
    img = img.resize((nw, nh), Image.LANCZOS)
    x, y = (nw - w) // 2, (nh - h) // 2
    return img.crop((x, y, x + w, y + h))


def suave(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def quebrar(texto, f, largura):
    linhas, atual = [], ''
    for p in texto.split():
        tenta = (atual + ' ' + p).strip()
        if f.getlength(tenta) > largura and atual:
            linhas.append(atual); atual = p
        else:
            atual = tenta
    return linhas + [atual]


class Fotos:
    """Fotos com zoom lento e troca suave."""
    def __init__(self, urls):
        self.fotos = []
        for u in urls[:5]:
            try:
                self.fotos.append(Image.open(BytesIO(baixar(u))).convert('RGB'))
            except Exception as e:
                print('foto falhou', u, e)
        if not self.fotos:
            raise SystemExit('sem fotos')
        self.cada = DUR / len(self.fotos)

    def quadro(self, t):
        i = min(int(t / self.cada), len(self.fotos) - 1)
        r = (t - i * self.cada) / self.cada
        atual = cobrir(self.fotos[i], W, MIDIA_H, 1.0 + 0.08 * r)
        if i + 1 < len(self.fotos) and r > 0.88:  # mistura com a próxima no fim
            prox = cobrir(self.fotos[i + 1], W, MIDIA_H, 1.0)
            atual = Image.blend(atual, prox, suave((r - 0.88) / 0.12))
        return atual


class Video:
    """Vídeo da CJ recortado para o quadro, lido quadro a quadro pelo ffmpeg (repete se for curto)."""
    def __init__(self, url, pasta, variante=0):
        arq = pasta / 'cj.mp4'
        arq.write_bytes(baixar(url))
        # variantes do mesmo produto: começa em outro ponto, espelha e aproxima, para não sair vídeo repetido
        zoom = 1 + 0.12 * (variante % 3)
        filtro = (f'scale={int(W * zoom)}:{int(MIDIA_H * zoom)}:force_original_aspect_ratio=increase,crop={W}:{MIDIA_H},fps={FPS}'
                  + (',hflip' if variante % 2 else ''))
        self.p = subprocess.Popen([FFMPEG, '-v', 'error', '-stream_loop', '-1', '-ss', str(5 * variante), '-i', str(arq), '-t', str(DUR),
                                   '-vf', filtro, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
        self.ultimo = Image.new('RGB', (W, MIDIA_H), AZUL)

    def quadro(self, t):
        b = self.p.stdout.read(W * MIDIA_H * 3)
        if len(b) == W * MIDIA_H * 3:
            self.ultimo = Image.frombytes('RGB', (W, MIDIA_H), b)
        return self.ultimo


def fundo(marca):
    img = Image.new('RGB', (W, H), AZUL)
    d = ImageDraw.Draw(img)
    try:
        logo = Image.open(AQUI.parent / 'SITE-LEUNAMESOFTWARE' / 'img' / 'emblema-192.png').convert('RGBA').resize((96, 96))
        img.paste(logo, (60, 120), logo)
        x = 172
    except Exception:
        x = 60
    d.text((x, 168), marca, font=fonte('ExtraBold', 58), fill=BRANCO, anchor='lm')
    return img


def camada_texto(cena, info, preco):
    """Desenha o texto da cena numa camada transparente (y TXT_Y…1440, x 60…920)."""
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    if cena == 0:
        f = fonte('ExtraBold', 76)
        y = TXT_Y + 10
        for l in quebrar(info['gancho'], f, 860):
            d.text((60, y), l, font=f, fill=BRANCO); y += 92
    elif cena in (1, 2, 3):
        f = fonte('Bold', 58)
        for k, p in enumerate(info['puntos'][:cena]):
            y = TXT_Y + 15 + k * 82
            d.ellipse((60, y + 14, 100, y + 54), fill=ROSA)
            d.line((70, y + 34, 78, y + 43, 92, y + 25), fill=BRANCO, width=6)
            d.text((122, y), p, font=f, fill=BRANCO)
    else:
        d.text((60, TXT_Y), preco, font=fonte('ExtraBold', 120), fill=ROSA)
        d.text((60, TXT_Y + 150), 'Envío gratis a España', font=fonte('Bold', 52), fill=BRANCO)
        d.rounded_rectangle((60, TXT_Y + 232, 520, TXT_Y + 300), 34, fill=ROSA)
        d.text((290, TXT_Y + 266), 'Link en la bio', font=fonte('Bold', 40), fill=BRANCO, anchor='mm')
    return c


# Linha do tempo: gancho 0–3,5 s; pontos 3,5–11 s (um a cada 2,5 s); preço 11–15 s.
CENAS = [(0, 0.0), (1, 3.5), (2, 6.0), (3, 8.5), (4, 11.0)]


def cena_em(t):
    atual = CENAS[0]
    for c in CENAS:
        if t >= c[1]:
            atual = c
    return atual


def fazer(prod, host, marca, saida, chave=None):
    pid = prod['id']
    chave = chave or pid   # "id@2", "id@3"…: o mesmo produto com outro gancho (vários vídeos do mesmo produto)
    es = prod['es']
    info = TEXTOS.get(chave) or TEXTOS.get(pid) or {'gancho': es.get('gancho') or es['nombre'], 'puntos': es.get('puntos', [])[:3],
                               'legenda': es['nombre'] + '. ' + es.get('descripcion', ''), 'tags': '#mascotas #perros #gatos'}
    preco = f"{prod['precio']:.2f} €".replace('.', ',')
    pasta = saida / chave
    pasta.mkdir(parents=True, exist_ok=True)
    video = '' if pid in SO_FOTOS else (prod.get('video') or '')
    midia = None
    if video:
        try:
            midia = Video(video if '://' in video else host + video, pasta, int(chave.split('@')[1]) - 1 if '@' in chave else 0)
        except Exception as e:
            print('vídeo da CJ falhou, usando fotos:', e)
    if midia is None:
        midia = Fotos([u if '://' in u else host + '/' + u.lstrip('/') for u in prod['imagenes']])

    base = fundo(marca)
    camadas = {c: camada_texto(c, info, preco) for c, _ in CENAS}
    nome = pasta / 'video.mp4'
    enc = subprocess.Popen([FFMPEG, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                            '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
                            '-movflags', '+faststart', str(nome)], stdin=subprocess.PIPE)
    capa = None
    for i in range(int(DUR * FPS)):
        t = i / FPS
        q = base.copy()
        q.paste(midia.quadro(t), (0, MIDIA_Y))
        c, ini = cena_em(t)
        alfa = suave((t - ini) / 0.35)  # texto entra com fade
        cam = camadas[c]
        if alfa < 1:
            cam = cam.copy(); cam.putalpha(cam.getchannel('A').point(lambda a: int(a * alfa)))
        q = Image.alpha_composite(q.convert('RGBA'), cam).convert('RGB')
        if c == 4 and capa is None and t >= ini + 0.5:
            capa = q
        enc.stdin.write(q.tobytes())
    enc.stdin.close(); enc.wait()
    (capa or q).save(pasta / 'capa.jpg', quality=88)
    link = f"{host}/producto.html?id={pid}"
    (pasta / 'legenda.txt').write_text(
        f"{info['legenda']}\n\n{preco} · Envío gratis a España\n👉 Link en la bio\n\n{info['tags']}\n\n"
        f"(Pinterest: use el link directo {link})\n", encoding='utf-8')
    print('ok', pid, nome)


def main():
    prods = {p['id']: p for p in json.loads(Path(sys.argv[1]).read_text())}
    host = sys.argv[2].rstrip('/')
    marca = 'LeunaPets' if 'pets.' in host else 'Cachik'
    saida = Path('videos')
    for chave in sys.argv[3:]:
        pid = chave.split('@')[0]
        if pid not in prods:
            print('não achei', pid); continue
        fazer(prods[pid], host, marca, saida, chave)


if __name__ == '__main__':
    main()
