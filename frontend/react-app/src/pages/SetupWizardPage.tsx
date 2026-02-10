// frontend/react-app/src/pages/SetupWizardPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { useSetup } from "../contexts/SetupContext";

interface SetupFormData {
  institution_name: string;
  admin_email: string;
  admin_password: string;
  campus: string;
}

export function SetupWizardPage() {
  const navigate = useNavigate();
  const { needsSetup } = useSetup();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<SetupFormData>({
    institution_name: "",
    admin_email: "",
    admin_password: "",
    campus: "",
  });
  const [passwordStrength, setPasswordStrength] = useState<"weak" | "fair" | "good" | "strong">("weak");

  // Calculate password strength
  const checkPasswordStrength = (password: string) => {
    if (!password) return "weak";
    if (password.length < 8) return "weak";
    if (password.length < 12) return "fair";
    if (/[A-Z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*]/.test(password)) {
      return "strong";
    }
    return "good";
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setFormData({ ...formData, admin_password: password });
    setPasswordStrength(checkPasswordStrength(password));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate form
      if (!formData.institution_name.trim()) {
        throw new Error("Institution name is required");
      }
      if (!formData.admin_email.trim()) {
        throw new Error("Admin email is required");
      }
      if (formData.admin_password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      if (!formData.campus.trim()) {
        throw new Error("Campus/Branch name is required");
      }

      // Call setup endpoint
      const response = await apiClient.post("/setup/initialize", {
        institution_name: formData.institution_name,
        admin_email: formData.admin_email,
        admin_password: formData.admin_password,
        campus: formData.campus,
      });

      if (response.data.success) {
        // ✅ Setup successful - reload page to trigger SetupContext check
        // This will make SetupContext re-check /setup/status
        // which will now return needsSetup=false
        // Then App.tsx will redirect to /login
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || "Setup failed. Please try again.";
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case "weak":
        return "bg-red-500";
      case "fair":
        return "bg-yellow-500";
      case "good":
        return "bg-blue-500";
      case "strong":
        return "bg-green-500";
    }
  };

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case "weak":
        return "Weak (minimum 8 characters)";
      case "fair":
        return "Fair";
      case "good":
        return "Good";
      case "strong":
        return "Strong";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mb-4 text-5xl">🎓</div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              EduSmart Setup
            </h1>
            <p className="text-gray-600 text-lg">
              Configure your institution's AI Learning Assistant
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 font-medium">⚠️ {error}</p>
            </div>
          )}

          {/* Success Message */}
          {isLoading && formData.admin_password && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">✅ Setting up your system... You'll be redirected shortly.</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Institution Name */}
            <div>
              <label htmlFor="institution_name" className="block text-sm font-medium text-gray-700 mb-2">
                Institution Name <span className="text-red-500">*</span>
              </label>
              <input
                id="institution_name"
                type="text"
                value={formData.institution_name}
                onChange={(e) =>
                  setFormData({ ...formData, institution_name: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Mbarara University of Science and Technology"
                disabled={isLoading}
                required
              />
              <p className="text-gray-500 text-sm mt-1">The name of your university or institution</p>
            </div>

            {/* Admin Email */}
            <div>
              <label htmlFor="admin_email" className="block text-sm font-medium text-gray-700 mb-2">
                Admin Email <span className="text-red-500">*</span>
              </label>
              <input
                id="admin_email"
                type="email"
                value={formData.admin_email}
                onChange={(e) =>
                  setFormData({ ...formData, admin_email: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="admin@university.edu"
                disabled={isLoading}
                required
              />
              <p className="text-gray-500 text-sm mt-1">Should be an institutional email address</p>
            </div>

            {/* Admin Password */}
            <div>
              <label htmlFor="admin_password" className="block text-sm font-medium text-gray-700 mb-2">
                Admin Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="admin_password"
                  type={showPassword ? "text" : "password"}
                  value={formData.admin_password}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Minimum 8 characters"
                  disabled={isLoading}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-14-14zM10 4C5.291 4 1.23 7.476.069 12a13.997 13.997 0 001.341 4.17l2.061-2.061A8 8 0 0110 6c2.686 0 5.04 1.286 6.59 3.297l2.06-2.061C14.42 4.503 12.345 4 10 4zm7.931 8a13.997 13.997 0 01-1.341 4.17l-2.061-2.061A8 8 0 0010 14c-2.686 0-5.04-1.286-6.59-3.297l-2.06 2.061C5.58 15.497 7.655 16 10 16c4.709 0 8.77-3.476 9.931-8z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.admin_password && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Password Strength:</span>
                    <span className={`text-sm font-medium ${
                      passwordStrength === "weak" ? "text-red-600" :
                      passwordStrength === "fair" ? "text-yellow-600" :
                      passwordStrength === "good" ? "text-blue-600" :
                      "text-green-600"
                    }`}>
                      {getPasswordStrengthText()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getPasswordStrengthColor()}`}
                      style={{
                        width:
                          passwordStrength === "weak"
                            ? "25%"
                            : passwordStrength === "fair"
                            ? "50%"
                            : passwordStrength === "good"
                            ? "75%"
                            : "100%",
                      }}
                    ></div>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    💡 Tip: Use uppercase, numbers, and special characters for stronger security
                  </p>
                </div>
              )}
            </div>

            {/* Campus/Branch */}
            <div>
              <label htmlFor="campus" className="block text-sm font-medium text-gray-700 mb-2">
                Default Campus/Branch <span className="text-red-500">*</span>
              </label>
              <input
                id="campus"
                type="text"
                value={formData.campus}
                onChange={(e) =>
                  setFormData({ ...formData, campus: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Main Campus"
                disabled={isLoading}
                required
              />
              <p className="text-gray-500 text-sm mt-1">You can add more campuses after setup</p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !formData.institution_name || !formData.admin_email || !formData.admin_password || !formData.campus}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-3 rounded-lg transition transform hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Setting up your system...
                </>
              ) : (
                <>
                  <span>✓</span>
                  Complete Setup
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">📋 What happens next:</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>✅ Your admin account will be created</li>
                <li>✅ Institution details will be configured</li>
                <li>✅ You'll be redirected to login</li>
                <li>✅ Start managing users and courses</li>
              </ul>
            </div>
            <p className="text-sm text-gray-500 text-center mt-4">
              This setup wizard runs only once. After completion, you'll login with your admin credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
