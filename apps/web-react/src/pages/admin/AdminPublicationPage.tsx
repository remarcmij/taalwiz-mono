import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonPage,
  IonReorder,
  IonReorderGroup,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
  type ItemReorderEventDetail,
  useIonActionSheet,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicationTopics } from '../../api/content.api.ts';
import {
  useDeleteTopic,
  useUpdateSortIndices,
} from '../../api/admin.api.ts';
import BackButton from '../../components/BackButton.tsx';
import type { ITopic } from '../../types/models.ts';

const AdminPublicationPage: React.FC = () => {
  const { groupName } = useParams<{ groupName: string }>();
  const { data: topics, isLoading } = usePublicationTopics(groupName);
  const updateSortIndices = useUpdateSortIndices();
  const deleteTopic = useDeleteTopic();
  const [present] = useIonActionSheet();

  const [orderedItems, setOrderedItems] = useState<ITopic[]>([]);
  const [reorderEnabled, setReorderEnabled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const orderedRef = useRef<ITopic[]>([]);

  const indexTopic = topics?.find((t) => t.type === 'index');
  const title = indexTopic?.title ?? groupName;

  // Sync topics into local state (articles only)
  useEffect(() => {
    if (topics) {
      const articles = topics
        .filter((t) => t.type === 'article')
        .sort((a, b) => a.sortIndex - b.sortIndex);
      setOrderedItems(articles);
      orderedRef.current = articles;
    }
  }, [topics]);

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
        updateSortIndices.mutate(ids, {
          onError: (err) =>
            console.error('Failed to save sort order:', err),
        });
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

  const handleDeleteArticle = (filename: string) => {
    deleteTopic.mutate(filename, {
      onSuccess: () => {
        setOrderedItems((prev) =>
          prev.filter((item) => item.filename !== filename),
        );
        setToast('Article deleted.');
      },
    });
  };

  const handleDeleteAll = async () => {
    const filenames = orderedItems.map((item) => item.filename);
    try {
      await Promise.all(filenames.map((f) => deleteTopic.mutateAsync(f)));
      setOrderedItems([]);
      setToast('All articles deleted.');
    } catch {
      setToast('Some articles could not be deleted.');
    }
  };

  const showOptions = () => {
    present({
      header: 'Publication Options',
      buttons: [
        {
          text: reorderEnabled ? 'Disable Reorder' : 'Enable Reorder',
          handler: () => setReorderEnabled((prev) => !prev),
        },
        {
          text: 'Delete All',
          role: 'destructive',
          handler: () => {
            present({
              header: 'Confirm Delete All',
              subHeader: `Delete all ${orderedItems.length} articles?`,
              buttons: [
                {
                  text: 'Delete All',
                  role: 'destructive',
                  handler: handleDeleteAll,
                },
                { text: 'Cancel', role: 'cancel' },
              ],
            });
          },
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
  };

  const handleUndo = useCallback(() => {
    if (topics) {
      const articles = topics
        .filter((t) => t.type === 'article')
        .sort((a, b) => a.sortIndex - b.sortIndex);
      setOrderedItems(articles);
      setIsDirty(false);
    }
  }, [topics]);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar color="tertiary">
          <IonButtons slot="start">
            <BackButton defaultHref="/admin/content" />
          </IonButtons>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            {reorderEnabled && isDirty && (
              <IonButton onClick={handleUndo}>Undo</IonButton>
            )}
            <IonButton onClick={showOptions}>Options</IonButton>
          </IonButtons>
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
            <IonReorderGroup
              disabled={!reorderEnabled}
              onIonItemReorder={handleReorder}
            >
              {orderedItems.map((topic) => (
                <IonItemSliding key={topic._id}>
                  <IonItem
                    detail={!reorderEnabled}
                    button={!reorderEnabled}
                    routerLink={
                      reorderEnabled
                        ? undefined
                        : `/admin/content/article/${topic.filename}`
                    }
                  >
                    <IonLabel>
                      <h2>{topic.title}</h2>
                      {topic.subtitle && <p>{topic.subtitle}</p>}
                    </IonLabel>
                    <IonReorder slot="end" />
                  </IonItem>
                  <IonItemOptions side="end">
                    <IonItemOption
                      color="danger"
                      onClick={() => handleDeleteArticle(topic.filename)}
                    >
                      Delete
                    </IonItemOption>
                  </IonItemOptions>
                </IonItemSliding>
              ))}
            </IonReorderGroup>
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

export default AdminPublicationPage;
