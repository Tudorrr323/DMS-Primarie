import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { PlusCircle, Loader2, Search, X } from 'lucide-react';
import RequestCard from '@/components/RequestCard';
import { DatePicker } from '@/components/ui/date-picker';

const CATEGORIES = [
  { value: 'cerere_cetatean', label: 'Cerere Cetățean' },
  { value: 'act_administrativ', label: 'Act Administrativ' },
  { value: 'contract', label: 'Contract' },
  { value: 'raport', label: 'Raport' },
];

const STATUSES = [
    { value: 'in_progress', label: 'În desfășurare' },
    { value: 'submitted', label: 'Depusă' },
    { value: 'review_step1', label: 'Verificare inițială' },
    { value: 'review_step2', label: 'Verificare tehnică' },
    { value: 'review_step3', label: 'Verificare finală' },
    { value: 'completed', label: 'Finalizată' },
    { value: 'rejected', label: 'Refuzată' },
];

const SORT_OPTIONS = [
    { value: 'created_at,desc', label: 'Cele mai noi' },
    { value: 'created_at,asc', label: 'Cele mai vechi' },
    { value: 'title,asc', label: 'Titlu (A-Z)' },
    { value: 'title,desc', label: 'Titlu (Z-A)' },
];

const IN_PROGRESS_STAGES = ['submitted', 'review_step1', 'review_step2', 'review_step3'];

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    date: null,
    sort: 'created_at,desc',
  });

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('documents')
        .select('*');

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.status === 'in_progress') {
        query = query.in('workflow_stage', IN_PROGRESS_STAGES);
      } else if (filters.status) {
        query = query.eq('workflow_stage', filters.status);
      }

      if (filters.date) {
        const dateStr = filters.date.toISOString().split('T')[0];
        query = query
          .gte('created_at', `${dateStr}T00:00:00`)
          .lte('created_at', `${dateStr}T23:59:59`);
      }

      const [sortColumn, sortDirection] = filters.sort.split(',');
      if (sortColumn && sortDirection) {
          query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      setRequests(data);
    } catch (err) {
      setError(err.message);
      console.error('Eroare la încărcare:', err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value === 'all' ? '' : value }));
  };
  
  const handleDateChange = (date) => {
    setFilters(prev => ({...prev, date: date}));
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      category: '',
      status: '',
      date: null,
      sort: 'created_at,desc'
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800">Cererile mele</h2>
        <Link to="/requests/new">
          <Button className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" />Creează o cerere nouă</Button>
        </Link>
      </div>

      <div className="p-4 border rounded-lg bg-slate-50 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 relative">
              <Input name="search" placeholder="Caută după titlu sau descriere..." value={filters.search} onChange={handleInputChange} className="pr-10"/>
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          </div>
          <Select value={filters.category || 'all'} onValueChange={(value) => handleFilterChange('category', value)}>
              <SelectTrigger><SelectValue placeholder="Categorie" /></SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Toate Categoriile</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
          </Select>
          <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Toate Statusurile</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
          </Select>
          <DatePicker date={filters.date} setDate={handleDateChange} placeholder="Filtrează după dată" />
        </div>
        <div className="flex items-center justify-end gap-4 mt-4">
            <Button onClick={handleResetFilters} variant="outline"><X className="mr-2 h-4 w-4"/>Resetează</Button>
            <div className="flex items-center gap-2">
                <Label htmlFor="sort" className="text-sm">Sortează după:</Label>
                <Select value={filters.sort} onValueChange={(value) => handleFilterChange('sort', value)}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sortează" /></SelectTrigger>
                    <SelectContent>{SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        </div>
      </div>

      <div className="pb-4">
        {loading ? (
          <div className="p-6 text-center flex items-center justify-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin" /><p>Se încarcă cererile...</p></div>
        ) : error ? (
          <p className="p-6 text-center text-red-500">{error}</p>
        ) : requests.length === 0 ? (
          <div className="text-center p-10 border-2 border-dashed border-gray-200 rounded-lg h-64 flex flex-col justify-center items-center">
            <h3 className="text-lg font-medium text-slate-800">Niciun rezultat găsit</h3>
            <p className="text-slate-500 mt-1">Încearcă să ajustezi filtrele de căutare.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
            {requests.map((request) => (<RequestCard key={request.id} request={request} />))}
          </div>
        )}
      </div>
    </div>
  );
}

