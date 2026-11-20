# Personal time tracker — setup

The time tracker is installed under `time-tracker/docs/`. Existing root `index.html` is untouched.

## Important security and limitations
This repository is **public**. Yearly files in its root `data/` folder will be **publicly downloadable**. Their contents are encrypted with a password using Microsoft Office password-to-open encryption (via msoffcrypto-tool). Anyone can download the encrypted files and attempt an offline password attack. **For stronger confidentiality, move the Excel workflow and `data/` directory into a private GitHub repository** and set `DATA_REPO` to that private repository. Never reuse your login password as the Excel password. The Excel password is not an authentication method for the website.

GitHub Pages cannot authenticate or write to repositories. Supabase (external service) provides email/password login, a database and a secure Edge Function. Supabase free-tier availability and GitHub Actions limits are subject to provider policies. GitHub Actions exports are asynchronous; a successfully saved activity may not be reflected in Excel immediately. An automatic scheduled reconciliation runs daily to retry missed exports. Annual files are created only after the first activity for that year.

## 1. Enable your website
1. Merge the time tracker pull request.
2. In GitHub Settings > Pages, select `main` and `/ (root)` for the existing root website. The tracker lives at `https://rajtailorproject-create.github.io/my_ai_assistant/time-tracker/docs/`. Keep root `index.html` and the main site's Pages configuration intact.
3. Create a Supabase project (https://supabase.com). In Authentication settings, **disable self-service signups**, then create a single user in Authentication > Users. Copy that user's UUID. Turn on MFA if desired.
4. In Supabase SQL editor run `time-tracker/sql/setup.sql` after replacing `REPLACE_WITH_OWNER_UUID` with the owner's UUID. Check RLS remains enabled.
5. Edit `time-tracker/docs/config.js` with the Supabase project URL and **publishable** key. These are safe to expose, but **never** put a GitHub token, service-role key, or password in these files.

## 2. Secure backend
1. Install the Supabase CLI and deploy the `time-tracker/supabase/functions/log-activity/index.ts` function as `log-activity`. Copy `time-tracker/supabase/config.toml` into your Supabase project's configuration or deploy with JWT verification disabled (the function itself verifies the user's JWT and owner UUID).
2. Add these **Supabase Edge Function secrets** in its dashboard:
   - `PROJECT_URL`: project URL
   - `PUBLIC_API_KEY`: Supabase publishable key
   - `OWNER_USER_ID`: UUID of your single user
   - `ALLOWED_ORIGIN`: `https://rajtailorproject-create.github.io`
   - `DATA_REPO`: `rajtailorproject-create/my_ai_assistant`
   - `GITHUB_ACTIONS_TOKEN`: a fine-grained GitHub PAT limited to this repository, with **Actions: read and write**, stored server-side only
3. The endpoint enforces the origin, validates the login with Supabase `auth.getUser`, checks the owner UUID and saves through row-level security. **Origin alone is not authentication.** Deploy backend before attempting to save records.

## 3. Turn on Excel export
In GitHub **Settings > Secrets and variables > Actions**, create these four repository secrets:
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — the private Supabase service-role API key (legacy JWT format for this exporter)
- `OWNER_USER_ID` — your authenticated owner's UUID
- `EXCEL_PASSWORD` — a **unique random password at least 16 characters**, never placed in code or committed to Git; store it privately in a password manager

GitHub Actions must be enabled, and the workflow needs `contents: write` permission. On successful runs it creates encrypted workbooks `data/2026.xlsx`, `data/2027.xlsx`, etc. Download and open them in compatible Microsoft Excel with the Excel password. Libraries like openpyxl cannot read these files until decrypted. Changing the password re-encrypts every yearly workbook at the next successful run.

**Do not commit plaintext Excel files**, decrypted exports or passwords. If you previously committed unencrypted files, encryption now does not erase those copies from git history. Delete/rewrite that history or use a fresh private repository before storing sensitive records.

## 4. Check everything
1. Open the tracker URL and sign in with your single Supabase account.
2. Save one manual activity and check daily summary/history.
3. In Actions > Sync password-protected Excel, check the dispatched run completes. If not, check its logs. Saved entries persist in Supabase even if export fails.
4. Download the `data/YYYY.xlsx` file and check that Excel asks for the password. Verify the entries after unlocking.
5. Test a next-year date to confirm a new workbook is created.
6. Log out to check records are no longer visible.

**Note:** The GitHub Actions workflow exports to this repository's `data/` directory. If you later choose a private data repository, copy the workflow, exporter and requirements there and update the backend `DATA_REPO` secret accordingly.
