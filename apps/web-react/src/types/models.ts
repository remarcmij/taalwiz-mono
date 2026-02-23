// Auth models
export type Role = 'user' | 'admin' | 'demo';

export class User {
  constructor(
    public id: string,
    public email: string,
    public name: string,
    public lang: string,
    public roles: Role[] = ['user'],
    public refreshToken: string,
    public refreshExp: number,
    public created?: Date,
    public lastAccessed?: Date,
  ) {}
}

// Content models
export interface ITopic {
  _id: string;
  author: string;
  baseLang: string;
  categories: string;
  copyright: string;
  filename: string;
  foreignLang: string;
  groupName: string;
  hash: string;
  isbn: string;
  lastModified: number;
  published: string;
  publication: string;
  publisher: string;
  sortIndex: number;
  subtitle: string;
  targetLang: string;
  title: string;
  type: 'index' | 'article' | 'dict';
}

export interface IArticle {
  _id: string;
  _topic: string;
  baseLang: string;
  filename: string;
  foreignLang: string;
  groupName: string;
  htmlText: string;
  mdText: string;
  publication: string;
  title: string;
}

// Dictionary models
export interface ILemma {
  _id: string;
  word: string;
  lang: string;
  baseWord: string;
  baseLang: string;
  text: string;
  homonym: number;
}

export class WordLang {
  public _id?: string;

  constructor(
    public word: string,
    public lang: string,
  ) {}

  get key() {
    return this.word + ':' + this.lang;
  }
}

export class LookupResult {
  targetBase: WordLang | null = null;
  bases: WordLang[] = [];
  lemmas: Record<string, ILemma[]> = {};
  haveMore = false;
}

export interface LookupResponse {
  word: string;
  lang: string;
  lemmas: ILemma[];
  haveMore: boolean;
}

// Hashtag models
export interface IHashtag {
  id: string;
  name: string;
  publicationTitle: string;
  articleTitle: string;
  sectionHeader: string;
  filename: string;
}

export interface HashtagGroup {
  _id: string;
  tags: { name: string; count: number }[];
}

// System settings
export type ValueType = 'string' | 'number' | 'date' | 'boolean';

export interface ISystemSettings {
  _id: string;
  name: string;
  label: string;
  valueType: ValueType;
  stringVal?: string;
  numberVal?: number;
  dateVal?: Date;
  booleanVal?: boolean;
  sortIndex: number;
}

// Auth API response types
export interface AuthResponseData {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  lang: string;
  refreshToken: string;
  refreshExp: string;
}

export interface TokenResponseData {
  token: string;
  exp: string;
}

// Flashcard types
export interface Flashcard {
  key: number;
  title?: string;
  prompt: FlashcardText;
  answer: FlashcardText;
}

export interface FlashcardText {
  text: string;
  lang: string;
  isForeign: boolean;
}

export interface FlashcardData {
  index: number;
  foreignText: string;
  nativeText: string;
}

export interface FlashcardSection {
  title: string;
  flashcards: FlashcardData[];
}

export type FlashcardMode = 'foreignFirst' | 'nativeFirst';

// Shared error constants
export const MIN_PASSWORD_LENGTH = 6;
export const AUTH_FAILED = 'AUTH_FAILED';
export const CODE_INVALID = 'CODE_INVALID';
export const EMAIL_MISMATCH = 'EMAIL_MISMATCH';
export const CODE_EXPIRED = 'CODE_EXPIRED';
export const EMAIL_EXISTS = 'EMAIL_EXISTS';
export const EMAIL_NOT_FOUND = 'EMAIL_NOT_FOUND';
export const PASSWORD_INCORRECT = 'PASSWORD_INCORRECT';
export const CODE_DELETE_FAILED = 'CODE_DELETE_FAILED';
export const INVALID_PASSWORD = 'INVALID_PASSWORD';
export const NO_USER = 'NO_USER';
export const NO_TOKEN = 'NO_TOKEN';
export const USER_NOT_FOUND = 'USER_NOT_FOUND';
export const TOKEN_INVALID = 'TOKEN_INVALID';
export const OK = 'OK';
