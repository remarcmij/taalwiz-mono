import { ChangeDetectionStrategy, Component, input, OnInit, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonList,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-groups-modal',
  templateUrl: './groups-modal.component.html',
  styleUrl: './groups-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonCheckbox,
    IonFooter,
  ],
})
export class GroupsModalComponent implements OnInit {
  email = input.required<string>();
  availableGroups = input.required<string[]>();
  initialGroups = input<string[]>([]);

  selectedGroups = signal<string[]>([]);

  #modalCtrl = new ModalController();

  ngOnInit() {
    this.selectedGroups.set([...this.initialGroups()]);
  }

  isSelected(group: string): boolean {
    return this.selectedGroups().includes(group);
  }

  toggle(group: string, checked: boolean) {
    this.selectedGroups.update((groups) =>
      checked ? [...groups, group] : groups.filter((g) => g !== group)
    );
  }

  addAll() {
    this.selectedGroups.set([...this.availableGroups()]);
  }

  clearAll() {
    this.selectedGroups.set([]);
  }

  save() {
    this.#modalCtrl.dismiss(this.selectedGroups(), 'save');
  }

  cancel() {
    this.#modalCtrl.dismiss(null, 'cancel');
  }
}
