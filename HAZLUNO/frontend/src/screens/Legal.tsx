import { useI18n } from '../i18n';
import { TopBar } from '../ui/kit';

/** Legal pages. Terms/Privacy are still being written (the page says so); the teacher agreement lists the rules the platform already applies. */
export function Legal({ doc }: { doc: 'terms' | 'privacy' | 'teacher' }) {
  const { t } = useI18n();
  if (doc === 'teacher') {
    const clauses = [t.legal.c1, t.legal.c2, t.legal.c3, t.legal.c4, t.legal.c5, t.legal.c6, t.legal.c7, t.legal.c8, t.legal.c9];
    return (
      <main className="screen">
        <TopBar back="/teach/profile" />
        <div className="screen-body legal-doc">
          <h1 className="screen-title">{t.legal.teacherAgreement}</h1>
          <p className="screen-sub">{t.legal.agreementDraft}</p>
          <ol>{clauses.map((c) => <li key={c}>{c}</li>)}</ol>
        </div>
      </main>
    );
  }
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
