import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { Loader2, UserCog, Clock, AlertTriangle, CheckCircle, BarChart3, Search, X, ChevronLeft, ChevronRight, Activity, Maximize2, FileText, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import RequestStatusStepper from '@/components/RequestStatusStepper';
import { WORKFLOW_STAGES, getDepartmentLabel } from '../lib/workflow-utils';
import { toast } from 'sonner';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { usePresence } from '../hooks/usePresence';

const ITEMS_PER_PAGE = 6;

const CATEGORIES = [
  { value: 'cerere_cetatean', label: 'Cerere Cetățean' },
  { value: 'act_administrativ', label: 'Act Administrativ' },
  { value: 'contract', label: 'Contract' },
  { value: 'raport', label: 'Raport' },
];

const STATUSES = [
    { value: 'submitted', label: 'Depusă' },
    { value: 'review_step1', label: 'Verificare inițială' },
    { value: 'review_step2', label: 'Verificare tehnică' },
    { value: 'review_step3', label: 'Verificare finală' },
    { value: 'completed', label: 'Finalizată' },
    { value: 'rejected', label: 'Refuzată' },
];

export default function AdminDashboard() {
  const { user } = useAuthContext();
  const onlineUsers = usePresence();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, rejected: 0 });
  const [bottlenecks, setBottlenecks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const expandedSection = searchParams.get('view');

  const setExpandedSection = (section) => {
      setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          if (section) {
              newParams.set('view', section);
          } else {
              newParams.delete('view');
          }
          return newParams;
      });
  };
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  
  // Activity Log Pagination
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(0);
  const LOGS_PER_PAGE = 10;

  // Employees Pagination
  const [employeesPage, setEmployeesPage] = useState(1);
  const EMPLOYEES_PER_PAGE = 8; // Adjust based on card height

  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    date: null,
    sort: 'created_at,desc',
  });

  const [reassignId, setReassignId] = useState(null);
  const [targetEmployee, setTargetEmployee] = useState('');

  const scrollbarStyles = `
    .force-visible-scrollbar {
        overflow-y: scroll !important;
    }
    .force-visible-scrollbar::-webkit-scrollbar {
        width: 14px;
        display: block !important;
    }
    .force-visible-scrollbar::-webkit-scrollbar-thumb {
        background-color: #94a3b8;
        border-radius: 7px;
        border: 3px solid white;
    }
    .force-visible-scrollbar::-webkit-scrollbar-track {
        background-color: white;
    }
  `;

  // Computed Employees List with Online Status
  const getProcessedEmployees = () => {
      const activeUserIds = Object.values(onlineUsers).flat().reduce((acc, u) => {
          acc[u.user_id] = u;
          return acc;
      }, {});

      return employees.map(emp => ({
          ...emp,
          isOnline: !!activeUserIds[emp.id],
          current_path: activeUserIds[emp.id]?.current_path
      })).sort((a, b) => {
          // Sort by Online first, then Name
          if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
          return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      });
  };

  useEffect(() => {
    fetchData();
  }, [user, filters, currentPage]);

  useEffect(() => {
    fetchActivityLog(activityPage);
  }, [activityPage, expandedSection]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
        let query = supabase
            .from('documents')
            .select(`
                *,
                assignee:current_assignee(id, full_name, email, department),
                workflow_history(created_at, from_stage, to_stage, action_by_profile:action_by(full_name, email))
            `, { count: 'exact' });

        if (filters.search) {
            query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }
        if (filters.category && filters.category !== 'all') {
            query = query.eq('category', filters.category);
        }
        if (filters.status && filters.status !== 'all') {
            query = query.eq('workflow_stage', filters.status);
        }
        if (filters.date?.from) {
            query = query.gte('created_at', `${filters.date.from.toISOString().split('T')[0]}T00:00:00`);
        }
        if (filters.date?.to) {
            query = query.lte('created_at', `${filters.date.to.toISOString().split('T')[0]}T23:59:59`);
        }

        const [sortColumn, sortDirection] = filters.sort.split(',');
        if (sortColumn) {
            query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
        }

        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);

        const { data: docs, error: docError, count } = await query;
        if (docError) throw docError;
        
        const processedDocs = docs.map(req => {
            if (req.workflow_stage === 'rejected' && req.workflow_history) {
                const rejectionEvent = [...req.workflow_history]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .find(h => h.to_stage === 'rejected' || h.action_type === 'rejection');
                
                return {
                    ...req,
                    rejectedAtStage: rejectionEvent?.from_stage || 'submitted',
                    rejectedByName: rejectionEvent?.action_by_profile?.full_name || rejectionEvent?.action_by_profile?.email
                };
            }
            return req;
        });
        
        setRequests(processedDocs);
        setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));

        if (employees.length === 0) {
            const { data: emps } = await supabase.from('profiles').select('*').eq('role', 'angajat');
            if (emps) setEmployees(emps);
        }

        if (currentPage === 1 && !filters.search) {
             fetchGlobalStats();
        }

    } catch (err) {
        console.error(err);
        toast.error("Eroare la încărcarea datelor: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  const fetchGlobalStats = async () => {
      const { data: allDocs } = await supabase.from('documents').select('workflow_stage, created_at, workflow_history(created_at, from_stage, to_stage)');
      if (!allDocs) return;

      const total = allDocs.length;
      const pending = allDocs.filter(r => !['completed', 'rejected'].includes(r.workflow_stage)).length;
      const completed = allDocs.filter(r => r.workflow_stage === 'completed').length;
      const rejected = allDocs.filter(r => r.workflow_stage === 'rejected').length;
      setStats({ total, pending, completed, rejected });
      
      computeBottlenecks(allDocs);
  };

  const fetchActivityLog = async (page = 1) => {
      const from = (page - 1) * LOGS_PER_PAGE;
      const to = from + LOGS_PER_PAGE - 1;

      const { data: history, count } = await supabase
        .from('workflow_history')
        .select(`
            *,
            action_by_profile:action_by(full_name, email),
            document:document_id(title)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
        
      if (history) {
          setActivityLog(history);
          setActivityTotalPages(Math.ceil(count / LOGS_PER_PAGE));
      }
  };

  const computeBottlenecks = (docs) => {
      const stageDurations = {}; 
      
      docs.forEach(doc => {
          if (!doc.workflow_history || doc.workflow_history.length < 2) return;
          const history = [...doc.workflow_history].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          
          for (let i = 0; i < history.length - 1; i++) {
              const current = history[i];
              const next = history[i+1];
              
              if (current.to_stage && next.from_stage === current.to_stage) {
                  const durationMs = new Date(next.created_at) - new Date(current.created_at);
                  const durationHours = durationMs / (1000 * 60 * 60);
                  
                  if (!stageDurations[current.to_stage]) stageDurations[current.to_stage] = [];
                  stageDurations[current.to_stage].push(durationHours);
              }
          }
      });

      const avgDurations = Object.entries(stageDurations).map(([stage, durations]) => {
          const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
          return { 
              name: WORKFLOW_STAGES[stage]?.label || stage, 
              avgHours: parseFloat(avg.toFixed(1)) 
          };
      }).sort((a, b) => b.avgHours - a.avgHours);

      setBottlenecks(avgDurations);
  };

  const handleReassign = async () => {
      if (!reassignId || !targetEmployee) return;
      try {
          const employee = employees.find(e => e.id === targetEmployee);
          let newStage = null;

          if (employee) {
              if (employee.department === 'verificare_initiala') newStage = 'review_step1';
              else if (employee.department === 'verificare_tehnica') newStage = 'review_step2';
              else if (employee.department === 'verificare_finala') newStage = 'review_step3';
          }

          const updates = { current_assignee: targetEmployee };
          if (newStage) updates.workflow_stage = newStage;

          const { error } = await supabase
              .from('documents')
              .update(updates)
              .eq('id', reassignId);
          
          if (error) throw error;

          await supabase.from('workflow_history').insert({
              document_id: reassignId,
              action_by: user.id,
              action_type: 'comment',
              to_stage: newStage,
              comment: `ADMIN: Reasignat către ${employee?.full_name || 'alt funcționar'} (Departament: ${getDepartmentLabel(employee?.department)}).`
          });

          toast.success("Cerere reasignată și mutată la stadiul corespunzător!");
          setReassignId(null);
          setTargetEmployee('');
          fetchData(); 
      } catch (err) {
          toast.error("Eroare la reasignare: " + err.message);
      }
  };
  
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleDateChange = (date) => {
    setFilters(prev => ({...prev, date: date}));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      category: '',
      status: '',
      date: null,
      sort: 'created_at,desc'
    });
    setCurrentPage(1);
  };

  const handleManualRefresh = async () => {
      setRefreshing(true);
      await fetchData();
      setRefreshing(false);
  };

  const renderRequestsContent = (isExpanded = false) => (
      <div className="space-y-6">
          <div className="p-4 border rounded-lg bg-slate-50">
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex-1 w-full min-w-[200px] relative order-1 sm:order-none">
                        <Input name="search" placeholder="Caută titlu/descriere..." value={filters.search} onChange={(e) => handleFilterChange('search', e.target.value)} className="pr-10 bg-white"/>
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    </div>
                    <div className="w-full sm:w-[180px] order-2 sm:order-none">
                        <Select value={filters.category || 'all'} onValueChange={(value) => handleFilterChange('category', value)}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Categorie" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toate Categoriile</SelectItem>
                                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full sm:w-[180px] order-3 sm:order-none">
                        <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toate Statusurile</SelectItem>
                                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full sm:w-[240px] order-4 sm:order-none">
                        <DateRangePicker date={filters.date} setDate={handleDateChange} placeholder="Filtrează după perioadă" className="bg-white w-full" />
                    </div>
                    <Button onClick={handleResetFilters} variant="ghost" size="sm" className="h-10 w-full sm:w-auto order-5 sm:order-none">
                        <X className="mr-2 h-4 w-4"/>Resetează
                    </Button>
                </div>
            </div>
          </div>

          <div className="space-y-4">
              {requests.length > 0 ? (
                  requests.map(req => (
                      <div key={req.id} className="p-4 border rounded-lg bg-white hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div>
                                  <Link to={`/requests/${req.id}`} className="font-semibold text-slate-900 hover:text-blue-600 hover:underline">
                                      {req.title}
                                  </Link>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs text-slate-500">
                                          {new Date(req.created_at).toLocaleDateString()}
                                      </span>
                                      <Badge variant="outline" className="text-[10px] font-normal">
                                          {req.category.replace('_', ' ')}
                                      </Badge>
                                  </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                  <div className="text-right">
                                      <p className="text-xs font-medium text-slate-500">Asignat la / Procesat de:</p>
                                      {req.assignee ? (
                                          <p className="text-sm font-bold text-slate-800">{req.assignee.full_name || req.assignee.email}</p>
                                      ) : (
                                          <p className="text-sm font-bold text-orange-600 italic">
                                              {req.workflow_stage === 'completed' ? 'Finalizat' : 
                                               req.workflow_stage === 'rejected' ? (req.rejectedByName || 'Respins') : 'Neasignat'}
                                          </p>
                                      )}
                                  </div>
                                  
                                  {!['completed', 'rejected'].includes(req.workflow_stage) && (
                                      reassignId === req.id ? (
                                          <div className="flex items-center gap-2 animate-in slide-in-from-right-5">
                                              <Select value={targetEmployee} onValueChange={setTargetEmployee}>
                                                  <SelectTrigger className="w-[180px] h-9">
                                                      <SelectValue placeholder="Alege..." />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {employees.map(e => (
                                                          <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>
                                                      ))}
                                                  </SelectContent>
                                              </Select>
                                              <Button size="sm" onClick={handleReassign} disabled={!targetEmployee}>OK</Button>
                                              <Button size="sm" variant="ghost" onClick={() => setReassignId(null)}>X</Button>
                                          </div>
                                      ) : (
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => setReassignId(req.id)}
                                            className="shrink-0"
                                          >
                                              <UserCog className="h-4 w-4 mr-2" />
                                              Reasignează
                                          </Button>
                                      )
                                  )}
                              </div>
                          </div>
                          <div className="mt-4 border-t pt-3">
                              <RequestStatusStepper 
                                currentStatus={req.workflow_stage} 
                                rejectedAtStage={req.rejectedAtStage} 
                              />
                          </div>
                      </div>
                  ))
              ) : (
                  <p className="text-center text-slate-500 py-10">Nu au fost găsite cereri conform filtrelor.</p>
              )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4 border-t">
                <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-600">Pagina {currentPage} din {totalPages}</span>
                <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
          )}
      </div>
  );

  const renderActivityLogContent = () => (
      <div className="space-y-6">
          {activityLog.length > 0 ? (
              <div className="space-y-4">
                  {activityLog.map((log) => (
                      <div key={log.id} className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                          <div className="flex gap-3">
                              <div className={`mt-1 h-2 w-2 rounded-full shrink-0 
                                  ${log.action_type === 'rejection' ? 'bg-red-500' : 
                                    log.action_type === 'signature' ? 'bg-green-500' : 'bg-slate-300'}`} 
                              />
                              <div>
                                  <p className="text-sm text-slate-800">
                                      <span className="font-semibold">{log.action_by_profile?.full_name || 'Utilizator'}</span> 
                                      {' '}
                                      {log.action_type === 'stage_change' ? 'a schimbat statusul' :
                                       log.action_type === 'signature' ? 'a semnat' :
                                       log.action_type === 'rejection' ? 'a respins' : 
                                       log.action_type === 'comment' ? 'a comentat' : 'a acționat'}
                                      {' '}
                                      pe cererea <Link to={`/requests/${log.document_id}`} className="text-blue-600 hover:underline">{log.document?.title || 'Document'}</Link>
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                      {(() => {
                                          let readableComment = log.comment || "";
                                          ['verificare_initiala', 'verificare_tehnica', 'verificare_finala'].forEach(key => {
                                              readableComment = readableComment.replace(new RegExp(key, 'g'), getDepartmentLabel(key));
                                          });
                                          return readableComment;
                                      })()}
                                  </p>
                              </div>
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap ml-8 sm:ml-0">
                              {new Date(log.created_at).toLocaleString('ro-RO')}
                          </span>
                      </div>
                  ))}
              </div>
          ) : (
              <p className="text-slate-400 text-sm text-center py-10">Nicio activitate recentă.</p>
          )}

          {activityTotalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4 border-t">
                <Button variant="outline" size="icon" onClick={() => setActivityPage(p => Math.max(1, p - 1))} disabled={activityPage <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-600">Pagina {activityPage} din {activityTotalPages}</span>
                <Button variant="outline" size="icon" onClick={() => setActivityPage(p => Math.min(activityTotalPages, p + 1))} disabled={activityPage >= activityTotalPages}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
          )}
      </div>
  );

  const renderEmployeesContent = (isExpanded = false) => {
      const allEmps = getProcessedEmployees();
      const limit = isExpanded ? 12 : 5; 
      const totalPages = Math.ceil(allEmps.length / limit);
      const page = isExpanded ? employeesPage : 1;
      
      const displayedEmps = isExpanded 
          ? allEmps.slice((page - 1) * limit, page * limit)
          : allEmps.slice(0, limit);

      return (
          <div className="space-y-4">
              <div className="space-y-3">
                  {displayedEmps.map((emp) => (
                      <div key={emp.id} className={`flex items-center gap-3 p-2 rounded border transition-colors ${emp.isOnline ? 'bg-green-50/50 border-green-100' : 'bg-slate-50 border-transparent opacity-70 grayscale-[0.5]'}`}>
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${emp.isOnline ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                              {emp.email?.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${emp.isOnline ? 'text-slate-900' : 'text-slate-500'}`}>
                                  {emp.full_name || emp.email}
                              </p>
                              <div className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full ${emp.isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                                  <p className="text-xs text-slate-500 truncate">
                                      {emp.isOnline ? (
                                          emp.current_path?.includes('/requests/') ? 'Lucrează la dosar' : 'Activ în platformă'
                                      ) : 'Offline'}
                                  </p>
                              </div>
                          </div>
                      </div>
                  ))}
                  {!isExpanded && allEmps.length > limit && (
                      <p className="text-xs text-center text-slate-400 pt-2">
                          + încă {allEmps.length - limit} funcționari
                      </p>
                  )}
              </div>

              {isExpanded && totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4 border-t">
                    <Button variant="outline" size="icon" onClick={() => setEmployeesPage(p => Math.max(1, p - 1))} disabled={employeesPage <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-slate-600">Pagina {employeesPage} din {totalPages}</span>
                    <Button variant="outline" size="icon" onClick={() => setEmployeesPage(p => Math.min(totalPages, p + 1))} disabled={employeesPage >= totalPages}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
              )}
          </div>
      );
  };

  if (loading && requests.length === 0) {
    return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>;
  }

  // MOD VIZUALIZARE EXTINSĂ (Înlocuiește complet dashboard-ul pentru a folosi scroll-ul natural)
  if (expandedSection) {
      return (
        <div className="max-w-7xl mx-auto pb-10 pt-2 animate-in fade-in zoom-in-95 duration-200">
            <style>{scrollbarStyles}</style>
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border mb-6 sticky top-0 z-20">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    {expandedSection === 'requests' ? <FileText className="h-6 w-6"/> : 
                     expandedSection === 'activity' ? <Activity className="h-6 w-6"/> : 
                     <UserCog className="h-6 w-6"/>}
                    
                    {expandedSection === 'requests' ? 'Registru General Cereri' : 
                     expandedSection === 'activity' ? 'Jurnal Activitate' : 
                     'Listă Completă Funcționari'}
                </h2>
                <Button variant="outline" size="icon" onClick={() => setExpandedSection(null)}>
                    <X className="h-6 w-6" />
                </Button>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-8">
                {expandedSection === 'requests' ? renderRequestsContent(true) : 
                 expandedSection === 'activity' ? renderActivityLogContent(true) :
                 renderEmployeesContent(true)}
            </div>
        </div>
      );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* GLOBAL STYLES FOR SCROLLBAR */}
      <style>{scrollbarStyles}</style>

      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-800">Panou Administrator</h2>
            <p className="text-slate-500 mt-1">Monitorizare performanță și gestionare flux.</p>
        </div>
        <Button onClick={handleManualRefresh} variant="outline" disabled={refreshing}>
            <Clock className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Se actualizează...' : 'Actualizează'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
              <CardContent className="p-6 flex items-center justify-between">
                  <div>
                      <p className="text-sm font-medium text-slate-500">Total Cereri</p>
                      <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-slate-200" />
              </CardContent>
          </Card>
          <Card>
              <CardContent className="p-6 flex items-center justify-between">
                  <div>
                      <p className="text-sm font-medium text-slate-500">În Lucru</p>
                      <p className="text-3xl font-bold text-blue-600">{stats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-100" />
              </CardContent>
          </Card>
          <Card>
              <CardContent className="p-6 flex items-center justify-between">
                  <div>
                      <p className="text-sm font-medium text-slate-500">Finalizate</p>
                      <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-100" />
              </CardContent>
          </Card>
          <Card>
              <CardContent className="p-6 flex items-center justify-between">
                  <div>
                      <p className="text-sm font-medium text-slate-500">Refuzate</p>
                      <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-100" />
              </CardContent>
          </Card>
      </div>

      <div className="flex flex-col gap-8">
          
          <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      Timp Mediu (Ore)
                  </CardTitle>
                  <CardDescription>Analiză performanță pe stadii</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                  {bottlenecks.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={bottlenecks} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis 
                                dataKey="name" 
                                tick={{fontSize: 12}} 
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                              <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                              <Bar dataKey="avgHours" radius={[4, 4, 0, 0]} barSize={60}>
                                {bottlenecks.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#3b82f6'} />
                                ))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  ) : (
                      <div className="flex items-center justify-center h-full text-sm text-slate-400">
                          Nu sunt suficiente date.
                      </div>
                  )}
              </CardContent>
          </Card>

          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                      <CardTitle>Registru General Cereri</CardTitle>
                      <CardDescription>Vizualizează, filtrează și gestionează toate cererile.</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setExpandedSection('requests')}>
                      <Maximize2 className="h-4 w-4 text-slate-500" />
                  </Button>
              </CardHeader>
              <CardContent>
                  {renderRequestsContent()}
              </CardContent>
          </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
              <div>
                  <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-600" />
                      Activitate Recentă în Sistem
                  </CardTitle>
                  <CardDescription>Jurnalul global al ultimelor acțiuni efectuate.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setExpandedSection('activity')}>
                  <Maximize2 className="h-4 w-4 text-slate-500" />
              </Button>
          </CardHeader>
          <CardContent>
              {renderActivityLogContent()}
          </CardContent>
      </Card>

      {/* ONLINE EMPLOYEES WIDGET */}
      <Card className="lg:col-span-1 h-full">
          <CardHeader className="flex flex-row items-center justify-between">
              <div>
                  <CardTitle className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                      Funcționari
                  </CardTitle>
                  <CardDescription>Status echipă în timp real</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setExpandedSection('employees')}>
                  <Maximize2 className="h-4 w-4 text-slate-500" />
              </Button>
          </CardHeader>
          <CardContent>
              {renderEmployeesContent()}
          </CardContent>
      </Card>
      </div>
    </div>
  );
}