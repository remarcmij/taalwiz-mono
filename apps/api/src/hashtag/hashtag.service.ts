import { Injectable } from '@nestjs/common';
import type { PipelineStage } from 'mongoose';
import { authorizedGroups } from '../auth/authorized-groups.js';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import Hashtag from '../content/models/hashtag.model.js';
import { TopicDoc } from '../content/models/topic.model.js';
import { HashTagGroup } from './types/hashtag.type.js';

@Injectable()
export class HashtagService {
  async getHashtagIndex(user: JwtPayload) {
    const groups = authorizedGroups(user);
    const pipeline: PipelineStage[] = [];

    if (groups) {
      pipeline.push({ $match: { groupName: { $in: groups } } });
    }

    pipeline.push(
      { $group: { _id: '$name', count: { $sum: 1 } } },
      {
        $group: {
          _id: { $toUpper: { $substr: ['$_id', 0, 1] } },
          tags: { $push: { name: '$_id', count: '$count' } },
        },
      },
      { $sort: { _id: 1 } }
    );

    const hashtagGroups: HashTagGroup[] = await Hashtag.aggregate(pipeline).exec();
    hashtagGroups.forEach((group) => {
      group.tags.sort((a, b) => a.name.localeCompare(b.name));
    });
    return hashtagGroups;
  }

  async findHashtag(name: string, user: JwtPayload) {
    const groups = authorizedGroups(user);
    const query: Record<string, unknown> = { name };
    if (groups) query.groupName = { $in: groups };

    const hashtags = await Hashtag.find(query).populate<{ _topic: TopicDoc }>('_topic').lean();

    return hashtags.map((hashtag) => ({
      id: hashtag.id,
      publicationTitle: hashtag.publicationTitle,
      articleTitle: hashtag._topic.title,
      sectionHeader: hashtag.sectionHeader,
      filename: hashtag._topic.filename,
    }));
  }
}
