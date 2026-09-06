-- Call-request "When?" step: the aspirant may now offer the mentor TWO
-- preferred times instead of one. Second option stored here; same advisory
-- semantics as requested_for (nothing reserved, mentor still drives the
-- connect). Plain additive nullable column.
ALTER TABLE "sessions" ADD COLUMN "requested_for_alt" TIMESTAMPTZ;
