import { IonBackButton } from '@ionic/react';

interface BackButtonProps {
  defaultHref?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
  defaultHref = '/home/tabs/content',
}) => {
  return <IonBackButton text="" defaultHref={defaultHref} />;
};

export default BackButton;
