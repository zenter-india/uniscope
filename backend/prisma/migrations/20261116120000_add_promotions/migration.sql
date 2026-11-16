-- UNI-58: admin promotions (popup message + optional https link + optional
-- wallet credit). Add-only: two new tables, nothing existing is touched.

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT,
    "audience" VARCHAR(16) NOT NULL,
    "link_url" VARCHAR(500),
    "link_label" VARCHAR(40),
    "aspirant_credit_minor" INTEGER NOT NULL DEFAULT 0,
    "mentor_credit_minor" INTEGER NOT NULL DEFAULT 0,
    "recipient_count" INTEGER NOT NULL,
    "credited_count" INTEGER NOT NULL DEFAULT 0,
    "sent_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_recipients" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "credited_minor" INTEGER NOT NULL DEFAULT 0,
    "seen_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotions_created_at_idx" ON "promotions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "promotion_recipients_user_id_seen_at_idx" ON "promotion_recipients"("user_id", "seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_recipients_promotion_id_user_id_key" ON "promotion_recipients"("promotion_id", "user_id");

-- AddForeignKey
ALTER TABLE "promotion_recipients" ADD CONSTRAINT "promotion_recipients_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security on, like every other table (see 20260911140000):
-- anon/authenticated get nothing; the backend connects as a role that bypasses it.
ALTER TABLE "promotions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "promotion_recipients" ENABLE ROW LEVEL SECURITY;
