import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, FileText, User, Menu } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Toaster } from 'sonner';

export default function Layout() {
  const { user } = useAuthContext();
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
      { to: '/requests', text: 'Cereri', icon: FileText },
      { to: '/profile', text: 'Profilul meu', icon: User },
    ];

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

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-slate-100">
        <h1 className="text-xl font-bold text-slate-900">{getPortalTitle()}</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            onClick={() => setIsSidebarOpen(false)} // Close sidebar on link click
            className={`flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              location.pathname === link.to
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <link.icon className="h-4 w-4" />
            {link.text}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-100">
        <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-600">
          Deconectare
        </Button>
      </div>
    </>
  );

  return (
    <>
    <Toaster richColors />
    <div className="flex h-screen bg-slate-50">
      {/* Static Sidebar for Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar (Overlay) */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
            <div className="fixed inset-0 bg-black opacity-25" onClick={() => setIsSidebarOpen(false)}></div>
            <aside className="fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col z-50">
                <SidebarContent />
            </aside>
        </div>
      )}

      {/* MAIN CONTENT WRAPPER */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* NAVBAR (Top bar) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu className="h-6 w-6" />
            </Button>
            <h2 className="text-lg font-medium text-slate-800 hidden sm:block">
              {navLinks.find(l => l.to === location.pathname)?.text || 'Panou Administrare'}
            </h2>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-700 hidden sm:block">{user.email}</span>
            </div>
          )}
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