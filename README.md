# Inbox Assistant

A Gmail client that runs on your own machine and reads your mail for you. Every new email gets a category, a priority, a one-line summary, any deadline, and the things you need to do about it. You reply from a box under each email, or ask the assistant to write it.

**[Product page](https://khangchau12.github.io/Gmail-AI-Assistant/)** · [Tiếng Việt](README.vi.md)

- **Today.** One screen with a greeting, a large "ask your inbox" box, a tile for each category and the emails that need you.
- **Needs you.** Emails where someone is waiting for your reply or that the AI marked important, sorted by deadline. They leave the list once you reply from the app or archive them.
- **Reply in place.** Under every email: one-tap reply ideas, "write with AI" from your notes, a tone picker and Send.
- **Assistant.** A full-page chat that searches and reads your mail. Drafts appear in the chat as editable cards that you can re-tone and send. Conversations are saved.
- **Local and private.** Mail lives in a SQLite file in `data/`. No account, database or cloud service to set up.
- **Fast syncs.** After the first import, a sync downloads only new messages and mirrors read, starred, archived and deleted changes from Gmail.
- **Keyboard-first and bilingual.** `j`/`k`/`e`/`r`, `⌘K` and `⌘J`. Interface, summaries and AI replies come in English or Vietnamese, with dark and light themes.

---

## Requirements

- **Node.js 18.18 or newer** (20 or 22 LTS recommended). Check with `node -v`.
- **A Gmail or Google Workspace account with 2-Step Verification turned on.** You need this to create an App Password.
- **An OpenAI API key**, or a key for any OpenAI-compatible server (see [Using another model](#using-another-model)).

Gmail access uses IMAP/SMTP with an App Password, so you don't need a Google Cloud project or OAuth.

## Setup

### 1. Get the code and install dependencies

```bash
git clone https://github.com/KhangChau12/Gmail-AI-Assistant.git
cd Gmail-AI-Assistant
npm install
```

> `better-sqlite3` ships prebuilt binaries for common platforms. If `npm install` tries to compile it and fails, install your platform's build tools (Windows: "Desktop development with C++" from Visual Studio Build Tools; macOS: `xcode-select --install`), then run `npm install` again.

### 2. Create a Gmail App Password

1. Open <https://myaccount.google.com/security> and make sure **2-Step Verification** is on.
2. Go to <https://myaccount.google.com/apppasswords>.
3. Enter a name such as `Inbox Assistant` and click **Create**.
4. Copy the 16-character password. You can paste it with or without the spaces.

> **Workspace accounts (school or work):** an administrator may have disabled App Passwords. If the page says the setting is unavailable, ask your admin or use a personal Gmail account.

### 3. Get an OpenAI API key

Create a key at <https://platform.openai.com/api-keys>. With the default model `gpt-4o-mini`, processing a few hundred emails costs a few cents.

### 4. Configure `.env`

```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

Fill in the three required values:

```env
GMAIL_ADDRESS=you@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
OPENAI_API_KEY=sk-...
```

Optional settings:

| Variable | Default | What it does |
| --- | --- | --- |
| `YOUR_NAME` | — | Used in the greeting and to sign AI drafts. Without it, drafts end without a name. |
| `APP_LANGUAGE` | `vi` | Starting language (`vi` or `en`). Also sets the language of the starter categories. You can switch later in the app. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model for triage, the assistant and drafting. |
| `OPENAI_BASE_URL` | OpenAI | Any OpenAI-compatible endpoint. |
| `SYNC_INITIAL_LIMIT` | `200` | How many of the newest inbox messages the first sync imports. |
| `DATABASE_PATH` | `data/inbox.db` | Location of the SQLite file. |

### 5. Run it

```bash
npm run dev
```

Open <http://localhost:3000>. The first sync starts automatically and imports your newest `SYNC_INITIAL_LIMIT` messages. Summaries fill in while it runs, which takes about a minute for 200 emails. After that the app syncs every 5 minutes while the tab is open. You can also click the sync card at the bottom of the sidebar.

For everyday use, a production build is faster:

```bash
npm run build
npm start
```

If a required value is missing, the app shows a setup screen that names the missing variables instead of crashing.

## Using it

The sidebar has four places:
- **Today** (`/`) is the overview.
- **Inbox** (`/inbox`) is the list and reader. Add `?category=` to open one category, or `?view=action` for **Needs you**.
- **AI assistant** (`/assistant`) is the chat, with saved conversations.
- **Drafts** lists drafts saved by the composer.

| Key | Action |
| --- | --- |
| `j` / `k` (or `↓` / `↑`) | Next / previous email |
| `e` | Archive |
| `#` | Delete (move to Trash) |
| `s` | Star / unstar |
| `u` | Mark unread |
| `r` | Jump to the reply box |
| `c` | Compose |
| `/` | Search |
| `g` then `t` / `i` / `a` | Go to Today / Inbox / Needs you |
| `⌘K` / `Ctrl+K` | Command menu (actions, places, email search) |
| `⌘J` / `Ctrl+J` | Open the assistant |
| `⌘↵` / `Ctrl+Enter` | Send |
| `,` | Settings |

**Teaching categories.** Change an email's category with the pill in the reader toolbar. Future emails from that sender skip the AI classifier and go straight to that category. In **Settings → Categories** you can rename a category, pick its colour and icon, and edit the description the AI uses for sorting. After changing descriptions, click **Re-run AI on all emails**.

**Replying.** For emails that expect an answer, the reply box suggests three short replies. Clicking one has the AI write the full email. You can also type a rough note and press **Write with AI**. The expand button opens the full composer.

**Assistant.** Ask things like "who is waiting for my reply this week?", "any deadlines coming up?" or "draft a reply to the latest email from Linh". The assistant can search mail (full text, sender, category, dates, unread, needs you), read an email, count your inbox and write drafts. It can't send email: only you press Send.

## How it works

```
Gmail ─IMAP─▶ sync engine ─▶ SQLite (emails + FTS5 index) ◀─ API routes ◀─ React UI
                  │                                             │
                  └─▶ triage (1 LLM call / email) ──────────────┘
                                                   assistant (tool calling) ─▶ SQLite
```

**Sync** (`src/server/sync.ts`) runs one sync at a time. Several tabs or clicks join the run already in progress.

1. **Snapshot.** Fetches the UID and flags of every message in INBOX. This is only a few bytes per message.
2. **Fetch.** Downloads full messages only for UIDs above the last synced UID, in batches of 25. They are parsed with `mailparser`.
3. **Mirror.** Applies read/star changes from Gmail and hides messages that were archived or deleted in another client.
4. **Triage.** Sends one structured-output call per new email, 4 in parallel. It returns category, priority, summary, whether a reply is expected, a deadline and up to three action items. Triage state is stored per email, so an interrupted run resumes on the next sync.

If Gmail resets the folder's `UIDVALIDITY`, the local copy of that folder is rebuilt.

**Actions** such as read, star, archive and delete update SQLite first so the UI responds immediately. The IMAP command runs right after. If it fails, the next sync's snapshot restores the local copy to match Gmail.

**Search** uses SQLite FTS5 with diacritic folding, so `thong bao` matches `thông báo`.

**Schema changes** are numbered migrations in `src/server/db.ts`, applied automatically on start. Upgrading from an older version keeps your mail. The upgrade re-runs triage once, so expect one AI call per stored email.

### Project layout

```
src/
├── app/
│   ├── (app)/           Today (page.tsx), inbox/, assistant/ — share the sidebar layout
│   └── api/             JSON + streaming routes used by the UI
├── components/
│   ├── shell/           App shell: sidebar, global state, shortcuts, modals
│   ├── today/           Today page
│   ├── inbox/           Message list, reader, quick reply
│   └── assistant/       Chat page and editable draft cards
├── lib/                 Shared client code: types, i18n, formatting, category icons/colours
└── server/              Server-only code
    ├── db.ts            SQLite connection + migrations
    ├── repo.ts          All queries
    ├── mail.ts          IMAP / SMTP (imapflow, mailparser, nodemailer)
    ├── sync.ts          Sync pipeline
    ├── ai.ts            Triage, quick replies, draft writing
    └── assistant.ts     Tool-calling chat agent
site/                    Static product page, deployed to GitHub Pages
```

## Using another model

Any server that implements the OpenAI Chat Completions API with tool calling and JSON-schema output works:

```env
# Ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
OPENAI_MODEL=qwen2.5:14b
```

Small local models are noticeably worse at choosing tools in the assistant. Triage works well on most 7B+ models.

## Privacy

- Your mail is stored only in `data/inbox.db` on your machine. Delete that file to remove it.
- The subject, sender and first ~3,000 characters of each new email are sent to the model provider for triage. Assistant questions and the emails they reference are also sent. Point `OPENAI_BASE_URL` at a local model if that isn't acceptable.
- HTML emails are rendered in a sandboxed iframe with scripts disabled. Remote images still load, as they do in Gmail.
- The app has no login, because it is meant to run only on `localhost`. **Do not deploy the app to a public server.** Anyone who can reach it can read and send your mail. (The product page in `site/` is static and contains no app code or data.)

## Product page

`site/` is a plain HTML/CSS/JS page with no build step. `.github/workflows/pages.yml` publishes it to GitHub Pages whenever `site/` changes on `main`. One-time setup: in the repo, go to **Settings → Pages → Source** and choose **GitHub Actions**. To preview it locally, run `npx serve site` or open `site/index.html` directly.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Setup screen won't go away | Restart `npm run dev` after editing `.env`. Next.js reads it only at startup. |
| `Invalid credentials` / `AUTHENTICATIONFAILED` | Use the App Password, not your Google password. Generate a new one if unsure. |
| App Passwords page says "not available" | Turn on 2-Step Verification. Workspace admins can block App Passwords. |
| Sync stops with `429` / `401` | OpenAI quota or key problem. Emails stay queued and are triaged on the next sync. |
| Summaries in the wrong language | Change the language in Settings, then **Re-run AI on all emails**. |
| "Needs you" shows old emails or misses some | It holds unreplied emails that expect a reply or are important, with a deadline no more than 3 days past, or received in the last 14 days. Archive an email or reply from the app to clear it. |
| Start over from scratch | Stop the server and delete the `data/` folder. |
| Debug the assistant's tool calls | Start with `DEBUG_ASSISTANT=1 npm run dev`. |

## Scripts

```bash
npm run dev        # development server with hot reload
npm run build      # production build
npm start          # run the production build
npm run lint       # ESLint
npm run typecheck  # TypeScript, no emit
```
