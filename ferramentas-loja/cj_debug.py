#!/usr/bin/env python3
"""Diagnóstico da API da CJ (grava respostas resumidas em debug.json, sem a chave)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cj_sync import CJ, DESTINOS

def corta(x, n=3):
    if isinstance(x, dict):
        return {k: corta(v, n) for k, v in list(x.items())[:40]}
    if isinstance(x, list):
        return [corta(v, n) for v in x[:n]]
    return x

cj = CJ(os.environ['CJ_API_KEY'])
out = {}
for nome, params in [
    ('listV2_pet_DE', {'keyWord': 'pet', 'countryCode': 'DE', 'page': 1, 'size': 5}),
    ('listV2_pet_semPais', {'keyWord': 'pet', 'page': 1, 'size': 5}),
    ('listV2_catbed', {'keyWord': 'cat bed', 'page': 1, 'size': 5}),
]:
    out[nome] = corta(cj.req('GET', '/product/listV2', params=params))
for nome, params in [
    ('list_pet_DE', {'productNameEn': 'pet', 'countryCode': 'DE', 'pageNum': 1, 'pageSize': 5}),
    ('list_dogbed', {'productNameEn': 'dog bed', 'pageNum': 1, 'pageSize': 5}),
]:
    out[nome] = corta(cj.req('GET', '/product/list', params=params))
cat = cj.req('GET', '/product/getCategory')
out['categorias'] = [ (c.get('categoryFirstName'), [ (s.get('categorySecondName'), [(t.get('categoryId'), t.get('categoryName')) for t in s.get('categorySecondList', s.get('categoryThirdList', []))][:30]) for s in c.get('categoryFirstList', [])]) for c in (cat.get('data') or []) if 'pet' in json.dumps(c).lower()]
# frete de um produto qualquer achado
pid = None
for k in ('list_pet_DE', 'list_dogbed'):
    lst = ((out[k].get('data') or {}).get('list') or [])
    if lst: pid = lst[0].get('pid'); break
if pid:
    d = cj.req('GET', '/product/query', params={'pid': pid})
    vid = ((d.get('data') or {}).get('variants') or [{}])[0].get('vid')
    out['frete_pid'] = pid
    out['inventario'] = corta(((d.get('data') or {}).get('variants') or [{}])[0].get('inventories'), 10)
    for o in ('CN', 'DE'):
        for dst in DESTINOS:
            f = cj.req('POST', '/logistic/freightCalculate', {'startCountryCode': o, 'endCountryCode': dst, 'products': [{'quantity': 1, 'vid': vid}]})
            out[f'frete_{o}_{dst}'] = [(x.get('logisticName'), x.get('logisticPrice'), x.get('logisticAging')) for x in (f.get('data') or [])][:4] or f.get('message')
with open('debug.json', 'w') as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1)
print('ok')
