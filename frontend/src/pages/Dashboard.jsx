import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import RequestList from '@/components/RequestList';
import RequestStatusStepper from '@/components/RequestStatusStepper'; // Import the stepper

export default function Dashboard() {
  const { user } = useAuthContext();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecentRequests = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('uploaded_by', user.id)
          .order('created_at', { ascending: false })
          .limit(50); // Fetch a reasonable number of recent requests

        if (error) throw error;
        setRequests(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentRequests();
  }, [user]);

  const inProgressStatuses = ['submitted', 'review_step1', 'review_step2', 'review_step3'];
  const inProgressRequests = requests.filter(r => inProgressStatuses.includes(r.workflow_stage));
  const completedRequests = requests.filter(r => r.workflow_stage === 'completed');
  const rejectedRequests = requests.filter(r => r.workflow_stage === 'rejected');

  if (loading) {
    return (
        <div className="p-6 text-center flex items-center justify-center h-64">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <p>Se încarcă meniul principal...</p>
        </div>
    );
  }

  if (error) {
    return <p className="p-6 text-center text-red-500">{error}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800">Meniu Principal</h2> {/* Changed heading */}
        <p className="text-slate-500 mt-1">Vizualizează statusul ultimelor tale cereri.</p>
      </div>
      
      <div className="space-y-6">
        <RequestList 
          title="Cereri în desfășurare"
          requests={inProgressRequests}
          viewAllLink={{ to: '/requests', state: { status: 'in_progress' } }}
          renderStatusStepper={(request) => <RequestStatusStepper currentStatus={request.workflow_stage} />}
        />
        <RequestList 
          title="Cereri finalizate"
          requests={completedRequests}
          viewAllLink={{ to: '/requests', state: { status: 'completed' } }}
        />
        <RequestList 
          title="Cereri refuzate"
          requests={rejectedRequests}
          viewAllLink={{ to: '/requests', state: { status: 'rejected' } }}
        />
      </div>
    </div>
  );
}