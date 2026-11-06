import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main>
      <p className="eyebrow">CoyoteCode</p>
      <h1>Agent-powered development workspace</h1>
      <p className="intro">
        The frontend, backend, and agent harness are ready to evolve independently
        inside one workspace.
      </p>
      <a href="/api/health">Check backend health</a>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
