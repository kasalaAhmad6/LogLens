# LogLens - SIEM-Lite Log Analysis Dashboard

LogLens is a lightweight SIEM (Security Information and Event Management) web application built to parse Apache/Nginx web server logs, evaluate requests against common threat signatures, map attacker origins, and present analytics inside an interactive security dashboard.

---

## 🚀 Key Features

* **Stream-Based Log Parser**: Memory-safe parser that reads logs line-by-line using Node's stream APIs. Evaluates files up to 1GB+ without consuming significant RAM.
* **Threat Detection Signatures**: Tracks SQL Injection (SQLi), Cross-Site Scripting (XSS), and Directory Traversal attacks using a regular expression dictionary.
* **Brute Force Detection**: Dynamic in-memory heuristic monitoring. Flags IP addresses with 5+ failed requests (`401`/`403`) in a 5-minute sliding window.
* **Offline GeoIP Mapping**: Resolves attacker IP addresses to country codes offline using a built-in GeoLite database.
* **Real-time Job Tracking**: Upload files $\rightarrow$ receive Job ID $\rightarrow$ monitor parser progress $\rightarrow$ view completed metrics.
* **Interactive Visualization**: Dashboard charts representing hourly attack timelines (Recharts Area), category breakdowns (Pie Chart), and attacker details (tabular list with country flags and search filtering).
* **Export Report**: Exposes statistical aggregates and threat indexes as downloadable JSON reports.

---

## 📁 Repository Layout

```text
LogLens/
├── backend/
│   ├── data/               # SQLite database directory (ignored in Git)
│   ├── uploads/            # Temporary file upload storage
│   ├── signatures.json     # Vulnerability signature list
│   ├── database.js         # SQLite controller (schema & aggregates)
│   ├── parser.js           # Line-by-line stream parser & threat engine
│   ├── server.js           # Express API endpoints
│   ├── demo.log            # Mock server traffic logs containing attacks
│   └── test_parser.js      # Integration parser verification tests
├── frontend/
│   ├── vite.config.js      # Vite configurations & proxy router
│   ├── index.html          # Shell index document
│   └── src/
│       ├── main.jsx        # Mount point
│       ├── App.jsx         # Dashboard layout coordinator
│       ├── index.css       # Deep cyber theme stylesheet
│       └── components/
│           ├── UploadArea.jsx    # File dropzone & XHR uploader
│           ├── JobSelector.jsx   # Interactive sidebar list of runs
│           ├── DashboardStats.jsx# Summary metrics cards
│           ├── AttackTimeline.jsx# Recharts hourly area chart
│           ├── AttackTypes.jsx   # Recharts donut chart
│           └── TopAttackers.jsx  # Malicious IPs list with search filters
└── .gitignore              # Files ignored by Git (node_modules, SQLite, etc.)
```

---

## 🛠️ Installation & Setup

Ensure you have **Node.js** (v22+) installed on your machine.

### 1. Set Up Backend
Navigate to the backend directory, install packages, and boot the API server:
```bash
cd backend
npm install
node server.js
```
*The API will start listening on port `5000`.*

### 2. Set Up Frontend
Navigate to the frontend directory, install packages, and boot the web server:
```bash
cd ../frontend
npm install
npm run dev
```
*The UI will start listening on port `3000`.*

---

## 🧪 Testing

1. Open your web browser and navigate to **`http://localhost:3000`**.
2. Click **"Load Demo Log"** to run an instant demonstration of the parsing engine on mock logs, or drag and drop a custom `.log` file into the upload zone.
3. Once completed, explore the analytics chart panels and click **"Export Report"** to save your security logs.
