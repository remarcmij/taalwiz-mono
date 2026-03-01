import {
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useArticle } from '../../api/content.api.ts';
import BackButton from '../../components/BackButton.tsx';
import { sanitize } from '../../lib/sanitize.ts';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const { lang } = useParams<{ lang: string }>();
  const { data: article } = useArticle(`about.${lang || 'en'}.md`);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <BackButton />
          </IonButtons>
          <IonTitle>{t('common.about')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="content-container noselect">
          {article && (
            <article
              className="text-content markdown-body ion-padding"
              dangerouslySetInnerHTML={{ __html: sanitize(article.htmlText) }}
            />
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AboutPage;
