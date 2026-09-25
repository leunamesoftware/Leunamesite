/**
 * Provedores de pagamento. Produção: Asaas (Pix e cartão na página segura do Asaas — o EconoRota
 * nunca recebe dados de cartão). Desenvolvimento sem chave: simulador local (DEV_MODE=true).
 */
import { ApiError } from './errors';
import type { Env } from './types';

export type Method = 'pix' | 'cartao';

export type Charge = {
  providerId: string;
  invoiceUrl: string | null;
  pix: { payload: string; image: string | null; expiresAt: string } | null;
};

export type Customer = { id: string; name: string; email: string; phone: string | null; cpf: string; providerCustomerId: string | null };

export interface PaymentProvider {
  readonly name: 'asaas' | 'simulado';
  /** Garante o cliente no provedor e devolve o id dele. */
  customer(c: Customer): Promise<string>;
  charge(input: { customerId: string; method: Method; amountCents: number; orderId: string; description: string }): Promise<Charge>;
  cancel(providerId: string): Promise<void>;
  /** Estorno total ou parcial ([amountCents]). */
  refund(providerId: string, amountCents?: number): Promise<void>;
}

const unavailable = () => new ApiError(503, 'payments_unavailable', 'Pagamentos indisponíveis no momento. Tente mais tarde.');
const today = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // data de Brasília

class Asaas implements PaymentProvider {
  readonly name = 'asaas' as const;
  constructor(
    private readonly key: string,
    private readonly base: string,
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method,
        headers: { access_token: this.key, 'Content-Type': 'application/json', 'User-Agent': 'EconoRota' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw unavailable();
    }
    const data = (await res.json().catch(() => ({}))) as T & { errors?: { description?: string }[] };
    if (!res.ok) {
      console.error('asaas', method, path, res.status, JSON.stringify(data.errors ?? data).slice(0, 300));
      if (res.status >= 500) throw unavailable();
      throw new ApiError(400, 'payment_rejected', data.errors?.[0]?.description ?? 'Não foi possível gerar o pagamento.');
    }
    return data;
  }

  async customer(c: Customer) {
    if (c.providerCustomerId) return c.providerCustomerId;
    const r = await this.call<{ id: string }>('POST', '/customers', {
      name: c.name,
      cpfCnpj: c.cpf,
      email: c.email,
      mobilePhone: c.phone ?? undefined,
      externalReference: c.id,
      notificationDisabled: true,
    });
    return r.id;
  }

  async charge(i: { customerId: string; method: Method; amountCents: number; orderId: string; description: string }) {
    const p = await this.call<{ id: string; invoiceUrl: string }>('POST', '/payments', {
      customer: i.customerId,
      billingType: i.method === 'pix' ? 'PIX' : 'CREDIT_CARD',
      value: i.amountCents / 100,
      dueDate: today(),
      description: i.description,
      externalReference: i.orderId,
    });
    if (i.method === 'cartao') return { providerId: p.id, invoiceUrl: p.invoiceUrl, pix: null };
    const q = await this.call<{ encodedImage: string; payload: string; expirationDate: string }>('GET', `/payments/${p.id}/pixQrCode`);
    return { providerId: p.id, invoiceUrl: p.invoiceUrl, pix: { payload: q.payload, image: q.encodedImage, expiresAt: q.expirationDate } };
  }

  async cancel(id: string) {
    await this.call('DELETE', `/payments/${encodeURIComponent(id)}`);
  }

  async refund(id: string, amountCents?: number) {
    await this.call('POST', `/payments/${encodeURIComponent(id)}/refund`, amountCents ? { value: amountCents / 100 } : {});
  }
}

/** Simulador para desenvolvimento e testes automáticos (nunca ativo em produção). */
class Simulated implements PaymentProvider {
  readonly name = 'simulado' as const;
  async customer(c: Customer) {
    return c.providerCustomerId ?? `sim_cus_${c.id.slice(0, 8)}`;
  }
  async charge(i: { method: Method; amountCents: number; orderId: string }) {
    const id = `sim_pay_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    return {
      providerId: id,
      invoiceUrl: i.method === 'cartao' ? `https://sandbox.asaas.com/i/${id}` : null,
      pix: i.method === 'pix' ? { payload: `00020126SIMULADO-ECONOROTA-${i.orderId}-${i.amountCents}6304ABCD`, image: null, expiresAt } : null,
    };
  }
  async cancel() {}
  async refund() {}
}

export function paymentProvider(env: Env): PaymentProvider {
  if (env.ASAAS_API_KEY) return new Asaas(env.ASAAS_API_KEY, (env.ASAAS_BASE_URL ?? 'https://sandbox.asaas.com/api/v3').replace(/\/$/, ''));
  if (env.DEV_MODE === 'true') return new Simulated();
  throw unavailable();
}
