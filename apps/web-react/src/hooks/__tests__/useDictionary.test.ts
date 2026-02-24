import { renderHook, act } from '@testing-library/react';
import { useDictionary } from '../useDictionary.ts';
import type { LookupResponse } from '../../types/models.ts';
import { WordLang } from '../../types/models.ts';

vi.mock('../../api/dictionary.api.ts', () => ({
  searchDictionary: vi.fn(),
  fetchSuggestions: vi.fn(),
}));

vi.mock('../useAuth.ts', () => ({
  useAuth: () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }),
}));

import { searchDictionary, fetchSuggestions } from '../../api/dictionary.api.ts';

describe('useDictionary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has initial state: result null, isSearching false', () => {
    const { result } = renderHook(() => useDictionary());
    expect(result.current.result).toBeNull();
    expect(result.current.isSearching).toBe(false);
  });

  it('lookup sets isSearching true then false', async () => {
    const response: LookupResponse = {
      word: 'rumah',
      lang: 'id',
      lemmas: [
        {
          _id: '1',
          word: 'rumah',
          lang: 'id',
          baseWord: 'huis',
          baseLang: 'nl',
          text: 'house',
          homonym: 0,
        },
      ],
      haveMore: false,
    };
    vi.mocked(searchDictionary).mockResolvedValue(response);

    const { result } = renderHook(() => useDictionary());

    await act(async () => {
      await result.current.lookup(new WordLang('rumah', 'id'));
    });

    expect(result.current.isSearching).toBe(false);
  });

  it('lookup produces correctly structured LookupResult', async () => {
    const response: LookupResponse = {
      word: 'rumah',
      lang: 'id',
      lemmas: [
        {
          _id: '1',
          word: 'rumah',
          lang: 'id',
          baseWord: 'huis',
          baseLang: 'nl',
          text: 'house',
          homonym: 0,
        },
      ],
      haveMore: false,
    };
    vi.mocked(searchDictionary).mockResolvedValue(response);

    const { result } = renderHook(() => useDictionary());

    await act(async () => {
      await result.current.lookup(new WordLang('rumah', 'id'));
    });

    expect(result.current.result).not.toBeNull();
    expect(result.current.result!.bases).toHaveLength(1);
    expect(result.current.result!.bases[0]!.word).toBe('huis');
    expect(result.current.result!.lemmas['huis:nl']).toHaveLength(1);
  });

  it('paginates when haveMore is true', async () => {
    const page1: LookupResponse = {
      word: 'rumah',
      lang: 'id',
      lemmas: [
        {
          _id: '1',
          word: 'rumah',
          lang: 'id',
          baseWord: 'huis',
          baseLang: 'nl',
          text: 'house',
          homonym: 0,
        },
      ],
      haveMore: true,
    };
    const page2: LookupResponse = {
      word: 'rumah',
      lang: 'id',
      lemmas: [
        {
          _id: '2',
          word: 'rumah',
          lang: 'id',
          baseWord: 'woning',
          baseLang: 'nl',
          text: 'dwelling',
          homonym: 0,
        },
      ],
      haveMore: false,
    };

    vi.mocked(searchDictionary)
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const { result } = renderHook(() => useDictionary());

    await act(async () => {
      await result.current.lookup(new WordLang('rumah', 'id'));
    });

    expect(searchDictionary).toHaveBeenCalledTimes(2);
    expect(result.current.result!.bases).toHaveLength(2);
  });

  it('stops on error', async () => {
    vi.mocked(searchDictionary).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDictionary());

    await act(async () => {
      await result.current.lookup(new WordLang('rumah', 'id'));
    });

    expect(result.current.isSearching).toBe(false);
  });

  it('getSuggestions calls fetchSuggestions with correct args', async () => {
    const mockSuggestions = [new WordLang('rumah', 'id')];
    vi.mocked(fetchSuggestions).mockResolvedValue(mockSuggestions);

    const { result } = renderHook(() => useDictionary());

    let suggestions: WordLang[] | undefined;
    await act(async () => {
      suggestions = await result.current.getSuggestions('rum');
    });

    expect(fetchSuggestions).toHaveBeenCalledWith('rum', expect.any(Function));
    expect(suggestions).toEqual(mockSuggestions);
  });
});
