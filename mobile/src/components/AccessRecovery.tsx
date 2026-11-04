import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "../services/session";
import { Button, Notice } from "./ui";

/** Public deep links must offer an exit even when the account cannot access them. */
export function AccessRecovery({
  next,
  disabled = false,
}: {
  next?: string;
  disabled?: boolean;
}) {
  const { session, logout } = useSession();
  const changeAccount = useMutation({
    mutationFn: logout,
    onSuccess: () =>
      router.replace({ pathname: "/login", params: next ? { next } : {} }),
  });
  return (
    <>
      <Button
        secondary
        disabled={disabled || changeAccount.isPending}
        onPress={() => router.replace("/entry")}
      >
        {session ? "Minhas academias" : "Ir para o acesso"}
      </Button>
      {session ? (
        <Button
          secondary
          disabled={disabled}
          loading={changeAccount.isPending}
          onPress={() => changeAccount.mutate()}
        >
          Entrar com outra conta
        </Button>
      ) : null}
      <Notice message={changeAccount.error?.message} />
    </>
  );
}
