import {
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { arrowForwardOutline } from 'ionicons/icons';
import { useFindHashtag } from '../api/hashtags.api.ts';

interface HashtagModalProps {
  hashtagName: string;
  currentFilename?: string;
  onDismiss: () => void;
  onNavigate: (filename: string, id?: string) => void;
}

const HashtagModal: React.FC<HashtagModalProps> = ({
  hashtagName,
  currentFilename,
  onDismiss,
  onNavigate,
}) => {
  const { data: hashtags, isLoading } = useFindHashtag(hashtagName);

  const handleClick = (filename: string, sectionHeader: string) => {
    onDismiss();
    const id = sectionHeader
      ? sectionHeader.toLowerCase().replace(/\s+/g, '-')
      : undefined;
    onNavigate(filename, id);
  };

  return (
    <>
      <IonToolbar>
        <IonTitle>#{hashtagName}</IonTitle>
      </IonToolbar>
      <IonContent>
        {isLoading && (
          <div className="ion-text-center ion-padding">
            <IonSpinner />
          </div>
        )}
        <IonList>
          {hashtags?.map((tag, i) => (
            <IonItem
              key={i}
              button
              detail={false}
              onClick={() => handleClick(tag.filename, tag.sectionHeader)}
            >
              <IonLabel>
                <p>{tag.publicationTitle}</p>
                <h3>{tag.articleTitle}</h3>
                {tag.sectionHeader && <p>{tag.sectionHeader}</p>}
              </IonLabel>
              {tag.filename === currentFilename && (
                <IonIcon slot="end" icon={arrowForwardOutline} />
              )}
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </>
  );
};

export default HashtagModal;
