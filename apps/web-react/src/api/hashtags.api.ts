import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './apiFetch.ts';
import { useAuth } from '../hooks/useAuth.ts';
import type { HashtagGroup, IHashtag } from '../types/models.ts';

async function fetchHashtagIndex(
  getToken: () => Promise<string | null>,
): Promise<HashtagGroup[]> {
  return apiFetch<HashtagGroup[]>('/api/v1/hashtags', { getToken });
}

async function findHashtag(
  name: string,
  getToken: () => Promise<string | null>,
): Promise<IHashtag[]> {
  return apiFetch<IHashtag[]>(`/api/v1/hashtags/${encodeURIComponent(name)}`, {
    getToken,
  });
}

export function useHashtagIndex() {
  const { getAccessToken } = useAuth();
  return useQuery({
    queryKey: ['hashtags'],
    queryFn: () => fetchHashtagIndex(getAccessToken),
  });
}

export function useFindHashtag(name: string) {
  const { getAccessToken } = useAuth();
  return useQuery({
    queryKey: ['hashtag', name],
    queryFn: () => findHashtag(name, getAccessToken),
    enabled: !!name,
  });
}

export { findHashtag, fetchHashtagIndex };
