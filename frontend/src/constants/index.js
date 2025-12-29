export const CATEGORIES = [
  { value: 'all', label: 'Toate Categoriile' },
  { value: 'cerere_cetatean', label: 'Cerere Cetățean' },
  { value: 'act_administrativ', label: 'Act Administrativ' },
  { value: 'contract', label: 'Contract' },
  { value: 'raport', label: 'Raport' },
];

export const SORT_OPTIONS = [
    { value: 'created_at,desc', label: 'Cele mai noi' },
    { value: 'created_at,asc', label: 'Cele mai vechi' },
    { value: 'title,asc', label: 'Titlu (A-Z)' },
    { value: 'title,desc', label: 'Titlu (Z-A)' },
];

export const STATUSES = [
    { value: 'all', label: 'Toate Statusurile' },
    { value: 'in_progress', label: 'În desfășurare' },
    { value: 'submitted', label: 'Depusă' },
    { value: 'review_step1', label: 'Verificare inițială' },
    { value: 'review_step2', label: 'Verificare tehnică' },
    { value: 'review_step3', label: 'Verificare finală' },
    { value: 'completed', label: 'Finalizată' },
    { value: 'rejected', label: 'Refuzată' },
];

export const IN_PROGRESS_STAGES = ['submitted', 'review_step1', 'review_step2', 'review_step3'];
