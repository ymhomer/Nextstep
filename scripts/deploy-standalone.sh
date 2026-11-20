#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_ACCOUNT_ID:?Missing Cloudflare account ID}"
: "${CLOUDFLARE_API_TOKEN:?Missing Cloudflare API token}"

database=nextstep-pages-db
bucket=nextstep-pages-files
account_api="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID"

cloudflare_api() {
  curl --fail-with-body --silent --show-error \
    --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    --header 'Content-Type: application/json' "$@"
}

database_id=$(cloudflare_api "$account_api/d1/database?name=$database" | jq -r --arg name "$database" '.result[] | select(.name == $name) | .uuid')
if [[ -z "$database_id" ]]; then
  database_id=$(cloudflare_api --data "$(jq -nc --arg name "$database" '{name:$name}')" "$account_api/d1/database" | jq -er '.result.uuid')
fi

buckets=$(cloudflare_api "$account_api/r2/buckets")
if ! jq -e --arg name "$bucket" '.result.buckets | any(.name == $name)' <<< "$buckets" >/dev/null; then
  pnpm exec wrangler r2 bucket create "$bucket"
fi

config=dist/server/wrangler.json
jq --arg id "$database_id" --arg database "$database" --arg bucket "$bucket" '
  .name = "nextstep-api" |
  .topLevelName = .name |
  .workers_dev = true |
  del(.assets) |
  .d1_databases = [{binding:"DB", database_name:$database, database_id:$id, migrations_dir:"../../drizzle"}] |
  .r2_buckets = [{binding:"BUCKET", bucket_name:$bucket}]
' "$config" > "$config.tmp"
mv "$config.tmp" "$config"

pnpm exec wrangler d1 migrations apply "$database" --remote --config "$config"
pnpm exec wrangler deploy --config "$config"
