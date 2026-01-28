import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App.tsx";
import { AuthProvider } from "./app/contexts/AuthContext";

import "./styles/index.css";   // defines --spacing
import "./styles/theme.css";   // uses spacing
import "./styles/tailwind.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);