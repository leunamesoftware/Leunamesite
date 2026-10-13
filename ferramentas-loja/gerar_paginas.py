#!/usr/bin/env python3
"""Gera as páginas da loja Europa "Leuna" (casa + pets) em SITE-LEUNAMESOFTWARE/.
Três idiomas: t('espanhol', 'português', 'inglês'). A troca é só CSS (html[lang])."""
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(AQUI, '..', 'SITE-LEUNAMESOFTWARE')
DATA = ('13 de octubre de 2026', '13 de outubro de 2026', '13 October 2026')
MARCA = 'Leuna'


def t(es, pt, en):
    return f'<span class="es">{es}</span><span class="pt">{pt}</span><span class="en">{en}</span>'


PAISES = (
    'Alemania, Francia, España, Italia, Países Bajos, Bélgica, Austria, Portugal e Irlanda',
    'Alemanha, França, Espanha, Itália, Países Baixos, Bélgica, Áustria, Portugal e Irlanda',
    'Germany, France, Spain, Italy, the Netherlands, Belgium, Austria, Portugal and Ireland',
)

# ícones de linha (24x24)
I = {
    'casa': '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    'pata': '<circle cx="7" cy="9" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="9" r="2"/><path d="M8 17c0-3 2-5 4-5s4 2 4 5c0 2-2 2-4 2s-4 0-4-2z"/>',
    'caixa': '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
    'cozinha': '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3"/><path d="M7 11v10"/><path d="M17 3c-2 0-3 3-3 6s1 4 3 4v8"/>',
    'luz': '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
    'banho': '<path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3z"/><path d="M6 12V6a2 2 0 0 1 4 0"/><path d="M7 20l-1 2M17 20l1 2"/>',
    'folha': '<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15z"/><path d="M5 19l8-8"/>',
    'camiao': '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>',
    'escudo': '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    'volta': '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/>',
    'apoio': '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    'lupa': '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    'carrinho': '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
    'seta': '<path d="M5 12h14M13 6l6 6-6 6"/>',
}


def ico(n, cls='ic'):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{I[n]}</svg>'


CATS = [  # id, ícone, es, pt, en
    ('mascotas', 'pata', 'Mascotas', 'Animais', 'Pets'),
    ('organizacion', 'caixa', 'Organización', 'Arrumação', 'Storage'),
    ('cocina', 'cozinha', 'Cocina', 'Cozinha', 'Kitchen'),
    ('iluminacion', 'luz', 'Iluminación', 'Iluminação', 'Lighting'),
    ('bano', 'banho', 'Baño', 'Casa de banho', 'Bathroom'),
    ('jardin', 'folha', 'Jardín', 'Jardim', 'Garden'),
]

LOGO = ('<svg class="logo-f" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 44C10 40 4 28 8 10c12 2 20 10 16 34z" fill="#3E8E4F"/>'
        '<path d="M24 44c14-4 20-16 16-34-12 2-20 10-16 34z" fill="#1F5A33"/><path d="M24 44V22" stroke="#FAF7F1" stroke-width="1.6"/></svg>')

ICONE = ("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'>"
         "<rect width='48' height='48' rx='12' fill='%23FAF7F1'/><path d='M24 42C11 38 6 27 9 11c11 2 18 9 15 31z' fill='%233E8E4F'/>"
         "<path d='M24 42c13-4 18-15 15-31-11 2-18 9-15 31z' fill='%231F5A33'/></svg>")

IDIOMA_JS = ('try{var q=location.search.match(/[?&]lang=(es|en)/),g=localStorage.getItem("lang"),'
             'l=(q&&q[1])||(g==="en"?"en":"es");document.documentElement.lang=l}'
             'catch(e){document.documentElement.lang="es"}')


def links_cats():
    return ''.join(f'<a href="./#{c}">{t(es, pt, en)}</a>' for c, _, es, pt, en in CATS)


def cabeca(titulo, desc, caminho, indexar=True):
    robots = '' if indexar else '<meta name="robots" content="noindex">\n'
    nav = ''.join(f'<a href="./#{c}">{ico(i)}{t(es, pt, en)}</a>' for c, i, es, pt, en in CATS)
    return f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo}</title>
<meta name="description" content="{desc}">
{robots}<link rel="canonical" href="https://leunamesoftware.com/{caminho}">
<meta name="theme-color" content="#1B3D27">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="icon" href="{ICONE}">
<link rel="stylesheet" href="loja.css">
<script>{IDIOMA_JS}</script>
<script src="config.js"></script>
</head>
<body>
<div class="barra">
  <div class="wrap barra-in">
    <span>{ico('camiao')}{t('Envío gratis a 9 países de Europa', 'Envio grátis para 9 países da Europa', 'Free shipping to 9 EU countries')}</span>
    <span class="b2">{ico('escudo')}{t('Compra segura', 'Compra segura', 'Secure checkout')}</span>
    <span class="b3">{ico('volta')}{t('Devolución en 14 días', 'Devolução em 14 dias', '14-day returns')}</span>
    <select class="idioma" data-idioma aria-label="Idioma / Language"><option value="es">🇪🇸 ES</option><option value="en">🇬🇧 EN</option></select>
  </div>
</div>
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="./">{LOGO}<span class="logo-t">{MARCA}<i>{t('Hogar · Mascotas', 'Casa · Animais', 'Home · Pets')}</i></span></a>
    <form class="busca" role="search" action="./" data-busca>
      <input type="search" name="q" autocomplete="off" aria-label="Buscar" data-ph-es="¿Qué buscas para tu hogar o tu mascota?" data-ph-pt="O que procura para a casa ou o seu animal?" data-ph-en="What are you looking for?">
      <button type="submit" aria-label="Buscar">{ico('lupa')}</button>
    </form>
    <a class="sacola" href="carrito.html" aria-label="Cart">{ico('carrinho')}<span>{t('Carrito', 'Carrinho', 'Cart')}</span><b data-qtd hidden>0</b></a>
  </div>
  <nav class="menu" aria-label="Menu"><div class="wrap menu-in"><a href="./" class="on">{ico('casa')}{t('Inicio', 'Início', 'Home')}</a>{nav}</div></nav>
</header>
'''


RODAPE = f'''
<section class="garantias">
  <div class="wrap gar-in">
    <div>{ico('camiao', 'gi')}<span><b>{t('Envío gratis', 'Envio grátis', 'Free shipping')}</b>{t('Desde almacenes en la UE, sin aduanas', 'De armazéns na UE, sem alfândega', 'From EU warehouses, no customs')}</span></div>
    <div>{ico('escudo', 'gi')}<span><b>{t('Pago seguro', 'Pagamento seguro', 'Secure payment')}</b>{t('Tarjeta, Apple Pay o PayPal', 'Cartão, Apple Pay ou PayPal', 'Card, Apple Pay or PayPal')}</span></div>
    <div>{ico('volta', 'gi')}<span><b>{t('Devoluciones fáciles', 'Devoluções fáceis', 'Easy returns')}</b>{t('14 días para cambiar de opinión', '14 dias para mudar de ideias', '14 days to change your mind')}</span></div>
    <div>{ico('apoio', 'gi')}<span><b>{t('Atención al cliente', 'Apoio ao cliente', 'Customer care')}</b>{t('Respuesta en menos de 24 h', 'Resposta em menos de 24 h', 'Reply within 24 h')}</span></div>
  </div>
</section>
<footer class="pie">
  <div class="wrap pie-in">
    <div><a class="logo" href="./">{LOGO}<span class="logo-t">{MARCA}<i>{t('Hogar · Mascotas', 'Casa · Animais', 'Home · Pets')}</i></span></a>
      <p>{t('Soluciones prácticas y bonitas para tu casa y tus mascotas, enviadas a toda Europa.', 'Soluções práticas e bonitas para a sua casa e os seus animais, enviadas para toda a Europa.', 'Practical, beautiful finds for your home and pets, shipped across Europe.')}</p></div>
    <div><h4>{t('Tienda', 'Loja', 'Shop')}</h4>{links_cats()}</div>
    <div><h4>{t('Ayuda', 'Ajuda', 'Help')}</h4><a href="envios.html">{t('Envíos y devoluciones', 'Envios e devoluções', 'Shipping & returns')}</a><a href="#" data-mail>{t('Contacto', 'Contacto', 'Contact')}</a><a href="carrito.html">{t('Mi carrito', 'O meu carrinho', 'My cart')}</a></div>
    <div><h4>Legal</h4><a href="aviso-legal.html">{t('Aviso legal', 'Aviso legal', 'Legal notice')}</a><a href="envios.html#desistimiento">{t('Derecho de desistimiento', 'Direito de livre resolução', 'Right of withdrawal')}</a><a href="privacidad.html">{t('Privacidad', 'Privacidade', 'Privacy')}</a><a href="cookies.html">Cookies</a></div>
  </div>
  <div class="wrap pie-bajo"><span>© <span data-ano>2026</span> {MARCA} · leunamesoftware.com</span><span class="pagos">Visa · Mastercard · Apple Pay · Google Pay · PayPal</span></div>
</footer>
<div class="cookies" id="cookies" hidden>
  <p>{t('Solo usamos lo necesario para que la tienda funcione (carrito e idioma). Al pagar, Stripe o PayPal usan sus propias cookies.', 'Só usamos o necessário para a loja funcionar (carrinho e idioma). No pagamento, a Stripe ou o PayPal usam os seus próprios cookies.', 'We only store what the shop needs to work (cart and language). At checkout, Stripe or PayPal use their own cookies.')} <a href="cookies.html">{t('Más información', 'Saber mais', 'Learn more')}</a></p>
  <button type="button" id="cookiesOk">OK</button>
</div>
<div class="aviso" id="aviso" role="status"></div>
<script src="loja.js"></script>
'''


def pagina(nome, titulo, desc, corpo, indexar=True):
    html = cabeca(titulo, desc, '' if nome == 'index.html' else nome, indexar) + corpo + RODAPE + '</body>\n</html>\n'
    with open(os.path.join(SITE, nome), 'w', encoding='utf-8') as f:
        f.write(html)


# ---------------- INÍCIO ----------------
BANNERS = [
    ('organizacion', 'cat-hogar', 'Hogar', 'Casa', 'Home', 'Orden y estilo para tu día a día.', 'Arrumação e estilo para o dia a dia.', 'Order and style for every day.', '#EFE7DA'),
    ('jardin', 'cat-jardin', 'Jardín', 'Jardim', 'Garden', 'Todo para tus plantas y tu terraza.', 'Tudo para as plantas e a varanda.', 'Everything for your plants and patio.', '#E3ECDD'),
    ('mascotas', 'cat-mascotas', 'Mascotas', 'Animais', 'Pets', 'Para su bienestar y su felicidad.', 'Para o bem-estar e a felicidade deles.', 'For their comfort and happiness.', '#F1E6DA'),
]
banners = ''.join(f'''<a class="ban" href="#{c}" style="--bg:{bg}"><div class="ban-tx"><h3>{t(es, pt, en)}</h3><p>{t(des, dpt, den)}</p><span class="ban-bt">{t('Ver categoría', 'Ver categoria', 'Shop now')} {ico('seta')}</span></div><img src="img/{img}.webp" alt="" loading="lazy"></a>'''
                  for c, img, es, pt, en, des, dpt, den, bg in BANNERS)
secoes = ''.join(f'''<section class="wrap cat" id="{c}" hidden>
  <div class="sec-cab"><h2>{ico(i)}{t(es, pt, en)}</h2></div>
  <div class="grade" data-grade="{c}"></div>
</section>
''' for c, i, es, pt, en in CATS)
index = f'''<main>
<section class="hero">
  <img class="hero-foto" src="img/hero.webp" alt="" fetchpriority="high">
  <div class="wrap hero-in">
    <p class="selo">{t('Hogar · Jardín · Mascotas', 'Casa · Jardim · Animais', 'Home · Garden · Pets')}</p>
    <h1>{t('Un hogar mejor<br><em class="v">para una vida más feliz</em>', 'Uma casa melhor<br><em class="v">para uma vida mais feliz</em>', 'A better home<br><em class="v">for a happier life</em>')}</h1>
    <p class="hero-p">{t('Soluciones prácticas, modernas y accesibles para tu casa, tu jardín y tus mascotas.', 'Soluções práticas, modernas e acessíveis para a sua casa, o seu jardim e os seus animais.', 'Practical, modern and affordable finds for your home, garden and pets.')}</p>
    <a class="bt" href="#destacados">{t('Descubrir productos', 'Descobrir produtos', 'Discover products')} {ico('seta')}</a>
    <ul class="hero-li"><li>{ico('folha')}{t('Ideas para tu hogar', 'Ideias para a casa', 'Ideas for your home')}</li><li>{ico('casa')}{t('Jardín más verde', 'Jardim mais verde', 'A greener garden')}</li><li>{ico('pata')}{t('Mascotas más felices', 'Animais mais felizes', 'Happier pets')}</li></ul>
  </div>
</section>
<section class="wrap bans">{banners}</section>
<section class="faixa-conf"><div class="wrap conf-in">
  <div>{ico('camiao', 'gi')}<span><b>{t('Envío rápido a toda Europa', 'Envio rápido para toda a Europa', 'Fast shipping across Europe')}</b>{t('Desde nuestros almacenes europeos', 'A partir dos nossos armazéns europeus', 'From our European warehouses')}</span></div>
  <div>{ico('escudo', 'gi')}<span><b>{t('Pago seguro', 'Pagamento seguro', 'Secure payment')}</b>{t('Tus datos siempre protegidos', 'Os seus dados sempre protegidos', 'Your data always protected')}</span></div>
  <div>{ico('caixa', 'gi')}<span><b>{t('Devoluciones fáciles', 'Devoluções fáceis', 'Easy returns')}</b>{t('Compra con tranquilidad', 'Compre com tranquilidade', 'Shop with peace of mind')}</span></div>
  <div>{ico('apoio', 'gi')}<span><b>{t('Atención al cliente', 'Apoio ao cliente', 'Customer care')}</b>{t('Siempre a tu lado', 'Sempre do seu lado', 'Always here for you')}</span></div>
</div></section>
<section class="wrap destaque-sec" id="destacados">
  <div class="sec-centro"><h2>{t('Productos destacados', 'Produtos em destaque', 'Featured products')}</h2><p>{t('Lo más popular para tu hogar, jardín y mascotas', 'O mais popular para a casa, o jardim e os animais', 'Most popular for your home, garden and pets')}</p></div>
  <div class="grade" data-grade="destaque"></div>
  <div class="vazio-in" id="vazio" hidden>
    <h2>{t('Estamos llenando las estanterías', 'Estamos a encher as prateleiras', 'We are stocking the shelves')}</h2>
    <p>{t('Los primeros productos llegan en unos días. Escríbenos y te avisamos.', 'Os primeiros produtos chegam dentro de dias. Escreva-nos e avisamos.', 'The first products arrive in a few days. Drop us a line and we will let you know.')}</p>
    <a class="bt" href="#" data-mail>{t('Avisarme', 'Avisar-me', 'Notify me')}</a>
  </div>
  <div class="vazio-in" id="semBusca" hidden><h2>{t('Sin resultados', 'Sem resultados', 'No results')}</h2><p>{t('Prueba con otra palabra.', 'Experimente outra palavra.', 'Try another word.')}</p></div>
</section>
{secoes}</main>
'''
pagina('index.html', f'{MARCA} — Home & pet essentials · Free shipping across Europe',
       'Practical, modern finds for your home, garden and pets with free shipping to Germany, France, Spain, Italy, the Netherlands, Belgium, Austria, Portugal and Ireland. 14-day returns.',
       index)

# ---------------- PRODUTO ----------------
produto = f'''<main class="wrap prod" id="prod">
  <a class="voltar" href="./">← {t('Volver a la tienda', 'Voltar à loja', 'Back to shop')}</a>
  <div class="prod-in" hidden>
    <div class="galeria"><div class="foto"><img id="pFoto" alt=""></div><div class="miniaturas" id="pMinis"></div></div>
    <div class="info">
      <h1 id="pNome"></h1>
      <div class="preco" id="pPreco"></div>
      <p class="iva">{t('IVA incluido · Envío gratis', 'IVA incluído · Envio grátis', 'VAT included · Free shipping')}</p>
      <p class="desc" id="pDesc"></p>
      <ul class="lista" id="pLista"></ul>
      <div class="compra">
        <div class="qtd"><button type="button" data-menos aria-label="-">−</button><span id="pQtd">1</span><button type="button" data-mais aria-label="+">+</button></div>
        <button class="bt bt-g" type="button" id="pAdd">{t('Añadir al carrito', 'Adicionar ao carrinho', 'Add to cart')}</button>
      </div>
      <a class="bt bt-l bt-w" href="carrito.html" id="pIr" hidden>{t('Ir al carrito y pagar →', 'Ir ao carrinho e pagar →', 'Go to cart & checkout →')}</a>
      <div class="entrega">
        <p><b>{t('Entrega estimada', 'Entrega estimada', 'Estimated delivery')}:</b> <span id="pPrazo"></span></p>
        <p>{t('14 días para devolver', '14 dias para devolver', '14-day returns')} · {t('Pago seguro', 'Pagamento seguro', 'Secure checkout')}</p>
      </div>
      <video id="pVideo" controls playsinline muted preload="none" hidden></video>
    </div>
  </div>
  <div class="vazio-in" id="pNada" hidden><h2>{t('Producto no encontrado', 'Produto não encontrado', 'Product not found')}</h2><a class="bt" href="./">{t('Ver la tienda', 'Ver a loja', 'Go to shop')}</a></div>
</main>
'''
pagina('producto.html', 'Product — Leuna', 'Product details, free shipping across Europe.', produto)

# ---------------- CARRINHO ----------------
carrito = f'''<main class="wrap carr">
  <h1>{t('Tu carrito', 'O seu carrinho', 'Your cart')}</h1>
  <div class="carr-in">
    <div id="cItens"></div>
    <aside class="resumo" id="cResumo" hidden>
      <h2>{t('Resumen', 'Resumo', 'Summary')}</h2>
      <p class="linha"><span>{t('Productos', 'Produtos', 'Items')}</span><b id="cSub"></b></p>
      <p class="linha"><span>{t('Envío', 'Envio', 'Shipping')}</span><b>{t('Gratis', 'Grátis', 'Free')}</b></p>
      <p class="linha total"><span>Total <small>{t('(IVA incl.)', '(IVA incl.)', '(VAT incl.)')}</small></span><b id="cTotal"></b></p>
      <p class="paises">{t('Enviamos a: ' + PAISES[0] + '.', 'Enviamos para: ' + PAISES[1] + '.', 'We ship to: ' + PAISES[2] + '.')}</p>
      <label class="aceite"><input type="checkbox" id="cAceite"> <span>{t('He leído las <a href="envios.html" target="_blank">condiciones de envío y devolución</a> y la <a href="privacidad.html" target="_blank">política de privacidad</a>.', 'Li as <a href="envios.html" target="_blank">condições de envio e devolução</a> e a <a href="privacidad.html" target="_blank">política de privacidade</a>.', 'I have read the <a href="envios.html" target="_blank">shipping &amp; returns terms</a> and the <a href="privacidad.html" target="_blank">privacy policy</a>.')}</span></label>
      <button class="bt bt-w bt-cartao" type="button" id="btStripe" hidden>{t('Pagar con tarjeta', 'Pagar com cartão', 'Pay by card')} <small>· Apple Pay · Google Pay</small></button>
      <p class="ou" id="ouPP" hidden>{t('o', 'ou', 'or')}</p>
      <div id="paypal" class="paypal"></div>
      <p class="sem-pp" id="semPP" hidden>{t('El pago se activa en breve. Escríbenos para reservar tu pedido:', 'O pagamento fica ativo em breve. Escreva-nos para reservar a sua encomenda:', 'Checkout opens very soon. Email us to reserve your order:')} <a href="#" data-mail data-pedido>email</a></p>
      <p class="seguro">{t('Pago procesado por Stripe o PayPal. Nunca vemos los datos de tu tarjeta.', 'Pagamento processado pela Stripe ou pelo PayPal. Nunca vemos os dados do seu cartão.', 'Payments processed by Stripe or PayPal. We never see your card details.')}</p>
    </aside>
  </div>
</main>
'''
pagina('carrito.html', 'Cart — Leuna', 'Your cart.', carrito, indexar=False)

gracias = f'''<main class="wrap ok">
  <div class="vazio-in">
    <h1>{t('¡Gracias por tu pedido!', 'Obrigado pela sua encomenda!', 'Thank you for your order!')}</h1>
    <p>{t('Hemos recibido tu pago. En 1–2 días laborables te enviamos por email el número de seguimiento.', 'Recebemos o seu pagamento. Em 1–2 dias úteis enviamos por email o número de seguimento.', 'We have received your payment. Within 1–2 business days we will email you the tracking number.')}</p>
    <p class="nr" id="nrPedido"></p>
    <a class="bt" href="./">{t('Seguir comprando', 'Continuar a comprar', 'Keep shopping')}</a>
  </div>
</main>
'''
pagina('gracias.html', 'Thank you — Leuna', 'Order received.', gracias, indexar=False)


# ---------------- LEGAIS ----------------
def legal(nome, titulos, textos, desc):
    corpo = (f'<main class="wrap legal"><h1>{t(*titulos)}</h1>'
             f'<div class="es">{textos[0]}</div><div class="pt">{textos[1]}</div><div class="en">{textos[2]}</div>'
             f'<p class="act">{t("Última actualización: " + DATA[0], "Última atualização: " + DATA[1], "Last updated: " + DATA[2])}.</p></main>')
    pagina(nome, f'{titulos[2]} — Leuna', desc, corpo)


legal('envios.html', ('Envíos y devoluciones', 'Envios e devoluções', 'Shipping & returns'), (f'''
<h2>Dónde enviamos</h2><p>{PAISES[0]}. El envío es gratuito.</p>
<h2>Plazos</h2><p>Preparamos tu pedido en 1–2 días laborables. Los productos salen de almacenes situados en la Unión Europea; la entrega suele tardar entre 3 y 10 días laborables según el producto y el país (lo ves en cada ficha). Te enviamos el número de seguimiento por email.</p>
<h2>Precios e impuestos</h2><p>Los precios son finales, en euros e incluyen el IVA. No hay costes de aduana porque los envíos salen desde la UE.</p>
<h2 id="desistimiento">Derecho de desistimiento (14 días)</h2><p>Tienes 14 días naturales desde que recibes el producto para desistir de la compra sin dar explicaciones. Escríbenos por email con tu número de pedido; te indicaremos la dirección de devolución. Te reembolsaremos todos los importes pagados, incluido el envío inicial, en un plazo máximo de 14 días desde que nos comuniques el desistimiento, por el mismo medio de pago. Podemos retener el reembolso hasta recibir el producto o la prueba de su envío. Los gastos de la devolución corren a cargo del cliente, salvo que el producto llegue defectuoso o no sea el pedido.</p>
<p>Modelo de desistimiento: «Por la presente le comunico que desisto de mi contrato de venta del siguiente bien: [producto], pedido el [fecha] / recibido el [fecha]. Nombre, dirección, fecha.»</p>
<h2>Productos defectuosos o dañados</h2><p>Si algo llega roto o no funciona, envíanos una foto por email y te enviamos otro o te devolvemos el dinero, sin coste para ti. Además tienes la garantía legal de conformidad que marca la ley de tu país.</p>
<h2>Pedidos no recibidos</h2><p>Si tu pedido no llega en el plazo indicado, escríbenos y lo resolvemos: reenvío o reembolso completo.</p>''', f'''
<h2>Para onde enviamos</h2><p>{PAISES[1]}. O envio é gratuito.</p>
<h2>Prazos</h2><p>Preparamos a sua encomenda em 1–2 dias úteis. Os produtos saem de armazéns na União Europeia; a entrega costuma demorar entre 3 e 10 dias úteis conforme o produto e o país (vê o prazo em cada página). Enviamos o número de seguimento por email.</p>
<h2>Preços e impostos</h2><p>Os preços são finais, em euros e com IVA incluído. Não há custos de alfândega porque os envios saem da UE.</p>
<h2 id="desistimiento">Direito de livre resolução (14 dias)</h2><p>Tem 14 dias de calendário a partir da receção do produto para desistir da compra sem justificação. Envie-nos um email com o número da encomenda; indicamos a morada de devolução. Reembolsamos todos os valores pagos, incluindo o envio inicial, no prazo máximo de 14 dias após a sua comunicação, pelo mesmo meio de pagamento. Podemos reter o reembolso até recebermos o produto ou a prova do seu envio. Os custos da devolução ficam a cargo do cliente, exceto se o produto chegar com defeito ou não for o encomendado.</p>
<p>Modelo de livre resolução: «Pela presente comunico que desisto do meu contrato de compra do seguinte bem: [produto], encomendado em [data] / recebido em [data]. Nome, morada, data.»</p>
<h2>Produtos com defeito ou danificados</h2><p>Se algo chegar partido ou não funcionar, envie-nos uma foto por email e enviamos outro ou devolvemos o dinheiro, sem custos para si. Tem ainda a garantia legal de conformidade prevista na lei do seu país.</p>
<h2>Encomendas não recebidas</h2><p>Se a encomenda não chegar no prazo indicado, escreva-nos e resolvemos: reenvio ou reembolso total.</p>''', f'''
<h2>Where we ship</h2><p>{PAISES[2]}. Shipping is free.</p>
<h2>Delivery times</h2><p>We process your order within 1–2 business days. Products ship from warehouses inside the European Union; delivery usually takes 3–10 business days depending on the product and country (shown on each product page). We email you the tracking number.</p>
<h2>Prices and taxes</h2><p>Prices are final, in euros and include VAT. There are no customs fees because orders ship from within the EU.</p>
<h2 id="desistimiento">Right of withdrawal (14 days)</h2><p>You have 14 calendar days from receiving your item to cancel the purchase without giving a reason. Email us with your order number and we will send you the return address. We will refund all payments received, including the original shipping cost, within 14 days of your notice, using the same payment method. We may withhold the refund until we receive the item or proof that it was sent back. Return shipping costs are paid by the customer unless the item is faulty or not what you ordered.</p>
<p>Model withdrawal form: “I hereby give notice that I withdraw from my contract of sale of the following goods: [product], ordered on [date] / received on [date]. Name, address, date.”</p>
<h2>Faulty or damaged items</h2><p>If something arrives broken or does not work, email us a photo and we will send a replacement or refund you at no cost. You also keep the legal guarantee of conformity under your country's law.</p>
<h2>Missing orders</h2><p>If your order does not arrive within the stated time, email us and we will fix it: reshipment or full refund.</p>'''),
      'Free shipping to 9 EU countries, delivery times and 14-day right of withdrawal.')

legal('aviso-legal.html', ('Aviso legal', 'Aviso legal', 'Legal notice'), ('''
<h2>Titular de la tienda</h2><p data-titular>Titular: LeuName Softwares (marca Leuna) · Correo: <a href="#" data-mail>contacto por email</a> · Web: leunamesoftware.com</p>
<h2>Objeto</h2><p>Venta a distancia de artículos para el hogar, el jardín y las mascotas a consumidores de la Unión Europea. Los pedidos se envían desde almacenes de nuestros socios logísticos en la UE.</p>
<h2>Precios y pago</h2><p>Precios en euros con IVA incluido. Pago con tarjeta, Apple Pay o Google Pay (procesado por Stripe) o con PayPal. El contrato se perfecciona al recibir la confirmación del pago.</p>
<h2>Resolución de litigios</h2><p>Si tienes cualquier problema, escríbenos primero: lo solucionamos. También puedes acudir a los organismos de consumo de tu país.</p>''', '''
<h2>Titular da loja</h2><p data-titular>Titular: LeuName Softwares (marca Leuna) · Email: <a href="#" data-mail>contacto por email</a> · Site: leunamesoftware.com</p>
<h2>Objeto</h2><p>Venda à distância de artigos para casa, jardim e animais a consumidores da União Europeia. As encomendas são enviadas a partir de armazéns dos nossos parceiros logísticos na UE.</p>
<h2>Preços e pagamento</h2><p>Preços em euros com IVA incluído. Pagamento com cartão, Apple Pay ou Google Pay (processado pela Stripe) ou com PayPal. O contrato fica concluído com a confirmação do pagamento.</p>
<h2>Resolução de litígios</h2><p>Se tiver algum problema, escreva-nos primeiro: resolvemos. Em Portugal pode também usar o Livro de Reclamações Eletrónico (livroreclamacoes.pt) e as entidades de resolução alternativa de litígios de consumo.</p>''', '''
<h2>Shop owner</h2><p data-titular>Owner: LeuName Softwares (Leuna brand) · Email: <a href="#" data-mail>contact by email</a> · Website: leunamesoftware.com</p>
<h2>Purpose</h2><p>Distance selling of home, garden and pet products to consumers in the European Union. Orders ship from our logistics partners' warehouses inside the EU.</p>
<h2>Prices and payment</h2><p>Prices in euros including VAT. Payment by card, Apple Pay or Google Pay (processed by Stripe) or by PayPal. The contract is concluded when you receive payment confirmation.</p>
<h2>Disputes</h2><p>If you have any problem, please contact us first and we will sort it out. You can also contact the consumer authorities in your country.</p>'''),
      'Shop owner details and terms of Leuna.')

legal('privacidad.html', ('Política de privacidad', 'Política de privacidade', 'Privacy policy'), ('''
<h2>Responsable</h2><p>LeuName Softwares (<a href="#" data-mail>email</a>).</p>
<h2>Qué datos usamos</h2><p>Solo los necesarios para entregarte el pedido: nombre, dirección de envío, email y teléfono si lo das, que nos facilita Stripe o PayPal al pagar. No guardamos datos de tarjetas.</p>
<h2>Para qué</h2><p>Para preparar y enviar el pedido (los datos se comunican al almacén y a la empresa de transporte) y para atenderte. Base legal: ejecución del contrato. Los conservamos el tiempo exigido por la ley fiscal.</p>
<h2>Tus derechos</h2><p>Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad escribiéndonos por email, y reclamar ante la autoridad de protección de datos de tu país.</p>
<h2>Sin publicidad</h2><p>No vendemos tus datos ni te enviamos publicidad sin tu permiso.</p>''', '''
<h2>Responsável</h2><p>LeuName Softwares (<a href="#" data-mail>email</a>).</p>
<h2>Que dados usamos</h2><p>Só os necessários para entregar a encomenda: nome, morada, email e telefone se o indicar, fornecidos pela Stripe ou pelo PayPal no pagamento. Não guardamos dados de cartões.</p>
<h2>Para quê</h2><p>Para preparar e enviar a encomenda (os dados são comunicados ao armazém e à transportadora) e para lhe dar apoio. Base legal: execução do contrato. Conservamos os dados pelo tempo exigido pela lei fiscal.</p>
<h2>Os seus direitos</h2><p>Pode pedir acesso, retificação, apagamento, oposição, limitação e portabilidade por email, e apresentar queixa à autoridade de proteção de dados do seu país.</p>
<h2>Sem publicidade</h2><p>Não vendemos os seus dados nem enviamos publicidade sem autorização.</p>''', '''
<h2>Controller</h2><p>LeuName Softwares (<a href="#" data-mail>email</a>).</p>
<h2>What data we use</h2><p>Only what we need to deliver your order: name, shipping address, email and phone if provided, passed to us by Stripe or PayPal at checkout. We never store card details.</p>
<h2>Why</h2><p>To prepare and ship your order (data is shared with the warehouse and the carrier) and to support you. Legal basis: performance of the contract. We keep it for the period required by tax law.</p>
<h2>Your rights</h2><p>You can request access, rectification, erasure, objection, restriction and portability by email, and complain to your country's data protection authority.</p>
<h2>No marketing</h2><p>We never sell your data or send you marketing without your consent.</p>'''),
      'How we handle your data (GDPR).')

legal('cookies.html', ('Política de cookies', 'Política de cookies', 'Cookie policy'), ('''
<p>Esta tienda no usa cookies de publicidad ni de análisis. Solo guarda en tu navegador el carrito, el idioma y si has cerrado el aviso de cookies (almacenamiento técnico y necesario).</p>
<p>Al pagar, Stripe o PayPal pueden usar cookies necesarias para el pago y la prevención del fraude, según sus políticas.</p>''', '''
<p>Esta loja não usa cookies de publicidade nem de análise. Só guarda no seu navegador o carrinho, o idioma e se fechou o aviso de cookies (armazenamento técnico e necessário).</p>
<p>No pagamento, a Stripe ou o PayPal podem usar cookies necessários ao pagamento e à prevenção de fraude, segundo as suas políticas.</p>''', '''
<p>This shop uses no advertising or analytics cookies. It only stores your cart, language and whether you closed the cookie notice in your browser (strictly necessary storage).</p>
<p>At checkout, Stripe or PayPal may use cookies needed for payment and fraud prevention, under their own policies.</p>'''),
      'Strictly necessary storage only.')

# ---------------- NOVIDADES (só o dono) ----------------
novidades = '''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Novidades da CJ — robô da loja</title>
<link rel="icon" href="''' + ICONE + '''">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="loja.css"></head>
<body class="nov">
<main class="wrap">
  <h1>🤖 Novidades da CJ (Europa)</h1>
  <p class="nov-sub">O robô procura todo dia produtos baratos com estoque em armazém europeu, calcula o frete para os 9 países da loja (usa o mais caro) e sugere o preço. <b>Para vender um produto</b>, toque em "Quero vender" e mande para o Claude: ele traduz e coloca na loja.</p>
  <p class="nov-sub" id="nAtual"></p>
  <div class="nov-filtros"><button data-f="todos" class="on">Todos</button><button data-f="video">Com vídeo</button><button data-f="aprovado">À venda</button><button data-f="barato">Lucro ≥ 10 €</button></div>
  <div class="nov-grade" id="nGrade"></div>
</main>
<div class="aviso" id="aviso"></div>
<script src="novidades.js"></script>
</body></html>
'''
with open(os.path.join(SITE, 'novidades.html'), 'w', encoding='utf-8') as f:
    f.write(novidades)
print('páginas ok')
