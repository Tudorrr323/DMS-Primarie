import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  // Aici verificăm logarea. Momentan e true (logat).
  const isAuthenticated = true; 

  if (!isAuthenticated) {
    // Dacă nu e logat, îl trimitem la Login
    return <Navigate to="/login" replace />;
  }

  // Dacă e logat, afișăm conținutul (Layout-ul și paginile)
  return <Outlet />;
};

// LINIA ASTA LIPSEȘTE LA TINE:
export default ProtectedRoute;