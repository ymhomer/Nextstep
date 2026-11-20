import { createRoot } from "react-dom/client";
import PlannerApp from "../app/planner";
import LoginForm from "../app/login/form";
import "../app/globals.css";

const node = document.getElementById("root");
if (!node) throw new Error("Missing application root");

const root = createRoot(node);
const base = import.meta.env.BASE_URL;
const apiOrigin = import.meta.env.VITE_NEXTSTEP_API_ORIGIN;
const browserFetch = window.fetch.bind(window);

window.fetch = (input, init) => {
  if (typeof input === "string" && input.startsWith("/api/")) {
    return browserFetch(new URL(input, apiOrigin), { ...init, credentials: "include" });
  }
  return browserFetch(input, init);
};

async function render() {
  if (location.pathname.replace(/\/$/, "") === base + "login") {
    root.render(<LoginForm />);
    return;
  }
  const response = await fetch("/api/session", { cache: "no-store" });
  if (!response.ok && response.status !== 401) throw new Error("Unable to reach Nextstep.");
  const session = response.ok ? await response.json() : null;
  if (session && "serviceWorker" in navigator) {
    await navigator.serviceWorker.register(base + "sw.js");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve => navigator.serviceWorker.addEventListener(
        "controllerchange", () => resolve(), { once: true },
      ));
    }
  }
  root.render(<PlannerApp identity={session?.identity ?? ""} signedIn={!!session}
    name={session?.name ?? ""} provider="local" />);
}

render().catch(() => root.render(<p role="alert">Unable to connect to Nextstep. Reload to try again.</p>));
