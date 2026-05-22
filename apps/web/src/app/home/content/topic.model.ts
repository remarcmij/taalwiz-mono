export interface ITopic {
  _id: string;
  author: string;
  categories: string;
  copyright: string;
  filename: string;
  groupName: string;
  sha: string;
  isbn: string;
  lastModified: number;
  publicationYear: number;
  publication: string;
  publisher: string;
  sortIndex: number;
  subtitle: string;
  targetLang: string;
  title: string;
  type: 'index' | 'article' | 'dict';
}
