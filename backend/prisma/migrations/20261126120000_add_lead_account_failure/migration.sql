-- Remember why creating an account from a website sign-up failed, and when, so
-- the admin "Account creation" page can show it instead of the failure only
-- living in the server log. Both columns are optional and add-only: existing
-- rows get NULL, and the currently deployed code never reads or writes them.
ALTER TABLE "enrollment_leads"
  ADD COLUMN "account_failure_reason" VARCHAR(300),
  ADD COLUMN "account_failed_at" TIMESTAMPTZ;
