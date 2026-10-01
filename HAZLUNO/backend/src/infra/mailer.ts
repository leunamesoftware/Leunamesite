/** Outgoing e-mail port. Production gets a real provider adapter; without one, e-mail features answer "unavailable". */
export interface Mailer {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}
