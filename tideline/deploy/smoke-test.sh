#!/usr/bin/env bash
# Checks from the OUTSIDE that a deployed Tideline answers the way Twilio and Locally need.
# Works for any host (Fly, VPS):
#
#   deploy/smoke-test.sh https://tideline-api.fly.dev https://tideline-web.fly.dev
#
# Exit code = number of failed checks. Nothing here needs credentials, and nothing mutates state.
set -u

API="${1:?usage: smoke-test.sh <api-url> <web-url>}"
WEB="${2:?usage: smoke-test.sh <api-url> <web-url>}"
API="${API%/}"
WEB="${WEB%/}"
failed=0

pass() { printf '  \033[32mok\033[0m    %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; failed=$((failed + 1)); }
warn() { printf '  \033[33mwarn\033[0m  %s\n' "$1"; }
status() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@"; }

echo "API $API"
[ "$(status "$API/health")" = 200 ] && pass "GET /health → 200" || fail "GET /health"
body=$(curl -s --max-time 15 "$API/ready")
case "$body" in *ready*) pass "GET /ready → $body (Postgres reachable)";; *) fail "GET /ready → ${body:-no response}";; esac
[ "$(status -X POST "$API/api/v1/telephony/twilio/incoming" -d 'CallSid=CA0&To=%2B15550000000')" = 403 ] \
  && pass "Twilio webhook reachable and rejects unsigned requests (403)" \
  || fail "Twilio webhook should answer 403 to an unsigned request"
# The media stream: Twilio needs the WebSocket upgrade to succeed through the platform's proxy.
ws=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 --http1.1 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' "$API/api/v1/telephony/twilio/media")
[ "$ws" = 101 ] && pass "WebSocket upgrade on the media path (101)" || fail "WebSocket upgrade on the media path → $ws"
cors=$(curl -s -D - -o /dev/null --max-time 15 -X OPTIONS "$API/api/v1/me" \
  -H "Origin: $WEB" -H 'Access-Control-Request-Method: PATCH' | tr -d '\r' | grep -i '^access-control-allow-')
case "$cors" in *"$WEB"*PATCH*|*PATCH*"$WEB"*) pass "CORS allows $WEB incl. PATCH";;
  *"$WEB"*) warn "CORS allows $WEB but not PATCH (Brain editor needs PR #2's CORS fix)";;
  *) fail "CORS does not allow $WEB — add it to CORS_ORIGINS";; esac

echo "Web $WEB"
[ "$(status "$WEB/")" = 200 ] && pass "GET / → 200" || fail "GET /"
[ "$(status "$WEB/sso")" = 200 ] && pass "GET /sso → 200 (SPA fallback for the Locally SSO bridge)" || fail "GET /sso"
csp=$(curl -s -D - -o /dev/null --max-time 15 "$WEB/" | tr -d '\r' | grep -i '^content-security-policy:')
case "$csp" in
  *frame-ancestors*localhost*) warn "frame-ancestors still localhost-only — set ALLOWED_FRAME_ANCESTORS to Locally's origin";;
  *frame-ancestors*) pass "${csp#*: }";;
  *) fail "no Content-Security-Policy frame-ancestors header";;
esac
# The API origin is baked into the JS bundle at build time; check the built asset.
asset=$(curl -s --max-time 15 "$WEB/" | grep -o 'src="/assets/[^"]*\.js"' | head -1 | cut -d'"' -f2)
if [ -n "$asset" ] && curl -s --max-time 15 "$WEB$asset" | grep -q "$API"; then
  pass "web bundle points at $API (VITE_API_URL)"
else
  fail "web bundle does not reference $API — rebuild with --build-arg VITE_API_URL=$API"
fi

echo
[ "$failed" = 0 ] && echo "All checks passed." || echo "$failed check(s) failed."
exit "$failed"
