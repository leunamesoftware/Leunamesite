import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { Home } from './screens/Home';
import { Legal } from './screens/Legal';
import { Login } from './screens/Login';
import { Signup } from './screens/Signup';
import { Welcome } from './screens/Welcome';
import { SessionProvider, useSession } from './state/session';
import './styles.css';

function OnlySignedIn({ children }: { children: ReactNode }) {
  const { me, restoring } = useSession();
  if (restoring) return null;
  return me ? children : <Navigate to="/" replace />;
}

function OnlySignedOut({ children }: { children: ReactNode }) {
  const { me, restoring } = useSession();
  if (restoring) return null;
  return me ? <Navigate to="/home" replace /> : children;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<OnlySignedOut><Welcome /></OnlySignedOut>} />
            <Route path="/login" element={<OnlySignedOut><Login /></OnlySignedOut>} />
            <Route path="/signup" element={<OnlySignedOut><Signup /></OnlySignedOut>} />
            <Route path="/home" element={<OnlySignedIn><Home /></OnlySignedIn>} />
            <Route path="/terms" element={<Legal doc="terms" />} />
            <Route path="/privacy" element={<Legal doc="privacy" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </I18nProvider>
  </StrictMode>,
);
