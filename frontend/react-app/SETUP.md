# EduSmart Frontend - Setup Guide

This guide will help you get the EduSmart React frontend up and running.

## Prerequisites

- **Node.js**: v16.0.0 or higher
- **npm**: v8.0.0 or higher (comes with Node.js)
- **Backend API**: Running on `http://localhost:8000` (see backend README)

Verify installation:
```bash
node --version  # Should be v16+
npm --version   # Should be v8+
```

## Quick Start

### 1. Install Dependencies

```bash
cd frontend/react-app
npm install
```

This installs all required packages listed in `package.json`:
- React 18 with TypeScript
- React Router v6
- Tailwind CSS v3
- Axios
- UUID

### 2. Start Development Server

```bash
npm run dev
```

Output will show:
```
  VITE v5.0.12  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### 3. Open Browser

Navigate to [http://localhost:5173](http://localhost:5173)

## User Flows

### Student
Login → Set Password → Select Course → Chat

### Lecturer (Pending)
Login → Set Password → Waiting for Approval

### Lecturer (Approved)
Login → Upload Files → Chat

### Admin
Login → Dashboard (Config, Users, Content)

## Available Scripts

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Debugging

Check auth state in browser console:
```javascript
window.debugAuth()  // Show auth info
window.debugAuth('clear')  // Clear token
window.debugAuth('reset')  // Clear all storage
```

## Common Issues

**"Cannot GET /api/..."** → Backend not running on port 8000

**CORS error** → Check backend has CORS middleware configured

**Tailwind not working** → Verify `tailwind.config.js` content path is correct

## Resources

- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org/docs)
- [React Router v6](https://reactrouter.com)
