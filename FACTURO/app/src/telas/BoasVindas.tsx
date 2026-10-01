import { useState } from 'react';
import { criarNegocioInicial } from '../dominio/acoes';
import { useEstado } from '../estado';
import { idiomaAtual, t, useIdioma } from '../i18n';
import { PROFISSOES, nomeNoIdioma } from '../modelos/profissoes';
import { paisDoAparelho } from '../regioes/regioes';
import { Campo } from '../componentes/base';

export function BoasVindas() {
  const idioma = useIdioma();
  const { recarregarNegocio } = useEstado();
  const pais = paisDoAparelho(); // idioma, país e moeda vêm do aparelho (dá para mudar depois em Ajustes)
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

        <button className="botao" disabled={!pronto || salvando} onClick={comecar}>
          {t('boasVindas.comecar')}
        </button>
      </div>
    </div>
  );
}
