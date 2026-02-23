import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonLoading,
  IonPage,
  IonRadio,
  IonRadioGroup,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { type FormEvent, useState } from 'react';
import { useInviteUser } from '../../api/admin.api.ts';
import { ApiError } from '../../api/apiFetch.ts';
import BackButton from '../../components/BackButton.tsx';
import { EMAIL_EXISTS } from '../../types/models.ts';

const AdminNewUserPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [lang, setLang] = useState<string>('nl');
  const inviteUser = useInviteUser();
  const [toast, setToast] = useState<{
    message: string;
    color: string;
  } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    inviteUser.mutate(
      { email, lang },
      {
        onSuccess: (data) => {
          setToast({
            message: `Invitation sent to: ${data.accepted.join(', ')}`,
            color: 'success',
          });
          setEmail('');
        },
        onError: (error) => {
          if (
            error instanceof ApiError &&
            error.body?.message === EMAIL_EXISTS
          ) {
            setToast({
              message: 'This email address is already registered.',
              color: 'danger',
            });
          } else {
            setToast({
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to send invitation.',
              color: 'danger',
            });
          }
        },
      },
    );
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar color="tertiary">
          <IonButtons slot="start">
            <BackButton defaultHref="/admin" />
          </IonButtons>
          <IonTitle>Invite New User</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="content-container">
          <form onSubmit={handleSubmit}>
            <IonList>
              <IonItem>
                <IonInput
                  label="Email"
                  labelPlacement="stacked"
                  type="email"
                  required
                  value={email}
                  onIonInput={(e) => setEmail(e.detail.value ?? '')}
                  placeholder="user@example.com"
                />
              </IonItem>
              <IonRadioGroup
                value={lang}
                onIonChange={(e) => setLang(e.detail.value as string)}
              >
                <IonItem>
                  <IonRadio value="nl">Nederlands</IonRadio>
                </IonItem>
                <IonItem>
                  <IonRadio value="en">English</IonRadio>
                </IonItem>
              </IonRadioGroup>
            </IonList>
            <div className="ion-padding">
              <IonButton expand="block" type="submit" disabled={!email}>
                Send Invitation
              </IonButton>
            </div>
          </form>
        </div>
        <IonLoading isOpen={inviteUser.isPending} message="Sending..." />
        <IonToast
          isOpen={!!toast}
          message={toast?.message ?? ''}
          color={toast?.color}
          duration={3000}
          onDidDismiss={() => setToast(null)}
        />
      </IonContent>
    </IonPage>
  );
};

export default AdminNewUserPage;
