#!/usr/bin/env python3
"""Publica um lote de produtos numa loja pelo painel (a mesma API que o dono usa no celular).

Para cada busca: pega os mais populares da CJ, confere frete/lucro e publica o 1º que passar.
Uso (GitHub Actions): LOJA_ADMIN_SENHA=... python3 publicar_lote.py casa
A senha vem do segredo do GitHub; nunca no código.
"""
import json, os, sys, time, urllib.request, urllib.parse

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


def preco_rapido(custo_eur):
    # preço baixo para vender rápido: sobra ~5 € depois do custo (produto+frete+IVA) e das taxas (7% + 0,35)
    import math
    return math.ceil((custo_eur + 5.0 + 0.35) / 0.93) - 0.01


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


def main():
    senha = os.environ['LOJA_ADMIN_SENHA']
    tk = api('login', {'senha': senha}).get('token')
    if not tk:
        sys.exit('login falhou')
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
            if d.get('erro') or not d.get('entregaTodos') or not d.get('sugerido'):
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
