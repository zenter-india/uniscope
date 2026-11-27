# SOP 06: Secrets and access

**Purpose:** keep keys and passwords out of chats, code and screens.
**Who:** everyone. **When:** always. Infrastructure secrets are owned by **Kiran**.

## The rule

**No one pastes a key, secret, token or password into a Claude chat, a Slack message, a ticket, a PR, a doc or a terminal command that echoes it.** That includes the key ID, the secret, and "just a test key". Refer to a secret **only by its variable name**, for example `RAZORPAY_KEY_SECRET`.

A project hook (`.claude/hooks/block-secrets.sh`) blocks prompts that look like credentials. If one gets through anyway, do not repeat it: treat it as exposed and rotate it.

## Where each secret goes
- **Backend and admin:** Railway, project "Uniscope Mobile", service `uniscope` or `admin`, environment `staging` or `production`, Variables.
- **Website:** Vercel, project Environment Variables (Preview or Production).
- **Local:** `backend/.env`, `admin/.env.local`, `web/.env.local` (gitignored). Variable names are listed in `backend/.env.example` and `admin/.env.example`. When you add or change a variable, update the matching `.env.example` in the same PR.
- **GitHub Actions:** repository Secrets (and Variables for non-secret values).
- **Mobile builds:** `--dart-define` values from the build machine's environment.

## How to set a secret without exposing it
1. Copy the value from the provider's page with its copy button.
2. Paste it **straight into the secret field** of the destination (Railway, Vercel or GitHub). Do not paste it into a terminal command or a chat.
3. Check that the secret's "updated" time changed. Make sure you edited the **right** secret (a key pasted into the wrong row is a real mistake that has happened).
4. Clear your clipboard.
5. To test a key, use the real system (a workflow run, a deploy) instead of typing the key into a command.

## If a secret is exposed
1. Revoke or delete it at the provider straight away.
2. Create a new one. Update every place that used the old one.
3. Remove it from shell history and scrollback.
4. Tell Kiran. Do not repeat the value to anyone.

## API keys: scope matters
Provider keys are often tied to an organization or workspace. A key scoped to the whole organization may be refused by APIs that need a workspace, and credit belongs to one organization. When a new key fails, check that it is in the right organization and workspace before making more keys.

## Getting access
Ask Kiran for the role you need, per tool. Access is per person. Never share a login. When someone leaves, Kiran removes their access and rotates anything they could see.

Last checked: 2026-11-28.
