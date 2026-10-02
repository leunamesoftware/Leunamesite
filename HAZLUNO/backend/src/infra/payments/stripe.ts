import { constantTimeEqual } from '../../common/security.js';
import type { CheckoutInput, PaymentProvider, WebhookEvent } from './types.js';

const API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Stripe's form encoding: nested objects become a[b][c]=value. */
function encode(params: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) value.forEach((v, i) => (typeof v === 'object' ? encode(v as Record<string, unknown>, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(v))));
    else if (typeof value === 'object') encode(value as Record<string, unknown>, name, out);
    else out.append(name, String(value));
  }
  return out;
}

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Real Stripe adapter (REST over fetch, works on Workers and Node). */
export function createStripeProvider(secretKey: string, webhookSecret: string, fetchFn: typeof fetch = fetch): PaymentProvider {
  async function call<T>(method: 'GET' | 'POST', path: string, params: Record<string, unknown> = {}, idempotencyKey?: string): Promise<T> {
    const body = method === 'POST' ? encode(params).toString() : undefined;
    const query = method === 'GET' && Object.keys(params).length ? `?${encode(params).toString()}` : '';
    const res = await fetchFn(`${API}${path}${query}`, {
      method,
      headers: {
        authorization: `Bearer ${secretKey}`,
        ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      body,
    });
    const json = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) throw new Error(`Stripe ${method} ${path} failed (${res.status}): ${json.error?.message ?? 'unknown error'}`);
    return json;
  }

  return {
    name: 'stripe',
    testMode: secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_'),

    async createCheckout(i: CheckoutInput) {
      const s = await call<{ id: string; url: string }>('POST', '/checkout/sessions', {
        mode: 'payment',
        customer_email: i.customerEmail,
        success_url: i.successUrl,
        cancel_url: i.cancelUrl,
        expires_at: Math.floor(i.expiresAt.getTime() / 1000),
        line_items: [{ quantity: 1, price_data: { currency: i.currency.toLowerCase(), unit_amount: i.amountCents, product_data: { name: i.description } } }],
        metadata: i.metadata,
        payment_intent_data: { metadata: i.metadata, transfer_group: i.transferGroup },
      }, `checkout-${i.metadata.payment_id ?? crypto.randomUUID()}`);
      return { id: s.id, url: s.url };
    },

    async expireCheckout(id) {
      await call('POST', `/checkout/sessions/${id}/expire`).catch(() => undefined); // already finished or expired: nothing to do
    },

    async parseWebhook(rawBody, header, now) {
      if (!header) throw new Error('missing signature');
      const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]).filter(([k]) => k === 't'));
      const t = Number(parts.t);
      const signatures = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
      if (!Number.isFinite(t) || !signatures.length) throw new Error('bad signature header');
      if (Math.abs(now.getTime() / 1000 - t) > SIGNATURE_TOLERANCE_SECONDS) throw new Error('signature too old');
      const expected = await hmacHex(webhookSecret, `${t}.${rawBody}`);
      if (!signatures.some((s) => constantTimeEqual(s, expected))) throw new Error('signature mismatch');
      const e = JSON.parse(rawBody) as { id: string; type: string; data: { object: Record<string, unknown> } };
      return { id: e.id, type: e.type, object: e.data.object } satisfies WebhookEvent;
    },

    async chargeDetails(paymentIntentId) {
      const pi = await call<{ latest_charge: { id: string; balance_transaction: { fee: number } | null } | null }>(
        'GET', `/payment_intents/${paymentIntentId}`, { expand: ['latest_charge.balance_transaction'] });
      if (!pi.latest_charge) throw new Error('payment has no charge');
      return { chargeId: pi.latest_charge.id, feeCents: pi.latest_charge.balance_transaction?.fee ?? 0 };
    },

    async refund(paymentIntentId, amountCents, metadata) {
      const r = await call<{ id: string; status: string }>('POST', '/refunds', { payment_intent: paymentIntentId, amount: amountCents, metadata },
        `refund-${metadata.refund_id ?? crypto.randomUUID()}`);
      return { id: r.id, status: r.status === 'succeeded' ? 'succeeded' : r.status === 'failed' || r.status === 'canceled' ? 'failed' : 'pending' };
    },

    async createAccount(i) {
      const a = await call<{ id: string }>('POST', '/accounts', {
        type: 'express', country: i.country, email: i.email, business_type: i.businessType,
        capabilities: { transfers: { requested: true } }, metadata: { user_id: i.userId },
      }, `account-${i.userId}`);
      return { id: a.id };
    },

    async onboardingLink(accountId, refreshUrl, returnUrl) {
      const l = await call<{ url: string }>('POST', '/account_links', { account: accountId, refresh_url: refreshUrl, return_url: returnUrl, type: 'account_onboarding' });
      return l.url;
    },

    async accountStatus(accountId) {
      const a = await call<{ payouts_enabled: boolean; details_submitted: boolean }>('GET', `/accounts/${accountId}`);
      return { payoutsEnabled: !!a.payouts_enabled, detailsSubmitted: !!a.details_submitted };
    },

    async transfer(i) {
      const tr = await call<{ id: string }>('POST', '/transfers', {
        amount: i.amountCents, currency: i.currency.toLowerCase(), destination: i.destination,
        source_transaction: i.sourceChargeId, transfer_group: i.transferGroup, metadata: i.metadata,
      }, `transfer-${i.metadata.payment_id ?? crypto.randomUUID()}-${i.metadata.kind ?? 'net'}`);
      return { id: tr.id };
    },
  };
}
