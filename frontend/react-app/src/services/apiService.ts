import apiClient from "./apiClient";
import { InstitutionConfig } from "../stores/institutionStore";

// ============= AUTH ENDPOINTS =============
export async function loginUser(email: string, password: string) {
  const response = await apiClient.post("/auth/login", { email, password });
  return response.data;
}

export async function setPassword(password: string) {
  const response = await apiClient.post("/auth/set-password", { password });
  return response.data;
}

// ============= INSTITUTION CONFIG =============
export async function fetchInstitutionConfig(): Promise<InstitutionConfig> {
  const response = await apiClient.get("/config/institution");
  return response.data;
}

// ============= CHAT ENDPOINTS =============
export async function createChat(
  campus: string,
  year: string,
  semester: string,
  courseCode: string
) {
  const response = await apiClient.post("/chats", {
    campus,
    year,
    semester,
    course_code: courseCode,
  });
  return response.data;
}

export async function sendMessage(
  chatId: string,
  query: string,
  bloomLevel?: string,
  courseCode?: string,
  semester?: string,
  year?: string
) {
  const response = await apiClient.post(`/chats/${chatId}/messages`, {
    query,
    bloom_level: bloomLevel,
    course_code: courseCode,
    semester,
    year,
  });
  return response.data;
}

export async function getChatHistory(chatId: string) {
  const response = await apiClient.get(`/chats/${chatId}`);
  return response.data;
}

// ============= UPLOAD ENDPOINTS =============
export async function uploadFile(
  file: File,
  onProgress?: (progressEvent: any) => void
) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post("/ingest/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: onProgress,
  });

  return response.data;
}

export async function checkLecturerUploadStatus(lecturerId: string) {
  const response = await apiClient.get(`/ingest/lecturer/${lecturerId}`);
  return response.data;
}

// ============= ADMIN ENDPOINTS =============
export async function importUsersCSV(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post("/admin/users/import", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}

export async function getUsers(filters?: any) {
  const response = await apiClient.get("/admin/users", { params: filters });
  return response.data;
}

export async function updateUser(userId: string, updates: any) {
  const response = await apiClient.patch(`/admin/users/${userId}`, updates);
  return response.data;
}

export async function deleteUser(userId: string) {
  const response = await apiClient.delete(`/admin/users/${userId}`);
  return response.data;
}

export async function getContentOverview() {
  const response = await apiClient.get("/admin/content-overview");
  return response.data;
}

export async function updateInstitutionConfig(config: Partial<InstitutionConfig>) {
  const response = await apiClient.put("/admin/config/institution", config);
  return response.data;
}
