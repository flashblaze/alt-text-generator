import api from "./hono/api";

export default {
  fetch(request, env, ctx) {
    return api.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
