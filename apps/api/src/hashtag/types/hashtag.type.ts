export type HashTagName = {
  name: string;
  count: number;
};

export type HashTagGroup = {
  _id: string;
  tags: HashTagName[];
};
