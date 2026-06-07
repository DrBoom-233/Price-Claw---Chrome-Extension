import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../ui/App";

const surface = new URLSearchParams(window.location.search).get("surface") === "window" ? "window" : "popup";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App surface={surface} />
  </StrictMode>
);
