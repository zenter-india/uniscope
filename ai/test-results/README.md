# Test evidence records

Completed test result records live here, one file per execution.

## Naming

```
YYYY-MM-DD-<TEST-ID>-<platform>.md
```

Examples:

```
2026-08-20-CALL-001-android.md
2026-08-20-CALL-001-ios.md
2026-08-20-CALL-004-android.md
```

## How to add a record

1. Copy [`TEMPLATE.md`](TEMPLATE.md) to the new filename.
2. Fill in **every** field. Use `N/A` with a reason rather than deleting a
   field — a downstream AI diagnostic workflow expects a stable shape.
3. Attach or link evidence artefacts (screenshots, recordings, logs).
4. Commit the record alongside the change it validates.

## Rules

- **Never paste a secret** into a record — no tokens, keys, passwords, raw
  phone numbers, or decrypted real names. Redact as `<redacted>`.
- **PASS requires that every expected result was observed.** Not "mostly
  worked".
- **BLOCKED is a real, useful outcome.** "Could not run — only one device
  available" is worth recording.
- **A test with no record did not happen**, as far as this repository and any
  agent reading it are concerned.

## Current contents

None. **No test in `TEST_MATRIX.md` has recorded passing evidence yet** —
including the two-device audio call (`CALL_TEST.md`), which has never been
executed to completion.
