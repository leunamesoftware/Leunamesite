import { useId, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import type { ItemEntrada, Natureza } from '@compartilhado/contratos';
import { ErroApi } from '../../servicos/api';
import { hojeLocal, pagamentoSugerido } from '../../utilitarios/situacao';
import { AvisoErro } from '../formulario/AvisoErro';
import { CampoValor } from '../formulario/CampoValor';
import { BotaoPrincipal } from '../botoes/BotaoPrincipal';
import {
  IconeCalendario,
  IconeCheck,
  IconeChevron,
  IconeClipe,
  IconeDinheiro,
  IconeDocumento,
  IconeFechar,
  IconeNota,
  IconeNuvemEnvio,
  IconeSalvarDocumento,
  IconeSino,
} from '../icones/Icones';
import './FormularioItem.css';

// Formulário de documento ou prazo (cadastrar e editar).
// Campos do contrato ItemEntrada; o arquivo é enviado depois que o item existe.

export const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;
const FORMATOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png'];
const LIMITE_OBSERVACOES = 500;

/** Opções de antecedência: quando o item passa a pedir atenção (null = padrão de 30 dias). */
const ANTECEDENCIAS: { dias: number | null; nome: string }[] = [
  { dias: 60, nome: '60 dias antes' },
  { dias: null, nome: '30 dias antes' },
  { dias: 15, nome: '15 dias antes' },
  { dias: 7, nome: '7 dias antes' },
];

type Erros = Partial<Record<'natureza' | 'tipo' | 'titulo' | 'dataVencimento' | 'descricao' | 'antecedenciaDias' | 'arquivo' | 'pagoEm' | 'valorCentavos', string>>;

type Props = {
  inicial?: ItemEntrada;
  tiposSugeridos: string[];
  /** Mostra o campo de anexo (só no cadastro; na edição os anexos ficam no detalhe). */
  comAnexo?: boolean;
  /** Mostra a escolha "Ainda vou pagar / Já está pago" (só no cadastro). */
  comSituacaoPagamento?: boolean;
  textoSalvar: string;
  /** pagoEm: AAAA-MM-DD quando a pessoa marcou "Já está pago"; null quando ainda vai pagar. */
  aoSalvar: (dados: ItemEntrada, arquivo: File | null, pagoEm: string | null) => Promise<void>;
};

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function FormularioItem({ inicial, tiposSugeridos, comAnexo = false, comSituacaoPagamento = false, textoSalvar, aoSalvar }: Props) {
  const id = useId();
  const [natureza, setNatureza] = useState<Natureza>(inicial?.natureza ?? 'documento');
  const [tipo, setTipo] = useState(inicial?.tipo ?? '');
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [dataVencimento, setDataVencimento] = useState(inicial?.dataVencimento ?? '');
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [valor, setValor] = useState<number | null>(inicial?.valorCentavos ?? null);
  const [antecedencia, setAntecedencia] = useState<number | null>(inicial?.antecedenciaDias ?? null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [jaPago, setJaPago] = useState(false);
  const [pagoEm, setPagoEm] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const entradaArquivo = useRef<HTMLInputElement>(null);

  // Mantém uma antecedência já salva que não esteja entre as opções (ex.: 45 dias).
  const opcoes =
    antecedencia !== null && !ANTECEDENCIAS.some((a) => a.dias === antecedencia)
      ? [...ANTECEDENCIAS, { dias: antecedencia, nome: `${antecedencia} dias antes` }]
      : ANTECEDENCIAS;

  function escolherArquivo(f: File | undefined) {
    if (!f) return;
    if (!FORMATOS_ACEITOS.includes(f.type)) {
      setErros((e) => ({ ...e, arquivo: 'Use um arquivo PDF, JPG ou PNG.' }));
      return;
    }
    if (f.size > TAMANHO_MAXIMO_ANEXO) {
      setErros((e) => ({ ...e, arquivo: 'O arquivo passa de 10 MB.' }));
      return;
    }
    setErros((e) => ({ ...e, arquivo: undefined }));
    setArquivo(f);
  }

  function aoSoltar(evento: DragEvent) {
    evento.preventDefault();
    setArrastando(false);
    escolherArquivo(evento.dataTransfer.files[0]);
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    const encontrados: Erros = {};
    if (!tipo.trim()) encontrados.tipo = 'Informe o tipo (ex.: Veículo, Casa, Empresa).';
    if (!titulo.trim()) encontrados.titulo = 'Informe o nome (ex.: IPVA, CNH).';
    if (jaPago && !pagoEm) encontrados.pagoEm = 'Informe quando foi pago.';
    else if (jaPago && pagoEm > hojeLocal()) encontrados.pagoEm = 'A data do pagamento não pode ser no futuro.';
    setErros(encontrados);
    setErroGeral(null);
    if (Object.values(encontrados).some(Boolean)) return;

    setEnviando(true);
    try {
      await aoSalvar(
        {
          natureza,
          tipo: tipo.trim(),
          titulo: titulo.trim(),
          dataVencimento: dataVencimento || null,
          descricao: descricao.trim() || null,
          antecedenciaDias: antecedencia,
          valorCentavos: valor,
          ...(inicial?.dataEmissao !== undefined ? { dataEmissao: inicial.dataEmissao } : {}),
        },
        arquivo,
        jaPago ? pagoEm : null,
      );
    } catch (erro) {
      if (erro instanceof ErroApi && Object.keys(erro.campos).length > 0) setErros(erro.campos as Erros);
      setErroGeral(erro instanceof ErroApi ? erro.message : 'Não foi possível salvar. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <form className="formulario-item" onSubmit={aoEnviar} noValidate>
      <Bloco icone={<IconeDocumento />} titulo="Tipo de documento ou prazo" htmlFor={`${id}-tipo`} erro={erros.tipo ?? erros.natureza}>
        <div className="formulario-item__natureza" role="radiogroup" aria-label="É um documento ou um prazo?">
          {(['documento', 'prazo'] as const).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={natureza === n}
              className={`formulario-item__segmento ${natureza === n ? 'formulario-item__segmento--ativo' : ''}`}
              onClick={() => setNatureza(n)}
            >
              {n === 'documento' ? 'Documento' : 'Prazo'}
            </button>
          ))}
        </div>
        <div className="formulario-item__caixa formulario-item__caixa--lista">
          <input
            id={`${id}-tipo`}
            className="formulario-item__entrada"
            list={`${id}-tipos`}
            placeholder="Ex.: Veículo, Casa, Empresa"
            maxLength={60}
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value);
              setErros((er) => ({ ...er, tipo: undefined }));
            }}
            aria-invalid={erros.tipo ? true : undefined}
          />
          <IconeChevron className="formulario-item__chevron" />
          <datalist id={`${id}-tipos`}>
            {tiposSugeridos.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      </Bloco>

      <Bloco icone={<IconeDocumento />} titulo="Nome do documento ou prazo" htmlFor={`${id}-titulo`} erro={erros.titulo}>
        <div className="formulario-item__caixa">
          <input
            id={`${id}-titulo`}
            className="formulario-item__entrada"
            placeholder="Ex.: IPVA, CNH…"
            maxLength={120}
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value);
              setErros((er) => ({ ...er, titulo: undefined }));
            }}
            aria-invalid={erros.titulo ? true : undefined}
          />
        </div>
      </Bloco>

      <Bloco
        icone={<IconeCalendario />}
        titulo="Data de vencimento"
        htmlFor={`${id}-data`}
        erro={erros.dataVencimento}
        ajuda={dataVencimento ? undefined : 'Sem data, o item fica em "Pendências de cadastro" até você informar.'}
      >
        <div className="formulario-item__caixa">
          <input
            id={`${id}-data`}
            className="formulario-item__entrada formulario-item__data"
            type="date"
            value={dataVencimento}
            onChange={(e) => {
              setDataVencimento(e.target.value);
              setErros((er) => ({ ...er, dataVencimento: undefined }));
            }}
            aria-invalid={erros.dataVencimento ? true : undefined}
          />
        </div>
      </Bloco>

      <Bloco icone={<IconeDinheiro />} titulo="Valor" opcional htmlFor={`${id}-valor`} erro={erros.valorCentavos} ajuda="Com o valor, o Radar soma quanto pagar em cada dia e quanto você pagou no mês.">
        <div className="formulario-item__caixa">
          <CampoValor
            id={`${id}-valor`}
            valor={valor}
            aoMudar={(v) => {
              setValor(v);
              setErros((er) => ({ ...er, valorCentavos: undefined }));
            }}
            invalido={!!erros.valorCentavos}
          />
        </div>
      </Bloco>

      {comSituacaoPagamento && (
        <Bloco icone={<IconeCheck />} titulo="Situação" erro={erros.pagoEm}>
          <div className="formulario-item__natureza" role="radiogroup" aria-label="Situação do pagamento">
            {[
              { valor: false, nome: 'Ainda vou pagar' },
              { valor: true, nome: 'Já está pago' },
            ].map((o) => (
              <button
                key={o.nome}
                type="button"
                role="radio"
                aria-checked={jaPago === o.valor}
                className={`formulario-item__segmento ${jaPago === o.valor ? 'formulario-item__segmento--ativo' : ''}`}
                onClick={() => {
                  setJaPago(o.valor);
                  if (o.valor && !pagoEm) setPagoEm(pagamentoSugerido(dataVencimento));
                  setErros((er) => ({ ...er, pagoEm: undefined }));
                }}
              >
                {o.nome}
              </button>
            ))}
          </div>
          {jaPago && (
            <>
              <label className="formulario-item__rotulo-pago" htmlFor={`${id}-pago-em`}>
                Pago em
              </label>
              <div className="formulario-item__caixa">
                <input
                  id={`${id}-pago-em`}
                  className="formulario-item__entrada formulario-item__data"
                  type="date"
                  max={hojeLocal()}
                  value={pagoEm}
                  onChange={(e) => {
                    setPagoEm(e.target.value);
                    setErros((er) => ({ ...er, pagoEm: undefined }));
                  }}
                  aria-invalid={erros.pagoEm ? true : undefined}
                />
              </div>
              <p className="formulario-item__apoio">
                O item entra direto como Em dia (pago) e fica no histórico, sem alertas. Se foi pago depois do vencimento, aparece como pago com atraso.
              </p>
            </>
          )}
        </Bloco>
      )}

      <Bloco icone={<IconeNota />} titulo="Observações" opcional htmlFor={`${id}-obs`} erro={erros.descricao}>
        <div className="formulario-item__caixa formulario-item__caixa--texto">
          <textarea
            id={`${id}-obs`}
            className="formulario-item__entrada formulario-item__texto"
            placeholder="Adicione informações importantes…"
            maxLength={LIMITE_OBSERVACOES}
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <span className="formulario-item__contagem" aria-live="polite">
            {descricao.length}/{LIMITE_OBSERVACOES}
          </span>
        </div>
      </Bloco>

      <Bloco icone={<IconeSino />} titulo="Lembretes" erro={erros.antecedenciaDias}>
        <p className="formulario-item__apoio" id={`${id}-lembrete`}>
          Escolha quando o Radar começa a avisar. Você também é avisado 7 dias antes, no dia e se vencer.
        </p>
        <div className="formulario-item__lembretes" role="radiogroup" aria-describedby={`${id}-lembrete`}>
          {opcoes.map((o) => {
            const ativo = antecedencia === o.dias;
            return (
              <button
                key={o.nome}
                type="button"
                role="radio"
                aria-checked={ativo}
                className={`formulario-item__lembrete ${ativo ? 'formulario-item__lembrete--ativo' : ''}`}
                onClick={() => setAntecedencia(o.dias)}
              >
                {ativo && <IconeCheck className="formulario-item__marcado" />}
                {o.nome}
              </button>
            );
          })}
        </div>
      </Bloco>

      {comAnexo && (
        <Bloco icone={<IconeClipe />} titulo="Anexar arquivo" opcional erro={erros.arquivo}>
          <p className="formulario-item__apoio">Adicione uma foto ou documento (PDF, JPG ou PNG, até 10 MB).</p>
          <input
            ref={entradaArquivo}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="somente-leitor"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              escolherArquivo(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {arquivo ? (
            <div className="formulario-item__arquivo">
              <IconeClipe className="formulario-item__arquivo-icone" />
              <span className="formulario-item__arquivo-nome">
                {arquivo.name}
                <small>{formatarTamanho(arquivo.size)}</small>
              </span>
              <button type="button" className="formulario-item__remover" onClick={() => setArquivo(null)} aria-label="Remover arquivo">
                <IconeFechar />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`formulario-item__soltar ${arrastando ? 'formulario-item__soltar--ativo' : ''}`}
              onClick={() => entradaArquivo.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={aoSoltar}
            >
              <IconeNuvemEnvio className="formulario-item__nuvem" />
              <span>
                <strong>Toque para anexar</strong>
                <small>ou arraste um arquivo aqui</small>
              </span>
            </button>
          )}
        </Bloco>
      )}

      <AvisoErro mensagem={erroGeral} />

      <BotaoPrincipal type="submit" className="formulario-item__salvar" disabled={enviando}>
        <IconeSalvarDocumento className="formulario-item__salvar-icone" />
        {enviando ? 'Salvando…' : textoSalvar}
      </BotaoPrincipal>
    </form>
  );
}

function Bloco({
  icone,
  titulo,
  opcional = false,
  htmlFor,
  erro,
  ajuda,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  opcional?: boolean;
  htmlFor?: string;
  erro?: string;
  ajuda?: string;
  children: ReactNode;
}) {
  const Rotulo = htmlFor ? 'label' : 'p';
  return (
    <div className={`formulario-item__bloco ${erro ? 'formulario-item__bloco--erro' : ''}`}>
      <span className="formulario-item__icone" aria-hidden="true">
        {icone}
      </span>
      <div className="formulario-item__corpo">
        <Rotulo className="formulario-item__rotulo" {...(htmlFor ? { htmlFor } : {})}>
          {titulo}
          {opcional && <span className="formulario-item__opcional"> (opcional)</span>}
        </Rotulo>
        {children}
        {erro ? <p className="formulario-item__erro">{erro}</p> : ajuda ? <p className="formulario-item__ajuda">{ajuda}</p> : null}
      </div>
    </div>
  );
}
