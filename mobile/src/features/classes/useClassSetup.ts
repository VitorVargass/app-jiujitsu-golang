import { useQuery } from "@tanstack/react-query";
import { academyPath, api } from "../../services/api";
import { Class } from "../../types";

export function useClassSetup(academyId: string | undefined, enabled: boolean) {
  const classes = useQuery({
    queryKey: ["classes", academyId],
    queryFn: () => api<Class[]>(academyPath(academyId!, "/classes")),
    enabled: enabled && !!academyId,
    staleTime: 30000,
    refetchInterval: 30000,
  });
  const confirmed = enabled && classes.isSuccess;
  const hasSchedule = classes.data?.some(
    (item) => item.active && item.schedules?.length > 0,
  );
  const needsSetup = confirmed && !hasSchedule;
  const hasClasses = !!classes.data?.length;
  return { needsSetup, hasClasses };
}
