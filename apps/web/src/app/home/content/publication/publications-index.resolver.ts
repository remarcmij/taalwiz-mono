import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  ResolveFn,
  RouterStateSnapshot,
} from '@angular/router';
import { ContentService } from '../content.service';
import { type ITopic } from '../topic.model';

export const publicationsIndexResolver: ResolveFn<ITopic[]> = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  return inject(ContentService).fetchPublicationTopics(
    route.paramMap.get('groupName')!,
  );
};
