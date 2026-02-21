import { IonSpinner } from '@ionic/react';
import { useEffect, useState } from 'react';
import { Redirect, Route, useLocation, type RouteProps } from 'react-router-dom';
import { validateRegTokenRequest } from '../api/auth.api.ts';

const RegisterRoute: React.FC<RouteProps> = (props) => {
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
      <div
        className="ion-text-center ion-padding"
        style={{ marginTop: '40vh' }}
      >
        <IonSpinner />
      </div>
    );
  }

  if (!valid) {
    return <Redirect to="/auth" />;
  }

  return <Route {...props} />;
};

export default RegisterRoute;
