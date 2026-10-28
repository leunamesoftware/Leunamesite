#!/usr/bin/env python3
"""Publica um lote de produtos numa loja pelo painel (a mesma API que o dono usa no celular).

Para cada busca: pega os mais populares da CJ, confere frete/lucro e publica o 1º que passar.
Uso (GitHub Actions): LOJA_ADMIN_SENHA=... python3 publicar_lote.py casa
A senha vem do segredo do GitHub; nunca no código.
"""
import json, os, re, sys, time, urllib.request, urllib.parse

BASE = 'https://pets.leuname.com/api/painel/'
LOJA = sys.argv[1] if len(sys.argv) > 1 else 'casa'

LOTES = {
    'pets': [
        ('dog leash', 'paseo', True), ('dog harness', 'paseo', False), ('dog poop bag', 'paseo', False),
        ('pet water bottle', 'paseo', True), ('cat scratcher', 'rascadores', True), ('cat scratching board', 'rascadores', False),
        ('cat teaser wand', 'juguetes', False), ('dog chew toy', 'juguetes', False), ('cat ball toy', 'juguetes', True),
        ('pet grooming glove', 'higiene', True), ('pet hair remover', 'higiene', False), ('cat litter mat', 'higiene', False),
        ('pet bowl', 'comer', False), ('slow feeder bowl', 'comer', False), ('pet blanket', 'camas', False),
    ],
    'casa': [  # (busca na CJ, categoria, destaque) — 2º lote: completa ~30 produtos na Cachik
        ('led strip lights', 'luz', True), ('motion sensor light', 'luz', False), ('fairy lights', 'luz', False),
        ('solar lantern', 'jardin', False), ('garden hose nozzle', 'jardin', False), ('bird feeder', 'jardin', False),
        ('wall clock', 'deco', True), ('photo frame', 'deco', False), ('artificial flowers', 'deco', False),
        ('bath mat', 'textil', False), ('table runner', 'textil', False), ('pillow case', 'textil', False),
        ('spice rack', 'orden', False), ('shoe rack', 'orden', True), ('closet organizer', 'orden', False),
        ('kitchen gadgets', 'hogar', True), ('silicone kitchen utensils', 'hogar', False), ('soap dispenser', 'hogar', False),
        ('folding stool', 'muebles', False), ('bedside table organizer', 'muebles', False),
    ],
}
LUCRO_MIN, PRECO_MAX, CUSTO_MAX_USD = 4.0, 39.99, 10

# modo "barato": produtos bem baratos (o dono paga a CJ do bolso sem sofrer), preço final até ~15 €
BARATOS = {
    'pets': [
        ('cat toy ball', 'juguetes'), ('cat feather toy', 'juguetes'), ('dog rope toy', 'juguetes'), ('squeaky dog toy', 'juguetes'),
        ('cat catnip toy', 'juguetes'), ('cat tunnel', 'juguetes'), ('dog chew toy', 'juguetes'), ('cat teaser wand', 'juguetes'),
        ('mouse toy cat', 'juguetes'), ('dog ball launcher', 'juguetes'),
        ('pet collar', 'paseo'), ('dog poop bag dispenser', 'paseo'), ('pet bandana', 'paseo'), ('dog leash', 'paseo'),
        ('cat collar bell', 'paseo'), ('pet id tag', 'paseo'),
        ('pet comb', 'higiene'), ('pet nail clipper', 'higiene'), ('lint roller pet hair', 'higiene'), ('pet towel', 'higiene'),
        ('pet grooming glove', 'higiene'), ('pet hair remover', 'higiene'), ('pet toothbrush', 'higiene'),
        ('cat bowl', 'comer'), ('pet food scoop', 'comer'), ('pet food clip', 'comer'), ('pet feeding mat', 'comer'),
        ('slow feeder', 'comer'), ('pet blanket', 'camas'), ('cat scratcher', 'rascadores'), ('cat scratching board', 'rascadores'),
    ],
    'casa': [
        ('kitchen gadget', 'hogar'), ('silicone lid', 'hogar'), ('door stopper', 'hogar'), ('vegetable peeler', 'hogar'),
        ('bottle opener', 'hogar'), ('garlic press', 'hogar'), ('sink strainer', 'hogar'),
        ('drawer organizer', 'orden'), ('cable organizer', 'orden'), ('hook wall', 'orden'), ('storage basket', 'orden'),
        ('hanger', 'orden'), ('makeup organizer', 'orden'),
        ('led night light', 'luz'), ('mini lamp', 'luz'), ('led candle', 'luz'), ('sensor light', 'luz'),
        ('plant hanger', 'jardin'), ('seed starter', 'jardin'), ('plant pot', 'jardin'), ('garden gloves', 'jardin'),
        ('wall sticker', 'deco'), ('artificial succulent', 'deco'), ('coaster', 'deco'), ('vase', 'deco'), ('photo frame', 'deco'),
        ('dish towel', 'textil'), ('pillow cover', 'textil'), ('placemat', 'textil'), ('cushion cover', 'textil'),
    ],
}
# modo "video": mais produtos baratos, SÓ os que têm vídeo (para postar no TikTok)
COM_VIDEO = {
    'pets': [('interactive cat toy', 'juguetes'), ('electric cat toy', 'juguetes'), ('cat laser toy', 'juguetes'), ('dog puzzle toy', 'juguetes'),
             ('dog squeaky ball', 'juguetes'), ('cat spring toy', 'juguetes'), ('rotating cat toy', 'juguetes'), ('dog tug toy', 'juguetes'),
             ('pet hair brush', 'higiene'), ('pet paw cleaner', 'higiene'), ('dog bath brush', 'higiene'), ('cat grooming brush', 'higiene'),
             ('pet water dispenser', 'comer'), ('pet feeder', 'comer'), ('dog lick mat', 'comer'), ('portable dog water bottle', 'paseo'),
             ('retractable dog leash', 'paseo'), ('led dog collar', 'paseo'), ('cat window perch', 'camas'), ('cat scratching post', 'rascadores'),
             ('cat wall toy', 'juguetes'), ('snuffle mat', 'comer')],
    'casa': [('kitchen gadget', 'hogar'), ('led light', 'luz'), ('storage', 'orden'), ('organizer', 'orden'), ('decor', 'deco')],
}
BARATO_CUSTO_USD, BARATO_PRECO_MAX, BARATO_CUSTO_TOTAL_EUR = 5.0, 14.99, 8.4


IOF = 0.035   # o dono paga a CJ com cartão brasileiro: IOF em cima do custo


def preco_rapido(custo_eur):
    # preço baixo para vender rápido: sobra ~5 € depois do custo (produto+frete+IVA+IOF) e das taxas da Stripe (7% + 0,35)
    import math
    preco = math.ceil((custo_eur * (1 + IOF) + 5.0 + 0.35) / 0.93) - 0.01
    return sem13(preco, custo_eur)


def sem13(preco, custo_eur):
    """O dono não quer o número 13 em preço: 13,xx vira 12,99 (se ainda sobra ~4,5 €) ou 14,49."""
    if 13 <= preco < 14:
        sobra = 12.99 - custo_eur * (1 + IOF) - (12.99 * 0.07 + 0.35)
        return 12.99 if sobra >= 4.5 else 14.49
    return preco


def api(rota, corpo=None, token=None, tentativas=3):
    sep = '&' if '?' in rota else '?'
    url = BASE + rota + sep + 'loja=' + LOJA
    h = {'Content-Type': 'application/json', 'User-Agent': 'publicar-lote'}
    if token:
        h['Authorization'] = 'Bearer ' + token
    dados = json.dumps(corpo).encode() if corpo is not None else None
    for t in range(tentativas):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, dados, h, method='POST' if corpo is not None else 'GET'), timeout=120) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            txt = e.read().decode()[:300]
            if e.code < 500 or t == tentativas - 1:
                return {'erro': e.code, 'detalhe': txt}
        except Exception as e:
            if t == tentativas - 1:
                return {'erro': 'rede', 'detalhe': str(e)}
        time.sleep(4)


def reprecificar(tk):
    """Produtos publicados pelo painel: põe o preço rápido (~5 € de lucro)."""
    rel = []
    for p in api('publicados', token=tk).get('itens', []):
        if not p.get('painel') or not p.get('custoEur') or not p.get('ativo'):
            continue
        novo = preco_rapido(p['custoEur'])
        if abs(novo - p['precio']) > 0.009:
            r = api('editar', {'id': p['id'], 'precio': novo}, token=tk)
            rel.append({'nome': p['nome'], 'antes': p['precio'], 'depois': novo, 'ok': bool(r.get('ok'))})
    return rel


def baratos(tk, so_video=False):
    """Publica 1 produto bem barato por busca: entre os populares, fica com o de menor custo total."""
    rel, feitos = [], set()
    for busca, cat in (COM_VIDEO if so_video else BARATOS)[LOJA]:
        r = api('buscar?q=' + urllib.parse.quote(busca), token=tk)
        itens = [i for i in r.get('itens', []) if not i.get('publicado') and i['pid'] not in feitos and i['custoUsd'] <= (6.0 if so_video else BARATO_CUSTO_USD)
                 and (i.get('video') or not so_video)]
        itens.sort(key=lambda i: (i.get('video', False), i['popularidade']), reverse=True)
        melhores, vistos = [], []
        for it in itens[:6]:
            d = api('detalhe?pid=' + urllib.parse.quote(it['pid']), token=tk)
            vistos.append(d.get('erro') or (d.get('custoEur'), d.get('entregaTodos')))
            if d.get('erro') or not d.get('entregaTodos') or not d.get('custoEur') or len(d.get('imagens', [])) < 2 or not nicho_ok(d):
                continue
            preco = preco_rapido(d['custoEur'])
            if preco <= BARATO_PRECO_MAX and d['custoEur'] <= BARATO_CUSTO_TOTAL_EUR:
                melhores.append((preco, -it['popularidade'], d))
        if not melhores:
            rel.append({'busca': busca, 'ok': False, 'candidatos': len(itens), 'vistos': vistos})
            print(rel[-1], flush=True)
            continue
        preco, _, d = min(melhores, key=lambda x: (x[0], x[1]))
        p = api('publicar', {'pid': d['pid'], 'categoria': cat, 'precio': preco, 'destaque': False, 'nuevo': True}, token=tk)
        feitos.add(d['pid'])
        rel.append({'busca': busca, 'ok': bool(p.get('ok')), 'nome': (p.get('produto') or {}).get('es', {}).get('nombre'),
                    'preco': preco, 'custo': d['custoEur'], 'lucro': p.get('lucro'), 'erro': p.get('detalhe') if not p.get('ok') else None})
        print(rel[-1], flush=True)
    return rel


# Trava de ramo: cada loja só vende produto do seu ramo. A CJ às vezes cadastra a categoria errada
# (coleira como "escritório", relógio de parede como "relógio de pulso"), então vale a categoria OU o nome em inglês,
# e nunca as palavras proibidas. Mesma regra no painel-api.js (nichoOk). Produto ruim específico: BLOQUEADOS.
NICHO = {
    'pets': {'cat': r'\bpet', 'nome': r'\b(pets?|dogs?|cats?|pupp(y|ies)|kittens?|kitty)\b',
             'proibido': r'\b(baby|babies|makeup|cosmetic|phone|laptop)\b'},
    'casa': {'cat': r'^(home|furniture|garden)',
             'nome': r'\b(home|house|kitchen|garden|wall|clock|lamp|light|lights|candle|storage|organi[sz]er|shelf|rack|hook|pillow|cushion|'
                     r'vase|plant|pot|flower|bath|towel|rug|mat|curtain|humidifier|diffuser|feeder|hose|decor|decoration|frame)\b',
             'proibido': r'\b(makeup|cosmetic|camping|camp|tent|travel|monitor|screen|phone|laptop|pets?|dogs?|cats?|halloween|blood|bloody)\b'},
}
BLOQUEADOS = {'casa': {'6AEF9586-CAE8-402F-A811-0C55A2BA3FED', '66DEB873-8417-4178-B144-B7AD1B45793D'}}


def nicho_ok(d, pid=None):
    n = NICHO[LOJA]
    if pid and pid in BLOQUEADOS.get(LOJA, set()):
        return False
    nome, cat = d.get('nomeEn') or '', d.get('categoriaCJ') or ''
    if re.search(n['proibido'], nome, re.I):
        return False
    return bool(re.search(n['cat'], cat, re.I) or re.search(n['nome'], nome, re.I))


def conferir_nicho(tk, tirar=False):
    """Confere cada produto ativo da loja com a categoria da CJ. tirar=True desativa os que não são do ramo
    (dá para voltar no painel)."""
    rel = []
    for p in api('publicados', token=tk).get('itens', []):
        if not p.get('ativo'):
            continue
        d = api('detalhe?pid=' + urllib.parse.quote(p['id']), token=tk)
        ok = nicho_ok(d, p['id']) if not d.get('erro') else None
        item = {'nome': p.get('nome'), 'id': p['id'], 'catCJ': d.get('categoriaCJ'), 'en': (d.get('nomeEn') or '')[:60], 'ok': ok}
        if tirar and ok is False:
            item['tirado'] = bool(api('editar', {'id': p['id'], 'ativo': False}, token=tk).get('ok'))
        rel.append(item)
        print(item, flush=True)
    return rel


def tirar_caros(tk, limite=15.0, manter=6):
    """A loja fica quase toda barata: dos produtos acima de 14,99 € fica só uns poucos (destaques primeiro,
    depois os mais em conta, nada acima de 30 €). Os outros são desativados — dá para voltar no painel."""
    caros = [p for p in api('publicados', token=tk).get('itens', []) if p.get('ativo') and p.get('precio', 0) > limite]
    caros.sort(key=lambda p: (not p.get('destaque'), p['precio']))
    fica = [p for p in caros if p['precio'] <= 30][:manter]
    ids = {p['id'] for p in fica}
    rel = [{'nome': p['nome'], 'preco': p['precio'], 'fica': True} for p in fica]
    for p in caros:
        if p['id'] in ids:
            continue
        r = api('editar', {'id': p['id'], 'ativo': False}, token=tk)
        rel.append({'nome': p['nome'], 'preco': p['precio'], 'tirado': bool(r.get('ok'))})
    return rel


def trinta(tk, quantos=30, preco_max=25.0, lucro_min=5.0):
    """Loja Portugal: fica só com os ~30 melhores (preço até 25 €, lucro de pelo menos 5 € depois do custo e da Stripe;
    destaque e vídeo primeiro, depois o maior lucro). Os outros são desativados (dá para voltar no painel)."""
    itens = [p for p in api('publicados', token=tk).get('itens', []) if p.get('ativo')]
    def lucro(p):
        c = p.get('custoEur') or 0
        return p['precio'] - c * (1 + IOF) - (p['precio'] * 0.07 + 0.35) if c else -99
    bons = [p for p in itens if p.get('precio', 0) <= preco_max and lucro(p) >= lucro_min]
    bons.sort(key=lambda p: (not p.get('destaque'), not p.get('video'), -lucro(p)))
    fica = bons[:quantos]
    ids = {p['id'] for p in fica}
    rel = [{'nome': p['nome'], 'preco': p['precio'], 'lucro': round(lucro(p), 2), 'fica': True} for p in fica]
    for p in itens:
        if p['id'] in ids:
            continue
        r = api('editar', {'id': p['id'], 'ativo': False}, token=tk)
        rel.append({'nome': p['nome'], 'preco': p['precio'], 'lucro': round(lucro(p), 2), 'tirado': bool(r.get('ok'))})
    return rel


def zerar(tk):
    """Tira TODOS os produtos da vitrine (ativo=0). Nada é apagado: dá para voltar no painel."""
    rel = []
    for p in api('publicados', token=tk).get('itens', []):
        if p.get('ativo'):
            r = api('editar', {'id': p['id'], 'ativo': False}, token=tk)
            rel.append({'nome': p['nome'], 'tirado': bool(r.get('ok'))})
    return rel


def portugues(tk, voltas=20):
    """Gera o texto em português de Portugal dos produtos ativos (5 por chamada, repete até acabar)."""
    rel = {'feitos': 0, 'falhas': []}
    for _ in range(voltas):
        r = api('retraduzir', {}, token=tk)
        rel['feitos'] += r.get('feitos', 0)
        rel['falhas'] = r.get('falhas', [])
        rel['restantes'] = r.get('restantes')
        print(r, flush=True)
        if not r.get('restantes') or (not r.get('feitos') and r.get('falhas')):
            break
    return rel


def main():
    senha = os.environ['LOJA_ADMIN_SENHA']
    tk = api('login', {'senha': senha}).get('token')
    if not tk:
        sys.exit('login falhou')
    if len(sys.argv) > 2 and sys.argv[2] in ('conferir-nicho', 'tirar-fora-do-nicho'):
        rel = conferir_nicho(tk, tirar=sys.argv[2] == 'tirar-fora-do-nicho')
        json.dump(rel, open('lote.json', 'w'), ensure_ascii=False, indent=1)
        api('sair', {}, token=tk)
        return
    if len(sys.argv) > 2 and sys.argv[2] in ('barato', 'video', 'tirar-caros', 'trinta', 'portugal', 'zerar'):
        rel = zerar(tk) if sys.argv[2] == 'zerar' else [trinta(tk), portugues(tk)] if sys.argv[2] == 'portugal' else trinta(tk) if sys.argv[2] == 'trinta' else tirar_caros(tk) if sys.argv[2] == 'tirar-caros' else baratos(tk, so_video=sys.argv[2] == 'video')
        print(rel)
        json.dump(rel, open('lote.json', 'w'), ensure_ascii=False, indent=1)
        api('sair', {}, token=tk)
        return
    if len(sys.argv) > 2 and sys.argv[2] == 'reprecificar':
        rel = reprecificar(tk)
        print(rel)
        json.dump(rel, open('lote.json', 'w'), ensure_ascii=False, indent=1)
        api('sair', {}, token=tk)
        return
    feitos, relatorio = set(), []
    for busca, cat, dest in LOTES[LOJA]:
        r = api('buscar?q=' + urllib.parse.quote(busca), token=tk)
        itens = [i for i in r.get('itens', []) if not i.get('publicado') and i['pid'] not in feitos and i['custoUsd'] <= CUSTO_MAX_USD]
        itens.sort(key=lambda i: (i.get('video', False), i['popularidade']), reverse=True)
        escolhido = None
        for it in itens[:4]:
            d = api('detalhe?pid=' + urllib.parse.quote(it['pid']), token=tk)
            if d.get('erro') or not d.get('entregaTodos') or not d.get('sugerido') or not nicho_ok(d):
                continue
            preco = preco_rapido(d['custoEur'])
            if preco > PRECO_MAX or len(d.get('imagens', [])) < 2:
                continue
            d['preco'] = preco
            escolhido = d
            break
        if not escolhido:
            relatorio.append({'busca': busca, 'ok': False})
            continue
        p = api('publicar', {'pid': escolhido['pid'], 'categoria': cat, 'precio': escolhido['preco'],
                             'destaque': dest, 'nuevo': True}, token=tk)
        feitos.add(escolhido['pid'])
        relatorio.append({'busca': busca, 'ok': bool(p.get('ok')), 'nome': (p.get('produto') or {}).get('es', {}).get('nombre'),
                          'preco': escolhido['preco'], 'custo': escolhido['custoEur'], 'lucro': p.get('lucro'), 'ia': p.get('ia'),
                          'video': bool((p.get('produto') or {}).get('video')), 'variacoes': len((p.get('produto') or {}).get('variantes') or []),
                          'erro': p.get('detalhe') if not p.get('ok') else None})
        print(relatorio[-1], flush=True)
    api('sair', {}, token=tk)
    json.dump(relatorio, open('lote.json', 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
