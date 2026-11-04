import { Button, Notice } from "./ui";

type RecoverableQuery = {
  error: Error | null;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

/** Retrying a read never repeats a payment, save, or other mutation. */
export function QueryError({ query }: { query: RecoverableQuery }) {
  if (!query.error) return null;
  return (
    <>
      <Notice message={query.error.message} />
      <Button
        compact
        secondary
        loading={query.isFetching}
        onPress={() => void query.refetch()}
      >
        Tentar novamente
      </Button>
    </>
  );
}
