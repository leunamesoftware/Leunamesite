import { useEffect, useRef, useState } from 'react';
import { criarNegocioInicial } from '../dominio/acoes';
import { useEstado } from '../estado';
import { idiomaAtual, t, useIdioma } from '../i18n';
import { PROFISSOES, nomeNoIdioma } from '../modelos/profissoes';
import { paisDoAparelho } from '../regioes/regioes';

/** Entrada em 2 passos: 1) toca na profissão  2) digita o nome e começa. Idioma, país e moeda vêm do aparelho. */
export function BoasVindas() {
  const idioma = useIdioma();
  const { recarregarNegocio } = useEstado();
  const [profissao, setProfissao] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const escolhida = PROFISSOES.find((p) => p.id === profissao);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (profissao) campo.current?.focus();
  }, [profissao]);

  async function comecar() {
    if (nome.trim().length < 2) { setErro(true); campo.current?.focus(); return; }
    setSalvando(true);
    await criarNegocioInicial(nome.trim(), paisDoAparelho(), profissao, idiomaAtual());
    await recarregarNegocio();
  }

  return (
    <div className="app">
      <div className="boas-vindas">
        <img className="logo" src="./icone.png" alt="" />
        <div>
          <h1 className="bv-titulo">{t('boasVindas.titulo')}</h1>
          <p className="bv-sub">{t('boasVindas.sub')}</p>
        </div>
        <div className="bv-passo">{t('boasVindas.passo', { n: escolhida ? 2 : 1 })}</div>

        {!escolhida ? (
          <div className="campo">
            <label>{t('boasVindas.profissao')}</label>
            <small>{t('boasVindas.profissaoAjuda')}</small>
            <div className="profissoes">
              {PROFISSOES.map((p) => (
                <button key={p.id} className="profissao" onClick={() => setProfissao(p.id)}>
                  <span className="e" aria-hidden>{p.icone}</span>
                  {nomeNoIdioma(p.nome, idioma)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form className="bv-form" onSubmit={(e) => { e.preventDefault(); void comecar(); }}>
            <div className="profissao ativo bv-escolhida">
              <span className="e" aria-hidden>{escolhida.icone}</span>
              <span style={{ flex: 1 }}>{nomeNoIdioma(escolhida.nome, idioma)}</span>
              <button type="button" className="bv-trocar" onClick={() => setProfissao('')}>{t('boasVindas.trocar')}</button>
            </div>
            <div className="campo">
              <label htmlFor="bv-nome">{t('boasVindas.nomeNegocio')}</label>
              <input
                id="bv-nome" ref={campo} className={'entrada' + (erro ? ' invalida' : '')} value={nome}
                autoComplete="organization" enterKeyHint="go"
                onChange={(e) => { setNome(e.target.value); setErro(false); }}
              />
              {erro && <small className="bv-erro">{t('boasVindas.faltaNome')}</small>}
            </div>
            <button className="botao" type="submit" disabled={salvando}>{t('boasVindas.comecar')} →</button>
          </form>
        )}
      </div>
    </div>
  );
}
