import type { ReactNode } from 'react';
import { SimboloRadar } from '../marca/SimboloRadar';
import { NomeRadar } from '../marca/NomeRadar';
import { FundoOndas } from '../fundo/FundoOndas';
import { RastroRadar } from '../fundo/RastroRadar';
import './LayoutAcesso.css';

// Estrutura comum das telas de acesso (Entrar e Criar conta): fundo com ondas,
// símbolo com o feixe do radar, nome, título, subtítulo e o formulário.

type Props = {
  titulo: string;
  subtitulo: ReactNode;
  /** Marca menor, para caber um formulário mais longo. */
  compacto?: boolean;
  children: ReactNode;
};

export function LayoutAcesso({ titulo, subtitulo, compacto = false, children }: Props) {
  return (
    <main className={`acesso ${compacto ? 'acesso--compacto' : ''}`.trim()}>
      <FundoOndas className="acesso__ondas" />
      <div className="acesso__conteudo">
        <div className="acesso__emblema">
          <RastroRadar className="acesso__rastro" />
          <SimboloRadar className="acesso__simbolo" rotulo="" />
        </div>
        <NomeRadar className="acesso__nome" />
        <h1 className="acesso__titulo">{titulo}</h1>
        <p className="acesso__subtitulo">{subtitulo}</p>
        <div className="acesso__corpo">{children}</div>
      </div>
    </main>
  );
}
