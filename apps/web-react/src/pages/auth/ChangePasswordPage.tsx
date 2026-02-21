import {
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
  IonToolbar,
  useIonAlert,
} from '@ionic/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { changePasswordRequest } from '../../api/auth.api.ts';
import BackButton from '../../components/BackButton.tsx';
import { HOME_URL } from '../../context/AuthContext.tsx';
import { useAuth } from '../../hooks/useAuth.ts';
import { MIN_PASSWORD_LENGTH } from '../../types/models.ts';

const ChangePasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { user } = useAuth();
  const [presentAlert] = useIonAlert();

  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isValid =
    password.length >= MIN_PASSWORD_LENGTH &&
    newPassword.length >= MIN_PASSWORD_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !user) return;

    setIsLoading(true);
    try {
      await changePasswordRequest(user.email, password, newPassword);
      setIsLoading(false);
      await presentAlert({
        header: t('auth.password-changed'),
        message: t('auth.password-change-success'),
        buttons: [t('common.close')],
      });
      setPassword('');
      setNewPassword('');
      history.replace(HOME_URL);
    } catch {
      setIsLoading(false);
      await presentAlert({
        header: t('auth.password-change-error'),
        message: t('auth.password-change-failed'),
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
          <IonTitle>{t('auth.change-password')}</IonTitle>
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
                        type="password"
                        label={t('auth.current-password')}
                        labelPlacement="floating"
                        errorText={t('auth.password-invalid')}
                        value={password}
                        onIonInput={(e) => setPassword(e.detail.value ?? '')}
                        required
                        minlength={MIN_PASSWORD_LENGTH}
                      />
                    </IonItem>
                    <IonItem>
                      <IonInput
                        type="password"
                        label={t('auth.new-password')}
                        labelPlacement="floating"
                        errorText={t('auth.password-invalid')}
                        value={newPassword}
                        onIonInput={(e) => setNewPassword(e.detail.value ?? '')}
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
                    disabled={!isValid || isLoading}
                  >
                    {t('auth.change-password')}
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

export default ChangePasswordPage;
