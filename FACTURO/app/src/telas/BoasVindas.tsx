import { useEffect, useRef, useState } from 'react';
import { criarNegocioInicial, type DadosEmpresa } from '../dominio/acoes';
import { iniciais } from '../dominio/marca';
import { importarCopia } from '../dados/banco';
import { useEstado } from '../estado';
import { idiomaAtual, t, useIdioma } from '../i18n';
import { PROFISSOES, nomeNoIdioma } from '../modelos/profissoes';
import { paisDoAparelho, regiaoDe } from '../regioes/regioes';
import { reduzirImagem } from '../servicos/imagem';

type Etapa = 'inicio' | 'empresa' | 'area';

/** Primeiro uso: boas-vindas → conta da empresa → área de atuação. Idioma, país e moeda vêm do aparelho. */
export function BoasVindas() {
  useIdioma();
  const [etapa, setEtapa] = useState<Etapa>('inicio');
  const [empresa, setEmpresa] = useState<DadosEmpresa>({ nome: '', telefone: '', email: '', documento: '', logo: null });
  useEffect(() => { window.scrollTo(0, 0); }, [etapa]);

  if (etapa === 'inicio') return <Inicio aoComecar={() => setEtapa('empresa')} />;
  if (etapa === 'empresa') return <Empresa dados={empresa} mudar={setEmpresa} aoVoltar={() => setEtapa('inicio')} aoContinuar={() => setEtapa('area')} />;
  return <Area empresa={empresa} aoVoltar={() => setEtapa('empresa')} />;
}

function Inicio({ aoComecar }: { aoComecar: () => void }) {
  const { recarregarNegocio, aviso } = useEstado();
  async function restaurar(arquivo: File) {
    try {
      await importarCopia(JSON.parse(await arquivo.text()));
      await recarregarNegocio();
    } catch {
      aviso(t('comum.erro'));
    }
  }
  return (
    <div className="bv-tela bv-hero">
      <div className="bv-hero-topo">
        <img className="bv-icone" src="./icone.png" alt="" />
        <h1>Facturo</h1>
        <p>{t('boasVindas.sub')}</p>
      </div>
      <ul className="bv-beneficios">
        {(['beneficio1', 'beneficio2', 'beneficio3'] as const).map((b, i) => (
          <li key={b}><span aria-hidden>{['⚡', '💬', '✍️'][i]}</span>{t('boasVindas.' + b)}</li>
        ))}
      </ul>
      <div className="bv-acoes">
        <button className="botao" onClick={aoComecar}>{t('boasVindas.criarConta')}</button>
        <label className="bv-link">
          {t('boasVindas.restaurar')}
          <input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restaurar(f); }} />
        </label>
      </div>
    </div>
  );
}

function Passos({ n, aoVoltar }: { n: 1 | 2; aoVoltar: () => void }) {
  return (
    <div className="bv-passos">
      <button type="button" className="icone-botao" aria-label={t('boasVindas.voltar')} onClick={aoVoltar}>←</button>
      <div className="bv-barra"><span style={{ width: n === 1 ? '50%' : '100%' }} /></div>
      <small>{t('boasVindas.passo', { n })}</small>
    </div>
  );
}

function Empresa({ dados, mudar, aoVoltar, aoContinuar }: { dados: DadosEmpresa; mudar: (d: DadosEmpresa) => void; aoVoltar: () => void; aoContinuar: () => void }) {
  const [erro, setErro] = useState<'nome' | 'email' | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const reg = regiaoDe(paisDoAparelho());
  const campo = (k: keyof DadosEmpresa) => (e: { target: { value: string } }) => { mudar({ ...dados, [k]: e.target.value }); setErro(null); };

  function continuar(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (dados.nome.trim().length < 2) { setErro('nome'); nomeRef.current?.focus(); return; }
    if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) { setErro('email'); return; }
    aoContinuar();
  }

  return (
    <form className="bv-tela" onSubmit={continuar} noValidate>
      <Passos n={1} aoVoltar={aoVoltar} />
      <div>
        <h1 className="bv-titulo">{t('boasVindas.contaTitulo')}</h1>
        <p className="bv-sub">{t('boasVindas.contaSub')}</p>
      </div>

      <div className="bv-logo">
        {dados.logo ? <img src={dados.logo} alt="" /> : <div className="bv-logo-iniciais">{dados.nome.trim() ? iniciais(dados.nome) : '+'}</div>}
        <div className="bv-logo-texto">
          <label className="botao secundario bv-logo-botao">
            {dados.logo ? t('boasVindas.trocarLogo') : t('boasVindas.adicionarLogo')}
            <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) mudar({ ...dados, logo: await reduzirImagem(f) }); }} />
          </label>
          <small>{t('boasVindas.logoDica')}</small>
        </div>
      </div>

      <div className="campo">
        <label htmlFor="bv-nome">{t('boasVindas.nomeEmpresa')}</label>
        <input id="bv-nome" ref={nomeRef} className={'entrada' + (erro === 'nome' ? ' invalida' : '')} value={dados.nome} onChange={campo('nome')}
          placeholder={t('boasVindas.nomeEmpresaDica')} autoComplete="organization" enterKeyHint="next" />
        {erro === 'nome' && <small className="bv-erro">{t('boasVindas.faltaNomeEmpresa')}</small>}
      </div>
      <div className="campo">
        <label htmlFor="bv-tel">{t('boasVindas.whatsapp')}</label>
        <input id="bv-tel" className="entrada" type="tel" inputMode="tel" value={dados.telefone} onChange={campo('telefone')} autoComplete="tel" enterKeyHint="next" />
      </div>
      <div className="campo">
        <label htmlFor="bv-email">{t('boasVindas.email')} <span className="bv-opc">({t('boasVindas.opcional')})</span></label>
        <input id="bv-email" className={'entrada' + (erro === 'email' ? ' invalida' : '')} type="email" inputMode="email" value={dados.email} onChange={campo('email')} autoComplete="email" enterKeyHint="next" />
        {erro === 'email' && <small className="bv-erro">{t('boasVindas.emailInvalido')}</small>}
      </div>
      <div className="campo">
        <label htmlFor="bv-doc">{reg.rotuloDocumento} <span className="bv-opc">({t('boasVindas.opcional')})</span></label>
        <input id="bv-doc" className="entrada" value={dados.documento} onChange={campo('documento')} enterKeyHint="done" />
      </div>

      <button className="botao" type="submit">{t('boasVindas.continuar')} →</button>
    </form>
  );
}

function Area({ empresa, aoVoltar }: { empresa: DadosEmpresa; aoVoltar: () => void }) {
  const idioma = useIdioma();
  const { recarregarNegocio } = useEstado();
  const [criando, setCriando] = useState(false);

  async function escolher(profissao: string) {
    setCriando(true);
    await criarNegocioInicial(empresa, paisDoAparelho(), profissao, idiomaAtual());
    await recarregarNegocio();
  }

  if (criando) return <div className="bv-tela bv-criando"><div className="bv-spinner" />{t('boasVindas.criando')}</div>;
  return (
    <div className="bv-tela">
      <Passos n={2} aoVoltar={aoVoltar} />
      <div>
        <h1 className="bv-titulo">{t('boasVindas.profissao')}</h1>
        <p className="bv-sub">{t('boasVindas.profissaoSub')}</p>
      </div>
      <div className="profissoes">
        {PROFISSOES.map((p) => (
          <button key={p.id} className="profissao" onClick={() => void escolher(p.id)}>
            <span className="e" aria-hidden>{p.icone}</span>
            {nomeNoIdioma(p.nome, idioma)}
          </button>
        ))}
      </div>
    </div>
  );
}
