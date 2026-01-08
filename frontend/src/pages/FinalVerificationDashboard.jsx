import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { EmployeeService } from '../lib/employeeService';
import { getWorkflowStageInfo } from '../lib/workflow-utils';
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Inbox, History, ArrowRight, CheckCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import RequestStatusStepper from '@/components/RequestStatusStepper';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function FinalVerificationDashboard() {
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState('queue'); // queue, tasks, history
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // CONFIGURARE SPECIFICĂ: FINAL (Z)
  // Vede ce vine de la Tehnic (Y) -> review_step3
  // Finalizează -> completed
  const currentStage = 'review_step3';
  const nextStage = 'completed';
  const nextDept = null; // Nu mai există departament următor

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let data = [];
      if (activeTab === 'queue') {
        data = await EmployeeService.getQueue(currentStage);
      } else if (activeTab === 'tasks') {
        data = await EmployeeService.getMyTasks();
      } else if (activeTab === 'history') {
        data = await EmployeeService.getMyProcessedHistory();
      }
      setItems(data);
    } catch (error) {
      console.error(error);
      toast.error("Nu s-au putut încărca datele: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab, currentStage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePickUp = async (id) => {
    try {
        await EmployeeService.assignToMe(id);
        toast.success("Dosar preluat pentru verificare finală!");
        fetchData();
    } catch (err) {
        toast.error("Eroare: " + err.message);
    }
  };

  const handleFinalize = async (id) => {
      try {
          // Aprobarea aici înseamnă finalizarea cererii (SQL-ul știe că după review_step3 urmează completed)
          // targetAssigneeId este null pentru că nu se duce la nimeni altcineva
          await EmployeeService.approve(id, null);
          toast.success("Dosar finalizat cu succes!");
          fetchData();
      } catch (err) {
          toast.error("Eroare: " + err.message);
      }
  };

  const tabs = [
    { id: 'queue', label: 'Coada Finală', icon: Inbox },
    { id: 'tasks', label: 'Dosarele Mele', icon: CheckCircle2 },
    { id: 'history', label: 'Istoric Procesat', icon: History },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Verificare Finală</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Aprobarea finală a documentelor și emiterea deciziei.</p>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-800 w-full overflow-x-auto">
        {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'text-purple-600 border-b-2 border-purple-600' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {loading ? (
           <div className="flex items-center justify-center h-40">
             <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
           </div>
        ) : items.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                <p className="text-slate-500 dark:text-slate-400">Niciun dosar în această listă.</p>
            </div>
        ) : (
            <div className="grid gap-4">
                {items.map((req) => (
                    <Card key={req.id} className="hover:shadow-md transition-shadow dark:bg-slate-900 dark:border-slate-800">
                        <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between pb-2 gap-4">
                            <div>
                                <CardTitle className="text-lg">
                                    <Link to={`/requests/${req.id}`} className="hover:underline hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">
                                        {req.title}
                                    </Link>
                                </CardTitle>
                                <CardDescription className="dark:text-slate-400">
                                    Depus la: {new Date(req.created_at).toLocaleDateString('ro-RO')} &bull; 
                                    Status: <span className={`font-medium ${getWorkflowStageInfo(req.workflow_stage).textColor}`}>
                                        {getWorkflowStageInfo(req.workflow_stage).label}
                                    </span>
                                </CardDescription>
                            </div>
                            
                            {activeTab === 'queue' && (
                                <Button size="sm" onClick={() => handlePickUp(req.id)} className="bg-purple-600 hover:bg-purple-700 text-white">
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    Preia Dosarul
                                </Button>
                            )}

                            {activeTab === 'tasks' && (
                                <Link to={`/requests/${req.id}`}>
                                    <Button size="sm" variant="outline">
                                        Gestionează
                                    </Button>
                                </Link>
                            )}
                        </CardHeader>
                        <CardContent>
                             <RequestStatusStepper currentStatus={req.workflow_stage} />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
