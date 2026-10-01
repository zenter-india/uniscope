-- Wallet-balance tamper detection.
--
-- Incident (2026-10-02): an aspirant's wallet carried a ₹450 (45000 minor)
-- balance with ZERO rows in ledger_entries -- no top-up, no admin
-- adjustment, no session settlement ever credited it -- and the row's
-- created_at/updated_at were identical, meaning the balance was already
-- nonzero the instant the row was inserted. A full audit (app ledger,
-- Railway backend logs, Supabase postgres_logs, pg_stat_statements) found
-- no trace of who or what set it, because:
--   (1) every legitimate credit path writes a ledger_entries row in the
--       same transaction -- a direct SQL edit doesn't;
--   (2) statement-level Postgres logging isn't enabled, so there's no raw
--       query-text history to recover;
--   (3) the live backend AND every human with direct DB access all
--       authenticate as the same `postgres` superuser role -- so even
--       Supabase's own infra logs (and pg_stat_statements, which has no
--       per-call timestamp/params anyway) could never have distinguished
--       "the app" from "a developer running SQL by hand."
--
-- This migration closes the DETECTION half of that gap -- not the
-- attribution half, which needs the backend to stop sharing the Postgres
-- superuser role with every human who has DB access (a separate,
-- higher-risk change: it touches the live backend's connection string/
-- grants, deliberately not bundled into this migration -- see CLAUDE.md).
--
-- From here on, any direct change to wallets.balance_minor -- including a
-- wallet inserted with a nonzero balance on day one, exactly like this
-- incident -- is logged to wallet_balance_audit and flagged
-- matched_ledger_entry = false whenever it doesn't land alongside a
-- ledger_entries row for the exact same delta within a few seconds (the
-- shape every real credit/debit path already follows). The
-- wallet_ledger_reconciliation view below surfaces every wallet whose
-- current balance doesn't reconcile against its own ledger history --
-- including this incident's wallet, today -- in one query instead of a
-- multi-tool forensic session.

-- CreateTable
CREATE TABLE "wallet_balance_audit" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "user_id" TEXT,
    "old_balance_minor" INTEGER NOT NULL,
    "new_balance_minor" INTEGER NOT NULL,
    "delta_minor" INTEGER NOT NULL,
    "changed_by" TEXT NOT NULL,
    "client_addr" TEXT,
    "application_name" TEXT,
    "txid" BIGINT NOT NULL,
    "matched_ledger_entry" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_balance_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_balance_audit_wallet_id_idx" ON "wallet_balance_audit"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_balance_audit_matched_ledger_entry_idx" ON "wallet_balance_audit"("matched_ledger_entry");

-- Deliberately no FK to wallets: this is an append-only audit log the app
-- never writes to directly, and it should survive even if a wallet row
-- were ever deleted (it never is today).

-- Logs every UPDATE that actually changes balance_minor. Checks for a
-- ledger_entries row carrying the exact same signed delta, inserted within
-- the last 10s, as a heuristic match -- not a cryptographic guarantee (a
-- coincidentally-equal, unrelated concurrent ledger write to the same
-- wallet within that window would false-positive as "matched"), but every
-- real WalletService code path writes both rows in one DB transaction
-- within milliseconds of each other, so this reliably separates the real
-- thing from a bare manual UPDATE.
CREATE OR REPLACE FUNCTION wallet_balance_audit_trigger_fn() RETURNS trigger AS $$
DECLARE
  v_matched BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM ledger_entries
    WHERE wallet_id = NEW.id
      AND amount_minor = (NEW.balance_minor - OLD.balance_minor)
      AND created_at >= now() - interval '10 seconds'
  ) INTO v_matched;

  INSERT INTO wallet_balance_audit (
    id, wallet_id, user_id, old_balance_minor, new_balance_minor, delta_minor,
    changed_by, client_addr, application_name, txid, matched_ledger_entry
  ) VALUES (
    gen_random_uuid()::text, NEW.id, NEW.user_id, OLD.balance_minor, NEW.balance_minor,
    NEW.balance_minor - OLD.balance_minor, current_user,
    inet_client_addr()::text, current_setting('application_name', true),
    txid_current(), v_matched
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_balance_audit_trigger
AFTER UPDATE OF "balance_minor" ON "wallets"
FOR EACH ROW
WHEN (NEW."balance_minor" IS DISTINCT FROM OLD."balance_minor")
EXECUTE FUNCTION wallet_balance_audit_trigger_fn();

-- A wallet is only ever created with balance 0 by the app (confirmed: 19/19
-- other recently-provisioned wallets checked during the incident audit all
-- started at 0) -- so ANY nonzero balance on insert is unconditionally
-- flagged unmatched, which is exactly this incident's own pattern.
CREATE OR REPLACE FUNCTION wallet_balance_audit_insert_trigger_fn() RETURNS trigger AS $$
BEGIN
  IF NEW.balance_minor != 0 THEN
    INSERT INTO wallet_balance_audit (
      id, wallet_id, user_id, old_balance_minor, new_balance_minor, delta_minor,
      changed_by, client_addr, application_name, txid, matched_ledger_entry
    ) VALUES (
      gen_random_uuid()::text, NEW.id, NEW.user_id, 0, NEW.balance_minor,
      NEW.balance_minor, current_user, inet_client_addr()::text,
      current_setting('application_name', true), txid_current(), false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_balance_audit_insert_trigger
AFTER INSERT ON "wallets"
FOR EACH ROW
EXECUTE FUNCTION wallet_balance_audit_insert_trigger_fn();

-- One-query answer to "does any wallet's balance disagree with its own
-- ledger history right now" -- deliberately a plain view, not a Prisma
-- model, since nothing in the app queries it; run it by hand (or wire a
-- scheduled check to it later) via:
--   SELECT * FROM wallet_ledger_reconciliation;
CREATE OR REPLACE VIEW wallet_ledger_reconciliation AS
SELECT
  w.id AS wallet_id,
  w.user_id,
  w.balance_minor,
  COALESCE(SUM(le.amount_minor), 0) AS ledger_sum_minor,
  w.balance_minor - COALESCE(SUM(le.amount_minor), 0) AS unexplained_minor
FROM wallets w
LEFT JOIN ledger_entries le ON le.wallet_id = w.id
GROUP BY w.id, w.user_id, w.balance_minor
HAVING w.balance_minor != COALESCE(SUM(le.amount_minor), 0);

-- Every other public table has RLS enabled (see 20260911140000_enable_rls_all_tables)
-- as a deny-by-default backstop against a future accidental anon/authenticated
-- grant -- this new table follows the same convention from day one.
ALTER TABLE "wallet_balance_audit" ENABLE ROW LEVEL SECURITY;
