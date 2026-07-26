import { Injectable, signal } from '@angular/core';

import { type Heading } from './extract-headings.util';

@Injectable({ providedIn: 'root' })
export class TocService {
  readonly headings = signal<Heading[]>([]);
  readonly scrollToId = signal<string | null>(null);
}
