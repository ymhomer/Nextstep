import {flushPushQueue} from "../lib/web-push";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const pageOrigin = "https://ymhomer.github.io";
    const standalone = (typeof __NEXTSTEP_STANDALONE__ !== 'undefined' && __NEXTSTEP_STANDALONE__);
    const url = new URL(request.url);
    const fromPages = standalone && url.pathname.startsWith("/api/") &&
      request.headers.get("origin") === pageOrigin;
    const cors = {
      "Access-Control-Allow-Origin": pageOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, x-nextstep-session, x-workspace-id, x-record-id, x-file-name",
      "Access-Control-Expose-Headers": "content-disposition",
      "Vary": "Origin",
    };
    if (fromPages && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Standalone deployments have no Sites identity gateway.
    if (standalone) {
      const headers = new Headers(request.headers);
      for (const name of Array.from(headers.keys())) {
        if (name.startsWith("oai-authenticated-user-")) headers.delete(name);
      }
      if (fromPages && url.pathname !== "/api/passkeys") {
        headers.set("origin", url.origin);
      }
      request = new Request(request, { headers });
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response=await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    if(['POST','PUT','DELETE'].includes(request.method))ctx.waitUntil(flushPushQueue().catch(()=>{}));
    if (!fromPages) return response;
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(cors)) headers.set(name, value);
    return new Response(response.body, { status: response.status, headers });
  },
};
