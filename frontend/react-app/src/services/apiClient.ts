import axios, { AxiosInstance, AxiosError } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8001/api";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
});

// Request interceptor: add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // Debug: Log when sending auth header
      console.log(`[API] Sending request to ${config.url} with Authorization header`);
    } else {
      console.log(`[API] No auth token in localStorage for request to ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 - logout user
    if (error.response?.status === 401) {
      console.error("[API] 401 Unauthorized - logging out", error.response.data);
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
    }

    // Handle 403 - permission denied
    if (error.response?.status === 403) {
      console.error("[API] 403 Permission Denied:", error.response.data);
      console.error("[API] Current token:", localStorage.getItem("auth_token"));
    }

    return Promise.reject(error);
  }
);

export default apiClient;
