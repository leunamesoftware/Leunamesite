import { useState, type FormEvent, type ReactNode } from 'react';
import type { ResumoRadar, TipoConta, Usuario } from '@compartilhado/contratos';
import { useSessao } from '../../estado/SessaoContexto';
import { useCarregar } from '../../estado/useCarregar';
import { useAlertasNaoLidos } from '../../componentes/app/LayoutApp';
import { MarcaHorizontal } from '../../componentes/marca/MarcaHorizontal';
import { CampoFormulario, CampoSenha } from '../../componentes/formulario/CampoFormulario';
import { AvisoErro } from '../../componentes/formulario/AvisoErro';
import { BotaoPrincipal } from '../../componentes/botoes/BotaoPrincipal';
import { ConfirmarDialogo } from '../../componentes/app/Dialogos';
import {
  IconeCadeado,
  IconeCheck,
  IconeChevron,
  IconeDocumento,
  IconeLapis,
  IconePasta,
  IconePessoa,
  IconeSair,
  IconeLixeira,
  IconeSino,
} from '../../componentes/icones/Icones';
import { ErroApi } from '../../servicos/api';
import { dataBr } from '../../utilitarios/situacao';
import './TelaConta.css';

// Interface 8 — Minha Conta. Recriada a partir da referência visual oficial,
// só com o que a V1 tem de verdade: dados pessoais, senha, números reais e sair.

type Painel = 'dados' | 'senha' | 'excluir' | null;

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1]![0] : '')).toUpperCase();
}

export function TelaConta() {
  const { sessao, api, sair, atualizarUsuario } = useSessao();
  const { naoLidos } = useAlertasNaoLidos();
  const resumo = useCarregar(() => api<ResumoRadar>('/radar'), [api]);
  const [painel, setPainel] = useState<Painel>(null);
  const [confirmarSair, setConfirmarSair] = useState(false);
  const usuario = sessao?.usuario;
  if (!usuario) return null;

  const alternar = (p: Painel) => setPainel((atual) => (atual === p ? null : p));

  return (
    <div className="tela-conta">
      <header className="tela-conta__topo">
        <MarcaHorizontal className="tela-conta__marca" />
      </header>

      <div>
        <h1 className="app-titulo">Minha Conta</h1>
        <p className="app-subtitulo">Gerencie seu perfil e a segurança da sua conta.</p>
      </div>

      <section className="tela-conta__perfil">
        <span className="tela-conta__avatar" aria-hidden="true">
          {iniciais(usuario.nome) || <IconePessoa />}
        </span>
        <div className="tela-conta__identidade">
          <p className="tela-conta__nome">{usuario.nome}</p>
          <p className="tela-conta__email">{usuario.email}</p>
          <p className="tela-conta__desde">Membro desde {dataBr(usuario.criadoEm.slice(0, 10))}</p>
        </div>
        <button type="button" className="tela-conta__editar" onClick={() => setPainel('dados')}>
          <IconeLapis />
          Editar perfil
        </button>
      </section>

      <div className="tela-conta__numeros">
        <Numero tom="azul" icone={<IconeDocumento />} valor={resumo.dados?.totalAtivos} nome="A pagar" detalhe="a vencer ou vencidos" />
        <Numero tom="vermelho" icone={<IconeSino />} valor={naoLidos} nome="Alertas" detalhe="não lidos" />
        <Numero tom="verde" icone={<IconeCheck />} valor={resumo.dados?.totalResolvidos} nome="Em dia" detalhe="pagos" />
        <Numero tom="laranja" icone={<IconePasta />} valor={resumo.dados?.pendencias.length} nome="Pendências" detalhe="de cadastro" />
      </div>

      <div className="tela-conta__opcoes">
        <Opcao
          tom="azul"
          icone={<IconePessoa />}
          titulo="Meus dados pessoais"
          descricao="Nome, e-mail e tipo de conta"
          aberto={painel === 'dados'}
          aoAlternar={() => alternar('dados')}
        >
          <FormularioDados usuario={usuario} aoSalvar={(u) => {
            atualizarUsuario(u);
            setPainel(null);
          }} />
        </Opcao>
        <Opcao
          tom="roxo"
          icone={<IconeCadeado />}
          titulo="Senha e segurança"
          descricao="Troque sua senha de acesso"
          aberto={painel === 'senha'}
          aoAlternar={() => alternar('senha')}
        >
          <FormularioSenha aoConcluir={() => setPainel(null)} />
        </Opcao>
        <a className="tela-conta__opcao tela-conta__link tom-azul" href="/privacidade.html" target="_blank" rel="noopener">
          <span className="tela-conta__opcao-botao">
            <span className="icone-item tom-azul" aria-hidden="true">
              <IconeDocumento />
            </span>
            <span className="tela-conta__opcao-textos">
              <span className="tela-conta__opcao-titulo">Política de privacidade</span>
              <span className="tela-conta__opcao-descricao">Como seus dados são tratados</span>
            </span>
            <IconeChevron className="tela-conta__opcao-seta" />
          </span>
        </a>
        <Opcao
          tom="vermelho"
          icone={<IconeLixeira />}
          titulo="Excluir conta"
          descricao="Apaga de vez sua conta e todos os dados"
          aberto={painel === 'excluir'}
          aoAlternar={() => alternar('excluir')}
        >
          <FormularioExcluir />
        </Opcao>
      </div>

      <button type="button" className="tela-conta__sair" onClick={() => setConfirmarSair(true)}>
        <IconeSair />
        Sair da conta
      </button>

      <ConfirmarDialogo
        aberto={confirmarSair}
        titulo="Sair da conta?"
        texto="Você vai precisar entrar de novo com e-mail e senha neste aparelho."
        textoConfirmar="Sair"
        perigoso
        aoConfirmar={() => void sair()}
        aoCancelar={() => setConfirmarSair(false)}
      />
    </div>
  );
}

function Numero({ tom, icone, valor, nome, detalhe }: { tom: string; icone: ReactNode; valor: number | undefined; nome: string; detalhe: string }) {
  return (
    <div className={`tela-conta__numero tom-${tom}`}>
      <span className="tela-conta__numero-icone" aria-hidden="true">
        {icone}
      </span>
      <div>
        <p className="tela-conta__numero-valor">{valor ?? '–'}</p>
        <p className="tela-conta__numero-nome">{nome}</p>
        <p className="tela-conta__numero-detalhe">{detalhe}</p>
      </div>
    </div>
  );
}

function Opcao({
  tom,
  icone,
  titulo,
  descricao,
  aberto,
  aoAlternar,
  children,
}: {
  tom: string;
  icone: ReactNode;
  titulo: string;
  descricao: string;
  aberto: boolean;
  aoAlternar: () => void;
  children: ReactNode;
}) {
  const idPainel = `painel-${titulo.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section className={`tela-conta__opcao tom-${tom} ${aberto ? 'tela-conta__opcao--aberta' : ''}`}>
      <button type="button" className="tela-conta__opcao-botao" aria-expanded={aberto} aria-controls={idPainel} onClick={aoAlternar}>
        <span className={`icone-item tom-${tom}`} aria-hidden="true">
          {icone}
        </span>
        <span className="tela-conta__opcao-textos">
          <span className="tela-conta__opcao-titulo">{titulo}</span>
          <span className="tela-conta__opcao-descricao">{descricao}</span>
        </span>
        <IconeChevron className="tela-conta__opcao-seta" />
      </button>
      {aberto && (
        <div id={idPainel} className="tela-conta__painel">
          {children}
        </div>
      )}
    </section>
  );
}

function FormularioDados({ usuario, aoSalvar }: { usuario: Usuario; aoSalvar: (u: Usuario) => void }) {
  const { api } = useSessao();
  const [nome, setNome] = useState(usuario.nome);
  const [tipoConta, setTipoConta] = useState<TipoConta>(usuario.tipoConta);
  const [erro, setErro] = useState<string | undefined>();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) {
      setErro('Informe o nome.');
      return;
    }
    setEnviando(true);
    setErro(undefined);
    setErroGeral(null);
    try {
      aoSalvar(await api<Usuario>('/conta', { metodo: 'PUT', corpo: { nome: nome.trim(), tipoConta } }));
    } catch (falha) {
      if (falha instanceof ErroApi && falha.campos.nome) setErro(falha.campos.nome);
      else setErroGeral(falha instanceof ErroApi ? falha.message : 'Não foi possível salvar.');
      setEnviando(false);
    }
  }

  return (
    <form className="tela-conta__formulario" onSubmit={enviar} noValidate>
      <CampoFormulario id="conta-nome" rotulo="Nome completo" icone={<IconePessoa />} autoComplete="name" maxLength={120} valor={nome} aoMudar={setNome} erro={erro} />
      <p className="tela-conta__fixo">
        E-mail: <strong>{usuario.email}</strong>
      </p>
      <div className="tela-conta__tipo" role="radiogroup" aria-label="Tipo de conta">
        {(['pessoa', 'empresa'] as const).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={tipoConta === t} className={`opcao ${tipoConta === t ? 'opcao--ativa' : ''}`} onClick={() => setTipoConta(t)}>
            {t === 'pessoa' ? 'Pessoa' : 'Empresa'}
          </button>
        ))}
      </div>
      <AvisoErro mensagem={erroGeral} />
      <BotaoPrincipal type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Salvar dados'}
      </BotaoPrincipal>
    </form>
  );
}

function FormularioSenha({ aoConcluir }: { aoConcluir: () => void }) {
  const { api } = useSessao();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<{ senhaAtual?: string; novaSenha?: string; confirmacao?: string }>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const encontrados: typeof erros = {};
    if (!atual) encontrados.senhaAtual = 'Informe a senha atual.';
    if (nova.length < 8) encontrados.novaSenha = 'A nova senha precisa ter pelo menos 8 caracteres.';
    if (nova !== confirmacao) encontrados.confirmacao = 'As senhas não são iguais.';
    setErros(encontrados);
    setErroGeral(null);
    if (Object.values(encontrados).some(Boolean)) return;
    setEnviando(true);
    try {
      await api('/conta/senha', { metodo: 'POST', corpo: { senhaAtual: atual, novaSenha: nova } });
      setConcluido(true);
      setTimeout(aoConcluir, 2200);
    } catch (falha) {
      if (falha instanceof ErroApi && Object.keys(falha.campos).length) setErros(falha.campos);
      else setErroGeral(falha instanceof ErroApi ? falha.message : 'Não foi possível trocar a senha.');
    } finally {
      setEnviando(false);
    }
  }

  if (concluido) {
    return <p className="tela-conta__sucesso" role="status">Senha trocada. Os outros aparelhos conectados foram desconectados.</p>;
  }

  return (
    <form className="tela-conta__formulario" onSubmit={enviar} noValidate>
      <CampoSenha id="senha-atual" rotulo="Senha atual" icone={<IconeCadeado />} autoComplete="current-password" valor={atual} aoMudar={setAtual} erro={erros.senhaAtual} />
      <CampoSenha id="senha-nova" rotulo="Nova senha" icone={<IconeCadeado />} autoComplete="new-password" valor={nova} aoMudar={setNova} erro={erros.novaSenha} />
      <CampoSenha id="senha-confirmar" rotulo="Confirmar nova senha" icone={<IconeCadeado />} autoComplete="new-password" valor={confirmacao} aoMudar={setConfirmacao} erro={erros.confirmacao} />
      <AvisoErro mensagem={erroGeral} />
      <BotaoPrincipal type="submit" disabled={enviando}>
        {enviando ? 'Trocando…' : 'Trocar senha'}
      </BotaoPrincipal>
    </form>
  );
}

function FormularioExcluir() {
  const { api, sair } = useSessao();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  function pedir(e: FormEvent) {
    e.preventDefault();
    if (!senha) {
      setErro('Informe sua senha para confirmar.');
      return;
    }
    setErro(undefined);
    setConfirmar(true);
  }

  async function excluir() {
    setEnviando(true);
    setErroGeral(null);
    try {
      await api('/conta/excluir', { metodo: 'POST', corpo: { senha } });
      await sair();
    } catch (falha) {
      setConfirmar(false);
      setEnviando(false);
      if (falha instanceof ErroApi && falha.campos.senha) setErro(falha.campos.senha);
      else setErroGeral(falha instanceof ErroApi ? falha.message : 'Não foi possível excluir a conta.');
    }
  }

  return (
    <form className="tela-conta__formulario" onSubmit={pedir} noValidate>
      <p className="tela-conta__fixo">
        Isso apaga de vez seu cadastro, todos os documentos e prazos, alertas, histórico e arquivos anexados. Não dá para desfazer.
      </p>
      <CampoSenha id="excluir-senha" rotulo="Sua senha" icone={<IconeCadeado />} autoComplete="current-password" valor={senha} aoMudar={setSenha} erro={erro} />
      <AvisoErro mensagem={erroGeral} />
      <button type="submit" className="tela-conta__excluir">
        <IconeLixeira />
        Excluir minha conta
      </button>
      <ConfirmarDialogo
        aberto={confirmar}
        titulo="Excluir a conta de vez?"
        texto="Todos os seus dados e arquivos serão apagados agora. Essa ação não tem volta."
        textoConfirmar="Excluir de vez"
        perigoso
        ocupado={enviando}
        aoConfirmar={() => void excluir()}
        aoCancelar={() => setConfirmar(false)}
      />
    </form>
  );
}
