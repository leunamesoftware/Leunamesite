#!/usr/bin/env python3
"""Robô da loja Europa (leunamesoftware.com) — busca produtos na CJ Dropshipping.

Roda no GitHub Actions (workflow "Deploy Site LeuName Softwares") todo dia.
Precisa do segredo CJ_API_KEY (o dono põe em GitHub → Settings → Secrets).
Nunca coloque a chave aqui no código.

Gera dentro de SITE-LEUNAMESOFTWARE/:
  catalogo-cj.json  → novidades achadas (armazém na Europa, baratas, com custo,
                       frete para 9 países da UE e preço sugerido). Aparece em
                       /novidades.html (página só do dono).
  produtos.json     → só os produtos APROVADOS (ferramentas-loja/aprovados.json),
                       com nome/descrição em espanhol e português. É o que a loja vende.

Sem CJ_API_KEY: mantém o que já existe (ou grava listas vazias).
"""
import json, math, os, sys, time, urllib.request, urllib.parse

AQUI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(AQUI, '..', 'SITE-LEUNAMESOFTWARE')
API = 'https://developers.cjdropshipping.com/api2.0/v1'

ARMAZENS = ['ES', 'DE', 'FR', 'IT', 'PL', 'CZ']          # estoque na Europa = chega rápido
DESTINOS = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'IE']   # maiores mercados da UE
BUSCAS = ['pet hair remover', 'cat water fountain', 'pet feeder', 'dog bed', 'cat bed', 'cat scratcher',
          'interactive cat toy', 'dog toy', 'dog leash', 'dog harness', 'pet grooming', 'pet bowl',
          'cat litter', 'pet blanket']
CUSTO_MAX_USD = 15        # produto barato
USD_EUR = 0.93
MAX_DETALHES = 40         # quantos candidatos detalhar (1 chamada/s na CJ)


class CJ:
    def __init__(self, chave):
        self.token = None
        self.ultimo = 0
        r = self.req('POST', '/authentication/getAccessToken', {'apiKey': chave}, auth=False)
        self.token = (r.get('data') or {}).get('accessToken')
        if not self.token:
            raise SystemExit('CJ: não consegui o token (%s)' % r.get('message'))

    def req(self, metodo, caminho, corpo=None, params=None, auth=True):
        espera = 1.15 - (time.time() - self.ultimo)        # limite: 1 chamada por segundo
        if espera > 0:
            time.sleep(espera)
        url = API + caminho + ('?' + urllib.parse.urlencode(params) if params else '')
        dados = json.dumps(corpo).encode() if corpo is not None else None
        h = {'Content-Type': 'application/json'}
        if auth:
            h['CJ-Access-Token'] = self.token
        for tentativa in range(3):
            try:
                self.ultimo = time.time()
                with urllib.request.urlopen(urllib.request.Request(url, dados, h, method=metodo), timeout=40) as r:
                    return json.loads(r.read().decode())
            except Exception as e:                       # rede/limite: espera e tenta de novo
                print('  aviso CJ', caminho, e, file=sys.stderr)
                time.sleep(3 + tentativa * 3)
        return {}


def num(v):
    try:
        if isinstance(v, str) and '--' in v:            # faixa "1.2 -- 3.4": pega a maior
            v = v.split('--')[-1]
        return float(v)
    except Exception:
        return None


def preco_venda(custo_eur):
    p = max(custo_eur * 2.0, custo_eur + 8)             # margem mínima de ~8 €
    return math.ceil(p) - 0.01                           # 19,99 · 24,99 …


def videos_de(d):
    v = d.get('productVideo') or d.get('videoList') or []
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except Exception:
            v = [v]
    out = []
    for x in v if isinstance(v, list) else []:
        if isinstance(x, dict):
            x = x.get('videoUrl') or x.get('url') or x.get('id') or ''
        if x:
            out.append(str(x))
    return out


def imagens_de(d):
    s = d.get('productImageSet') or []
    if isinstance(s, str):
        try:
            s = json.loads(s)
        except Exception:
            s = [s]
    imgs = [d.get('bigImage')] + list(s)
    vistos, out = set(), []
    for i in imgs:
        if i and i not in vistos:
            vistos.add(i); out.append(i)
    return out[:8]


def detalhar(cj, pid, armazem):
    r = cj.req('GET', '/product/query', params={'pid': pid, 'features': 'enable_video'})
    d = r.get('data') or {}
    if not d:
        return None
    variantes = d.get('variants') or []
    if not variantes:
        return None
    vid = variantes[0].get('vid')
    custo = num(variantes[0].get('variantSellPrice')) or num(d.get('sellPrice'))
    if not custo:
        return None
    fretes = {}
    for destino in DESTINOS:
        f = cj.req('POST', '/logistic/freightCalculate', {
            'startCountryCode': armazem, 'endCountryCode': destino,
            'products': [{'quantity': 1, 'vid': vid}]})
        ops = [o for o in (f.get('data') or []) if num(o.get('logisticPrice')) is not None]
        if not ops:
            return None                                  # não entrega nesse país
        o = min(ops, key=lambda o: num(o['logisticPrice']))
        fretes[destino] = {'usd': num(o['logisticPrice']), 'prazo': o.get('logisticAging') or '',
                           'transportadora': o.get('logisticName') or ''}
    frete = max(v['usd'] for v in fretes.values())
    custo_eur = round((custo + frete) * USD_EUR, 2)
    return {
        'id': d.get('pid') or pid,
        'sku': d.get('productSku') or '',
        'vid': vid,
        'nomeEn': d.get('productNameEn') or '',
        'categoria': d.get('categoryName') or '',
        'armazem': armazem,
        'custoProdutoUsd': custo,
        'fretes': fretes,
        'custoTotalEur': custo_eur,
        'precoSugerido': preco_venda(custo_eur),
        'imagens': imagens_de(d),
        'videos': videos_de(d),
        'variantes': [{'vid': v.get('vid'), 'nome': v.get('variantNameEn') or v.get('variantKey') or '',
                       'img': v.get('variantImage') or '', 'custoUsd': num(v.get('variantSellPrice'))}
                      for v in variantes[:12]],
        'linkCJ': 'https://cjdropshipping.com/product/-p-%s.html' % (d.get('pid') or pid),
    }


def ler(nome, padrao):
    try:
        with open(nome, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return padrao


def gravar(nome, dados):
    with open(os.path.join(SITE, nome), 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, separators=(',', ':'))


def pior_prazo(fretes):
    fim = 0
    ini = 99
    for v in fretes.values():
        nums = [int(x) for x in __import__('re').findall(r'\d+', str(v.get('prazo') or ''))]
        if nums:
            ini = min(ini, nums[0]); fim = max(fim, nums[-1])
    return '%d-%d' % (ini, fim) if fim else ''


def montar_loja(aprovados, por_id):
    loja = []
    for pid, a in aprovados.items():
        c = por_id.get(pid)
        if not c or a.get('pausado'):
            continue
        prazo = pior_prazo(c['fretes'])
        loja.append({
            'id': pid,
            'es': a['es'], 'pt': a['pt'], 'en': a.get('en') or a['es'],
            'categoria': a.get('categoria', 'juguetes'),
            'animal': a.get('animal', 'ambos'),
            'nuevo': bool(a.get('nuevo')),
            'precio': a.get('precio') or c['precoSugerido'],
            'imagenes': a.get('imagenes') or c['imagens'],
            'video': next((v for v in c['videos'] if v.startswith('http')), ''),
            'plazo': a.get('plazo') or prazo,
            'destaque': bool(a.get('destaque')),
        })
    return loja


def main():
    chave = os.environ.get('CJ_API_KEY', '').strip()
    aprovados = ler(os.path.join(AQUI, 'aprovados.json'), {})
    if not chave:
        print('Sem CJ_API_KEY: robô da CJ não rodou.')
        for nome in ('catalogo-cj.json', 'produtos.json'):
            if not os.path.exists(os.path.join(SITE, nome)):
                gravar(nome, [] if nome == 'produtos.json' else {'atualizado': None, 'itens': []})
        return
    cj = CJ(chave)
    candidatos = {}
    for armazem in ARMAZENS:
        for busca in BUSCAS:
            r = cj.req('GET', '/product/listV2', params={
                'keyWord': busca, 'countryCode': armazem, 'page': 1, 'size': 20,
                'features': 'enable_video'})
            blocos = ((r.get('data') or {}).get('content') or [])
            for b in blocos:
                for p in b.get('productList') or []:
                    preco = num(p.get('sellPrice'))
                    if not p.get('id') or preco is None or preco > CUSTO_MAX_USD:
                        continue
                    nota = (2 if str(p.get('isVideo')) == '1' else 0) + (1 if preco <= 8 else 0)
                    candidatos.setdefault(p['id'], (nota, armazem))
        print('armazém', armazem, '→', len(candidatos), 'candidatos')
    # aprovados sempre são atualizados, mesmo que não apareçam na busca de hoje
    antigos = {c['id']: c for c in ler(os.path.join(SITE, 'catalogo-cj.json'), {}).get('itens', [])}
    fila = [(9, pid, (antigos.get(pid) or {}).get('armazem') or a.get('armazem') or 'DE')
            for pid, a in aprovados.items()]
    fila += sorted(((n, pid, arm) for pid, (n, arm) in candidatos.items() if pid not in aprovados),
                   reverse=True)[:MAX_DETALHES]
    itens = []
    for _, pid, armazem in fila:
        d = detalhar(cj, pid, armazem)
        if d:
            d['aprovado'] = pid in aprovados
            itens.append(d)
    por_id = {c['id']: c for c in itens}
    for pid in aprovados:                                 # se a CJ falhou hoje, mantém o de ontem
        if pid not in por_id and pid in antigos:
            por_id[pid] = antigos[pid]
    gravar('catalogo-cj.json', {'atualizado': time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime()),
                                'itens': list(por_id.values())})
    loja = montar_loja(aprovados, por_id)
    gravar('produtos.json', loja)
    print('ok:', len(por_id), 'no catálogo CJ,', len(loja), 'à venda')


if __name__ == '__main__':
    main()
