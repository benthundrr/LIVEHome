#!/usr/bin/env bash
# Confirm the GitHub Pages Jekyll build copied the IndexNow key file unchanged
# and still published the existing static pages.
set -euo pipefail

mapfile -t matches < <(find . -maxdepth 1 -type f -regextype posix-extended -regex './[0-9a-f]{32}\.txt' | sort)

if [[ ${#matches[@]} -ne 1 ]]; then
  echo "Expected exactly one 32-hex IndexNow key file in the repo root, found ${#matches[@]}"
  if [[ ${#matches[@]} -gt 0 ]]; then
    printf '  %s\n' "${matches[@]}"
  fi
  exit 1
fi

key_file=${matches[0]}
key=$(basename "$key_file" .txt)
bytes=$(wc -c < "$key_file" | tr -d ' ')

if [[ "$bytes" -ne 32 ]]; then
  echo "Key file is ${bytes} bytes; expected exactly 32"
  exit 1
fi

expected=$(mktemp)
printf '%s' "$key" > "$expected"
if ! cmp -s "$key_file" "$expected"; then
  echo "Source key file is not exactly the key"
  exit 1
fi
rm -f "$expected"
echo "Source key file ${key}.txt is exactly 32 hex characters"

published="_site/${key}.txt"
if [[ ! -f "$published" ]]; then
  echo "Jekyll did not publish ${key}.txt"
  find _site -maxdepth 2 -type f | sort | head -80
  exit 1
fi

if ! cmp -s "$key_file" "$published"; then
  echo "Published key file differs from the source file"
  echo "source:"
  od -An -tx1 "$key_file"
  echo "published:"
  od -An -tx1 "$published"
  exit 1
fi
echo "Jekyll published ${key}.txt unchanged"

for static in index.html join/index.html CNAME robots.txt 404.html; do
  if ! cmp -s "$static" "_site/${static}"; then
    echo "Jekyll changed static file ${static}"
    exit 1
  fi
done
echo "Homepage, /join, CNAME, robots.txt and 404.html were copied unchanged"

if [[ "$(tr -d '[:space:]' < _site/CNAME)" != "www.thundrr.co" ]]; then
  echo "CNAME is not www.thundrr.co"
  exit 1
fi

for url in \
  "https://www.thundrr.co/" \
  "https://www.thundrr.co/join" \
  "https://www.thundrr.co/blog/"
do
  if ! grep -F -q "<loc>${url}</loc>" _site/sitemap.xml; then
    echo "Built sitemap is missing ${url}"
    exit 1
  fi
done

if grep -F -q "$key" _site/sitemap.xml; then
  echo "Built sitemap includes the IndexNow key"
  exit 1
fi

if [[ ! -f _site/blog/index.html ]]; then
  echo "Guides index was not built"
  exit 1
fi

echo "Sitemap still lists the homepage, /join and /blog/"
