# ScoreTrak

Clean restart of the frontend using Next.js + GitHub + Vercel, while reusing the existing Supabase backend.

## Roles
- GitHub: source code and version history
- Vercel: hosting and automatic deployment
- Supabase: database, authentication, permissions and realtime updates

## Routes
- `/` public live scores
- `/report` reporter scoring console
- `/admin` admin dashboard

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Put your existing Supabase Project URL and publishable key into `.env.local`.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

## GitHub
Create a new empty repository called `gaa-scorehub` and upload/push the contents of this folder.
Do NOT upload `.env.local`.

## Vercel
1. Sign into Vercel.
2. Add New Project and import the GitHub repository.
3. Add these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy.

Vercel will detect Next.js automatically.
