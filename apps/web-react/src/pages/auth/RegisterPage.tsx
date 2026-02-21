import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonRow,
  IonText,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonLoading,
} from '@ionic/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.ts';
import {
  EMAIL_EXISTS,
  EMAIL_MISMATCH,
  MIN_PASSWORD_LENGTH,
  TOKEN_INVALID,
} from '../../types/models.ts';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const { register } = useAuth();
  const [presentLoading, dismissLoading] = useIonLoading();
  const [presentAlert] = useIonAlert();

  const params = new URLSearchParams(location.search);
  const emailParam = params.get('email') ?? '';
  const tokenParam = params.get('token') ?? '';
  const langParam = params.get('lang') ?? '';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const isValid = name.length >= 3 && password.length >= MIN_PASSWORD_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    await presentLoading({
      message: t('auth.activating-account'),
      keyboardClose: true,
    });

    try {
      await register(emailParam, password, name, tokenParam);
      await dismissLoading();
      history.replace(`/welcome/${langParam}`);
    } catch (err) {
      await dismissLoading();
      let msgKey = 'auth.registration-failed';
      if (err instanceof Error) {
        switch (err.message) {
          case EMAIL_EXISTS:
            msgKey = 'auth.email-exists';
            break;
          case EMAIL_MISMATCH:
            msgKey = 'auth.code-email-mismatch';
            break;
          case TOKEN_INVALID:
            msgKey = 'auth.code-invalid';
            break;
        }
      }
      await presentAlert({
        header: t('auth.registration-error'),
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
            {t('common.app-name')} {t('auth.register')}
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="content-container">
          <form onSubmit={handleSubmit}>
            <IonGrid>
              <IonRow>
                <IonCol sizeSm="6" offsetSm="3">
                  <IonText>
                    <p>{t('auth.register-message')}</p>
                  </IonText>
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol sizeSm="6" offsetSm="3">
                  <IonList lines="none">
                    <IonItem>
                      <IonInput
                        type="email"
                        label="Email"
                        labelPlacement="floating"
                        errorText={t('auth.email-invalid')}
                        value={emailParam}
                        disabled
                        required
                      />
                    </IonItem>
                    <IonItem>
                      <IonInput
                        type="text"
                        label={t('common.name')}
                        labelPlacement="floating"
                        errorText={t('auth.name-required')}
                        value={name}
                        onIonInput={(e) => setName(e.detail.value ?? '')}
                        required
                        minlength={3}
                        autofocus
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
                    {t('auth.register')}
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

export default RegisterPage;
