import { useCallback, useEffect, useRef, useState } from 'react';
import { ErroApi } from '../servicos/api';

type Estado<T> = { dados: T | null; erro: string | null; carregando: boolean };

/** Carrega dados ao abrir a tela e permite recarregar. Ignora respostas de cargas antigas. */
export function useCarregar<T>(carregar: () => Promise<T>, dependencias: unknown[] = []) {
  const [estado, setEstado] = useState<Estado<T>>({ dados: null, erro: null, carregando: true });
  const ultima = useRef(0);

  const executar = useCallback(async () => {
    const esta = ++ultima.current;
    setEstado((e) => ({ ...e, erro: null, carregando: true }));
    try {
      const dados = await carregar();
      if (esta === ultima.current) setEstado({ dados, erro: null, carregando: false });
    } catch (erro) {
      if (esta !== ultima.current) return;
      const mensagem = erro instanceof ErroApi ? erro.message : 'Não foi possível carregar. Tente de novo.';
      setEstado((e) => ({ ...e, erro: mensagem, carregando: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  useEffect(() => {
    void executar();
  }, [executar]);

  return { ...estado, recarregar: executar };
}
