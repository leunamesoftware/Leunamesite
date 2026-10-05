import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { regiaoDe } from '../regioes/regioes';

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Abre o menu de compartilhar do celular com o PDF (WhatsApp, e-mail, Drive…). */
export async function compartilharArquivo(blob: Blob, nome: string, texto: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: nome, data: await blobParaBase64(blob), directory: Directory.Cache });
    await Share.share({ title: nome, text: texto, files: [uri], dialogTitle: nome });
    return;
  }
  const arquivo = new File([blob], nome, { type: blob.type || 'application/pdf' });
  if (navigator.canShare?.({ files: [arquivo] })) {
    await navigator.share({ files: [arquivo], title: nome, text: texto });
    return;
  }
  baixar(blob, nome);
}

export function baixar(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Deixa só os números e coloca o código do país quando o número não tem. */
export function telefoneInternacional(telefone: string, pais: string): string {
  let n = telefone.replace(/\D/g, '');
  if (!n) return '';
  if (telefone.trim().startsWith('+') || n.startsWith('00')) return n.replace(/^00/, '');
  const ddi = regiaoDe(pais).ddi;
  n = n.replace(/^0+/, '');
  return n.startsWith(ddi) && n.length > 11 ? n : ddi + n;
}

/** Abre o WhatsApp com a mensagem pronta (e o contato do cliente, se houver). */
export function abrirWhatsApp(texto: string, telefone: string, pais: string): void {
  const numero = telefoneInternacional(telefone, pais);
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
}

export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
