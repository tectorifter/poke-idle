import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameShell } from "@/components/game/shell";
import "./styles.css";

const el = document.getElementById("root");
if (!el) throw new Error("missing #root element");

createRoot(el).render(
  <StrictMode>
    <GameShell />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
