import {
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  cloudUploadOutline,
  libraryOutline,
  peopleOutline,
  personAddOutline,
  settingsOutline,
} from 'ionicons/icons';
import BackButton from '../../components/BackButton.tsx';

const adminItems = [
  {
    label: 'Invite New User',
    icon: personAddOutline,
    href: '/admin/new-user',
  },
  {
    label: 'Manage Content',
    icon: libraryOutline,
    href: '/admin/content',
  },
  {
    label: 'Manage Users',
    icon: peopleOutline,
    href: '/admin/users',
  },
  {
    label: 'Upload Content',
    icon: cloudUploadOutline,
    href: '/admin/upload',
  },
  {
    label: 'System Settings',
    icon: settingsOutline,
    href: '/admin/system-settings',
  },
];

const AdminPage: React.FC = () => {
  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar color="tertiary">
          <IonButtons slot="start">
            <BackButton />
          </IonButtons>
          <IonTitle>Administrative Tasks</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="content-container">
          <IonList>
            {adminItems.map((item) => (
              <IonItem
                key={item.href}
                detail
                button
                routerLink={item.href}
              >
                <IonIcon slot="start" icon={item.icon} />
                <IonLabel>{item.label}</IonLabel>
              </IonItem>
            ))}
          </IonList>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminPage;
