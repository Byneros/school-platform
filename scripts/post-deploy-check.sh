#!/usr/bin/env bash
set -u

if [ $# -lt 1 ]; then
  echo "Usage: $0 <api-base> [web-base]"
  echo "Optional env: LOGIN_EMAIL, LOGIN_PASSWORD"
  exit 2
fi

normalize_base() {
  local u="$1"
  u="${u%/}"
  echo "$u"
}

add_result() {
  local name="$1"
  local ok="$2"
  local detail="$3"
  results+=("$name|$ok|$detail")
}

results=()
api="$(normalize_base "$1")"
web=""
if [ $# -ge 2 ]; then
  web="$(normalize_base "$2")"
fi

printf "Running post-deploy checks for API: %s\n" "$api"
if [ -n "$web" ]; then
  printf "Web: %s\n" "$web"
fi

health="$(curl -fsS "$api/health" 2>/dev/null || true)"
if echo "$health" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
  add_result "/health" "true" "ok=true"
else
  add_result "/health" "false" "request failed or ok!=true"
fi

ready="$(curl -fsS "$api/ready" 2>/dev/null || true)"
if echo "$ready" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
  db="$(echo "$ready" | tr -d '\n' | sed -n 's/.*"db"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  redis="$(echo "$ready" | tr -d '\n' | sed -n 's/.*"redis"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  add_result "/ready" "true" "db=$db, redis=$redis"
else
  add_result "/ready" "false" "request failed or ok!=true"
fi

status="$(curl -s -o /dev/null -w "%{http_code}" "$api/api")"
if [ "$status" = "404" ]; then
  add_result "/api" "true" "404 expected"
else
  add_result "/api" "false" "unexpected status $status"
fi

if [ -n "$web" ]; then
  web_status="$(curl -s -o /dev/null -w "%{http_code}" "$web")"
  if [ "$web_status" -ge 200 ] && [ "$web_status" -lt 400 ]; then
    add_result "web root" "true" "status=$web_status"
  else
    add_result "web root" "false" "status=$web_status"
  fi

  headers="$(curl -s -o /dev/null -D - -X OPTIONS "$api/api/auth/login" -H "Origin: $web" -H "Access-Control-Request-Method: POST")"
  allow_origin="$(echo "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin" {print $2}' | tail -n 1)"
  if [ "$allow_origin" = "$web" ]; then
    add_result "cors preflight" "true" "allow-origin=$allow_origin"
  else
    if [ -n "$allow_origin" ]; then
      add_result "cors preflight" "false" "allow-origin=$allow_origin"
    else
      add_result "cors preflight" "false" "missing allow-origin"
    fi
  fi
fi

if [ -n "${LOGIN_EMAIL:-}" ] && [ -n "${LOGIN_PASSWORD:-}" ]; then
  payload=$(printf '{"email":"%s","password":"%s"}' "$LOGIN_EMAIL" "$LOGIN_PASSWORD")
  resp="$(curl -s -w "\n%{http_code}" -H "Content-Type: application/json" -d "$payload" "$api/api/auth/login")"
  code="$(printf "%s" "$resp" | tail -n 1)"
  body="$(printf "%s" "$resp" | sed '$d')"
  if [ "$code" = "200" ] && echo "$body" | grep -q '"token"'; then
    add_result "login" "true" "token issued"
  elif [ "$code" = "200" ] && echo "$body" | grep -q '"requiresTwoFactor"[[:space:]]*:[[:space:]]*true'; then
    add_result "login" "true" "2FA required"
  else
    add_result "login" "false" "unexpected response (status=$code)"
  fi
else
  add_result "login" "true" "skipped (set LOGIN_EMAIL/LOGIN_PASSWORD to test)"
fi

printf "\nResults:\n"
printf "%-18s %-5s %s\n" "Check" "Ok" "Detail"
failed=0
for r in "${results[@]}"; do
  IFS='|' read -r name ok detail <<< "$r"
  printf "%-18s %-5s %s\n" "$name" "$ok" "$detail"
  if [ "$ok" != "true" ]; then
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  printf "\nSome checks failed. Review the details above.\n"
  exit 1
fi

printf "\nAll checks passed.\n"
