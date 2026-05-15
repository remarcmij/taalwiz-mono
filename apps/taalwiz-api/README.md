# Taalwiz API

## API Endpoints

All user-facing endpoints are under `/api/v1/` and require a valid JWT (`Authorization: Bearer <token>`), enforced by the global auth guard. Admin endpoints are under `/api/admin/`.

### Auth (`/api/v1/auth/`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/login` | Login; returns access + refresh tokens |
| `POST` | `/api/v1/auth/refresh` | Exchange refresh token for new access token |
| `POST` | `/api/v1/auth/logout` | Invalidate refresh token |

### Bookmark Lists (`/api/v1/bookmarks/lists`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/bookmarks/lists` | List all lists with word counts; auto-creates "Favorites" for new users |
| `POST` | `/api/v1/bookmarks/lists` | Create list `{ name }`; returns `{ id, name, count }` |
| `DELETE` | `/api/v1/bookmarks/lists/:id` | Delete list and all its bookmarks (204) |
| `PATCH` | `/api/v1/bookmarks/lists/:id` | Rename list `{ name }` (204) |

### Bookmarks (`/api/v1/bookmarks`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/bookmarks?listId=<id>` | List bookmarks in the specified list, sorted by `savedAt` desc |
| `POST` | `/api/v1/bookmarks` | Add bookmark `{ word, lang, listId }`; upsert (no-op on duplicate) |
| `DELETE` | `/api/v1/bookmarks?word=&lang=&listId=<id>` | Remove a bookmark |

### User Preferences (`/api/v1/user-preferences`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/user-preferences` | Get `{ currentBookmarkListId }` |
| `PATCH` | `/api/v1/user-preferences` | Set `{ currentBookmarkListId }` (204) |

### SRS Flashcards (`/api/v1/srs`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/srs/due?listId=<id>` | Cards due for review today in the specified list |
| `GET` | `/api/v1/srs/stats` | Per-list counts `{ listId, due, new, total }[]` for all lists |
| `POST` | `/api/v1/srs/review` | Submit rating `{ word, lang, listId, rating: 'again'\|'good'\|'easy' }`; returns `{ dueDate }` |

---

## Content File Uploads

### Articles

The API supports uploading content article files in markdown format. The content files are expected to be in the format of `group.name.md`, where `group` is a string that represents the group of the article, and `name` is a string that represents the name of the article. For example, `english.hello-world.md` would be an article in the `english` group with the name `hello-world`.

### Dictionary Files

The API also supports uploading dictionary files in JSON format. The dictionary files are expected to be in the format of `group.<letter>.json`, where `group` is a string that represents the group of the dictionary, and `<letter>` is a letter a-z that represents the section of the dictionary for that letter. For example, `english.d.json` would be a dictionary in the `english` group for the letter `d`.
