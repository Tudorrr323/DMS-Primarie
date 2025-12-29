import { Link } from 'react-router-dom';

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-900">Primărie DMS</h1>
        </div>
        <nav className="p-4 space-y-2">
          <div className="block p-2 bg-blue-50 text-blue-700 rounded">Dashboard</div>
          <div className="block p-2 hover:bg-gray-100 rounded text-gray-600">Cetățeni</div>
          <div className="block p-2 hover:bg-gray-100 rounded text-gray-600">Documente</div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Panou de Control</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm">Cereri Noi</h3>
            <p className="text-3xl font-bold">12</p>
          </div>
          {/* Alte carduri pot fi adaugate aici */}
        </div>
        
        {/* Link temporar pentru testare */}
        <div className="mt-8">
             <Link to="/login" className="text-blue-500 underline">Mergi la Login (Test)</Link>
        </div>
      </main>
    </div>
  )
}