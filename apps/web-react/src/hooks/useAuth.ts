import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../context/AuthContext.tsx';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
