import {
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import BackButton from '../../../components/BackButton.tsx';
import { usePublicationTopics } from '../../../api/content.api.ts';

const PublicationPage: React.FC = () => {
  const { groupName } = useParams<{ groupName: string }>();
  const { data: topics, isLoading } = usePublicationTopics(groupName);

  const indexTopic = topics?.find((t) => t.type === 'index');
  const articles = topics?.filter((t) => t.type === 'article') ?? [];
  const title = indexTopic?.title ?? 'Publication';

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <BackButton />
          </IonButtons>
          <IonTitle>{title}</IonTitle>
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
            {articles.map((topic) => (
              <IonItem
                key={topic._id}
                detail
                button
                routerLink={`/home/tabs/content/${groupName}/${topic.filename}`}
              >
                <IonLabel>
                  <h2>{topic.title}</h2>
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

export default PublicationPage;
