import { Injectable, inject } from '@angular/core';
import { Observable, Observer, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoggerService } from '../shared/logger.service';

interface SpeakOptions {
  volume: number;
  rate: number;
}

const MAX_RETRIES = 10;
const DEFAULT_OPTIONS: SpeakOptions = { volume: 1, rate: 0.8 };

@Injectable({
  providedIn: 'root',
})
export class SpeechSynthesizerService {
  voicesAvailable: SpeechSynthesisVoice[] = [];
  utterance!: SpeechSynthesisUtterance;
  #speechEnabled = false;

  readonly #logger = inject(LoggerService);

  constructor() {
    this.initVoices();
  }

  get speechEnabled(): boolean {
    return this.#speechEnabled;
  }

  set speechEnabled(value: boolean) {
    this.#speechEnabled = value;
    if (!value) {
      this.cancel();
    }
  }

  initVoices() {
    if (!this.isSynthesisSupported()) {
      return;
    }

    this.loadVoices().then((voices) => {
      this.voicesAvailable = voices.sort((a, b) => a.lang.localeCompare(b.lang));
      if (!environment.production && this.#logger.isMinLevel('silly')) {
        console.table(this.voicesAvailable);
      }
      this.#logger.debug('SpeechSynthesizerService', `${voices.length} voices loaded`);
    });
  }

  loadVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve, reject) => {
      try {
        let voices: SpeechSynthesisVoice[] = [];
        let retries = 0;

        if (!this.isSynthesisSupported()) {
          return resolve([]);
        }

        voices = window.speechSynthesis.getVoices();
        if (voices.length !== 0) {
          resolve(voices);
          return;
        }

        const intervalID = setInterval((): void => {
          voices = window.speechSynthesis.getVoices();
          retries += 1;
          if (voices.length !== 0 || retries > MAX_RETRIES) {
            this.#logger.debug('SpeechSynthesizerService.loadVoices', 'retries ' + retries);
            clearInterval(intervalID);
            resolve(voices);
            return;
          }
        }, 50);
      } catch (err) {
        reject(err);
      }
    });
  }

  isSynthesisSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  canSpeakLanguage(lang: string) {
    return this.isSynthesisSupported() && !!this.selectVoice(lang);
  }

  cancel() {
    if (this.isSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  speakSingle(text: string, lang: string, options?: Partial<SpeakOptions>): Observable<void> {
    if (!this.isSynthesisSupported()) {
      return throwError(() => new Error('speech synthesis not supported'));
    }
    this.cancel();
    return this.speakObservable(text, lang, options);
  }

  speakObservable(text: string, lang: string, options?: Partial<SpeakOptions>) {
    return new Observable((observer: Observer<void>) => {
      const opts = { ...DEFAULT_OPTIONS, ...options };
      try {
        const voice = this.selectVoice(lang);

        if (!voice) {
          throw new Error(`voice for '${lang}' not loaded`);
        }

        // use member variable for utterance to prevent
        // erronous garbage collection clean-up
        this.utterance = new SpeechSynthesisUtterance();
        this.utterance.text = text;
        this.utterance.voice = voice;
        this.utterance.lang = voice.lang;
        this.utterance.rate = opts.rate;
        this.utterance.volume = opts.volume;

        // The Web Speech API is quirky: Safari can fire 'error' spuriously (and
        // omits 'end' after a cancel), so both events resolve the stream. Log
        // genuinely unexpected errors; ignore the benign ones our cancel() causes.
        const onDone = (event: Event) => {
          if (
            event instanceof SpeechSynthesisErrorEvent &&
            event.error !== 'canceled' &&
            event.error !== 'interrupted'
          ) {
            this.#logger.debug(
              'SpeechSynthesizerService.speakObservable',
              `utterance error: ${event.error}`,
            );
          }
          observer.next();
          observer.complete();
        };

        this.utterance.addEventListener('end', onDone);
        this.utterance.addEventListener('error', onDone);

        window.speechSynthesis.speak(this.utterance);

        return () => {
          this.utterance.removeEventListener('end', onDone);
          this.utterance.removeEventListener('error', onDone);
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.#logger.error('SpeechSynthesizerService.speakObservable', message);
        observer.error(err);
        return undefined;
      }
    });
  }

  selectVoice(lang: string) {
    return this.voicesAvailable.find((voice) => voice.lang.startsWith(lang));
  }
}
