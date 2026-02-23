import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
  useIonActionSheet,
} from '@ionic/react';
import { trashOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useDeleteUser, useUsers } from '../../api/admin.api.ts';

const formatDate = (date: Date | string | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const AdminUsersPage: React.FC = () => {
  const { data: users, isLoading } = useUsers();
  const deleteUser = useDeleteUser();
  const [present] = useIonActionSheet();
  const [toast, setToast] = useState<string | null>(null);

  const nonAdminUsers = (users ?? [])
    .filter((u) => !u.roles.includes('admin'))
    .sort((a, b) => a.email.localeCompare(b.email));

  const handleDelete = (userId: string, email: string) => {
    present({
      header: 'Delete User',
      subHeader: `Are you sure you want to delete ${email}?`,
      buttons: [
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            deleteUser.mutate(userId, {
              onSuccess: () => {
                setToast(`User ${email} deleted successfully.`);
              },
              onError: () => {
                setToast('Failed to delete. Please try again.');
              },
            });
          },
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar color="tertiary">
          <IonButtons slot="start">
            <IonBackButton text="" defaultHref="/admin" />
          </IonButtons>
          <IonTitle>User Accounts</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="content-container">
          {isLoading && (
            <div className="ion-text-center ion-padding">
              <IonSpinner />
            </div>
          )}
          <IonList>
            {nonAdminUsers.map((user) => (
              <IonItemSliding key={user.id}>
                <IonItem>
                  <IonLabel>
                    <h2>{user.email}</h2>
                    <h3>{user.name}</h3>
                    <p>
                      Created: {formatDate(user.created)} | Last access:{' '}
                      {formatDate(user.lastAccessed)}
                    </p>
                  </IonLabel>
                </IonItem>
                <IonItemOptions side="end">
                  <IonItemOption
                    color="danger"
                    onClick={() => handleDelete(user.id, user.email)}
                  >
                    <IonIcon slot="icon-only" icon={trashOutline} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
        </div>
        <IonToast
          isOpen={!!toast}
          message={toast ?? ''}
          duration={3000}
          onDidDismiss={() => setToast(null)}
        />
      </IonContent>
    </IonPage>
  );
};

export default AdminUsersPage;
