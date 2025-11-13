import type { Request, Response } from 'express';
import { param } from 'express-validator';
import Hashtag from '../models/hashtag.model.js';
import type { ITopic } from '../models/topic.model.js';

type HashTagName = {
  name: string;
  count: number;
};

type HashTagGroup = {
  _id: string;
  tags: HashTagName[];
};

export const getHashtagIndex = async (req: Request, res: Response) => {
  // const groups = req.auth!.groups;
  // if (!groups.includes('admin')) {
  //   criterion.groupName = { $in: groups };
  // }

  try {
    const hashtagGroups: HashTagGroup[] = await Hashtag.aggregate([
      // {
      //   $match: criterion,
      // },
      {
        $group: {
          _id: '$name',
          count: {
            $sum: 1,
          },
        },
      },
      {
        $group: {
          _id: {
            $toUpper: {
              $substr: ['$_id', 0, 1],
            },
          },
          tags: {
            $push: {
              name: '$_id',
              count: '$count',
            },
          },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]).exec();

    hashtagGroups.forEach((group) => {
      group.tags.sort((a, b) => a.name.localeCompare(b.name));
    });

    res.json(hashtagGroups);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

export const searchHashTagsValidations = () => [param('name').notEmpty()];

type SearchHashTagsRequest = Request<{ name: string }>;

export const searchHashTags = async (
  req: SearchHashTagsRequest,
  res: Response
) => {
  const name = req.params.name;
  if (!name) {
    return void res.sendStatus(400);
  }

  const hashtags = await Hashtag.find({ name })
    .populate<{ _topic: ITopic }>('_topic')
    .lean();

  const items = hashtags.map((hashtag) => ({
    id: hashtag.id,
    publicationTitle: hashtag.publicationTitle,
    articleTitle: hashtag._topic?.title,
    sectionHeader: hashtag.sectionHeader,
    filename: hashtag._topic?.filename,
  }));

  res.json(items);
};
