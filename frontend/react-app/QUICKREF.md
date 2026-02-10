# EduSmart Frontend - Quick Reference

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Student | sarah@student.must.ac.ug | password123 |
| Lecturer (Approved) | dr.akello@must.ac.ug | password123 |
| Lecturer (Pending) | dr.namukasa@must.ac.ug | password123 |
| Admin | admin@must.ac.ug | password123 |

## Key Files by Function

| Function | File |
|----------|------|
| Authentication | `src/state/AuthContext.tsx` |
| Chat Interface | `src/pages/ChatPage.tsx` |
| File Upload | `src/pages/UploadPage.tsx` |
| Admin Panel | `src/pages/AdminDashboard.tsx` |
| Course Selection | `src/components/CourseSelector.tsx` |
| Messages | `src/components/MessageBubble.tsx` |
| Navigation | `src/components/Sidebar.tsx` |
| API Calls | `src/services/apiService.ts` |
| Routing | `src/App.tsx` |

## State Management

| Store | Purpose |
|-------|---------|
| `chatStore` | Chat sessions, messages, history |
| `courseStore` | Campus, year, semester, course selection |
| `institutionStore` | Institution config data |
| `uploadStore` | File upload progress |
| `offlineStore` | Online/offline status |

## User Flows

### Student
```
Login → Set Password → Select Course → Chat
```

### Lecturer (Pending Approval)
```
Login → Set Password → Waiting for Admin Approval
```

### Lecturer (Approved)
```
Login → Set Password → Upload Files → Chat or Upload
```

### Admin
```
Login → Set Password → Dashboard (Config/Users/Content)
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | User login |
| `/api/auth/set-password` | POST | Set password on first login |
| `/api/chats` | POST | Create new chat |
| `/api/chats/:id/messages` | POST | Send message |
| `/api/ingest/upload` | POST | Upload file |
| `/admin/users` | GET | Get all users |
| `/admin/import` | POST | Import users from CSV |
| `/admin/config/institution` | PUT | Update institution config |
| `/admin/analytics` | GET | Get content overview |

## Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/login` | LoginPage | Email + password login |
| `/set-password` | SetPasswordPage | First-time password setup |
| `/course-selection` | CourseSelectionPage | Select course (students) |
| `/chat` | ChatPage | AI chat interface |
| `/upload` | UploadPage | File upload (lecturers) |
| `/lecturer-pending` | LecturerPendingPage | Waiting for approval |
| `/admin` | AdminDashboard | Admin dashboard |

## Debugging Tools

Available in browser console:
```javascript
window.debugAuth()  // Show auth info
window.debugAuth('clear')  // Clear token
window.debugAuth('reset')  // Clear all storage
```

## Common Commands

```bash
npm run dev         # Start dev server
npm run build       # Build for production
npm run preview     # Preview prod build
```

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Cannot GET /api/... | Backend not running | Start backend on port 8000 |
| CORS error | Backend not configured | Add CORS middleware to backend |
| Tailwind not working | Config path wrong | Check `tailwind.config.js` content path |
| Token not sent | Interceptor issue | Check `apiClient.ts` has auth interceptor |

## File Upload Limits

- Allowed types: PDF, DOCX, PPTX
- Max file size: 20MB
- Stored in backend

## Colors (Tailwind)

- Primary Blue: `#2563EB`
- Success Green: `#10B981`
- Error Red: `#EF4444`
- Gray: `#6B7280`

## Resources

- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org/docs)
- [React Router v6](https://reactrouter.com)

---

**Status**: Production Ready | **Last Updated**: Feb 10, 2026
