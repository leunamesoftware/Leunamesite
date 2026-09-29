import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { IconeOlho, IconeOlhoRiscado } from '../icones/Icones';
import './CampoFormulario.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  id: string;
  /** Texto do campo (aparece como dica dentro dele e é lido pelos leitores de tela). */
  rotulo: string;
  icone: ReactNode;
  valor: string;
  aoMudar: (valor: string) => void;
  erro?: string;
  /** Algo encostado na direita do campo (ex.: botão de mostrar senha). */
  direita?: ReactNode;
};

export function CampoFormulario({ id, rotulo, icone, valor, aoMudar, erro, direita, type = 'text', ...resto }: Props) {
  const idErro = `${id}-erro`;
  return (
    <div className={`campo ${erro ? 'campo--erro' : ''}`.trim()}>
      <label className="campo__caixa" htmlFor={id}>
        <span className="campo__icone">{icone}</span>
        <span className="somente-leitor">{rotulo}</span>
        <input
          id={id}
          className="campo__entrada"
          type={type}
          value={valor}
          placeholder={rotulo}
          onChange={(e) => aoMudar(e.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idErro : undefined}
          {...resto}
        />
        {direita}
      </label>
      {erro && (
        <p id={idErro} className="campo__erro">
          {erro}
        </p>
      )}
    </div>
  );
}

/** Campo de senha com o botão de mostrar/ocultar o que foi digitado. */
export function CampoSenha(props: Omit<Props, 'type' | 'direita'>) {
  const [visivel, setVisivel] = useState(false);
  return (
    <CampoFormulario
      {...props}
      type={visivel ? 'text' : 'password'}
      direita={
        <button
          type="button"
          className="campo__acao"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visivel}
          aria-controls={props.id}
        >
          {visivel ? <IconeOlho /> : <IconeOlhoRiscado />}
        </button>
      }
    />
  );
}
