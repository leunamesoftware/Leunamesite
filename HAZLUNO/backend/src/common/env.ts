import type { Me } from '../../../shared/contracts.js';
import type { Config } from '../config.js';
import type { Db } from '../infra/db/types.js';
import type { Mailer } from '../infra/mailer.js';
import type { PaymentProvider } from '../infra/payments/types.js';
import type { Storage } from '../infra/storage/types.js';
import type { Clock } from './clock.js';

/** Everything modules need, injected from outside (easy to test, easy to change hosting). */
export interface Deps {
  db: Db;
  config: Config;
  clock: Clock;
  storage: Storage;
  /** null = no e-mail provider configured yet. */
  mailer: Mailer | null;
  /** null = no payment provider configured: paid enrollments answer "unavailable" (never pretend to charge). */
  payments: PaymentProvider | null;
}

/** Request-scoped values available to routes after login. */
export type AppEnv = { Variables: { me: Me; sessionTokenHash: string } };
