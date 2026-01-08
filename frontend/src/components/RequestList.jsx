import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function RequestList({ title, requests, viewAllLink, renderStatusStepper }) {
  const limitedRequests = requests.slice(0, 3); // Show a few requests

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-2xl font-bold">{title} ({requests.length})</CardTitle>
        {requests.length > 3 && (
          <Link to={viewAllLink.to} state={viewAllLink.state}>
            <Button variant="ghost" size="sm">Vezi tot</Button>
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {limitedRequests.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {limitedRequests.map(request => (
                <Link key={request.id} to={`/requests/${request.id}`} className="flex flex-col p-3 rounded-md border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                    <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{request.title}</p>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(request.created_at).toLocaleDateString()}</span>
                    </div>
                    {renderStatusStepper && (
                        <div className="mt-2">
                            {renderStatusStepper(request)}
                        </div>
                    )}
                </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-4">Nicio cerere în această categorie.</p>
        )}
      </CardContent>
    </Card>
  );
}
