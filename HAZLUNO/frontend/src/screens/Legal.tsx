import { useI18n } from '../i18n';
import { TopBar } from '../ui/kit';

/** Termos / Privacidade: os textos jurídicos ainda serão escritos; a página diz isso em vez de inventar conteúdo. */
export function Legal({ doc }: { doc: 'terms' | 'privacy' }) {
  const { t } = useI18n();
  return (
    <main className="screen">
      <TopBar back="/" />
      <div className="screen-body">
        <h1 className="screen-title">{doc === 'terms' ? t.legal.terms : t.legal.privacy}</h1>
        <p className="screen-sub">{t.legal.pendingText}</p>
      </div>
    </main>
  );
}
