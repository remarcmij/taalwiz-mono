import { Injectable, signal } from '@angular/core';

import { type IHeading } from './extract-headings.util';

@Injectable({ providedIn: 'root' })
export class TocService {
  readonly headings = signal<IHeading[]>([]);
  readonly scrollToId = signal<string | null>(null);
}
