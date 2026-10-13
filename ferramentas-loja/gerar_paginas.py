#!/usr/bin/env python3
"""Gera as páginas da loja Europa (ES + PT) em SITE-LEUNAMESOFTWARE/.
Texto bilíngue: t('espanhol', 'português'). A troca de idioma é só CSS (html[lang])."""
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(AQUI, '..', 'SITE-LEUNAMESOFTWARE')
ATUALIZADO = ('12 de octubre de 2026', '12 de outubro de 2026')


def t(es, pt):
    return f'<span class="es">{es}</span><span class="pt">{pt}</span>'


CATS = [  # id, emoji, es, pt
    ('mascotas', '🐾', 'Mascotas', 'Animais'),
    ('casa', '🏠', 'Hogar', 'Casa'),
    ('cocina', '🍳', 'Cocina', 'Cozinha'),
    ('belleza', '✨', 'Belleza', 'Beleza'),
    ('tech', '🔌', 'Gadgets', 'Gadgets'),
    ('coche', '🚗', 'Coche', 'Carro'),
]

ICONE = ("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
         "<rect width='64' height='64' rx='18' fill='%23161616'/><circle cx='46' cy='18' r='7' fill='%23ff5a36'/>"
         "<text x='29' y='45' font-size='32' text-anchor='middle' fill='%23fff' font-family='Arial' font-weight='700'>L</text></svg>")


def cabeca(titulo, desc, caminho, indexar=True):
    robots = '' if indexar else '<meta name="robots" content="noindex">\n'
    return f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo}</title>
<meta name="description" content="{desc}">
{robots}<link rel="canonical" href="https://leunamesoftware.com/{caminho}">
<meta name="theme-color" content="#161616">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="icon" href="{ICONE}">
<link rel="stylesheet" href="loja.css">
<script>try{{var l=localStorage.getItem("lang")||((navigator.language||"").toLowerCase().indexOf("pt")===0?"pt":"es");if(/[?&]lang=pt/.test(location.search))l="pt";if(/[?&]lang=es/.test(location.search))l="es";document.documentElement.lang=l}}catch(e){{}}</script>
<script src="config.js"></script>
</head>
<body>
<div class="faixa">{t('🚚 Envío gratis a España y Portugal · Devolución en 14 días', '🚚 Envio grátis para Portugal e Espanha · Devolução em 14 dias')}</div>
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="./"><span class="logo-m">L</span><span class="logo-t">LeuName<i>{t('ideas para casa', 'ideias para casa')}</i></span></a>
    <nav class="nav" aria-label="Categorías">{''.join(f'<a href="./#{c}">{t(es, pt)}</a>' for c, _, es, pt in CATS)}</nav>
    <div class="acoes">
      <button class="idioma" type="button" data-idioma aria-label="Idioma"><span class="es">PT</span><span class="pt">ES</span></button>
      <a class="sacola" href="carrito.html" aria-label="Carrito">
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
    <div><b>🚚</b><h4>{t('Envío gratis', 'Envio grátis')}</h4><p>{t('Desde almacenes en Europa a España y Portugal.', 'De armazéns na Europa para Portugal e Espanha.')}</p></div>
    <div><b>🔒</b><h4>{t('Pago seguro', 'Pagamento seguro')}</h4><p>{t('Con PayPal o tarjeta. Nunca vemos tus datos bancarios.', 'Com PayPal ou cartão. Nunca vemos os seus dados bancários.')}</p></div>
    <div><b>↩️</b><h4>{t('14 días para devolver', '14 dias para devolver')}</h4><p>{t('Si no te convence, nos lo devuelves.', 'Se não gostar, pode devolver.')}</p></div>
    <div><b>💬</b><h4>{t('Atención por email', 'Apoio por email')}</h4><p>{t('Respondemos en menos de 24 h laborables.', 'Respondemos em menos de 24 h úteis.')}</p></div>
  </div>
</section>
<footer class="pie">
  <div class="wrap pie-in">
    <div><a class="logo" href="./"><span class="logo-m">L</span><span class="logo-t">LeuName<i>{t('ideas para casa', 'ideias para casa')}</i></span></a>
      <p>{t('Pequeñas cosas que hacen la vida más fácil, enviadas a España y Portugal.', 'Pequenas coisas que facilitam a vida, enviadas para Portugal e Espanha.')}</p></div>
    <div><h4>{t('Tienda', 'Loja')}</h4>{''.join(f'<a href="./#{c}">{t(es, pt)}</a>' for c, _, es, pt in CATS)}</div>
    <div><h4>{t('Ayuda', 'Ajuda')}</h4><a href="envios.html">{t('Envíos y devoluciones', 'Envios e devoluções')}</a><a href="#" data-mail>{t('Contacto', 'Contacto')}</a><a href="carrito.html">{t('Mi carrito', 'O meu carrinho')}</a></div>
    <div><h4>Legal</h4><a href="aviso-legal.html">{t('Aviso legal', 'Aviso legal')}</a><a href="envios.html#desistimiento">{t('Derecho de desistimiento', 'Direito de livre resolução')}</a><a href="privacidad.html">{t('Privacidad', 'Privacidade')}</a><a href="cookies.html">Cookies</a></div>
  </div>
  <div class="wrap pie-bajo"><span>© <span data-ano>2026</span> LeuName · leunamesoftware.com</span><span class="pagos">PayPal · Visa · Mastercard</span></div>
</footer>
<div class="cookies" id="cookies" hidden>
  <p>{t('Solo usamos lo necesario para que la tienda funcione (carrito e idioma). Al pagar, PayPal usa sus propias cookies.', 'Só usamos o necessário para a loja funcionar (carrinho e idioma). Ao pagar, o PayPal usa os seus próprios cookies.')} <a href="cookies.html">{t('Más información', 'Saber mais')}</a></p>
  <button type="button" id="cookiesOk">OK</button>
</div>
<div class="aviso" id="aviso" role="status"></div>
<script src="loja.js"></script>
'''


def pagina(nome, titulo, desc, corpo, indexar=True, extra=''):
    html = cabeca(titulo, desc, '' if nome == 'index.html' else nome, indexar) + corpo + RODAPE + extra + '</body>\n</html>\n'
    with open(os.path.join(SITE, nome), 'w', encoding='utf-8') as f:
        f.write(html)


# ---------------- INÍCIO ----------------
chips = ''.join(f'<a class="chip" href="#{c}"><span>{e}</span>{t(es, pt)}</a>' for c, e, es, pt in CATS)
index = f'''<main>
<section class="hero">
  <div class="wrap hero-in">
    <div>
      <span class="selo">{t('Novedades cada semana', 'Novidades todas as semanas')}</span>
      <h1>{t('Cosas pequeñas que <em>arreglan</em> tu día.', 'Coisas pequenas que <em>resolvem</em> o seu dia.')}</h1>
      <p>{t('Gadgets prácticos para tu casa, tu cocina y tu mascota. Precio final, envío gratis desde Europa y 14 días para devolver.', 'Gadgets práticos para a casa, a cozinha e o seu animal. Preço final, envio grátis a partir da Europa e 14 dias para devolver.')}</p>
      <div class="hero-bt"><a class="bt" href="#tienda">{t('Ver productos', 'Ver produtos')}</a><a class="bt bt-l" href="envios.html">{t('Cómo funcionan los envíos', 'Como funcionam os envios')}</a></div>
      <ul class="selos"><li>✓ {t('IVA incluido', 'IVA incluído')}</li><li>✓ {t('Pago con PayPal', 'Pagamento com PayPal')}</li><li>✓ {t('Sin sorpresas en aduana', 'Sem surpresas na alfândega')}</li></ul>
    </div>
    <div class="hero-mosaico" id="mosaico" aria-hidden="true">
      <div class="m1">🐶</div><div class="m2">🍳</div><div class="m3">💡</div><div class="m4">🧺</div>
    </div>
  </div>
</section>
<div class="wrap chips" id="tienda">{chips}</div>
<section class="wrap destaque-sec" id="destaques" hidden>
  <div class="sec-cab"><h2>{t('Lo más vendido', 'Os mais vendidos')}</h2></div>
  <div class="grade" data-grade="destaque"></div>
</section>
{''.join(f"""<section class="wrap cat" id="{c}" hidden>
  <div class="sec-cab"><span class="sec-ico">{e}</span><h2>{t(es, pt)}</h2></div>
  <div class="grade" data-grade="{c}"></div>
</section>""" for c, e, es, pt in CATS)}
<section class="wrap vazio" id="vazio" hidden>
  <div class="vazio-in">
    <b>📦</b>
    <h2>{t('Estamos preparando la tienda', 'Estamos a preparar a loja')}</h2>
    <p>{t('Los primeros productos llegan en unos días. Escríbenos y te avisamos.', 'Os primeiros produtos chegam dentro de dias. Escreva-nos e avisamos.')}</p>
    <a class="bt" href="#" data-mail>{t('Avisarme', 'Avisar-me')}</a>
  </div>
</section>
<section class="como">
  <div class="wrap como-in">
    <div><h2>{t('Así de fácil', 'Simples assim')}</h2><p>{t('Sin registros ni cuentas. Eliges, pagas con PayPal y lo recibes en casa.', 'Sem registos nem contas. Escolhe, paga com PayPal e recebe em casa.')}</p></div>
    <ol>
      <li><b>{t('Elige', 'Escolha')}</b>{t('Añade lo que te guste al carrito.', 'Junte o que gostar ao carrinho.')}</li>
      <li><b>{t('Paga seguro', 'Pague com segurança')}</b>{t('Con PayPal o tarjeta, en euros.', 'Com PayPal ou cartão, em euros.')}</li>
      <li><b>{t('Recíbelo', 'Receba')}</b>{t('Te enviamos el número de seguimiento por email.', 'Enviamos o número de seguimento por email.')}</li>
    </ol>
  </div>
</section>
</main>
'''
pagina('index.html', 'LeuName — Ideas prácticas para casa, cocina y mascotas',
       'Gadgets prácticos para casa, cocina y mascotas con envío gratis a España y Portugal. Pago seguro con PayPal y 14 días para devolver.',
       index)

# ---------------- PRODUTO ----------------
produto = f'''<main class="wrap prod" id="prod">
  <a class="voltar" href="./">← {t('Volver a la tienda', 'Voltar à loja')}</a>
  <div class="prod-in" hidden>
    <div class="galeria"><div class="foto"><img id="pFoto" alt=""></div><div class="miniaturas" id="pMinis"></div></div>
    <div class="info">
      <h1 id="pNome"></h1>
      <div class="preco" id="pPreco"></div>
      <p class="iva">{t('IVA incluido · Envío gratis', 'IVA incluído · Envio grátis')}</p>
      <p class="desc" id="pDesc"></p>
      <ul class="lista" id="pLista"></ul>
      <div class="compra">
        <div class="qtd"><button type="button" data-menos aria-label="-">−</button><span id="pQtd">1</span><button type="button" data-mais aria-label="+">+</button></div>
        <button class="bt bt-g" type="button" id="pAdd">{t('Añadir al carrito', 'Adicionar ao carrinho')}</button>
      </div>
      <a class="bt bt-l bt-w" href="carrito.html" id="pIr" hidden>{t('Ir al carrito y pagar →', 'Ir ao carrinho e pagar →')}</a>
      <div class="entrega">
        <p>🚚 <b>{t('Entrega estimada', 'Entrega estimada')}:</b> <span id="pPrazo"></span></p>
        <p>↩️ {t('14 días para devolver', '14 dias para devolver')} · 🔒 {t('Pago seguro con PayPal', 'Pagamento seguro com PayPal')}</p>
      </div>
      <video id="pVideo" controls playsinline muted preload="none" hidden></video>
    </div>
  </div>
  <div class="vazio-in" id="pNada" hidden><b>🔎</b><h2>{t('Producto no encontrado', 'Produto não encontrado')}</h2><a class="bt" href="./">{t('Ver la tienda', 'Ver a loja')}</a></div>
</main>
'''
pagina('producto.html', 'Producto — LeuName', 'Detalles del producto, envío gratis a España y Portugal.', produto)

# ---------------- CARRINHO ----------------
carrito = f'''<main class="wrap carr">
  <h1>{t('Tu carrito', 'O seu carrinho')}</h1>
  <div class="carr-in">
    <div id="cItens"></div>
    <aside class="resumo" id="cResumo" hidden>
      <h2>{t('Resumen', 'Resumo')}</h2>
      <p class="linha"><span>{t('Productos', 'Produtos')}</span><b id="cSub"></b></p>
      <p class="linha"><span>{t('Envío', 'Envio')}</span><b>{t('Gratis', 'Grátis')}</b></p>
      <p class="linha total"><span>Total <small>{t('(IVA incl.)', '(IVA incl.)')}</small></span><b id="cTotal"></b></p>
      <p class="paises">{t('Enviamos solo a <b>España</b> y <b>Portugal</b> (península e islas Baleares / continente).', 'Enviamos só para <b>Portugal</b> (continente) e <b>Espanha</b> (península e Baleares).')}</p>
      <label class="aceite"><input type="checkbox" id="cAceite"> <span>{t('He leído las <a href="envios.html" target="_blank">condiciones de envío y devolución</a> y la <a href="privacidad.html" target="_blank">política de privacidad</a>.', 'Li as <a href="envios.html" target="_blank">condições de envio e devolução</a> e a <a href="privacidad.html" target="_blank">política de privacidade</a>.')}</span></label>
      <div id="paypal" class="paypal"></div>
      <p class="sem-pp" id="semPP" hidden>{t('El pago se activa en breve. Escríbenos para reservar tu pedido:', 'O pagamento fica ativo em breve. Escreva-nos para reservar a sua encomenda:')} <a href="#" data-mail data-pedido>email</a></p>
      <p class="seguro">🔒 {t('Pago procesado por PayPal. Puedes pagar con tarjeta sin cuenta de PayPal.', 'Pagamento processado pelo PayPal. Pode pagar com cartão sem conta PayPal.')}</p>
    </aside>
  </div>
</main>
'''
pagina('carrito.html', 'Carrito — LeuName', 'Tu carrito de compra.', carrito, indexar=False)

gracias = f'''<main class="wrap ok">
  <div class="vazio-in"><b>🎉</b>
    <h1>{t('¡Gracias por tu pedido!', 'Obrigado pela sua encomenda!')}</h1>
    <p>{t('Hemos recibido tu pago. En 1–2 días laborables te enviamos por email el número de seguimiento.', 'Recebemos o seu pagamento. Em 1–2 dias úteis enviamos por email o número de seguimento.')}</p>
    <p class="nr" id="nrPedido"></p>
    <a class="bt" href="./">{t('Seguir comprando', 'Continuar a comprar')}</a>
  </div>
</main>
'''
pagina('gracias.html', 'Gracias — LeuName', 'Pedido recibido.', gracias, indexar=False)

# ---------------- LEGAIS ----------------
def legal(nome, titulo_es, titulo_pt, es, pt, desc):
    corpo = (f'<main class="wrap legal"><h1>{t(titulo_es, titulo_pt)}</h1>'
             f'<div class="es">{es}</div><div class="pt">{pt}</div>'
             f'<p class="act">{t("Última actualización: " + ATUALIZADO[0], "Última atualização: " + ATUALIZADO[1])}.</p></main>')
    pagina(nome, f'{titulo_es} — LeuName', desc, corpo)


legal('envios.html', 'Envíos y devoluciones', 'Envios e devoluções', '''
<h2>Dónde enviamos</h2><p>España (península y Baleares) y Portugal continental. El envío es gratuito.</p>
<h2>Plazos</h2><p>Preparamos tu pedido en 1–2 días laborables. Los productos salen de almacenes situados en la Unión Europea; la entrega suele tardar entre 3 y 10 días laborables según el producto (lo ves en cada ficha). Te enviamos el número de seguimiento por email.</p>
<h2>Precios e impuestos</h2><p>Los precios son finales, en euros e incluyen el IVA. No hay costes de aduana porque los envíos salen desde la UE.</p>
<h2 id="desistimiento">Derecho de desistimiento (14 días)</h2><p>Tienes 14 días naturales desde que recibes el producto para desistir de la compra sin dar explicaciones. Escríbenos por email con tu número de pedido indicando que deseas desistir; te indicaremos la dirección de devolución. El producto debe devolverse en buen estado. Te reembolsaremos todos los importes pagados, incluido el envío inicial, en un plazo máximo de 14 días desde que nos comuniques el desistimiento, por el mismo medio de pago (PayPal). Podemos retener el reembolso hasta recibir el producto o la prueba de su envío. Los gastos de la devolución corren a cargo del cliente, salvo que el producto llegue defectuoso o no sea el pedido.</p>
<p>Modelo de desistimiento: «Por la presente le comunico que desisto de mi contrato de venta del siguiente bien: [producto], pedido el [fecha] / recibido el [fecha]. Nombre, dirección, fecha.»</p>
<h2>Productos defectuosos o dañados</h2><p>Si algo llega roto o no funciona, envíanos una foto por email en un plazo de 14 días y te enviamos otro o te devolvemos el dinero, sin coste para ti. Tienes además la garantía legal de conformidad de 3 años.</p>
<h2>Pedidos no recibidos</h2><p>Si tu pedido no llega en el plazo indicado, escríbenos y lo resolvemos: reenvío o reembolso completo.</p>''', '''
<h2>Para onde enviamos</h2><p>Portugal continental e Espanha (península e Baleares). O envio é gratuito.</p>
<h2>Prazos</h2><p>Preparamos a sua encomenda em 1–2 dias úteis. Os produtos saem de armazéns na União Europeia; a entrega costuma demorar entre 3 e 10 dias úteis conforme o produto (vê o prazo em cada página). Enviamos o número de seguimento por email.</p>
<h2>Preços e impostos</h2><p>Os preços são finais, em euros e com IVA incluído. Não há custos de alfândega porque os envios saem da UE.</p>
<h2 id="desistimiento">Direito de livre resolução (14 dias)</h2><p>Tem 14 dias de calendário a partir da receção do produto para desistir da compra sem dar justificação. Envie-nos um email com o número da encomenda a indicar que deseja desistir; indicamos a morada de devolução. O produto deve ser devolvido em bom estado. Reembolsamos todos os valores pagos, incluindo o envio inicial, no prazo máximo de 14 dias após a sua comunicação, pelo mesmo meio de pagamento (PayPal). Podemos reter o reembolso até recebermos o produto ou a prova do seu envio. Os custos da devolução ficam a cargo do cliente, exceto se o produto chegar com defeito ou não for o encomendado.</p>
<p>Modelo de livre resolução: «Pela presente comunico que desisto do meu contrato de compra do seguinte bem: [produto], encomendado em [data] / recebido em [data]. Nome, morada, data.»</p>
<h2>Produtos com defeito ou danificados</h2><p>Se algo chegar partido ou não funcionar, envie-nos uma foto por email no prazo de 14 dias e enviamos outro ou devolvemos o dinheiro, sem custos para si. Tem ainda a garantia legal de conformidade de 3 anos.</p>
<h2>Encomendas não recebidas</h2><p>Se a encomenda não chegar no prazo indicado, escreva-nos e resolvemos: reenvio ou reembolso total.</p>''',
      'Envío gratis a España y Portugal, plazos y derecho de desistimiento de 14 días.')

legal('aviso-legal.html', 'Aviso legal', 'Aviso legal', '''
<h2>Titular de la tienda</h2><p data-titular>Titular: LeuName Softwares · Correo: <a href="#" data-mail>contacto por email</a> · Web: leunamesoftware.com</p>
<h2>Objeto</h2><p>Venta a distancia de pequeños artículos para el hogar, cocina, mascotas y accesorios a consumidores de España y Portugal. Los pedidos se envían desde almacenes de nuestros proveedores logísticos en la Unión Europea.</p>
<h2>Precios y pago</h2><p>Precios en euros con IVA incluido. El pago se realiza mediante PayPal (cuenta PayPal o tarjeta). El contrato se perfecciona cuando recibes la confirmación del pago.</p>
<h2>Resolución de litigios</h2><p>Si tienes cualquier problema, escríbenos primero: lo solucionamos. También puedes acudir a las asociaciones de consumidores o a los organismos de consumo de tu país.</p>''', '''
<h2>Titular da loja</h2><p data-titular>Titular: LeuName Softwares · Email: <a href="#" data-mail>contacto por email</a> · Site: leunamesoftware.com</p>
<h2>Objeto</h2><p>Venda à distância de pequenos artigos para casa, cozinha, animais e acessórios a consumidores de Portugal e Espanha. As encomendas são enviadas a partir de armazéns dos nossos parceiros logísticos na União Europeia.</p>
<h2>Preços e pagamento</h2><p>Preços em euros com IVA incluído. O pagamento é feito pelo PayPal (conta PayPal ou cartão). O contrato fica concluído quando recebe a confirmação do pagamento.</p>
<h2>Resolução de litígios</h2><p>Se tiver algum problema, escreva-nos primeiro: resolvemos. Em Portugal pode também recorrer ao Livro de Reclamações Eletrónico (livroreclamacoes.pt) e às entidades de resolução alternativa de litígios de consumo.</p>''',
      'Datos del titular y condiciones de la tienda LeuName.')

legal('privacidad.html', 'Política de privacidad', 'Política de privacidade', '''
<h2>Responsable</h2><p>LeuName Softwares (<a href="#" data-mail>email</a>).</p>
<h2>Qué datos usamos</h2><p>Solo los necesarios para entregarte el pedido: nombre, dirección de envío y email, que nos facilita PayPal al pagar. No guardamos datos de tarjetas: el pago lo procesa PayPal.</p>
<h2>Para qué</h2><p>Para preparar y enviar el pedido (los datos se comunican al almacén y a la empresa de transporte) y para atenderte. Base legal: ejecución del contrato. Los conservamos el tiempo exigido por la ley fiscal.</p>
<h2>Tus derechos</h2><p>Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad escribiéndonos por email. También puedes reclamar ante la autoridad de protección de datos de tu país (AEPD en España, CNPD en Portugal).</p>
<h2>Sin publicidad</h2><p>No vendemos tus datos ni te enviamos publicidad sin tu permiso.</p>''', '''
<h2>Responsável</h2><p>LeuName Softwares (<a href="#" data-mail>email</a>).</p>
<h2>Que dados usamos</h2><p>Só os necessários para entregar a encomenda: nome, morada de envio e email, que o PayPal nos fornece no pagamento. Não guardamos dados de cartões: o pagamento é processado pelo PayPal.</p>
<h2>Para quê</h2><p>Para preparar e enviar a encomenda (os dados são comunicados ao armazém e à transportadora) e para lhe dar apoio. Base legal: execução do contrato. Conservamos os dados pelo tempo exigido pela lei fiscal.</p>
<h2>Os seus direitos</h2><p>Pode pedir acesso, retificação, apagamento, oposição, limitação e portabilidade por email. Pode também apresentar queixa à autoridade de proteção de dados (CNPD em Portugal, AEPD em Espanha).</p>
<h2>Sem publicidade</h2><p>Não vendemos os seus dados nem enviamos publicidade sem autorização.</p>''',
      'Cómo tratamos tus datos (RGPD).')

legal('cookies.html', 'Política de cookies', 'Política de cookies', '''
<p>Esta tienda no usa cookies de publicidad ni de análisis. Solo guarda en tu navegador el contenido del carrito, el idioma y si has cerrado el aviso de cookies (almacenamiento local, técnico y necesario).</p>
<p>Al pagar, PayPal carga su propio botón y puede usar cookies necesarias para el pago y la prevención del fraude, según su política.</p>''', '''
<p>Esta loja não usa cookies de publicidade nem de análise. Só guarda no seu navegador o conteúdo do carrinho, o idioma e se fechou o aviso de cookies (armazenamento local, técnico e necessário).</p>
<p>No pagamento, o PayPal carrega o seu próprio botão e pode usar cookies necessários ao pagamento e à prevenção de fraude, segundo a sua política.</p>''',
      'Cookies técnicas de la tienda.')

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
  <p class="nov-sub">O robô procura todo dia produtos baratos com estoque em armazém europeu, calcula o frete para Espanha e Portugal e sugere o preço. <b>Para vender um produto</b>, toque em "Quero vender" e mande o ID para o Claude: ele traduz e coloca na loja.</p>
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
