import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { EmployeeService } from '../lib/employeeService';
import { getWorkflowStageInfo } from '../lib/workflow-utils';
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Inbox, History, ArrowRight, UserPlus, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import RequestStatusStepper from '@/components/RequestStatusStepper';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function TechnicalVerificationDashboard() {
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState('queue'); // queue, tasks, history
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colleagues, setColleagues] = useState([]); 
  const [assigningTo, setAssigningTo] = useState({}); 

  // CONFIGURARE SPECIFICĂ: TEHNIC (Y)
  // Vede ce vine de la Initial (X) -> review_step2
  // Trimite catre Final (Z) -> review_step3
  const currentStage = 'review_step2';
  const nextStage = 'review_step3';
  const nextDept = 'verificare_finala'; 

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let data = [];
      if (activeTab === 'queue') {
        // Vede doar dosarele care au ajuns la acest pas (de la X)
        data = await EmployeeService.getQueue(currentStage);
      } else if (activeTab === 'tasks') {
        data = await EmployeeService.getMyTasks();
        
        // Încarcă colegii din departamentul următor doar dacă e nevoie
        if (colleagues.length === 0 && nextDept) {
            try {
                const cols = await EmployeeService.getColleaguesByDepartment(nextDept);
                setColleagues(cols);
            } catch (e) {
                console.warn("Nu s-au putut încărca colegii:", e);
            }
        }
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
  }, [user, activeTab, colleagues.length, currentStage, nextDept]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePickUp = async (id) => {
    try {
        // Preluarea menține stadiul curent (review_step2), doar asignând utilizatorul
        await EmployeeService.assignToMe(id, user.id, currentStage);
        toast.success("Dosar preluat pentru verificare tehnică!");
        fetchData();
    } catch (err) {
        toast.error("Eroare: " + err.message);
    }
  };

  const handleAutoAssign = async (id) => {
    try {
        await EmployeeService.approveAutoAssign(id, user.id, nextDept, nextStage, currentStage);
        toast.success("Dosar trimis automat la verificare finală!");
        fetchData();
    } catch (err) {
        toast.error("Eroare: " + err.message);
    }
  };

  const handleManualAssign = async (id) => {
    const targetId = assigningTo[id];
    if (!targetId) {
        toast.error("Selectează un coleg!");
        return;
    }
    try {
        await EmployeeService.approve(id, user.id, targetId, nextStage, currentStage);
        toast.success("Dosar alocat manual!");
        setAssigningTo(prev => {
            const next = {...prev};
            delete next[id];
            return next;
        });
        fetchData();
    } catch (err) {
        toast.error("Eroare: " + err.message);
    }
  };

  const handleSendToPool = async (id) => {
      try {
          await EmployeeService.approve(id, user.id, null, nextStage, currentStage);
          toast.success("Dosar trimis în coada de verificare finală!");
          fetchData();
      } catch (err) {
          toast.error("Eroare: " + err.message);
      }
  };

  const tabs = [
    { id: 'queue', label: 'Coada Tehnică', icon: Inbox },
    { id: 'tasks', label: 'Dosarele Mele', icon: CheckCircle2 },
    { id: 'history', label: 'Istoric Procesat', icon: History },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800">Verificare Tehnică</h2>
        <p className="text-slate-500 mt-1">Analiză tehnică a documentațiilor transmise de la verificare inițială.</p>
      </div>

      <div className="flex border-b border-slate-200 w-full overflow-x-auto">
        {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'text-orange-600 border-b-2 border-orange-600' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
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
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                <p className="text-slate-500">Niciun dosar în această listă.</p>
            </div>
        ) : (
            <div className="grid gap-4">
                {items.map((req) => (
                    <Card key={req.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between pb-2 gap-4">
                            <div>
                                <CardTitle className="text-lg">
                                    <Link to={`/requests/${req.id}`} className="hover:underline hover:text-blue-600">
                                        {req.title}
                                    </Link>
                                </CardTitle>
                                <CardDescription>
                                    Depus la: {new Date(req.created_at).toLocaleDateString('ro-RO')} &bull; 
                                    Status: <span className={`font-medium ${getWorkflowStageInfo(req.workflow_stage).textColor}`}>
                                        {getWorkflowStageInfo(req.workflow_stage).label}
                                    </span>
                                </CardDescription>
                            </div>
                            
                            {activeTab === 'queue' && (
                                <Button size="sm" onClick={() => handlePickUp(req.id)} className="bg-orange-600 hover:bg-orange-700">
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
