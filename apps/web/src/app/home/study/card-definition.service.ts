import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { langConfig } from '../../app.constants';
import { DictionaryService } from '../dictionary/dictionary.service';
import { segmentIndonesian, type SegmentResult } from '../dictionary/indonesian-segmenter';
import { ILemma } from '../dictionary/lemma/lemma.model';

/** A back-less card resolved against the dictionary: the chosen lemma line, the
 * headword that actually matched, and the affix decomposition of a derived form. */
export interface ResolvedCard {
  lemma: ILemma | null;
  /** The headword the lookup resolved on (may differ from the surface term). */
  word: string;
  breakdown: SegmentResult | null;
}

/**
 * Resolves a back-less SRS card to its dictionary definition + affix breakdown,
 * exactly as the study modal's flip and the word-tap modal do. Shared so the
 * flashcard back and the deck-as-content view never drift in how a card reads.
 */
@Injectable({ providedIn: 'root' })
export class CardDefinitionService {
  #dictionary = inject(DictionaryService);

  async resolve(term: string, lang: string, lemmaIndex: number): Promise<ResolvedCard> {
    const result = await firstValueFrom(this.#dictionary.fetchWordLemmas(term, lang));
    // The user may have pinned a non-default line; fall back to the first line if
    // the index is out of range (e.g. the lemma set shrank since it was chosen).
    const lemma = result.lemmas[lemmaIndex] ?? result.lemmas[0] ?? null;
    // Segment against the lemma's ROOT (baseWord), not the matched headword — a
    // headword can itself be affixed, which the segmenter can't anchor on. Only a
    // genuinely derived target-language form gets a decomposition.
    const baseWord = lemma?.baseWord;
    const breakdown =
      baseWord && baseWord !== term && lang === langConfig.targetLang
        ? segmentIndonesian(term, baseWord)
        : null;
    return { lemma, word: result.word, breakdown };
  }
}
