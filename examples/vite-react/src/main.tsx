import React from "react";
import { createRoot } from "react-dom/client";
import { Specter } from "react-specter";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    {/* Render-nothing wrapper — mounts the overlay in dev only. The DEV guard
        is statically false in production builds, so the whole import
        tree-shakes away (zero specter bytes shipped). */}
    {import.meta.env.DEV && (
      <Specter
        // Customization points:
        // agentLabel="DevBot"
        disableMCP={true}
        onSendText="Create Ticket"
        onSend={(e) => {
          console.log(e);
        }}
      />
    )}
  </React.StrictMode>,
);
