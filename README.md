# DermAI — AI Skin Diagnosis + Grad-CAM Explainability

DermAI is a production-ready, full-stack medical AI application for skin lesion classification. Built with a FastAPI backend and a React (Vite) frontend, the platform classifies skin lesions into 7 diagnostic categories, providing real-time clinical explainability through **Grad-CAM heatmaps** and **pixel-level Saliency Maps**.

[![Backend API](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi)](https://huggingface.co/spaces/ganirathod/dermai-backend)
[![Model Weights](https://img.shields.io/badge/Model-HuggingFace-FFD21E?style=flat&logo=huggingface)](https://huggingface.co/spaces/ganirathod/dermai-backend)
[![Frontend](https://img.shields.io/badge/Frontend-Vite%20%2B%20React-646CFF?style=flat&logo=vite)](https://dermai.vercel.app)

---

## 🏗️ Architecture Overview

The system consists of the following decoupled components:

```mermaid
graph TD
    User([User / Browser]) -->|HTTPS| FE[React Frontend - Vite]
    FE -->|Firebase ID Token| BE[FastAPI Backend - Docker]
    BE -->|Verify JWT| FA[Firebase Admin SDK]
    BE -->|Model Inference| Model[(EfficientNetV2 Model)]
    BE -->|Save Images| Cloudinary[(Cloudinary Cloud Storage)]
    BE -->|Scan History & User Data| DB[(PostgreSQL / Supabase)]
    BE -->|Welcome Email| SendGrid[(SendGrid SMTP)]
```

*   **Frontend**: React SPA styled with Tailwind CSS, using Framer Motion for smooth transitions, Zustand for global state management, and Firebase Client SDK for Google Auth.
*   **Backend**: FastAPI REST service running inside a Docker container on Hugging Face Spaces.
*   **Database**: Supabase (PostgreSQL) storing registered users and scan histories.
*   **Storage**: Cloudinary hosting user-uploaded original images, Grad-CAM overlays, and saliency maps.
*   **Auth**: Federated Google Sign-In managed by Firebase. The backend verifies incoming Firebase ID Tokens (JWTs) using the Firebase Admin SDK.
*   **CI/CD**: GitHub Actions automatically syncs the `Backend/` folder to Hugging Face Spaces on every push to the `main` branch.

---

## ✨ Features

-   **Dual Upload Modes**: Upload static image files (JPEG, PNG, WEBP) or capture images directly using the built-in device camera (via HTML5 MediaDevices API).
-   **Calibrated AI Predictions**: Generates probabilities for 7 classes, calibrated using class-specific scales to prevent class bias.
-   **Dual-Layer Explainability**:
    -   **Grad-CAM**: Generates a coarse heatmap over the last convolutional layer, highlighting regions that heavily influenced the model's decision.
    -   **Saliency Map**: Computes pixel-level gradients to map exactly which fine-grained pixels contributed to the diagnosis.
-   **Flexible User Flows**:
    -   **Guest Mode**: Stateless analysis using base64 in-memory encoding. No user data, files, or images are written to the cloud or database.
    -   **Authenticated Mode**: Keeps a persistent history of scans. Saves images to Cloudinary and saves predictions, risk severity, and metadata to PostgreSQL.
-   **Profile & History Management**: Users can edit profiles (username, display name, bio, phone number) and manage scan histories (with full deletion support, removing images from both the database and Cloudinary).
-   **Automated Email Service**: Dispatches HTML welcome emails via SendGrid upon first-time login.

---

## 🧠 Model Details & Calibration

DermAI employs an **EfficientNetV2** backbone trained on the HAM10000 dataset. It utilizes **Test-Time Augmentation (TTA)** (averaging predictions across original, horizontal flip, vertical flip, rot90, and rot270 variations) to ensure robust predictions.

### HAM10000 Test Set Performance
*   **Test Accuracy**: `82.54%`
*   **Macro F1-Score**: `0.7073` (compared to the baseline of `0.6356`)
*   **Micro AUC**: `0.9777`
*   **Macro AUC**: `0.9566`

### Calibration Scaling (`class_scales.json`)
Raw logits are rebalanced using class weights to counter the extreme class imbalance in the training data (reducing false-positive nevus predictions):

| Class Code | Lesion Type | Risk Label | Severity | Calibration Scale |
| :--- | :--- | :--- | :--- | :--- |
| `akiec` | Actinic keratoses (Precancerous) | Precancerous | Moderate | `0.40` |
| `bcc` | Basal cell carcinoma | Malignant | High | `0.80` |
| `bkl` | Benign keratosis (seborrheic keratoses) | Benign | Low | `0.55` |
| `df` | Dermatofibroma | Benign | Low | `0.40` |
| `mel` | Melanoma | Malignant | High | `0.70` |
| `nv` | Melanocytic nevus (Common Mole) | Benign | Low | `1.45` |
| `vasc` | Vascular lesion | Usually benign | Moderate | `0.50` |

### Custom Threshold Logic
To ensure clinical safety and relevance:
1.  **Confidence < 20%**: The image is flagged as `unrelated` ("Invalid Image / Not a Skin Lesion").
2.  **Confidence 20% - 35%**: The image is flagged as `normal` ("Normal / No Disease Detected").
3.  **Confidence >= 35%**: The image is analyzed and classified under one of the 7 HAM10000 categories listed above.

---

## 📂 Directory Structure

```text
├── .github/workflows/
│   └── huggingface-sync.yml     # CI GitHub Action for HF Space sync
├── Backend/
│   ├── models/                  # Optional local directory for keras model
│   ├── static/                  # Temp storage directory for local outputs
│   ├── auth.py                  # Firebase ID Token verification & user management
│   ├── class_scales.json        # Class-balancing calibration JSON
│   ├── database.py              # SQLAlchemy DB models (User, ScanHistory) & session
│   ├── Dockerfile               # Container spec for Hugging Face Spaces
│   ├── download_model.py        # Python script to download model weights from HF Hub
│   ├── email_service.py         # SendGrid email integration
│   ├── gradcam.py               # Model loading, TTA, inference, Grad-CAM & Saliency maps
│   ├── main.py                  # FastAPI router, CORS setup, and endpoints
│   ├── requirements.txt         # Backend dependencies list
│   └── storage.py               # Cloudinary upload/destroy API helper
├── Frontend/
│   ├── public/                  # Public static assets
│   ├── src/
│   │   ├── components/          # Reusable components (Navbar, AppShell, etc.)
│   │   ├── Pages/               # Page views (Landing, Scan, Camera, Result, etc.)
│   │   ├── store/               # Zustand state store
│   │   ├── api.js               # Axios configuration with auth header interceptors
│   │   ├── App.jsx              # React router definitions
│   │   ├── index.css            # Tailwind directives and custom CSS
│   │   └── main.jsx             # React entry mount point
│   ├── package.json             # Frontend dependencies list
│   ├── tailwind.config.js       # Tailwind configuration file
│   └── vite.config.js           # Vite server configuration
├── README.md                    # Project-level overview (This file)
└── sync_hf.py                   # Ad-hoc Python script to manually sync Backend to HF Spaces
```

---

## ⚙️ Environment Variables

### Backend Configuration (`Backend/.env`)
Create a `.env` file inside the `Backend/` directory:
```env
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://user:password@db.supabase.co:5432/postgres

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# SendGrid Email (Optional)
SENDGRID_API_KEY=your_sendgrid_api_key

# Hugging Face Weights Repository
HF_MODEL_REPO=ganirathod/dermiAI
HF_TOKEN=your_huggingface_token
MODEL_PATH=/tmp/best_final.keras
SCALES_PATH=./class_scales.json

# Firebase Service Account (JSON string or path to .json credential file)
FIREBASE_CREDENTIALS={"type":"service_account","project_id":"..."}

MAX_UPLOAD_MB=12
```

### Frontend Configuration (`Frontend/.env.development` / `Frontend/.env.production`)
Create configuration files inside the `Frontend/` directory:
```env
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 🚀 Local Development

### 1. Prerequisite Model Setup
Make sure you have your Model file downloaded or hosted. If using Hugging Face Hub, set `HF_MODEL_REPO` and `HF_TOKEN` in your environment variables.

### 2. Backend Setup
```bash
# Navigate to Backend folder
cd Backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate   # On Unix: source venv/bin/activate

# Install required packages
pip install -r requirements.txt

# Create .env and configure secrets
cp .env.example .env

# Optional: Download model weights manually from Hugging Face
python download_model.py

# Run development server
uvicorn main:app --reload --port 8000
```
The FastAPI swagger docs will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 3. Frontend Setup
```bash
# Navigate to Frontend folder
cd Frontend

# Install package dependencies
npm install

# Create local environment config
cp .env.example .env.development

# Launch dev server
npm run dev
```
Open your browser and navigate to [http://localhost:5173](http://localhost:5173).

---

## 🔌 API Endpoints

All requests modifying/fetching user data require a Bearer token in the `Authorization` header containing the Firebase ID Token: `Authorization: Bearer <token>`.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **GET** | `/` | Root server diagnostic page (HTML) | No |
| **GET** | `/health` | Check backend availability & model loading state | No |
| **POST** | `/auth/google` | Logs in user, registers user in database if new, sends welcome email | **Yes** |
| **GET** | `/me` | Retrieves authenticated user profile | **Yes** |
| **POST** | `/update-profile` | Updates user details (`display_name`, `username`, `phone_number`, `bio`) | **Yes** |
| **POST** | `/diagnose` | Run model inference on uploaded skin lesion image | Optional |
| **GET** | `/history` | Fetch user's scan history | **Yes** |
| **GET** | `/history/{scan_id}` | Fetch details of a specific scan | **Yes** |
| **DELETE** | `/history/{scan_id}` | Deletes scan from DB & removes images from Cloudinary | **Yes** |

---

## 🚢 Deployment & CI/CD

### Backend
The backend is designed to run in a Docker container (refer to `Backend/Dockerfile`) and is hosted on a **Hugging Face Space**.
*   **Hugging Face Port**: Explosed on `7860`.
*   **Sync Workflow**: Any push to the `main` branch trigger a Github Action (`.github/workflows/huggingface-sync.yml`) that runs a subtree split to isolate `Backend/` and push it directly to the Hugging Face Space git repository.
*   **Manual Sync**: You can also use `sync_hf.py` to trigger a manual push using `huggingface-hub` API.
    ```bash
    $env:HF_TOKEN="your_token_here"
    python sync_hf.py
    ```

### Frontend
The frontend can be built and deployed on **Vercel** or any static hosting platform.
```bash
npm run build
```

---

## ⚠️ Medical Disclaimer

This application is **not a medical device** and should not be used as a substitute for professional medical advice, diagnosis, or treatment. It is intended solely for **educational and research purposes**. If you have concerns about a skin lesion, please consult a board-certified dermatologist or healthcare professional.
