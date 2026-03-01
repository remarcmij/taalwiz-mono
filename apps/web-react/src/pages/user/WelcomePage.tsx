import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { homeOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useArticle } from '../../api/content.api.ts';
import { sanitize } from '../../lib/sanitize.ts';

const WelcomePage: React.FC = () => {
  const { t } = useTranslation();
  const { lang } = useParams<{ lang: string }>();
  const { data: article } = useArticle(`welcome.${lang || 'en'}.md`);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton routerLink="/home/tabs/content">
              <IonIcon slot="icon-only" icon={homeOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>{t('user.welcome')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="content-container noselect">
          {article && (
            <>
              <article
                className="text-content markdown-body ion-padding"
                dangerouslySetInnerHTML={{ __html: sanitize(article.htmlText) }}
              />
              <div className="ion-text-center">
                <IonButton routerLink="/home/tabs/content">
                  {t('common.close')}
                </IonButton>
              </div>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default WelcomePage;
