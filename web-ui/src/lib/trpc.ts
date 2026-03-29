import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@kanban/server/trpc.js";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/trpc",
    }),
  ],
});
