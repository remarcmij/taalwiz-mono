# web-react Debug Status

This file tracks the current state of the Angular → React conversion for future debugging sessions with Claude Code.

## Branch

`feature/web-react` — based off `main`

## What's Working

- **Login/logout** — full flow with validation errors, API errors, token refresh, auto-login from localStorage
- **Content browsing** — publications list → article list → article view
- **Word click modal** — click Indonesian word in article or dictionary → bottom sheet with definition, speech, dictionary lookup
- **Hashtag modal** — click hashtag in article → bottom sheet with occurrences → navigate to article
- **Dictionary** — search with autocomplete dropdown, pagination, breadcrumb history, route-param lookup from word click modal
- **Hashtags page** — grouped hashtag chips, modal on click, navigation to article
- **Flashcard page** — swiper, shuffle, mode toggle, speech
- **Auth pages** — register, change password, request/reset password
- **User pages** — welcome, about, contact
- **Admin pages** — all 8 admin pages (users, new user, content, publication, article preview, upload, system settings)
- **Side menu** — user info, navigation links, admin section
- **i18n** — Dutch/English translations synced from Angular app
- **PWA** — update prompt via vite-plugin-pwa
- **Desktop layout** — content-container centering at 768px

## Known Issues / Not Yet Verified

- **React 19 console warning**: "Can't perform a React state update on a component that hasn't mounted yet" at App.tsx (IonReactRouter). This is a React 19 + Ionic React compatibility warning. It doesn't appear to break functionality but should be monitored.
- **Admin pages** — functional but not yet thoroughly tested for all CRUD operations (reorder, delete, upload progress, settings save-on-unmount)
- **Flashcard page** — not tested end-to-end with real article data
- **Speech synthesis** — works but voice selection may vary by browser/OS
- **Dark mode** — should work via Ionic's dark.system.css palette but not verified
- **PWA install** — manifest configured but not tested on mobile
- **Unused files**: `ProtectedRoute.tsx` and `AdminRoute.tsx` were deleted — guard logic is now inline in App.tsx via `protectedRender`/`adminRender` helper functions

## Architecture Decisions

### Routing
`IonRouterOutlet` requires ALL direct children to be `<Route>` elements. Custom wrapper components (like `<ProtectedRoute>`) break Ionic's page management even if they render `<Route>` internally. Guard logic is now inline in App.tsx:
```tsx
const protectedRender = (Component) => (props) =>
  user ? <Component {...props} /> : <Redirect to="/auth" />;

<Route path="/home/tabs" render={protectedRender(HomePage)} />
```

### Auth State
`AuthContext` uses synchronous initialization via `useReducer` lazy initializer (reads localStorage). No async `autoLogin()` — avoids race conditions with route guards.

### Word Click Flow
`useWordClickModal` hook → extracts word → `IndonesianStemmer.getWordVariations()` → `searchDictionaryKeyword()` → sets `modalData` state → `<IonModal>` opens. Used in both `ArticlePage` and `DictionaryPage`.

### Modals
Declarative `<IonModal isOpen={...}>` pattern preferred over imperative `useIonModal` hook (more reliable with React 19). Exception: `HashtagsPage` still uses `useIonModal`.

### IonButton / IonAlert / IonLoading
Use declarative components (`<IonAlert isOpen={...}>`) not imperative hooks (`useIonAlert`). The `onClick` prop works on `<IonButton>` — do NOT use `<form onSubmit>` with `type="submit"` (web component limitation).

## Plan Reference

The full conversion plan is at: `.claude/plans/fizzy-splashing-dahl.md`

Phases 1-13 are defined there. Most functionality from all phases has been implemented. Remaining work is primarily bug fixes, CSS polish, and testing.

## Key Files

| File | Purpose |
|---|---|
| `src/App.tsx` | Route tree with inline guards |
| `src/context/AuthContext.tsx` | Auth state, login, logout, token refresh |
| `src/hooks/useWordClickModal.ts` | Word click → dictionary lookup → modal |
| `src/hooks/useDictionary.ts` | Dictionary search with pagination |
| `src/hooks/useSpeechSynthesizer.ts` | Text-to-speech |
| `src/components/WordClickModal.tsx` | Word definition bottom sheet |
| `src/components/HashtagModal.tsx` | Hashtag occurrences bottom sheet |
| `src/components/ArticleBody.tsx` | HTML article renderer with click capture |
| `src/global.css` | All custom CSS (dictionary, dropdowns, etc.) |
| `src/lib/indonesian-stemmer.ts` | Word stemming for dictionary lookup |
