import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const elem = document.getElementById("root");
if (!elem) throw new Error("Root element not found");

const app = <StrictMode>Hello world</StrictMode>;

if (import.meta.hot) {
  // biome-ignore lint/suspicious/noAssignInExpressions:  With hot module reloading, `import.meta.hot.data` is persisted.
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  // The hot module reloading API is not available in production.
  createRoot(elem).render(app);
}
