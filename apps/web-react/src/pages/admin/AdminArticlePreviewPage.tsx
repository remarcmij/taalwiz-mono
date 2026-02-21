import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonAlert,
} from '@ionic/react';
import { trashOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useArticle } from '../../api/content.api.ts';
import { useDeleteTopic } from '../../api/admin.api.ts';

const AdminArticlePreviewPage: React.FC = () => {
  const { filename } = useParams<{ filename: string }>();
  const { data: article, isLoading } = useArticle(filename);
  const deleteTopic = useDeleteTopic();
  const [presentAlert] = useIonAlert();
  const history = useHistory();
  const [isDeleted, setIsDeleted] = useState(false);

  const handleDelete = () => {
    presentAlert({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${article?.title}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            deleteTopic.mutate(filename, {
              onSuccess: () => {
                setIsDeleted(true);
                presentAlert({
                  header: 'Deleted',
                  message: 'Article has been deleted.',
                  buttons: [
                    {
                      text: 'OK',
                      handler: () => history.goBack(),
                    },
                  ],
                });
              },
            });
          },
        },
      ],
    });
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar color="tertiary">
          <IonButtons slot="start">
            <IonBackButton text="" defaultHref="/admin/content" />
          </IonButtons>
          <IonTitle>{article?.title ?? ''}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleDelete} disabled={!article || isDeleted}>
              <IonIcon slot="icon-only" icon={trashOutline} />
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
        {article && (
          <div
            className={`ion-padding${isDeleted ? ' deleted-article' : ''}`}
            style={isDeleted ? { textDecoration: 'line-through' } : undefined}
            dangerouslySetInnerHTML={{ __html: article.htmlText }}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminArticlePreviewPage;
