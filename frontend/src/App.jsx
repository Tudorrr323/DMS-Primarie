import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  // Aici vom verifica mai tarziu daca userul e logat
  const isAuthenticated = true; // Simulam ca e logat pentru moment

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Ruta principala: Daca e logat arata Dashboard, altfel trimite la Login */}
        <Route 
          path="/" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
        />
        
        {/* Orice alta ruta necunoscuta duce la login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App;