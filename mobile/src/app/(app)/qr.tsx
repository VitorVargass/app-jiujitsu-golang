import { RoleGate } from "../../features/shared/AcademyShell";
import { QRScreen } from "../../features/student/StudentScreen";
export default function QR() {
  return (
    <RoleGate role="student">
      <QRScreen />
    </RoleGate>
  );
}
