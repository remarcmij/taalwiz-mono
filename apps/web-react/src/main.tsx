import { setupIonicReact } from '@ionic/react';
import { createRoot } from 'react-dom/client';

/* Core Ionic CSS */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/display.css';

/* Optional CSS utils */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';

/* Ionic Dark Mode */
import '@ionic/react/css/palettes/dark.system.css';

/* Markdown CSS */
import 'github-markdown-css/github-markdown.css';

/* App Global CSS */
import './global.css';

/* i18n */
import './lib/i18n.ts';

import App from './App.tsx';

setupIonicReact();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
