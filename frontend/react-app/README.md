# EduSmart Frontend - React + TypeScript

Modern AI Learning Assistant for Mbarara University of Science and Technology (MUST) built with React 18, TypeScript, and Tailwind CSS.

## Features

- **Simplified Authentication**: MUST email + password login (no role selector, backend-driven routing)
- **First-Time Password Setup**: Users set password on initial login (CSV import without passwords)
- **Multi-role Support**: Students, Lecturers (with approval workflow), and Admins
- **Chat Interface**: Qwen-style chat interface with persistent conversation history
- **Document Upload**: Approved lecturers can upload PDF/DOCX/PPTX files for RAG
- **Admin Dashboard**: Stats overview, CSV bulk import, lecturer management (approve/revoke/delete)
- **Lecturer Approval Workflow**: Lecturers can login but need admin approval to access upload feature
- **Offline Support**: Graceful degradation when offline
- **Responsive Design**: Works on desktop (1366x768+) and tablets

## 🔐 Authentication System

See [AUTHENTICATION.md](./AUTHENTICATION.md) for complete details.

**Key Points:**
- Login: Email + password only (no role selector)
- First login: Users set password if `password_hash=null`
- Role-based routing: Backend determines role and approval status
- Lecturer pending approval: Special page while awaiting admin approval
- CSV import: Bulk import students and lecturers without passwords

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ChatComposer.tsx      # Message input with Bloom's selector
│   ├── ChatHeader.tsx        # Chat title and status bar
│   ├── MessageBubble.tsx     # Individual message display
│   ├── MessageList.tsx       # Message container
│   ├── Sidebar.tsx           # Navigation sidebar
│   └── UploadModal.tsx       # File upload modal
├── hooks/              # Custom React hooks
│   ├── useCourses.ts         # Fetch available courses
│   └── useOnlineStatus.ts    # Detect offline status
├── layout/             # Layout components
│   └── MainLayout.tsx        # Main app layout with sidebar
├── pages/              # Page components
│   ├── LoginPage.tsx         # Email + password MUST authentication
│   ├── SetPasswordPage.tsx   # First-time password setup
│   ├── LecturerPendingPage.tsx  # Lecturer approval pending message
│   ├── ChatPage.tsx          # Student query interface
│   ├── UploadPage.tsx        # Lecturer document upload (approved only)
│   └── AdminDashboard.tsx    # Admin dashboard (stats, CSV import, lecturer management)
├── services/           # API client
│   └── apiClient.ts          # Axios instance with interceptors
├── state/              # State management (Context API)
│   ├── AuthContext.tsx       # Authentication state
│   └── ChatContext.tsx       # Chat management
├── utils/              # Utility functions
│   └── classNames.ts         # CSS class utilities
├── App.tsx             # Main app with routing
├── index.css           # Global styles (Tailwind)
└── main.tsx            # Entry point
```

## Setup & Installation

### Prerequisites

- Node.js 16+ and npm/yarn
- Backend API running on `http://localhost:8000`

### Installation Steps

```bash
# Install dependencies
npm install

# Create .env file (optional)
cp .env.example .env

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Key Components

### LoginPage

MUST institution-specific login form requiring:
- Email: `student@student.must.ac.ug` or `lecturer@must.ac.ug`
- Password: Moodle/VLE password

```tsx
import LoginPage from "./pages/LoginPage";
// User enters email and password
// Backend validates against MUST credentials
// JWT token stored in localStorage
```

### ChatPage with Sidebar

Qwen-style interface:
- **Sidebar**: Course selector, chat history, new chat button, user profile
- **Main Area**: Chat messages with AI responses
- **Bottom**: Message composer with Bloom's level selector (lecturers only)

```tsx
import ChatPage from "./pages/ChatPage";
import MainLayout from "./layout/MainLayout";
```

### UploadPage

Document ingestion for lecturers:
- Drag-and-drop or file browser
- Supports PDF, DOCX, PPTX (max 20MB)
- Shows processing progress and chunk count

```tsx
import UploadPage from "./pages/UploadPage";
// Available at /upload (lecturer only)
```

### AdminPage

Admin dashboard with:
- **Overview Tab**: Stats (students, lecturers, active chats, uploads)
- **Lecturers Tab**: Approve/deny upload permissions
- **Import Tab**: Bulk import students/lecturers from CSV

```tsx
import AdminPage from "./pages/AdminPage";
// Available at /admin (admin only)
```

## State Management

### AuthContext

Manages user authentication and token:

```tsx
const { user, token, isAuthenticated, login, logout } = useAuth();

// Login
const result = await login(email, password);
if (result.success) navigate("/chat");

// Logout
logout(); // Clears token and localStorage
```

### ChatContext

Manages chat sessions and messages:

```tsx
const {
  chats,           // Record of Chat objects
  currentChatId,   // Active chat ID
  course,          // Selected course
  createChat,      // Create new chat
  sendMessage,     // Send user message + get AI response
  setCourse,       // Change course
  setCurrentChat,  // Switch between chats
} = useChat();

// Create and switch to new chat
const chat = createChat("Photosynthesis explanation");

// Send message
await sendMessage({
  chatId: chat.chat_id,
  query: "Explain photosynthesis",
  role: "student",
  bloomLevel: "Remember"
});
```

## API Integration

### Authentication Endpoints

```
POST   /api/auth/login
  Body: { email, password }
  Response: { token, user: { id, email, name, role, ... } }

POST   /api/auth/logout
GET    /api/auth/me
```

### Chat Endpoints

```
GET    /api/chats                          # List user chats
POST   /api/chats                          # Create new chat
GET    /api/chats/:chat_id                 # Get chat with messages
POST   /api/chats/:chat_id/messages        # Send message + get AI response
DELETE /api/chats/:chat_id                 # Delete chat
```

### Courses & Ingestion

```
GET    /api/courses                        # List available courses
POST   /api/ingest/upload                  # Upload document (lecturer)
GET    /api/ingest/status                  # Check processing status
```

### Admin Endpoints

```
GET    /api/admin/analytics                # Dashboard stats
GET    /api/admin/lecturers                # List lecturers + status
PUT    /api/admin/lecturers/:id/approve    # Approve lecturer
PUT    /api/admin/lecturers/:id/deny       # Deny lecturer
POST   /api/admin/import/students          # Import students CSV
POST   /api/admin/import/lecturers         # Import lecturers CSV
```

## Authentication Flow

1. User navigates to `/login`
2. Enters MUST email + Moodle password
3. Frontend sends `POST /api/auth/login`
4. Backend validates credentials against MUST systems
5. Returns JWT token + user object
6. Token stored in localStorage and axios headers
7. User redirected to `/chat`
8. Protected routes check `isAuthenticated`

## Message Structure

```tsx
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;       // ISO 8601
  sources?: string[];      // Source documents
  competencies?: string[]; // CBC competencies
  bloom?: string;          // Bloom's level (user messages)
}
```

## Chat Persistence

Chat data persists across sessions:
- Stored in `localStorage[edusmart.chat.{userId}]`
- Auto-saves on every message
- Loads on app startup
- Cleared on logout

## Styling & Theme

### Colors (MUST Branded)

```css
--primary: #3b82f6       /* MUST Blue */
--success: #10b981       /* Green */
--warning: #f59e0b       /* Amber */
--error: #ef4444         /* Red */
--sidebar: #f8fafc       /* Light gray */
```

### Responsive Breakpoints

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px
- Min width for full experience: 1366px

## Development

### Build Production

```bash
npm run build     # Creates optimized dist/ folder
npm run preview   # Preview production build locally
```

### Environment Variables

```
VITE_API_URL=/api    # Backend API URL (default proxied to localhost:8000)
```

Create `.env.local` to override:

```
VITE_API_URL=http://your-api-server.com/api
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Optimizations

- Code splitting with React.lazy
- Message virtualization for long chat histories
- Debounced auto-save
- Optimistic UI updates
- Axios request/response caching

## Common Tasks

### Add New Route

```tsx
// App.tsx
<Route element={<PrivateRoute allowedRoles={["student"]} />}>
  <Route path="/my-feature" element={<MyFeaturePage />} />
</Route>
```

### Add New Chat Component

```tsx
// src/components/MyComponent.tsx
import { useChat } from "../state/ChatContext";

export default function MyComponent() {
  const { chats, sendMessage } = useChat();
  // Component code
}
```

### Handle API Errors

```tsx
try {
  const response = await apiClient.post("/endpoint", data);
} catch (error: any) {
  const message = error?.response?.data?.detail || "Request failed";
  // Handle error
}
```

## Troubleshooting

**CORS Errors**: Ensure backend is running and vite proxy is configured
```javascript
// vite.config.js
proxy: {
  "/api": {
    target: "http://localhost:8000",
    changeOrigin: true,
  }
}
```

**Token Expiration**: 401 responses trigger logout and redirect to login
**Offline Mode**: App detects connectivity and shows offline badge

## Future Enhancements

- [ ] Chat search and filtering
- [ ] Message reactions/annotations
- [ ] Voice input for questions
- [ ] PDF annotation in UI
- [ ] Real-time collaboration
- [ ] Dark mode
- [ ] Multi-language support

## License

See [LICENSE](../../LICENSE) file

## Support

For issues or questions, contact the MUST IT Department
