export interface HashTagName {
  name: string;
  count: number;
}

export interface HashTagGroup {
  _id: string;
  tags: HashTagName[];
}

export interface HashtagUsage {
  name: string;
  articles: number;
  occurrences: number;
}
