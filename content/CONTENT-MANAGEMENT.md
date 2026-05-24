# Content Management Guide

This guide describes how to create, organise, and publish content in Taalwiz. Content is managed as plain Markdown files that are uploaded through the admin interface.

---

## Overview

Content is organised in **publications**. Each publication is a named group of articles — for example, a language course or a reference guide. Three types of file exist:

| File | Purpose |
|---|---|
| `main.manifest.md` | Lists all publications and their display order |
| `{group}.manifest.md` | Describes one publication and lists its articles in order |
| `{group}.{name}.md` | One article belonging to a publication |

All files are Markdown with a YAML front matter block enclosed by `---` lines.

---

## File Naming

The **group name** is the short identifier for a publication (e.g. `indonesian`, `grammar-ref`). It must be lowercase, use only letters, digits, and hyphens, and must not be `main` (that is reserved).

| File type | Example |
|---|---|
| Main manifest | `main.manifest.md` |
| Group manifest | `indonesian.manifest.md` |
| Article | `indonesian.intro.md` |
| Article | `indonesian.verb-forms.md` |

The part after the group name and before `.md` is the article's **short name** (e.g. `intro`, `verb-forms`). It must be unique within the group and must not be `manifest`.

---

## The Main Manifest (`main.manifest.md`)

The main manifest controls which publications exist and in what order they appear in the app.

```markdown
---
groups:
  - indonesian
  - grammar-ref
  - dutch-basics
---
```

**Front matter fields:**

| Field | Required | Description |
|---|---|---|
| `groups` | Yes | Ordered list of group names. Display order follows this list. |

The file has no body text.

**To add a publication:** add its group name to the `groups` list, then upload the updated `main.manifest.md` together with the corresponding `{group}.manifest.md`.

**To remove a publication:** remove its group name from the list and upload the updated file. The publication's articles become orphans (they remain in the database but are no longer shown). Use the admin orphan tool to delete them.

**To reorder publications:** change the order in the `groups` list and re-upload the file.

---

## Group Manifests (`{group}.manifest.md`)

Each publication has one group manifest. It carries the publication's metadata and the ordered list of its articles. The body text (below the closing `---`) becomes the **preface article** — the first article shown in the article list.

```markdown
---
title: Indonesian for Dutch Speakers
author: J. de Vries
targetLang: id
articles:
  - intro
  - greetings
  - numbers
  - verb-forms
---

# Welcome

This course introduces Indonesian to speakers of Dutch.
Work through the articles in order for the best results.
```

**Front matter fields:**

| Field | Required | Description |
|---|---|---|
| `title` | Yes (or H1 in body) | Publication title shown in the app |
| `articles` | Yes | Ordered list of article short names. Display order follows this list. |
| `targetLang` | No | BCP-47 language tag for the target language (e.g. `id`, `nl`) |
| `author` | No | Author name |
| `subtitle` | No | Short description shown under the title |
| `publisher` | No | Publisher name |
| `publicationYear` | No | Year of publication (integer) |
| `copyright` | No | Copyright notice |
| `isbn` | No | ISBN |

**To add an article:** add its short name to the `articles` list in the desired position, then upload the updated manifest and the new article file.

**To remove an article from the list:** remove its short name from `articles` and re-upload the manifest. The article file remains in the database as an orphan but is no longer shown. Use the admin orphan tool to delete it.

**To reorder articles:** change the order in the `articles` list and re-upload the manifest.

---

## Article Files (`{group}.{name}.md`)

Each article is a Markdown file with front matter. The body is standard Markdown.

```markdown
---
title: Greetings
subtitle: Common greetings and polite expressions
---

# Greetings

## Formal greetings

Use *Selamat pagi* in the morning...
```

**Front matter fields:**

| Field | Required | Description |
|---|---|---|
| `title` | No | Article title. If omitted, the first `# H1` heading is used. |
| `subtitle` | No | Short description. If omitted, all `## H2` headings are concatenated. |
| `targetLang` | No | Overrides the group's target language for this article |
| `author` | No | Author (if different from publication author) |

**Title and subtitle fallback rules:**

- If `title` is absent, the first `# Heading` in the body is used. If there is no H1 either, the title becomes `untitled`.
- If `subtitle` is absent, all `## Headings` are joined with ` • ` as the subtitle.

---

## Hashtags

Hashtags mark vocabulary or index terms within article text. They appear as clickable links in the app and feed the dictionary index.

### Syntax

Single-word tag — write `#` directly before the word:

```
The word #selamat means "greetings".
```

Multi-word tag — wrap in curly braces:

```
The phrase #{selamat pagi} means "good morning".
```

Tags are **case-insensitive** and are stored in lowercase. Tags must be at least two characters long.

Tags inside heading lines (lines beginning with `#`) are **not** indexed — they are treated as part of the heading.

### Requirements

Hashtag extraction requires the group manifest to exist in the database. If articles are uploaded before their group manifest, hashtags are not extracted at that point. When the group manifest is subsequently uploaded, the system automatically reprocesses all existing articles in the group and extracts their hashtags. No manual re-upload of articles is needed.

---

## Upload Workflow

Files are uploaded one at a time (or in a batch) via **Admin → Upload**. The system accepts `.md` and `.json` files. Upload order does not matter — the system handles any order correctly.

### First-time setup (new publication)

Upload all files in any order:

- `main.manifest.md`
- `{group}.manifest.md` for each publication
- All article files (`{group}.{name}.md`)

When a group manifest is processed, the system automatically reprocesses hashtag extraction for any articles of that group that are already in the database. Everything will be consistent once all files have been uploaded.

### Adding a new article to an existing publication

1. Write the article file `{group}.{name}.md`
2. Add the short name to the `articles` list in `{group}.manifest.md`
3. Upload both files in any order

### Reordering or updating articles

Edit the relevant manifest's `articles` list or update the article file and re-upload. The system uses an MD5 checksum; files whose content has not changed are silently skipped.

### Removing a publication

1. Remove the group name from `main.manifest.md` and upload it
2. Use the admin orphan tool to delete the group manifest and its articles from the database

---

## Orphaned Files

An **orphan** is a file that exists in the database but is not referenced by any manifest:

- An article whose short name has been removed from its group manifest
- A group manifest whose group name has been removed from `main.manifest.md`

Orphans are not shown to users. Use the admin orphan management tool to review and delete them.

---

## Markdown Reference

The body of every file supports standard Markdown:

- `# Heading 1` / `## Heading 2` / `### Heading 3`
- `**bold**`, `*italic*`
- `` `inline code` `` and fenced code blocks
- Ordered and unordered lists
- Blockquotes (`>`)
- Horizontal rules (`---`)
- Links: `[text](url)`

HTML is not permitted in article bodies.
