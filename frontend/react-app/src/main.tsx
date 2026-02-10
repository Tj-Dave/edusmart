import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./state/AuthContext";
import { SetupProvider } from "./contexts/SetupContext";
import "./utils/debugAuth"; // Load debug utilities

// Suppress harmless browser extension/Electron message port errors IMMEDIATELY
// (before any other code runs)
const isHarmlessError = (msg: string) => {
  const str = msg?.toString?.() || "";
  return (
    str.includes("message port closed before a response was received") ||
    str.includes("runtime.lastError") ||
    str.includes("Extension context invalidated")
  );
};

// Override console.error
const originalConsoleError = console.error;
console.error = function (...args: any[]) {
  if (!isHarmlessError(args[0])) {
    originalConsoleError.apply(console, args);
  }
};

// Override console.warn for similar errors
const originalConsoleWarn = console.warn;
console.warn = function (...args: any[]) {
  if (!isHarmlessError(args[0])) {
    originalConsoleWarn.apply(console, args);
  }
};

// Catch global errors
window.addEventListener(
  "error",
  (event) => {
    const msg = event.message || event.error?.message || "";
    if (isHarmlessError(msg)) {
      event.preventDefault();
      return false;
    }
  },
  true
);

// Catch unhandled rejections
window.addEventListener(
  "unhandledrejection",
  (event) => {
    const msg = event.reason?.message || event.reason?.toString?.() || "";
    if (isHarmlessError(msg)) {
      event.preventDefault();
      return false;
    }
  },
  true
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SetupProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SetupProvider>
    </BrowserRouter>
  </React.StrictMode>
);
