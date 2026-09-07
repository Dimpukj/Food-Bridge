# FoodBridge — Supabase Database & Vercel Deployment Guide

This guide provides step-by-step instructions for connecting your FoodBridge application to **Supabase PostgreSQL** and deploying it to **Vercel**.

---

## 🚀 Step 1: Set Up Your Supabase Database

1. **Log in to Supabase**:
   - Go to [Supabase Console](https://supabase.com/dashboard) and log in or create a free account.

2. **Create a New Project**:
   - Click **New Project**.
   - Select your organization.
   - Set **Name**: `FoodBridge`.
   - Set a strong **Database Password** (save this password safely!).
   - Choose a region close to your target users (e.g. `South Asia (Mumbai)`).
   - Click **Create new project**.

3. **Run the Database Schema Script (`supabase.sql`)**:
   - In your Supabase Project Dashboard, go to **SQL Editor** (left sidebar).
   - Click **New Query**.
   - Open the [`supabase.sql`](file:///c:/Users/dimpu/OneDrive/Desktop/Foodbridge/supabase.sql) file from this repository.
   - Copy the entire SQL content and paste it into the Supabase SQL Editor.
   - Click **Run** (or `Ctrl + Enter`).
   - You should see `Success. No rows returned`. All 9 tables, indexes, PL/pgSQL triggers, Row Level Security (RLS) policies, and sample data are now live!

---

## 🔑 Step 2: Get Connection Credentials

1. **Database Connection URI**:
   - In Supabase, navigate to **Project Settings** (gear icon) -> **Database**.
   - Scroll down to **Connection string**.
   - Select **URI**.
   - Copy the connection string. It will look like:
     ```text
     postgres://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
     ```
   - Replace `[YOUR-PASSWORD]` with the database password you created in Step 1.

2. **Supabase API Keys**:
   - Navigate to **Project Settings** -> **API**.
   - Copy **Project URL** (e.g., `https://xyzcompany.supabase.co`).
   - Copy **anon / public key**.

---

## 💻 Step 3: Test Locally

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your Supabase variables:
   ```env
   DATABASE_URL=postgres://postgres.ref:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   SUPABASE_URL=https://ref.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   JWT_SECRET=supersecret_foodbridge_key_2026
   ```

3. Run the development server:
   ```bash
   npm start
   ```

4. Open `http://localhost:3000` in your browser.

---

## 🌐 Step 4: Deploy to Vercel

1. **Push Changes to GitHub**:
   ```bash
   git add .
   git commit -m "Connect FoodBridge to Supabase and prepare for Vercel deployment"
   git push origin main
   ```

2. **Import Repository in Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/new).
   - Select **Import Git Repository** and select `Food-Bridge`.

3. **Configure Environment Variables in Vercel**:
   - Before clicking Deploy, expand **Environment Variables**.
   - Add the following keys:
     - `DATABASE_URL` = `postgres://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
     - `SUPABASE_URL` = `https://[REF].supabase.co`
     - `SUPABASE_ANON_KEY` = `your_anon_key`
     - `JWT_SECRET` = `your_jwt_secret_key`
     - `EMAIL_USER` (Optional) = `your-email@gmail.com`
     - `EMAIL_PASSWORD` (Optional) = `your_gmail_app_password`

4. **Deploy**:
   - Click **Deploy**.
   - Vercel will build and launch your application serverlessly!
   - Your live website URL will be ready in seconds (e.g., `https://food-bridge.vercel.app`).

---

## 🛠 Features Enabled

- **Full PostgreSQL / Supabase Support**: Seamless interaction via `db.js` unified adapter.
- **Serverless Ready**: Automatic connection pooling optimized for Vercel Serverless Functions.
- **Audit Logging**: PL/pgSQL triggers automatically capture table changes.
- **Geolocation & Route Tracking**: Distance calculations and delivery tracking ready out-of-the-box.
