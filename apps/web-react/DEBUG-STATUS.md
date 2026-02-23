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
- **Flashcard page** — Swiper slides render correctly (flatMap, no Fragment wrapping), progress bar advances per card, mode toggle (foreignFirst/nativeFirst) works, stable keys via `data.index`
- **Auth pages** — register, change password, request/reset password
- **User pages** — welcome, about, contact
- **Admin pages** — all 8 admin pages (users, new user, content, publication, article preview, upload, system settings)
- **Admin reorder** — content and publication reorder mode with unmount save and `onError` logging
- **Admin delete** — user delete (slide-to-delete with action sheet confirmation), article delete (toolbar trash button with alert confirmation), both with `onError` feedback
- **Admin upload** — file upload with XHR abort cleanup on unmount
- **Admin publication Delete All** — uses `Promise.all` + `mutateAsync` (race condition fixed)
- **Side menu** — user info, navigation links, admin section
- **i18n** — Dutch/English translations synced from Angular app
- **PWA** — update prompt via vite-plugin-pwa
- **Desktop layout** — content-container centering at 768px
- **Dark mode** — dropdown list, text colors, clicked word highlight all verified in dark scheme
- **Error boundary** — `ErrorBoundary` class component wraps the app, shows "Something went wrong" with reload button on unhandled render errors
- **ESLint** — `eslint-plugin-react-hooks` installed via shared `@repo/eslint-config/react` preset; lint passes with 0 warnings

## Browser-Tested Features (Playwright, Feb 2026)

All tested against the live dev server (Vite port 5173 + API port 3000).

| Feature | Status | Notes |
|---|---|---|
| Flashcard Swiper slides | Pass | No Fragment wrapping bug, slides render as direct children |
| Flashcard progress bar | Pass | Advances per card (not per slide), resets on mode toggle |
| Flashcard mode toggle | Pass | foreignFirst ↔ nativeFirst, slides re-render with stable keys |
| Dark mode — dictionary dropdown | Pass | Dark background, readable text |
| Dark mode — article page | Pass | White text on dark bg, Indonesian words in blue |
| Admin Content — reorder mode | Pass | Enable/Done toggle, reorder handles visible, back nav clean |
| Admin Publication — article list | Pass | 18 articles rendered, Options menu with Reorder/Delete All |
| Admin Article Preview | Pass | Full article HTML rendered, delete button in toolbar |
| Admin Users — user list | Pass | All users listed with slide-to-delete |
| Admin Upload — unmount cleanup | Pass | Navigate away triggers no console errors |
| Admin System Settings | N/A | API endpoint returns 404 (not implemented server-side) |

## Known Issues

- **React 19 + Ionic console warning**: "Can't perform a React state update on a component that hasn't mounted yet" — Ionic React router compatibility issue. Does not break functionality.
- **IonList key warning in AdminUsersPage**: "Each child in a list should have a unique key prop" — `key={user.id}` is set correctly on `IonItemSliding`; appears to be Ionic's internal rendering of `IonList` children. Does not affect functionality.
- **Admin System Settings API**: `/api/admin/settings` endpoint returns 404 — the API route is not implemented server-side yet.
- **Speech synthesis** — works but voice selection may vary by browser/OS.
- **PWA install** — manifest configured but not tested on mobile.

## Fixes Applied (commit 3bbc858)

1. **ESLint react-hooks plugin** — `packages/eslint-config/react.js` preset created, `apps/web-react/eslint.config.js` updated
2. **`PROD` env var** — added to `turbo.json` globalEnv
3. **AdminPublicationPage Delete All race condition** — `mutate` loop → `Promise.all` + `mutateAsync`
4. **AdminUploadPage XHR abort on unmount** — `useEffect` cleanup aborts active XHRs
5. **FlashcardPage Fragment → flatMap** — Swiper slides are now direct children (no Fragment wrapping)
6. **Stable flashcard keys** — `data.index` instead of `uniqueId()`, `uniqueId` function deleted
7. **Flashcard progress bar** — calculates per card (`Math.floor(activeIndex / 2)`) not per slide
8. **AdminSystemSettingsPage date comparison** — stores picked date as ISO string, not Date object
9. **Unmount save `onError`** — `console.error` callbacks on AdminContentPage, AdminPublicationPage, AdminSystemSettingsPage
10. **Delete mutation `onError`** — toast/alert feedback on AdminUsersPage, AdminArticlePreviewPage
11. **Dark mode CSS** — `@media (prefers-color-scheme: dark)` block for native text color, dropdown bg, clicked highlight
12. **ErrorBoundary** — class component wrapping `<AppInner />` in App.tsx

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

Phases 1-13 are defined there. All functionality has been implemented. The 12-fix audit plan is at: `.claude/plans/enumerated-moseying-wirth.md` — all fixes applied and verified.

## Key Files

| File | Purpose |
|---|---|
| `src/App.tsx` | Route tree with inline guards, ErrorBoundary wrapper |
| `src/context/AuthContext.tsx` | Auth state, login, logout, token refresh |
| `src/hooks/useWordClickModal.ts` | Word click → dictionary lookup → modal |
| `src/hooks/useDictionary.ts` | Dictionary search with pagination |
| `src/hooks/useSpeechSynthesizer.ts` | Text-to-speech |
| `src/components/WordClickModal.tsx` | Word definition bottom sheet |
| `src/components/HashtagModal.tsx` | Hashtag occurrences bottom sheet |
| `src/components/ArticleBody.tsx` | HTML article renderer with click capture |
| `src/components/ErrorBoundary.tsx` | React error boundary with reload button |
| `src/global.css` | All custom CSS (dictionary, dropdowns, dark mode) |
| `src/lib/flashcard.ts` | Flashcard formatting with stable keys |
| `src/lib/indonesian-stemmer.ts` | Word stemming for dictionary lookup |
