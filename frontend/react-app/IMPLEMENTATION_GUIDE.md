# EduSmart React Frontend - Implementation Guide

## Architecture Overview

- **Framework**: React 18 + TypeScript
- **Routing**: React Router v6
- **State Management**: Zustand (5 stores)
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios with auth interceptors

## File Structure

```
src/
├── pages/                # Full page routes
│   ├── LoginPage.tsx
│   ├── SetPasswordPage.tsx
│   ├── ChatPage.tsx
│   ├── UploadPage.tsx
│   ├── AdminDashboard.tsx
│   ├── CourseSelectionPage.tsx
│   ├── LecturerPendingPage.tsx
│   └── SetupWizardPage.tsx
│
├── components/           # Reusable components
│   ├── Sidebar.tsx
│   ├── MessageBubble.tsx
│   └── CourseSelector.tsx
│
├── stores/               # Zustand state management
│   ├── chatStore.ts
│   ├── courseStore.ts
│   ├── institutionStore.ts
│   ├── uploadStore.ts
│   └── offlineStore.ts
│
├── services/             # API integration
│   ├── apiClient.ts
│   └── apiService.ts
│
├── state/                # Context providers
│   ├── AuthContext.tsx
│   └── SetupContext.tsx
│
├── layout/
│   └── MainLayout.tsx
│
├── utils/                # Helper functions
│   └── classNames.ts
│
├── App.tsx               # Main routing
└── main.tsx
```

## Authentication Flow

```
Login (email + password)
  ↓
Backend returns: role, approved status
  ↓
Routes:
  • password_hash === null → /set-password
  • student → /course-selection
  • lecturer + approved → /upload
  • lecturer + !approved → /lecturer-pending
  • admin → /admin
```

## User Flows

### Student
1. Login with email/password
2. Set password if first time
3. Select course (campus → year → semester → course)
4. Chat with AI

### Lecturer (Pending)
1. Login with email/password
2. Set password if first time
3. Wait for admin approval

### Lecturer (Approved)
1. Login with email/password
2. Set password if first time
3. Upload files (drag-drop)
4. Chat with AI (AI disabled until file uploaded)

### Admin
1. Login with email/password
2. Set password if first time
3. Manage institution config, users, content

## State Management (Zustand)

### chatStore
- `sessions`: Array of chat sessions
- `currentSessionId`: Active session
- `createSession()`, `addMessage()`, `deleteSession()`

### courseStore
- `campus`, `year`, `semester`, `course`: Selected values
- `setCampus()`, `isComplete()`: Check all selected

### institutionStore
- `config`: Campus/year/semester/course hierarchy
- `getCoursesByFilters()`: Filter dropdown options

### uploadStore
- `files`: File list with progress/status
- `addFile()`, `updateFileStatus()`, `hasUploadedFiles()`

### offlineStore
- `isOnline`: Boolean online status
- `initializeOnlineListener()`: Setup connectivity tracking

## Components

### `<Sidebar />`
- User profile + logout
- "New Chat" button
- Chat history list
- Current course display

### `<MessageBubble />`
- Renders single message
- User messages: blue, right-aligned
- AI messages: gray, left-aligned
- Source citation badge below AI messages

### `<CourseSelector />`
- Hierarchical dropdowns
- Campus → Year → Semester → Course
- [Start Learning] button (enabled when complete)

## API Integration

All functions in `src/services/apiService.ts`:

```typescript
// Auth
loginUser(email, password)
setPassword(newPassword)

// Chat
createChat(campus, year, semester, course)
sendMessage(chatId, query)

// Upload
uploadFile(file, onProgress?)

// Admin
importUsersCSV(file)
getUsers()
updateUser(userId, updates)
deleteUser(userId)
getContentOverview()
updateInstitutionConfig(config)
```

## Routing

| Route | Component | Purpose |
|-------|-----------|---------|
| `/login` | LoginPage | Email + password login |
| `/set-password` | SetPasswordPage | First-time setup |
| `/course-selection` | CourseSelectionPage | Select course (students) |
| `/chat` | ChatPage | AI chat |
| `/upload` | UploadPage | File upload (lecturers) |
| `/lecturer-pending` | LecturerPendingPage | Approval waiting |
| `/admin` | AdminDashboard | Admin panel |
| `/setup` | SetupWizardPage | System setup |

## Key Implementation Details

### Chat Page (Qwen-Style Layout)
- Left sidebar: 280px (user profile, new chat, history)
- Main area: Messages + input
- Header: Course name + offline indicator
- Input: Textarea with Shift+Enter for newline

### Upload Page
- Drag-drop zone for files
- Allowed: PDF, DOCX, PPTX (max 20MB)
- Progress bar with status
- AI disabled until file uploaded

### Admin Dashboard
- **Config Tab**: Add/edit campus, years, semesters, courses
- **Users Tab**: Import CSV, manage users, approve lecturers
- **Content Tab**: View uploads per course

### Offline Support
- Red "Offline" indicator in header
- Input disabled when offline
- Messages cached locally (Zustand stores)

## Styling

- **Tailwind CSS**: No component libraries
- **Colors**: Primary blue (#2563EB), green (#10B981), red (#EF4444)
- **Icons**: Inline SVG (no external icon library)
- **Responsive**: Mobile-first approach

## Testing Credentials

| Role | Email | Password |
|------|-------|----------|
| Student | sarah@student.must.ac.ug | password123 |
| Lecturer | dr.akello@must.ac.ug | password123 |
| Admin | admin@must.ac.ug | password123 |

## Development Workflow

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview prod build
npm run preview
```

## Common Tasks

### Add a new page
1. Create file in `src/pages/`
2. Add route in `App.tsx`
3. Import in `App.tsx`

### Add state to a page
1. Create/update store in `src/stores/`
2. Import hook in component
3. Use store methods/state

### Make API call
1. Add function to `src/services/apiService.ts`
2. Call from component with error handling

### Style a component
1. Use Tailwind classes
2. No CSS files (all in JSX)
3. Responsive: `sm:`, `md:`, `lg:` prefixes

## Debugging

Browser console:
```javascript
window.debugAuth()  // Show auth state
window.debugAuth('clear')  // Clear token
window.debugAuth('reset')  // Clear all storage
```

Check network requests:
- DevTools → Network tab
- Look for `Authorization: Bearer {token}` header

## Performance Optimization

- Lazy load page components with `React.lazy()`
- Memoize expensive components with `React.memo()`
- Use Zustand selectors to prevent re-renders
- Tree-shake unused imports

## Known Limitations

- No server-side rendering (SPA only)
- No offline message queuing (just caching)
- No real-time updates (polling only)
- No image support in messages

## Related Documents

- [SETUP.md](./SETUP.md) - Installation guide
- [QUICKREF.md](./QUICKREF.md) - Quick reference
- [COMPONENTS.md](./COMPONENTS.md) - Component API
- Backend [README.md](../../backend/README.md) - API endpoints

---

**Status**: Production Ready | **Last Updated**: Feb 10, 2026
