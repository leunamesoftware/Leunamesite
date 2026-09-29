import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ItemResumo, Situacao } from '@compartilhado/contratos';
import { situacaoDe, textoPrazo, TOM_DA_SITUACAO, type Tom } from '../../utilitarios/situacao';
import { rotaItem } from '../../rotas';
import './RadarVivo.css';

// Radar animado com os itens reais da pessoa.
// - Distância do centro = quanto falta para vencer (vencidos no miolo).
// - A varredura gira; ao passar por um item que pede ação (vencido, vence hoje,
//   urgente) ela para um instante, o ponto pisca forte e o nome aparece embaixo.
// - Os itens que pedem ação continuam piscando sempre.

const COR: Record<Tom, string> = {
  vermelho: '#ff4d5e',
  laranja: '#ff8a1f',
  amarelo: '#ffc21a',
  verde: '#22d36b',
  azul: '#3d8bff',
  roxo: '#9b6bff',
};

const PEDE_ACAO: Situacao[] = ['vencido', 'vence_hoje', 'urgente'];
const VOLTA_MS = 5200; // uma volta completa da varredura
const PAUSA_MS = 1400; // tempo parado sobre um item que pede ação
const DIAS_NA_BORDA = 90;

type Ponto = { item: ItemResumo; angulo: number; raio: number; cor: string; pedeAcao: boolean };

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

const ANGULO_DE_OURO = Math.PI * (3 - Math.sqrt(5)); // ~137,5°: espalha os pontos sem sobrepor

function montarPontos(itens: ItemResumo[]): Ponto[] {
  return itens
    .filter((i) => i.estado === 'ativo' && i.dataVencimento)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item, indice) => {
      const s = situacaoDe(item);
      const dias = item.analise?.diasRestantes ?? DIAS_NA_BORDA;
      const raio = s === 'vencido' ? 0.16 + hash(item.id + 'r') * 0.08 : 0.26 + (0.68 * Math.min(Math.max(dias, 0), DIAS_NA_BORDA)) / DIAS_NA_BORDA;
      const angulo = (-Math.PI / 3 + indice * ANGULO_DE_OURO) % (Math.PI * 2);
      return { item, angulo, raio, cor: COR[TOM_DA_SITUACAO[s]], pedeAcao: PEDE_ACAO.includes(s) };
    });
}

export function RadarVivo({ itens }: { itens: ItemResumo[] }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const navegar = useNavigate();
  const pontos = useMemo(() => montarPontos(itens), [itens]);
  const [focado, setFocado] = useState<Ponto | null>(null);
  const pedemAcao = pontos.filter((p) => p.pedeAcao).length;

  useEffect(() => {
    const c = tela.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let tamanho = 0;
    let angulo = -Math.PI / 2;
    let pausaAte = 0;
    let anterior = performance.now();
    let quadro = 0;
    const acesoEm = new Map<string, number>();

    function medir() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      tamanho = c!.clientWidth;
      c!.width = Math.round(tamanho * dpr);
      c!.height = Math.round(tamanho * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function desenhar(agora: number) {
      const g = ctx!;
      const m = tamanho / 2;
      const R = m * 0.94;
      g.clearRect(0, 0, tamanho, tamanho);

      // Fundo e anéis
      const fundo = g.createRadialGradient(m, m, 0, m, m, R);
      fundo.addColorStop(0, 'rgba(20, 80, 190, 0.35)');
      fundo.addColorStop(1, 'rgba(4, 16, 48, 0.9)');
      g.fillStyle = fundo;
      g.beginPath();
      g.arc(m, m, R, 0, Math.PI * 2);
      g.fill();

      g.lineWidth = 1;
      for (const f of [0.25, 0.5, 0.75, 1]) {
        g.strokeStyle = f === 1 ? 'rgba(90, 170, 255, 0.7)' : 'rgba(70, 140, 255, 0.28)';
        g.beginPath();
        g.arc(m, m, R * f, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = 'rgba(70, 140, 255, 0.22)';
      g.beginPath();
      g.moveTo(m - R, m);
      g.lineTo(m + R, m);
      g.moveTo(m, m - R);
      g.lineTo(m, m + R);
      g.stroke();
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const dentro = i % 6 === 0 ? R * 0.93 : R * 0.965;
        g.strokeStyle = i % 6 === 0 ? 'rgba(110, 180, 255, 0.55)' : 'rgba(110, 180, 255, 0.25)';
        g.beginPath();
        g.moveTo(m + Math.cos(a) * dentro, m + Math.sin(a) * dentro);
        g.lineTo(m + Math.cos(a) * R, m + Math.sin(a) * R);
        g.stroke();
      }

      // Varredura (rastro em leque + linha)
      if (!reduzir) {
        const abertura = 0.9;
        const passos = 24;
        for (let i = 0; i < passos; i++) {
          const a1 = angulo - abertura + (abertura * i) / passos;
          const a2 = angulo - abertura + (abertura * (i + 1)) / passos;
          g.fillStyle = `rgba(40, 200, 255, ${0.22 * ((i + 1) / passos) ** 2})`;
          g.beginPath();
          g.moveTo(m, m);
          g.arc(m, m, R, a1, a2 + 0.002);
          g.closePath();
          g.fill();
        }
        g.strokeStyle = 'rgba(190, 245, 255, 0.95)';
        g.lineWidth = 2;
        g.shadowColor = 'rgba(40, 200, 255, 0.9)';
        g.shadowBlur = 10;
        g.beginPath();
        g.moveTo(m, m);
        g.lineTo(m + Math.cos(angulo) * R, m + Math.sin(angulo) * R);
        g.stroke();
        g.shadowBlur = 0;
      }

      // Pontos
      for (const p of pontos) {
        const x = m + Math.cos(p.angulo) * R * p.raio;
        const y = m + Math.sin(p.angulo) * R * p.raio;
        const aceso = reduzir ? 0.6 : Math.exp(-(agora - (acesoEm.get(p.item.id) ?? -1e9)) / 1600);
        const piscar = p.pedeAcao && !reduzir ? 0.55 + 0.45 * Math.sin(agora / 180) : 1;
        const base = p.pedeAcao ? 0.75 : 0.35;
        const alfa = Math.min(1, (base + aceso) * piscar);
        const r = (p.pedeAcao ? 5.5 : 4) + aceso * 3;

        if (p.pedeAcao && !reduzir) {
          const onda = ((agora / 1300) % 1);
          g.strokeStyle = p.cor;
          g.globalAlpha = (1 - onda) * 0.8;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(x, y, r + onda * 16, 0, Math.PI * 2);
          g.stroke();
        }
        g.globalAlpha = alfa;
        g.fillStyle = p.cor;
        g.shadowColor = p.cor;
        g.shadowBlur = 8 + aceso * 14;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        g.globalAlpha = 1;
      }

      // Centro
      g.fillStyle = '#d8fbff';
      g.shadowColor = '#3cc6ff';
      g.shadowBlur = 14;
      g.beginPath();
      g.arc(m, m, 4, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }

    function passo(agora: number) {
      quadro = requestAnimationFrame(passo);
      const dt = Math.min(agora - anterior, 64);
      anterior = agora;
      if (agora >= pausaAte) {
        const antes = angulo;
        angulo += (dt / VOLTA_MS) * Math.PI * 2;
        // Quais pontos a linha acabou de cruzar?
        for (const p of pontos) {
          const volta = Math.PI * 2;
          const delta = (((p.angulo - antes) % volta) + volta) % volta;
          // delta > 0: não dispara de novo no ponto em que acabou de parar.
          if (delta > 1e-6 && delta <= angulo - antes) {
            acesoEm.set(p.item.id, agora);
            if (p.pedeAcao) {
              angulo = antes + delta;
              pausaAte = agora + PAUSA_MS;
              setFocado(p);
              break;
            }
          }
        }
        angulo %= Math.PI * 2;
      }
      desenhar(agora);
    }

    medir();
    const observador = new ResizeObserver(() => {
      medir();
      desenhar(performance.now());
    });
    observador.observe(c);
    if (reduzir) {
      desenhar(performance.now());
      const primeiro = pontos.find((p) => p.pedeAcao);
      if (primeiro) setFocado(primeiro);
    } else {
      quadro = requestAnimationFrame(passo);
    }
    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
    };
  }, [pontos]);

  function aoTocar(evento: React.MouseEvent<HTMLCanvasElement>) {
    const c = tela.current;
    if (!c) return;
    const caixa = c.getBoundingClientRect();
    const m = caixa.width / 2;
    const R = m * 0.94;
    const x = evento.clientX - caixa.left;
    const y = evento.clientY - caixa.top;
    let melhor: { p: Ponto; d: number } | null = null;
    for (const p of pontos) {
      const px = m + Math.cos(p.angulo) * R * p.raio;
      const py = m + Math.sin(p.angulo) * R * p.raio;
      const d = Math.hypot(px - x, py - y);
      if (d < 22 && (!melhor || d < melhor.d)) melhor = { p, d };
    }
    if (melhor) navegar(rotaItem(melhor.p.item.id));
  }

  const descricao =
    pontos.length === 0
      ? 'Radar sem itens com data de vencimento.'
      : `Radar com ${pontos.length} ${pontos.length === 1 ? 'item' : 'itens'}; ${pedemAcao} ${pedemAcao === 1 ? 'pede' : 'pedem'} ação agora.`;

  return (
    <section className="radar-vivo" aria-label="Radar dos seus vencimentos">
      <canvas ref={tela} className="radar-vivo__tela" role="img" aria-label={descricao} onClick={aoTocar} />
      <div className="radar-vivo__legenda">
        {focado ? (
          <button type="button" className={`radar-vivo__foco tom-${TOM_DA_SITUACAO[situacaoDe(focado.item)]}`} onClick={() => navegar(rotaItem(focado.item.id))}>
            <span className="radar-vivo__ponto" aria-hidden="true" />
            <span className="radar-vivo__foco-titulo">{focado.item.titulo}</span>
            <span className="radar-vivo__foco-prazo">{textoPrazo(focado.item)}</span>
          </button>
        ) : (
          <p className="radar-vivo__calmo">
            {pontos.length === 0 ? 'Cadastre itens com data de vencimento para vê-los no radar.' : 'Nada pedindo ação agora. O radar segue vigiando.'}
          </p>
        )}
        {pedemAcao > 0 && (
          <p className="radar-vivo__resumo">
            {pedemAcao === 1 ? '1 item pede ação agora' : `${pedemAcao} itens pedem ação agora`}
          </p>
        )}
      </div>
    </section>
  );
}
