# 🏢 MCC Campus Maintenance & Issue Management System

A modern, full-stack campus maintenance and complaint lifecycle portal built with **React**, **Vite**, **Tailwind CSS**, **Node.js HTTP/SMTP**, and interactive **3D Glassmorphism UI**.

---

## 📁 Repository Structure

```text
mcc-issue-system/
├── 📁 issue-portal/          # User-Facing Complaint Submission & Tracking Portal (Port 5174)
│   ├── src/
│   │   ├── components/       # LandingPage, UserForm, Navbar, CollegeLogo, etc.
│   │   ├── ticketsStore.js   # Local & Sync Storage layer
│   │   └── emailService.js   # Email notification service
│   ├── server.js             # Real-time HTTP & SMTP Sync Backend (Port 5000)
│   ├── tickets.json          # Persistent JSON storage for tickets
│   └── package.json
│
├── 📁 admin-portal/          # Facilities Operations & Kanban Control Center (Port 5175)
│   ├── src/
│   │   ├── components/       # AdminDashboard, KanbanBoard, TicketCard, AdminLogin, etc.
│   │   └── ticketsStore.js   # Real-time synced state management
│   └── package.json
│
├── .gitignore
├── package.json              # Root orchestrator scripts
└── README.md                 # Project documentation
```

---

## ✨ Features

### 📋 Issue Portal (`issue-portal`)
- **Modern Landing Page**: Dynamic hero banner with KPIs, interactive workflow walkthrough, and department category chips.
- **Smart Complaint Form**: Multi-step student/faculty validation, category selection (Electrical, Plumbing, Civil, IT, etc.), water leak quick-picks, photo drag & drop upload, and priority flags.
- **Ticket Tracking**: Immediate generation of ticket numbers (e.g., `#MCC-2026-0001`) with real-time status tracking.

### 🛡️ Admin Control Board (`admin-portal`)
- **3D Animated Glassmorphism Login**: Interactive mouse parallax 3D tilt tracking, floating CSS 3D cubes, and 1-click demo credentials auto-fill.
- **Drag-and-Drop Kanban Board**: Real-time ticket lifecycle management across **Unsolved**, **Ongoing**, and **Solved** columns.
- **Worker Allocation & Timeline**: Assign maintenance workers, schedule task completion timelines, and log work progress.
- **Automated Email Dispatch**: Sends resolution and update emails via SMTP/EmailJS when issues are solved.
- **Data Export & Search**: Full search filtering by department, priority, and date range, with one-click JSON data export.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **yarn**

---

### 1. Installation

Clone the repository and install dependencies in both sub-portals:

```bash
# Clone the repository
git clone https://github.com/<your-username>/mcc-issue-system.git
cd mcc-issue-system

# Install dependencies for both portals
npm run install:all
```

*(Alternatively, run `npm install` inside each folder: `cd issue-portal && npm install` and `cd ../admin-portal && npm install`)*

---

### 2. Running Locally

Start the three services:

#### Terminal 1 — Start Sync & SMTP Server (Port 5000)
```bash
cd issue-portal
node server.js
```

#### Terminal 2 — Start User Issue Portal (Port 5174)
```bash
cd issue-portal
npm run dev
```

#### Terminal 3 — Start Admin Operations Portal (Port 5175)
```bash
cd admin-portal
npm run dev
```

---

## 🌐 Default Ports & Access

| Portal | Local URL | Default Role |
| :--- | :--- | :--- |
| **User Issue Portal** | `http://localhost:5174` | Students, Faculty & Staff |
| **Admin Control Portal**| `http://localhost:5175` | Facilities Supervisors & Admins |
| **Sync & SMTP Server** | `http://localhost:5000` | Backend API & SMTP Service |

### 🔑 Demo Admin Credentials
- **Email**: `admin@mcc.edu`
- **Password**: `admin@mcc2024`

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React
- **Drag and Drop**: `@hello-pangea/dnd`
- **Backend & Sync**: Node.js HTTP Server, Nodemailer SMTP, LocalStorage Fallback
- **Animations**: CSS 3D Transforms, Custom Keyframes & Parallax Mouse Tracking

---

## 📱 Meta WhatsApp Cloud API & Webhook Setup

The MRF Issue Portal includes real-time two-way WhatsApp Cloud API integration for automated admin alerts, worker dispatches, and interactive complaint resolution.

### 1. Webhook Configuration in Meta Developer Console

In your [Meta Developer Dashboard](https://developers.facebook.com/) under **WhatsApp > Configuration**:

1. **Callback URL**:
   ```text
   https://<your-public-domain>/api/whatsapp/webhook
   ```
   > **Note:** Meta requires a valid, publicly reachable **HTTPS** endpoint. For local development or testing, expose the local server (Port 5000) using a secure tunnel:
   > ```bash
   > ngrok http 5000
   > ```
   > Then use the generated HTTPS URL: `https://<unique-id>.ngrok-free.dev/api/whatsapp/webhook`.

2. **Verify Token**:
   - Must match the `WHATSAPP_VERIFY_TOKEN` defined in your `.env` (default placeholder: `mrf_whatsapp_verify_token_2026`).

3. **Webhook Field Subscriptions**:
   - Under **Webhook fields**, click **Manage** and subscribe to **`messages`**.
   - Subscribing to `messages` enables delivery of inbound text messages, interactive button replies (`Confirm Fixed` / `Not Fixed`), and delivery status receipts (`sent`, `delivered`, `read`, `failed`).

### 2. Webhook Security & Signature Verification

- **HMAC-SHA256 Signature Header**: Meta signs all incoming webhook POST requests with an `X-Hub-Signature-256` header.
- **Configuring App Secret**: Retrieve your **App Secret** from *Meta Developer Dashboard > App settings > Basic > App secret* and set:
  ```env
  WHATSAPP_APP_SECRET=your_meta_app_secret_here
  ```
- **Security Enforcement**:
  - When `WHATSAPP_APP_SECRET` is configured, all incoming POST requests are verified against `X-Hub-Signature-256` using timing-safe comparison (`crypto.timingSafeEqual`). Requests with missing or invalid signatures are rejected with `HTTP 401 Unauthorized`.
  - In production (`NODE_ENV=production`), unconfigured or placeholder secrets (`YOUR_WHATSAPP_APP_SECRET`) are strictly rejected to prevent unauthorized webhook execution.

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
