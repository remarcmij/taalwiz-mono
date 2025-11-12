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
