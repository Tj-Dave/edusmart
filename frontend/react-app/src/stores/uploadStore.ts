import { create } from "zustand";

export interface UploadedFile {
  id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "error";
  chunksCreated?: number;
  uploadedBy?: string;
  uploadDate?: string;
  error?: string;
}

interface UploadStore {
  files: UploadedFile[];
  isUploading: boolean;
  uploadProgress: number;
  addFile: (file: UploadedFile) => void;
  updateFileStatus: (fileId: string, status: UploadedFile["status"], data?: any) => void;
  setIsUploading: (isUploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
  getFiles: () => UploadedFile[];
  hasUploadedFiles: () => boolean;
  clearFiles: () => void;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  files: [],
  isUploading: false,
  uploadProgress: 0,

  addFile: (file) => {
    set((state) => ({
      files: [...state.files, file],
    }));
  },

  updateFileStatus: (fileId, status, data) => {
    set((state) => ({
      files: state.files.map((file) =>
        file.id === fileId
          ? {
              ...file,
              status,
              chunksCreated: data?.chunksCreated || file.chunksCreated,
              error: data?.error || file.error,
            }
          : file
      ),
    }));
  },

  setIsUploading: (isUploading) => {
    set({ isUploading });
  },

  setUploadProgress: (uploadProgress) => {
    set({ uploadProgress });
  },

  getFiles: () => get().files,

  hasUploadedFiles: () => {
    const { files } = get();
    return files.some((f) => f.status === "completed");
  },

  clearFiles: () => {
    set({ files: [], uploadProgress: 0 });
  },
}));
