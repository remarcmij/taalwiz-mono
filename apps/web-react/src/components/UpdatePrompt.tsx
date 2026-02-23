import { IonAlert } from '@ionic/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdatePrompt: React.FC = () => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const showAlert = needRefresh && !dismissed;

  return (
    <IonAlert
      isOpen={showAlert}
      header={t('update.update-available')}
      message={t('update.update-message')}
      buttons={[
        {
          text: 'OK',
          role: 'confirm',
          handler: () => {
            updateServiceWorker(true);
          },
        },
        {
          text: t('update.update-later'),
          role: 'cancel',
          handler: () => {
            setDismissed(true);
          },
        },
      ]}
    />
  );
};

export default UpdatePrompt;
