// frontend/react-app/src/contexts/SetupContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import apiClient from "../services/apiClient";

interface SetupContextType {
  needsSetup: boolean;
  setupCompleted: boolean;
  isLoading: boolean;
}

const SetupContext = createContext<SetupContextType | undefined>(undefined);

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const [needsSetup, setNeedsSetup] = useState(true);
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await apiClient.get("/setup/status");
        const needs = response.data.needs_setup;
        const completed = response.data.setup_completed;
        
        setNeedsSetup(needs);
        setSetupCompleted(completed);
      } catch (error) {
        console.error("Failed to check setup status:", error);
        // On error, assume setup is complete (safer default)
        setNeedsSetup(false);
        setSetupCompleted(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkSetupStatus();
  }, []);

  return (
    <SetupContext.Provider value={{ needsSetup, setupCompleted, isLoading }}>
      {children}
    </SetupContext.Provider>
  );
}

export function useSetup() {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error("useSetup must be used within SetupProvider");
  }
  return context;
}
