import { create } from "zustand";

interface OfflineStore {
  isOnline: boolean;
  setIsOnline: (isOnline: boolean) => void;
  initializeOnlineListener: () => void;
}

export const useOfflineStore = create<OfflineStore>((set) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,

  setIsOnline: (isOnline) => {
    set({ isOnline });
  },

  initializeOnlineListener: () => {
    if (typeof window !== "undefined") {
      const handleOnline = () => set({ isOnline: true });
      const handleOffline = () => set({ isOnline: false });

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  },
}));
