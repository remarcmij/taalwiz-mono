import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { map } from 'rxjs/operators';

import { BackButtonComponent } from '../../../shared/back-button/back-button.component';
import { type ITopic } from '../topic.model';

@Component({
  selector: 'app-publication',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    RouterLink,
    BackButtonComponent,
  ],
  templateUrl: './publication.page.html',
  styleUrls: ['./publication.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicationPage {
  #route = inject(ActivatedRoute);

  #topics$ = this.#route.data.pipe(map(({ topics }) => topics));

  #topics: Signal<ITopic[]> = toSignal(this.#topics$, {
    initialValue: [] as ITopic[],
  });

  topics = computed(() =>
    this.#topics().filter((topic) => topic.type === 'article'),
  );

  publicationTitle = computed(
    () =>
      this.#topics().find((topic) => topic.type === 'index')?.title ||
      'Publication',
  );
}
