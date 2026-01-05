export const WORKFLOW_STAGES = {
  submitted:    { label: 'Depusă',               color: '#9ca3af', bgColor: 'bg-gray-400', textColor: 'text-gray-500', badgeTextColor: 'text-white', order: 0 },
  review_step1: { label: 'Verificare Inițială',  color: '#3b82f6', bgColor: 'bg-blue-500', textColor: 'text-blue-600', badgeTextColor: 'text-white', order: 1 },
  review_step2: { label: 'Verificare Tehnică',   color: '#f97316', bgColor: 'bg-orange-500', textColor: 'text-orange-600', badgeTextColor: 'text-white', order: 2 },
  review_step3: { label: 'Verificare Finală',    color: '#8b5cf6', bgColor: 'bg-purple-500', textColor: 'text-purple-600', badgeTextColor: 'text-white', order: 3 },
  completed:    { label: 'Finalizată',           color: '#22c55e', bgColor: 'bg-green-500', textColor: 'text-green-600', badgeTextColor: 'text-white', order: 4 },
  rejected:     { label: 'Refuzată',             color: '#ef4444', bgColor: 'bg-red-500', textColor: 'text-red-600', badgeTextColor: 'text-white', order: 5 },
};

export const getWorkflowStageInfo = (stage) => {
  return WORKFLOW_STAGES[stage] || { label: stage, color: "bg-gray-400" };
};

export const WORKFLOW_ACTIONS = {
    stage_change: { label: "Schimbare Stadiu" },
    rejection: { label: "Respingere" },
    comment: { label: "Comentariu" },
    signature: { label: "Semnătură" },
    file_upload: { label: "Încărcare Fișier" },
};

export const getWorkflowActionLabel = (action) => {
    return WORKFLOW_ACTIONS[action]?.label || action;
};

// Define the order of the steps for the stepper
export const STEPPER_STAGES = [
  'submitted',
  'review_step1',
  'review_step2',
  'review_step3',
  'completed'
];
