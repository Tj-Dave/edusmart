# EduSmart Components API Reference

## Components

### `<Sidebar />`

Main navigation sidebar with user profile and chat history.

**Location**: `src/components/Sidebar.tsx`

**Features**:
- User profile display with role badge
- "New Chat" button
- Chat history list
- Logout button
- Navigation to upload/admin (role-based)

**Props**: None (uses AuthContext, ChatStore, CourseStore)

**Example**:
```tsx
import Sidebar from './components/Sidebar';

export default function ChatLayout() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">...</main>
    </div>
  );
}
```

**Context Dependencies**:
- `useAuth()` - User info and logout
- `useChatStore()` - Chat sessions
- `useCourseStore()` - Current course

---

### `<MessageBubble />`

Displays a single message with styling and source citations.

**Location**: `src/components/MessageBubble.tsx`

**Props**:
```tsx
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sources?: Array<{
    filename: string;
    uploadedBy: string;
    uploadedDate: string;
  }>;
}
```

**Features**:
- User messages: blue, right-aligned
- AI messages: gray, left-aligned
- Source citation badges below AI messages
- Timestamp display
- Text wrapping

**Example**:
```tsx
import MessageBubble from './components/MessageBubble';

const messages = [
  {
    id: "1",
    role: "user",
    content: "What is photosynthesis?",
    timestamp: Date.now(),
  },
  {
    id: "2",
    role: "assistant",
    content: "Photosynthesis is the process...",
    timestamp: Date.now(),
    sources: [{
      filename: "Chapter_3.pdf",
      uploadedBy: "Dr. Akello",
      uploadedDate: "6 Feb 2026"
    }]
  }
];

export default function ChatMessages() {
  return (
    <div>
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  );
}
```

---

### `<CourseSelector />`

Hierarchical course selection with dropdown filtering.

**Location**: `src/components/CourseSelector.tsx`

**Props**:
```tsx
interface CourseSelectorProps {
  onSelect: () => void;  // Called when selection complete
}
```

**Features**:
- Campus dropdown
- Year dropdown (filtered by campus)
- Semester dropdown (filtered by campus + year)
- Course dropdown (filtered by all three)
- [Start Learning] button (enabled when complete)

**Example**:
```tsx
import CourseSelector from './components/CourseSelector';

export default function CourseSelectionPage() {
  const handleCourseSelected = () => {
    navigate('/chat');
  };

  return <CourseSelector onSelect={handleCourseSelected} />;
}
```

**Context Dependencies**:
- `useCourseStore()` - Save selections
- `useInstitutionStore()` - Campus/year/semester/course data

---

## Hooks

### `useAuth()`

Authentication context hook.

**Location**: `src/state/AuthContext.tsx`

**Returns**:
```tsx
{
  user: {
    id: string;
    email: string;
    name: string;
    role: "student" | "lecturer" | "admin";
    approved: boolean;
  } | null;
  status: "checking" | "authenticated" | "unauthenticated";
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setPassword: (password: string) => Promise<void>;
}
```

**Example**:
```tsx
import { useAuth } from './state/AuthContext';

export default function UserProfile() {
  const { user, logout } = useAuth();

  if (!user) return <p>Not logged in</p>;

  return (
    <div>
      <p>{user.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

### `useChatStore()`

Chat state management.

**Location**: `src/stores/chatStore.ts`

**Returns**:
```tsx
{
  sessions: ChatSession[];
  currentSessionId: string | null;
  createSession: (campus, year, semester, courseCode, courseName) => string;
  addMessage: (sessionId, message) => void;
  deleteSession: (sessionId) => void;
  getCurrentSession: () => ChatSession | null;
  toggleArchive: (sessionId) => void;
}
```

**Example**:
```tsx
import { useChatStore } from './stores/chatStore';
import { v4 as uuidv4 } from 'uuid';

export default function ChatPage() {
  const chatStore = useChatStore();

  const handleSendMessage = (text) => {
    const message = {
      id: uuidv4(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    chatStore.addMessage(chatStore.currentSessionId, message);
  };

  return (
    <div>
      <button onClick={() => handleSendMessage('Hello')}>Send</button>
    </div>
  );
}
```

---

### `useCourseStore()`

Course selection state.

**Location**: `src/stores/courseStore.ts`

**Returns**:
```tsx
{
  selection: {
    campus?: string;
    year?: string;
    semester?: string;
    courseCode?: string;
    courseName?: string;
  };
  setCampus: (id, name) => void;
  setYear: (id, name) => void;
  setSemester: (id, name) => void;
  setCourse: (code, name) => void;
  isComplete: () => boolean;
  resetCourse: () => void;
}
```

**Example**:
```tsx
import { useCourseStore } from './stores/courseStore';

export default function CourseSelectionPage() {
  const courseStore = useCourseStore();

  const handleStart = () => {
    if (courseStore.isComplete()) {
      // All selections made
      navigate('/chat');
    }
  };

  return <button onClick={handleStart}>Start Learning</button>;
}
```

---

### `useInstitutionStore()`

Institution configuration state.

**Location**: `src/stores/institutionStore.ts`

**Returns**:
```tsx
{
  config: {
    campuses: Campus[];
    years: Year[];
    semesters: Semester[];
    courses: Course[];
  };
  getYearsByCampus: (campusId) => Year[];
  getSemestersByYearAndCampus: (campusId, yearId) => Semester[];
  getCoursesByAll: (campusId, yearId, semesterId) => Course[];
}
```

---

### `useUploadStore()`

File upload state management.

**Location**: `src/stores/uploadStore.ts`

**Returns**:
```tsx
{
  files: Array<{
    id: string;
    name: string;
    progress: number;
    status: "pending" | "uploading" | "completed" | "error";
  }>;
  addFile: (file) => void;
  updateFileProgress: (fileId, progress) => void;
  updateFileStatus: (fileId, status) => void;
  hasUploadedFiles: () => boolean;
  clearFiles: () => void;
}
```

---

### `useOfflineStore()`

Online/offline status tracking.

**Location**: `src/stores/offlineStore.ts`

**Returns**:
```tsx
{
  isOnline: boolean;
  initializeOnlineListener: () => () => void;  // Returns cleanup function
}
```

**Example**:
```tsx
import { useOfflineStore } from './stores/offlineStore';

export default function ChatPage() {
  const offlineStore = useOfflineStore();

  useEffect(() => {
    const cleanup = offlineStore.initializeOnlineListener();
    return cleanup;
  }, []);

  return (
    <div>
      {!offlineStore.isOnline && <p>⚠️ You are offline</p>}
    </div>
  );
}
```

---

## Utilities

### `classNames()`

Conditionally join CSS classes.

**Location**: `src/utils/classNames.ts`

**Signature**:
```tsx
function classNames(...classes: (string | undefined | null | false)[]): string
```

**Example**:
```tsx
import classNames from './utils/classNames';

export default function Button({ disabled }) {
  return (
    <button
      className={classNames(
        "px-4 py-2 rounded",
        disabled ? "bg-gray-300" : "bg-blue-500 hover:bg-blue-600"
      )}
      disabled={disabled}
    >
      Click me
    </button>
  );
}
```

---

## Services

### `apiClient`

Axios instance with auth interceptors.

**Location**: `src/services/apiClient.ts`

**Features**:
- Automatically adds `Authorization: Bearer {token}` header
- Handles 401 responses (redirect to login)
- Base URL: `/api`

**Example**:
```tsx
import apiClient from './services/apiClient';

// GET request
const users = await apiClient.get('/admin/users');

// POST request
const response = await apiClient.post('/chats', {
  campus_id: '1',
  course_id: '101'
});
```

---

### `apiService`

API wrapper functions.

**Location**: `src/services/apiService.ts`

**Functions**:

#### Authentication
```tsx
loginUser(email: string, password: string)
setPassword(newPassword: string)
```

#### Chat
```tsx
createChat(campus: string, year: string, semester: string, course: string)
sendMessage(chatId: string, query: string)
getChatHistory(chatId: string)
```

#### Upload
```tsx
uploadFile(file: File, onProgress?: (progress: number) => void)
```

#### Admin
```tsx
importUsersCSV(file: File)
getUsers()
updateUser(userId: string, updates: object)
deleteUser(userId: string)
getContentOverview()
updateInstitutionConfig(config: object)
```

**Example**:
```tsx
import { sendMessage, uploadFile } from './services/apiService';

// Send message
const response = await sendMessage(chatId, 'Hello');
console.log(response.data.ai_response);

// Upload file
await uploadFile(file, (progress) => {
  console.log(`Uploaded ${progress}%`);
});
```

---

## Layout

### `<MainLayout />`

Wrapper layout with sidebar and main content.

**Location**: `src/layout/MainLayout.tsx`

**Features**:
- Sidebar (300px left)
- Main content area (flex-1)
- Responsive on mobile

**Example**:
```tsx
import MainLayout from './layout/MainLayout';

export default function App() {
  return (
    <MainLayout>
      <ChatPage />
    </MainLayout>
  );
}
```

---

## Context

### `<AuthContext>`

Provides authentication state to entire app.

**Location**: `src/state/AuthContext.tsx`

**Provider**:
```tsx
<AuthContext.Provider>
  <App />
</AuthContext.Provider>
```

**Usage**:
```tsx
const { user, status, login, logout } = useAuth();
```

---

### `<SetupContext>`

Manages initial system setup state.

**Location**: `src/contexts/SetupContext.tsx`

**Provider**:
```tsx
<SetupProvider>
  <App />
</SetupProvider>
```

**Usage**:
```tsx
const { needsSetup, isLoading } = useSetup();
```

---

## Styling

All styling uses **Tailwind CSS**. No component libraries or CSS files.

### Common Patterns

```tsx
// Buttons
<button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded">

// Cards
<div className="bg-white rounded-lg shadow-lg p-6">

// Text
<p className="text-gray-600 text-sm">

// Badges
<span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs">

// Input
<input className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
```

---

## Type Definitions

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: "student" | "lecturer" | "admin";
  approved: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sources?: Array<{
    filename: string;
    uploadedBy: string;
    uploadedDate: string;
  }>;
}

interface ChatSession {
  id: string;
  courseCode: string;
  courseName: string;
  messages: Message[];
  archived: boolean;
  createdAt: number;
}
```

---

**Status**: Production Ready | **Last Updated**: Feb 10, 2026
