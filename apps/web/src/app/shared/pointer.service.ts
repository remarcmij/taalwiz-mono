import { Injectable, computed, signal } from '@angular/core';

/**
 * Tells the UI whether to say "tap" (touch) or "click" (mouse/trackpad).
 *
 * The primary pointer is `coarse` on phones/tablets (touch) and `fine` on
 * desktop/laptop. Evaluated once: the pointer class does not meaningfully change at
 * runtime, and a wrong guess only swaps a verb. Exposes `actionKey` for `{{action}}`
 * interpolation in translated strings, e.g.
 *   {{ 'study.show-answer' | translate: { action: pointer.actionKey() | translate } }}
 */
@Injectable({ providedIn: 'root' })
export class PointerService {
  readonly isTouch = signal<boolean>(
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );

  /** ngx-translate key for the verb: "Tap" on touch, "Click" on desktop. */
  readonly actionKey = computed(() =>
    this.isTouch() ? 'common.action-tap' : 'common.action-click',
  );
}
