#!/usr/bin/env bash
# Backup every ArtStation image used on the site into images/image-backup/.
# Run locally (Git Bash / macOS / Linux) from the repo root:  bash tools/backup-artstation-images.sh
# Requires curl. Safe to re-run — it skips files already downloaded.
set -u
cd "$(dirname "$0")/.."
OUT="images/image-backup"
mkdir -p "$OUT"
ok=0; skip=0; fail=0
while IFS=$'\t' read -r name url; do
  [ -z "$name" ] && continue
  if [ -s "$OUT/$name" ]; then skip=$((skip+1)); continue; fi
  if curl -fsSL --retry 3 -o "$OUT/$name" "$url"; then
    echo "  ok  $name"; ok=$((ok+1))
  else
    echo "  FAIL $name  ($url)"; rm -f "$OUT/$name"; fail=$((fail+1))
  fi
done < tools/artstation-image-urls.txt
echo "Done. downloaded=$ok skipped=$skip failed=$fail  ->  $OUT"
