import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const elem = document.getElementById("root");
if (!elem) throw new Error("Root element not found");

createRoot(elem).render(<StrictMode>Hello world</StrictMode>);
