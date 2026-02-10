/**
 * Debug utilities for authentication troubleshooting
 * Usage in browser console:
 *   window.debugAuth()  - Shows all auth info
 *   window.debugAuth('clear')  - Clears auth tokens
 *   window.debugAuth('reset')  - Clears all storage
 */

export function debugAuth(action?: string) {
  const token = localStorage.getItem("auth_token");
  const selectedCourse = localStorage.getItem("selected_course");
  
  if (action === 'clear') {
    localStorage.removeItem("auth_token");
    console.log("✅ Auth token cleared from localStorage");
    return;
  }
  
  if (action === 'reset') {
    localStorage.clear();
    console.log("✅ All localStorage cleared");
    return;
  }
  
  // Default: show current auth state
  console.group("🔐 Authentication State");
  console.log("Token exists:", !!token);
  if (token) {
    console.log("Token:", token.substring(0, 50) + "...");
    
    // Try to decode
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        console.log("Decoded payload:", payload);
        console.log("Email:", payload.email);
        console.log("Role:", payload.role);
        console.log("Expires:", new Date(payload.exp * 1000).toLocaleString());
      }
    } catch (e) {
      console.log("Could not decode token:", e);
    }
  }
  console.log("Selected course:", selectedCourse);
  console.groupEnd();
}

// Make available globally
declare global {
  interface Window {
    debugAuth: (action?: string) => void;
  }
}

// Install on window when this module is imported
if (typeof window !== "undefined") {
  (window as any).debugAuth = debugAuth;
}
