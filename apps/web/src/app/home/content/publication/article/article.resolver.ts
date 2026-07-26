import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, RouterStateSnapshot } from '@angular/router';
import { ContentService } from '../../content.service';
import { type Article } from './article.model';

export const articleResolver: ResolveFn<Article | null> = (
  route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot,
) => {
  return inject(ContentService).fetchArticle(route.paramMap.get('filename')!);
};
