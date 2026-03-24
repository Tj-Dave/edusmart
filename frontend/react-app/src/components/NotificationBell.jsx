import React, { useState } from "react";
import { useNotifications } from "../context/NotificationContext";

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)}>
        🔔 {unreadCount > 0 && <span>({unreadCount})</span>}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            background: "#fff",
            border: "1px solid #ccc",
            width: "300px",
            maxHeight: "400px",
            overflowY: "auto",
            zIndex: 100,
          }}
        >
          {notifications.length === 0 && <div>No notifications</div>}
          {notifications.map((n) => (
            <div
              key={n.id}
              style={{
                padding: "8px",
                background: n.is_read ? "#f9f9f9" : "#e6f7ff",
                cursor: "pointer",
              }}
              onClick={() => markAsRead(n.id)}
            >
              <strong>{n.title}</strong>
              <p>{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
