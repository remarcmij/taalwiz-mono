import { apiFetch } from './apiFetch.ts';
import type { LookupResponse, WordLang } from '../types/models.ts';

export async function searchDictionary(
  word: string,
  lang: string,
  getToken: () => Promise<string | null>,
  options?: { keyword?: boolean; skip?: number; limit?: number },
): Promise<LookupResponse> {
  const params = new URLSearchParams();
  if (options?.keyword !== undefined) {
    params.set('keyword', options.keyword ? '1' : '0');
  }
  if (typeof options?.skip === 'number') {
    params.set('skip', String(options.skip));
  }
  if (typeof options?.limit === 'number') {
    params.set('limit', String(options.limit));
  }

  const url = `/api/v1/dictionary/find/${encodeURIComponent(word)}/${encodeURIComponent(lang)}?${params.toString()}`;
  return apiFetch<LookupResponse>(url, { getToken });
}

export async function fetchSuggestions(
  term: string,
  getToken: () => Promise<string | null>,
): Promise<WordLang[]> {
  return apiFetch<WordLang[]>(
    `/api/v1/dictionary/autocomplete/${encodeURIComponent(term)}`,
    { getToken },
  );
}
