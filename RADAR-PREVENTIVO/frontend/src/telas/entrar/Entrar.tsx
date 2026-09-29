import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutAcesso } from '../../componentes/layout/LayoutAcesso';
import { CampoFormulario, CampoSenha } from '../../componentes/formulario/CampoFormulario';
import { AvisoErro } from '../../componentes/formulario/AvisoErro';
import { BotaoPrincipal } from '../../componentes/botoes/BotaoPrincipal';
import { IconeCadeado, IconeEnvelope } from '../../componentes/icones/Icones';
import { entrar } from '../../servicos/autenticacao';
import { ErroApi } from '../../servicos/api';
import { useSessao } from '../../estado/SessaoContexto';
import { rotas } from '../../rotas';
import './Entrar.css';

type Erros = { email?: string; senha?: string };

// Interface 2 — Entrar. Recriada a partir da referência visual oficial.
export function Entrar() {
  const navegar = useNavigate();
  const { iniciar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    const faltando: Erros = {};
    if (!email.trim()) faltando.email = 'Informe o e-mail.';
    if (!senha) faltando.senha = 'Informe a senha.';
    setErros(faltando);
    setErroGeral(null);
    if (faltando.email || faltando.senha) return;

    setEnviando(true);
    try {
      const sessao = await entrar({ email: email.trim(), senha });
      iniciar(sessao);
      navegar(rotas.radar, { replace: true });
    } catch (erro) {
      if (erro instanceof ErroApi && Object.keys(erro.campos).length > 0) {
        setErros({ email: erro.campos.email, senha: erro.campos.senha });
      } else {
        setErroGeral(erro instanceof ErroApi ? erro.message : 'Não foi possível entrar. Tente de novo.');
      }
      setEnviando(false);
    }
  }

  return (
    <LayoutAcesso titulo="Bem-vindo!" subtitulo={<>Acesse sua conta ou crie uma nova<br />para continuar.</>}>
      <form className="entrar" onSubmit={aoEnviar} noValidate>
        <CampoFormulario
          id="entrar-email"
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
          id="entrar-senha"
          rotulo="Senha"
          icone={<IconeCadeado />}
          autoComplete="current-password"
          valor={senha}
          aoMudar={setSenha}
          erro={erros.senha}
        />

        <AvisoErro mensagem={erroGeral} />

        <BotaoPrincipal type="submit" seta="borda" className="entrar__entrar" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </BotaoPrincipal>
        <BotaoPrincipal
          variante="contorno"
          seta="borda"
          className="entrar__criar"
          onClick={() => navegar(rotas.criarConta)}
          disabled={enviando}
        >
          Criar conta
        </BotaoPrincipal>
      </form>
    </LayoutAcesso>
  );
}
