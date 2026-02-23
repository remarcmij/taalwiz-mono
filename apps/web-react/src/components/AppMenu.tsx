import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  informationCircleOutline,
  logOutOutline,
  mailOutline,
  reloadOutline,
  shieldHalfOutline,
  rocketOutline,
} from 'ionicons/icons';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

const LAST_URL_KEY = 'lastUrl';

const AppMenu: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();

  // Save last URL to localStorage
  useEffect(() => {
    localStorage.setItem(LAST_URL_KEY, location.pathname + location.search);
  }, [location]);

  const handleLogout = () => {
    logout();
    history.push('/auth');
  };

  const reload = () => {
    document.location.reload();
  };

  return (
    <IonMenu side="start" menuId="m1" contentId="main-content">
      <IonHeader>
        <IonToolbar>
          <IonTitle>TaalWiz</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonListHeader>
            <IonLabel>
              <h1>{user?.name ?? ''}</h1>
              <h2>{user?.email ?? ''}</h2>
            </IonLabel>
          </IonListHeader>

          <IonMenuToggle menu="m1">
            <IonItem
              detail
              button
              lines="none"
              routerLink={`/about/${user?.lang ?? 'nl'}`}
            >
              <IonIcon slot="start" icon={informationCircleOutline} />
              <IonLabel>{t('common.about')}</IonLabel>
            </IonItem>
          </IonMenuToggle>

          {user && !user.roles.includes('demo') && (
            <IonMenuToggle menu="m1">
              <IonItem
                detail
                button
                lines="none"
                routerLink="/auth/change-password"
              >
                <IonIcon slot="start" icon={shieldHalfOutline} />
                <IonLabel>{t('auth.change-password')}</IonLabel>
              </IonItem>
            </IonMenuToggle>
          )}

          <IonMenuToggle menu="m1">
            <IonItem detail button lines="none" routerLink="/contact">
              <IonIcon slot="start" icon={mailOutline} />
              <IonLabel>{t('user.contact')}</IonLabel>
            </IonItem>
          </IonMenuToggle>

          <IonMenuToggle menu="m1">
            <IonItem button lines="none" onClick={reload}>
              <IonIcon slot="start" icon={reloadOutline} />
              <IonLabel>{t('common.reload')}</IonLabel>
            </IonItem>
          </IonMenuToggle>

          <IonMenuToggle menu="m1">
            <IonItem button lines="none" onClick={handleLogout}>
              <IonIcon slot="start" icon={logOutOutline} />
              <IonLabel>{t('auth.logout')}</IonLabel>
            </IonItem>
          </IonMenuToggle>

          {isAdmin && (
            <>
              <IonListHeader>
                <IonLabel>
                  <h2>Administrator Only</h2>
                </IonLabel>
              </IonListHeader>
              <IonMenuToggle menu="m1">
                <IonItem detail button lines="none" routerLink="/admin">
                  <IonIcon slot="start" icon={rocketOutline} />
                  <IonLabel>Administrative Tasks</IonLabel>
                </IonItem>
              </IonMenuToggle>
            </>
          )}
        </IonList>
      </IonContent>
    </IonMenu>
  );
};

export default AppMenu;
