import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import InitialVerificationDashboard from './pages/InitialVerificationDashboard';
import TechnicalVerificationDashboard from './pages/TechnicalVerificationDashboard';
import FinalVerificationDashboard from './pages/FinalVerificationDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import Requests from './pages/Requests';
import CreateRequest from './pages/CreateRequest';
import RequestTimeline from './pages/RequestTimeline';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import ForgotPassword from './pages/ForgotPassword';
import UpdatePassword from './pages/UpdatePassword';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />

          {/* Protected Routes (Require Login) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/verificare-initiala" element={<InitialVerificationDashboard />} />
              <Route path="/verificare-tehnica" element={<TechnicalVerificationDashboard />} />
              <Route path="/verificare-finala" element={<FinalVerificationDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              
              <Route path="/profile" element={<Profile />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/requests/new" element={<CreateRequest />} />
              <Route path="/requests/:id" element={<RequestTimeline />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Login />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App;
