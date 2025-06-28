import React from "react";

import { RemixBrowser } from "@remix-run/react";
import { Provider as JotaiProvider } from "jotai";
import { hydrateRoot } from "react-dom/client";

function hydrate() {
  React.startTransition(() => {
    hydrateRoot(
      document,
      <React.StrictMode>
        <JotaiProvider>
          <RemixBrowser />
        </JotaiProvider>
      </React.StrictMode>,
      {
        onRecoverableError: (error) => {
          console.error("Recoverable hydration error:", error);
        },
      }
    );
  });
}

// Performance optimization: Use faster hydration strategy
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", hydrate);
} else if (typeof requestIdleCallback === "function") {
  requestIdleCallback(hydrate, { timeout: 100 });
} else {
  // Safari doesn't support requestIdleCallback
  // https://caniuse.com/requestidlecallback
  setTimeout(hydrate, 1);
}
