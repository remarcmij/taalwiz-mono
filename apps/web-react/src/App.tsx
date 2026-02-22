import { IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import AppMenu from './components/AppMenu.tsx';
import RegisterRouteGuard from './components/RegisterRoute.tsx';
import UpdatePrompt from './components/UpdatePrompt.tsx';
import { LOG_LEVEL } from './constants.ts';
import { AuthProvider, HOME_URL } from './context/AuthContext.tsx';
import { useAuth } from './hooks/useAuth.ts';
import { logger } from './lib/logger.ts';
import AdminArticlePreviewPage from './pages/admin/AdminArticlePreviewPage.tsx';
import AdminContentPage from './pages/admin/AdminContentPage.tsx';
import AdminNewUserPage from './pages/admin/AdminNewUserPage.tsx';
import AdminPage from './pages/admin/AdminPage.tsx';
import AdminPublicationPage from './pages/admin/AdminPublicationPage.tsx';
import AdminSystemSettingsPage from './pages/admin/AdminSystemSettingsPage.tsx';
import AdminUploadPage from './pages/admin/AdminUploadPage.tsx';
import AdminUsersPage from './pages/admin/AdminUsersPage.tsx';
import ChangePasswordPage from './pages/auth/ChangePasswordPage.tsx';
import LoginPage from './pages/auth/LoginPage.tsx';
import RegisterPage from './pages/auth/RegisterPage.tsx';
import RequestPasswordResetPage from './pages/auth/RequestPasswordResetPage.tsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.tsx';
import FlashcardPage from './pages/flashcard/FlashcardPage.tsx';
import HomePage from './pages/home/HomePage.tsx';
import AboutPage from './pages/user/AboutPage.tsx';
import ContactPage from './pages/user/ContactPage.tsx';
import WelcomePage from './pages/user/WelcomePage.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const AppInner: React.FC = () => {
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    logger.setLevel(LOG_LEVEL);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const protectedRender = (Component: React.ComponentType<any>) => (props: any) =>
    user ? <Component {...props} /> : <Redirect to="/auth" />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminRender = (Component: React.ComponentType<any>) => (props: any) => {
    if (!user) return <Redirect to="/auth" />;
    if (!isAdmin) return <Redirect to={HOME_URL} />;
    return <Component {...props} />;
  };

  return (
    <IonApp>
      <IonReactRouter>
        <AppMenu />
        <IonRouterOutlet id="main-content">
          {/* Auth routes (public) */}
          <Route exact path="/auth" component={LoginPage} />
          <Route
            exact
            path="/auth/register"
            render={() => (
              <RegisterRouteGuard component={RegisterPage} />
            )}
          />
          <Route
            exact
            path="/auth/change-password"
            component={ChangePasswordPage}
          />
          <Route
            exact
            path="/auth/request-password-reset"
            component={RequestPasswordResetPage}
          />
          <Route
            exact
            path="/auth/reset-password"
            component={ResetPasswordPage}
          />

          {/* Home routes (protected, with tabs) */}
          <Route path="/home/tabs" render={protectedRender(HomePage)} />

          {/* Flashcard (protected) */}
          <Route
            exact
            path="/flashcard/:filename"
            render={protectedRender(FlashcardPage)}
          />

          {/* User pages (protected) */}
          <Route
            exact
            path="/welcome/:lang"
            render={protectedRender(WelcomePage)}
          />
          <Route
            exact
            path="/about/:lang"
            render={protectedRender(AboutPage)}
          />
          <Route exact path="/contact" render={protectedRender(ContactPage)} />

          {/* Admin routes */}
          <Route exact path="/admin" render={adminRender(AdminPage)} />
          <Route
            exact
            path="/admin/users"
            render={adminRender(AdminUsersPage)}
          />
          <Route
            exact
            path="/admin/new-user"
            render={adminRender(AdminNewUserPage)}
          />
          <Route
            exact
            path="/admin/content"
            render={adminRender(AdminContentPage)}
          />
          <Route
            exact
            path="/admin/content/article/:filename"
            render={adminRender(AdminArticlePreviewPage)}
          />
          <Route
            exact
            path="/admin/content/:groupName"
            render={adminRender(AdminPublicationPage)}
          />
          <Route
            exact
            path="/admin/upload"
            render={adminRender(AdminUploadPage)}
          />
          <Route
            exact
            path="/admin/system-settings"
            render={adminRender(AdminSystemSettingsPage)}
          />

          {/* Fallback */}
          <Route exact path="/">
            <Redirect to="/auth" />
          </Route>
        </IonRouterOutlet>
      </IonReactRouter>
      <UpdatePrompt />
    </IonApp>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
