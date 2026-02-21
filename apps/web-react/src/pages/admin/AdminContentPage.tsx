import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonReorder,
  IonReorderGroup,
  IonSpinner,
  IonTitle,
  IonToolbar,
  type ItemReorderEventDetail,
  useIonActionSheet,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePublications } from '../../api/content.api.ts';
import { useUpdateSortIndices } from '../../api/admin.api.ts';
import BackButton from '../../components/BackButton.tsx';
import type { ITopic } from '../../types/models.ts';

const AdminContentPage: React.FC = () => {
  const { data: publications, isLoading } = usePublications();
  const updateSortIndices = useUpdateSortIndices();
  const [present] = useIonActionSheet();

  const [orderedItems, setOrderedItems] = useState<ITopic[]>([]);
  const [reorderEnabled, setReorderEnabled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);
  const orderedRef = useRef<ITopic[]>([]);

  // Sync publications into local state
  useEffect(() => {
    if (publications) {
      const sorted = [...publications].sort(
        (a, b) => a.sortIndex - b.sortIndex,
      );
      setOrderedItems(sorted);
      orderedRef.current = sorted;
    }
  }, [publications]);

  // Keep refs in sync
  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    orderedRef.current = orderedItems;
  }, [orderedItems]);

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        const ids = orderedRef.current.map((item) => item._id);
        updateSortIndices.mutate(ids);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReorder = useCallback(
    (event: CustomEvent<ItemReorderEventDetail>) => {
      const reordered = event.detail.complete([...orderedItems]) as ITopic[];
      setOrderedItems(reordered);
      setIsDirty(true);
    },
    [orderedItems],
  );

  const handleUndo = useCallback(() => {
    if (publications) {
      const sorted = [...publications].sort(
        (a, b) => a.sortIndex - b.sortIndex,
      );
      setOrderedItems(sorted);
      setIsDirty(false);
    }
  }, [publications]);

  const toggleReorder = () => {
    present({
      header: 'Content Options',
      buttons: [
        {
          text: reorderEnabled ? 'Disable Reorder' : 'Enable Reorder',
          handler: () => setReorderEnabled((prev) => !prev),
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
            <BackButton defaultHref="/admin" />
          </IonButtons>
          <IonTitle>Manage Content</IonTitle>
          <IonButtons slot="end">
            {reorderEnabled && isDirty && (
              <IonButton onClick={handleUndo}>Undo</IonButton>
            )}
            <IonButton onClick={toggleReorder}>
              {reorderEnabled ? 'Done' : 'Reorder'}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {isLoading && (
          <div className="ion-text-center ion-padding">
            <IonSpinner />
          </div>
        )}
        <IonList>
          <IonReorderGroup
            disabled={!reorderEnabled}
            onIonItemReorder={handleReorder}
          >
            {orderedItems.map((topic) => (
              <IonItem
                key={topic._id}
                detail={!reorderEnabled}
                button={!reorderEnabled}
                routerLink={
                  reorderEnabled
                    ? undefined
                    : `/admin/content/${topic.groupName}`
                }
              >
                <IonLabel>
                  <h2>{topic.title}</h2>
                  {topic.author && <h3>{topic.author}</h3>}
                  {topic.subtitle && <p>{topic.subtitle}</p>}
                </IonLabel>
                <IonReorder slot="end" />
              </IonItem>
            ))}
          </IonReorderGroup>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default AdminContentPage;
