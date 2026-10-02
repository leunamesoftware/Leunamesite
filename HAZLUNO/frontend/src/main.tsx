import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { Legal } from './screens/Legal';
import { Login } from './screens/Login';
import { Signup } from './screens/Signup';
import { Landing } from './screens/Landing';
import { Welcome } from './screens/Welcome';
import { useWide } from './ui/site';
import { ChooseClass } from './screens/student/ChooseClass';
import { Checkout } from './screens/student/Checkout';
import { Enrollment } from './screens/student/Enrollment';
import { CourseDetail } from './screens/student/CourseDetail';
import { Explore } from './screens/student/Explore';
import { Favorites } from './screens/student/Favorites';
import { Home } from './screens/student/Home';
import { MyClasses } from './screens/student/MyClasses';
import { Profile } from './screens/student/Profile';
import { TeacherPublic } from './screens/student/TeacherPublic';
import { AdminDashboard } from './screens/admin/AdminDashboard';
import { AdminInstructors } from './screens/admin/AdminInstructors';
import { CourseEditor } from './screens/teacher/CourseEditor';
import { GroupForm } from './screens/teacher/GroupForm';
import { TeachAgenda } from './screens/teacher/TeachAgenda';
import { TeachHome } from './screens/teacher/TeachHome';
import { TeachProfile } from './screens/teacher/TeachProfile';
import { TeachStudents } from './screens/teacher/TeachStudents';
import { TeachEarnings } from './screens/teacher/TeachEarnings';
import { SessionProvider, useSession } from './state/session';
import './styles.css';

function OnlySignedIn({ children }: { children: ReactNode }) {
  const { me, restoring } = useSession();
  if (restoring) return null;
  return me ? children : <Navigate to="/" replace />;
}

function OnlyRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { me, restoring } = useSession();
  if (restoring) return null;
  if (!me) return <Navigate to="/" replace />;
  return me.roles.some((r) => roles.includes(r)) ? children : <Navigate to="/home" replace />;
}

/** "/" is the public website on computers and the app's welcome screen on phones. */
function Front() {
  return useWide() ? <Landing /> : <Welcome />;
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
            <Route path="/" element={<OnlySignedOut><Front /></OnlySignedOut>} />
            <Route path="/login" element={<OnlySignedOut><Login /></OnlySignedOut>} />
            <Route path="/signup" element={<OnlySignedOut><Signup /></OnlySignedOut>} />
            <Route path="/home" element={<OnlySignedIn><Home /></OnlySignedIn>} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/course/:id" element={<CourseDetail />} />
            <Route path="/course/:id/choose" element={<ChooseClass />} />
            <Route path="/course/:id/checkout/:classId" element={<Checkout />} />
            <Route path="/enrollment/:id" element={<OnlySignedIn><Enrollment /></OnlySignedIn>} />
            <Route path="/teacher/:id" element={<TeacherPublic />} />
            <Route path="/my" element={<OnlySignedIn><MyClasses /></OnlySignedIn>} />
            <Route path="/favorites" element={<OnlySignedIn><Favorites /></OnlySignedIn>} />
            <Route path="/profile" element={<OnlySignedIn><Profile /></OnlySignedIn>} />
            <Route path="/teach" element={<OnlyRole roles={['instructor']}><TeachHome /></OnlyRole>} />
            <Route path="/teach/profile" element={<OnlyRole roles={['instructor']}><TeachProfile /></OnlyRole>} />
            <Route path="/teach/students" element={<OnlyRole roles={['instructor']}><TeachStudents /></OnlyRole>} />
            <Route path="/teach/earnings" element={<OnlyRole roles={['instructor']}><TeachEarnings /></OnlyRole>} />
            <Route path="/teach/agenda" element={<OnlyRole roles={['instructor']}><TeachAgenda /></OnlyRole>} />
            <Route path="/teach/courses/new" element={<OnlyRole roles={['instructor']}><CourseEditor /></OnlyRole>} />
            <Route path="/teach/courses/:id" element={<OnlyRole roles={['instructor']}><CourseEditor /></OnlyRole>} />
            <Route path="/teach/courses/:id/groups/new" element={<OnlyRole roles={['instructor']}><GroupForm /></OnlyRole>} />
            <Route path="/admin" element={<OnlyRole roles={['admin', 'moderator']}><AdminDashboard /></OnlyRole>} />
            <Route path="/admin/instructors" element={<OnlyRole roles={['admin', 'moderator']}><AdminInstructors /></OnlyRole>} />
            <Route path="/terms" element={<Legal doc="terms" />} />
            <Route path="/privacy" element={<Legal doc="privacy" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </I18nProvider>
  </StrictMode>,
);
