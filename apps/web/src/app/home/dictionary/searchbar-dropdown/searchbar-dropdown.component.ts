import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

import { langConfig } from '../../../app.constants';
import { WordLang } from '../word-lang.model';

// TODO Find a way to animate the dropdown

@Component({
  selector: 'app-searchbar-dropdown',
  imports: [NgClass, IonList, IonItem, IonLabel],
  templateUrl: './searchbar-dropdown.component.html',
  styleUrls: ['./searchbar-dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchbarDropdownComponent {
  suggestions = input.required<WordLang[]>();
  showSearches = input.required<boolean>();
  suggestionClicked = output<WordLang>();

  protected readonly targetLang = langConfig.targetLang;
}
