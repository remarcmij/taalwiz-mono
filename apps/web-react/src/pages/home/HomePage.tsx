import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react';
import {
  bookOutline,
  libraryOutline,
  pricetagsOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { Redirect, Route } from 'react-router-dom';
import ContentPage from './content/ContentPage.tsx';
import PublicationPage from './content/PublicationPage.tsx';
import ArticlePage from './content/ArticlePage.tsx';
import DictionaryPage from './dictionary/DictionaryPage.tsx';
import HashtagsPage from './hashtags/HashtagsPage.tsx';

const HomePage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/home/tabs/content" component={ContentPage} />
        <Route
          exact
          path="/home/tabs/content/:groupName"
          component={PublicationPage}
        />
        <Route
          exact
          path="/home/tabs/content/:groupName/:filename"
          component={ArticlePage}
        />
        <Route exact path="/home/tabs/dictionary" component={DictionaryPage} />
        <Route
          exact
          path="/home/tabs/dictionary/:lang/:word"
          component={DictionaryPage}
        />
        <Route exact path="/home/tabs/hashtags" component={HashtagsPage} />
        <Route exact path="/home/tabs">
          <Redirect to="/home/tabs/content" />
        </Route>
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="content" href="/home/tabs/content">
          <IonIcon icon={libraryOutline} />
          <IonLabel>{t('tabs.library')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="dictionary" href="/home/tabs/dictionary">
          <IonIcon icon={bookOutline} />
          <IonLabel>{t('tabs.dictionary')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="hashtags" href="/home/tabs/hashtags">
          <IonIcon icon={pricetagsOutline} />
          <IonLabel>{t('tabs.hashtags')}</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

export default HomePage;
