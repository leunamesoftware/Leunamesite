import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ResumoRadar } from '@compartilhado/contratos';
import { useSessao } from '../../estado/SessaoContexto';
import { useCarregar } from '../../estado/useCarregar';
import { useAlertasNaoLidos } from '../../componentes/app/LayoutApp';
import { MenuLateral } from '../../componentes/app/MenuLateral';
import { BotaoIcone } from '../../componentes/app/BotaoIcone';
import { Contador } from '../../componentes/app/Contador';
import { MarcaHorizontal } from '../../componentes/marca/MarcaHorizontal';
import { CartaoContador, SecaoRadar } from '../../componentes/radar/Radar';
import { ResumoContas } from '../../componentes/radar/ResumoContas';
import { LinhaItem } from '../../componentes/itens/Itens';
import { Carregando, FalhaAoCarregar, Vazio } from '../../componentes/estado-tela/EstadoTela';
import { BotaoPrincipal } from '../../componentes/botoes/BotaoPrincipal';
import {
  IconeCheck,
  IconeChevron,
  IconeExclamacao,
  IconeMais,
  IconeMenu,
  IconePasta,
  IconeRelogio,
  IconeSino,
  IconeTriangulo,
} from '../../componentes/icones/Icones';
import { rotaDocumentos, rotaPagos, rotas } from '../../rotas';
import { venceLogo } from '../../utilitarios/situacao';
import './TelaRadar.css';

// Interface 3 — Radar (painel geral). Recriada a partir da referência visual oficial.
// Todos os números e itens vêm do backend (GET /api/radar).

const LIMITE_POR_SECAO = 3;

function primeiroNome(nome: string | undefined): string {
  return nome?.trim().split(/\s+/)[0] ?? '';
}

export function TelaRadar() {
  const { sessao, api } = useSessao();
  const { naoLidos } = useAlertasNaoLidos();
  const navegar = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const fecharMenu = useCallback(() => setMenuAberto(false), []);
  const { dados: resumo, erro, carregando, recarregar } = useCarregar(() => api<ResumoRadar>('/radar'), [api]);

  const c = resumo?.contagem;
  const pendentes = resumo?.pendencias.length ?? 0;
  const algoVenceLogo = resumo?.atencaoAgora.some((i) => venceLogo(i) !== null) ?? false;

  return (
    <div className="tela-radar">
      <header className="tela-radar__topo">
        <BotaoIcone
          estilo="simples"
          rotulo="Abrir menu"
          aria-expanded={menuAberto}
          aria-controls="menu-lateral"
          onClick={() => setMenuAberto(true)}
          className="tela-radar__menu"
        >
          <IconeMenu />
        </BotaoIcone>
        <MarcaHorizontal className="tela-radar__marca" />
        <BotaoIcone estilo="simples" rotulo="Alertas" onClick={() => navegar(rotas.alertas)}>
          <IconeSino />
          <Contador valor={naoLidos} rotulo="alertas não lidos" />
        </BotaoIcone>
      </header>
      <MenuLateral aberto={menuAberto} aoFechar={fecharMenu} />

      <h1 className="app-titulo tela-radar__ola">Olá, {primeiroNome(sessao?.usuario.nome)}!</h1>
      <p className="app-subtitulo">Aqui está o seu panorama geral.</p>

      {carregando && !resumo && <Carregando texto="Analisando seus documentos e prazos…" />}
      {erro && !resumo && <FalhaAoCarregar mensagem={erro} aoTentarDeNovo={recarregar} />}

      {resumo && c && (
        <>
          <div className="tela-radar__contadores">
            <CartaoContador valor={c.vencido} nome="Vencidos" tom="vermelho" icone={<IconeExclamacao />} para={rotaDocumentos('vencidos')} />
            <CartaoContador valor={c.urgente + c.vence_hoje} nome="Urgentes" tom="laranja" icone={<IconeRelogio />} para={rotaDocumentos('urgentes')} piscando={algoVenceLogo} />
            <CartaoContador valor={c.atencao + c.em_dia} nome="A vencer" tom="amarelo" icone={<IconeTriangulo />} para={rotaDocumentos('a_vencer')} />
            <CartaoContador valor={resumo.totalResolvidos} nome="Em dia" tom="verde" icone={<IconeCheck />} para={rotaPagos} />
          </div>

          <SecaoRadar
            titulo="O que precisa da sua atenção agora"
            tom="vermelho"
            verTodos={resumo.atencaoAgora.length > 0 ? rotaDocumentos('precisa_atencao') : undefined}
          >
            {resumo.atencaoAgora.length === 0 ? (
              <Vazio>Nada precisa da sua atenção agora.</Vazio>
            ) : (
              resumo.atencaoAgora.slice(0, LIMITE_POR_SECAO).map((item) => <LinhaItem key={item.id} item={item} />)
            )}
          </SecaoRadar>

          <SecaoRadar
            titulo="Próximos vencimentos"
            tom="azul"
            verTodos={resumo.proximos.length > 0 ? rotaDocumentos('a_vencer') : undefined}
          >
            {resumo.proximos.length === 0 ? (
              <Vazio>Nenhum vencimento mais distante por enquanto.</Vazio>
            ) : (
              resumo.proximos.slice(0, LIMITE_POR_SECAO).map((item) => <LinhaItem key={item.id} item={item} variante="dias" />)
            )}
          </SecaoRadar>

          <SecaoRadar titulo="Pagos recentemente" tom="verde" verTodos={resumo.pagosRecentes.length > 0 ? rotaPagos : undefined}>
            {resumo.pagosRecentes.length === 0 ? (
              <Vazio>Nenhuma conta paga ainda. Quando pagar, toque em "Marcar como pago" na conta.</Vazio>
            ) : (
              resumo.pagosRecentes.slice(0, LIMITE_POR_SECAO).map((item) => <LinhaItem key={item.id} item={item} />)
            )}
          </SecaoRadar>

          <SecaoRadar titulo="Contas a pagar" tom="verde">
            <ResumoContas financeiro={resumo.financeiro} />
          </SecaoRadar>

          <SecaoRadar titulo="Pendências de cadastro" tom="roxo" verTodos={pendentes > 0 ? rotaDocumentos('sem_data') : undefined}>
            {pendentes === 0 ? (
              <Vazio>Nenhuma pendência de cadastro.</Vazio>
            ) : (
              <Link to={rotaDocumentos('sem_data')} className="linha-item tom-roxo">
                <span className="icone-item tom-roxo" aria-hidden="true">
                  <IconePasta />
                </span>
                <span className="linha-item__textos">
                  <span className="linha-item__titulo">Itens sem data de vencimento</span>
                  <span className="linha-item__prazo linha-item__prazo--neutro">
                    {pendentes === 1 ? '1 item precisa da data para ser acompanhado' : `${pendentes} itens precisam da data para serem acompanhados`}
                  </span>
                </span>
                <IconeChevron className="linha-item__seta" />
              </Link>
            )}
          </SecaoRadar>
        </>
      )}

      <BotaoPrincipal className="tela-radar__cadastrar" onClick={() => navegar(rotas.novoItem)}>
        <span className="tela-radar__cadastrar-texto">
          <IconeMais className="tela-radar__mais" />
          Cadastrar documento ou prazo
        </span>
        <IconeChevron className="tela-radar__cadastrar-seta" />
      </BotaoPrincipal>
    </div>
  );
}
