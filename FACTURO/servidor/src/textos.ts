// Textos da página que o cliente abre. Um idioma novo: acrescente um bloco igual.
export const TEXTOS = {
  'pt-BR': {
    jaPaguei: 'Já paguei', confirmarPaguei: 'Confirma que você já fez o pagamento?', pagamentoInformado: 'Pagamento informado em {data}. {negocio} vai conferir e confirmar.',
    orcamento: 'Orçamento', fatura: 'Fatura', para: 'Para', emitido: 'Emitido em', valido: 'Válido até', vence: 'Vencimento',
    item: 'Item', qtd: 'Qtd.', valor: 'Valor', subtotal: 'Subtotal', desconto: 'Desconto', total: 'Total', observacoes: 'Observações',
    aprovarTitulo: 'Aprovar este orçamento', seuNome: 'Seu nome', assine: 'Assine com o dedo no quadro abaixo', limpar: 'Limpar',
    aprovar: 'Aprovar orçamento', recusar: 'Não aprovar', confirmarRecusa: 'Tem certeza que não quer aprovar?',
    aprovado: 'Orçamento aprovado', aprovadoPor: 'Aprovado por {nome} em {data}', recusado: 'Você não aprovou este orçamento.',
    obrigado: 'Obrigado! {negocio} já pode ver sua aprovação.', faltaNome: 'Digite seu nome.', faltaAssinatura: 'Assine no quadro.',
    erro: 'Não foi possível enviar. Verifique a internet e tente de novo.',
    pagar: 'Como pagar', pix: 'Pague com Pix', pixAjuda: 'Abra o app do seu banco, escolha Pix e leia o código, ou copie o código abaixo.',
    copiar: 'Copiar código Pix', copiado: 'Código copiado!', pagarLink: 'Pagar agora', banco: 'Dados bancários',
    vencido: 'Link expirado ou inexistente.', feito: 'Feito com Facturo', contato: 'Falar com {negocio}',
  },
  en: {
    jaPaguei: 'I have paid', confirmarPaguei: 'Confirm that you have already paid?', pagamentoInformado: 'Payment reported on {data}. {negocio} will check and confirm.',
    orcamento: 'Quote', fatura: 'Invoice', para: 'Bill to', emitido: 'Issued', valido: 'Valid until', vence: 'Due date',
    item: 'Item', qtd: 'Qty', valor: 'Amount', subtotal: 'Subtotal', desconto: 'Discount', total: 'Total', observacoes: 'Notes',
    aprovarTitulo: 'Approve this quote', seuNome: 'Your name', assine: 'Sign with your finger in the box below', limpar: 'Clear',
    aprovar: 'Approve quote', recusar: 'Decline', confirmarRecusa: 'Are you sure you want to decline?',
    aprovado: 'Quote approved', aprovadoPor: 'Approved by {nome} on {data}', recusado: 'You declined this quote.',
    obrigado: 'Thank you! {negocio} can now see your approval.', faltaNome: 'Enter your name.', faltaAssinatura: 'Please sign in the box.',
    erro: 'Could not send. Check your connection and try again.',
    pagar: 'How to pay', pix: 'Pay with Pix', pixAjuda: 'Open your banking app, choose Pix and scan the code, or copy the code below.',
    copiar: 'Copy Pix code', copiado: 'Code copied!', pagarLink: 'Pay now', banco: 'Bank details',
    vencido: 'This link has expired or does not exist.', feito: 'Made with Facturo', contato: 'Contact {negocio}',
  },
  es: {
    jaPaguei: 'Ya pagué', confirmarPaguei: '¿Confirmas que ya hiciste el pago?', pagamentoInformado: 'Pago informado el {data}. {negocio} lo revisará y confirmará.',
    orcamento: 'Presupuesto', fatura: 'Factura', para: 'Para', emitido: 'Emitido', valido: 'Válido hasta', vence: 'Vencimiento',
    item: 'Ítem', qtd: 'Cant.', valor: 'Importe', subtotal: 'Subtotal', desconto: 'Descuento', total: 'Total', observacoes: 'Notas',
    aprovarTitulo: 'Aprobar este presupuesto', seuNome: 'Tu nombre', assine: 'Firma con el dedo en el recuadro', limpar: 'Borrar',
    aprovar: 'Aprobar presupuesto', recusar: 'No aprobar', confirmarRecusa: '¿Seguro que no quieres aprobarlo?',
    aprovado: 'Presupuesto aprobado', aprovadoPor: 'Aprobado por {nome} el {data}', recusado: 'No aprobaste este presupuesto.',
    obrigado: '¡Gracias! {negocio} ya puede ver tu aprobación.', faltaNome: 'Escribe tu nombre.', faltaAssinatura: 'Firma en el recuadro.',
    erro: 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.',
    pagar: 'Cómo pagar', pix: 'Paga con Pix', pixAjuda: 'Abre tu banco, elige Pix y escanea el código, o copia el código.',
    copiar: 'Copiar código Pix', copiado: '¡Código copiado!', pagarLink: 'Pagar ahora', banco: 'Datos bancarios',
    vencido: 'Este enlace venció o no existe.', feito: 'Hecho con Facturo', contato: 'Contactar a {negocio}',
  },
} as const;

export type Textos = Record<keyof (typeof TEXTOS)['pt-BR'], string>;

export function textos(idioma: string): Textos {
  return (TEXTOS as Record<string, Textos>)[idioma] ?? TEXTOS.en;
}

export function preencher(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}
