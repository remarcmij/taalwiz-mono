import {
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonPage,
  IonRow,
  IonTextarea,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonLoading,
} from '@ionic/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { apiFetch } from '../../api/apiFetch.ts';
import BackButton from '../../components/BackButton.tsx';
import { HOME_URL } from '../../context/AuthContext.tsx';
import { useAuth } from '../../hooks/useAuth.ts';

const ContactPage: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { user, getAccessToken } = useAuth();
  const [presentLoading, dismissLoading] = useIonLoading();
  const [presentAlert] = useIonAlert();

  const [message, setMessage] = useState('');

  const isValid = message.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !user) return;

    await presentLoading({
      message: t('auth.logging-in'),
      keyboardClose: true,
    });

    try {
      await apiFetch('/api/v1/users/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, email: user.email }),
        getToken: getAccessToken,
      });
      await dismissLoading();
      setMessage('');
      await presentAlert({
        header: t('user.contact'),
        message: t('user.contact-sent'),
        buttons: [t('common.close')],
      });
      history.replace(HOME_URL);
    } catch {
      await dismissLoading();
      await presentAlert({
        header: t('user.contact'),
        message: t('user.contact-failed'),
        buttons: [t('common.close')],
      });
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <BackButton />
          </IonButtons>
          <IonTitle>{t('user.contact')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="content-container">
          <form onSubmit={handleSubmit}>
            <IonGrid>
              <IonRow>
                <IonCol sizeSm="6" offsetSm="3" className="ion-margin">
                  {t('user.contact-header')}
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol sizeSm="6" offsetSm="3">
                  <IonTextarea
                    aria-label="Message"
                    mode="md"
                    fill="outline"
                    autoGrow
                    value={message}
                    onIonInput={(e) => setMessage(e.detail.value ?? '')}
                    placeholder={t('user.contact-placeholder')}
                  />
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol
                  sizeSm="6"
                  offsetSm="3"
                  className="ion-text-center ion-padding"
                >
                  <IonButton type="submit" disabled={!isValid}>
                    {t('common.send')}
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

export default ContactPage;
