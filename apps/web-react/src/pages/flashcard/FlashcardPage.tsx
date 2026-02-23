import {
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonFooter,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonPage,
  IonProgressBar,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  refreshOutline,
  shuffleOutline,
  volumeHighOutline,
  volumeMuteOutline,
} from 'ionicons/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Swiper as SwiperType } from 'swiper';
import { Navigation } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

import 'swiper/css';
import 'swiper/css/navigation';

import { useArticle } from '../../api/content.api.ts';
import BackButton from '../../components/BackButton.tsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.ts';
import { useSpeechSynthesizer } from '../../hooks/useSpeechSynthesizer.ts';
import {
  extractFlashcards,
  formatFlashcard,
  shuffle,
} from '../../lib/flashcard.ts';
import type {
  Flashcard,
  FlashcardMode,
  FlashcardSection,
} from '../../types/models.ts';

const FlashcardPage: React.FC = () => {
  const { t } = useTranslation();
  const { filename } = useParams<{ filename: string }>();
  const { data: article } = useArticle(filename);
  const isDesktop = useMediaQuery('(min-width: 992px)');
  const { speakSingle } = useSpeechSynthesizer();

  const swiperRef = useRef<SwiperType | null>(null);

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [progress, setProgress] = useState(0);
  const [flashcardMode, setFlashcardMode] = useState<FlashcardMode>('foreignFirst');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const flashcardSections: FlashcardSection[] = useMemo(() => {
    if (!article?.mdText) return [];
    return extractFlashcards(article.mdText);
  }, [article]);

  const prepareFlashcards = useCallback(
    (sections: FlashcardSection[], secIdx: number, mode: FlashcardMode) => {
      if (sections.length === 0) return;
      const section = sections[secIdx];
      if (!section) return;
      const cards = section.flashcards.map((fc) =>
        formatFlashcard(fc, 'nl-NL', 'id-ID', mode),
      );
      setFlashcards(cards);
      setProgress(0);
      setActiveIndex(0);
      if (swiperRef.current) {
        swiperRef.current.slideTo(0, 0);
      }
    },
    [],
  );

  // Initialize flashcards when article loads
  useEffect(() => {
    if (flashcardSections.length > 0) {
      prepareFlashcards(flashcardSections, sectionIndex, flashcardMode);
    }
  }, [flashcardSections, sectionIndex, flashcardMode, prepareFlashcards]);

  const onSlideChange = useCallback(
    (swiper: SwiperType) => {
      setActiveIndex(swiper.activeIndex);
      const cardIndex = Math.floor(swiper.activeIndex / 2);
      const totalCards = flashcards.length;
      setProgress(totalCards > 0 ? cardIndex / (totalCards - 1 || 1) : 0);

      // Auto-speak Indonesian text
      if (isSpeaking && flashcards.length > 0) {
        const cardIndex = Math.floor(swiper.activeIndex / 2);
        const isAnswer = swiper.activeIndex % 2 === 1;
        const card = flashcards[cardIndex];
        if (card) {
          const text = isAnswer ? card.answer.text : card.prompt.text;
          const lang = isAnswer ? card.answer.lang : card.prompt.lang;
          if (lang === 'id-ID') {
            speakSingle(text, lang);
          }
        }
      }
    },
    [isSpeaking, flashcards, speakSingle],
  );

  const handleSectionChange = useCallback(
    (e: CustomEvent) => {
      const newIndex = (e.detail as { value: number }).value;
      setSectionIndex(newIndex);
      prepareFlashcards(flashcardSections, newIndex, flashcardMode);
    },
    [flashcardSections, flashcardMode, prepareFlashcards],
  );

  const toggleLanguage = useCallback(() => {
    setFlashcardMode((mode) =>
      mode === 'foreignFirst' ? 'nativeFirst' : 'foreignFirst',
    );
  }, []);

  const handleShuffle = useCallback(() => {
    setFlashcards((prev) => shuffle([...prev]));
    setProgress(0);
    setActiveIndex(0);
    if (swiperRef.current) {
      swiperRef.current.slideTo(0, 0);
    }
  }, []);

  const handleRestart = useCallback(() => {
    setProgress(0);
    setActiveIndex(0);
    if (swiperRef.current) {
      swiperRef.current.slideTo(0, 0);
    }
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <BackButton />
          </IonButtons>
          <IonTitle>Flashcards</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonGrid>
          <IonRow>
            <IonCol>
              <IonItem>
                <IonText className="ion-text-center">
                  <h3>{article?.title}</h3>
                </IonText>
              </IonItem>
              <IonItem className="ion-text-center" lines="none">
                <IonSelect
                  interface="action-sheet"
                  aria-label="flashcard section"
                  cancelText={t('common.close')}
                  value={sectionIndex}
                  onIonChange={handleSectionChange}
                >
                  {flashcardSections.map((section, i) => (
                    <IonSelectOption key={i} value={i}>
                      {section.title}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </IonCol>
          </IonRow>
          <IonRow>
            <IonCol sizeMd="8" offsetMd="2" sizeLg="6" offsetLg="3">
              <Swiper
                modules={[Navigation]}
                navigation={isDesktop}
                onSwiper={(swiper) => {
                  swiperRef.current = swiper;
                }}
                onSlideChange={onSlideChange}
                style={
                  !isDesktop
                    ? ({ '--swiper-navigation-size': '0px' } as React.CSSProperties)
                    : undefined
                }
              >
                {flashcards.flatMap((flashcard) => [
                  <SwiperSlide key={`${flashcard.key}-prompt`}>
                    <div
                      className="flashcard"
                      style={{
                        backgroundColor: '#ffa2ca',
                        padding: '2rem',
                        minHeight: '200px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: '8px',
                      }}
                    >
                      <IonText
                        className={
                          flashcardMode === 'foreignFirst'
                            ? 'foreign-text'
                            : undefined
                        }
                      >
                        <h2 className="ion-text-center">
                          {flashcard.prompt.text}
                        </h2>
                      </IonText>
                      <IonText
                        style={{ opacity: 0.3 }}
                        className={
                          flashcardMode === 'nativeFirst'
                            ? 'foreign-text'
                            : undefined
                        }
                      >
                        <h2 className="ion-text-center">&hellip;</h2>
                      </IonText>
                    </div>
                  </SwiperSlide>,
                  <SwiperSlide key={`${flashcard.key}-answer`}>
                    <div
                      className="flashcard"
                      style={{
                        backgroundColor: '#ffa2ca',
                        padding: '2rem',
                        minHeight: '200px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: '8px',
                      }}
                    >
                      <IonText
                        style={{ opacity: 0.3 }}
                        className={
                          flashcardMode === 'foreignFirst'
                            ? 'foreign-text'
                            : undefined
                        }
                      >
                        <h2 className="ion-text-center">
                          {flashcard.prompt.text}
                        </h2>
                      </IonText>
                      <IonText
                        color="dark"
                        className={
                          flashcardMode === 'nativeFirst'
                            ? 'foreign-text'
                            : undefined
                        }
                      >
                        <h2 className="ion-text-center">
                          {flashcard.answer.text}
                        </h2>
                      </IonText>
                    </div>
                  </SwiperSlide>,
                ])}
              </Swiper>
              <div style={{ padding: '8px 0' }}>
                <IonProgressBar value={progress} />
              </div>
            </IonCol>
          </IonRow>
          {!isDesktop && activeIndex === 0 && (
            <IonRow className="ion-margin-top">
              <IonCol
                sizeMd="8"
                offsetMd="2"
                sizeLg="6"
                offsetLg="3"
                className="ion-text-center"
              >
                <IonText color="medium">
                  <h4>{t('flashcards.swipe')}</h4>
                </IonText>
              </IonCol>
            </IonRow>
          )}
        </IonGrid>
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton disabled={activeIndex === 0} onClick={handleRestart}>
              <IonIcon slot="icon-only" icon={refreshOutline} />
            </IonButton>
            <IonButton onClick={handleShuffle}>
              <IonIcon slot="icon-only" icon={shuffleOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={toggleLanguage}>
              {flashcardMode === 'foreignFirst' ? 'id\u25B6nl' : 'nl\u25B6id'}
            </IonButton>
            <IonButton onClick={() => setIsSpeaking(!isSpeaking)}>
              {isSpeaking ? (
                <IonIcon slot="icon-only" icon={volumeHighOutline} />
              ) : (
                <IonIcon slot="icon-only" icon={volumeMuteOutline} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
};

export default FlashcardPage;
