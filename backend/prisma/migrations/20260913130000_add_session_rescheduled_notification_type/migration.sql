-- Additive enum value for the new reschedule feature (SessionsService.reschedule)
-- -- either party can move an already-confirmed call to a new time, and the
-- other party is notified. Postgres requires ADD VALUE to run alone, not
-- alongside other DDL/DML in the same statement -- this migration does
-- nothing else.
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_RESCHEDULED';
