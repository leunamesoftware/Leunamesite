import { IconeAlerta } from '../icones/Icones';
import './AvisoErro.css';

/** Mensagem de erro geral do formulário (ex.: e-mail ou senha incorretos). */
export function AvisoErro({ mensagem }: { mensagem: string | null }) {
  return (
    <div className="aviso-erro" role="alert" hidden={!mensagem}>
      {mensagem && (
        <>
          <IconeAlerta className="aviso-erro__icone" />
          <span>{mensagem}</span>
        </>
      )}
    </div>
  );
}
