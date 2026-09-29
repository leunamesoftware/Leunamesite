// Valores em reais. No sistema tudo é guardado em centavos (R$ 12,34 = 1234).

const formato = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 123450 → "R$ 1.234,50" */
export function reais(centavos: number): string {
  return formato.format(centavos / 100).replace(/ /g, ' ');
}

/** O que a pessoa digitou → centavos. Só os números contam: "12345" → 12345 (R$ 123,45). */
export function textoParaCentavos(texto: string): number | null {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11);
  return digitos ? Number(digitos) : null;
}

/** Centavos → texto do campo, sem o "R$": 12345 → "123,45". */
export function centavosParaTexto(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '';
  return reais(centavos).replace(/^R\$\s?/, '');
}
