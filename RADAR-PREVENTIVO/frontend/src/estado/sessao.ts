import type { SessaoCriada } from '@compartilhado/contratos';

// Guarda a sessão no aparelho. A credencial só vale até expiraEm e o backend
// pode encerrá-la a qualquer momento; aqui fica apenas a cópia local.
const CHAVE = 'radar-preventivo.sessao';

export function salvarSessao(sessao: SessaoCriada): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(sessao));
  } catch {
    // Armazenamento indisponível (ex.: navegação privada): a sessão vale só enquanto a tela estiver aberta.
  }
}

export function lerSessao(): SessaoCriada | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const sessao = JSON.parse(bruto) as SessaoCriada;
    if (!sessao.token || new Date(sessao.expiraEm).getTime() <= Date.now()) {
      localStorage.removeItem(CHAVE);
      return null;
    }
    return sessao;
  } catch {
    return null;
  }
}

export function limparSessao(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // nada a fazer
  }
}
