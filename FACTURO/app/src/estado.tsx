import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { negocio as repoNegocio } from './dados/banco';
import type { Negocio } from './dominio/tipos';
import { definirIdioma, idiomaDoAparelho, t } from './i18n';
import { acompanharTodos } from './servicos/acompanhar';
import { codigo } from './dominio/calculos';
import { regiaoDe } from './regioes/regioes';

export type Tela =
  | { nome: 'inicio' }
  | { nome: 'documentos' }
  | { nome: 'editor'; id?: string; tipo?: 'orcamento' | 'fatura' }
  | { nome: 'documento'; id: string; enviar?: boolean }
  | { nome: 'clientes' }
  | { nome: 'itens' }
  | { nome: 'negocio' }
  | { nome: 'mais' }
  | { nome: 'ajustes' };

interface Estado {
  negocio: Negocio | null | undefined; // undefined = carregando, null = primeiro uso
  recarregarNegocio: () => Promise<void>;
  tela: Tela;
  ir: (t: Tela) => void;
  voltar: () => void;
  aviso: (texto: string) => void;
  avisoAtual: string | null;
  revisao: number; // muda quando chega novidade do cliente (telas recarregam as listas)
}

const Contexto = createContext<Estado | null>(null);

export function ProvedorEstado({ children }: { children: ReactNode }) {
  const [neg, setNeg] = useState<Negocio | null | undefined>(undefined);
  const [pilha, setPilha] = useState<Tela[]>([{ nome: 'inicio' }]);
  const [avisoAtual, setAviso] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);

  const recarregarNegocio = useCallback(async () => {
    const n = (await repoNegocio.obter()) ?? null;
    if (n) definirIdioma(n.idioma, regiaoDe(n.pais).locale);
    else definirIdioma(idiomaDoAparelho());
    setNeg(n);
  }, []);

  useEffect(() => { void recarregarNegocio(); }, [recarregarNegocio]);

  const ir = useCallback((t: Tela) => {
    setPilha((p) => (['inicio', 'documentos', 'clientes', 'mais'].includes(t.nome) ? [t] : [...p, t]));
    window.scrollTo(0, 0);
  }, []);
  const voltar = useCallback(() => setPilha((p) => (p.length > 1 ? p.slice(0, -1) : p)), []);

  // Botão "voltar" do Android: volta uma tela; numa aba vai ao início; no início fecha o app.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const ouvinte = CapApp.addListener('backButton', () => {
        setPilha((p) => {
          if (p.length > 1) return p.slice(0, -1);
          if (p[0]!.nome !== 'inicio') return [{ nome: 'inicio' }];
          void CapApp.exitApp();
          return p;
        });
      });
      return () => { void ouvinte.then((o) => o.remove()); };
    }
    const aoVoltar = () => { voltar(); history.pushState(null, ''); };
    history.pushState(null, '');
    window.addEventListener('popstate', aoVoltar);
    return () => window.removeEventListener('popstate', aoVoltar);
  }, [voltar]);

  const aviso = useCallback((texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso((a) => (a === texto ? null : a)), 3800);
  }, []);

  // Ao abrir o app e ao voltar para ele: confere se clientes aprovaram ou informaram pagamento.
  const temNegocio = !!neg;
  useEffect(() => {
    if (!temNegocio) return;
    const conferir = async () => {
      const eventos = await acompanharTodos();
      if (!eventos.length) return;
      setRevisao((r) => r + 1);
      const e = eventos[0]!;
      aviso(t('avisos.' + e.tipo, { cliente: e.doc.cliente.nome.split(' ')[0] ?? '', codigo: codigo(e.doc) }) + (eventos.length > 1 ? ` (+${eventos.length - 1})` : ''));
    };
    void conferir();
    const aoVoltarAoApp = () => { if (document.visibilityState === 'visible') void conferir(); };
    document.addEventListener('visibilitychange', aoVoltarAoApp);
    const intervalo = window.setInterval(() => void conferir(), 60_000);
    return () => { document.removeEventListener('visibilitychange', aoVoltarAoApp); window.clearInterval(intervalo); };
  }, [temNegocio, aviso]);

  return (
    <Contexto.Provider value={{ negocio: neg, recarregarNegocio, tela: pilha[pilha.length - 1]!, ir, voltar, aviso, avisoAtual, revisao }}>
      {children}
    </Contexto.Provider>
  );
}

export function useEstado(): Estado {
  const c = useContext(Contexto);
  if (!c) throw new Error('fora do ProvedorEstado');
  return c;
}
