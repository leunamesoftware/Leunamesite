/**
 * Payment provider port (Stripe Connect in production). The app never sees card data:
 * people pay on the provider's page, and only a verified webhook confirms a payment.
 */
export interface CheckoutInput {
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  /** The provider closes the page at this moment (Stripe needs at least 30 minutes). */
  expiresAt: Date;
  /** Copied to the provider objects; comes back in the webhook. */
  metadata: Record<string, string>;
  /** Groups the charge with the later transfer to the teacher. */
  transferGroup?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  /** The provider object the event is about (checkout session, account, refund…). */
  object: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  /** true = sandbox keys: payments are marked as test. */
  readonly testMode: boolean;
  createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }>;
  expireCheckout(checkoutId: string): Promise<void>;
  /** Checks the signature with the webhook secret; throws on anything not signed by the provider. */
  parseWebhook(rawBody: string, signatureHeader: string | null, now: Date): Promise<WebhookEvent>;
  /** The real fee the provider kept on a payment, and the charge id (needed for transfers). */
  chargeDetails(paymentId: string): Promise<{ chargeId: string; feeCents: number }>;
  refund(paymentId: string, amountCents: number, metadata: Record<string, string>): Promise<{ id: string; status: 'pending' | 'succeeded' | 'failed' }>;
  createAccount(input: { email: string; country: string; businessType: 'individual' | 'company'; userId: string }): Promise<{ id: string }>;
  onboardingLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<string>;
  accountStatus(accountId: string): Promise<{ payoutsEnabled: boolean; detailsSubmitted: boolean }>;
  transfer(input: { amountCents: number; currency: string; destination: string; sourceChargeId: string; transferGroup: string; metadata: Record<string, string> }): Promise<{ id: string }>;
}
