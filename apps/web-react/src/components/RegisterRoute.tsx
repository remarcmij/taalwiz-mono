import { IonPage, IonSpinner } from '@ionic/react';
import { useEffect, useState } from 'react';
import { Redirect, useLocation } from 'react-router-dom';
import { validateRegTokenRequest } from '../api/auth.api.ts';

/**
 * Inner guard component for the register route.
 * Validates the registration token from query params before rendering the page.
 * Used inside a plain <Route render={...}> in App.tsx.
 */
const RegisterRouteGuard: React.FC<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>;
}> = ({ component: Component, ...rest }) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    if (!email || !token) {
      setChecking(false);
      return;
    }

    validateRegTokenRequest(email, token)
      .then(() => setValid(true))
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [email, token]);

  if (checking) {
    return (
      <IonPage>
        <div
          className="ion-text-center ion-padding"
          style={{ marginTop: '40vh' }}
        >
          <IonSpinner />
        </div>
      </IonPage>
    );
  }

  if (!valid) {
    return <Redirect to="/auth" />;
  }

  return <Component {...rest} />;
};

export default RegisterRouteGuard;
