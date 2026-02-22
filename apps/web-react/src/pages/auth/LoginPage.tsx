import {
  IonAlert,
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonLoading,
  IonPage,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { HOME_URL } from '../../context/AuthContext.tsx';
import { useAuth } from '../../hooks/useAuth.ts';
import { AUTH_FAILED, MIN_PASSWORD_LENGTH } from '../../types/models.ts';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isValid = email.includes('@') && password.length >= MIN_PASSWORD_LENGTH;

  const handleLogin = async () => {
    if (!isValid) {
      if (!email.includes('@')) {
        setErrorMessage(t('auth.email-invalid'));
      } else {
        setErrorMessage(t('auth.password-invalid'));
      }
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      setIsLoading(false);
      setEmail('');
      setPassword('');
      history.replace(HOME_URL);
    } catch (err) {
      setIsLoading(false);
      const msgKey =
        err instanceof Error && err.message === AUTH_FAILED
          ? 'auth.auth-failed'
          : 'auth.login-failed';
      setErrorMessage(t(msgKey));
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>
            {t('common.app-name')} {t('auth.login')}
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="content-container">
          <IonGrid>
            <IonRow>
              <IonCol sizeSm="6" offsetSm="3">
                <IonList lines="none">
                  <IonItem>
                    <IonInput
                      type="email"
                      label="Email"
                      labelPlacement="floating"
                      errorText={t('auth.email-invalid')}
                      value={email}
                      onIonInput={(e) => setEmail(e.detail.value ?? '')}
                      required
                    />
                  </IonItem>
                  <IonItem>
                    <IonInput
                      type="password"
                      label={t('auth.password')}
                      labelPlacement="floating"
                      errorText={t('auth.password-invalid')}
                      value={password}
                      onIonInput={(e) => setPassword(e.detail.value ?? '')}
                      required
                      minlength={MIN_PASSWORD_LENGTH}
                    />
                  </IonItem>
                </IonList>
              </IonCol>
            </IonRow>
            <IonRow>
              <IonCol sizeMd="6" offsetMd="3">
                <IonButton
                  color="primary"
                  expand="block"
                  onClick={handleLogin}
                >
                  {t('auth.login')}
                </IonButton>
              </IonCol>
            </IonRow>
            <IonRow>
              <IonCol sizeMd="6" offsetMd="3" className="ion-text-center">
                <IonButton
                  fill="clear"
                  color="primary"
                  mode="ios"
                  routerLink="/auth/request-password-reset"
                >
                  {t('auth.forgot-password')}
                </IonButton>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>

        <IonLoading isOpen={isLoading} message={t('auth.logging-in')} />
        <IonAlert
          isOpen={!!errorMessage}
          header={t('auth.login-error')}
          message={errorMessage}
          buttons={[t('common.close')]}
          onDidDismiss={() => setErrorMessage('')}
        />
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
