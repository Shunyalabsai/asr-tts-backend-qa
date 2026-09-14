# ShunyaLabs 24/7 API Health Monitor (Google Apps Script)

This standalone Google Apps Script runs **24/7 every 15 minutes** with zero cloud infrastructure costs or maintenance. It probes the complete ASR & TTS stack and sends detailed alerts with actionable failure reasons and step-by-step resolution guides to **`yamini@shunyalabs.in`**.

---

## 🚀 Setup & Deployment (3 Minutes)

### Step 1: Open Google Apps Script
1. Go to [script.google.com](https://script.google.com/) (or in your existing Meera / ASR Google Sheet, click **Extensions > Apps Script**).
2. Create a new project named: `ShunyaLabs-24-7-API-Health-Monitor`.

### Step 2: Copy the Script
1. Open `Code.gs` in the editor.
2. Replace everything with the contents of [`apps-script-monitoring/Code.gs`](./Code.gs).

### Step 3: Configure API Key (Optional / Recommended)
- By default, `CONFIG.API_KEY` is pre-configured with your active key.
- You can also set it securely via **Project Settings (Gear Icon) > Script Properties**:
  - **Property:** `ASR_API_KEY`
  - **Value:** `R1jmM5tm7e9y017b2b814df8`

### Step 4: Run Once & Set Up 15-Minute Trigger
1. Select the function **`install15MinuteTrigger`** from the top dropdown in Apps Script.
2. Click **Run**.
3. Authorize Google to send emails and fetch URLs (`MailApp` and `UrlFetchApp`).
4. You are all set! The trigger will now run **every 15 minutes 24/7**.

---

## 🔍 What It Probes Every 15 Minutes

| # | Probe | Endpoint | SLA / Expectation |
| :--- | :--- | :--- | :--- |
| **1** | **Core Service Health** | `GET /health` | HTTP 200 with `{"ok": true}` |
| **2** | **Auth Microservice** | `POST /auth/token` | HTTP 200 with valid signed JWT bearer token |
| **3** | **Speech-to-Text Model Inference** | `POST /v1/audio/transcriptions` | End-to-end multipart audio transcription on `zero-indic` |

---

## 📧 Alert Features

1. **Failure Alert (`🚨 [CRITICAL ALERT]`):**
   - Triggers immediately on status != 200, gateway timeout (504/502), auth failure, or engine exception.
   - Includes exact **HTTP Status Code**, **Latency (ms)**, **Failure Reason**, and a **Step-by-Step Actionable Resolution Guide**.
   - Destination: `yamini@shunyalabs.in`.

2. **Auto-Recovery Alert (`✅ [RESOLVED]`):**
   - Automatically detects when services come back online and sends a recovery email.
