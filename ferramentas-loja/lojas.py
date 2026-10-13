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

    # ---------------- Casa e jardim (nome provisório: LeunaCasa) ----------------
    MC = 'LeunaCasa'
    logo_casa = (f'<a class="logo logo-txt" href="./" aria-label="{MC}"><span class="lc-ic">{ico("casa")}</span>'
                 f'<span class="lc-nome"><b>Leuna</b>Casa<i>{t("Hogar · Cocina · Jardín", "Casa · Cozinha · Jardim", "Home · Kitchen · Garden")}</i></span></a>')
    cel = ''.join(f'<span class="cel cel{k}"><span class="cel-ic">{ico(i, "bi")}</span></span>'
                  for k, i in enumerate(['vaso', 'cozinha', 'luz', 'folha']))
    casa = {
        'id': 'casa', 'marca': MC, 'host': 'casa.leuname.com', 'dir': os.path.join(SITE, '_lojas', 'casa'),
        'cor': '#1E3A2F', 'favicon': 'img/favicon.png', 'apple': 'img/emblema-192.png',
        'css_extra': '\n<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="tema.css">', 'icone': 'casa',
        'cats': [
            ('cocina', 'cozinha', 'Cocina', 'Cozinha', 'Kitchen'),
            ('orden', 'caixa', 'Orden', 'Arrumação', 'Storage'),
            ('bano', 'banho', 'Baño', 'Casa de banho', 'Bathroom'),
            ('deco', 'vaso', 'Decoración', 'Decoração', 'Décor'),
            ('luz', 'luz', 'Iluminación', 'Iluminação', 'Lighting'),
            ('jardin', 'folha', 'Jardín y terraza', 'Jardim e terraço', 'Garden & patio'),
        ],
        'logo': logo_casa,
        'busca': 'data-ph-es="¿Qué buscas para tu casa o tu jardín?" data-ph-pt="O que procura para a sua casa ou jardim?" data-ph-en="What are you looking for?"',
        'menu_extra': '',
        'rodape_tx': ('Ideas prácticas y bonitas para cada rincón de tu casa y tu jardín, enviadas a toda Europa.',
                      'Ideias práticas e bonitas para cada canto da sua casa e jardim, enviadas para toda a Europa.',
                      'Practical, beautiful ideas for every corner of your home and garden, shipped across Europe.'),
        'novedades_sub': ('Ideas prácticas y bonitas para cada rincón', 'Ideias práticas e bonitas para cada canto', 'Practical, beautiful ideas for every corner'),
        'objeto': ('artículos de hogar, cocina, decoración y jardín', 'artigos de casa, cozinha, decoração e jardim', 'home, kitchen, décor and garden products'),
        'titulo': f'{MC} — Hogar, cocina y jardín · Envío gratis en Europa',
        'desc': 'Ideas para la cocina, el orden, el baño, la decoración, la iluminación y el jardín con envío gratis a España, Portugal, Francia, Alemania, Italia, Países Bajos, Bélgica, Austria e Irlanda. 14 días para devolver.',
        'jsonld': jsonld(MC, 'casa.leuname.com', 'Tienda online de hogar, cocina, decoración y jardín, con envío gratis a 9 países de Europa.', 'img/emblema-192.png'),
        'hero': f'''<section class="hero hero-casa" aria-label="Destacado">
  <div class="wrap hc-in">
    <div class="hc-tx">
      <p class="selo">{t('Envío gratis a toda Europa', 'Envio grátis para toda a Europa', 'Free shipping across Europe')}</p>
      <h1>{t('Tu casa, <em class="v">más bonita</em><br>y más práctica', 'A sua casa, <em class="v">mais bonita</em><br>e mais prática', 'Your home, <em class="v">lovelier</em><br>and easier')}</h1>
      <p class="hero-p">{t('Ideas para la cocina, el orden, la luz y el jardín que hacen el día a día más fácil.', 'Ideias para a cozinha, a arrumação, a luz e o jardim que facilitam o dia a dia.', 'Ideas for the kitchen, storage, lighting and garden that make every day easier.')}</p>
      <div class="hc-bts"><a class="bt bt-cor" href="#novedades">{t('Ver novedades', 'Ver novidades', 'Shop new in')} {ico('seta')}</a><a class="bt bt-l" href="./?cat=jardin">{t('Jardín y terraza', 'Jardim e terraço', 'Garden & patio')}</a></div>
      <ul class="hc-li"><li>{ico('camiao')}{t('Envío gratis', 'Envio grátis', 'Free shipping')}</li><li>{ico('volta')}{t('14 días para devolver', '14 dias para devolver', '14-day returns')}</li><li>{ico('escudo')}{t('Pago seguro', 'Pagamento seguro', 'Secure checkout')}</li></ul>
    </div>
    <div class="colagem" data-colagem>{cel}</div>
  </div>
  <div class="preco-selo" id="desde" hidden><small>{t('Desde', 'Desde', 'From')}</small><b></b></div>
</section>''',
        'meio': f'''<section class="wrap animais ambientes">
  <a class="animal am-in" href="./?cat=cocina"><div class="an-tx"><b>{t('Cocina', 'Cozinha', 'Kitchen')}</b><span>{t('Utensilios y trucos que ahorran tiempo cada día.', 'Utensílios e truques que poupam tempo todos os dias.', 'Tools and tricks that save time every day.')}</span><em class="an-bt">{t('Ver productos', 'Ver produtos', 'Shop now')} {ico('seta')}</em></div><span class="am-foto" data-colagem-cat="cocina">{ico('cozinha', 'bi')}</span></a>
  <a class="animal am-ex" href="./?cat=jardin"><div class="an-tx"><b>{t('Jardín y terraza', 'Jardim e terraço', 'Garden & patio')}</b><span>{t('Luces solares, macetas y todo para disfrutar fuera.', 'Luzes solares, vasos e tudo para aproveitar lá fora.', 'Solar lights, planters and more to enjoy outdoors.')}</span><em class="an-bt">{t('Ver productos', 'Ver produtos', 'Shop now')} {ico('seta')}</em></div><span class="am-foto" data-colagem-cat="jardin">{ico('folha', 'bi')}</span></a>
</section>''',
        'porque': f'''<section class="wrap porque porque-casa">
  <div class="porque-foto colagem colagem-p" data-colagem>{cel}</div>
  <div class="porque-tx">
    <h2>{t('¿Por qué ' + MC + '?', 'Porquê a ' + MC + '?', 'Why ' + MC + '?')}</h2>
    <p>{t('Elegimos cada producto pensando en tu día a día: que sea útil, bonito y que dure. Nada de relleno.', 'Escolhemos cada produto a pensar no seu dia a dia: útil, bonito e duradouro. Nada de enchimento.', 'Every product is chosen for everyday life: useful, good-looking and built to last. No filler.')}</p>
    <ul><li>{ico('camiao')}{t('Envío gratis con seguimiento a toda Europa', 'Envio grátis com seguimento para toda a Europa', 'Free tracked shipping across Europe')}</li>
    <li>{ico('volta')}{t('14 días para devolver', '14 dias para devolver', '14-day returns')}</li>
    <li>{ico('escudo')}{t('Pago seguro con tarjeta o PayPal', 'Pagamento seguro com cartão ou PayPal', 'Secure payment by card or PayPal')}</li></ul>
  </div>
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
