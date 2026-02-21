import {
  IonBackButton,
  IonButton,
  IonButtons,
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
  IonToast,
  IonToolbar,
  useIonAlert,
  useIonLoading,
} from '@ionic/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { requestPasswordResetRequest } from '../../api/auth.api.ts';

const RequestPasswordResetPage: React.FC = () => {
  const { t } = useTranslation();
  const [presentLoading, dismissLoading] = useIonLoading();
  const [presentAlert] = useIonAlert();

  const [email, setEmail] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);

  const isValid = email.includes('@');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    await presentLoading({ message: t('auth.sending'), keyboardClose: true });

    try {
      await requestPasswordResetRequest(email);
      await dismissLoading();
      setEmail('');
      setIsToastOpen(true);
    } catch (err) {
      await dismissLoading();
      const msgKey =
        err instanceof Error && err.message === 'EMAIL_NOT_FOUND'
          ? 'auth.email-not-found'
          : 'common.something-went-wrong';
      await presentAlert({
        header: t('auth.password-reset'),
        message: t(msgKey),
        buttons: [t('common.close')],
      });
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton text="" defaultHref="/auth" />
          </IonButtons>
          <IonTitle>{t('auth.password-reset')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="content-container">
          <p className="ion-padding">
            {t('auth.password-reset-instructions')}
          </p>
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
                    {t('common.send')}
                  </IonButton>
                </IonCol>
              </IonRow>
            </IonGrid>
          </form>
          <IonToast
            isOpen={isToastOpen}
            message={t('auth.password-reset-request-sent')}
            duration={5000}
            onDidDismiss={() => setIsToastOpen(false)}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default RequestPasswordResetPage;
