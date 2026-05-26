export interface ITopic {
  _id: string;
  articles?: string[];
  author: string;
  categories: string;
  copyright: string;
  filename: string;
  groupName: string;
  groups?: string[];
  image?: string;
  sha: string;
  isbn: string;
  lastModified: number;
  publicationYear: number;
  publication: string;
  publisher: string;
  subtitle: string;
  targetLang: string;
  title: string;
  type: 'main' | 'manifest' | 'article' | 'dict';
}
