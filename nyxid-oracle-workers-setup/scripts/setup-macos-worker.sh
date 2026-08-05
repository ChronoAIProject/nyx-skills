#!/usr/bin/env bash
# Provision a NyxID Oracle CDP worker on macOS with URL-key tab isolation.
#
# Idempotent end-to-end setup: drops the bundled isolated worker into the user
# dir, ensures playwright-core, installs launchd agents for Chrome (optional)
# and the worker, then verifies. Never prints the worker token.
#
# Usage:
#   setup-macos-worker.sh --pool <slug> --slot <name> [options]
#
# Required:
#   --pool <slug>        NyxID oracle pool slug (e.g. chatgpt-pro-pool)
#   --slot <name>        Unique slot id for this worker on the pool
#                        (e.g. share_account_1). Drives label + key URL + marker.
#
# Token (one of):
#   --token-file <path>  Path to an existing worker-token file (nyx_owk_...)
#   (or) env NYXID_ORACLE_WORKER_TOKEN=nyx_owk_...   written to a 0600 file
#
# Optional:
#   --base-url <url>     Default https://nyx-api.chrono-ai.fun
#   --port <n>           Chrome CDP debug port. Default 9222.
#   --profile <dir>      Chrome profile dir. Default ~/.nyxid-chrome
#   --poll-ms <n>        Default 5000
#   --label <s>          Worker label override (default = slot)
#   --key-url <url>      Slot key URL override (default https://chatgpt.com/?nyx=<slot>)
#   --url-match <s>      Tab URL match override (default nyx=<slot>)
#   --marker <s>         Tab storage marker override (default <pool>-slot-<slot>)
#   --no-chrome-agent    Do NOT install a launchd agent for Chrome (you manage it)
#   --smoke              Run a fresh smoke test after setup (consumes one task)
set -euo pipefail

# ---- locate skill assets ---------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
WORKER_SRC="$SKILL_DIR/assets/worker-tab-isolated.mjs"

# ---- defaults --------------------------------------------------------------
BASE_URL="https://nyx-api.chrono-ai.fun"
PORT="9222"
PROFILE="$HOME/.nyxid-chrome"
POLL_MS="5000"
POOL=""; SLOT=""; TOKEN_FILE=""; LABEL=""; KEY_URL=""; URL_MATCH=""; MARKER=""
INSTALL_CHROME_AGENT=1; SMOKE=0

die(){ echo "ERROR: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --pool) POOL="$2"; shift 2;;
    --slot) SLOT="$2"; shift 2;;
    --token-file) TOKEN_FILE="$2"; shift 2;;
    --base-url) BASE_URL="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --profile) PROFILE="$2"; shift 2;;
    --poll-ms) POLL_MS="$2"; shift 2;;
    --label) LABEL="$2"; shift 2;;
    --key-url) KEY_URL="$2"; shift 2;;
    --url-match) URL_MATCH="$2"; shift 2;;
    --marker) MARKER="$2"; shift 2;;
    --no-chrome-agent) INSTALL_CHROME_AGENT=0; shift;;
    --smoke) SMOKE=1; shift;;
    *) die "unknown arg: $1";;
  esac
done

[ -n "$POOL" ] || die "--pool is required"
[ -n "$SLOT" ] || die "--slot is required"
[ -f "$WORKER_SRC" ] || die "bundled worker not found at $WORKER_SRC"

# derived slot params
LABEL="${LABEL:-$SLOT}"
KEY_URL="${KEY_URL:-https://chatgpt.com/?nyx=$SLOT}"
URL_MATCH="${URL_MATCH:-nyx=$SLOT}"
MARKER="${MARKER:-$POOL-slot-$SLOT}"

# ---- prerequisites ---------------------------------------------------------
command -v node >/dev/null || die "node not found (need Node 18+; e.g. brew install node)"
command -v nyxid >/dev/null || echo "WARN: nyxid CLI not on PATH — needed for verification/admin steps"
NODE_BIN="$(command -v node)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || CHROME="/Applications/Chromium.app/Contents/MacOS/Chromium"
[ -x "$CHROME" ] || die "Google Chrome / Chromium not found in /Applications"

# ---- resolve token (never printed) -----------------------------------------
if [ -n "$TOKEN_FILE" ] && [ -s "$TOKEN_FILE" ]; then
  :
elif [ -n "${NYXID_ORACLE_WORKER_TOKEN:-}" ]; then
  TOKEN_FILE="${TOKEN_FILE:-$HOME/.nyxid-oracle-token-$POOL}"
  ( umask 077; printf '%s' "$NYXID_ORACLE_WORKER_TOKEN" > "$TOKEN_FILE" )
  chmod 600 "$TOKEN_FILE"
  echo "worker token written to $TOKEN_FILE (0600, not displayed)"
else
  die "no token: pass --token-file <path> to an existing nyx_owk_ file, or set env NYXID_ORACLE_WORKER_TOKEN"
fi
[ -s "$TOKEN_FILE" ] || die "token file $TOKEN_FILE is empty"

# ---- dirs ------------------------------------------------------------------
APP="$HOME/Library/Application Support/NyxIDOracleWorkers"
LOGS="$HOME/Library/Logs/NyxIDOracleWorkers"
LA="$HOME/Library/LaunchAgents"
mkdir -p "$APP" "$LOGS" "$LA"

# ---- worker copy + playwright-core ----------------------------------------
cp "$WORKER_SRC" "$APP/worker-tab-isolated.mjs"
node --check "$APP/worker-tab-isolated.mjs" || die "bundled worker failed syntax check"

REPO_NM="$HOME/NyxID/integrations/oracle/cdp-worker/node_modules"
if [ ! -d "$APP/node_modules/playwright-core" ]; then
  if [ -d "$REPO_NM/playwright-core" ]; then
    ln -snf "$REPO_NM" "$APP/node_modules"
    echo "linked node_modules -> $REPO_NM"
  else
    echo "installing playwright-core (no browser download) …"
    [ -f "$APP/package.json" ] || printf '{\n  "name":"nyxid-oracle-worker","private":true,"type":"module",\n  "dependencies":{"playwright-core":"^1.49.0"}\n}\n' > "$APP/package.json"
    ( cd "$APP" && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund >/dev/null )
  fi
fi
[ -d "$APP/node_modules/playwright-core" ] || die "playwright-core unavailable in $APP/node_modules"

# ---- launchd: Chrome (optional) -------------------------------------------
CHROME_LABEL="com.nyxid.oracle.chrome.$PORT"
if [ "$INSTALL_CHROME_AGENT" = "1" ]; then
  cat > "$LA/$CHROME_LABEL.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$CHROME_LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$CHROME</string>
    <string>--remote-debugging-port=$PORT</string>
    <string>--user-data-dir=$PROFILE</string>
    <string>--no-first-run</string>
    <string>--no-default-browser-check</string>
    <string>https://chatgpt.com/</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOGS/chrome.$PORT.out.log</string>
  <key>StandardErrorPath</key><string>$LOGS/chrome.$PORT.err.log</string>
</dict></plist>
PLIST
  plutil -lint "$LA/$CHROME_LABEL.plist" >/dev/null
  if ! curl -fsS "http://localhost:$PORT/json/version" >/dev/null 2>&1; then
    launchctl unload "$LA/$CHROME_LABEL.plist" 2>/dev/null || true
    launchctl load -w "$LA/$CHROME_LABEL.plist"
    echo "launched Chrome on :$PORT (profile $PROFILE) — LOG IN TO CHATGPT in that window once"
  else
    echo "Chrome already reachable on :$PORT (left as-is)"
  fi
fi

# ---- launchd: worker -------------------------------------------------------
WORKER_PLIST_LABEL="com.nyxid.oracle.cdp-worker.$LABEL"
launchctl unload "$LA/$WORKER_PLIST_LABEL.plist" 2>/dev/null || true
cat > "$LA/$WORKER_PLIST_LABEL.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$WORKER_PLIST_LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$NODE_BIN</string>
    <string>$APP/worker-tab-isolated.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$APP</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NYXID_BASE_URL</key><string>$BASE_URL</string>
    <key>NYXID_WORKER_TOKEN_FILE</key><string>$TOKEN_FILE</string>
    <key>NYXID_WORKER_LABEL</key><string>$LABEL</string>
    <key>CHROME_CDP_URL</key><string>http://localhost:$PORT</string>
    <key>NYXID_POLL_MS</key><string>$POLL_MS</string>
    <key>NYXID_CHATGPT_TAB_KEY_URL</key><string>$KEY_URL</string>
    <key>NYXID_CHATGPT_TAB_URL_MATCH</key><string>$URL_MATCH</string>
    <key>NYXID_CHATGPT_TAB_STORAGE_MARKER</key><string>$MARKER</string>
    <key>NYXID_WORKER_SCRIPT_VERSION</key><string>cdp-1.3-url-key-image</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOGS/$LABEL.out.log</string>
  <key>StandardErrorPath</key><string>$LOGS/$LABEL.err.log</string>
</dict></plist>
PLIST
plutil -lint "$LA/$WORKER_PLIST_LABEL.plist" >/dev/null
launchctl load -w "$LA/$WORKER_PLIST_LABEL.plist"

# ---- verify ----------------------------------------------------------------
echo "waiting for worker to attach …"
for _ in $(seq 1 40); do
  tail -n 4 "$LOGS/$LABEL.out.log" 2>/dev/null | grep -q "attached. worker=$LABEL" && break
  sleep 1
done
tail -n 3 "$LOGS/$LABEL.out.log" 2>/dev/null || true

if command -v nyxid >/dev/null; then
  echo "=== pool status ==="
  nyxid oracle status "$POOL" --output json 2>&1 | \
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const d=JSON.parse(s);console.log("active:",JSON.stringify(d.active_workers));console.log("diagnosis:",d.diagnosis)}catch(e){console.log(s)}})' || true
fi

if [ "$SMOKE" = "1" ] && command -v nyxid >/dev/null; then
  echo "=== smoke test ==="
  OUT="$(nyxid oracle ask "$POOL" "please reply only: $LABEL url-key ok" --no-wait --output json 2>&1)"
  TID="$(printf '%s' "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).task_id||"")}catch(e){console.log("")}})')"
  echo "task_id=$TID"
  for _ in $(seq 1 40); do
    R="$(nyxid oracle result "$TID" --output json 2>/dev/null)"
    ST="$(printf '%s' "$R" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).status||"")}catch(e){console.log("")}})')"
    if [ "$ST" = "completed" ] || [ "$ST" = "failed" ]; then printf '%s\n' "$R"; break; fi
    sleep 5
  done
fi

cat <<SUMMARY

=== DONE ===
pool        : $POOL
worker_label: $LABEL          (script_version cdp-1.3-url-key-image)
slot key URL: $KEY_URL
url match   : $URL_MATCH
marker      : $MARKER
CDP         : http://localhost:$PORT   (profile $PROFILE)
token file  : $TOKEN_FILE   (not displayed)
worker plist: $LA/$WORKER_PLIST_LABEL.plist
chrome plist: $([ "$INSTALL_CHROME_AGENT" = 1 ] && echo "$LA/$CHROME_LABEL.plist" || echo "(not installed — you manage Chrome)")
logs        : $LOGS/$LABEL.out.log

Manage:
  launchctl kickstart -k gui/\$(id -u)/$WORKER_PLIST_LABEL   # restart worker
  tail -f "$LOGS/$LABEL.out.log"
SUMMARY
