import { useEffect, useRef } from 'react';
import { geoDistance, geoEquirectangular, geoOrthographic, geoPath, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import terraTopo from 'world-atlas/land-110m.json';

// Globo terrestre com luzes e conexões, desenhado em canvas a partir do mapa real
// dos continentes. Decorativo: gira bem devagar e para se o sistema pedir menos movimento.

type Props = { className?: string };

const topologia = terraTopo as unknown as Topology<{ land: GeometryCollection }>;
const terra = feature(topologia, topologia.objects.land);

// Cidades usadas como nós da rede de conexões (longitude, latitude).
const CIDADES: [number, number][] = [
  [-46.6, -23.5], // São Paulo
  [-43.2, -22.9], // Rio de Janeiro
  [-47.9, -15.8], // Brasília
  [-38.5, -3.7], // Fortaleza
  [-58.4, -34.6], // Buenos Aires
  [-77.0, -12.0], // Lima
  [-74.1, 4.7], // Bogotá
  [-99.1, 19.4], // Cidade do México
  [-74.0, 40.7], // Nova York
  [-87.6, 41.9], // Chicago
  [-9.1, 38.7], // Lisboa
  [-3.7, 40.4], // Madri
  [2.35, 48.9], // Paris
  [-0.1, 51.5], // Londres
  [13.4, 52.5], // Berlim
  [12.5, 41.9], // Roma
  [3.4, 6.5], // Lagos
  [-17.4, 14.7], // Dacar
  [31.2, 30.0], // Cairo
  [13.2, -8.8], // Luanda
  [18.4, -33.9], // Cidade do Cabo
];

const CONEXOES: [number, number][] = [
  [0, 10], [0, 8], [0, 4], [0, 19], [1, 17], [1, 13], [2, 6], [3, 17], [3, 10],
  [4, 20], [5, 6], [6, 7], [7, 8], [8, 13], [9, 8], [10, 11], [11, 12], [12, 14],
  [13, 12], [15, 18], [16, 19], [16, 17], [17, 10], [18, 14], [19, 20], [2, 5],
];

// Gerador pseudoaleatório fixo: o desenho sai sempre igual.
function sorteador(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Luz = { lon: number; lat: number; forca: number };

let luzesEmCache: Luz[] | null = null;

// Amostra pontos só sobre os continentes, usando o mapa rasterizado uma única vez.
function gerarLuzes(): Luz[] {
  if (luzesEmCache) return luzesEmCache;
  const L = 720;
  const A = 360;
  const tela = document.createElement('canvas');
  tela.width = L;
  tela.height = A;
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const proj = geoEquirectangular().fitSize([L, A], { type: 'Sphere' });
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  geoPath(proj, ctx)(terra);
  ctx.fill();
  const pixels = ctx.getImageData(0, 0, L, A).data;
  const aleatorio = sorteador(20260929);
  const luzes: Luz[] = [];
  const passo = 0.85;
  for (let lat = -60; lat <= 78; lat += passo) {
    const passoLon = passo / Math.max(0.35, Math.cos((lat * Math.PI) / 180));
    for (let lon = -180; lon < 180; lon += passoLon) {
      const x = Math.floor(((lon + 180) / 360) * L);
      const y = Math.floor(((90 - lat) / 180) * A);
      if ((pixels[(y * L + x) * 4] ?? 0) < 128) continue;
      const r = aleatorio();
      if (r < 0.35) continue;
      luzes.push({
        lon: lon + (aleatorio() - 0.5) * passo * 0.6,
        lat: lat + (aleatorio() - 0.5) * passo * 0.6,
        forca: r > 0.96 ? 1 : r > 0.82 ? 0.7 : 0.25 + aleatorio() * 0.3,
      });
    }
  }
  luzesEmCache = luzes;
  return luzes;
}

function criarBrilho(cor: string): HTMLCanvasElement {
  const t = document.createElement('canvas');
  t.width = t.height = 64;
  const c = t.getContext('2d');
  if (c) {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, cor);
    g.addColorStop(1, 'rgba(20,110,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }
  return t;
}

export function GloboConectado({ className }: Props) {
  const telaRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const tela = telaRef.current;
    const ctx = tela?.getContext('2d');
    if (!tela || !ctx) return;

    const luzes = gerarLuzes();
    const brilho = criarBrilho('rgba(120,210,255,0.9)');
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)');

    let largura = 0;
    let altura = 0;
    let raio = 0;
    let centroY = 0;
    let giro = 0;
    let quadro = 0;
    let ultimo = 0;

    const projecao: GeoProjection = geoOrthographic().clipAngle(90).precision(0.5);
    const caminho = geoPath(projecao, ctx);

    function medir() {
      if (!tela) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = tela.clientWidth;
      altura = tela.clientHeight;
      tela.width = Math.round(largura * dpr);
      tela.height = Math.round(altura * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Horizonte curvo como na referência: raio um pouco maior que a largura útil.
      raio = Math.max(Math.min(largura, 620) * 1.05, largura * 0.62);
      // O canvas começa acima da área do globo (para os arcos no céu); o horizonte
      // fica no topo dessa área.
      const pai = tela.parentElement;
      const folga = pai ? pai.getBoundingClientRect().top - tela.getBoundingClientRect().top : 0;
      centroY = raio + folga + 6;
      desenhar();
    }

    function desenhar() {
      const c = ctx!;
      const cx = largura / 2;
      c.clearRect(0, 0, largura, altura);
      projecao.scale(raio).translate([cx, centroY]).rotate([35 + giro, 55, 0]);
      const centroGeo = projecao.invert?.([cx, centroY]) ?? [0, 0];

      // Arcos finos no céu, só nas laterais (somem no meio, onde fica o texto).
      const lateral = c.createLinearGradient(0, 0, largura, 0);
      lateral.addColorStop(0, 'rgba(90,170,255,0.4)');
      lateral.addColorStop(0.3, 'rgba(90,170,255,0)');
      lateral.addColorStop(0.7, 'rgba(90,170,255,0)');
      lateral.addColorStop(1, 'rgba(90,170,255,0.4)');
      c.lineWidth = 1;
      c.strokeStyle = lateral;
      for (const [dx, rx, ry] of [
        [-0.55, 0.75, 1.25],
        [0.6, 0.8, 1.2],
        [-0.2, 1.1, 1.05],
        [0.3, 1.2, 1.0],
      ] as const) {
        c.beginPath();
        c.ellipse(cx + dx * raio, centroY, rx * raio, ry * raio, 0, Math.PI * 1.05, Math.PI * 1.95);
        c.stroke();
      }

      // Atmosfera.
      const halo = c.createRadialGradient(cx, centroY, raio * 0.96, cx, centroY, raio * 1.1);
      halo.addColorStop(0, 'rgba(40,150,255,0.55)');
      halo.addColorStop(0.3, 'rgba(30,120,255,0.22)');
      halo.addColorStop(1, 'rgba(10,60,200,0)');
      c.fillStyle = halo;
      c.beginPath();
      c.arc(cx, centroY, raio * 1.1, 0, Math.PI * 2);
      c.fill();

      // Corpo do planeta.
      const corpo = c.createRadialGradient(cx, centroY, raio * 0.6, cx, centroY, raio);
      corpo.addColorStop(0, '#010613');
      corpo.addColorStop(0.86, '#031236');
      corpo.addColorStop(0.97, '#0b3a93');
      corpo.addColorStop(1, '#3d9bff');
      c.fillStyle = corpo;
      c.beginPath();
      c.arc(cx, centroY, raio, 0, Math.PI * 2);
      c.fill();

      // Continentes.
      c.fillStyle = 'rgba(28,86,190,0.28)';
      c.beginPath();
      caminho(terra);
      c.fill();

      // Luzes das cidades sobre os continentes.
      for (const luz of luzes) {
        if (geoDistance([luz.lon, luz.lat], centroGeo) > 1.52) continue;
        const p = projecao([luz.lon, luz.lat]);
        if (!p || p[1] > altura + 4 || p[1] < -4) continue;
        if (luz.forca >= 0.7) {
          const s = luz.forca === 1 ? 7 : 4;
          c.globalAlpha = luz.forca === 1 ? 0.9 : 0.55;
          c.drawImage(brilho, p[0] - s, p[1] - s, s * 2, s * 2);
          c.globalAlpha = 1;
        } else {
          c.fillStyle = `rgba(110,180,255,${luz.forca})`;
          c.fillRect(p[0] - 0.6, p[1] - 0.6, 1.3, 1.3);
        }
      }

      // Rede de conexões entre cidades.
      c.strokeStyle = 'rgba(120,200,255,0.4)';
      c.lineWidth = 1;
      for (const [a, b] of CONEXOES) {
        const origem = CIDADES[a];
        const destino = CIDADES[b];
        if (!origem || !destino) continue;
        c.beginPath();
        caminho({ type: 'LineString', coordinates: [origem, destino] });
        c.stroke();
      }
      for (const cidade of CIDADES) {
        if (geoDistance(cidade, centroGeo) > 1.5) continue;
        const p = projecao(cidade);
        if (!p) continue;
        c.drawImage(brilho, p[0] - 11, p[1] - 11, 22, 22);
      }

      // Borda iluminada do horizonte.
      c.strokeStyle = 'rgba(150,215,255,0.85)';
      c.lineWidth = 1.6;
      c.shadowColor = 'rgba(60,160,255,0.9)';
      c.shadowBlur = 18;
      c.beginPath();
      c.arc(cx, centroY, raio, Math.PI, Math.PI * 2);
      c.stroke();
      c.shadowBlur = 0;
    }

    function animar(agora: number) {
      quadro = requestAnimationFrame(animar);
      if (agora - ultimo < 50) return;
      ultimo = agora;
      // Balanço lento de poucos graus: o globo se mexe sem perder o enquadramento.
      giro = Math.sin(agora / 9000) * 6;
      desenhar();
    }

    function iniciarOuParar() {
      cancelAnimationFrame(quadro);
      ultimo = 0;
      if (!reduzir.matches) quadro = requestAnimationFrame(animar);
      else desenhar();
    }

    const observador = new ResizeObserver(medir);
    observador.observe(tela);
    medir();
    iniciarOuParar();
    reduzir.addEventListener('change', iniciarOuParar);

    return () => {
      observador.disconnect();
      cancelAnimationFrame(quadro);
      reduzir.removeEventListener('change', iniciarOuParar);
    };
  }, []);

  return <canvas ref={telaRef} className={className} aria-hidden="true" />;
}
