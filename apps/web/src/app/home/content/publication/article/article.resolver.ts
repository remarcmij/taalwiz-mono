import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  ResolveFn,
  RouterStateSnapshot,
} from '@angular/router';
import { ContentService } from '../../content.service';
import { type IArticle } from './article.model';

export const articleResolver: ResolveFn<IArticle | null> = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  return inject(ContentService).fetchArticle(route.paramMap.get('filename')!);
};
