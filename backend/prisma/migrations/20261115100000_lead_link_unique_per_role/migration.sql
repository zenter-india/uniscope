-- One account can now be linked by one lead per role instead of one lead in
-- total, so a person who signs up as an aspirant and later as a mentor (the
-- same account, upgraded) has both sign-up records pointing at it. The old
-- index made the second link fail, leaving the mentor with no linked account.
-- Every existing link is unique already, so the new index cannot be violated.
DROP INDEX "enrollment_leads_converted_user_id_key";

CREATE UNIQUE INDEX "enrollment_leads_role_converted_user_id_key" ON "enrollment_leads"("role", "converted_user_id");

CREATE INDEX "enrollment_leads_converted_user_id_idx" ON "enrollment_leads"("converted_user_id");
