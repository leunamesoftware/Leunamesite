"""Cadastro das lojas drop da Europa (uma por subdomínio de leuname.com).

Para criar uma loja nova: copie o bloco da "casa", troque id/marca/host/cores/categorias/textos,
rode `python3 ferramentas-loja/gerar_paginas.py`, ponha o host no wrangler.toml (routes) e em
SITE-LEUNAMESOFTWARE/lojas.json (o Worker e o painel leem de lá).
"""
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(AQUI, '..', 'SITE-LEUNAMESOFTWARE')
PAISES_LD = '["DE","FR","ES","IT","NL","BE","AT","PT","IE"]'


def jsonld(marca, host, desc, logo):
    return ('{"@context":"https://schema.org","@type":"OnlineStore","name":"%s","url":"https://%s/","logo":"https://%s/%s",'
            '"description":"%s","areaServed":%s,"currenciesAccepted":"EUR","paymentAccepted":"Tarjeta, PayPal, Apple Pay, Google Pay"}'
            % (marca, host, host, logo, desc, PAISES_LD))


def lojas(t, ico):
    pets = {
        'id': 'pets', 'marca': 'LeunaPets', 'host': 'pets.leuname.com', 'dir': SITE,
        'cor': '#0F1E44', 'favicon': 'img/favicon.png', 'apple': 'img/emblema-192.png', 'css_extra': '',
        'icone': 'pata',
        'cats': [
            ('camas', 'cama', 'Camas', 'Camas', 'Beds'),
            ('comer', 'tigela', 'Comer y beber', 'Comer e beber', 'Food & water'),
            ('juguetes', 'bola', 'Juguetes', 'Brinquedos', 'Toys'),
            ('paseo', 'trela', 'Paseo', 'Passeio', 'Walks'),
            ('higiene', 'escova', 'Pelo e higiene', 'Pelo e higiene', 'Grooming'),
            ('rascadores', 'arranhador', 'Rascadores', 'Arranhadores', 'Scratchers'),
        ],
        'logo': '<a class="logo" href="./" aria-label="LeunaPets"><img class="logo-img" src="img/logo.webp" alt="LeunaPets" width="460" height="120"></a>',
        'busca': 'data-ph-es="¿Qué buscas para tu perro o tu gato?" data-ph-pt="O que procura para o seu cão ou gato?" data-ph-en="What are you looking for?"',
        'menu_extra': f'<a href="./?animal=perro">{ico("cao")}{t("Perros", "Cães", "Dogs")}</a><a href="./?animal=gato">{ico("gato")}{t("Gatos", "Gatos", "Cats")}</a>',
        'rodape_tx': ('Tienda especializada en perros y gatos. Productos bonitos y prácticos, enviados a toda Europa.',
                      'Loja especializada em cães e gatos. Produtos bonitos e práticos, enviados para toda a Europa.',
                      'A shop for dogs and cats only. Practical, beautiful products shipped across Europe.'),
        'novedades_sub': ('Elegidos uno a uno para tu mascota', 'Escolhidos um a um para o seu animal', 'Hand-picked for your pet'),
        'objeto': ('productos para perros y gatos', 'produtos para cães e gatos', 'products for dogs and cats'),
        'titulo': 'LeunaPets — Todo para tu perro y tu gato · Envío gratis en Europa',
        'desc': 'Camas, fuentes, juguetes y accesorios para perros y gatos con envío gratis a España, Portugal, Francia, Alemania, Italia, Países Bajos, Bélgica, Austria e Irlanda. 14 días para devolver.',
        'jsonld': jsonld('LeunaPets', 'pets.leuname.com', 'Tienda online especializada en productos para perros y gatos, con envío gratis a 9 países de Europa.', 'img/emblema-192.png'),
        'hero': lambda slides: f'''<section class="hero" aria-label="Destacado">
  {slides}
  <div class="preco-selo" id="desde" hidden><small>{t('Desde', 'Desde', 'From')}</small><b></b></div>
</section>''',
        'meio': f'''<section class="wrap animais">
  <a class="animal an-c" href="./?animal=perro"><div class="an-tx"><b>{t('Perros', 'Cães', 'Dogs')}</b><span>{t('Paseo, camas y juguetes para su bienestar.', 'Passeio, camas e brinquedos para o bem-estar dele.', 'Walks, beds and toys for their wellbeing.')}</span><em class="an-bt">{t('Ver productos', 'Ver produtos', 'Shop now')} {ico('seta')}</em></div><img src="img/card-perros.webp" alt="" loading="lazy"></a>
  <a class="animal an-g" href="./?animal=gato"><div class="an-tx"><b>{t('Gatos', 'Gatos', 'Cats')}</b><span>{t('Rascadores, fuentes y juegos para su felicidad.', 'Arranhadores, fontes e jogos para a felicidade dele.', 'Scratchers, fountains and play for their happiness.')}</span><em class="an-bt">{t('Ver productos', 'Ver produtos', 'Shop now')} {ico('seta')}</em></div><img src="img/card-gatos.webp" alt="" loading="lazy"></a>
</section>''',
        'porque': f'''<section class="wrap porque">
  <picture class="porque-foto"><source media="(max-width:720px)" srcset="img/familia-m.webp"><img src="img/familia.webp" alt="" loading="lazy"></picture>
  <div class="porque-tx">
    <h2>{t('¿Por qué LeunaPets?', 'Porquê a LeunaPets?', 'Why LeunaPets?')}</h2>
    <p>{t('Somos una tienda especializada solo en perros y gatos. Probamos y elegimos cada producto pensando en su bienestar y en tu casa.', 'Somos uma loja especializada só em cães e gatos. Escolhemos cada produto a pensar no bem-estar deles e na sua casa.', 'We are a shop specialised only in dogs and cats. Every product is chosen with their wellbeing and your home in mind.')}</p>
    <ul><li>{ico('camiao')}{t('Envío gratis con seguimiento a toda Europa', 'Envio grátis com seguimento para toda a Europa', 'Free tracked shipping across Europe')}</li>
    <li>{ico('volta')}{t('14 días para devolver', '14 dias para devolver', '14-day returns')}</li>
    <li>{ico('escudo')}{t('Pago seguro con tarjeta o PayPal', 'Pagamento seguro com cartão ou PayPal', 'Secure payment by card or PayPal')}</li></ul>
  </div>
</section>''',
    }

    # ---------------- Cachik: casa, jardim e decoração ----------------
    MC = 'Cachik'
    PC = os.path.join(SITE, '_lojas', 'casa')
    tem = lambda n: os.path.exists(os.path.join(PC, 'img', n))     # foto enviada pelo dono? usa; senão, colagem de produtos
    logo_casa = (f'<a class="logo" href="./" aria-label="{MC}"><img class="logo-img" src="img/logo.webp" alt="{MC}" width="460" height="120"></a>'
                 if tem('logo.webp') else
                 f'<a class="logo logo-txt" href="./" aria-label="{MC}"><span class="lc-ic">{ico("casa")}</span>'
                 f'<span class="lc-nome">Cach<b>ik</b><i>{t("Hogar · Jardín · Decoración", "Casa · Jardim · Decoração", "Home · Garden · Décor")}</i></span></a>')
    cel = ''.join(f'<span class="cel cel{k}"><span class="cel-ic">{ico(i, "bi")}</span></span>'
                  for k, i in enumerate(['sofa', 'planta', 'abajur', 'jarra']))

    def foto(nome, nome_m=None, cls=''):
        if not tem(nome):
            return ''
        m = f'<source media="(max-width:720px)" srcset="img/{nome_m}">' if nome_m and tem(nome_m) else ''
        return f'<picture class="{cls}">{m}<img src="img/{nome}" alt="" loading="lazy"></picture>'

    tem_banner = tem('banner.webp')
    hero_visual = foto('banner.webp', 'banner-m.webp', 'cb-foto') if tem_banner else f'<div class="colagem cb-colagem" data-colagem>{cel}</div>'
    casa = {
        'id': 'casa', 'marca': MC, 'host': 'cachik.leuname.com', 'dir': PC,
        'cor': '#16382A', 'favicon': 'img/favicon.png', 'apple': 'img/emblema-192.png',
        'css_extra': '\n<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="tema.css">', 'icone': 'casa',
        'cats': [
            ('hogar', 'sofa', 'Hogar', 'Casa', 'Home'),
            ('jardin', 'planta', 'Jardín', 'Jardim', 'Garden'),
            ('deco', 'jarra', 'Decoración', 'Decoração', 'Décor'),
            ('luz', 'abajur', 'Iluminación', 'Iluminação', 'Lighting'),
            ('muebles', 'movel', 'Muebles', 'Móveis', 'Furniture'),
            ('orden', 'caixa', 'Organización', 'Organização', 'Storage'),
            ('textil', 'textil', 'Textil', 'Têxtil', 'Textiles'),
        ],
        'logo': logo_casa,
        'busca': 'data-ph-es="Buscar productos…" data-ph-pt="Procurar produtos…" data-ph-en="Search products…"',
        'menu_extra': '',
        'rodape_tx': ('Hogar, jardín y decoración: ideas bonitas y prácticas para cada rincón, enviadas a toda Europa.',
                      'Casa, jardim e decoração: ideias bonitas e práticas para cada canto, enviadas para toda a Europa.',
                      'Home, garden and décor: beautiful, practical ideas for every corner, shipped across Europe.'),
        'novedades_sub': ('Elegidos para hacer tu casa más bonita', 'Escolhidos para deixar a sua casa mais bonita', 'Chosen to make your home lovelier'),
        'objeto': ('artículos de hogar, jardín y decoración', 'artigos de casa, jardim e decoração', 'home, garden and décor products'),
        'titulo': f'{MC} — Hogar, jardín y decoración · Envío gratis en Europa',
        'desc': 'Decoración, iluminación, muebles, organización, textil y jardín con envío gratis a España, Portugal, Francia, Alemania, Italia, Países Bajos, Bélgica, Austria e Irlanda. 14 días para devolver.',
        'jsonld': jsonld(MC, 'cachik.leuname.com', 'Tienda online de hogar, jardín y decoración, con envío gratis a 9 países de Europa.', 'img/emblema-192.png'),
        'hero': f'''<section class="hero hero-cachik{' com-foto' if tem_banner else ''}" aria-label="Destacado">
  {hero_visual}
  <div class="wrap cb-tx">
    <p class="cb-sobre">{t('Hogar · Jardín · Decoración', 'Casa · Jardim · Decoração', 'Home · Garden · Décor')}</p>
    <h1>{t('Espacios<br>que inspiran', 'Espaços<br>que inspiram', 'Spaces<br>that inspire')}</h1>
    <p class="hero-p">{t('Todo para hacer de tu hogar un lugar más cómodo, bonito y tuyo.', 'Tudo para fazer da sua casa um lugar mais confortável, bonito e seu.', 'Everything to make your home cosier, lovelier and truly yours.')}</p>
    <a class="bt bt-oro" href="#novedades">{t('Descubrir ahora', 'Descobrir agora', 'Discover now')} {ico('seta')}</a>
  </div>
  <div class="preco-selo" id="desde" hidden><small>{t('Desde', 'Desde', 'From')}</small><b></b></div>
</section>''',
        'meio': f'''<section class="wrap colecoes">
  <a class="col col-escura" href="./?cat=deco">{foto('colecao-hogar.webp', cls='col-foto') or f'<span class="col-foto col-vazia" data-colagem-cat="deco">{ico("abajur", "bi")}</span>'}
    <div class="col-tx"><p class="cb-sobre">{t('Decoración para cada estilo', 'Decoração para cada estilo', 'Décor for every style')}</p><h2>{t('Hogar con<br>más vida', 'Casa com<br>mais vida', 'A home with<br>more life')}</h2><em class="bt bt-oro">{t('Ver colección', 'Ver coleção', 'See collection')} {ico('seta')}</em></div></a>
  <a class="col col-clara" href="./?cat=jardin">{foto('colecao-jardin.webp', cls='col-foto') or f'<span class="col-foto col-vazia" data-colagem-cat="jardin">{ico("planta", "bi")}</span>'}
    <div class="col-tx"><p class="cb-sobre">{t('Jardín y exterior', 'Jardim e exterior', 'Garden & outdoor')}</p><h2>{t('Disfruta<br>tu espacio', 'Aproveite<br>o seu espaço', 'Enjoy<br>your space')}</h2><em class="bt bt-oro">{t('Ver jardín', 'Ver jardim', 'See garden')} {ico('seta')}</em></div></a>
</section>''',
        'porque': f'''<section class="faixa-cachik{' com-foto' if tem('banner-baixo.webp') else ''}">
  {foto('banner-baixo.webp', cls='fx-foto') or f'<div class="colagem fx-colagem" data-colagem>{cel}</div>'}
  <div class="wrap fx-tx"><p class="cb-sobre">{t('Ideas para tu hogar', 'Ideias para a sua casa', 'Ideas for your home')}</p><h2>{t('Decoración<br>que transforma', 'Decoração<br>que transforma', 'Décor that<br>transforms')}</h2><a class="bt bt-oro" href="./?cat=deco">{t('Ver inspiración', 'Ver inspiração', 'Get inspired')} {ico('seta')}</a></div>
</section>''',
    }
    return [pets, casa]


def gravar_lojas_json(todas):
    """lojas.json: o que o Worker e o painel precisam saber de cada loja."""
    out = [{'id': L['id'], 'marca': L['marca'], 'host': L['host'],
            'pasta': '' if L['dir'] == SITE else '/_lojas/' + L['id'],
            'cats': [[c[0], c[2]] for c in L['cats']]} for L in todas]
    with open(os.path.join(SITE, 'lojas.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
