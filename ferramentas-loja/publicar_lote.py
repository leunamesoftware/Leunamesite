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
    'casa': [  # (busca na CJ, categoria, destaque)
        ('table lamp', 'luz', True), ('led night light', 'luz', False),
        ('solar garden light', 'jardin', True), ('plant pot', 'jardin', False),
        ('artificial plants', 'deco', True), ('vase', 'deco', False),
        ('cushion cover', 'textil', True), ('throw blanket', 'textil', False),
        ('storage box', 'orden', True), ('drawer organizer', 'orden', False),
        ('aroma diffuser', 'hogar', True), ('wall shelf', 'muebles', False),
    ],
}
LUCRO_MIN, PRECO_MAX, CUSTO_MAX_USD = 5.0, 49.99, 14


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


def main():
    senha = os.environ['LOJA_ADMIN_SENHA']
    tk = api('login', {'senha': senha}).get('token')
    if not tk:
        sys.exit('login falhou')
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
            if d['sugerido'] > PRECO_MAX or (d.get('lucro') or 0) < LUCRO_MIN or len(d.get('imagens', [])) < 2:
                continue
            escolhido = d
            break
        if not escolhido:
            relatorio.append({'busca': busca, 'ok': False})
            continue
        p = api('publicar', {'pid': escolhido['pid'], 'categoria': cat, 'precio': escolhido['sugerido'],
                             'destaque': dest, 'nuevo': True}, token=tk)
        feitos.add(escolhido['pid'])
        relatorio.append({'busca': busca, 'ok': bool(p.get('ok')), 'nome': (p.get('produto') or {}).get('es', {}).get('nombre'),
                          'preco': escolhido['sugerido'], 'lucro': p.get('lucro'), 'ia': p.get('ia'),
                          'video': bool((p.get('produto') or {}).get('video')), 'variacoes': len((p.get('produto') or {}).get('variantes') or []),
                          'erro': p.get('detalhe') if not p.get('ok') else None})
        print(relatorio[-1], flush=True)
    api('sair', {}, token=tk)
    json.dump(relatorio, open('lote.json', 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
