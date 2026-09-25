# Gera uma prévia em UM arquivo HTML (abre offline, direto do celular).
# Uso: flutter build web --release --no-web-resources-cdn && python3 tool/previa_html.py build/web previa.html
import base64, json, os, sys
W = sys.argv[1]; OUT = sys.argv[2]
rd = lambda p: open(os.path.join(W, p), 'rb').read()
assets = {}
for root, _, files in os.walk(os.path.join(W, 'assets')):
    for f in files:
        full = os.path.join(root, f); rel = os.path.relpath(full, W)
        if rel.endswith('AssetManifest.bin') or rel.endswith('NOTICES'): continue
        assets[rel] = base64.b64encode(open(full, 'rb').read()).decode()
esc = lambda s: s.replace('</script', '<\\/script')
main_js = esc(rd('main.dart.js').decode())
ck_js = esc(rd('canvaskit/canvaskit.js').decode())
wasm = base64.b64encode(rd('canvaskit/canvaskit.wasm')).decode()
html = f'''<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#480082">
<title>EconoRota — Prévia</title>
<style>html,body{{height:100%;margin:0;background:#14062B;color:#fff}}#loading{{position:fixed;inset:0;display:grid;place-items:center;font:500 15px/1.4 system-ui,sans-serif;color:#A9B0D6;text-align:center;padding:24px}}</style>
</head><body>
<div id="loading">Carregando prévia do EconoRota…<br><small>(pode levar alguns segundos)</small></div>
<script type="text/plain" id="ck">{ck_js}</script>
<script type="text/plain" id="main">{main_js}</script>
<script>
(function() {{
  var ASSETS = {json.dumps(assets)};
  var WASM = "{wasm}";
  var TYPES = {{json:'application/json', png:'image/png', webp:'image/webp', ttf:'font/ttf', otf:'font/otf', frag:'application/octet-stream'}};
  function bytes(b64) {{ var s = atob(b64), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }}
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function(input, init) {{
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    var i = url.indexOf('assets/');
    if (i >= 0) {{
      var key = decodeURIComponent(url.slice(i).split('?')[0]);
      if (ASSETS[key] !== undefined) {{
        var ext = key.split('.').pop();
        return Promise.resolve(new Response(bytes(ASSETS[key]), {{status: 200, headers: {{'Content-Type': TYPES[ext] || 'application/octet-stream'}}}}));
      }}
      return Promise.resolve(new Response('', {{status: 404}}));
    }}
    return realFetch(input, init);
  }};
  function hideLoading() {{ var el = document.getElementById('loading'); if (el) el.remove(); }}
  window.addEventListener('flutter-first-frame', hideLoading);
  var ckUrl = URL.createObjectURL(new Blob([document.getElementById('ck').textContent], {{type: 'text/javascript'}}));
  window.flutterCanvasKitLoaded = import(ckUrl).then(function(mod) {{
    return mod.default({{
      instantiateWasm: function(imports, done) {{
        WebAssembly.instantiate(bytes(WASM), imports).then(function(r) {{ done(r.instance, r.module); }});
        return {{}};
      }}
    }});
  }}).then(function(ck) {{
    window.flutterCanvasKit = ck;
    var s = document.createElement('script');
    s.src = URL.createObjectURL(new Blob([document.getElementById('main').textContent], {{type: 'text/javascript'}}));
    document.body.appendChild(s);
    return ck;
  }}).catch(function(e) {{
    document.getElementById('loading').textContent = 'Não foi possível abrir a prévia neste navegador. Tente pelo Google Chrome. (' + e + ')';
  }});
}})();
</script>
</body></html>'''
open(OUT, 'w').write(html)
print(len(html) // 1024 // 1024, 'MB')
