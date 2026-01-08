import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, FileText, User, Menu } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Toaster } from 'sonner';
import { usePresence } from '../hooks/usePresence';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../contexts/ThemeContext';

export default function Layout() {
  const { user } = useAuthContext();
  const { theme } = useTheme();
  usePresence(); // Activate Presence Tracking globally
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const getNavLinks = () => {
    const baseLinks = [
      { to: '/profile', text: 'Profilul meu', icon: User },
    ];

    // Adăugăm link-ul de 'Cereri' doar pentru cetățeni
    if (profile?.role === 'cetatean') {
      baseLinks.unshift({ to: '/requests', text: 'Cereri', icon: FileText });
    }

    let homeLink = { to: '/', text: 'Meniu Principal', icon: Home };

    if (profile?.role === 'admin') {
      homeLink = { to: '/admin', text: 'Meniu Principal', icon: Home };
    } else if (profile?.role === 'angajat') {
      switch (profile.department) {
        case 'verificare_initiala':
          homeLink = { to: '/verificare-initiala', text: 'Meniu Principal', icon: Home };
          break;
        case 'verificare_tehnica':
          homeLink = { to: '/verificare-tehnica', text: 'Meniu Principal', icon: Home };
          break;
        case 'verificare_finala':
          homeLink = { to: '/verificare-finala', text: 'Meniu Principal', icon: Home };
          break;
        default:
          homeLink = { to: '/', text: 'Meniu Principal', icon: Home };
      }
    }

    return [homeLink, ...baseLinks];
  };

  const navLinks = getNavLinks();

  const getPortalTitle = () => {
    if (profile?.role === 'admin') return 'Portal Admin';
    if (profile?.role === 'angajat') return 'Portal Angajat';
    return 'Portal Cetățean';
  };

  return (
    <>
    <Toaster richColors theme={theme} />
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Static Sidebar for Desktop */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col hidden lg:flex">
        <SidebarContent navLinks={navLinks} getPortalTitle={getPortalTitle} location={location} setIsSidebarOpen={setIsSidebarOpen} handleLogout={handleLogout} />
      </aside>

      {/* Mobile Sidebar (Overlay) */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
            <div className="fixed inset-0 bg-black opacity-25" onClick={() => setIsSidebarOpen(false)}></div>
            <aside className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50">
                <SidebarContent navLinks={navLinks} getPortalTitle={getPortalTitle} location={location} setIsSidebarOpen={setIsSidebarOpen} handleLogout={handleLogout} />
            </aside>
        </div>
      )}

      {/* MAIN CONTENT WRAPPER */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* NAVBAR (Top bar) */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu className="h-6 w-6" />
            </Button>
            <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200 hidden sm:block">
              {navLinks.find(l => l.to === location.pathname)?.text || 'Panou Administrare'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {user && (
              <>
                <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">{user.email}</span>
              </>
            )}
          </div>
        </header>

        {/* Page Content injected here */}
        <div className="p-4 sm:p-8 flex-grow">
          <Outlet />
        </div>
      </main>
    </div>
    </>
  );
}

const SidebarContent = ({ navLinks, getPortalTitle, location, setIsSidebarOpen, handleLogout }) => (
  <>
    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{getPortalTitle()}</h1>
    </div>
    <nav className="flex-1 p-4 space-y-1">
      {navLinks.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          onClick={() => setIsSidebarOpen(false)} // Close sidebar on link click
          className={`flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            location.pathname === link.to
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50'
              : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <link.icon className="h-4 w-4" />
          {link.text}
        </Link>
      ))}
    </nav>
    <div className="p-4 border-t border-slate-100 dark:border-slate-800">
      <Button 
        type="button"
        onClick={handleLogout} 
        variant="ghost" 
        className="w-full justify-start text-red-600 hover:bg-red-600 hover:text-white transition-colors"
      >
        Deconectare
      </Button>
    </div>
  </>
);