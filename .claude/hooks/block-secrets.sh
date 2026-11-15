#!/usr/bin/env bash
# UserPromptSubmit hook: refuse any prompt that looks like it carries a
# credential, so secrets never land in a Claude chat transcript. Secrets
# belong in Railway / Vercel variables or a local, gitignored .env file.
# The matched value is never echoed back.

input=$(cat)
if command -v jq >/dev/null 2>&1; then
  prompt=$(printf '%s' "$input" | jq -r '.prompt // ""')
else
  prompt=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("prompt",""))')
fi

# Credential-shaped values (these never appear in normal code or prose).
patterns=(
  'rzp_(live|test)_[A-Za-z0-9]{8,}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'AKIA[0-9A-Z]{16}'
  'gh[pousr]_[A-Za-z0-9]{30,}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'sk_(live|test)_[A-Za-z0-9]{16,}'
  'eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
  'postgres(ql)?://[^:@/ ]+:[^@ <\[]{6,}@'
  'https://[0-9a-f]{20,}@[a-z0-9.]*sentry\.io'
)

# "name = value" assignments. Code that merely READS a secret
# (process.env.X, config.get(...), os.environ[...], request.headers...) is
# not a leak, so those are filtered out before deciding.
assign='(key_secret|secret_key|api_secret|client_secret|webhook_secret|auth_token|access_token|auth_key|private_key|service_role_key|password)[a-z0-9_]*["'"'"' ]*[:=][ "'"'"']*[^ <>{}"'"'"'$]{8,}'
coderef='[:=][ "'"'"']*(process\.|os\.|config\.|cfg\.|env[.\[]|request\.|req\.|this\.|self\.|settings\.|getenv|secrets\.|vars\.|system\.|headers?\.)'

leaked=0
for p in "${patterns[@]}"; do
  if printf '%s' "$prompt" | grep -qiE -- "$p"; then leaked=1; break; fi
done
if [ "$leaked" -eq 0 ] && printf '%s' "$prompt" | grep -oiE -- "$assign" | grep -viE -- "$coderef" | grep -q .; then
  leaked=1
fi

if [ "$leaked" -eq 1 ]; then
  reason='Blocked: this message looks like it contains a secret (API key, token, password or private key). Do not paste credentials into Claude. Put them in Railway (Uniscope Mobile > uniscope service > staging/production variables), Vercel project settings, or your local gitignored .env file, then tell Claude only the variable NAME. If a real secret was pasted anywhere, rotate it.'
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg r "$reason" '{decision: "block", reason: $r}'
  else
    python3 -c 'import json,sys; print(json.dumps({"decision":"block","reason":sys.argv[1]}))' "$reason"
  fi
fi
exit 0
