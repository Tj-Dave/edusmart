import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import apiClient from "../services/apiClient";
import { useCourseStore } from "../stores/courseStore";

export type UserRole = "student" | "lecturer" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  courses?: string[];
  approved?: boolean;
  password_hash?: string | null;
  is_first_login?: boolean;
}

export interface DecodedToken {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  status: AuthStatus;
  error: string | null;
}

type AuthAction =
  | { type: "LOGIN_START" }
  | { type: "LOGIN_SUCCESS"; payload: { token: string; user: User } }
  | { type: "LOGIN_ERROR"; payload: string }
  | { type: "UPDATE_USER"; payload: User }
  | { type: "LOGOUT" }
  | { type: "RESTORE_TOKEN"; payload: { token: string; user: User } }
  | { type: "SET_STATUS"; payload: AuthStatus };

const initialState: AuthState = {
  user: null,
  token: null,
  loading: true,
  status: 'checking',
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "LOGIN_START":
      return { ...state, loading: true, status: 'checking', error: null };
    case "LOGIN_SUCCESS":
      return {
        user: action.payload.user,
        token: action.payload.token,
        loading: false,
        status: 'authenticated',
        error: null,
      };
    case "LOGIN_ERROR":
      return { ...state, error: action.payload, loading: false, status: 'unauthenticated' };
    case "UPDATE_USER":
      return { ...state, user: action.payload };
    case "LOGOUT":
      return { user: null, token: null, loading: false, status: 'unauthenticated', error: null };
    case "RESTORE_TOKEN":
      return {
        user: action.payload.user,
        token: action.payload.token,
        loading: false,
        status: 'authenticated',
        error: null,
      };
    case "SET_STATUS":
      return { ...state, status: action.payload };
    default:
      return state;
  }
}

const AuthContext = createContext<
  | (AuthState & {
      login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
      logout: () => void;
      isAuthenticated: boolean;
      decoded: DecodedToken | null;
      status: AuthStatus;
    })
  | null
>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ✅ On mount: Restore courseStore from localStorage
  useEffect(() => {
    const courseStore = useCourseStore.getState();
    courseStore.restoreFromLocalStorage();
  }, []);

  // ✅ On mount: Restore token from localStorage if it exists
  useEffect(() => {
    const savedToken = localStorage.getItem("auth_token");
    
    if (savedToken) {
      // Token exists - restore it
      try {
        const decoded = jwtDecode<DecodedToken>(savedToken);
        
        // Check if token is expired
        const now = Date.now() / 1000;
        if (decoded.exp > now) {
          // Token is still valid
          apiClient.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
          
          // Map backend user response to frontend User type
          const user: User = {
            id: decoded.email,
            email: decoded.email,
            name: "",
            role: decoded.role,
            approved: true,
          };
          
          dispatch({ type: "RESTORE_TOKEN", payload: { token: savedToken, user } });
        } else {
          // Token expired - clear it
          localStorage.removeItem("auth_token");
          delete apiClient.defaults.headers.common["Authorization"];
          dispatch({ type: "LOGIN_ERROR", payload: "Session expired" });
        }
      } catch (error) {
        // Token invalid - clear it
        localStorage.removeItem("auth_token");
        delete apiClient.defaults.headers.common["Authorization"];
        dispatch({ type: "LOGIN_ERROR", payload: "" });
      }
    } else {
      // No token - mark as unauthenticated
      dispatch({ type: "LOGIN_ERROR", payload: "" });
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        dispatch({ type: "LOGIN_START" });

        // Call backend login endpoint
        const response = await apiClient.post("/auth/login", {
          email: email.toLowerCase().trim(),
          password,
        });

        console.log("✅ Login response:", response.data);

        const { access_token, user: backendUser } = response.data;

        // Map backend user response to frontend User type
        const user: User = {
          id: backendUser.email,
          email: backendUser.email,
          name: backendUser.full_name || "",
          role: backendUser.role as UserRole,
          approved: backendUser.approved || false,
          courses: backendUser.courses ? backendUser.courses.split(",") : undefined,
          is_first_login: backendUser.is_first_login === true,
        };

        console.log("✅ Mapped user:", user);

        // Save token
        localStorage.setItem("auth_token", access_token);
        apiClient.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;

        // ✅ Dispatch state change immediately
        dispatch({ type: "LOGIN_SUCCESS", payload: { token: access_token, user } });

        // ⚠️ CRITICAL: Navigate based on role IMMEDIATELY (synchronously)
        // PrivateRoute will handle any additional redirects
        if (user.is_first_login) {
          navigate("/set-password");
        } else if (user.role === "student") {
          navigate("/course-selection");
        } else if (user.role === "lecturer") {
          navigate(user.approved ? "/upload" : "/lecturer-pending");
        } else if (user.role === "admin") {
          navigate("/admin");
        }

        return { success: true };
      } catch (error: any) {
        console.error("❌ Login error:", error);
        const message = error?.response?.data?.detail || error?.message || "Invalid email or password";
        dispatch({ type: "LOGIN_ERROR", payload: message });
        return { success: false, error: message };
      }
    },
    [navigate]
  );

  const logout = useCallback(() => {
    // Clear auth
    localStorage.removeItem("auth_token");
    delete apiClient.defaults.headers.common["Authorization"];
    
    // Clear course selection
    localStorage.removeItem("selected_course");
    const courseStore = useCourseStore.getState();
    courseStore.resetSelection();
    
    dispatch({ type: "LOGOUT" });
    navigate("/login");
  }, [navigate]);

  const isAuthenticated = Boolean(state.token && state.user);

  const decoded = useMemo(() => {
    if (!state.token) return null;
    try {
      return jwtDecode<DecodedToken>(state.token);
    } catch {
      return null;
    }
  }, [state.token]);

  const value = useMemo(
    () => ({
      ...state,
      login,
      logout,
      isAuthenticated,
      decoded,
    }),
    [state, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
