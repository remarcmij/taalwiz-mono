import { IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import AdminRoute from './components/AdminRoute.tsx';
import AppMenu from './components/AppMenu.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import RegisterRoute from './components/RegisterRoute.tsx';
import UpdatePrompt from './components/UpdatePrompt.tsx';
import { LOG_LEVEL } from './constants.ts';
import { AuthProvider } from './context/AuthContext.tsx';
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
  useEffect(() => {
    logger.setLevel(LOG_LEVEL);
  }, []);

  return (
    <IonApp>
      <IonReactRouter>
        <AppMenu />
        <IonRouterOutlet id="main-content">
          {/* Auth routes (public) */}
          <Route exact path="/auth" component={LoginPage} />
          <RegisterRoute exact path="/auth/register" component={RegisterPage} />
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
          <ProtectedRoute path="/home/tabs" component={HomePage} />

          {/* Flashcard (protected) */}
          <ProtectedRoute
            exact
            path="/flashcard/:filename"
            component={FlashcardPage}
          />

          {/* User pages (protected) */}
          <ProtectedRoute
            exact
            path="/welcome/:lang"
            component={WelcomePage}
          />
          <ProtectedRoute exact path="/about/:lang" component={AboutPage} />
          <ProtectedRoute exact path="/contact" component={ContactPage} />

          {/* Admin routes */}
          <AdminRoute exact path="/admin" component={AdminPage} />
          <AdminRoute exact path="/admin/users" component={AdminUsersPage} />
          <AdminRoute
            exact
            path="/admin/new-user"
            component={AdminNewUserPage}
          />
          <AdminRoute
            exact
            path="/admin/content"
            component={AdminContentPage}
          />
          <AdminRoute
            exact
            path="/admin/content/article/:filename"
            component={AdminArticlePreviewPage}
          />
          <AdminRoute
            exact
            path="/admin/content/:groupName"
            component={AdminPublicationPage}
          />
          <AdminRoute exact path="/admin/upload" component={AdminUploadPage} />
          <AdminRoute
            exact
            path="/admin/system-settings"
            component={AdminSystemSettingsPage}
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
