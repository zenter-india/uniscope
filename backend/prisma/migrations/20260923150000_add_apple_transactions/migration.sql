-- Apple IAP top-up audit trail — see the AppleTransaction doc comment in
-- schema.prisma. Not the source of truth for crediting (LedgerEntry's own
-- idempotencyKey stays that); this backs replay-awareness for a
-- REFUND/REVOKE notification that predates a successful credit, and the
-- refund-clawback audit trail (REFUND_PENDING_MANUAL rows are what an admin
-- reconciles by hand when a clawback can't be covered by the current
-- wallet balance).

-- CreateEnum
CREATE TYPE "AppleTransactionStatus" AS ENUM ('CREDITED', 'REFUNDED', 'REFUND_PENDING_MANUAL', 'REVOKED');

-- CreateTable
CREATE TABLE "apple_transactions" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "original_transaction_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "credited_amount_minor" INTEGER NOT NULL,
    "status" "AppleTransactionStatus" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "apple_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apple_transactions_transaction_id_key" ON "apple_transactions"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "apple_transactions_idempotency_key_key" ON "apple_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "apple_transactions_user_id_idx" ON "apple_transactions"("user_id");

-- AddForeignKey
ALTER TABLE "apple_transactions" ADD CONSTRAINT "apple_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every other public table has RLS enabled (see 20260911140000_enable_rls_all_tables)
-- as a deny-by-default backstop against a future accidental anon/authenticated
-- grant — this new table follows the same convention from day one.
ALTER TABLE "apple_transactions" ENABLE ROW LEVEL SECURITY;
