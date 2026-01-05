import EmployeeDashboard from '@/components/EmployeeDashboard';

export default function FinalVerificationDashboard() {
  return (
    <EmployeeDashboard 
        title="Panou Verificare Finală"
        description="Aprobarea finală a documentelor."
        poolStage="review_step3" 
        activeStage="review_step3"
        nextStageOnPickup={null} 
    />
  );
}