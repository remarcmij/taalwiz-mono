import {
  IonBreadcrumb,
  IonBreadcrumbs,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonItem,
  IonList,
  IonMenuButton,
  IonModal,
  IonSearchbar,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import LemmaCard from '../../../components/LemmaCard.tsx';
import WordClickModal from '../../../components/WordClickModal.tsx';
import SearchbarDropdown from '../../../components/SearchbarDropdown.tsx';
import { useDictionary } from '../../../hooks/useDictionary.ts';
import { useWordClickModal } from '../../../hooks/useWordClickModal.ts';
import { WordLang } from '../../../types/models.ts';

const MAX_RECENT_SEARCHES = 4;

const DictionaryPage: React.FC = () => {
  const { t } = useTranslation();
  const { lang: paramLang, word: paramWord } = useParams<{ lang?: string; word?: string }>();
  const { result, lookup, getSuggestions } = useDictionary();
  const { modalData, onClicked: handleWordClick, dismissModal: dismissWordModal } =
    useWordClickModal();
  const wordModalRef = useRef<HTMLIonModalElement>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);

  const [word, setWord] = useState('');
  const [suggestions, setSuggestions] = useState<{ word: string; lang: string }[]>([]);
  const [showSearches, setShowSearches] = useState(false);
  const [recentSearches, setRecentSearches] = useState<WordLang[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const addRecentSearch = useCallback((wordLang: WordLang) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((v) => v.key !== wordLang.key);
      filtered.push(wordLang);
      if (filtered.length > MAX_RECENT_SEARCHES) {
        filtered.shift();
      }
      return filtered;
    });
  }, []);

  const handleLookup = useCallback(
    (target: WordLang) => {
      setShowSearches(false);
      setSuggestions([]);
      setWord(target.word);
      addRecentSearch(target);
      lookup(target);
      contentRef.current?.scrollToTop();
    },
    [lookup, addRecentSearch],
  );

  // Trigger lookup from route params (e.g. navigating from word click modal)
  useEffect(() => {
    if (paramWord && paramLang) {
      handleLookup(new WordLang(paramWord, paramLang));
    }
  }, [paramWord, paramLang]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleItemClicked = useCallback(
    (selectedWord: string, lang: string) => {
      handleLookup(new WordLang(selectedWord, lang));
    },
    [handleLookup],
  );

  const handleInput = useCallback(
    (value: string) => {
      setWord(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value) {
        setSuggestions([]);
        setShowSearches(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        try {
          const results = await getSuggestions(value);
          const mapped = results.map((s: { word: string; lang: string }) => ({
            word: s.word,
            lang: s.lang,
          }));
          setSuggestions(mapped);
          setShowSearches(mapped.length > 0);
        } catch {
          setSuggestions([]);
          setShowSearches(false);
        }
      }, 250);
    },
    [getSuggestions],
  );

  const handleClear = useCallback(() => {
    setSuggestions([]);
    setShowSearches(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && suggestions.length > 0) {
        handleItemClicked(suggestions[0]!.word, suggestions[0]!.lang);
      }
    },
    [suggestions, handleItemClicked],
  );

  const handleLemmaClicked = useCallback(
    (e: React.MouseEvent) => {
      handleWordClick(e.nativeEvent);
    },
    [handleWordClick],
  );

  const handleDictionaryLookup = useCallback(
    (lookupWord: string, lang: string) => {
      handleLookup(new WordLang(lookupWord, lang));
    },
    [handleLookup],
  );

  // Scroll to top when results change
  useEffect(() => {
    if (result) {
      contentRef.current?.scrollToTop();
    }
  }, [result]);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton menu="m1" />
          </IonButtons>
          <IonTitle>{t('common.dictionary')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            placeholder={t('common.search')}
            value={word}
            onIonInput={(e) => handleInput(e.detail.value ?? '')}
            onIonClear={handleClear}
            onKeyDown={handleKeyDown}
          />
        </IonToolbar>
        <SearchbarDropdown
          suggestions={suggestions}
          visible={showSearches}
          onSelect={handleItemClicked}
        />
      </IonHeader>

      <IonContent
        ref={contentRef}
        fullscreen
        onClick={handleClear}
        className={showSearches ? 'dimmed' : undefined}
      >
        <div className="content-container">
          {recentSearches.length > 1 && (
            <IonBreadcrumbs color="primary">
              {recentSearches.map((wl) => (
                <IonBreadcrumb
                  key={wl.key}
                  onClick={() => handleLookup(wl)}
                >
                  {wl.word}
                </IonBreadcrumb>
              ))}
            </IonBreadcrumbs>
          )}
          <IonList lines="none">
            {result?.bases.map((base, i) => (
              <IonItem key={base.key} className="ion-no-padding">
                <IonCard className="lemma-card">
                  {i === 0 && (
                    <IonCardHeader>
                      <IonCardTitle>{base.word}</IonCardTitle>
                    </IonCardHeader>
                  )}
                  <IonCardContent>
                    <LemmaCard lemmas={result.lemmas[base.key] ?? []} onClicked={handleLemmaClicked} />
                  </IonCardContent>
                  <IonButton
                    fill="clear"
                    className="lemma-button"
                    onClick={() => handleLookup(base)}
                  >
                    {base.word}
                  </IonButton>
                </IonCard>
              </IonItem>
            ))}
          </IonList>
        </div>
      </IonContent>

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
    </IonPage>
  );
};

export default DictionaryPage;
