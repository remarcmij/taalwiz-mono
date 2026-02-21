import { Redirect, Route, type RouteProps } from 'react-router-dom';
import { HOME_URL } from '../context/AuthContext.tsx';
import { useAuth } from '../hooks/useAuth.ts';

const AdminRoute: React.FC<RouteProps> = (props) => {
  const { user, isAdmin } = useAuth();

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!isAdmin) {
    return <Redirect to={HOME_URL} />;
  }

  return <Route {...props} />;
};

export default AdminRoute;
