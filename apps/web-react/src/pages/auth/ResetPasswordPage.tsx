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
  IonPage,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonLoading,
} from '@ionic/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { resetPasswordRequest } from '../../api/auth.api.ts';
import { MIN_PASSWORD_LENGTH } from '../../types/models.ts';

const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const [presentLoading, dismissLoading] = useIonLoading();
  const [presentAlert] = useIonAlert();

  const params = new URLSearchParams(location.search);
  const emailParam = params.get('email') ?? '';
  const tokenParam = params.get('token') ?? '';

  const [password, setPassword] = useState('');

  const isValid = password.length >= MIN_PASSWORD_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    await presentLoading({ message: t('auth.sending'), keyboardClose: true });

    try {
      await resetPasswordRequest(password, tokenParam);
      await dismissLoading();
      await presentAlert({
        header: t('auth.password-reset'),
        message: t('auth.password-reset-success'),
        buttons: [
          {
            text: t('common.close'),
            handler: () => {
              history.replace('/auth');
            },
          },
        ],
      });
    } catch (err) {
      await dismissLoading();
      await presentAlert({
        header: 'Error',
        message: err instanceof Error ? err.message : 'Unknown error',
        buttons: ['OK'],
      });
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>{t('common.app-name')}</IonTitle>
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
                        value={emailParam}
                        disabled
                        required
                      />
                    </IonItem>
                    <IonItem>
                      <IonInput
                        type="password"
                        label={t('auth.new-password')}
                        labelPlacement="floating"
                        errorText={t('auth.password-invalid')}
                        value={password}
                        onIonInput={(e) => setPassword(e.detail.value ?? '')}
                        required
                        autofocus
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
                    {t('auth.password-reset')}
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

export default ResetPasswordPage;
