import {
  IonButton,
  IonButtons,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { playOutline, searchOutline, volumeHighOutline } from 'ionicons/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { tinyMarkdown } from '../lib/markdown.ts';
import { sanitize } from '../lib/sanitize.ts';
import { useSpeechSynthesizer } from '../hooks/useSpeechSynthesizer.ts';
import type { ILemma } from '../types/models.ts';

interface WordClickModalProps {
  clickedWord: string;
  word: string;
  lang: string;
  sentence: string;
  lemmas: ILemma[];
  onDismiss: () => void;
  onDictionaryLookup: (word: string, lang: string) => void;
}

const WordClickModal: React.FC<WordClickModalProps> = ({
  clickedWord,
  word,
  lang,
  sentence,
  lemmas,
  onDismiss,
  onDictionaryLookup,
}) => {
  const { t } = useTranslation();
  const { speakSingle, canSpeak } = useSpeechSynthesizer();

  const homonyms = useMemo(() => {
    const homonymMap = new Map<string, ILemma[]>();
    for (const lemma of lemmas) {
      const key = lemma.baseWord + '.' + lemma.homonym;
      homonymMap.set(key, [...(homonymMap.get(key) ?? []), lemma]);
    }

    const result: string[] = [];
    for (const group of homonymMap.values()) {
      let first = true;
      const texts = group.map((lemma) => {
        const text = lemma.text.trim();
        if (first) {
          first = false;
          return text;
        }
        const regexp = new RegExp(`\\*\\*${lemma.word}\\*\\*, *(\\d+)`);
        return text.replace(regexp, '$1');
      });
      const homonymText = tinyMarkdown(
        texts.join(' ').replace(/;$/, '.'),
      );
      result.push(homonymText);
    }
    return result;
  }, [lemmas]);

  const handleDictionaryLookup = () => {
    onDismiss();
    onDictionaryLookup(word, lang);
  };

  if (lemmas.length === 0) {
    return (
      <div className="ion-padding">
        <IonLabel>
          {t('common.word-not-found')}{' '}
          <span className="clicked-word">{clickedWord}</span>
        </IonLabel>
      </div>
    );
  }

  return (
    <>
      <IonToolbar>
        <IonTitle>
          <IonLabel>
            <span className="clicked-word">{clickedWord}</span>
          </IonLabel>
        </IonTitle>
        <IonButtons slot="end">
          {canSpeak(lang) && (
            <>
              {sentence !== clickedWord && (
                <IonButton onClick={() => speakSingle(sentence, lang)}>
                  <IonIcon
                    slot="icon-only"
                    icon={playOutline}
                    aria-label="sentence"
                  />
                </IonButton>
              )}
              <IonButton onClick={() => speakSingle(clickedWord, lang)}>
                <IonIcon
                  slot="icon-only"
                  icon={volumeHighOutline}
                  aria-label="pronounce"
                />
              </IonButton>
            </>
          )}
          <IonButton onClick={handleDictionaryLookup}>
            <IonIcon
              slot="icon-only"
              icon={searchOutline}
              aria-label="lookup"
            />
          </IonButton>
        </IonButtons>
      </IonToolbar>
      <IonContent>
        <IonList lines="none">
          {homonyms.map((html, i) => (
            <IonItem key={i}>
              <IonLabel>
                <div
                  className="homonym"
                  dangerouslySetInnerHTML={{ __html: sanitize(html) }}
                />
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </>
  );
};

export default WordClickModal;
