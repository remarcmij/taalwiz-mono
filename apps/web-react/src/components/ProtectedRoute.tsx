import { Redirect, Route, type RouteProps } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

const ProtectedRoute: React.FC<RouteProps> = (props) => {
  const { user } = useAuth();

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <Route {...props} />;
};

export default ProtectedRoute;
