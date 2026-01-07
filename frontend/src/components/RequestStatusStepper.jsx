import React from 'react';
import { cn } from "@/lib/utils";
import { XCircle, Check } from 'lucide-react';
import { WORKFLOW_STAGES } from '../lib/workflow-utils';

const STATUS_STEPS = Object.keys(WORKFLOW_STAGES)
  .filter(key => key !== 'rejected')
  .sort((a, b) => WORKFLOW_STAGES[a].order - WORKFLOW_STAGES[b].order);

export default function RequestStatusStepper({ currentStatus, rejectedAtStage }) {
  const isRejected = currentStatus === 'rejected';
  
  let referenceStage = isRejected ? rejectedAtStage : currentStatus;
  let currentStepIndex = STATUS_STEPS.indexOf(referenceStage);

  if (isRejected && currentStepIndex === -1) {
    return (
        <div className="flex items-center justify-center w-full gap-2 text-red-600 pt-4">
          <XCircle className="h-5 w-5" />
          <span className="font-medium">Cerere Refuzată</span>
        </div>
    );
  }

  if (currentStepIndex === -1) return null;

  return (
    <div className="flex items-center w-full pt-4 justify-between">
        {STATUS_STEPS.map((statusKey, index) => {
          const step = WORKFLOW_STAGES[statusKey];
          let isCompleted = index < currentStepIndex;
          let isCurrent = index === currentStepIndex;
          let isRejectionPoint = isRejected && index === currentStepIndex;
          
          if (isRejected) {
             isCompleted = index < currentStepIndex;
             isCurrent = false;
          }

          const prevStep = index > 0 ? WORKFLOW_STAGES[STATUS_STEPS[index - 1]] : null;
          let connectorColor = '#e5e7eb';
          if (index > 0 && index <= currentStepIndex) {
              if (isRejectionPoint) {
                  connectorColor = `linear-gradient(to right, ${prevStep.color}, #ef4444)`;
              } else {
                  connectorColor = `linear-gradient(to right, ${prevStep.color}, ${step.color})`;
              }
          }

          return (
            <React.Fragment key={statusKey}>
              {index > 0 && (
                <div className="flex-grow h-1 mx-0.5" style={{ background: connectorColor }}></div>
              )}
              
              <div className="flex flex-col items-center flex-shrink-0 relative group">
                <div className={cn(
                  "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all duration-300 z-10",
                  isRejectionPoint ? 'bg-red-500 text-white' : 
                  (isCompleted || isCurrent) ? step.bgColor : 'bg-gray-200 text-gray-400'
                )}>
                  {isRejectionPoint ? (
                      <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  ) : (isCompleted || isCurrent) ? (
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full"></div>
                  ) : null}
                </div>

                <span className={cn(
                  "mt-1 sm:mt-2 text-[8px] sm:text-[10px] uppercase tracking-wide text-center font-bold max-w-[50px] sm:max-w-[80px] leading-tight",
                  isRejectionPoint ? 'text-red-600' :
                  (isCompleted || isCurrent) ? step.textColor : 'text-gray-400'
                )}>
                  {isRejectionPoint ? "Respins" : step.label}
                </span>
                
                {isRejectionPoint && (
                    <div className="absolute -top-8 bg-red-600 text-white text-[10px] sm:text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                        Refuzat la {step.label}
                    </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
    </div>
  );
}