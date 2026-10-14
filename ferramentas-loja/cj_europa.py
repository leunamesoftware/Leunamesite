#!/usr/bin/env python3
"""Sonda os armazéns da CJ na Europa (Alemanha e Polônia).

Para cada busca, pega os produtos com estoque em DE/PL (listV2 com countryCode) e calcula o frete
saindo desse armazém até Espanha e Portugal (e outros países da UE). Grava europa.json (sem a chave).
Uso (GitHub Actions): CJ_API_KEY=... python3 cj_europa.py
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cj_sync import CJ, num

ARMAZENS = ['DE', 'PL']
DESTINOS = ['ES', 'PT', 'FR', 'IT', 'DE']
BUSCAS = {
    'pets': ['pet', 'dog', 'cat', 'dog toy', 'cat toy', 'pet bed', 'dog leash', 'cat litter', 'pet bowl', 'pet grooming',
             'cat scratcher', 'dog harness', 'pet hair', 'dog collar', 'pet water'],
    'casa': ['home', 'kitchen', 'storage', 'lamp', 'light', 'garden', 'decor', 'organizer', 'bathroom', 'cushion',
             'blanket', 'shelf', 'vase', 'solar', 'towel'],
}
POR_BUSCA = 12        # quantos produtos olhar por busca e armazém
MAX_DETALHE = 70      # quantos detalhar (frete) no total


def dias(txt):
    n = [int(x) for x in re.findall(r'\d+', str(txt or ''))]
    return max(n) if n else 99


def main():
    cj = CJ(os.environ['CJ_API_KEY'])
    vistos, cand = set(), []
    resumo = {}
    for loja, buscas in BUSCAS.items():
        for q in buscas:
            for arm in ARMAZENS:
                r = cj.req('GET', '/product/listV2', params={'keyWord': q, 'countryCode': arm, 'page': 1, 'size': POR_BUSCA})
                d = r.get('data') or {}
                resumo[f'{loja}|{q}|{arm}'] = d.get('totalRecords')
                for b in d.get('content') or []:
                    for p in b.get('productList') or []:
                        pid = p.get('id')
                        if not pid or pid in vistos:
                            continue
                        vistos.add(pid)
                        cand.append({'loja': loja, 'busca': q, 'armazem': arm, 'pid': pid, 'nome': (p.get('nameEn') or '').strip(),
                                     'custoUsd': num(p.get('sellPrice')), 'popularidade': int(p.get('listedNum') or 0),
                                     'tipo': p.get('productType'), 'img': p.get('bigImage')})
    print('candidatos', len(cand), flush=True)
    # mais baratos e populares primeiro (o dono quer produto barato que vende)
    cand.sort(key=lambda c: ((c['custoUsd'] or 999) > 15, -c['popularidade'], c['custoUsd'] or 999))
    det = []
    for c in cand[:MAX_DETALHE]:
        q = cj.req('GET', '/product/query', params={'pid': c['pid']})
        d = q.get('data') or {}
        vs = d.get('variants') or []
        if not vs:
            continue
        vid = vs[0].get('vid')
        c['vid'] = vid
        c['variantes'] = len(vs)
        c['custoVarUsd'] = num(vs[0].get('variantSellPrice'))
        c['estoque'] = [(i.get('countryCode') or i.get('areaEn'), i.get('totalInventory') or i.get('storageNum')) for i in (vs[0].get('inventories') or [])][:6] if isinstance(vs[0].get('inventories'), list) else None
        fr = {}
        for dst in DESTINOS:
            f = cj.req('POST', '/logistic/freightCalculate', {'startCountryCode': c['armazem'], 'endCountryCode': dst,
                                                              'products': [{'quantity': 1, 'vid': vid}]})
            ops = []
            for o in f.get('data') or []:
                tot = num(o.get('totalPostageFee')) or num(o.get('logisticPrice'))
                if tot is None:
                    continue
                ops.append({'nome': o.get('logisticName'), 'usd': tot, 'prazo': o.get('logisticAging'), 'dias': dias(o.get('logisticAging'))})
            fr[dst] = min(ops, key=lambda o: o['usd']) if ops else None
        c['fretes'] = fr
        det.append(c)
        print(c['loja'], c['armazem'], c['custoUsd'], {k: (v and (v['usd'], v['prazo'])) for k, v in fr.items()}, c['nome'][:50], flush=True)
    bons = [c for c in det if c['fretes'].get('ES') and c['fretes'].get('PT')]
    with open('europa.json', 'w') as fh:
        json.dump({'resumo': resumo, 'detalhados': det, 'entregaES_PT': len(bons)}, fh, ensure_ascii=False, indent=1)
    print('detalhados', len(det), 'entregam ES e PT', len(bons))


if __name__ == '__main__':
    main()
