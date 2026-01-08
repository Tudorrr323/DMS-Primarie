import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { PlusCircle, Loader2, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import RequestCard from '@/components/RequestCard';
import { DateRangePicker } from '@/components/ui/date-range-picker';

const ITEMS_PER_PAGE = 10;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

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
        .select('*, workflow_history(action_type, from_stage)', { count: 'exact' });

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

      if (filters.date?.from) {
        const fromDateStr = filters.date.from.toISOString().split('T')[0];
        query = query.gte('created_at', `${fromDateStr}T00:00:00`);
      }
      
      if (filters.date?.to) {
        const toDateStr = filters.date.to.toISOString().split('T')[0];
        query = query.lte('created_at', `${toDateStr}T23:59:59`);
      }

      const [sortColumn, sortDirection] = filters.sort.split(',');
      if (sortColumn && sortDirection) {
          query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
      }
      
      // Pagination Logic
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      query = query.range(from, to);

      const { data, error: queryError, count } = await query;
      if (queryError) throw queryError;

      setRequests(data);
      setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));
    } catch (err) {
      setError(err.message);
      console.error('Eroare la încărcare:', err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value === 'all' ? '' : value }));
    setCurrentPage(1); // Reset to first page on filter change
  };
  
  const handleDateChange = (date) => {
    setFilters(prev => ({...prev, date: date}));
    setCurrentPage(1); // Reset to first page on filter change
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

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
        setCurrentPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Cererile mele</h2>
        <Link to="/requests/new">
          <Button className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" />Creează o cerere nouă</Button>
        </Link>
      </div>

      <div className="p-3 border rounded-xl bg-slate-50 dark:bg-slate-900 mb-6 flex flex-wrap items-center gap-2 transition-colors">
        {/* Search - Flexible */}
        <div className="relative flex-grow min-w-[240px]">
            <Input name="search" placeholder="Caută după titlu sau descriere..." value={filters.search} onChange={handleInputChange} className="pr-10 bg-white dark:bg-slate-950 h-9 shadow-sm transition-colors"/>
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>

        {/* Filters - Tightly packed */}
        <Select value={filters.category || 'all'} onValueChange={(value) => handleFilterChange('category', value)}>
            <SelectTrigger className="w-full sm:w-[160px] bg-white dark:bg-slate-950 h-9 shadow-sm text-xs transition-colors"><SelectValue placeholder="Categorie" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Toate Categoriile</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
        </Select>

        <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
            <SelectTrigger className="w-full sm:w-[160px] bg-white dark:bg-slate-950 h-9 shadow-sm text-xs transition-colors"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Toate Statusurile</SelectItem>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
        </Select>

        <div className="w-full lg:w-auto lg:min-w-[220px]">
            <DateRangePicker date={filters.date} setDate={handleDateChange} placeholder="Perioadă" />
        </div>

        {/* Sort & Reset - Pushed to the end */}
        <div className="flex items-center gap-2 ml-auto w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-2 lg:pt-0 mt-1 lg:mt-0">
            <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 uppercase font-bold whitespace-nowrap">Sort:</span>
                <Select value={filters.sort} onValueChange={(value) => handleFilterChange('sort', value)}>
                    <SelectTrigger className="w-[140px] bg-white dark:bg-slate-950 h-8 text-xs shadow-sm transition-colors"><SelectValue placeholder="Sortează" /></SelectTrigger>
                    <SelectContent>{SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            
            <Button onClick={handleResetFilters} variant="ghost" size="sm" className="h-8 text-xs text-slate-500 hover:text-red-600 px-2">
                <X className="mr-1 h-3 w-3"/>Reset
            </Button>
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                {requests.map((request) => (<RequestCard key={request.id} request={request} />))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handlePageChange(currentPage - 1)} 
                        disabled={currentPage <= 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-slate-600 font-medium">
                        Pagina {currentPage} din {totalPages}
                    </span>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handlePageChange(currentPage + 1)} 
                        disabled={currentPage >= totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

