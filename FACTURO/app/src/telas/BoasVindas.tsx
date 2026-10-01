import { useState } from 'react';
import { criarNegocioInicial } from '../dominio/acoes';
import { useEstado } from '../estado';
import { IDIOMAS, definirIdioma, idiomaAtual, t, useIdioma } from '../i18n';
import { PROFISSOES, nomeNoIdioma } from '../modelos/profissoes';
import { REGIOES, paisDoAparelho, regiaoDe } from '../regioes/regioes';
import { Campo } from '../componentes/base';

function nomePais(codigo: string, idioma: string): string {
  try {
    return new Intl.DisplayNames([idioma], { type: 'region' }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

export function BoasVindas() {
  const idioma = useIdioma();
  const { recarregarNegocio } = useEstado();
  const [pais, setPais] = useState(paisDoAparelho());
  const [profissao, setProfissao] = useState('');
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const pronto = nome.trim().length > 1 && profissao;

  async function comecar() {
    setSalvando(true);
    await criarNegocioInicial(nome, pais, profissao, idiomaAtual());
    await recarregarNegocio();
  }

  return (
    <div className="app">
      <div className="boas-vindas">
        <img className="logo" src="./icone.png" alt="" />
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 28 }}>{t('boasVindas.titulo')}</h1>
          <p style={{ margin: 0, color: 'var(--suave)' }}>{t('boasVindas.sub')}</p>
        </div>

        <div className="chips" role="group" aria-label="Idioma">
          {Object.entries(IDIOMAS).map(([cod, i]) => (
            <button key={cod} className={'chip' + (cod === idioma ? ' ativo' : '')} onClick={() => definirIdioma(cod, regiaoDe(pais).locale)}>
              {i.nome}
            </button>
          ))}
        </div>

        <div className="campo">
          <label>{t('boasVindas.profissao')}</label>
          <small>{t('boasVindas.profissaoAjuda')}</small>
          <div className="profissoes">
            {PROFISSOES.map((p) => (
              <button key={p.id} className={'profissao' + (p.id === profissao ? ' ativo' : '')} onClick={() => setProfissao(p.id)}>
                <span className="e" aria-hidden>{p.icone}</span>
                {nomeNoIdioma(p.nome, idioma)}
              </button>
            ))}
          </div>
        </div>

        <Campo id="bv-nome" rotulo={t('boasVindas.nomeNegocio')} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="organization" />

        <div className="campo">
          <label htmlFor="bv-pais">{t('boasVindas.pais')}</label>
          <select id="bv-pais" className="entrada" value={pais} onChange={(e) => setPais(e.target.value)}>
            {Object.keys(REGIOES)
              .map((c) => ({ c, n: nomePais(c, idioma) }))
              .sort((a, b) => a.n.localeCompare(b.n))
              .map(({ c, n }) => (
                <option key={c} value={c}>{n}</option>
              ))}
          </select>
        </div>

        <button className="botao" disabled={!pronto || salvando} onClick={comecar}>
          {t('boasVindas.comecar')}
        </button>
      </div>
    </div>
  );
}
