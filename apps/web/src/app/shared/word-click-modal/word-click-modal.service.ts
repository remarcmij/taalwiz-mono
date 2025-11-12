import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { foreignLang } from '../../app.constants';
import { DictionaryService } from '../../home/dictionary/dictionary.service';
import { IndonesianStemmer } from '../../home/dictionary/indonesian-stemmer';
import { WordLang } from '../../home/dictionary/word-lang.model';
import { WordClickModalComponent } from './word-click-modal.component';

const removeAccents = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

@Injectable({
    providedIn: 'root',
})
export class WordClickModalService {
    constructor(
        private dictionaryService: DictionaryService,
        private modalCtrl: ModalController,
    ) { }

    onClicked(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        const target = event.target as HTMLInputElement;
        const sentence = target.parentElement?.textContent ?? '';

        const wordLang = this.getWordClickParams(target);
        if (wordLang) {
            this.fetchLemmas(removeAccents(wordLang.word), wordLang.lang).subscribe({
                next: (response) => {
                    const { word, lang, lemmas } = response;

                    this.modalCtrl
                        .create({
                            component: WordClickModalComponent,
                            componentProps: {
                                clickedWord: wordLang.word,
                                word,
                                lang,
                                sentence: sentence.trim(),
                                lemmas,
                            },
                            initialBreakpoint: 0.25,
                            breakpoints: [0, 0.25, 0.5],
                            handleBehavior: 'cycle',
                        })
                        .then((modal) => {
                            modal.present();
                        });
                },
                error: (error) => { },
            });
        }
    }

    fetchLemmas(word: string, lang: string) {
        const parser = new IndonesianStemmer();
        const variations = parser.getWordVariations(word);
        const searchRequest = {
            word: variations.join(','),
            lang: lang,
            attr: 'k',
        };

        return this.dictionaryService.execSearchRequest(searchRequest);
    }

    getWordClickParams(target: HTMLElement): WordLang | null {
        let word = target.innerText.trim();
        word = this.cleanseTerm(word);
        return new WordLang(word, foreignLang);
    }

    private cleanseTerm(term: string): string {
        const match = term.match(/[-'()a-zA-Z\u00C0-\u00FF]{2,}/g);
        if (match) {
            term = match[0];
        }
        term = term.trim().toLowerCase();
        return (
            term.replace(/\(.*?\)/g, '').replace(/[()]/g, '') ||
            term.replace(/[()]/g, '')
        );
    }
}
