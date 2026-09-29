import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutAcesso } from '../../componentes/layout/LayoutAcesso';
import { CampoFormulario, CampoSenha } from '../../componentes/formulario/CampoFormulario';
import { AvisoErro } from '../../componentes/formulario/AvisoErro';
import { SeparadorOu } from '../../componentes/formulario/SeparadorOu';
import { BotaoPrincipal } from '../../componentes/botoes/BotaoPrincipal';
import { IconeCadeado, IconeEnvelope, IconePessoa } from '../../componentes/icones/Icones';
import { cadastrar } from '../../servicos/autenticacao';
import { ErroApi } from '../../servicos/api';
import { useSessao } from '../../estado/SessaoContexto';
import { rotas } from '../../rotas';
import './CriarConta.css';

type Erros = { nome?: string; email?: string; senha?: string; confirmacao?: string };

// Interface 2 — Criar conta. Recriada a partir da referência visual oficial.
export function CriarConta() {
  const navegar = useNavigate();
  const { iniciar } = useSessao();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    const encontrados: Erros = {};
    if (!nome.trim()) encontrados.nome = 'Informe o nome.';
    if (!email.trim()) encontrados.email = 'Informe o e-mail.';
    if (!senha) encontrados.senha = 'Informe a senha.';
    else if (senha.length < 8) encontrados.senha = 'A senha precisa ter pelo menos 8 caracteres.';
    if (!confirmacao) encontrados.confirmacao = 'Repita a senha.';
    else if (senha && confirmacao !== senha) encontrados.confirmacao = 'As senhas não são iguais.';
    setErros(encontrados);
    setErroGeral(null);
    if (Object.values(encontrados).some(Boolean)) return;

    setEnviando(true);
    try {
      // A referência não tem campo de tipo de conta; a conta nasce como "pessoa".
      const sessao = await cadastrar({ nome: nome.trim(), email: email.trim(), senha, tipoConta: 'pessoa' });
      iniciar(sessao);
      navegar(rotas.radar, { replace: true });
    } catch (erro) {
      if (erro instanceof ErroApi && Object.keys(erro.campos).length > 0) {
        setErros({ nome: erro.campos.nome, email: erro.campos.email, senha: erro.campos.senha });
      } else {
        setErroGeral(erro instanceof ErroApi ? erro.message : 'Não foi possível criar a conta. Tente de novo.');
      }
      setEnviando(false);
    }
  }

  return (
    <LayoutAcesso compacto titulo="Criar sua conta" subtitulo={<>Preencha os dados abaixo<br />para começar.</>}>
      <form className="criar-conta" onSubmit={aoEnviar} noValidate>
        <div className="criar-conta__campos">
          <CampoFormulario
            id="cadastro-nome"
            rotulo="Nome completo"
            icone={<IconePessoa />}
            autoComplete="name"
            autoCapitalize="words"
            maxLength={120}
            valor={nome}
            aoMudar={setNome}
            erro={erros.nome}
          />
          <CampoFormulario
            id="cadastro-email"
            rotulo="E-mail"
            icone={<IconeEnvelope />}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            valor={email}
            aoMudar={setEmail}
            erro={erros.email}
          />
          <CampoSenha
            id="cadastro-senha"
            rotulo="Senha"
            icone={<IconeCadeado />}
            autoComplete="new-password"
            valor={senha}
            aoMudar={setSenha}
            erro={erros.senha}
          />
          <CampoSenha
            id="cadastro-confirmacao"
            rotulo="Confirmar senha"
            icone={<IconeCadeado />}
            autoComplete="new-password"
            valor={confirmacao}
            aoMudar={setConfirmacao}
            erro={erros.confirmacao}
          />
        </div>

        <AvisoErro mensagem={erroGeral} />

        <BotaoPrincipal type="submit" seta="borda" className="criar-conta__criar" disabled={enviando}>
          {enviando ? 'Criando conta…' : 'Criar conta'}
        </BotaoPrincipal>

        <SeparadorOu className="criar-conta__ou" />

        <BotaoPrincipal
          variante="contorno"
          seta="voltar"
          className="criar-conta__voltar"
          onClick={() => navegar(rotas.entrar)}
          disabled={enviando}
        >
          Voltar para entrar
        </BotaoPrincipal>
      </form>
    </LayoutAcesso>
  );
}
