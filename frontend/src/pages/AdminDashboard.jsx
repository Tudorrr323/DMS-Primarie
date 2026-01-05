import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import RequestList from '@/components/RequestList';
import RequestStatusStepper from '@/components/RequestStatusStepper';

export default function AdminDashboard() {
  const { user } = useAuthContext();
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, rejected: 0 });

  useEffect(() => {
    const fetchRequests = async () => {
      if (!user) return;
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAllRequests(data);

        // Calculate simple stats
        const total = data.length;
        const pending = data.filter(r => ['submitted', 'review_step1', 'review_step2', 'review_step3'].includes(r.workflow_stage)).length;
        const completed = data.filter(r => r.workflow_stage === 'completed').length;
        const rejected = data.filter(r => r.workflow_stage === 'rejected').length;

        setStats({ total, pending, completed, rejected });

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [user]);

  if (loading) {
    return (
        <div className="p-6 text-center flex items-center justify-center h-64">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <p>Se încarcă panoul de administrare...</p>
        </div>
    );
  }

  if (error) {
    return <p className="p-6 text-center text-red-500">{error}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800">Panou Administrator</h2>
        <p className="text-slate-500 mt-1">Privire de ansamblu asupra întregului sistem.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
              <p className="text-sm font-medium text-slate-500">Total Cereri</p>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
              <p className="text-sm font-medium text-slate-500">În Desfășurare</p>
              <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
              <p className="text-sm font-medium text-slate-500">Finalizate</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
              <p className="text-sm font-medium text-slate-500">Refuzate</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </div>
      </div>
      
      <div className="space-y-6">
        <RequestList 
          title="Toate Cererile Recente"
          requests={allRequests.slice(0, 5)} // Only show top 5 here, or pass logic to RequestList
          viewAllLink={{ to: '/requests', state: {} }}
          renderStatusStepper={(request) => <RequestStatusStepper currentStatus={request.workflow_stage} />}
        />
      </div>
    </div>
  );
}
