#!/bin/zsh
# Watches GitHub CI for Oppiabot PRs and fires a macOS notification when a
# PR's checks settle. Exits once every watched PR has finished.

set -u

REPO="oppia/oppiabot"
PR_LIST="${1:-379,381}"
INTERVAL="${2:-60}"

TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null \
  | sed -n 's/^password=//p')

if [[ -z "$TOKEN" ]]; then
  echo "No GitHub credential found." >&2
  exit 1
fi

notify() {
  osascript -e "display notification \"$1\" with title \"$2\"" 2>/dev/null \
    || echo "[$(date +%H:%M:%S)] $2 - $1"
}

api() {
  curl -sS -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" "$1"
}

IFS=',' read -rA prs <<< "$PR_LIST"
declare -A settled
declare -A head_sha
for pr in "${prs[@]}"; do
  settled[$pr]="no"
  head_sha[$pr]=""
done

echo "Watching PRs $PR_LIST in $REPO, every ${INTERVAL}s. Ctrl-C to stop."

while true; do
  all_done="yes"
  for pr in "${prs[@]}"; do
    [[ "${settled[$pr]}" == "yes" ]] && continue

    if [[ -z "${head_sha[$pr]}" ]]; then
      head_sha[$pr]=$(api "https://api.github.com/repos/$REPO/pulls/$pr" \
        | python3 -c 'import json,sys;print(json.load(sys.stdin).get("head",{}).get("sha",""))' 2>/dev/null)
      if [[ -z "${head_sha[$pr]}" ]]; then
        all_done="no"
        continue
      fi
    fi

    state=$(api "https://api.github.com/repos/$REPO/commits/${head_sha[$pr]}/check-runs" \
      | python3 -c '
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("ERROR"); raise SystemExit
runs = d.get("check_runs") or []
if not runs:
    print("no-checks"); raise SystemExit
if any(r.get("status") != "completed" for r in runs):
    print("pending"); raise SystemExit
fails = [r for r in runs if (r.get("conclusion") or "") not in ("success","skipped","neutral")]
if fails:
    print("FAILING " + ", ".join(f"{r[chr(110)+chr(97)+chr(109)+chr(101)]}: {r[chr(99)+chr(111)+chr(110)+chr(99)+chr(108)+chr(117)+chr(115)+chr(105)+chr(111)+chr(110)]}" for r in fails[:3]))
    raise SystemExit
print("passing"); raise SystemExit
' 2>/dev/null)

    if [[ "$state" == "pending" ]]; then
      all_done="no"
    elif [[ "$state" == "passing" ]]; then
      settled[$pr]="yes"
      notify "All checks passed. Ready to review and approve." "Oppiabot PR #$pr"
    elif [[ "$state" == FAILING* ]]; then
      settled[$pr]="yes"
      notify "${state#FAILING }" "Oppiabot PR #$pr - checks failing"
    elif [[ "$state" == "no-checks" ]]; then
      settled[$pr]="yes"
      notify "No CI checks reported on this PR." "Oppiabot PR #$pr"
    elif [[ "$state" == "ERROR" ]]; then
      all_done="no"
    fi
  done

  [[ "$all_done" == "yes" ]] && {
    notify "All watched PRs have settled." "Oppiabot CI watcher"
    exit 0
  }
  sleep "$INTERVAL"
done