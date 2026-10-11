#!/usr/bin/env python3
"""Gera js/catalogo.js (produtos do site) a partir dos dados reais da loja.

Uso: python3 ferramentas/gerar_catalogo.py <pasta leuapps/public do repositório leuname-softwarea-apps>
Fonte única: apps.json, servicos.json e cursos.json da loja. Rode de novo quando um app mudar.
"""
import json
import re
import sys
from pathlib import Path

base = Path(sys.argv[1])
site = Path(__file__).resolve().parent.parent
apps = json.loads((base / 'apps.json').read_text())
servicos = json.loads((base / 'servicos.json').read_text())
cursos = json.loads((base / 'cursos.json').read_text())

# Categoria de cada app no site. Delivery Pedêê fica "Em breve" até o dono liberar.
CATEGORIA = {'gestacell': 'pdv', 'mercagestao': 'pdv', 'construgestao': 'pdv',
             'leuburger': 'delivery', 'pedee': 'delivery', 'pedee-entregador': 'delivery',
             'quantocobrar': 'receitas', 'radar': 'utilidades'}
EM_BREVE = {'leuburger', 'pedee', 'pedee-entregador'}


def valor(preco):
    m = re.search(r'R\$\s*([\d.]+,\d{2})', preco or '')
    return float(m.group(1).replace('.', '').replace(',', '.')) if m else 0.0


produtos = []
for a in apps:
    if a.get('emBreve') or a['id'] not in CATEGORIA:
        continue
    planos = [{'nome': p['nome'], 'preco': p['preco'], 'detalhe': p.get('detalhe', ''), 'url': p['url'], 'tipo': p.get('tipo', '')} for p in a.get('planos', [])]
    precos = [valor(p['preco']) for p in planos if valor(p['preco'])]
    menor = min(planos, key=lambda p: valor(p['preco']) or 1e9) if planos else None
    em_breve = a['id'] in EM_BREVE
    produtos.append({
        'id': a['id'], 'kind': 'app', 'name': a['nome'], 'category': CATEGORIA[a['id']],
        'price': min(precos) if precos else 0,
        'priceText': 'Em breve' if em_breve else (f"a partir de {menor['preco']}" if menor else 'Grátis'),
        'trial': '' if em_breve else (f"{a['teste']} dias grátis" if a.get('teste') else (a['preco'].split(' · ')[0] if 'grátis' in a.get('preco', '').split(' · ')[0] else '')),
        'short': a.get('resumo', ''), 'description': a.get('descricao', ''),
        'features': a.get('recursos', []), 'plans': [] if em_breve else planos,
        'imageUrl': (a.get('destaque') or {}).get('imagem'), 'icon': a.get('icone'),
        'photos': a.get('capturas', []),
        'installUrl': None if em_breve else ('/instalar/' + a['id'] if a.get('instalar') else a.get('url')),
        'emBreve': em_breve, 'tag': 'novedad' if a.get('novidades') and not em_breve else None,
    })

# PDV de lanchonete e pizzaria: pronto no caixa, falta o nome novo da marca.
produtos.append({'id': 'pdv-lanchonete', 'kind': 'app', 'name': 'PDV Lanchonete e Pizzaria', 'category': 'pdv', 'price': 0,
                 'priceText': 'Em breve', 'trial': '', 'short': 'Caixa, pedidos, comandas e estoque para lanchonete, hamburgueria e pizzaria.',
                 'description': 'PDV completo para lanchonete, hamburgueria e pizzaria: caixa, pedidos, adicionais, comprovante, estoque e relatórios. Em breve.',
                 'features': ['Caixa e pedidos', 'Adicionais e opções', 'Comprovante', 'Estoque', 'Relatórios'], 'plans': [],
                 'imageUrl': '/img/destaques/leuburger.webp', 'icon': '/img/leuburger-192.png', 'photos': [], 'installUrl': None, 'emBreve': True, 'tag': None})

zap = servicos.get('whatsapp', '5524998721557')
for s in servicos.get('itens', []):
    produtos.append({'id': 'servico-' + s['id'], 'kind': 'servico', 'name': s['nome'] + ' sob encomenda',
                     'category': 'sites' if s['id'] == 'templates' else 'design', 'price': 0, 'priceText': 'Orçamento grátis', 'trial': '',
                     'short': s['resumo'], 'description': s['resumo'] + ' Criamos do zero, com a sua marca. Peça o orçamento pelo WhatsApp.',
                     'features': [], 'plans': [], 'imageUrl': s['imagens'][0], 'icon': None, 'photos': s['imagens'],
                     'installUrl': None, 'emBreve': False, 'tag': None,
                     'whatsapp': f"https://wa.me/{zap}?text=" + re.sub(' ', '%20', f"Olá, LeuName Softwares! Vim pelo site e quero um orçamento de {s['nome'].lower()}.")})

for c in cursos:
    if c.get('emBreve'):
        continue
    produtos.append({'id': 'curso-' + c['id'], 'kind': 'curso', 'name': c['nome'], 'category': 'cursos', 'price': 0,
                     'priceText': c.get('preco', 'Grátis'), 'trial': '', 'short': c.get('resumo', ''), 'description': c.get('resumo', ''),
                     'features': [f"{len(c.get('aulas', []))} {c.get('unidade', 'aulas')}"], 'plans': [],
                     'imageUrl': None, 'icon': c.get('icone'), 'photos': [], 'installUrl': '/apps#curso/' + c['id'],
                     'emBreve': False, 'tag': None})

saida = site / 'js' / 'catalogo.js'
saida.write_text('/* Gerado por ferramentas/gerar_catalogo.py a partir da loja (apps.json, servicos.json, cursos.json). Não edite à mão. */\n'
                 'window.LEU_CATALOGO = ' + json.dumps(produtos, ensure_ascii=False, indent=1) + ';\n')
print(f'{len(produtos)} produtos em {saida}')
