# Frontend Handler Reference

This document summarizes the key React event handlers and helper functions that drive the EduSmart frontend flows. Use it as a quick guide when wiring new features or debugging existing ones.

## Chat Experience (`frontend/react-app/src/pages/ChatPage.tsx`)

### Session & Navigation
- **`handleNewChat()`** – Generates a local session ID, prepends it to the sidebar, clears messages, and keeps the active course context intact.
- **`handleSelectChat(sessionId)`** – Switches the visible conversation and resets the message list (placeholder until server history is wired).
- **`handleSwitchCourse()` / `confirmSwitchCourse()`** – Opens the safety modal, and once confirmed, clears state via `navigate('/course-selection')`.
- **`handleLogout()` / `handleAccountSettings()` / `handleGeneralSettings()`** – Shortcuts exposed in the header menu to leave chat or pivot to settings routes.
- **`handleDeleteChat(sessionId)`** – Removes the chosen session from sidebar state and gracefully selects the next available chat.

### Messaging Pipeline
- **`sendMessage()`** – Core send routine. Pushes the user message to local state, calls `chatApi.sendMessage()`, ingests lecturer-only citations from the response, and appends the assistant reply.
- **`handleSendMessage(event)`** – Form submit wrapper that prevents default reloading, then awaits `sendMessage()`.
- **`handleComposerKeyDown(event)`** – Captures Enter vs Shift+Enter to either send immediately or insert a newline.

### Reference Upload Drawer
- **`handleReferenceFileChange(event)`** – Stores the chosen PDF/DOCX/PPTX file for RAG ingestion and clears prior status to avoid stale messages.
- **`handleClearReferenceFile()`** – Removes the selected file and resets the hidden `<input>` element so the same file can be re-picked.
- **`handleReferenceUpload()`** – Calls `ingestionApi.uploadDocument()`, renders optimistic status text, and sets `hiddenCitationCount` to suppress non-lecturer sources downstream.

### UI State Toggles
- **`setShowComposerExtras()`** – Controlled by the “+” button to reveal the upload drawer.
- **`setSidebarOpen()`** – Tracks whether the conversation list is visible (auto-locks open on desktop widths).
- **`setShowSettingsMenu()`** – Handles the header ellipsis dropdown for account actions.

### Citation Helpers
- **`getCitationRole(citation)`** – Normalizes whatever metadata the backend returns into a lowercase role (`lecturer`, `student`, etc.).
- **`mapCitation(citation)`** – Converts raw API citation objects into the UI-friendly structure (`title`, `snippet`, `source`, `url`).

## Upload Workspace (`frontend/react-app/src/pages/UploadPage.tsx`)

### Access Control & Context
- **Lecturer Guard** – Early return keeps the page locked to `user.role === 'lecturer'`. Non-lecturers see a friendly redirect card with a "Go to Chat" button.
- **`goToChatWithCourse(code, label)`** – Pushes the selected course into `useCourseStore` and navigates to `/chat`, ensuring a seamless hand-off after uploads.

### Data Fetching
- **`fetchProfileAndData()`** – Pulls lecturer profile metadata plus upload history/stats from `lecturerApi` endpoints; runs on mount for lecturer accounts.
- **`fetchAnalytics()`** – Deferred call (only when the Analytics tab opens) that hydrates the “Most Queried” and “Citations” widgets.

### Upload Workflow
- **`handleDragOver()`, `handleDragLeave()`, `handleDrop()`** – Manage the drag-and-drop zone styling while files are being hovered or dropped.
- **`handleFileSelect(event)`** – Traditional file picker input that delegates to `addFiles()`.
- **`addFiles(files)`** – Validates extensions (PDF/DOCX/PPTX) and size limits (20 MB), applies the 10-file cap, and amends `selectedFiles`.
- **`removeFile(index)`** – Removes a specific file from the pending list.
- **`handleUpload(event)`** – Form submit handler that posts a `FormData` payload via `lecturerApi.uploadMaterials()`, toggles success UI, refreshes stats, and stores the last course for fast chat navigation.

### Miscellaneous
- **`handleLogout()`** – Logs the lecturer out and returns them to `/login`.
- **`setActiveTab()` / `fetchAnalytics()`** – Maintains which tab (Upload/History/Analytics) is visible; analytics load lazily to keep the first render fast.
- **Success Banner CTA** – Appears once `handleUpload()` resolves; clicking “Chat with this course” uses `goToChatWithCourse()` to land in the chat experience tied to the just-uploaded materials.
- **History Table CTA** – Every existing upload row exposes the same chat shortcut so lecturers can revisit any course corpus instantly.

## Tips for Extending Handlers
1. **Keep API helpers thin** – Centralize fetch logic inside `/src/services/api.ts` so handlers remain focused on UI state changes.
2. **Favor store setters** – Use `useCourseStore`, `useAuth`, or other Zustand stores to share context between UploadPage and ChatPage instead of prop drilling.
3. **Guard backend-specific logic** – When working frontend-only, wrap network calls in `if (import.meta.env.DEV && USE_MOCKS)` blocks so UI can render in isolation.
4. **Surface feedback** – Every handler that mutates remote state should update local banners/toasts (`error`, `uploadSuccess`, `referenceUploadFeedback`) to keep users informed.

With this reference, you can trace how user interactions cascade through the major screens and confidently plug in new flows without re-reading the entire component files each time.
