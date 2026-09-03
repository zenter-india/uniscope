-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT,
    "audience" VARCHAR(16) NOT NULL,
    "recipient_count" INTEGER NOT NULL,
    "sent_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcasts_created_at_idx" ON "broadcasts"("created_at" DESC);
