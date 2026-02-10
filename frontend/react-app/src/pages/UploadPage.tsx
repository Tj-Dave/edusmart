import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUploadStore } from "../stores/uploadStore";
import { useAuth } from "../state/AuthContext";
import { uploadFile } from "../services/apiService";
import { v4 as uuidv4 } from "uuid";

export default function UploadPage() {
  const navigate = useNavigate();
  const { user, logout, status } = useAuth();
  const uploadStore = useUploadStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [canAccessChat, setCanAccessChat] = useState(uploadStore.hasUploadedFiles());

  // Only redirect AFTER auth has finished loading
  useEffect(() => {
    if (status !== 'checking' && (!user || user.role !== "lecturer")) {
      navigate("/chat");
    }
  }, [status, user, navigate]);

  // Show loading spinner while auth status is being determined
  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin -ml-1 mr-3 h-12 w-12 text-green-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 mt-4">Loading your session...</p>
        </div>
      </div>
    );
  }

  const ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFiles = (fileList: FileList) => {
    const fileArray = Array.from(fileList);
    fileArray.forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`Invalid file type: ${file.name}. Please upload PDF, DOCX, or PPTX files.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        alert(`File too large: ${file.name}. Maximum size is 20MB.`);
        return;
      }

      // Create upload record
      const fileId = uuidv4();
      uploadStore.addFile({
        id: fileId,
        filename: file.name,
        status: "pending",
      });

      // Upload file
      uploadFile(file, (progressEvent) => {
        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        uploadStore.setUploadProgress(progress);
      })
        .then((response) => {
          uploadStore.updateFileStatus(fileId, "completed", {
            chunksCreated: response.chunks_created,
          });
          setCanAccessChat(true);
        })
        .catch((err) => {
          uploadStore.updateFileStatus(fileId, "error", {
            error: err.message,
          });
        });
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Upload Course Materials</h1>
            <button
              onClick={logout}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Logout
            </button>
          </div>
          <p className="text-gray-600">
            Hello, {user?.name}! Please upload your course materials to unlock the AI learning assistant.
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${
              dragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.pptx,.ppt"
              onChange={handleInputChange}
              className="hidden"
            />

            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path
                d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20m-8-12l8 8m0 0v16m0-16h-8"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <p className="mt-2 text-sm font-semibold text-gray-900">
              Drag PDF/DOCX/PPTX here
            </p>
            <p className="text-xs text-gray-500 mt-1">or click to browse</p>
            <p className="text-xs text-gray-400 mt-3">Max 20MB per file</p>
          </div>

          {/* File Type Info */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Accepted formats:</strong> PDF, DOCX, PPTX • <strong>Max size:</strong> 20MB
            </p>
          </div>
        </div>

        {/* Upload Progress */}
        {uploadStore.getFiles().length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Upload Progress</h2>
            <div className="space-y-4">
              {uploadStore.getFiles().map((file) => (
                <div key={file.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{file.filename}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {file.status === "pending" && "Pending upload..."}
                        {file.status === "processing" && "Processing file..."}
                        {file.status === "completed" && `✓ Processed • ${file.chunksCreated || 0} chunks created`}
                        {file.status === "error" && `Error: ${file.error || "Unknown error"}`}
                      </p>
                    </div>
                    {file.status === "completed" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Done
                      </span>
                    )}
                    {file.status === "error" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ✗ Error
                      </span>
                    )}
                  </div>

                  {(file.status === "pending" || file.status === "processing") && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${uploadStore.uploadProgress}%`,
                        }}
                      ></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {canAccessChat && (
            <button
              onClick={() => navigate("/chat")}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
            >
              Go to Chat Interface
            </button>
          )}

          {!canAccessChat && uploadStore.getFiles().length === 0 && (
            <p className="text-sm text-gray-600 text-center">
              Upload at least one file to unlock the AI assistant
            </p>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> You must upload course materials before you can access the AI chat interface. This ensures the assistant has the correct context for answering your students' questions.
          </p>
        </div>
      </div>
    </div>
  );
}
