-- AlterTable
ALTER TABLE "universities" ADD COLUMN     "stream" VARCHAR(50);

-- CreateIndex
CREATE INDEX "universities_stream_idx" ON "universities"("stream");
