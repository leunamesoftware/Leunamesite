/** Stand-in for Stripe's API in tests only: answers like Stripe and signs webhooks like Stripe. */
export const WEBHOOK_SECRET = 'whsec_test_secret';

export interface FakeStripe {
  fetch: typeof fetch;
  sessions: Map<string, { id: string; url: string; amount: number; metadata: Record<string, string>; expiresAt: number; expired: boolean; paymentIntent: string }>;
  refunds: { id: string; payment_intent: string; amount: number }[];
  transfers: { id: string; amount: number; destination: string; source_transaction: string }[];
  accounts: Map<string, { email: string; country: string; payouts_enabled: boolean }>;
  feeFor(amount: number): number;
  /** Builds a signed webhook request body + header, as Stripe would send it. */
  webhook(type: string, object: Record<string, unknown>, at?: Date): Promise<{ body: string; signature: string }>;
}

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function createFakeStripe(): FakeStripe {
  let n = 0;
  const id = (p: string) => `${p}_${++n}`;
  const f: FakeStripe = {
    sessions: new Map(), refunds: [], transfers: [], accounts: new Map(),
    feeFor: (amount) => Math.round(amount * 0.015) + 25,
    async webhook(type, object, at = new Date()) {
      const body = JSON.stringify({ id: id('evt'), type, data: { object } });
      const t = Math.floor(at.getTime() / 1000);
      return { body, signature: `t=${t},v1=${await hmacHex(WEBHOOK_SECRET, `${t}.${body}`)}` };
    },
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const path = url.pathname.replace('/v1', '');
      const form = new URLSearchParams(String(init?.body ?? ''));
      const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
      if (!String(init?.headers && (init.headers as Record<string, string>).authorization).startsWith('Bearer sk_test_')) return json(401, { error: { message: 'bad key' } });
      const meta = (prefix: string) => Object.fromEntries([...form.entries()].filter(([k]) => k.startsWith(`${prefix}[`)).map(([k, v]) => [k.slice(prefix.length + 1, -1), v]));
      if (init?.method === 'POST' && path === '/checkout/sessions') {
        const s = { id: id('cs_test'), url: `https://checkout.stripe.test/${n}`, amount: Number(form.get('line_items[0][price_data][unit_amount]')),
          metadata: meta('metadata'), expiresAt: Number(form.get('expires_at')), expired: false, paymentIntent: id('pi') };
        f.sessions.set(s.id, s);
        return json(200, { id: s.id, url: s.url });
      }
      const exp = path.match(/^\/checkout\/sessions\/(.+)\/expire$/);
      if (exp) { const s = f.sessions.get(exp[1]!); if (s) s.expired = true; return json(200, { id: exp[1] }); }
      const pi = path.match(/^\/payment_intents\/(.+)$/);
      if (pi) {
        const s = [...f.sessions.values()].find((x) => x.paymentIntent === pi[1]);
        return json(200, { id: pi[1], latest_charge: s ? { id: `ch_${pi[1]}`, balance_transaction: { fee: f.feeFor(s.amount) } } : null });
      }
      if (path === '/refunds') { const r = { id: id('re'), payment_intent: form.get('payment_intent')!, amount: Number(form.get('amount')) }; f.refunds.push(r); return json(200, { ...r, status: 'succeeded' }); }
      if (path === '/accounts' && init?.method === 'POST') { const a = id('acct'); f.accounts.set(a, { email: form.get('email')!, country: form.get('country')!, payouts_enabled: false }); return json(200, { id: a }); }
      const acc = path.match(/^\/accounts\/(.+)$/);
      if (acc) { const a = f.accounts.get(acc[1]!); return json(a ? 200 : 404, { id: acc[1], payouts_enabled: a?.payouts_enabled ?? false, details_submitted: a?.payouts_enabled ?? false }); }
      if (path === '/account_links') return json(200, { url: `https://connect.stripe.test/onboard/${form.get('account')}` });
      if (path === '/transfers') {
        const t = { id: id('tr'), amount: Number(form.get('amount')), destination: form.get('destination')!, source_transaction: form.get('source_transaction')! };
        f.transfers.push(t); return json(200, t);
      }
      return json(404, { error: { message: `unknown ${path}` } });
    }) as typeof fetch,
  };
  return f;
}
