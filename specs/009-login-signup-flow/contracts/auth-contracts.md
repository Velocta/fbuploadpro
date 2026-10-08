# Interface & API Contracts: Supabase Authentication Flow (Spec 009)

## 1. Endpoints Specification

### 1. `POST /api/auth/signup`
Creates user identity in Supabase Auth, provisions PostgreSQL profile, and sets session cookie.

* **Request Body**:
  ```json
  {
    "name": "Alex Mercer",
    "phone": "+14155552671",
    "email": "alex.mercer+marketing@agency.com",
    "password": "StrongPassword123!"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "alex.mercer+marketing@agency.com",
      "name": "Alex Mercer",
      "subdomain": "alexmercer",
      "role": "user",
      "status": "active"
    },
    "redirectUrl": "https://alexmercer.fbuploadpro.com/dashboard"
  }
  ```
* **Set-Cookie Header**:
  `fbup_session=<token>; Path=/; Domain=.fbuploadpro.com; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
* **Error Responses**:
  - `400 Bad Request`: Validation failure (invalid email, short password, etc.)
  - `409 Conflict`: Email already registered.

---

### 2. `POST /api/auth/login`
Verifies credentials, checks account status, and issues session cookie.

* **Request Body**:
  ```json
  {
    "email": "alex.mercer+marketing@agency.com",
    "password": "StrongPassword123!",
    "returnUrl": "https://alexmercer.fbuploadpro.com/publishing"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "alex.mercer+marketing@agency.com",
      "name": "Alex Mercer",
      "subdomain": "alexmercer",
      "role": "user",
      "status": "active"
    },
    "redirectUrl": "https://alexmercer.fbuploadpro.com/publishing"
  }
  ```
* **Error Responses**:
  - `401 Unauthorized`: Invalid credentials.
  - `403 Forbidden`: Account suspended (`/account-suspended`).

---

### 3. `POST /api/auth/logout`
Terminates session and clears cookie.

* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "redirectUrl": "/login"
  }
  ```
* **Set-Cookie Header**:
  `fbup_session=; Path=/; Domain=.fbuploadpro.com; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
