
-- DropForeignKey
ALTER TABLE "chat_rooms" DROP CONSTRAINT "chat_rooms_initiator_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_rooms" DROP CONSTRAINT "chat_rooms_mentor_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_rooms" DROP CONSTRAINT "chat_rooms_university_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_room_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_id_fkey";

-- DropTable
DROP TABLE "chat_rooms";

-- DropTable
DROP TABLE "messages";

-- DropEnum
DROP TYPE "ChatRoomStatus";

-- DropEnum
DROP TYPE "ChatRoomType";

-- DropEnum
DROP TYPE "MediaType";

-- DropEnum
DROP TYPE "MessageType";

