#!/usr/bin/env python3
"""Gera as páginas da loja Europa em SITE-LEUNAMESOFTWARE/.
Três idiomas: t('espanhol', 'português', 'inglês'). A troca é só CSS (html[lang])."""
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(AQUI, '..', 'SITE-LEUNAMESOFTWARE')
DATA = ('12 de octubre de 2026', '12 de outubro de 2026', '12 October 2026')


def t(es, pt, en):
    return f'<span class="es">{es}</span><span class="pt">{pt}</span><span class="en">{en}</span>'


PAISES = (
    'Alemania, Francia, España, Italia, Países Bajos, Bélgica, Austria, Portugal e Irlanda',
    'Alemanha, França, Espanha, Itália, Países Baixos, Bélgica, Áustria, Portugal e Irlanda',
    'Germany, France, Spain, Italy, the Netherlands, Belgium, Austria, Portugal and Ireland',
)

CATS = [  # id, emoji, es, pt, en
    ('mascotas', '🐾', 'Mascotas', 'Animais', 'Pets'),
    ('casa', '🏠', 'Hogar', 'Casa', 'Home'),
    ('cocina', '🍳', 'Cocina', 'Cozinha', 'Kitchen'),
    ('belleza', '✨', 'Belleza', 'Beleza', 'Beauty'),
    ('tech', '🔌', 'Gadgets', 'Gadgets', 'Gadgets'),
    ('coche', '🚗', 'Coche', 'Carro', 'Car'),
]

ICONE = ("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
         "<rect width='64' height='64' rx='18' fill='%23161616'/><circle cx='46' cy='18' r='7' fill='%23ff5a36'/>"
         "<text x='29' y='45' font-size='32' text-anchor='middle' fill='%23fff' font-family='Arial' font-weight='700'>L</text></svg>")

IDIOMA_JS = ('try{var q=location.search.match(/[?&]lang=(es|pt|en)/),n=(navigator.language||"").toLowerCase().slice(0,2),'
             'l=(q&&q[1])||localStorage.getItem("lang")||(n==="pt"||n==="es"?n:"en");document.documentElement.lang=l}'
             'catch(e){document.documentElement.lang="en"}')


def links_cats():
    return ''.join(f'<a href="./#{c}">{t(es, pt, en)}</a>' for c, _, es, pt, en in CATS)


def cabeca(titulo, desc, caminho, indexar=True):
    robots = '' if indexar else '<meta name="robots" content="noindex">\n'
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo}</title>
<meta name="description" content="{desc}">
{robots}<link rel="canonical" href="https://leunamesoftware.com/{caminho}">
<meta name="theme-color" content="#F6F2EC">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="icon" href="{ICONE}">
<link rel="stylesheet" href="loja.css">
<script>{IDIOMA_JS}</script>
<script src="config.js"></script>
</head>
<body>
<div class="faixa">{t('Envío gratuito a 9 países de Europa · Devolución en 14 días', 'Envio gratuito para 9 países da Europa · Devolução em 14 dias', 'Complimentary shipping to 9 European countries · 14-day returns')}</div>
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="./"><span class="logo-t">LeuName<i>{t('Casa · Cocina · Mascotas', 'Casa · Cozinha · Animais', 'Home · Kitchen · Pets')}</i></span></a>
    <nav class="nav" aria-label="Menu">{links_cats()}</nav>
    <div class="acoes">
      <select class="idioma" data-idioma aria-label="Idioma / Language"><option value="es">ES</option><option value="pt">PT</option><option value="en">EN</option></select>
      <a class="sacola" href="carrito.html" aria-label="Cart">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>
        <b data-qtd hidden>0</b>
      </a>
    </div>
  </div>
</header>
'''


RODAPE = f'''
<section class="garantias">
  <div class="wrap gar-in">
    <div><i class="ico"><svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg></i><h4>{t('Envío gratis', 'Envio grátis', 'Free shipping')}</h4><p>{t('Desde almacenes en la UE. Sin aduanas.', 'De armazéns na UE. Sem alfândega.', 'From EU warehouses. No customs fees.')}</p></div>
    <div><i class="ico"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></i><h4>{t('Pago seguro', 'Pagamento seguro', 'Secure checkout')}</h4><p>{t('Tarjeta, Apple Pay o PayPal. Nunca vemos tus datos bancarios.', 'Cartão, Apple Pay ou PayPal. Nunca vemos os seus dados bancários.', 'Card, Apple Pay or PayPal. We never see your card details.')}</p></div>
    <div><i class="ico"><svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg></i><h4>{t('14 días para devolver', '14 dias para devolver', '14-day returns')}</h4><p>{t('Si no te convence, nos lo devuelves.', 'Se não gostar, pode devolver.', 'Not happy? Send it back.')}</p></div>
    <div><i class="ico"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg></i><h4>{t('Atención por email', 'Apoio por email', 'Email support')}</h4><p>{t('Respondemos en menos de 24 h laborables.', 'Respondemos em menos de 24 h úteis.', 'We reply within one business day.')}</p></div>
  </div>
</section>
<footer class="pie">
  <div class="wrap pie-in">
    <div><a class="logo" href="./"><span class="logo-t">LeuName<i>{t('Casa · Cocina · Mascotas', 'Casa · Cozinha · Animais', 'Home · Kitchen · Pets')}</i></span></a>
      <p>{t('Pequeñas cosas que hacen la vida más fácil, enviadas a toda Europa.', 'Pequenas coisas que facilitam a vida, enviadas para toda a Europa.', 'Little things that make life easier, shipped across Europe.')}</p></div>
    <div><h4>{t('Tienda', 'Loja', 'Shop')}</h4>{links_cats()}</div>
    <div><h4>{t('Ayuda', 'Ajuda', 'Help')}</h4><a href="envios.html">{t('Envíos y devoluciones', 'Envios e devoluções', 'Shipping & returns')}</a><a href="#" data-mail>{t('Contacto', 'Contacto', 'Contact')}</a><a href="carrito.html">{t('Mi carrito', 'O meu carrinho', 'My cart')}</a></div>
    <div><h4>Legal</h4><a href="aviso-legal.html">{t('Aviso legal', 'Aviso legal', 'Legal notice')}</a><a href="envios.html#desistimiento">{t('Derecho de desistimiento', 'Direito de livre resolução', 'Right of withdrawal')}</a><a href="privacidad.html">{t('Privacidad', 'Privacidade', 'Privacy')}</a><a href="cookies.html">Cookies</a></div>
  </div>
  <div class="wrap pie-bajo"><span>© <span data-ano>2026</span> LeuName · leunamesoftware.com</span><span class="pagos">Visa · Mastercard · Apple Pay · Google Pay · PayPal</span></div>
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
chips = ''.join(f'<a class="chip" href="#{c}">{t(es, pt, en)}</a>' for c, e, es, pt, en in CATS)
secoes = ''.join(f'''<section class="wrap cat" id="{c}" hidden>
  <div class="sec-cab"><h2>{t(es, pt, en)}</h2></div>
  <div class="grade" data-grade="{c}"></div>
</section>
''' for c, e, es, pt, en in CATS)
index = f'''<main>
<section class="hero">
  <div class="wrap hero-in">
    <div>
      <span class="selo">{t('Novedades cada semana', 'Novidades todas as semanas', 'New finds every week')}</span>
      <h1>{t('Cosas pequeñas que <em>arreglan</em> tu día.', 'Coisas pequenas que <em>resolvem</em> o seu dia.', 'Little things that <em>fix</em> your day.')}</h1>
      <p>{t('Gadgets prácticos para tu casa, tu cocina y tu mascota. Precio final, envío gratis desde almacenes en Europa y 14 días para devolver.', 'Gadgets práticos para a casa, a cozinha e o seu animal. Preço final, envio grátis a partir de armazéns na Europa e 14 dias para devolver.', 'Handy gadgets for your home, kitchen and pets. Final prices, free shipping from European warehouses and 14 days to return.')}</p>
      <div class="hero-bt"><a class="bt" href="#tienda">{t('Ver productos', 'Ver produtos', 'Shop now')}</a><a class="bt bt-l" href="envios.html">{t('Envíos y devoluciones', 'Envios e devoluções', 'Shipping &amp; returns')}</a></div>
      <ul class="selos"><li>✓ {t('IVA incluido', 'IVA incluído', 'VAT included')}</li><li>✓ {t('Tarjeta o PayPal', 'Cartão ou PayPal', 'Card or PayPal')}</li><li>✓ {t('Sin aduanas', 'Sem alfândega', 'No customs fees')}</li></ul>
    </div>
    <div class="hero-mosaico" id="mosaico" aria-hidden="true">
      <div class="arco"><span class="arco-tx">{t('Selección<br><em>de la semana</em>', 'Seleção<br><em>da semana</em>', 'This week’s<br><em>selection</em>')}</span></div>
      <div class="selo-flut"><b>EU</b><span>{t('Almacenes en Europa', 'Armazéns na Europa', 'Shipped from Europe')}</span></div>
    </div>
  </div>
</section>
<div class="wrap chips" id="tienda">{chips}</div>
<section class="wrap destaque-sec" id="destaques" hidden>
  <div class="sec-cab"><h2>{t('Lo más vendido', 'Os mais vendidos', 'Best sellers')}</h2></div>
  <div class="grade" data-grade="destaque"></div>
</section>
{secoes}<section class="wrap vazio" id="vazio" hidden>
  <div class="vazio-in">
    <h2>{t('Estamos preparando la tienda', 'Estamos a preparar a loja', 'Our shop is almost ready')}</h2>
    <p>{t('Los primeros productos llegan en unos días. Escríbenos y te avisamos.', 'Os primeiros produtos chegam dentro de dias. Escreva-nos e avisamos.', 'The first products arrive in a few days. Drop us a line and we will let you know.')}</p>
    <a class="bt" href="#" data-mail>{t('Avisarme', 'Avisar-me', 'Notify me')}</a>
  </div>
</section>
<section class="como">
  <div class="wrap como-in">
    <div><h2>{t('Así de fácil', 'Simples assim', 'Easy as that')}</h2><p>{t('Sin registros ni cuentas. Eliges, pagas y lo recibes en casa.', 'Sem registos nem contas. Escolhe, paga e recebe em casa.', 'No sign-up needed. Pick, pay and get it delivered.')}</p></div>
    <ol>
      <li><b>{t('Elige', 'Escolha', 'Pick')}</b>{t('Añade lo que te guste al carrito.', 'Junte o que gostar ao carrinho.', 'Add what you like to your cart.')}</li>
      <li><b>{t('Paga seguro', 'Pague com segurança', 'Pay securely')}</b>{t('Tarjeta, Apple Pay, Google Pay o PayPal.', 'Cartão, Apple Pay, Google Pay ou PayPal.', 'Card, Apple Pay, Google Pay or PayPal.')}</li>
      <li><b>{t('Recíbelo', 'Receba', 'Receive it')}</b>{t('Te enviamos el seguimiento por email.', 'Enviamos o seguimento por email.', 'We email you the tracking number.')}</li>
    </ol>
  </div>
</section>
</main>
'''
pagina('index.html', 'LeuName — Clever finds for home, kitchen & pets · Free EU shipping',
       'Handy gadgets for home, kitchen and pets with free shipping to Germany, France, Spain, Italy, the Netherlands, Belgium, Austria, Portugal and Ireland. 14-day returns.',
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
pagina('producto.html', 'Product — LeuName', 'Product details, free shipping across Europe.', produto)

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
pagina('carrito.html', 'Cart — LeuName', 'Your cart.', carrito, indexar=False)

gracias = f'''<main class="wrap ok">
  <div class="vazio-in">
    <h1>{t('¡Gracias por tu pedido!', 'Obrigado pela sua encomenda!', 'Thank you for your order!')}</h1>
    <p>{t('Hemos recibido tu pago. En 1–2 días laborables te enviamos por email el número de seguimiento.', 'Recebemos o seu pagamento. Em 1–2 dias úteis enviamos por email o número de seguimento.', 'We have received your payment. Within 1–2 business days we will email you the tracking number.')}</p>
    <p class="nr" id="nrPedido"></p>
    <a class="bt" href="./">{t('Seguir comprando', 'Continuar a comprar', 'Keep shopping')}</a>
  </div>
</main>
'''
pagina('gracias.html', 'Thank you — LeuName', 'Order received.', gracias, indexar=False)


# ---------------- LEGAIS ----------------
def legal(nome, titulos, textos, desc):
    corpo = (f'<main class="wrap legal"><h1>{t(*titulos)}</h1>'
             f'<div class="es">{textos[0]}</div><div class="pt">{textos[1]}</div><div class="en">{textos[2]}</div>'
             f'<p class="act">{t("Última actualización: " + DATA[0], "Última atualização: " + DATA[1], "Last updated: " + DATA[2])}.</p></main>')
    pagina(nome, f'{titulos[2]} — LeuName', desc, corpo)


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
<h2>Titular de la tienda</h2><p data-titular>Titular: LeuName Softwares · Correo: <a href="#" data-mail>contacto por email</a> · Web: leunamesoftware.com</p>
<h2>Objeto</h2><p>Venta a distancia de pequeños artículos para el hogar, cocina, mascotas y accesorios a consumidores de la Unión Europea. Los pedidos se envían desde almacenes de nuestros socios logísticos en la UE.</p>
<h2>Precios y pago</h2><p>Precios en euros con IVA incluido. Pago con tarjeta, Apple Pay o Google Pay (procesado por Stripe) o con PayPal. El contrato se perfecciona al recibir la confirmación del pago.</p>
<h2>Resolución de litigios</h2><p>Si tienes cualquier problema, escríbenos primero: lo solucionamos. También puedes acudir a los organismos de consumo de tu país.</p>''', '''
<h2>Titular da loja</h2><p data-titular>Titular: LeuName Softwares · Email: <a href="#" data-mail>contacto por email</a> · Site: leunamesoftware.com</p>
<h2>Objeto</h2><p>Venda à distância de pequenos artigos para casa, cozinha, animais e acessórios a consumidores da União Europeia. As encomendas são enviadas a partir de armazéns dos nossos parceiros logísticos na UE.</p>
<h2>Preços e pagamento</h2><p>Preços em euros com IVA incluído. Pagamento com cartão, Apple Pay ou Google Pay (processado pela Stripe) ou com PayPal. O contrato fica concluído com a confirmação do pagamento.</p>
<h2>Resolução de litígios</h2><p>Se tiver algum problema, escreva-nos primeiro: resolvemos. Em Portugal pode também usar o Livro de Reclamações Eletrónico (livroreclamacoes.pt) e as entidades de resolução alternativa de litígios de consumo.</p>''', '''
<h2>Shop owner</h2><p data-titular>Owner: LeuName Softwares · Email: <a href="#" data-mail>contact by email</a> · Website: leunamesoftware.com</p>
<h2>Purpose</h2><p>Distance selling of small home, kitchen, pet and accessory items to consumers in the European Union. Orders ship from our logistics partners' warehouses inside the EU.</p>
<h2>Prices and payment</h2><p>Prices in euros including VAT. Payment by card, Apple Pay or Google Pay (processed by Stripe) or by PayPal. The contract is concluded when you receive payment confirmation.</p>
<h2>Disputes</h2><p>If you have any problem, please contact us first and we will sort it out. You can also contact the consumer authorities in your country.</p>'''),
      'Shop owner details and terms of LeuName.')

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
