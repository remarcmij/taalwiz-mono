import { renderHook, act } from '@testing-library/react';
import { useWordClickModal } from '../useWordClickModal.ts';

vi.mock('../useDictionary.ts', () => ({
  searchDictionaryKeyword: vi.fn(),
}));

vi.mock('../useAuth.ts', () => ({
  useAuth: () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }),
}));

vi.mock('../../lib/indonesian-stemmer.ts', () => ({
  IndonesianStemmer: class {
    getWordVariations(word: string) {
      return [word];
    }
  },
}));

vi.mock('../../constants.ts', () => ({
  foreignLang: 'id',
}));

import { searchDictionaryKeyword } from '../useDictionary.ts';

describe('useWordClickModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('modalData is initially null', () => {
    const { result } = renderHook(() => useWordClickModal());
    expect(result.current.modalData).toBeNull();
  });

  it('onClicked sets modalData with word/lang/sentence/lemmas', async () => {
    vi.mocked(searchDictionaryKeyword).mockResolvedValue({
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
    });

    const { result } = renderHook(() => useWordClickModal());

    const target = document.createElement('span');
    target.innerText = 'rumah';
    const parent = document.createElement('p');
    parent.textContent = 'Het rumah is groot';
    parent.appendChild(target);

    const event = {
      target,
    } as unknown as MouseEvent;

    await act(async () => {
      await result.current.onClicked(event);
    });

    expect(result.current.modalData).not.toBeNull();
    expect(result.current.modalData!.word).toBe('rumah');
    expect(result.current.modalData!.lang).toBe('id');
    expect(result.current.modalData!.lemmas).toHaveLength(1);
  });

  it('onClicked adds "clicked" CSS class to target', async () => {
    vi.mocked(searchDictionaryKeyword).mockResolvedValue({
      word: 'rumah',
      lang: 'id',
      lemmas: [],
    });

    const { result } = renderHook(() => useWordClickModal());

    const target = document.createElement('span');
    target.innerText = 'rumah';
    const parent = document.createElement('p');
    parent.appendChild(target);

    await act(async () => {
      await result.current.onClicked({
        target,
      } as unknown as MouseEvent);
    });

    expect(target.classList.contains('clicked')).toBe(true);
  });

  it('dismissModal clears modalData and removes class', async () => {
    vi.mocked(searchDictionaryKeyword).mockResolvedValue({
      word: 'rumah',
      lang: 'id',
      lemmas: [],
    });

    const { result } = renderHook(() => useWordClickModal());

    const target = document.createElement('span');
    target.innerText = 'rumah';
    const parent = document.createElement('p');
    parent.appendChild(target);

    await act(async () => {
      await result.current.onClicked({
        target,
      } as unknown as MouseEvent);
    });

    expect(result.current.modalData).not.toBeNull();

    act(() => {
      result.current.dismissModal();
    });

    expect(result.current.modalData).toBeNull();
    expect(target.classList.contains('clicked')).toBe(false);
  });

  it('removes highlight on search failure', async () => {
    vi.mocked(searchDictionaryKeyword).mockRejectedValue(
      new Error('Not found'),
    );

    const { result } = renderHook(() => useWordClickModal());

    const target = document.createElement('span');
    target.innerText = 'xyz';
    const parent = document.createElement('p');
    parent.appendChild(target);

    await act(async () => {
      await result.current.onClicked({
        target,
      } as unknown as MouseEvent);
    });

    expect(target.classList.contains('clicked')).toBe(false);
    expect(result.current.modalData).toBeNull();
  });
});
