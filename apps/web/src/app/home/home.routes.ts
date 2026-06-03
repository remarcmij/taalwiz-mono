import { Routes } from '@angular/router';

import { HomePage } from './home.page';

export const homeUrl = '/home/tabs/content';

/** Bottom-tab segments under /home/tabs. */
export const HOME_TABS = ['content', 'dictionary', 'hashtags', 'bookmarks'] as const;
export type HomeTab = (typeof HOME_TABS)[number];

/** Preferences key holding the last active tab, restored on a cold start. */
export const LAST_TAB_KEY = 'lastTab';

/** Build the URL for a tab. */
export function tabUrl(tab: HomeTab): string {
  return `/home/tabs/${tab}`;
}

/** Extract the active tab from a URL, or null if it is not a home-tab URL. */
export function tabFromUrl(url: string): HomeTab | null {
  const tab = url.match(/^\/home\/tabs\/([^/?#]+)/)?.[1];
  return tab && (HOME_TABS as readonly string[]).includes(tab) ? (tab as HomeTab) : null;
}

export const HOME_ROUTES: Routes = [
  {
    path: 'tabs',
    component: HomePage,
    children: [
      {
        path: 'content',
        children: [
          {
            path: '',
            loadChildren: () => import('./content/content.routes').then((r) => r.CONTENT_ROUTES),
          },
        ],
      },
      {
        path: 'dictionary',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./dictionary/dictionary.page').then((p) => p.DictionaryPage),
            pathMatch: 'full',
          },
          {
            path: ':lang/:word',
            loadComponent: () =>
              import('./dictionary/dictionary.page').then((p) => p.DictionaryPage),
          },
        ],
      },
      {
        path: 'hashtags',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./content/hashtags/hashtags.page').then((p) => p.HashtagsPage),
          },
        ],
      },
      {
        path: 'bookmarks',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./vocabulary/vocabulary.page').then((p) => p.VocabularyPage),
          },
        ],
      },
      {
        path: '',
        redirectTo: homeUrl,
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: homeUrl,
    pathMatch: 'full',
  },
];
