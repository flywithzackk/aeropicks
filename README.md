# Aeropicks

A betting platform for hot air balloon competition. Pick your pilots, drop your marks.

Built 100% on Netlify — React frontend, Identity for auth, Blobs for storage, Functions for backend.

## What's inside

- React + Vite frontend (bright multi-color aesthetic, Bebas Neue + Plus Jakarta Sans)
- Netlify Identity for signup/signin/password reset
- Netlify Blobs for storing competitions, competitors, odds, bets, balances
- Netlify Functions for all server logic
- Excel/CSV import for competitor rosters (drag & drop)
- Watchmefly.net scraper (targets `?v=pp` pilot pages, format-aware)
- One-click "Seed Rio Grande Classic 2026" button (loads 31 pilots instantly)
- Admin console — competitions, competitors/odds, users

## Project structure

```
aeropicks/
├── index.html
├── netlify.toml
├── package.json
├── vite.config.js
├── public/
│   └── aeropicks-logo.png
├── src/
│   ├── main.jsx                # React entry
│   ├── App.jsx                 # Routes + nav (Aeropicks branding)
│   ├── lib/
│   │   ├── auth.jsx            # Netlify Identity context
│   │   └── toast.jsx           # Toast notifications
│   ├── pages/
│   │   ├── Landing.jsx         # Logged-out landing
│   │   ├── Home.jsx            # Competition list
│   │   ├── Competition.jsx     # Place wagers
│   │   ├── MyBets.jsx          # Open wagers ledger
│   │   └── Admin.jsx           # Admin console (3 tabs)
│   └── styles/
│       └── main.css            # Aeropicks dark theme
└── netlify/functions/
    ├── _shared.js
    ├── competitions.js
    ├── competitors.js
    ├── bets.js
    ├── balance.js
    ├── users.js
    ├── import-watchmefly.js    # Watchmefly scraper (Rio Grande Classic-tested)
    └── seed-rgc.js             # One-shot RGC 2026 pre-loaded seed
```

## Setup

### 1. Push to GitHub & connect to Netlify

- Push the unzipped folder to a GitHub repo
- In Netlify dashboard → **Add new site** → **Import from Git** → pick your repo
- Build settings auto-detected from `netlify.toml`

### 2. Enable Netlify Identity

- Site dashboard → **Integrations** → **Identity** → **Enable Identity**
- Registration: **Open** (anyone can sign up — they automatically get 1000 points) or **Invite only** if you want gated access
- Email confirmation can stay on or off, your call

### 3. Netlify Blobs

- Enabled by default on every Netlify site. Functions read/write to it immediately, no setup.

### 4. Make yourself admin (after signing up)

- Netlify dashboard → **Identity** tab → click your user
- Under **Roles** add `admin`
- Sign out & back in — Admin link appears in nav

### 5. (Optional) Personal Access Token for full user management

The admin "Users" tab can list all users, reset passwords from the dashboard, etc. — but only if you provide a Personal Access Token:

- Go to https://app.netlify.com/user/applications#personal-access-tokens
- Create a new token (name it "aeropicks-identity-admin")
- In your site → **Site configuration** → **Environment variables**:
  - Key: `NETLIFY_IDENTITY_TOKEN`
  - Value: (paste token)
- Redeploy

Without the token the rest of the app still works perfectly. You can manage users from the Netlify Identity tab directly.

## Local development

```bash
npm install
npm install -g netlify-cli
netlify login
netlify link
netlify dev
```

Must use `netlify dev` (not just `vite`) — it proxies functions, Identity, and Blobs together on http://localhost:8888.

## Loading the Rio Grande Classic 2026

Three options, in order of speed:

1. **One-click seed (easiest):** Admin → Competitions tab → top of page, click **"Seed Now"**. All 31 pilots loaded, status set live.
2. **Watchmefly URL import:** Admin → Competitors & Odds → "Pull from Watchmefly" → paste `https://watchmefly.net/events/event.php?e=rgc2026&v=pp`.
3. **Excel upload:** Drop the `rio-grande-classic-pilots.xlsx` (Number, Name, Country, Balloon columns).

After loading, set odds per pilot inline in the table (type the odds, click away, auto-saves).

## Member flow

1. Sign up → 1000 points credited
2. Browse competitions
3. Click into one, allocate points across pilots (sticky wager bar shows total + remaining)
4. Hit "Place Wagers"
5. View "My Bets" anytime

## Excel format

Header names are case-insensitive. Only `Name` is required:

| Number | Name | Country | Balloon |
|--------|------|---------|---------|
| 1 | BLOOM, Cory | United States | |
| 2 | HEARTSILL, Joe | United States | Texas Racer |

## What's next

Suggested additions:
- Results entry screen (admin picks winners → balances auto-credit)
- Leaderboards (per-competition and global)
- Bet history with W/L once results posted
- Per-competition lock times (auto-lock instead of manual)
- Email notifications on betting open / lock / results
- Multi-task scoring (balloon competitions usually have multiple tasks across days — could weight bets per task)
