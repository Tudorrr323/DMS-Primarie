import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Link } from "react-router-dom";
import RequestStatusStepper from './RequestStatusStepper'; // Import the new stepper component

export default function RequestCard({ request }) {
  return (
    <Link to={`/requests/${request.id}`} className="block">
      <Card className="flex flex-col h-full transition-all hover:shadow-md hover:border-slate-300">
        <CardHeader>
          <CardTitle className="text-lg truncate">{request.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-slate-500 mb-4">{request.category}</p>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2">
          <span className="text-xs text-slate-400">
            {new Date(request.created_at).toLocaleDateString()}
          </span>
          <RequestStatusStepper 
            currentStatus={request.workflow_stage} 
            rejectedAtStage={
                request.workflow_stage === 'rejected' && request.workflow_history 
                ? request.workflow_history.find(h => h.action_type === 'rejection')?.from_stage 
                : null
            }
          />
        </CardFooter>
      </Card>
    </Link>
  );
}
