import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { ContentService } from '../content.service';
import { type ITopic } from '../topic.model';

export const publicationsIndexResolver: ResolveFn<ITopic[]> = (
  route: ActivatedRouteSnapshot
) => {
  return inject(ContentService).fetchPublicationTopics(
    route.paramMap.get('groupName')!
  );
};
