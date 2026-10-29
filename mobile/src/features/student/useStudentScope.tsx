import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, Chip, Label, Row, Notice, Button } from "../../components/ui";
import { api, academyPath } from "../../services/api";
import { useSession } from "../../services/session";
export type FamilyStudent = { id: string; name: string; status: string };
export function useStudentScope(enabled = true) {
  const { academy, session } = useSession();
  const qc = useQueryClient();
  const user = session?.kind === "user" ? session.user.id : "";
  const key = ["family-selection", user, academy?.id];
  const family = useQuery({
    queryKey: ["family-students", user, academy?.id],
    queryFn: () =>
      api<FamilyStudent[]>(academyPath(academy!.id, "/me/students")),
    enabled: enabled && !!academy && !!user,
  });
  const selection = useQuery<string>({
    queryKey: key,
    queryFn: () => Promise.resolve(""),
    enabled: false,
    initialData: "",
  });
  const id =
    family.data?.find((x) => x.id === selection.data)?.id ??
    family.data?.[0]?.id ??
    "";
  return {
    ...family,
    id,
    select: (value: string) => qc.setQueryData(key, value),
  };
}
export function StudentSelector({
  scope,
  onChange,
}: {
  scope: ReturnType<typeof useStudentScope>;
  onChange?: () => void;
}) {
  if (scope.error)
    return (
      <Card>
        <Notice message={scope.error.message} />
        <Button secondary compact onPress={() => scope.refetch()}>
          Tentar novamente
        </Button>
      </Card>
    );
  if (!scope.data?.length)
    return scope.isPending ? null : (
      <Card>
        <Label>
          Nenhum aluno está vinculado a este acesso. Peça à academia para
          conferir seu cadastro.
        </Label>
      </Card>
    );
  return (
    <Card>
      <Label muted>{scope.data.length > 1 ? "Consultar aluno" : "Aluno"}</Label>
      <Row>
        {scope.data.map((x) => (
          <Chip
            key={x.id}
            selected={scope.id === x.id}
            onPress={() => {
              scope.select(x.id);
              onChange?.();
            }}
          >
            {x.name}
          </Chip>
        ))}
      </Row>
    </Card>
  );
}
