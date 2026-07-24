# Context & Architecture Overview
We are building a lightweight, short-term Web Portal for an NFC Photo Drop Box system.
The system acts as a temporary file delivery pipeline for events. Content is NOT stored long-term:
- Days 0-7: Active Event (Guests upload via NFC, Customer downloads via token).
- Days 8-14: Download Expired (Portal access disabled for customer, files backed up on Drive).
- Day 15+: Permanent Purge (Google Drive files deleted, Supabase event metadata wiped, customer slot recycled).

### Tech Stack:
- Framework: Next.js 14+ (App Router, TypeScript)
- Styling: Tailwind CSS, shadcn/ui
- Database & Auth: Supabase (PostgreSQL, Supabase Auth)
- Backend File Storage (Layer 2): Google Drive API v3 (via Service Account credentials in .env)
- Automation: Vercel Cron / Next.js Scheduled API Route for lifecycle cleanups

---

# Data Model (Supabase Schema)

1. `profiles` (Admin / Webmaster)
   - `id` (uuid, references auth.users)
   - `role` (enum: 'admin')

2. `customer_slots` (Recyclable event allocations)
   - `id` (uuid)
   - `slot_name` (text, e.g., "Box 01 / Slot A")
   - `storage_limit_bytes` (bigint, default 2GB = 2147483648)
   - `storage_used_bytes` (bigint, default 0)
   - `status` (enum: 'VACANT', 'ACTIVE', 'EXPIRED_GRACE')
   - `event_name` (text, nullable)
   - `upload_slug` (text, unique, nullable - used for NFC link)
   - `download_token` (text, unique, nullable - used for customer download link)
   - `gdrive_folder_id` (text, nullable)
   - `event_start_at` (timestamp, nullable)
   - `created_at` (timestamp)

3. `photos` (Temporary upload logs for size tracking)
   - `id` (uuid)
   - `slot_id` (uuid, references customer_slots.id)
   - `gdrive_file_id` (text)
   - `file_size_bytes` (bigint)
   - `uploaded_at` (timestamp)

---

# Key Functional Requirements

### 1. Webmaster Control Dashboard (`/admin`)
- Restricted strictly to `admin` users.
- View all Recyclable Customer Slots and their status (`VACANT`, `ACTIVE`, `EXPIRED_GRACE`).
- Provision a Slot for a new customer: Generates a new `upload_slug`, `download_token`, sets `event_start_at = NOW()`, creates a Google Drive subfolder, and sets status to `ACTIVE`.
- Capability to adjust storage limits (override default 2GB cap) per slot.
- Manual "Force Purge & Recycle" button to instantly wipe an event and reset a slot to `VACANT`.

### 2. Public NFC Guest Upload (`/u/[upload_slug]`)
- Mobile-first, unauthenticated route opened when tapping the physical NFC tag.
- Validates that `status == 'ACTIVE'` and `NOW() <= event_start_at + 7 days`.
- Checks if `storage_used_bytes < storage_limit_bytes`.
- Streams multi-file photo uploads directly to the assigned Google Drive folder via `/api/upload` endpoint using `.env` Service Account keys.
- Updates `storage_used_bytes` upon completion.

### 3. Customer Download Gallery (`/d/[download_token]`)
- Access route given to the customer.
- Validates that `NOW() <= event_start_at + 7 days`. If past 7 days, displays: *"This event download link has expired. Please contact support if you need access to backups."*
- If active: Renders responsive image gallery with "Download Selected" and "Download Zip" options streaming directly from Google Drive API.

### 4. Automated 14-Day Purge & Recycle API (`/api/cron/cleanup`)
- Protected by a secret `CRON_SECRET` header.
- Finds all slots where `event_start_at` is older than 7 days and updates status to `EXPIRED_GRACE`.
- Finds all slots where `event_start_at` is older than 14 days:
  1. Calls Google Drive API `files.delete` on the slot's subfolder (permanently deleting all contents).
  2. Deletes associated rows in `photos` table.
  3. Resets `customer_slots` row back to `VACANT`, clearing `upload_slug`, `download_token`, `gdrive_folder_id`, and resetting `storage_used_bytes = 0`.

---

# Google Drive Integration (`lib/gdrive.ts`)
Using `googleapis` package:
- `createEventFolder(folderName)`
- `uploadFileToFolder(folderId, fileStream, fileName, mimeType)`
- `deleteFolderAndContents(folderId)` -> Permanently deletes files to free up Drive quota instantly.
- `getDownloadStream(fileId)`

---

# Deliverables
1. Supabase database migration scripts including auto-recycling schema and RLS rules.
2. Next.js API endpoints for streaming uploads, proxying downloads, and running cron cleanup.
3. Responsive Tailwind UI for Admin Dashboard, NFC Upload Page, and Customer Download Gallery.