import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DeadFreight from "../app/page";
import "../app/globals.css";
import "./pages.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DeadFreight />
  </StrictMode>,
);
