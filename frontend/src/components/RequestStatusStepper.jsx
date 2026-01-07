import React from 'react';
import { cn } from "@/lib/utils";
import { XCircle, Check } from 'lucide-react';
import { WORKFLOW_STAGES } from '../lib/workflow-utils';

const STATUS_STEPS = Object.keys(WORKFLOW_STAGES)
  .filter(key => key !== 'rejected')
  .sort((a, b) => WORKFLOW_STAGES[a].order - WORKFLOW_STAGES[b].order);

export default function RequestStatusStepper({ currentStatus, rejectedAtStage }) {
  const isRejected = currentStatus === 'rejected';
  
  // Determine the reference stage index
  // If rejected, we look for the stage where it happened.
  // If active, we look for currentStatus.
  let referenceStage = isRejected ? rejectedAtStage : currentStatus;
  let currentStepIndex = STATUS_STEPS.indexOf(referenceStage);

  // Fallback: If rejected but we don't know where (e.g. old data), show generic message
  if (isRejected && currentStepIndex === -1) {
    return (
        <div className="flex items-center justify-center w-full gap-2 text-red-600 pt-4">
          <XCircle className="h-5 w-5" />
          <span className="font-medium">Cerere Refuzată</span>
        </div>
    );
  }

  // Fallback: If unknown status
  if (currentStepIndex === -1) return null;

  return (
    <div className="w-full overflow-x-auto pb-4 px-1">
      <div className="flex items-center w-full min-w-[300px]">
        {STATUS_STEPS.map((statusKey, index) => {
          const step = WORKFLOW_STAGES[statusKey];
          
          // Logic for Active Requests
          let isCompleted = index < currentStepIndex;
          let isCurrent = index === currentStepIndex;
          
          // Logic for Rejected Requests
          // Everything before the rejection point is "completed" (passed)
          // The rejection point itself is "Rejected"
          let isRejectionPoint = isRejected && index === currentStepIndex;
          
          if (isRejected) {
             isCompleted = index < currentStepIndex;
             isCurrent = false; // We use isRejectionPoint instead
          }

          const prevStep = index > 0 ? WORKFLOW_STAGES[STATUS_STEPS[index - 1]] : null;
          
          // Connector Color
          let connectorColor = '#e5e7eb'; // Gray default
          if (index > 0) {
              if (index <= currentStepIndex) {
                   // If this is the rejection segment (leading to rejection), color it red? 
                   // Or keep it green because previous step was good?
                   // Usually: Previous steps were good.
                   // If index == currentStepIndex (Rejection Step), the line coming TO it should be active/colored.
                   
                   // Use step color if valid, or red if leading to rejection?
                   // Let's keep it simple: gradient from prev to current.
                   // If it's the rejection point, maybe make the line red?
                   if (isRejectionPoint) {
                       connectorColor = `linear-gradient(to right, ${prevStep.color}, #ef4444)`; // Red-500
                   } else {
                       connectorColor = `linear-gradient(to right, ${prevStep.color}, ${step.color})`;
                   }
              }
          }

          return (
            <React.Fragment key={statusKey}>
              {/* Connector */}
              {index > 0 && (
                <div className="flex-grow h-1" style={{ background: connectorColor }}></div>
              )}
              
              {/* Step Circle and Label */}
              <div className="flex flex-col items-center flex-shrink-0 mx-2 relative group">
                {/* Circle */}
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 z-10",
                  isRejectionPoint ? 'bg-red-500 text-white' : 
                  (isCompleted || isCurrent) ? step.bgColor : 'bg-gray-200 text-gray-400'
                )}>
                  {isRejectionPoint ? (
                      <XCircle className="w-4 h-4" />
                  ) : (isCompleted || isCurrent) ? (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                  ) : null}
                </div>

                {/* Label */}
                <span className={cn(
                  "mt-2 text-[10px] uppercase tracking-wider text-center font-bold max-w-[80px]",
                  isRejectionPoint ? 'text-red-600' :
                  (isCompleted || isCurrent) ? step.textColor : 'text-gray-400'
                )}>
                  {isRejectionPoint ? "Respins" : step.label}
                </span>
                
                {/* Tooltip for Label if needed */}
                {isRejectionPoint && (
                    <div className="absolute -top-8 bg-red-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Refuzat la {step.label}
                    </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
