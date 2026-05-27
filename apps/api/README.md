# Taalwiz API

The NestJS 11 backend for Taalwiz. It exposes a JWT-secured REST API (Express platform, MongoDB/Mongoose) covering authentication, vocabulary lists and items, user preferences, SRS flashcards, and admin settings. It also ingests uploaded content articles (Markdown) and dictionary sections (JSON), and sends transactional email via Nodemailer with Handlebars templates.

## Configuration

The API reads its configuration from a `.env` file in this directory. Copy the template and fill in the values before starting:

```bash
cp .env.example .env
```

All variables are validated on startup — the server will not boot if a required one is missing.

## More

- [API.md](./API.md) — endpoint reference and content/dictionary upload formats
- [CLAUDE.md](../../CLAUDE.md) — development commands & conventions
