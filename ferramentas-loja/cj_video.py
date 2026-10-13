#!/usr/bin/env python3
"""Descobre como a CJ entrega o LINK do vídeo (a API devolve só IDs). Grava video.json (sem a chave)."""
import json, os, re, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cj_sync import CJ

out = {}
# 1) documentação: trechos que falam de vídeo
for url in ['https://developers.cjdropshipping.com/en/api/api2/api/product.html',
            'https://developers.cjdropshipping.cn/en/api/api2/api/product.html']:
    try:
        h = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=40).read().decode('utf-8', 'ignore')
        t = re.sub(r'<[^>]+>', ' ', h); t = re.sub(r'\s+', ' ', t)
        out[url] = {'caminhos': sorted(set(re.findall(r'/api2\.0/v1/[\w/]+', h))),
                    'trechos': [t[max(0, m.start() - 300): m.start() + 1500] for m in re.finditer(r'(?i)query product video', t)][:4]}
        break
    except Exception as e:
        out[url] = str(e)
cj = CJ(os.environ['CJ_API_KEY'])
PID = '1730523281935048704'
d = cj.req('GET', '/product/query', params={'pid': PID, 'features': 'enable_video'})
dd = d.get('data') or {}
out['query_campos_video'] = {k: v for k, v in dd.items() if 'ideo' in k}
vids = dd.get('productVideo') or dd.get('videoList') or []
vid = vids[0] if vids else ''
out['video_id'] = vid
for metodo, cam, corpo, params in [
    ('POST', '/product/video/query', {'videoIds': [vid]}, None),
    ('POST', '/product/queryVideo', {'videoIds': [vid]}, None),
    ('POST', '/product/video/list', {'pid': PID}, None),
    ('GET', '/product/video', None, {'pid': PID}),
    ('POST', '/product/getVideoUrl', {'videoId': vid}, None),
    ('POST', '/product/video/getPlayInfo', {'videoId': vid}, None),
]:
    r = cj.req(metodo, cam, corpo, params=params)
    out['tentativa ' + cam] = json.dumps(r)[:800]
json.dump(out, open('video.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False)[:3000])
