import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { flashOutline } from 'ionicons/icons';
import { useCallback, useEffect } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { useArticle } from '../../../api/content.api.ts';
import ArticleBody from '../../../components/ArticleBody.tsx';
import BackButton from '../../../components/BackButton.tsx';
import { hasFlashCards } from '../../../lib/flashcard.ts';

const ArticlePage: React.FC = () => {
  const { filename } = useParams<{ filename: string }>();
  const { data: article, isLoading } = useArticle(filename);
  const history = useHistory();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const scrollToId = searchParams.get('id');

  // Scroll to element on mount if ?id= param is present
  useEffect(() => {
    if (scrollToId && article) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`_${scrollToId}_`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [scrollToId, article]);

  const showFlashcard = article?.htmlText
    ? hasFlashCards(article.htmlText)
    : false;

  const onClicked = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (target.classList.contains('hashtag')) {
        // Hashtag click — will be handled by HashtagModal (Phase 7)
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (target.tagName === 'SPAN' && target.closest('.text-content')) {
        // Word click — will be handled by WordClickModal (Phase 7)
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    },
    [],
  );

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <BackButton />
          </IonButtons>
          <IonTitle>{article?.title ?? ''}</IonTitle>
          {showFlashcard && (
            <IonButtons slot="end">
              <IonButton
                onClick={() => history.push(`/flashcard/${filename}`)}
              >
                <IonIcon slot="icon-only" icon={flashOutline} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="content-container noselect">
          {isLoading && (
            <div className="ion-text-center ion-padding">
              <IonSpinner />
            </div>
          )}
          {article && (
            <ArticleBody htmlText={article.htmlText} onClicked={onClicked} />
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ArticlePage;
