import {
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useArticle } from '../../api/content.api.ts';
import BackButton from '../../components/BackButton.tsx';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const { lang } = useParams<{ lang: string }>();
  const { data: article } = useArticle(`about.${lang || 'en'}.md`);

  return (
    <>
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
              dangerouslySetInnerHTML={{ __html: article.htmlText }}
            />
          )}
        </div>
      </IonContent>
    </>
  );
};

export default AboutPage;
