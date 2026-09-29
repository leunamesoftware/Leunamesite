import { beforeEach, describe, expect, it } from 'vitest';
import type { Alerta, ItemDetalhe, ResumoRadar, SessaoCriada } from '../../compartilhado/contratos.js';
import { criarApp } from '../src/app.js';
import type { Dependencias } from '../src/comum/ambiente.js';
import { carregarConfig } from '../src/config.js';
import { migrar } from '../src/banco/migrar.js';
import { criarArmazenamentoMemoria } from '../src/infra/armazenamento/memoria.js';
import { criarBancoSqlite } from '../src/infra/banco/sqlite.js';
import { canalApp } from '../src/modulos/alertas/canais.js';
import { executarRotina } from '../src/modulos/rotina/servico.js';

// "Hoje" controlado pelo teste: 1º/out/2026, 9h em Brasília (12h UTC).
let agora = new Date('2026-10-01T12:00:00Z');
const avancarDias = (n: number) => { agora = new Date(agora.getTime() + n * 86_400_000); };

let deps: Dependencias & { armazenamento: ReturnType<typeof criarArmazenamentoMemoria> };
let app: ReturnType<typeof criarApp>;

async function chamar<T = unknown>(metodo: string, caminho: string, opcoes: { token?: string; corpo?: unknown; form?: FormData } = {}) {
  const headers: Record<string, string> = { origin: 'http://localhost:5173' };
  if (opcoes.token) headers.authorization = `Bearer ${opcoes.token}`;
  let body: BodyInit | undefined;
  if (opcoes.form) body = opcoes.form;
  else if (opcoes.corpo !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(opcoes.corpo); }
  const res = await app.request(caminho, { method: metodo, headers, body });
  const tipo = res.headers.get('content-type') ?? '';
  const json = tipo.includes('json') ? await res.json() : null;
  return { status: res.status, json: json as { ok: boolean; dados: T; erro?: string; campos?: Record<string, string> }, res };
}

async function novaConta(email = 'maria@exemplo.com') {
  const r = await chamar<SessaoCriada>('POST', '/api/auth/cadastro', { corpo: { nome: 'Maria', email, senha: 'senhaforte1', tipoConta: 'pessoa' } });
  expect(r.status).toBe(201);
  return r.json.dados.token;
}

const criarItem = (token: string, dados: Record<string, unknown>) =>
  chamar<ItemDetalhe>('POST', '/api/itens', { token, corpo: { natureza: 'documento', tipo: 'CNH', titulo: 'CNH', ...dados } });

beforeEach(async () => {
  agora = new Date('2026-10-01T12:00:00Z');
  const banco = criarBancoSqlite(':memory:');
  await migrar(banco);
  deps = {
    banco,
    armazenamento: criarArmazenamentoMemoria(),
    config: carregarConfig({ PIMENTA_SENHA: 'pimenta-de-teste-123456' } as NodeJS.ProcessEnv),
    relogio: { agora: () => agora },
    canaisAlerta: [canalApp],
  };
  app = criarApp(deps);
});

describe('autenticação', () => {
  it('cadastra, entra, acessa a conta e sai de verdade', async () => {
    const token = await novaConta();
    expect((await chamar('GET', '/api/conta', { token })).status).toBe(200);
    const login = await chamar<SessaoCriada>('POST', '/api/auth/entrar', { corpo: { email: 'MARIA@exemplo.com ', senha: 'senhaforte1 ' } });
    expect(login.status).toBe(200); // e-mail sem diferenciar maiúsculas e espaço sobrando na senha
    await chamar('POST', '/api/auth/sair', { token: login.json.dados.token });
    expect((await chamar('GET', '/api/conta', { token: login.json.dados.token })).status).toBe(401);
  });
  it('não aceita e-mail repetido nem senha curta', async () => {
    await novaConta();
    const rep = await chamar('POST', '/api/auth/cadastro', { corpo: { nome: 'Outra', email: 'maria@exemplo.com', senha: 'senhaforte1', tipoConta: 'pessoa' } });
    expect(rep.json.erro).toBe('email_ja_cadastrado');
    const curta = await chamar('POST', '/api/auth/cadastro', { corpo: { nome: 'Ana', email: 'ana@exemplo.com', senha: '123', tipoConta: 'empresa' } });
    expect(curta.json.campos?.senha).toBeTruthy();
  });
  it('bloqueia depois de 10 senhas erradas', async () => {
    await novaConta();
    for (let i = 0; i < 10; i++) await chamar('POST', '/api/auth/entrar', { corpo: { email: 'maria@exemplo.com', senha: 'errada' } });
    const r = await chamar('POST', '/api/auth/entrar', { corpo: { email: 'maria@exemplo.com', senha: 'senhaforte1' } });
    expect(r.status).toBe(429);
  });
  it('a senha guardada não é a senha', async () => {
    await novaConta();
    const u = await deps.banco.um<{ senha_hash: string }>('SELECT senha_hash FROM usuarios');
    expect(u!.senha_hash).not.toContain('senhaforte1');
    expect(u!.senha_hash).toMatch(/^pbkdf2\$100000\$/);
  });
  it('a rotina apaga tentativas de login e sessões encerradas com mais de 7 dias', async () => {
    const token = await novaConta();
    await chamar('POST', '/api/auth/entrar', { corpo: { email: 'maria@exemplo.com', senha: 'errada' } });
    await chamar('POST', '/api/auth/sair', { token });
    const contar = async (tabela: string) => (await deps.banco.um<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabela}`))?.n;
    expect(await contar('tentativas_login')).toBeGreaterThan(0);
    avancarDias(6); await executarRotina(deps);
    expect(await contar('tentativas_login')).toBeGreaterThan(0); // ainda dentro dos 7 dias
    avancarDias(2); await executarRotina(deps);
    expect(await contar('tentativas_login')).toBe(0);
    expect(await contar('sessoes')).toBe(0);
  });

  it('trocar senha desconecta os outros aparelhos', async () => {
    const t1 = await novaConta();
    const t2 = (await chamar<SessaoCriada>('POST', '/api/auth/entrar', { corpo: { email: 'maria@exemplo.com', senha: 'senhaforte1' } })).json.dados.token;
    const r = await chamar('POST', '/api/conta/senha', { token: t1, corpo: { senhaAtual: 'senhaforte1', novaSenha: 'novasenha22' } });
    expect(r.status).toBe(200);
    expect((await chamar('GET', '/api/conta', { token: t1 })).status).toBe(200);
    expect((await chamar('GET', '/api/conta', { token: t2 })).status).toBe(401);
  });
});

describe('itens: receber → analisar → identificar → orientar', () => {
  it('ao cadastrar já vem com situação e orientação', async () => {
    const token = await novaConta();
    const r = await criarItem(token, { dataVencimento: '2026-10-05' });
    expect(r.status).toBe(201);
    expect(r.json.dados.analise?.situacao).toBe('urgente');
    expect(r.json.dados.analise?.diasRestantes).toBe(4);
    expect(r.json.dados.orientacao.prioridade).toBe('alta');
    expect(r.json.dados.origemDados).toBe('manual');
  });
  it('valida os campos', async () => {
    const token = await novaConta();
    const r = await chamar('POST', '/api/itens', { token, corpo: { natureza: 'x', titulo: '', tipo: '', dataVencimento: '2026-02-30' } });
    expect(r.status).toBe(400);
    expect(Object.keys(r.json.campos!)).toEqual(expect.arrayContaining(['natureza', 'titulo', 'tipo', 'dataVencimento']));
    const inv = await criarItem(token, { dataEmissao: '2026-10-10', dataVencimento: '2026-10-01' });
    expect(inv.json.campos?.dataVencimento).toMatch(/anterior/);
  });
  it('tipo é texto livre e o app sugere os tipos já usados', async () => {
    const token = await novaConta();
    await criarItem(token, { tipo: 'Alvará de funcionamento', titulo: 'Alvará loja 1' });
    await criarItem(token, { tipo: 'Alvará de funcionamento', titulo: 'Alvará loja 2' });
    await criarItem(token, { tipo: 'Seguro', titulo: 'Seguro carro', natureza: 'prazo' });
    const tipos = await chamar<string[]>('GET', '/api/itens/tipos', { token });
    expect(tipos.json.dados).toEqual(['Alvará de funcionamento', 'Seguro']);
  });
  it('cada usuário só vê os próprios itens', async () => {
    const a = await novaConta('a@exemplo.com');
    const b = await novaConta('b@exemplo.com');
    const item = (await criarItem(a, { dataVencimento: '2026-12-01' })).json.dados;
    expect((await chamar('GET', `/api/itens/${item.id}`, { token: b })).status).toBe(404);
    expect((await chamar<unknown[]>('GET', '/api/itens', { token: b })).json.dados).toHaveLength(0);
  });
  it('painel do radar resume as situações', async () => {
    const token = await novaConta();
    await criarItem(token, { titulo: 'Vencido', dataVencimento: '2026-09-20' });
    await criarItem(token, { titulo: 'Urgente', dataVencimento: '2026-10-03' });
    await criarItem(token, { titulo: 'Atenção', dataVencimento: '2026-10-20' });
    await criarItem(token, { titulo: 'Em dia', dataVencimento: '2027-01-10' });
    await criarItem(token, { titulo: 'Sem data' });
    const r = (await chamar<ResumoRadar>('GET', '/api/radar', { token })).json.dados;
    expect(r.contagem).toMatchObject({ vencido: 1, urgente: 1, atencao: 1, em_dia: 1, sem_prazo: 1, vence_hoje: 0 });
    expect(r.atencaoAgora.map((i) => i.titulo)).toEqual(['Vencido', 'Urgente', 'Atenção']);
    expect(r.proximos.map((i) => i.titulo)).toEqual(['Em dia']);
    expect(r.pendencias.map((i) => i.titulo)).toEqual(['Sem data']);
    expect(r.alertasNaoLidos).toBe(3); // vencido, urgente e atenção já nascem com alerta
  });
});

describe('alertas', () => {
  it('nascem quando a situação piora, sem repetir, e o lembrete de vencido vem a cada 7 dias', async () => {
    const token = await novaConta();
    const item = (await criarItem(token, { dataVencimento: '2026-11-05' })).json.dados; // 35 dias: em dia
    let alertas = (await chamar<Alerta[]>('GET', '/api/alertas', { token })).json.dados;
    expect(alertas).toHaveLength(0);

    avancarDias(5); await executarRotina(deps); await executarRotina(deps); // 30 dias → atenção (rodar 2x não duplica)
    alertas = (await chamar<Alerta[]>('GET', '/api/alertas', { token })).json.dados;
    expect(alertas.map((a) => a.situacao)).toEqual(['atencao']);
    expect(alertas[0]!.mensagem).toBe('"CNH" pede atenção: vence em 30 dias (05/11/2026).');

    avancarDias(23); await executarRotina(deps); // 7 dias → urgente
    avancarDias(7); await executarRotina(deps);  // vence hoje
    avancarDias(1); await executarRotina(deps);  // 06/11: vencido → alerta "venceu"
    avancarDias(6); await executarRotina(deps);  // 12/11: 6 dias depois → nada
    avancarDias(1); await executarRotina(deps);  // 13/11: 7 dias depois → lembrete (semana 1)
    avancarDias(1); await executarRotina(deps);  // 14/11: → nada (semana 1 já avisada)
    avancarDias(7); await executarRotina(deps);  // 21/11: 15 dias → lembrete da semana 2 (rotina "pulou" o dia 20)
    // Passaram 51 dias: a sessão (30 dias) expirou, como na vida real. Entra de novo.
    expect((await chamar('GET', '/api/alertas', { token })).status).toBe(401);
    const novo = (await chamar<SessaoCriada>('POST', '/api/auth/entrar', { corpo: { email: 'maria@exemplo.com', senha: 'senhaforte1' } })).json.dados.token;
    alertas = (await chamar<Alerta[]>('GET', '/api/alertas', { token: novo })).json.dados;
    expect(alertas.map((a) => `${a.motivo}:${a.situacao}`).reverse()).toEqual([
      'mudou_situacao:atencao', 'mudou_situacao:urgente', 'mudou_situacao:vence_hoje', 'mudou_situacao:vencido',
      'lembrete_vencido:vencido', 'lembrete_vencido:vencido',
    ]);
    const entregas = await deps.banco.todos<{ canal: string; status: string }>('SELECT canal, status FROM entregas_alerta');
    expect(entregas).toHaveLength(6);
    expect(entregas.every((e) => e.canal === 'app' && e.status === 'entregue')).toBe(true);
    expect(item.id).toBeTruthy();
  });

  it('marcar como lido zera o contador', async () => {
    const token = await novaConta();
    await criarItem(token, { dataVencimento: '2026-10-02' });
    expect((await chamar<{ naoLidos: number }>('GET', '/api/alertas/contagem', { token })).json.dados.naoLidos).toBe(1);
    await chamar('POST', '/api/alertas/lidos', { token });
    expect((await chamar<{ naoLidos: number }>('GET', '/api/alertas/contagem', { token })).json.dados.naoLidos).toBe(0);
  });

  it('se a situação melhora (data atualizada), os alertas antigos ficam como resolvidos', async () => {
    const token = await novaConta();
    const item = (await criarItem(token, { dataVencimento: '2026-10-03' })).json.dados;
    const r = await chamar<ItemDetalhe>('PUT', `/api/itens/${item.id}`, { token, corpo: { natureza: 'documento', titulo: 'CNH', tipo: 'CNH', dataVencimento: '2031-10-03' } });
    expect(r.json.dados.analise?.situacao).toBe('em_dia');
    expect(r.json.dados.alertas).toHaveLength(1);
    expect(r.json.dados.alertas[0]!.resolvidoEm).toBeTruthy();
  });
});

describe('resolver não apaga o histórico', () => {
  it('item e alertas continuam registrados como resolvidos; rotina ignora; não pode editar', async () => {
    const token = await novaConta();
    const item = (await criarItem(token, { dataVencimento: '2026-09-25' })).json.dados;
    const r = await chamar<ItemDetalhe>('POST', `/api/itens/${item.id}/resolver`, { token });
    expect(r.json.dados.estado).toBe('resolvido');
    expect(r.json.dados.resolvidoEm).toBeTruthy();
    expect(r.json.dados.alertas).toHaveLength(1);
    expect(r.json.dados.alertas[0]!.resolvidoEm).toBeTruthy();
    expect(r.json.dados.orientacao.resumo).toBe('"CNH" está em dia: foi pago com atraso em 01/10/2026 (venceu em 25/09/2026).');

    expect((await chamar<unknown[]>('GET', '/api/itens', { token })).json.dados).toHaveLength(0);
    expect((await chamar<unknown[]>('GET', '/api/itens?estado=resolvido', { token })).json.dados).toHaveLength(1);

    avancarDias(7);
    const rotina = await executarRotina(deps);
    expect(rotina.itensAnalisados).toBe(0);
    const editar = await chamar('PUT', `/api/itens/${item.id}`, { token, corpo: { natureza: 'documento', titulo: 'X', tipo: 'CNH' } });
    expect(editar.json.erro).toBe('item_resolvido');
    expect(await deps.banco.um('SELECT id FROM itens WHERE id = ?', [item.id])).toBeTruthy();
  });
});

describe('virada do dia sem esperar a rotina', () => {
  it('amanhã → hoje → vencido assim que a pessoa abre o app', async () => {
    const token = await novaConta();
    const item = (await criarItem(token, { dataVencimento: '2026-10-02' })).json.dados;
    expect(item.analise!.situacao).toBe('urgente');
    expect(item.analise!.diasRestantes).toBe(1);

    avancarDias(1); // sem executar a rotina
    const hoje = await chamar<{ atencaoAgora: ItemDetalhe[]; contagem: Record<string, number> }>('GET', '/api/radar', { token });
    expect(hoje.json.dados.contagem.vence_hoje).toBe(1);
    expect(hoje.json.dados.atencaoAgora[0]!.analise!.situacao).toBe('vence_hoje');

    avancarDias(1);
    const detalhe = await chamar<ItemDetalhe>('GET', `/api/itens/${item.id}`, { token });
    expect(detalhe.json.dados.analise!.situacao).toBe('vencido');
    const alertas = await chamar<{ situacao: string }[]>('GET', '/api/alertas', { token });
    expect(alertas.json.dados.map((a) => a.situacao)).toContain('vencido');
  });
});

describe('valores', () => {
  it('soma a pagar por data, em atraso e o mês (pago × falta pagar)', async () => {
    const token = await novaConta();
    await criarItem(token, { titulo: 'Luz', dataVencimento: '2026-10-12', valorCentavos: 15000 });
    await criarItem(token, { titulo: 'Água', dataVencimento: '2026-10-12', valorCentavos: 8050 });
    await criarItem(token, { titulo: 'Aluguel', dataVencimento: '2026-11-05', valorCentavos: 120000 });
    await criarItem(token, { titulo: 'Gás', dataVencimento: '2026-10-13' });
    const atrasada = (await criarItem(token, { titulo: 'Internet', dataVencimento: '2026-09-25', valorCentavos: 10000 })).json.dados;
    const outra = (await criarItem(token, { titulo: 'Cartão', dataVencimento: '2026-09-28', valorCentavos: 30000 })).json.dados;
    expect(outra.valorCentavos).toBe(30000);

    const invalido = await criarItem(token, { valorCentavos: -1 });
    expect(invalido.status).toBe(400);

    // Pagou a internet com juros hoje; o valor pago fica registrado.
    const pago = await chamar<ItemDetalhe>('POST', `/api/itens/${atrasada.id}/resolver`, { token, corpo: { valorPagoCentavos: 10500 } });
    expect(pago.json.dados.valorPagoCentavos).toBe(10500);
    expect(pago.json.dados.valorCentavos).toBe(10000);

    const radar = (await chamar<{ financeiro: unknown; pagosRecentes: ItemDetalhe[] }>('GET', '/api/radar', { token })).json.dados;
    expect(radar.pagosRecentes.map((i) => i.titulo)).toEqual(['Internet']);
    const f = radar.financeiro;
    expect(f).toEqual({
      porData: [
        { data: '2026-10-12', quantidade: 2, totalCentavos: 23050 },
        { data: '2026-11-05', quantidade: 1, totalCentavos: 120000 },
      ],
      emAtraso: { quantidade: 1, totalCentavos: 30000 },
      mes: { referencia: '2026-10', pago: { quantidade: 1, totalCentavos: 10500 }, pagoSemValor: 0, aPagar: { quantidade: 2, totalCentavos: 23050 } },
      semValor: 1,
    });
  });

  it('conta paga sem valor conta no mês e o valor pode ser informado depois', async () => {
    const token = await novaConta();
    const item = (await criarItem(token, { dataVencimento: '2026-09-20' })).json.dados;
    await chamar('POST', `/api/itens/${item.id}/resolver`, { token, corpo: { pagoEm: '2026-10-01' } });
    let mes = (await chamar<{ financeiro: { mes: unknown } }>('GET', '/api/radar', { token })).json.dados.financeiro.mes;
    expect(mes).toMatchObject({ pago: { quantidade: 1, totalCentavos: 0 }, pagoSemValor: 1 });

    const ativo = (await criarItem(token, { dataVencimento: '2026-10-20' })).json.dados;
    expect((await chamar('POST', `/api/itens/${ativo.id}/pagamento`, { token, corpo: { valorPagoCentavos: 100 } })).json.erro).toBe('item_nao_pago');

    const r = await chamar<ItemDetalhe>('POST', `/api/itens/${item.id}/pagamento`, { token, corpo: { valorPagoCentavos: 9990 } });
    expect(r.json.dados.valorPagoCentavos).toBe(9990);
    expect(r.json.dados.resolvidoEm!.slice(0, 10)).toBe('2026-10-01');
    mes = (await chamar<{ financeiro: { mes: unknown } }>('GET', '/api/radar', { token })).json.dados.financeiro.mes;
    expect(mes).toMatchObject({ pago: { quantidade: 1, totalCentavos: 9990 }, pagoSemValor: 0 });
  });

  it('sem valor pago informado, vale o valor da conta', async () => {
    const token = await novaConta();
    const item = (await criarItem(token, { dataVencimento: '2026-10-05', valorCentavos: 4990 })).json.dados;
    const pago = await chamar<ItemDetalhe>('POST', `/api/itens/${item.id}/resolver`, { token });
    expect(pago.json.dados.valorPagoCentavos).toBe(4990);
  });
});

describe('data do pagamento', () => {
  it('pago em dia quando a data informada é até o vencimento; recusa data no futuro', async () => {
    const token = await novaConta();
    const item = (await criarItem(token, { dataVencimento: '2026-09-25' })).json.dados;
    const futuro = await chamar('POST', `/api/itens/${item.id}/resolver`, { token, corpo: { pagoEm: '2026-10-02' } });
    expect(futuro.status).toBe(400);
    expect((futuro.json as { campos?: Record<string, string> }).campos?.pagoEm).toBe('A data do pagamento não pode ser no futuro.');

    const r = await chamar<ItemDetalhe>('POST', `/api/itens/${item.id}/resolver`, { token, corpo: { pagoEm: '2026-09-20' } });
    expect(r.status).toBe(200);
    expect(r.json.dados.resolvidoEm!.slice(0, 10)).toBe('2026-09-20');
    expect(r.json.dados.orientacao.resumo).toBe('"CNH" está em dia: foi pago em 20/09/2026.');
  });
});

describe('anexos privados', () => {
  const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 10])], 'cnh.pdf', { type: 'application/pdf' });

  it('envia, baixa só o dono, e excluir o item apaga o arquivo', async () => {
    const a = await novaConta('a@exemplo.com');
    const b = await novaConta('b@exemplo.com');
    const item = (await criarItem(a, { dataVencimento: '2027-01-01' })).json.dados;
    const form = new FormData(); form.append('arquivo', pdf());
    const envio = await chamar<{ id: string; formato: string; situacaoLeitura: string }>('POST', `/api/itens/${item.id}/anexos`, { token: a, form });
    expect(envio.status).toBe(201);
    expect(envio.json.dados).toMatchObject({ formato: 'application/pdf', situacaoLeitura: 'nao_processado' });

    const dono = await chamar('GET', `/api/anexos/${envio.json.dados.id}/arquivo`, { token: a });
    expect(dono.status).toBe(200);
    expect(dono.res.headers.get('content-type')).toBe('application/pdf');
    expect((await chamar('GET', `/api/anexos/${envio.json.dados.id}/arquivo`, { token: b })).status).toBe(404);

    expect(deps.armazenamento.total()).toBe(1);
    await chamar('DELETE', `/api/itens/${item.id}`, { token: a });
    expect(deps.armazenamento.total()).toBe(0);
  });

  it('excluir a conta apaga tudo (itens, alertas, arquivos, sessões) e exige a senha', async () => {
    const a = await novaConta('a@exemplo.com');
    const b = await novaConta('b@exemplo.com');
    const item = (await criarItem(a, { dataVencimento: '2026-10-03' })).json.dados;
    const form = new FormData(); form.append('arquivo', pdf());
    await chamar('POST', `/api/itens/${item.id}/anexos`, { token: a, form });
    await criarItem(b, { dataVencimento: '2026-10-03' });
    expect(deps.armazenamento.total()).toBe(1);

    const errada = await chamar('POST', '/api/conta/excluir', { token: a, corpo: { senha: 'errada' } });
    expect(errada.json.erro).toBe('senha_incorreta');
    expect((await chamar('GET', '/api/conta', { token: a })).status).toBe(200);

    expect((await chamar('POST', '/api/conta/excluir', { token: a, corpo: { senha: 'senhaforte1' } })).status).toBe(200);
    expect(deps.armazenamento.total()).toBe(0);
    expect((await chamar('GET', '/api/conta', { token: a })).status).toBe(401);
    for (const tabela of ['usuarios', 'itens', 'alertas', 'anexos', 'sessoes']) {
      const r = await deps.banco.um<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabela} WHERE ${tabela === 'usuarios' ? "email = 'a@exemplo.com'" : "usuario_id NOT IN (SELECT id FROM usuarios)"}`);
      expect(r?.n).toBe(0);
    }
    // A outra conta não é afetada.
    expect((await chamar<unknown[]>('GET', '/api/itens', { token: b })).json.dados).toHaveLength(1);
    const entrar = await chamar('POST', '/api/auth/entrar', { corpo: { email: 'a@exemplo.com', senha: 'senhaforte1' } });
    expect(entrar.json.erro).toBe('credenciais_invalidas');
  });

  it('recusa arquivo que não é PDF/imagem (mesmo com extensão .pdf)', async () => {
    const token = await novaConta();
    const item = (await criarItem(token, {})).json.dados;
    const form = new FormData(); form.append('arquivo', new File(['<html>oi</html>'], 'falso.pdf', { type: 'application/pdf' }));
    const r = await chamar('POST', `/api/itens/${item.id}/anexos`, { token, form });
    expect(r.json.erro).toBe('arquivo_invalido');
  });
});

describe('segurança geral', () => {
  it('rotas protegidas exigem login e rotina externa exige token', async () => {
    for (const rota of ['/api/itens', '/api/radar', '/api/alertas', '/api/conta']) {
      expect((await chamar('GET', rota)).status).toBe(401);
    }
    expect((await chamar('POST', '/api/rotina/executar')).status).toBe(404); // sem TOKEN_ROTINA configurado
    expect((await chamar('GET', '/api/admin')).status).toBe(404); // painel administrativo não existe na V1
  });
});
