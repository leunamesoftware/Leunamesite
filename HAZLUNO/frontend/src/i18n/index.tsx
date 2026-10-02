import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LANGUAGES, type LanguageCode } from '../../../shared/contracts';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { pt, type Dictionary } from './pt';
import { BRAND } from '../brand';

/** Puts the brand name into every text that mentions it ({brand}). */
function withBrand<T>(node: T): T {
  if (typeof node === 'string') return node.replaceAll('{brand}', BRAND.name) as T;
  return Object.fromEntries(Object.entries(node as object).map(([k, v]) => [k, withBrand(v)])) as T;
}

const DICTIONARIES: Record<LanguageCode, Dictionary> = {
  pt: withBrand(pt), en: withBrand(en), es: withBrand(es), fr: withBrand(fr), it: withBrand(it), de: withBrand(de),
};
const STORAGE_KEY = 'hazluno.lang';

export const NATIVE_NAMES: Record<LanguageCode, string> = {
  pt: 'Português', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano', de: 'Deutsch',
};

const isLanguage = (v: string | null | undefined): v is LanguageCode => (LANGUAGES as readonly string[]).includes(v ?? '');

/** The app opens in Spanish; the visitor's own choice (language chip) is remembered. */
const DEFAULT_LANGUAGE: LanguageCode = 'es';

function detect(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch { /* storage blocked */ }
  return DEFAULT_LANGUAGE;
}

interface I18n {
  lang: LanguageCode;
  t: Dictionary;
  setLang(lang: LanguageCode): void;
  fill(text: string, vars: Record<string, string>): string;
  countryName(code: string): string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(detect);

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage blocked */ }
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const value = useMemo<I18n>(() => {
    const regions = new Intl.DisplayNames([lang], { type: 'region' });
    return {
      lang,
      t: DICTIONARIES[lang],
      setLang,
      fill: (text, vars) => text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? ''),
      countryName: (code) => regions.of(code) ?? code,
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}
