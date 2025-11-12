import { NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

// export function createTranslateLoader(http: HttpClient) {
//   return new TranslateHttpLoader(http, './assets/i18n/', '.json');
// }

@NgModule({
  declarations: [],
  imports: [
    // TranslateModule.forChild({
    //   loader: {
    //     provide: TranslateLoader,
    //     useFactory: createTranslateLoader,
    //     deps: [HttpClient],
    //   },
    // }),
  ],
  exports: [TranslateModule],
})
export class SharedModule {}
