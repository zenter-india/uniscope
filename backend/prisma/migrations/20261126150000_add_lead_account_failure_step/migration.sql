-- Remember at which step creating an account from a website sign-up stopped
-- ('account', 'document' or 'link'), next to the reason that is already saved,
-- so the admin "Account creation" page can say where it broke. Optional and
-- add-only: existing rows get NULL, and the currently deployed code never reads
-- or writes it.
ALTER TABLE "enrollment_leads"
  ADD COLUMN "account_failure_step" VARCHAR(20);
