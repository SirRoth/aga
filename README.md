# Photo Box Portal

Temporary NFC photo upload and customer delivery portal built with Next.js, Supabase, and Google Drive.

## Local Setup

1. Install dependencies:

```powershell
npm install
```

2. Copy `.env.example` to `.env` and fill in Supabase and Google Drive credentials.

3. Run the Supabase migration in `supabase/migrations`.

4. Build and start:

```powershell
npm run build
npm run start
```

Open `http://localhost:3000/login`.
