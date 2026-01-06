import { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { DocumentService } from '../lib/documentService';
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Inbox, History, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import RequestStatusStepper from '@/components/RequestStatusStepper';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export default function EmployeeDashboard({ 
    title, 
    description,
    poolStage, 
    activeStage,
    nextStageOnPickup = null 
}) {
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState('pool'); // pool, mine, history
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to fetch data based on tab
  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let data = [];
      
      if (activeTab === 'pool') {
        // TAB 1: DE PRELUAT
        // Criteriu: Stadiul de "Pool" și FĂRĂ assignee
        data = await DocumentService.getAll({ 
            workflow_stage: poolStage, 
            assignee: 'is.null' 
        });
      } else if (activeTab === 'mine') {
        // TAB 2: ÎN LUCRU
        // Criteriu: Stadiul activ (sau pool dacă nu se schimbă) și assignee = EU
        data = await DocumentService.getAll({ 
            workflow_stage: activeStage, 
            assignee: user.id 
        });
      } else if (activeTab === 'history') {
        // TAB 3: ISTORIC
        // Criteriu: Documente la care am lucrat (găsite în history)
        // Aceasta este o interogare mai complexă, o facem direct prin supabase aici
        const { data: historyData, error } = await supabase
            .from('workflow_history')
            .select('document_id')
            .eq('action_by', user.id);
            
        if (error) throw error;
        
        const docIds = [...new Set(historyData.map(h => h.document_id))];
        
        if (docIds.length > 0) {
            const { data: docs, error: docError } = await supabase
                .from('documents')
                .select('*, workflow_history(action_type, from_stage)')
                .in('id', docIds)
                .order('updated_at', { ascending: false });
            if (docError) throw docError;
            data = docs;
        } else {
            data = [];
        }
      }

      setRequests(data);
    } catch (error) {
      console.error(error);
      toast.error("Nu s-au putut încărca cererile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user, activeTab, poolStage, activeStage]);

  const handlePickup = async (docId) => {
    try {
        await DocumentService.assignToMe(docId, user.id, nextStageOnPickup || activeStage);
        toast.success("Cerere preluată cu succes!");
        fetchRequests(); // Refresh list
    } catch (error) {
        toast.error("Eroare la preluarea cererii: " + error.message);
    }
  };

  const tabs = [
    { id: 'pool', label: 'De Preluat', icon: Inbox },
    { id: 'mine', label: 'În Lucru', icon: CheckCircle2 },
    { id: 'history', label: 'Istoric', icon: History },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800">{title}</h2>
        <p className="text-slate-500 mt-1">{description}</p>
      </div>

      {/* TABS HEADER */}
      <div className="flex border-b border-slate-200 w-full">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors relative ${
                isActive 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {/* Optional: Add counters if we wanted to fetch them eagerly */}
            </button>
          );
        })}
      </div>

      {/* CONTENT AREA */}
      <div className="min-h-[300px]">
        {loading ? (
           <div className="flex items-center justify-center h-40">
             <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
           </div>
        ) : requests.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                <p className="text-slate-500">Nu există cereri în această categorie.</p>
            </div>
        ) : (
            <div className="grid gap-4">
                {requests.map((req) => (
                    <Card key={req.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="text-lg">
                                    <Link to={`/requests/${req.id}`} className="hover:underline hover:text-blue-600">
                                        {req.title}
                                    </Link>
                                </CardTitle>
                                <CardDescription>Depus la: {new Date(req.created_at).toLocaleDateString()}</CardDescription>
                            </div>
                            {activeTab === 'pool' && (
                                <Button size="sm" onClick={() => handlePickup(req.id)}>
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    Pia Cererea
                                </Button>
                            )}
                            {activeTab === 'mine' && (
                                <Link to={`/requests/${req.id}`}>
                                    <Button size="sm" variant="outline">
                                        Gestionează
                                    </Button>
                                </Link>
                            )}
                        </CardHeader>
                        <CardContent>
                             <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                                <span>Categorie: <span className="font-medium text-slate-700 capitalize">{req.category.replace('_', ' ')}</span></span>
                             </div>
                             <RequestStatusStepper 
                                currentStatus={req.workflow_stage} 
                                rejectedAtStage={
                                    req.workflow_stage === 'rejected' && req.workflow_history 
                                    ? req.workflow_history.find(h => h.action_type === 'rejection')?.from_stage 
                                    : null
                                }
                             />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
