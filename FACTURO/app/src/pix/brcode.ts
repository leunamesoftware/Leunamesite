// Gera o "Pix Copia e Cola" (BR Code estático, padrão EMV do Banco Central).
// Funciona sem internet: o QR Code é montado no próprio celular.

function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, '0') + valor;
}

/** Remove acentos e caracteres fora do permitido pelo padrão. */
function limpar(texto: string, max: number): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,\-/@:]/g, '')
    .trim()
    .slice(0, max);
}

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface DadosPix {
  chave: string;
  nome: string;
  cidade: string;
  valorCentavos?: number; // opcional: sem valor, o pagador digita
  identificador?: string; // txid (até 25 letras/números)
}

export function gerarPixCopiaECola(d: DadosPix): string {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', d.chave.trim());
  const txid = (d.identificador || '***').replace(/[^A-Za-z0-9*]/g, '').slice(0, 25) || '***';
  let p =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (d.valorCentavos && d.valorCentavos > 0 ? campo('54', (d.valorCentavos / 100).toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', limpar(d.nome, 25) || 'RECEBEDOR') +
    campo('60', limpar(d.cidade, 15) || 'BRASIL') +
    campo('62', campo('05', txid)) +
    '6304';
  return p + crc16(p);
}
