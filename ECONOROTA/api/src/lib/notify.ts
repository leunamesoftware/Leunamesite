import { ApiError } from './errors';
import type { Channel, Env } from './types';

export const channelsAvailable = (env: Env) => ({
  email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM) || env.DEV_MODE === 'true',
  whatsapp: Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID && env.WHATSAPP_TEMPLATE) || env.DEV_MODE === 'true',
});

const unavailable = () => new ApiError(503, 'channel_unavailable', 'Canal de envio indisponível no momento.');

const texts = {
  verify: { subject: 'Seu código de verificação EconoRota', intro: 'Use o código abaixo para confirmar sua conta:' },
  reset: { subject: 'Redefinição de senha EconoRota', intro: 'Use o código abaixo para criar uma nova senha:' },
};

/** Envia o código pelo canal escolhido. Em DEV_MODE apenas registra no log local. */
export async function sendCode(env: Env, channel: Channel, to: string, code: string, purpose: 'verify' | 'reset') {
  if (env.DEV_MODE === 'true' && !(channel === 'email' ? env.RESEND_API_KEY : env.WHATSAPP_TOKEN)) {
    console.log(`[DEV] código ${purpose} para ${channel}: ${code}`);
    return;
  }
  if (!channelsAvailable(env)[channel]) throw unavailable();

  const res =
    channel === 'email'
      ? await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: env.EMAIL_FROM,
            to: [to],
            subject: texts[purpose].subject,
            text: `${texts[purpose].intro}\n\n${code}\n\nO código vale por 10 minutos. Se não foi você, ignore este e-mail.`,
            html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0A0F2B">
<h2 style="color:#480082;margin:0 0 12px">EconoRota</h2><p>${texts[purpose].intro}</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p>
<p style="color:#555;font-size:13px">O código vale por 10 minutos. Se não foi você, ignore este e-mail.</p></div>`,
          }),
        })
      : await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to.replace('+', ''),
            type: 'template',
            template: {
              name: env.WHATSAPP_TEMPLATE,
              language: { code: 'pt_BR' },
              components: [
                { type: 'body', parameters: [{ type: 'text', text: code }] },
                { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
              ],
            },
          }),
        });

  if (!res.ok) {
    console.error(`Falha no envio (${channel}): ${res.status}`);
    throw unavailable();
  }
}

/** E-mail simples de aviso (pedido pago, entregue, reembolso). Sem Resend configurado, só registra em DEV. */
export async function sendEmail(env: Env, to: string, subject: string, text: string) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (env.DEV_MODE === 'true') console.log(`[DEV] e-mail para ${to}: ${subject}`);
    return;
  }
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject: `EconoRota: ${subject}`,
      text,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0A0F2B">
<h2 style="color:#480082;margin:0 0 12px">EconoRota</h2><p style="font-weight:700">${esc(subject)}</p><p>${esc(text)}</p>
<p style="color:#555;font-size:13px">Acompanhe pelo aplicativo EconoRota.</p></div>`,
    }),
  });
  if (!res.ok) console.error(`Falha no e-mail: ${res.status}`);
}
