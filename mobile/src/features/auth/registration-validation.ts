export function registrationProblem(
  password: string,
  confirmation: string,
  acknowledged: boolean,
) {
  if (password !== confirmation) return "As senhas precisam ser iguais.";
  if (!acknowledged)
    return "Aceite os Termos de Uso e confirme a ciência do Aviso de Privacidade para continuar.";
  return "";
}
