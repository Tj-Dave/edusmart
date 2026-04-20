import React, { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../services/api";

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ userId, children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    const eventSource = new EventSource(
      `${API_BASE_URL}/notifications/stream/${userId}`
    );

    eventSource.addEventListener("notification", (event) => {
      const data = JSON.parse(event.data);
      setNotifications((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => eventSource.close();
  }, [userId]);

  const markAsRead = async (id) => {
    const token = window.localStorage.getItem("auth_token");
    await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: "PATCH",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(prev - 1, 0));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
};
