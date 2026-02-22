import {
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePublications } from '../../../api/content.api.ts';

const ContentPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: publications, isLoading, refetch } = usePublications();
  const [showNoData, setShowNoData] = useState(false);

  useEffect(() => {
    if (!isLoading && (!publications || publications.length === 0)) {
      const timer = setTimeout(() => setShowNoData(true), 1000);
      return () => clearTimeout(timer);
    }
    setShowNoData(false);
  }, [isLoading, publications]);

  const handleRefresh = async (event: CustomEvent) => {
    await refetch();
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonMenuButton slot="start" menu="m1" />
          <IonTitle>{t('common.library')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="content-container">
          {isLoading && (
            <div className="ion-text-center ion-padding">
              <IonSpinner />
            </div>
          )}
          {!isLoading && showNoData && (
            <div className="ion-text-center ion-padding">
              <p>{t('common.no-data')}</p>
            </div>
          )}
          <IonList>
            {publications?.map((topic) => (
              <IonItem
                key={topic._id}
                detail
                button
                routerLink={`/home/tabs/content/${topic.groupName}`}
              >
                <IonLabel>
                  <h2>{topic.title}</h2>
                  {topic.author && <h3>{topic.author}</h3>}
                  {topic.subtitle && <p>{topic.subtitle}</p>}
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ContentPage;
