import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft } from 'lucide-react';

export default function RequestTimeline() {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setRequest(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRequest();
  }, [id]);
  
  // These functions can be moved to a shared utility file later
  const getStatusVariant = (status) => {
    // ... same as in RequestCard
  };
  const getStatusLabel = (status) => {
    // ... same as in RequestCard
  };

  return (
    <div>
      <Link to="/requests" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la cereri
      </Link>

      {loading ? (
        <div className="flex items-center justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : error ? (
        <p className="text-red-500">Eroare: {error}</p>
      ) : request ? (
        <Card>
          <CardHeader>
            <CardTitle>{request.title}</CardTitle>
            <CardDescription>{request.category}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm text-slate-500">
                Depusă la: {new Date(request.created_at).toLocaleString()}
              </span>
              {/* This badge should be inside the timeline ideally, but shown here for now */}
              <Badge variant={getStatusVariant(request.workflow_stage)}>
                {getStatusLabel(request.workflow_stage)}
              </Badge>
            </div>
            
            <h3 className="text-lg font-semibold mb-4 border-t pt-4">Istoric status</h3>
            {/* Timeline Placeholder */}
            <div className="space-y-4">
              <p className="text-slate-500">Un timeline al evenimentelor va fi afișat aici.</p>
              {/* Example of a timeline item */}
              <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                      <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                      <div className="w-px h-full bg-slate-200"></div>
                  </div>
                  <div>
                      <p className="font-medium">Cerere depusă</p>
                      <p className="text-xs text-slate-500">{new Date(request.created_at).toLocaleString()}</p>
                  </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p>Cererea nu a fost găsită.</p>
      )}
    </div>
  );
}
