# Taalwiz API

## API Endpoints

All user-facing endpoints are under `/api/v1/` and require a valid JWT (`Authorization: Bearer <token>`), enforced by the global auth guard. Admin-only endpoints are also under `/api/v1/` and additionally require the `admin` role.

### Auth (`/api/v1/auth/`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/login` | Login; returns access + refresh tokens |
| `POST` | `/api/v1/auth/refresh` | Exchange refresh token for new access token |
| `POST` | `/api/v1/auth/logout` | Invalidate refresh token |

### Vocabulary Lists (`/api/v1/vocabulary/lists`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/vocabulary/lists` | List all lists with item counts; auto-creates "Favorites" for new users |
| `POST` | `/api/v1/vocabulary/lists` | Create list `{ name }`; returns `{ id, name, count }` |
| `DELETE` | `/api/v1/vocabulary/lists/:id` | Delete list and all its items (204) |
| `PATCH` | `/api/v1/vocabulary/lists/:id` | Rename list `{ name }` (204) |

### Vocabulary (`/api/v1/vocabulary`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/vocabulary?listId=<id>` | List items in the specified list, sorted by `savedAt` desc |
| `POST` | `/api/v1/vocabulary` | Add item `{ term, lang, listId, back? }`; upsert (no-op on duplicate) |
| `DELETE` | `/api/v1/vocabulary?term=&lang=&listId=<id>` | Remove an item |

### User Preferences (`/api/v1/user-preferences`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/user-preferences` | Get `{ currentVocabularyListId }` |
| `PATCH` | `/api/v1/user-preferences` | Set `{ currentVocabularyListId }` (204) |

### SRS Flashcards (`/api/v1/srs`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/srs/due?listId=<id>` | Cards due for review today in the specified list; response includes `back` field when set |
| `GET` | `/api/v1/srs/stats` | Per-list counts `{ listId, due, new, total }[]` for all lists |
| `POST` | `/api/v1/srs/review` | Submit rating `{ term, lang, listId, rating: 'again'\|'good'\|'easy' }`; returns `{ dueDate }` |

### System Settings (`/api/v1/admin/settings`) — admin only

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/settings` | Return all settings sorted by `sortIndex` |
| `PATCH` | `/api/v1/admin/settings` | Update settings `{ settings: ISystemSettings[] }`; returns updated list |

Settings are seeded on first startup from `src/admin-settings/seeds/settings.seed.ts` (three initial entries: `custodian_name`, `customer_service_email`, `email_opt_out`).

---

## Content File Uploads

### Articles

The API supports uploading content article files in markdown format. The content files are expected to be in the format of `group.name.md`, where `group` is a string that represents the group of the article, and `name` is a string that represents the name of the article. For example, `english.hello-world.md` would be an article in the `english` group with the name `hello-world`.

### Dictionary Files

The API also supports uploading dictionary files in JSON format. The dictionary files are expected to be in the format of `group.<letter>.json`, where `group` is a string that represents the group of the dictionary, and `<letter>` is a letter a-z that represents the section of the dictionary for that letter. For example, `english.d.json` would be a dictionary in the `english` group for the letter `d`.
