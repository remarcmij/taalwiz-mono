# Taalwiz API — Reference

## API Endpoints

All endpoints are under the global prefix `/api/v1/`. By default they require a valid JWT (`Authorization: Bearer <token>`), enforced by the global auth guard; endpoints marked **public** below are exempt (decorated with `@Public()`). Admin-only endpoints additionally require the `admin` role.

### Auth (`/api/v1/auth/`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/login` | **Public.** Login `{ email, password }`; returns access + refresh tokens |
| `POST` | `/api/v1/auth/refresh` | **Public.** Exchange refresh token for a new access token `{ refreshToken }` |
| `POST` | `/api/v1/auth/validate-regtoken` | **Public.** Validate a registration/invite token `{ email, token }` |

### Users (`/api/v1/users`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/users` | **Admin.** List all users (with `id` and `groups`) |
| `POST` | `/api/v1/users/invite` | **Admin.** Invite a new user `{ email, lang }`; emails a registration token |
| `POST` | `/api/v1/users/register` | **Public.** Register from an invite `{ email, password, name, token }` |
| `POST` | `/api/v1/users/request-password-reset` | **Public.** Request a reset email `{ email }` |
| `POST` | `/api/v1/users/reset-password` | **Public.** Reset password via emailed token `{ newPassword, token }` (204) |
| `POST` | `/api/v1/users/change-password` | Change own password `{ email, password, newPassword }` (204) |
| `PATCH` | `/api/v1/users/me/lang` | Set own UI language `{ lang }` (204) |
| `POST` | `/api/v1/users/contact` | Send a contact message `{ email, message }` |
| `PATCH` | `/api/v1/users/:id/groups` | **Admin.** Set a user's content groups `{ groups: string[] }` |
| `PATCH` | `/api/v1/users/:id/suspended` | **Admin.** Suspend/unsuspend `{ isSuspended }` (204; cannot target self) |
| `PATCH` | `/api/v1/users/:id/password` | **Admin.** Set another user's password `{ newPassword }` (204; cannot target self) |
| `DELETE` | `/api/v1/users/:id` | **Admin.** Delete a user (404 if not found) |

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
| `POST` | `/api/v1/vocabulary` | Add items `{ items: [{ term, lang, listId, back? }] }` (1–1000); each upserted (no-op on duplicate). Single adds send a one-element list (204) |
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

### Content (`/api/v1/content`)

Read endpoints are scoped to the calling user's authorized content groups. See [Content File Uploads](#content-file-uploads) below for the upload file formats.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/content/index` | Publication index visible to the current user |
| `GET` | `/api/v1/content/manifest` | Full content manifest for the current user |
| `GET` | `/api/v1/content/:groupName` | Article topics within a publication group |
| `GET` | `/api/v1/content/article/:filename` | A single article's content (404 if not found/authorized) |
| `POST` | `/api/v1/content/upload` | **Admin.** Upload an article, dictionary, or image file (multipart `file`) |
| `POST` | `/api/v1/content/reprocess-hashtags` | **Admin.** Re-extract hashtags across all articles |
| `GET` | `/api/v1/content/groups` | **Admin.** List all content groups |
| `DELETE` | `/api/v1/content/:filename` | **Admin.** Delete a topic/article (404 if not found) |

### Hashtags (`/api/v1/hashtags`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/hashtags` | Hashtag index across the current user's authorized articles |
| `GET` | `/api/v1/hashtags/usage` | **Admin.** Hashtag usage counts across all articles |
| `GET` | `/api/v1/hashtags/:name` | Articles carrying the given hashtag |

### Health (`/api/v1/health`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | **Public.** Liveness probe: `{ status, uptime, timestamp, database }` |

---

## Content File Uploads

### Articles

The API supports uploading content article files in markdown format. The content files are expected to be in the format of `group.name.md`, where `group` is a string that represents the group of the article, and `name` is a string that represents the name of the article. For example, `english.hello-world.md` would be an article in the `english` group with the name `hello-world`.

**Help articles:** `help.en.md` and `help.nl.md` live in `src/content/seeds/` and are the source of truth for the `/help/{lang}` pages. They are copied into `dist/` as build assets (`nest-cli.json`) and seeded into the database automatically on startup (`ContentService.onApplicationBootstrap`), so a fresh or reset database always has working help pages without a manual upload. Seeding is idempotent via an MD5 checksum: an unchanged file is a no-op, and editing a seed file refreshes the stored copy on the next restart. To change help content, edit these files (not via a one-off admin upload, which a later restart would overwrite).

### Dictionary Files

The API also supports uploading dictionary files in JSON format. The dictionary files are expected to be in the format of `group.<letter>.json`, where `group` is a string that represents the group of the dictionary, and `<letter>` is a letter a-z that represents the section of the dictionary for that letter. For example, `english.d.json` would be a dictionary in the `english` group for the letter `d`.

### Publication Images

The upload endpoint also accepts publication images (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`), detected by file extension. These are written to `public/assets/images/` and served at `/assets/images/`. A publication's manifest references its image by full filename via the `image:` front-matter field.
