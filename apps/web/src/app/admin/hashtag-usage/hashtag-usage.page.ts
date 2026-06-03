import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { copyOutline, downloadOutline, printOutline } from 'ionicons/icons';

import { BackButtonComponent } from '../../shared/back-button/back-button.component';
import { AdminService } from '../admin.service';
import { IHashtagUsage } from './hashtag-usage.model';

@Component({
  selector: 'app-hashtag-usage',
  imports: [
    BackButtonComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonTitle,
    IonContent,
    IonIcon,
    IonSearchbar,
  ],
  templateUrl: './hashtag-usage.page.html',
  styleUrls: ['./hashtag-usage.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HashtagUsagePage implements OnInit {
  #adminService = inject(AdminService);
  #toastCtrl = inject(ToastController);

  readonly usage = signal<IHashtagUsage[]>([]);
  readonly filter = signal('');
  readonly filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const all = this.usage();
    return q ? all.filter((u) => u.name.includes(q)) : all;
  });

  constructor() {
    addIcons({ copyOutline, downloadOutline, printOutline });
  }

  ngOnInit() {
    this.#adminService.getHashtagUsage().subscribe((usage) => this.usage.set(usage));
  }

  onSearch(value: string) {
    this.filter.set(value ?? '');
  }

  // Copy / download / print all use the full list (a glossary to hand to a
  // content creator), independent of the on-screen filter.
  async copy() {
    await navigator.clipboard.writeText(this.#toText());
    await this.#toast('Hashtag list copied to clipboard');
  }

  download() {
    const blob = new Blob([this.#toText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'taalwiz-hashtags.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // A dedicated print window avoids Ionic's shadow DOM / internal scroll, which
  // make in-place browser printing unreliable.
  print() {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.documentElement.innerHTML = this.#toPrintHtml();
    win.focus();
    win.print();
  }

  #toText(): string {
    const rows = this.usage();
    const width = rows.reduce((max, r) => Math.max(max, r.name.length), 0) + 2;
    const lines = rows.map(
      (r) =>
        `${r.name.padEnd(width)}${String(r.articles).padStart(3)} article(s)` +
        `${String(r.occurrences).padStart(5)} use(s)`,
    );
    const date = new Date().toISOString().slice(0, 10);
    return [`Taalwiz hashtags (${rows.length} tags), ${date}`, '', ...lines, ''].join('\n');
  }

  #toPrintHtml(): string {
    const rows = this.usage();
    const date = new Date().toISOString().slice(0, 10);
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const body = rows
      .map(
        (r) =>
          `<tr><td>${esc(r.name)}</td><td class="num">${r.articles}</td>` +
          `<td class="num">${r.occurrences}</td></tr>`,
      )
      .join('');
    return (
      `<head><meta charset="utf-8"><title>Taalwiz hashtags</title>` +
      `<style>body{font-family:system-ui,-apple-system,sans-serif;margin:2rem;color:#1a1a1a}` +
      `h1{font-size:1.1rem;margin-bottom:1rem}table{border-collapse:collapse;width:100%;font-size:0.9rem}` +
      `th,td{text-align:left;padding:3px 16px 3px 0;border-bottom:1px solid #ddd}` +
      `th.num,td.num{text-align:right}</style></head><body>` +
      `<h1>Taalwiz hashtags (${rows.length} tags), ${date}</h1>` +
      `<table><thead><tr><th>Tag</th><th class="num">Articles</th><th class="num">Uses</th></tr></thead>` +
      `<tbody>${body}</tbody></table></body>`
    );
  }

  async #toast(message: string) {
    const toast = await this.#toastCtrl.create({ message, duration: 1500, position: 'bottom' });
    await toast.present();
  }
}
