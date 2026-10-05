import type { FormaPagamento } from '../dominio/tipos';

// Regras por país num lugar só. Para atender um país novo, basta acrescentar uma linha.
export interface Regiao {
  pais: string;
  moeda: string;
  idioma: 'pt-BR' | 'en' | 'es';
  locale: string; // formatação de números e datas
  pagamentos: FormaPagamento[]; // em ordem de preferência
  rotuloDocumento: string; // nome do documento fiscal do profissional
  ddi: string;
}

const R = (pais: string, moeda: string, idioma: Regiao['idioma'], locale: string, pagamentos: FormaPagamento[], rotuloDocumento: string, ddi: string): Regiao =>
  ({ pais, moeda, idioma, locale, pagamentos, rotuloDocumento, ddi });

export const REGIOES: Record<string, Regiao> = {
  BR: R('BR', 'BRL', 'pt-BR', 'pt-BR', ['pix', 'link', 'banco'], 'CPF/CNPJ', '55'),
  PT: R('PT', 'EUR', 'pt-BR', 'pt-PT', ['link', 'banco'], 'NIF', '351'),
  AO: R('AO', 'AOA', 'pt-BR', 'pt-AO', ['banco', 'link'], 'NIF', '244'),
  MZ: R('MZ', 'MZN', 'pt-BR', 'pt-MZ', ['banco', 'link'], 'NUIT', '258'),
  US: R('US', 'USD', 'en', 'en-US', ['link', 'banco'], 'Tax ID', '1'),
  CA: R('CA', 'CAD', 'en', 'en-CA', ['link', 'banco'], 'Business Number', '1'),
  GB: R('GB', 'GBP', 'en', 'en-GB', ['link', 'banco'], 'UTR / VAT', '44'),
  IE: R('IE', 'EUR', 'en', 'en-IE', ['link', 'banco'], 'VAT', '353'),
  AU: R('AU', 'AUD', 'en', 'en-AU', ['link', 'banco'], 'ABN', '61'),
  NZ: R('NZ', 'NZD', 'en', 'en-NZ', ['link', 'banco'], 'NZBN', '64'),
  IN: R('IN', 'INR', 'en', 'en-IN', ['link', 'banco'], 'GSTIN', '91'),
  ZA: R('ZA', 'ZAR', 'en', 'en-ZA', ['link', 'banco'], 'Tax No.', '27'),
  NG: R('NG', 'NGN', 'en', 'en-NG', ['banco', 'link'], 'TIN', '234'),
  PH: R('PH', 'PHP', 'en', 'en-PH', ['link', 'banco'], 'TIN', '63'),
  ES: R('ES', 'EUR', 'es', 'es-ES', ['link', 'banco'], 'NIF/CIF', '34'),
  MX: R('MX', 'MXN', 'es', 'es-MX', ['link', 'banco'], 'RFC', '52'),
  AR: R('AR', 'ARS', 'es', 'es-AR', ['link', 'banco'], 'CUIT', '54'),
  CO: R('CO', 'COP', 'es', 'es-CO', ['link', 'banco'], 'NIT', '57'),
  CL: R('CL', 'CLP', 'es', 'es-CL', ['link', 'banco'], 'RUT', '56'),
  PE: R('PE', 'PEN', 'es', 'es-PE', ['link', 'banco'], 'RUC', '51'),
  UY: R('UY', 'UYU', 'es', 'es-UY', ['link', 'banco'], 'RUT', '598'),
  PY: R('PY', 'PYG', 'es', 'es-PY', ['banco', 'link'], 'RUC', '595'),
  BO: R('BO', 'BOB', 'es', 'es-BO', ['banco', 'link'], 'NIT', '591'),
  EC: R('EC', 'USD', 'es', 'es-EC', ['link', 'banco'], 'RUC', '593'),
  VE: R('VE', 'USD', 'es', 'es-VE', ['banco', 'link'], 'RIF', '58'),
  DO: R('DO', 'DOP', 'es', 'es-DO', ['banco', 'link'], 'RNC', '1'),
  GT: R('GT', 'GTQ', 'es', 'es-GT', ['banco', 'link'], 'NIT', '502'),
  CR: R('CR', 'CRC', 'es', 'es-CR', ['link', 'banco'], 'Cédula', '506'),
  PA: R('PA', 'USD', 'es', 'es-PA', ['link', 'banco'], 'RUC', '507'),
};

export const REGIAO_PADRAO = R('US', 'USD', 'en', 'en-US', ['link', 'banco'], 'Tax ID', '1');

export function regiaoDe(pais: string): Regiao {
  return REGIOES[pais.toUpperCase()] ?? { ...REGIAO_PADRAO, pais: pais.toUpperCase() };
}

/** Descobre o país pelo idioma do aparelho (ex.: pt-BR → BR, es-MX → MX). */
export function paisDoAparelho(idiomas: readonly string[] = navigator.languages ?? [navigator.language]): string {
  for (const l of idiomas) {
    const m = /^[a-z]{2,3}[-_]([A-Z]{2})$/i.exec(l);
    if (m && m[1] && REGIOES[m[1].toUpperCase()]) return m[1].toUpperCase();
  }
  const base = (idiomas[0] || 'en').slice(0, 2).toLowerCase();
  return base === 'pt' ? 'BR' : base === 'es' ? 'MX' : 'US';
}

export const MOEDAS = Array.from(new Set(Object.values(REGIOES).map((r) => r.moeda))).sort();
