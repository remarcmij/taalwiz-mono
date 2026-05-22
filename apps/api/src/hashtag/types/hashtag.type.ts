export interface HashTagName {
  name: string;
  count: number;
}

export interface HashTagGroup {
  _id: string;
  tags: HashTagName[];
}
