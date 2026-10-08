import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initializeElectrobunRpcBridge } from "./lib/electrobunRpcBridge";

initializeElectrobunRpcBridge();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Desktop renderer root element is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
