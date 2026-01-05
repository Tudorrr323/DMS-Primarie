import React from 'react';
import { cn } from "@/lib/utils";
import { XCircle } from 'lucide-react';
import { WORKFLOW_STAGES } from '../lib/workflow-utils';

const STATUS_STEPS = Object.keys(WORKFLOW_STAGES)
  .filter(key => key !== 'rejected')
  .sort((a, b) => WORKFLOW_STAGES[a].order - WORKFLOW_STAGES[b].order);

export default function RequestStatusStepper({ currentStatus }) {
  const currentStepIndex = STATUS_STEPS.indexOf(currentStatus);
  const isRejected = currentStatus === 'rejected';

  if (currentStepIndex === -1 && !isRejected) {
    return null;
  }

  return (
    <div className="flex items-center w-full pt-4">
      {isRejected ? (
        <div className="flex items-center justify-center w-full gap-2 text-red-600">
          <XCircle className="h-5 w-5" />
          <span className="font-medium">Cerere Refuzată</span>
        </div>
      ) : (
        STATUS_STEPS.map((statusKey, index) => {
          const step = WORKFLOW_STAGES[statusKey];
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          
          const prevStep = index > 0 ? WORKFLOW_STAGES[STATUS_STEPS[index - 1]] : null;
          
          return (
            <React.Fragment key={statusKey}>
              {/* Connector */}
              {index > 0 && (
                <div className="flex-grow h-1" style={{
                  background: index <= currentStepIndex
                    ? `linear-gradient(to right, ${prevStep.color}, ${step.color})` 
                    : '#e5e7eb' /* gray-200 */
                }}></div>
              )}
              
              {/* Step Circle and Label */}
              <div className="flex flex-col items-center flex-shrink-0 mx-2">
                <div className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300",
                  (isCompleted || isCurrent) ? step.bgColor : 'bg-gray-300'
                )}>
                  {(isCompleted || isCurrent) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                </div>
                <span className={cn(
                  "mt-2 text-xs text-center font-medium",
                  (isCompleted || isCurrent) ? step.textColor : 'text-gray-400'
                )}>
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })
      )}
    </div>
  );
}
