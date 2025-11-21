import { Injectable } from '@nestjs/common';
import Hashtag from '../content/models/hashtag.model.js';
import { ITopic } from '../content/models/topic.model.js';
import { HashTagGroup } from './types/hashtag.type.js';

@Injectable()
export class HashtagService {
  async getHashtagIndex() {
    const hashtagGroups = (await Hashtag.aggregate([
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
    ]).exec()) as HashTagGroup[];

    hashtagGroups.forEach((group) => {
      group.tags.sort((a, b) => a.name.localeCompare(b.name));
    });

    return hashtagGroups;
  }

  async findHashtag(name: string) {
    const hashtags = await Hashtag.find({ name })
      .populate<{ _topic: ITopic }>('_topic')
      .lean();

    return hashtags.map((hashtag) => ({
      id: hashtag.id,
      publicationTitle: hashtag.publicationTitle,
      articleTitle: hashtag._topic.title,
      sectionHeader: hashtag.sectionHeader,
      filename: hashtag._topic.filename,
    }));
  }
}
