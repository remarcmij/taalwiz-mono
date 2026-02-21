import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonTitle,
  IonToolbar,
  useIonModal,
} from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHashtagIndex } from '../../../api/hashtags.api.ts';
import HashtagModal from '../../../components/HashtagModal.tsx';
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts';

const HashtagsPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: hashtagGroups, refetch } = useHashtagIndex();
  const isDesktop = useMediaQuery('(min-width: 992px)');
  const [giveUpWaiting, setGiveUpWaiting] = useState(false);
  const [selectedHashtag, setSelectedHashtag] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setGiveUpWaiting(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = useCallback(
    (event?: CustomEvent) => {
      refetch().then(() => {
        (event?.detail as { complete: () => void })?.complete();
      });
    },
    [refetch],
  );

  const [presentModal, dismissModal] = useIonModal(HashtagModal, {
    hashtagName: selectedHashtag,
    onDismiss: () => dismissModal(),
    onNavigate: () => dismissModal(),
  });

  const openModal = useCallback(
    (hashtagName: string) => {
      setSelectedHashtag(hashtagName);
      setTimeout(() => {
        presentModal({
          initialBreakpoint: 0.5,
          breakpoints: [0, 0.25, 0.5, 0.75],
          handleBehavior: 'cycle',
        });
      }, 0);
    },
    [presentModal],
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton menu="m1" />
          </IonButtons>
          <IonTitle>Hashtags</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="content-container">
          <IonList lines="none">
            {hashtagGroups && hashtagGroups.length > 0 ? (
              hashtagGroups.map((group) => (
                <IonItem key={group._id} className="ion-no-padding">
                  <IonCard className="hashtag-card">
                    <IonCardHeader>
                      <IonCardTitle>{group._id}</IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      {group.tags.map((tag) => (
                        <IonChip key={tag.name} onClick={() => openModal(tag.name)}>
                          <IonLabel>{tag.name}</IonLabel>
                        </IonChip>
                      ))}
                    </IonCardContent>
                  </IonCard>
                </IonItem>
              ))
            ) : giveUpWaiting ? (
              <>
                <IonText color="medium" className="ion-text-center">
                  <h2>{t('common.no-data')}</h2>
                </IonText>
                {isDesktop && (
                  <div className="ion-text-center">
                    <IonButton onClick={() => handleRefresh()}>
                      {t('common.retry')}
                    </IonButton>
                  </div>
                )}
              </>
            ) : null}
          </IonList>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default HashtagsPage;
