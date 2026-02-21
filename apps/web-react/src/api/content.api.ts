import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './apiFetch.ts';
import { useAuth } from '../hooks/useAuth.ts';
import type { IArticle, ITopic } from '../types/models.ts';

async function fetchPublications(
  getToken: () => Promise<string | null>,
): Promise<ITopic[]> {
  return apiFetch<ITopic[]>('/api/v1/content/index', { getToken });
}

async function fetchPublicationTopics(
  groupName: string,
  getToken: () => Promise<string | null>,
): Promise<ITopic[]> {
  return apiFetch<ITopic[]>(`/api/v1/content/${groupName}`, { getToken });
}

async function fetchArticle(
  filename: string,
  getToken: () => Promise<string | null>,
): Promise<IArticle> {
  return apiFetch<IArticle>(`/api/v1/content/article/${filename}`, {
    getToken,
  });
}

export function usePublications() {
  const { getAccessToken } = useAuth();
  return useQuery({
    queryKey: ['publications'],
    queryFn: () => fetchPublications(getAccessToken),
  });
}

export function usePublicationTopics(groupName: string) {
  const { getAccessToken } = useAuth();
  return useQuery({
    queryKey: ['publication', groupName],
    queryFn: () => fetchPublicationTopics(groupName, getAccessToken),
    enabled: !!groupName,
  });
}

export function useArticle(filename: string) {
  const { getAccessToken } = useAuth();
  return useQuery({
    queryKey: ['article', filename],
    queryFn: () => fetchArticle(filename, getAccessToken),
    enabled: !!filename,
  });
}

// Re-export for direct use
export { fetchArticle, fetchPublications, fetchPublicationTopics };
