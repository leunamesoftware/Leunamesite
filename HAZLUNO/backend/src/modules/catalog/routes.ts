import { Hono } from 'hono';
import { LANGUAGES, type Category, type LanguageCode, type PublicConfig } from '../../../../shared/contracts.js';
import type { AppEnv, Deps } from '../../common/env.js';
import { authRepo } from '../auth/repository.js';

const pickLanguage = (value: string | undefined): LanguageCode =>
  (LANGUAGES as readonly string[]).includes(value ?? '') ? (value as LanguageCode) : 'en';

export function catalogRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  /** What the app needs before login: languages, countries and which features are switched on. */
  r.get('/config', async (c) => {
    const data: PublicConfig = {
      languages: await deps.db.all('SELECT code, native_name AS nativeName FROM languages WHERE is_active = 1 ORDER BY sort_order'),
      countries: await deps.db.all('SELECT code, currency, default_language AS defaultLanguage FROM countries WHERE is_active = 1 ORDER BY code'),
      // Stays off until the Google/Apple sign-in flows exist on the server: a visible button must work.
      socialLogin: { google: false, apple: false },
      passwordRecovery: !!deps.mailer,
      legal: {
        termsVersion: await authRepo.setting(deps.db, 'legal.terms_version', ''),
        privacyVersion: await authRepo.setting(deps.db, 'legal.privacy_version', ''),
      },
    };
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ ok: true, data });
  });

  r.get('/categories', async (c) => {
    const lang = pickLanguage(c.req.query('lang'));
    const data = await deps.db.all<Category>(
      `SELECT c.id, c.icon, COALESCE(t.name, en.name) AS name FROM categories c
       LEFT JOIN category_translations t ON t.category_id = c.id AND t.language_code = ?
       LEFT JOIN category_translations en ON en.category_id = c.id AND en.language_code = 'en'
       WHERE c.is_active = 1 ORDER BY c.sort_order`, [lang]);
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ ok: true, data });
  });
  return r;
}
