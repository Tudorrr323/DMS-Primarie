import React from 'react';
import { cn } from "@/lib/utils";
import { XCircle } from 'lucide-react';

const STATUS_CONFIG = {
  submitted:    { label: 'Depusă',               color: '#9ca3af', bgColor: 'bg-gray-400', textColor: 'text-gray-500', order: 0 },
  review_step1: { label: 'Verificare initiala',  color: '#3b82f6', bgColor: 'bg-blue-500',   textColor: 'text-blue-600',   order: 1 },
  review_step2: { label: 'Verificare tehnica',   color: '#f97316', bgColor: 'bg-orange-500', textColor: 'text-orange-600', order: 2 },
  review_step3: { label: 'Verificare finala',    color: '#8b5cf6', bgColor: 'bg-purple-500', textColor: 'text-purple-600', order: 3 },
  completed:    { label: 'Finalizata',           color: '#22c55e', bgColor: 'bg-green-500',  textColor: 'text-green-600',  order: 4 },
};

const STATUS_STEPS = Object.keys(STATUS_CONFIG).sort((a, b) => STATUS_CONFIG[a].order - STATUS_CONFIG[b].order);

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
          const step = STATUS_CONFIG[statusKey];
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          
          const prevStep = index > 0 ? STATUS_CONFIG[STATUS_STEPS[index - 1]] : null;
          
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
