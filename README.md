# TempDrive ☁️

TempDrive is a sleek, moderately scalable, and self-hosted file hosting web application and API platform, built as a lightweight alternative to services like Google Drive or Mega.nz. It offers secure file storage, nested folder organization, and a premium glassmorphism interface.

## 🌟 Features

- **Secure Authentication**: Credential-based login system utilizing `next-auth` with bcrypt password hashing.
- **Nested Folder Structure**: Organize your files effortlessly with unlimited nested folders and breadcrumb navigation.
- **High-Performance Storage**: Files are saved directly to the host machine's local disk (bypassing database blob storage limits) allowing for files up to 500MB each.
- **Drag & Drop Uploads**: A sleek, interactive upload zone with real-time progress indicators.
- **Responsive UI**: Custom CSS module design featuring a dark-mode glassmorphism aesthetic, micro-animations, and dynamic icons based on MIME types.
- **RESTful APIs**: Fully functional programmatic access for external integrations to upload, download, list, and delete files.

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React, Vanilla CSS.
- **Backend**: Next.js Server Actions & API Routes, Node.js.
- **Database (Metadata)**: SQLite via Prisma ORM (`better-sqlite3` adapter).
- **Storage**: Local File System (`fs/promises`).
- **Auth**: NextAuth.js v5.

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js (v18+) and npm installed on your machine.

### Installation

1. **Navigate to the project directory:**
   ```bash
   cd tempdrive
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up the Database:**
   Prisma will automatically use the `dev.db` SQLite database in the root folder. If you need to reset the schema, you can run:
   ```bash
   npx prisma migrate dev
   ```

4. **Environment Variables:**
   A `.env` file should already be present. Ensure it contains the following:
   ```env
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET="your-super-secret-key-change-in-production-please"
   NEXTAUTH_URL="http://localhost:3000"
   ```

### Running Locally

To start the development server:

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:3000`. You will be redirected to the login page where you can create a new account to get started.

## 🗄️ Where are my files?

The SQLite database (`dev.db`) only stores the metadata for your files (names, sizes, upload dates, and folder associations) to keep queries lightning fast. 

The actual raw files you upload are stored directly on your computer's hard drive at:
```
/tempdrive/data/uploads/
```
They are saved with unique UUID names to prevent overwriting files with the same original name. When a file or folder is deleted via the web app, the backend automatically cleans up the raw file from the disk to prevent orphaned storage.

## 🏗️ Production Deployment

When deploying to production, make sure to:
1. Change the `NEXTAUTH_SECRET` in your `.env` to a strong, randomly generated string.
2. Update the `NEXTAUTH_URL` to match your production domain.
3. Build and start the app:
   ```bash
   npm run build
   npm run start
   ```

---
*Built with ❤️ using Next.js and Prisma.*
