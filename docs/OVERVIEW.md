# Taalwiz: An Open-Source Indonesian-Dutch Language Learning Platform

**Repository:** https://github.com/remarcmij/taalwiz-mono  
**Contact:** Jim Cramer, remarcmij@gmail.com  

---

## Overview

Taalwiz is an open-source, self-hostable web application for Dutch speakers learning Indonesian. I first built it about ten years ago, out of a personal interest in both Indonesian and software development, and have kept improving it ever since. Over that time it has grown to combine structured reading, dictionary lookup, vocabulary management, and spaced-repetition review in a single workflow.

The application is freely available under an open-source licence. There is no vendor lock-in: institutions can host it on their own infrastructure, adapt it to their content, and own their data entirely. I am now retired and happy to give my time to see it put to good use.

---

## The Learning Workflow

For me, the value of Taalwiz lies in an integrated pipeline that follows the way I believe vocabulary is best learned:

1. **Read**: learners work through structured texts (articles, chapters, books) in the Library tab.
2. **Look up**: tapping any highlighted word opens a dictionary panel showing the Dutch translation. The app resolves inflected forms to their dictionary entry (see Handling Inflected Words, below).
3. **Bookmark**: with one tap, the word is saved to a personal vocabulary list, in context.
4. **Review**: the Vocabulary tab presents saved words as flashcards using **Spaced Repetition (SRS)**. Cards that a learner finds difficult are shown again sooner; well-known cards are spaced further into the future. The rating scale (Again / Good / Easy) follows established SRS methodology.

![A spaced-repetition flashcard with the Again / Good / Easy rating buttons](images/srs-card.png)
*A spaced-repetition review card with the Again / Good / Easy ratings.*

This pipeline, from encountering a word in authentic reading material to its scheduled review, is available offline once content and the dictionary have been downloaded to the device. The app installs directly from the browser onto a phone, tablet, or computer (no app store required) and continues to work without an internet connection.

![A reading text with a tapped word showing its dictionary translation](images/reading-lookup.png)
*Reading view: tapping a word opens its dictionary entry.*

---

## Handling Inflected Words

### How It Works

Rather than committing to a single canonical root, the app generates an ordered set of plausible base-form candidates and checks them against the on-device dictionary in sequence, stopping at the first match. The ordering is deliberate: the original form is tried first (in case it is indexed directly), followed by the most common active-voice forms (which the dictionary is most likely to contain), and finally stripped roots as a last resort.

**Example**: a learner taps _memperbaiki_ ("to repair"). The app peels the layers in turn (meN-, then per-, then the suffix -i) to reach the root _baik_, and shows the dictionary entry grouped under that headword. The ordering matters: per- is tried before the shorter pe-, which would otherwise mis-parse the word.

![A conjugated form resolved to its dictionary headword](images/inflection-resolution.png)
*An inflected form resolved to its root lemma.*

### Affixes Handled

The app strips a range of common affixes when generating candidate forms:

- Suffixes: -nya, -ku, -mu, -kan, -i, -an, -kah, -lah, -pun
- Prefixes: di-, ber-, ter-, se-, ke-, ku-, kau-, and the meN- and peN- families (mem-, men-, meny-, meng-, pem-, pen-, peny-, peng-)
- Circumfixes: ke-...-an, per-...-an, pe-...-an
- Reduplication, e.g. _anak-anak_ → _anak_

Stripping is recursive, so multi-affix words are reduced step by step. Where a prefix drops or assimilates the root's initial consonant (as in _memotong_, from _potong_), the app also generates restored candidates. It is a best-effort heuristic, not a full morphological analyser, and a small exemption list covers common words that do not follow the regular patterns. The morphological handling is mine to change, and I would gladly refine it on a linguist's advice.

---

## Searching and Reverse Lookup

Besides tapping words while reading, learners can search the dictionary directly. A search returns every entry in which the word appears, not only the main lemma, so compound expressions and worked examples surface alongside the primary definition.

The search also works in reverse. The Teeuw dictionary is one-directional, from Indonesian to Dutch, but typing a Dutch word finds all the Indonesian entries whose translations contain it. This gives learners a practical Dutch-to-Indonesian lookup on a dictionary that was never built to provide one.

![A Dutch search term returning the Indonesian entries that contain it](images/reverse-search.png)
*Reverse lookup: a Dutch word finds the Indonesian entries it appears in.*

---

## The Dictionary

The dictionary currently in use is based on the *Indonesisch-Nederlands Woordenboek* by A. Teeuw (Leiden: KITLV, 2009; ISBN 978-90-6718-100-6), which I digitised by hand from the print edition. This was a substantial undertaking: over several weeks I scanned the printed text and corrected the OCR output by hand, marking up the Indonesian entries so that the app can recognise and link them. The text is held as structured, plain Markdown, a form that lends itself to future correction, revision, or extension by editors or linguists, should the rights-holder ever wish to. Access to the app is currently restricted to a small private group, and the digitised dictionary is kept in a separate, private repository: the public open-source repository holds the software only, not the dictionary data.

The software is my own work and is offered freely under the permissive MIT licence. The dictionary is a separate matter. According to the printed edition the copyright rests with the KITLV (Koninklijk Instituut voor Taal-, Land- en Volkenkunde) in Leiden; how those rights stand today I do not know. I am of course aware that this question would need to be resolved before any wider use, and I do not expect to take that on myself.

The copy I digitised is the sixth printing (2009), though the text itself was last revised in the fourth edition of 1996; as far as I can tell it is no longer available new, with only second-hand copies turning up online.

---

## Technical Summary

| Component | Technology |
|---|---|
| Backend API | NestJS 11, MongoDB, JWT authentication |
| Web / mobile app | Angular 20, Ionic 8 |
| Offline support | Service Worker caching; full dictionary stored on device |
| Content format | Markdown files compiled to JSON via a purpose-built tool |
| Deployment | Self-hosted; modest server requirements |
| Licence | MIT (permissive open source) |

Content, both reading articles and dictionary entries, is authored in Markdown and compiled to JSON. This means that subject-matter experts (linguists, course developers) can create and update content using familiar tools, without requiring software development skills for the authoring step itself.

---

## Open Source and Institutional Use

Taalwiz is published as an open-source project at **github.com/remarcmij/taalwiz-mono**. Institutions are free to:

- Deploy and operate the platform on their own infrastructure
- Contribute or commission improvements to the codebase
- Adapt the content pipeline for their own course materials
- Fork the project for specialised purposes

### Setup and support

I would expect the institution's own IT department to own the deployment, hosting, and day-to-day administration of the platform. I am happy to help with the initial setup and to answer technical questions during that process, and to remain reachable for the occasional question afterwards. This is not a commercial arrangement: I simply want to see the platform used well in a wider community.

---

## What Would a Pilot Need?

Taalwiz is intended as a self-directed study aid: students use it on their own initiative alongside their course, not as a managed classroom tool. The institution's role is simply to make it available; how much students use it is up to them.

A first trial can be very small and needs almost nothing. I can give a lecturer and a handful of students access to my own running instance, within the private group I already maintain, so they can try it for themselves. The outcome I would value most is honest feedback on what works and what is missing.

A wider or permanent deployment is a larger step, and three things would need to be in place:

- **Dictionary**: the rights position for the Teeuw *Indonesisch-Nederlands Woordenboek* would need to be settled. This is best handled internally and is a prerequisite for a broad rollout, though not for a small private trial.
- **Content**: the institution would provide its own reading materials, authored in Markdown using the existing content pipeline.
- **Hosting**: a server or cloud instance; the application has modest requirements.

---

## Contact

I would welcome an exploratory conversation with no obligations on either side, and am happy to demonstrate the app live on request.

**Jim Cramer**  
Retired software developer  
Amstelveen, the Netherlands  
remarcmij@gmail.com  
https://github.com/remarcmij/taalwiz-mono
