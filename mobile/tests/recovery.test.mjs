import test from "node:test";
import assert from "node:assert/strict";
import { onlineManager } from "@tanstack/react-query";
import { createQueryClient } from "../src/services/query-client.ts";

test(
  "consulta offline não fica pausada indefinidamente",
  { timeout: 2000 },
  async () => {
    const client = createQueryClient();
    const wasOnline = onlineManager.isOnline();
    onlineManager.setOnline(false);
    try {
      const value = await client.fetchQuery({
        queryKey: ["offline-read"],
        queryFn: async () => "executed",
      });
      assert.equal(value, "executed");
    } finally {
      onlineManager.setOnline(wasOnline);
      client.clear();
    }
  },
);

test(
  "operação offline termina com erro sem repetir gravação ou pagamento",
  { timeout: 2000 },
  async () => {
    const client = createQueryClient();
    const wasOnline = onlineManager.isOnline();
    onlineManager.setOnline(false);
    let calls = 0;
    try {
      const mutation = client.getMutationCache().build(client, {
        mutationFn: async () => {
          calls++;
          throw new Error("connection lost");
        },
      });
      await assert.rejects(mutation.execute(undefined), /connection lost/);
      onlineManager.setOnline(true);
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(calls, 1);
      assert.equal(mutation.state.status, "error");
      assert.equal(mutation.state.isPaused, false);
    } finally {
      onlineManager.setOnline(wasOnline);
      client.clear();
    }
  },
);
