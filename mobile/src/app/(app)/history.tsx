import { RoleGate } from "../../features/shared/AcademyShell";
import { HistoryScreen } from "../../features/student/StudentScreen";
export default function History() {
  return (
    <RoleGate role="student">
      <HistoryScreen />
    </RoleGate>
  );
}
