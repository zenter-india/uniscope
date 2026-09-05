-- AUDIO_CALL "when to connect": the aspirant now picks Instant / a mentor
-- free-window / a custom slot at booking. Instant keeps today's behaviour
-- (NULL here); the other two store the concrete requested datetime.
-- Advisory only — no reservation, no reminder job, hold/no-show/billing
-- logic all unchanged. Plain additive nullable column.
ALTER TABLE "sessions" ADD COLUMN "requested_for" TIMESTAMPTZ;
