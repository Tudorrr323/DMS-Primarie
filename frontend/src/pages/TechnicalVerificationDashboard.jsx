import EmployeeDashboard from '@/components/EmployeeDashboard';

export default function TechnicalVerificationDashboard() {
  return (
    <EmployeeDashboard 
        title="Panou Verificare Tehnică"
        description="Verificarea tehnică a documentațiilor."
        poolStage="review_step2" 
        activeStage="review_step2"
        // Here, picking up doesn't change stage, just assigns it.
        // Or if you want to be explicit, maybe it stays 'review_step2'.
        nextStageOnPickup={null} 
    />
  );
}