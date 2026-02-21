import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../lib/logger.ts';

const MAX_RETRIES = 10;
const INTER_SENTENCE_PAUSE_MS = 250;
const DEFAULT_RATE = 0.8;

export function useSpeechSynthesizer() {
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const [ready, setReady] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    let retries = 0;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      voicesRef.current = voices;
      setReady(true);
      return;
    }

    const intervalID = setInterval(() => {
      const v = window.speechSynthesis.getVoices();
      retries += 1;
      if (v.length > 0 || retries > MAX_RETRIES) {
        clearInterval(intervalID);
        voicesRef.current = v;
        setReady(true);
        logger.debug(
          'useSpeechSynthesizer',
          `${v.length} voices loaded after ${retries} retries`,
        );
      }
    }, 50);

    return () => clearInterval(intervalID);
  }, []);

  const selectVoice = useCallback(
    (lang: string): SpeechSynthesisVoice | undefined => {
      return voicesRef.current.find((v) => v.lang.startsWith(lang));
    },
    [],
  );

  const canSpeak = useCallback(
    (lang: string): boolean => {
      return ready && !!selectVoice(lang);
    },
    [ready, selectVoice],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speakSingle = useCallback(
    (text: string, lang: string, rate = DEFAULT_RATE): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!('speechSynthesis' in window)) {
          reject(new Error('Speech synthesis not supported'));
          return;
        }

        cancel();
        cancelledRef.current = false;

        const voice = selectVoice(lang);
        if (!voice) {
          reject(new Error(`Voice for '${lang}' not available`));
          return;
        }

        const utterance = new SpeechSynthesisUtterance();
        utterance.text = text;
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;

        const onEnd = () => {
          resolve();
        };
        utterance.addEventListener('end', onEnd);
        utterance.addEventListener('error', onEnd); // Safari fires error instead of end

        window.speechSynthesis.speak(utterance);
      });
    },
    [cancel, selectVoice],
  );

  const speakMulti = useCallback(
    async (text: string, lang: string, rate = DEFAULT_RATE): Promise<void> => {
      cancel();
      cancelledRef.current = false;

      let t = text.trim();
      if (!/[.?!]$/.test(t)) {
        t += '.';
      }
      t += ' ';

      const matches = t.match(/.+?[.!?]+\s+/g) ?? [t];
      const pause =
        matches.length > 1 ? INTER_SENTENCE_PAUSE_MS : 0;

      for (const phrase of matches) {
        if (cancelledRef.current) break;
        const trimmed = phrase.trim();
        if (trimmed.length === 0) continue;
        await speakSingle(trimmed, lang, rate);
        if (pause > 0) {
          await new Promise((r) => setTimeout(r, pause));
        }
      }
    },
    [cancel, speakSingle],
  );

  return { speakSingle, speakMulti, cancel, canSpeak, selectVoice, ready };
}
