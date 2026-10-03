import { exportarCopia, importarCopia, negocio as repoNegocio } from '../dados/banco';
import { useEstado } from '../estado';
import { IDIOMAS, t, useIdioma } from '../i18n';
import { MOEDAS, REGIOES, regiaoDe } from '../regioes/regioes';
import { Topo } from '../componentes/base';
import { compartilharArquivo } from '../servicos/compartilhar';

declare const __VERSAO_APP__: string;

export function Mais() {
  useIdioma();
  const { ir, aviso, recarregarNegocio } = useEstado();

  async function salvarCopia() {
    const copia = await exportarCopia();
    const blob = new Blob([JSON.stringify(copia)], { type: 'application/json' });
    await compartilharArquivo(blob, `facturo-copia-${copia.geradoEm.slice(0, 10)}.json`, t('mais.backup'));
  }

  async function restaurar(arquivo: File) {
    if (!window.confirm(t('mais.importarConfirma'))) return;
    try {
      await importarCopia(JSON.parse(await arquivo.text()));
      await recarregarNegocio();
      aviso(t('mais.importado'));
    } catch {
      aviso(t('comum.erro'));
    }
  }

  const linha = (rotulo: string, acao: () => void, icone: string) => (
    <button className="item-lista" onClick={acao}>
      <span aria-hidden style={{ fontSize: 22, width: 28 }}>{icone}</span>
      <div className="principal"><div className="titulo">{rotulo}</div></div>
      <span aria-hidden>›</span>
    </button>
  );

  return (
    <>
      <Topo titulo={t('mais.titulo')} />
      <main className="conteudo">
        <section className="cartao">
          <div className="lista">
            {linha(t('mais.meuNegocio'), () => ir({ nome: 'negocio' }), '🏪')}
            {linha(t('mais.itens'), () => ir({ nome: 'itens' }), '🧾')}
            {linha(t('mais.ajustes'), () => ir({ nome: 'ajustes' }), '🌎')}
          </div>
        </section>
        <section className="cartao">
          <h2>{t('mais.backup')}</h2>
          <div className="acoes">
            <button className="botao secundario" onClick={salvarCopia}>⬇ {t('mais.exportar')}</button>
            <label className="botao secundario">
              ⬆ {t('mais.importar')}
              <input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restaurar(f); }} />
            </label>
          </div>
        </section>
        <p style={{ textAlign: 'center', color: 'var(--suave)', fontSize: 13 }}>
          Facturo · {t('mais.versao', { v: __VERSAO_APP__ })} · LeuName Softwares
        </p>
      </main>
    </>
  );
}

function nomePais(codigo: string, idioma: string): string {
  try { return new Intl.DisplayNames([idioma], { type: 'region' }).of(codigo) ?? codigo; } catch { return codigo; }
}

export function Ajustes() {
  const idioma = useIdioma();
  const { negocio, recarregarNegocio, aviso } = useEstado();
  if (!negocio) return null;

  async function mudar(parcial: Partial<typeof negocio>) {
    await repoNegocio.salvar({ ...negocio!, ...parcial });
    await recarregarNegocio();
    aviso(t('comum.salvo'));
  }

  return (
    <>
      <Topo titulo={t('mais.ajustes')} voltar />
      <main className="conteudo">
        <section className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="campo">
            <label htmlFor="aj-idioma">{t('ajustes.idioma')}</label>
            <select id="aj-idioma" className="entrada" value={negocio.idioma} onChange={(e) => void mudar({ idioma: e.target.value })}>
              {Object.entries(IDIOMAS).map(([c, i]) => <option key={c} value={c}>{i.nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="aj-pais">{t('ajustes.pais')}</label>
            <select id="aj-pais" className="entrada" value={negocio.pais} onChange={(e) => void mudar({ pais: e.target.value, moeda: regiaoDe(e.target.value).moeda })}>
              {Object.keys(REGIOES).map((c) => ({ c, n: nomePais(c, idioma) })).sort((a, b) => a.n.localeCompare(b.n)).map(({ c, n }) => <option key={c} value={c}>{n}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="aj-moeda">{t('ajustes.moeda')}</label>
            <select id="aj-moeda" className="entrada" value={negocio.moeda} onChange={(e) => void mudar({ moeda: e.target.value })}>
              {MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </section>
      </main>
    </>
  );
}
