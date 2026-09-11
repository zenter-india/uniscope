-- Enable Row Level Security on every public table, no policies added.
--
-- Context (full writeup: the "RLS Impact Analysis" artifact shared with the
-- user 2026-09-11; also see ai/SECURITY.md finding S-6): this app has never
-- used Supabase Auth or RLS -- it authenticates with its own phone-OTP+JWT
-- scheme, and the backend always connects with the service-role/postgres
-- role, which has rolbypassrls=true and is completely unaffected by this
-- migration (verified live before writing this).
--
-- Why this is safe to apply with zero policies: verified live that the
-- `anon` and `authenticated` Postgres roles currently have ZERO grants on
-- any of these tables (information_schema.role_table_grants), so the public
-- Supabase key already can't read or write anything here -- this migration
-- doesn't change current behavior, it closes the possibility of a *future*
-- accidental grant (e.g. a hands-on Supabase Studio table-editor session)
-- silently exposing a table with nothing left to stop it. RLS enabled with
-- no policies = deny-by-default for anon/authenticated, which is exactly
-- the desired backstop.
--
-- The only client-side use of the anon key anywhere in the app (mobile's
-- chat "new message" ping) is a Supabase Realtime Broadcast channel, which
-- doesn't read/write any table and isn't gated by table RLS at all -- so
-- it's unaffected by this change too.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blocked_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "broadcasts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_import_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollment_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "id_sequence_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentor_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payout_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_mentors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_universities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "technical_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "universities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_holds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;
