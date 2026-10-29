import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { academyPath, api } from "../../services/api";
import { cpfDigits, validCPF } from "../../types/cpf";

type Input = {
  student_id?: string;
  email: string;
  cpf: string;
  phone: string;
  alternate_phone: string;
};
type Result = {
  email_exists: boolean;
  cpf_exists: boolean;
  phone_exists: boolean;
  alternate_phone_exists: boolean;
};
export function useIdentityCheck(
  academyId: string,
  input: Input,
  enabled = true,
) {
  const email = input.email.trim().toLowerCase();
  const value = JSON.stringify({
    ...input,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
    cpf: validCPF(input.cpf) ? cpfDigits(input.cpf) : "",
  });
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), 450);
    return () => clearTimeout(timer);
  }, [value]);
  const check = useQuery({
    queryKey: ["student-identity-check", academyId, settled],
    queryFn: () =>
      api<Result>(academyPath(academyId, "/students/check-identity"), {
        method: "POST",
        body: JSON.parse(settled) as Input,
      }),
    enabled: enabled && settled === value,
    staleTime: 0,
    retry: false,
  });
  const current = enabled && settled === value ? check.data : undefined;
  return {
    ...current,
    pending:
      enabled && (settled !== value || check.isFetching || check.isPending),
    error: enabled && settled === value ? check.error?.message : undefined,
    cpfMessage: current?.cpf_exists
      ? "Este CPF já está cadastrado no sistema. Use o cadastro atual ou peça ao gestor para corrigir os dados."
      : "",
    emailMessage: current?.email_exists
      ? "Este e-mail já está cadastrado no sistema. Use a conta atual ou peça ao gestor para corrigir os dados."
      : "",
    phoneMessage: current?.phone_exists
      ? "Este celular já está em outro cadastro. Confira se é um contato compartilhado da família."
      : "",
    alternateMessage: current?.alternate_phone_exists
      ? "Este telefone já está em outro cadastro. Confira se é um contato compartilhado da família."
      : "",
  };
}
