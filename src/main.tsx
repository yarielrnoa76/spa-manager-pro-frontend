import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";

import "./index.css";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Stripe redirige a una ruta real del navegador (fuera del hash) tras el
// onboarding de Express o el callback de OAuth. Se reescribe al hash antes
// de montar el HashRouter para que la ruta y los query params no se pierdan.
if (window.location.pathname === "/settings/payments/stripe" && window.location.search) {
  window.history.replaceState(null, "", `/#/settings${window.location.search}`);
}

import { GoogleOAuthProvider } from "@react-oauth/google";

createRoot(rootElement).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
      <HashRouter>
        <App />
      </HashRouter>
    </GoogleOAuthProvider>
  </StrictMode>
);
