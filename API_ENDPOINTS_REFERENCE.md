# API Endpoints Implementation - Option A (6 Endpoints)

## Overview
Complete implementation of 6 RESTful API endpoints with JWT authentication and admin functions. Using hardcoded test data for immediate frontend integration.

---

## Endpoints Summary

### 1. Authentication Endpoints (3)

#### POST `/auth/login`
**Login with email and password**

```json
Request:
{
  "email": "john.student@must.ac.ug",
  "password": "password123"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "email": "john.student@must.ac.ug",
    "role": "student",
    "full_name": "John Student",
    "approved": true
  }
}
```

#### POST `/auth/set-password`
**Set password on first login**

```json
Request (requires Authorization header):
{
  "password": "newpassword123",
  "password_confirm": "newpassword123"
}

Response:
{
  "message": "Password set successfully"
}
```

#### GET `/auth/me`
**Get current authenticated user**

```
Request:
Authorization: Bearer <token>

Response:
{
  "id": "john.student@must.ac.ug",
  "email": "john.student@must.ac.ug",
  "role": "student",
  "full_name": "John Student",
  "approved": true,
  "courses": null
}
```

---

### 2. Admin Endpoints (3)

#### GET `/admin/lecturers`
**Get all lecturers with approval status**

```
Request:
Authorization: Bearer <admin_token>

Response:
[
  {
    "email": "lecturer.approved@must.ac.ug",
    "full_name": "Approved Lecturer",
    "department": "Computer Science",
    "approved": true
  },
  {
    "email": "lecturer.pending@must.ac.ug",
    "full_name": "Pending Lecturer",
    "department": "Engineering",
    "approved": false
  },
  {
    "email": "another.pending@must.ac.ug",
    "full_name": "Another Pending",
    "department": "Mathematics",
    "approved": false
  }
]
```

#### PATCH `/admin/lecturers/{email}`
**Manage lecturer: approve, revoke, or delete**

```json
Request:
Authorization: Bearer <admin_token>

// Approve lecturer
{
  "action": "approve"
}

// Revoke access
{
  "action": "revoke"
}

// Delete lecturer
{
  "action": "delete"
}

Response:
{
  "message": "Lecturer lecturer.pending@must.ac.ug approved"
}
```

#### GET `/admin/analytics`
**Get dashboard statistics**

```
Request:
Authorization: Bearer <admin_token>

Response:
{
  "total_students": 2,
  "total_lecturers": 3,
  "approved_lecturers": 2,
  "pending_lecturers": 1,
  "total_chats": 0,
  "total_messages": 0
}
```

#### POST `/admin/import`
**Import students or lecturers from CSV**

```json
Request:
Authorization: Bearer <admin_token>

// Import students
{
  "type": "students",
  "data": [
    {
      "email": "new.student@must.ac.ug",
      "full_name": "New Student",
      "password": "password123"
    }
  ]
}

// Import lecturers
{
  "type": "lecturers",
  "data": [
    {
      "email": "new.lecturer@must.ac.ug",
      "full_name": "New Lecturer",
      "password": "password123",
      "courses": "CS101,CS102"
    }
  ]
}

Response:
{
  "type": "students",
  "imported": 1,
  "total_rows": 1,
  "errors": null
}
```

---

## Test Accounts

All test accounts use password: `password123`

**Source**: `backend/init_db.py` - seed_test_accounts()

### Admin
- **Email**: `admin@must.ac.ug` | **Username**: `admin`
  - **Role**: Admin | **Status**: Approved ✓
  - **Full Name**: Admin User

### Students (Approved)
- **Email**: `john.student@must.ac.ug` | **Username**: `john_student`
  - **Full Name**: John Student | **Status**: Approved ✓

- **Email**: `jane.student@must.ac.ug` | **Username**: `jane_student`
  - **Full Name**: Jane Student | **Status**: Approved ✓

### Lecturers (Approved)
- **Email**: `lecturer.approved@must.ac.ug` | **Username**: `lecturer_app`
  - **Full Name**: Approved Lecturer | **Department**: Computer Science
  - **Status**: Approved ✓

### Lecturers (Pending Approval)
- **Email**: `lecturer.pending@must.ac.ug` | **Username**: `lecturer_pend`
  - **Full Name**: Pending Lecturer | **Department**: Engineering
  - **Status**: Pending ⏳

- **Email**: `another.pending@must.ac.ug` | **Username**: `another_pend`
  - **Full Name**: Another Pending | **Department**: Mathematics
  - **Status**: Pending ⏳

---

## Authentication Flow

1. **Frontend**: POST `/auth/login` with email + password
2. **Backend**: Returns JWT token + user data
3. **Frontend**: Stores token in localStorage
4. **Frontend**: Includes token in all subsequent requests: `Authorization: Bearer <token>`
5. **Backend**: Validates JWT token in request header
6. **Role-Based Routing**: Frontend routes to appropriate page based on user role + approval status

---

## File Changes

### Created Files
- `/backend/app/routes/admin.py` - Admin endpoints (lecturers, analytics, import)

### Modified Files
- `/backend/app/routes/auth_demo.py` - Enhanced with JWT authentication (6 endpoints)
- `/backend/app/main.py` - Added admin router
- `/backend/requirements.txt` - Added PyJWT==2.8.1

### Key Implementation Details

**JWT Configuration:**
- Algorithm: HS256
- Secret Key: `SECRET_KEY` env var (defaults to "your-secret-key-change-this-in-production")
- Expiration: 30 minutes

**Test Data Storage:**
- Hardcoded in `TEST_ACCOUNTS` dictionary in `/auth_demo.py`
- Modified in-memory during import/admin actions
- **Note:** Changes will be lost when server restarts (intended for development only)

**Authorization:**
- Admin endpoints require `Authorization: Bearer <token>` header
- Token must have role="admin"
- Returns 403 Forbidden if not admin

---

## Next Steps

1. **Test Endpoints**: Use frontend to login with test accounts
2. **Database Integration**: Replace TEST_ACCOUNTS with real database queries
3. **Production Security**: 
   - Use strong SECRET_KEY
   - Implement password hashing
   - Add rate limiting
   - Add CORS configuration
4. **Extended Features**: Implement remaining admin actions (CSV processing, lecturer delete)

---

## Running the Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Run backend
uvicorn app.main:app --reload --port 5000
```

Backend will be available at `http://localhost:5000`

API documentation: `http://localhost:5000/docs` (Swagger UI)
