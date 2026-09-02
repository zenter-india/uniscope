-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "client_message_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_channel_id_client_message_id_key" ON "chat_messages"("channel_id", "client_message_id");
