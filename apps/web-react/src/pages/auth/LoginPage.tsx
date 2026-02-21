import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonPage,
  IonRow,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonLoading,
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
  const [presentLoading, dismissLoading] = useIonLoading();
  const [presentAlert] = useIonAlert();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isValid = email.includes('@') && password.length >= MIN_PASSWORD_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    await presentLoading({ message: t('auth.logging-in'), keyboardClose: true });

    try {
      await login(email, password);
      await dismissLoading();
      setEmail('');
      setPassword('');
      history.replace(HOME_URL);
    } catch (err) {
      await dismissLoading();
      const msgKey =
        err instanceof Error && err.message === AUTH_FAILED
          ? 'auth.auth-failed'
          : 'auth.login-failed';
      await presentAlert({
        header: t('auth.login-error'),
        message: t(msgKey),
        buttons: [t('common.close')],
      });
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
          <form onSubmit={handleSubmit}>
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
                    type="submit"
                    color="primary"
                    expand="block"
                    disabled={!isValid}
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
          </form>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
