import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './apiFetch.ts';
import { useAuth } from '../hooks/useAuth.ts';
import type { ISystemSettings, User } from '../types/models.ts';

// --- Raw fetch functions ---

async function fetchUsers(
  getToken: () => Promise<string | null>,
): Promise<User[]> {
  return apiFetch<User[]>('/api/v1/users', { getToken });
}

async function deleteUser(
  id: string,
  getToken: () => Promise<string | null>,
): Promise<void> {
  await apiFetch(`/api/v1/users/${id}`, { method: 'DELETE', getToken });
}

async function inviteNewUser(
  email: string,
  lang: string,
  getToken: () => Promise<string | null>,
): Promise<{ accepted: string[] }> {
  return apiFetch<{ accepted: string[] }>('/api/v1/users/invite', {
    method: 'POST',
    body: JSON.stringify({ email, lang }),
    getToken,
  });
}

async function updateSortIndices(
  ids: string[],
  getToken: () => Promise<string | null>,
): Promise<void> {
  await apiFetch('/api/v1/content/sort', {
    method: 'PATCH',
    body: JSON.stringify(ids),
    getToken,
  });
}

async function deleteTopic(
  filename: string,
  getToken: () => Promise<string | null>,
): Promise<void> {
  await apiFetch(`/api/admin/topics/${filename}`, {
    method: 'DELETE',
    getToken,
  });
}

async function fetchSettings(
  getToken: () => Promise<string | null>,
): Promise<ISystemSettings[]> {
  return apiFetch<ISystemSettings[]>('/api/admin/settings', { getToken });
}

async function updateSettings(
  settings: ISystemSettings[],
  getToken: () => Promise<string | null>,
): Promise<void> {
  await apiFetch('/api/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify({ settings }),
    getToken,
  });
}

// --- TanStack Query hooks ---

export function useUsers() {
  const { getAccessToken } = useAuth();
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => fetchUsers(getAccessToken),
  });
}

export function useDeleteUser() {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id, getAccessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useInviteUser() {
  const { getAccessToken } = useAuth();
  return useMutation({
    mutationFn: ({ email, lang }: { email: string; lang: string }) =>
      inviteNewUser(email, lang, getAccessToken),
  });
}

export function useUpdateSortIndices() {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => updateSortIndices(ids, getAccessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      queryClient.invalidateQueries({ queryKey: ['publication'] });
    },
  });
}

export function useDeleteTopic() {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) => deleteTopic(filename, getAccessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      queryClient.invalidateQueries({ queryKey: ['publication'] });
      queryClient.invalidateQueries({ queryKey: ['article'] });
    },
  });
}

export function useSettings() {
  const { getAccessToken } = useAuth();
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => fetchSettings(getAccessToken),
  });
}

export function useUpdateSettings() {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: ISystemSettings[]) =>
      updateSettings(settings, getAccessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });
}
