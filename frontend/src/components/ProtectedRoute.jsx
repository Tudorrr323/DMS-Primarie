import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

const ProtectedRoute = () => {
  const { user, loading } = useAuthContext();
  const location = useLocation();

  console.log(`[ProtectedRoute] Path: ${location.pathname}, Loading: ${loading}, User: ${user?.id}`);

  if (loading) {
    console.log('[ProtectedRoute] Showing loading spinner...');
    // Optional: show a loading spinner
    return <div>Loading...</div>;
  }

  if (!user) {
    console.log(`[ProtectedRoute] No user. Redirecting to /login from ${location.pathname}`);
    // If not logged in, redirect to the login page
    return <Navigate to="/login" replace />;
  }

  console.log('[ProtectedRoute] User found. Rendering Outlet.');
  // If logged in, show the content (Layout and pages)
  return <Outlet />;
};

export default ProtectedRoute;