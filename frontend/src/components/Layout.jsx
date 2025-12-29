import { Outlet, Link } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-900">DMS Primărie</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <Link to="/" className="block px-4 py-2 text-sm font-medium text-slate-700 rounded-md hover:bg-slate-100">
            Dashboard
          </Link>
          <Link to="/documents" className="block px-4 py-2 text-sm font-medium text-slate-700 rounded-md hover:bg-slate-100">
            Documente
          </Link>
          <Link to="/citizens" className="block px-4 py-2 text-sm font-medium text-slate-700 rounded-md hover:bg-slate-100">
            Cetățeni
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left rounded-md">
            Deconectare
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <main className="flex-1 overflow-y-auto">
        {/* NAVBAR (Top bar) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <h2 className="text-lg font-medium text-slate-800">Panou Administrare</h2>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
              A
            </div>
            <span className="text-sm font-medium text-slate-700">Administrator</span>
          </div>
        </header>

        {/* Page Content injected here */}
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}