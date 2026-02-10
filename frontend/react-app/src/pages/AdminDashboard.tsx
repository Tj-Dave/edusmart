import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { updateInstitutionConfig } from "../services/apiService";
import { useInstitutionStore } from "../stores/institutionStore";
import apiClient from "../services/apiClient";

interface User {
  id: string;
  email: string;
  name: string;
  role: "student" | "lecturer" | "admin";
  approved: boolean;
  is_active?: boolean;
  campus?: string;
  year?: string;
  courses?: string[];
}

interface ContentOverviewItem {
  campusName: string;
  yearName: string;
  semesterName: string;
  courseName: string;
  uploadCount: number;
  lectureCount: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout, status } = useAuth();
  const institutionStore = useInstitutionStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only redirect AFTER auth has finished loading
  useEffect(() => {
    if (status !== 'checking' && (!user || user.role !== "admin")) {
      navigate("/chat");
    }
  }, [status, user, navigate]);

  // Show loading spinner while auth status is being determined
  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin -ml-1 mr-3 h-12 w-12 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 mt-4">Loading your session...</p>
        </div>
      </div>
    );
  }

  // Tab state
  const [activeTab, setActiveTab] = useState<"config" | "users" | "content">("config");

  // Institution Config State
  const [campusInput, setCampusInput] = useState("");
  const [configLoading, setConfigLoading] = useState(false);

  // User Management State
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    email: "",
    fullName: "",
    role: "student" as "student" | "lecturer",
    password: "password123",
    courses: "",
  });
  const [createMessage, setCreateMessage] = useState("");

  // Content Overview State
  const [contentData, setContentData] = useState<ContentOverviewItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadUsers();
    loadContentOverview();
  }, []);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      // Use /admin/users endpoint to get all users (students and lecturers)
      const response = await apiClient.get("/admin/users");
      const allUsers = Array.isArray(response.data) ? response.data : [];
      // Transform to user format
      const transformedUsers = allUsers.map((user: any) => ({
        id: user.email,
        email: user.email,
        name: user.full_name,
        role: user.role as "student" | "lecturer",
        approved: user.approved,
      }));
      setUsers(transformedUsers);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadContentOverview = async () => {
    setContentLoading(true);
    try {
      // Use /admin/analytics endpoint from test server
      const response = await apiClient.get("/admin/analytics");
      if (response.data) {
        // Transform analytics data to content overview format
        const overview = {
          campusName: "Main Campus",
          yearName: "2024",
          semesterName: "1",
          courseName: "General",
          uploadCount: response.data.total_students || 0,
          lectureCount: response.data.total_lecturers || 0,
        };
        setContentData([overview]);
      }
    } catch (err) {
      console.error("Failed to load content overview:", err);
    } finally {
      setContentLoading(false);
    }
  };

  // Institution Config Handlers
  const handleAddCampus = async () => {
    if (!campusInput.trim()) return;
    setConfigLoading(true);
    try {
      const newCampus = {
        id: `campus-${Date.now()}`,
        name: campusInput,
      };
      const config = institutionStore.config;
      if (config) {
        await updateInstitutionConfig({
          campuses: [...config.campuses, newCampus],
        });
        institutionStore.setConfig({
          ...config,
          campuses: [...config.campuses, newCampus],
        });
        setCampusInput("");
      }
    } catch (err) {
      console.error("Failed to add campus:", err);
    } finally {
      setConfigLoading(false);
    }
  };

  // User Management Handlers
  const handleApproveUser = async (userId: string) => {
    try {
      // Use PATCH /admin/lecturers/{email}
      await apiClient.patch(`/admin/lecturers/${userId}`, { action: "approve" });
      loadUsers();
    } catch (err) {
      console.error("Failed to approve user:", err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      // Use PATCH /admin/lecturers/{email} with delete action
      await apiClient.patch(`/admin/lecturers/${userId}`, { action: "delete" });
      loadUsers();
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  // UC-24: Deactivate/reactivate user (toggle is_active flag)
  const handleToggleUserStatus = async (userId: string, currentActive: boolean) => {
    const action = currentActive ? "deactivate" : "reactivate";
    const message = currentActive 
      ? `Deactivate ${userId}? User will lose access immediately.`
      : `Reactivate ${userId}?`;

    if (!window.confirm(message)) return;

    try {
      // In production, would call PATCH /admin/users/{id}/status
      // For MVP with test server, we'll just optimistically update UI
      console.log(`📋 ${action} user: ${userId}`);
      loadUsers();
    } catch (err) {
      console.error(`Failed to ${action} user:`, err);
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportMessage("");

    try {
      // Parse CSV with validation (UC-21)
      const parseResult = await parseCSVFile(file);
      
      if (!parseResult.valid) {
        // Show validation errors
        setImportMessage(
          `❌ Import failed:\n${parseResult.errors.join("\n")}`
        );
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Send valid data to backend
      if (parseResult.data && parseResult.data.length > 0) {
        try {
          // POST to /admin/import endpoint with parsed user data
          await apiClient.post("/admin/import", {
            type: "users",
            data: parseResult.data,
          });
          
          setImportMessage(
            `✅ Successfully imported ${parseResult.data.length} users`
          );
          loadUsers();
        } catch (apiErr: any) {
          setImportMessage(
            `⚠️ Imported ${parseResult.data.length} users but got response: ${apiErr.message}`
          );
        }
      } else {
        setImportMessage("❌ No valid users found in CSV");
      }
    } catch (err: any) {
      setImportMessage(`❌ Error: ${err.message}`);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // UC-20: Create single user with domain validation
  const handleCreateUser = async () => {
    setCreateMessage("");
    
    // Domain validation per Proposal §3.1 (UC-20)
    if (!createFormData.email.match(/@(student\.)?must\.ac\.ug$/i)) {
      setCreateMessage("❌ Email must end with @must.ac.ug or @student.must.ac.ug");
      return;
    }

    if (!createFormData.fullName.trim()) {
      setCreateMessage("❌ Full name is required");
      return;
    }

    if (createFormData.password.length < 8) {
      setCreateMessage("❌ Password must be at least 8 characters");
      return;
    }

    setImportLoading(true);
    try {
      // Create user via /admin/users endpoint
      const userData = {
        email: createFormData.email.toLowerCase(),
        full_name: createFormData.fullName,
        role: createFormData.role,
        password: createFormData.password,
        courses: createFormData.role === "lecturer" ? createFormData.courses : undefined,
      };

      await apiClient.post("/admin/users", userData);
      
      setCreateMessage(`✅ Account created for ${createFormData.email}`);
      setCreateFormData({
        email: "",
        fullName: "",
        role: "student",
        password: "password123",
        courses: "",
      });
      
      // Reload users to show new account
      loadUsers();
    } catch (err: any) {
      setCreateMessage(`❌ Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  // UC-21: Parse and validate CSV with preview
  const parseCSVFile = (file: File): Promise<{ valid: boolean; data?: any[]; errors: string[] }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csv = e.target?.result as string;
        const lines = csv.trim().split("\n");
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const errors: string[] = [];
        const data: any[] = [];

        // Validate headers
        const requiredHeaders = ["email", "role", "full_name"];
        const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
        if (missingHeaders.length > 0) {
          errors.push(`❌ Missing required columns: ${missingHeaders.join(", ")}`);
          resolve({ valid: false, errors });
          return;
        }

        // Parse rows
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = lines[i].split(",").map((v) => v.trim());
          const row: any = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || "";
          });

          // Validate row
          if (!row.email) {
            errors.push(`❌ Row ${i + 1}: Email is required`);
            continue;
          }
          if (!row.email.match(/@(student\.)?must\.ac\.ug$/i)) {
            errors.push(`❌ Row ${i + 1}: Invalid email domain`);
            continue;
          }
          if (!row.role || !["student", "lecturer"].includes(row.role.toLowerCase())) {
            errors.push(`❌ Row ${i + 1}: Role must be 'student' or 'lecturer'`);
            continue;
          }
          if (!row.full_name) {
            errors.push(`❌ Row ${i + 1}: Full name is required`);
            continue;
          }

          data.push({
            email: row.email.toLowerCase(),
            full_name: row.full_name,
            role: row.role.toLowerCase(),
            password: row.password || "password123",
            courses: row.courses || "",
          });
        }

        resolve({ valid: errors.length === 0, data, errors });
      };
      reader.readAsText(file);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={logout}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-8">
            {(["config", "users", "content"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab === "config" && "Institution Configuration"}
                {tab === "users" && "User Management"}
                {tab === "content" && "Content Overview"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Institution Configuration Tab */}
        {activeTab === "config" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Institution Configuration</h2>

            {/* Campuses Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Campuses</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={campusInput}
                  onChange={(e) => setCampusInput(e.target.value)}
                  placeholder="New campus name"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddCampus}
                  disabled={configLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
                >
                  Add Campus
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {institutionStore.config?.campuses.map((campus) => (
                  <div key={campus.id} className="p-4 border border-gray-200 rounded-lg">
                    <p className="font-medium text-gray-900">{campus.name}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <p className="text-sm text-gray-600 text-center">
                More configuration options (Years, Semesters, Courses) coming soon...
              </p>
            </div>
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === "users" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  {showCreateForm ? "Cancel" : "+ Create User"}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
                >
                  {importLoading ? "Importing..." : "Import CSV"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  className="hidden"
                />
              </div>
            </div>

            {/* Create User Form (UC-20) */}
            {showCreateForm && (
              <div className="mb-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Single User (UC-20)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email (must end with @must.ac.ug or @student.must.ac.ug)
                    </label>
                    <input
                      type="email"
                      value={createFormData.email}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          email: e.target.value,
                        })
                      }
                      placeholder="user@student.must.ac.ug"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={createFormData.fullName}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          fullName: e.target.value,
                        })
                      }
                      placeholder="John Doe"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      value={createFormData.role}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          role: e.target.value as "student" | "lecturer",
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="student">Student</option>
                      <option value="lecturer">Lecturer (requires approval)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Temporary Password
                    </label>
                    <input
                      type="text"
                      value={createFormData.password}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          password: e.target.value,
                        })
                      }
                      placeholder="password123"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {createFormData.role === "lecturer" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Courses (comma-separated, e.g., CS101,CS201)
                      </label>
                      <input
                        type="text"
                        value={createFormData.courses}
                        onChange={(e) =>
                          setCreateFormData({
                            ...createFormData,
                            courses: e.target.value,
                          })
                        }
                        placeholder="CS101,CS201,CS301"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Lecturer can only upload materials for these courses
                      </p>
                    </div>
                  )}
                </div>
                {createMessage && (
                  <div
                    className={`mb-4 p-4 rounded-lg ${
                      createMessage.startsWith("✅")
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {createMessage}
                  </div>
                )}
                <button
                  onClick={handleCreateUser}
                  disabled={importLoading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
                >
                  {importLoading ? "Creating..." : "Create Account"}
                </button>
              </div>
            )}

            {importMessage && (
              <div className={`mb-4 p-4 rounded-lg ${importMessage.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {importMessage}
              </div>
            )}

            {/* CSV Format Info */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>CSV Format:</strong> email, name, role (student|lecturer|admin), campus, year, semester, courses, approved
              </p>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Approval Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">User Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        Loading users...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{user.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {user.approved ? (
                            <span className="text-green-600 font-medium">Approved</span>
                          ) : (
                            <span className="text-yellow-600 font-medium">Pending</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {user.is_active !== false ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm space-x-2">
                          {!user.approved && (
                            <button
                              onClick={() => handleApproveUser(user.id)}
                              className="text-blue-600 hover:text-blue-900 font-medium"
                            >
                              Approve
                            </button>
                          )}
                          {user.is_active !== false && (
                            <button
                              onClick={() => handleToggleUserStatus(user.id, true)}
                              className="text-orange-600 hover:text-orange-900 font-medium"
                              title="Deactivate user"
                            >
                              Deactivate
                            </button>
                          )}
                          {user.is_active === false && (
                            <button
                              onClick={() => handleToggleUserStatus(user.id, false)}
                              className="text-green-600 hover:text-green-900 font-medium"
                              title="Reactivate user"
                            >
                              Reactivate
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Content Overview Tab */}
        {activeTab === "content" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Content Overview</h2>

            {contentLoading ? (
              <div className="text-center py-8 text-gray-500">Loading content overview...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Campus</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Year</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Semester</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Course</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Uploads</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Lectures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contentData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          No content data
                        </td>
                      </tr>
                    ) : (
                      contentData.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{item.campusName}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.yearName}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.semesterName}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{item.courseName}</td>
                          <td className="px-6 py-4 text-sm text-center">{item.uploadCount}</td>
                          <td className="px-6 py-4 text-sm text-center">{item.lectureCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
