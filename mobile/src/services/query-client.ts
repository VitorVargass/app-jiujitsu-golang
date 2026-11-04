import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Attempt requests even when the browser reports offline. The API timeout
      // then settles the operation and releases loading states and dialogs.
      queries: { retry: 1, staleTime: 15000, networkMode: "always" },
      // Never replay writes or payments automatically after reconnecting.
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

export const queryClient = createQueryClient();
