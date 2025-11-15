declare const speechSynthesis: any;
declare const SpeechSynthesisUtterance: any;

import { Injectable, inject } from '@angular/core';
import {
  Observable,
  Observer,
  Subscription,
  concatMap,
  delay,
  filter,
  from,
  map,
  throwError,
} from 'rxjs';
import { environment } from '../../environments/environment';
import { LoggerService } from '../shared/logger.service';

interface SpeechSynthesisVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

interface SpeakOptions {
  pause: number;
  volume: number;
  rate: number;
}

const MAX_RETRIES = 10;
const INTER_SENTENCE_PAUSE_MS = 250;
const DEFAULT_OPTIONS = { pause: 0, volume: 1, rate: 0.8 };

@Injectable({
  providedIn: 'root',
})
export class SpeechSynthesizerService {
  voicesAvailable!: SpeechSynthesisVoice[];
  private _hasSpoken = false; // needed for iOS
  isCancelling = false;
  speechSubscription?: Subscription;
  utterance: any;
  private _speechEnabled = false;

  private logger!: LoggerService;

  constructor() {
    this.logger = inject(LoggerService);
    this.onInit();
  }

  get speechEnabled(): boolean {
    return this._speechEnabled;
  }

  set speechEnabled(value: boolean) {
    this._speechEnabled = value;
    if (!value) {
      this.cancel();
    }
  }

  onInit() {
    if (!this.isSynthesisSupported()) {
      return;
    }

    this.loadVoices().then((voices) => {
      this.voicesAvailable = voices.sort((a, b) =>
        a.lang.localeCompare(b.lang)
      );
      if (!environment.production && this.logger.isMinLevel('silly')) {
        console.table(this.voicesAvailable);
      }
      this.logger.debug(
        'SpeechSynthesizerService',
        `${voices.length} voices loaded`
      );
    });
  }

  get hasSpoken(): boolean {
    return this._hasSpoken;
  }

  loadVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve, reject) => {
      try {
        let voices: SpeechSynthesisVoice[] = [];
        let retries = 0;

        if (typeof speechSynthesis === 'undefined') {
          return resolve([]);
        }
        voices = speechSynthesis.getVoices();
        if (voices.length !== 0) {
          resolve(voices);
          return;
        }

        const intervalID = setInterval((): void => {
          voices = speechSynthesis.getVoices();
          retries += 1;
          if (voices.length !== 0 || retries > MAX_RETRIES) {
            this.logger.debug(
              'SpeechSynthesizerService.loadVoices',
              'retries ' + retries
            );
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
    return typeof speechSynthesis !== 'undefined';
  }

  canSpeakLanguage(lang: string) {
    return this.isSynthesisSupported() && !!this.selectVoice(lang);
  }

  getVoices() {
    return this.voicesAvailable;
  }

  cancel() {
    this.isCancelling = true;
    speechSynthesis.cancel();
    if (this.speechSubscription) {
      this.speechSubscription.unsubscribe();
      this.speechSubscription = undefined;
    }
    if (this.isSynthesisSupported()) {
      speechSynthesis.cancel();
    }
  }

  speakMulti(text: string, lang: string, options?: SpeakOptions) {
    if (!this.isSynthesisSupported()) {
      throw new Error('speech synthesis not supported');
    }

    options = options ?? DEFAULT_OPTIONS;
    this.cancel();
    this.isCancelling = false;

    text = text.trim();
    if (!/[.?!]$/.test(text)) {
      text += '.';
    }
    text += ' ';

    const matches = text.match(/.+?[.!?]+\s+/g) || [text];

    if (matches.length > 1) {
      options.pause = options.pause || INTER_SENTENCE_PAUSE_MS;
    }

    return from(matches).pipe(
      map((phrase) => phrase.trim()),
      filter((phrase) => phrase.length !== 0),
      concatMap((phrase) =>
        this.speakObservable(phrase, lang, options).pipe(delay(options!.pause))
      )
    );
  }

  speakSingle(
    text: string,
    lang: string,
    options?: SpeakOptions
  ): Observable<void> {
    if (!this.isSynthesisSupported()) {
      return throwError(() => new Error('speech synthesis not supported'));
    }
    this.cancel();
    this.isCancelling = false;
    return this.speakObservable(text, lang, options);
  }

  speakObservable(text: string, lang: string, options?: SpeakOptions) {
    return new Observable((observer: Observer<void>) => {
      options = options ?? DEFAULT_OPTIONS;
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
        this.utterance.voiceURI = voice.voiceURI;
        this.utterance.lang = voice.lang;
        this.utterance.rate = options.rate || 1;
        this.utterance.volume =
          typeof options.volume === 'number' ? options.volume : 1;

        const onEndHandler = (e?: any) => {
          this._hasSpoken = true;
          observer.next(this.utterance);
          observer.complete();
        };

        this.utterance.addEventListener('end', onEndHandler);

        // Safari fires onerror instead onend while there is no error apparent
        this.utterance.addEventListener('error', onEndHandler);

        speechSynthesis.speak(this.utterance);
      } catch (err: any) {
        this.logger.error(
          'SpeechSynthesizerService.speakObservable',
          err.message
        );
        observer.error(err);
      }
    });
  }

  selectVoice(lang: string) {
    return this.voicesAvailable.find((voice) => voice.lang.startsWith(lang));
  }
}
