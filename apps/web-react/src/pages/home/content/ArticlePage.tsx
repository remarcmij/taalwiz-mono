import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { flashOutline } from 'ionicons/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { useArticle } from '../../../api/content.api.ts';
import ArticleBody from '../../../components/ArticleBody.tsx';
import BackButton from '../../../components/BackButton.tsx';
import HashtagModal from '../../../components/HashtagModal.tsx';
import WordClickModal from '../../../components/WordClickModal.tsx';
import { hasFlashCards } from '../../../lib/flashcard.ts';
import { useWordClickModal } from '../../../hooks/useWordClickModal.ts';

const ArticlePage: React.FC = () => {
  const { groupName, filename } = useParams<{
    groupName: string;
    filename: string;
  }>();
  const { data: article, isLoading } = useArticle(filename);
  const history = useHistory();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const scrollToId = searchParams.get('id');

  const { modalData, onClicked: handleWordClick, dismissModal: dismissWordModal } =
    useWordClickModal();
  const wordModalRef = useRef<HTMLIonModalElement>(null);

  const [hashtagName, setHashtagName] = useState<string | null>(null);
  const hashtagModalRef = useRef<HTMLIonModalElement>(null);

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
        event.preventDefault();
        event.stopPropagation();
        const name = target.textContent?.replace(/^#/, '').trim();
        if (name) {
          setHashtagName(name);
        }
        return;
      }

      if (target.tagName === 'SPAN' && target.closest('.text-content')) {
        event.preventDefault();
        event.stopPropagation();
        handleWordClick(event);
        return;
      }
    },
    [handleWordClick],
  );

  const handleDictionaryLookup = useCallback(
    (word: string, lang: string) => {
      history.push(`/home/tabs/dictionary/${lang}/${word}`);
    },
    [history],
  );

  const handleHashtagNavigate = useCallback(
    (targetFilename: string, id?: string) => {
      if (targetFilename === filename && id) {
        // Same article — just scroll
        const el = document.getElementById(`_${id}_`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        const url = `/home/tabs/content/${groupName}/${targetFilename}${id ? `?id=${id}` : ''}`;
        history.push(url);
      }
    },
    [filename, groupName, history],
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

        {/* Word Click Modal */}
        <IonModal
          ref={wordModalRef}
          isOpen={modalData !== null}
          initialBreakpoint={0.25}
          breakpoints={[0, 0.25, 0.5]}
          handleBehavior="cycle"
          onDidDismiss={dismissWordModal}
        >
          {modalData && (
            <WordClickModal
              clickedWord={modalData.clickedWord}
              word={modalData.word}
              lang={modalData.lang}
              sentence={modalData.sentence}
              lemmas={modalData.lemmas}
              onDismiss={() => wordModalRef.current?.dismiss()}
              onDictionaryLookup={handleDictionaryLookup}
            />
          )}
        </IonModal>

        {/* Hashtag Modal */}
        <IonModal
          ref={hashtagModalRef}
          isOpen={hashtagName !== null}
          initialBreakpoint={0.25}
          breakpoints={[0, 0.25, 0.5]}
          handleBehavior="cycle"
          onDidDismiss={() => setHashtagName(null)}
        >
          {hashtagName && (
            <HashtagModal
              hashtagName={hashtagName}
              currentFilename={filename}
              onDismiss={() => hashtagModalRef.current?.dismiss()}
              onNavigate={handleHashtagNavigate}
            />
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default ArticlePage;
