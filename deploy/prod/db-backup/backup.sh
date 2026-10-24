#!/bin/sh
set -eu -o pipefail

: "${S3_BUCKET:?S3_BUCKET is required}"

key="pharm-db/$(date +%Y/%m)/${PGDATABASE}-$(date +%Y%m%d-%H%M%S).dump"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

echo "[backup] $(date -Iseconds) dumping ${PGDATABASE}"
pg_dump --format=custom > "$tmp"
pg_restore --list "$tmp" > /dev/null

echo "[backup] $(date -Iseconds) uploading $(du -h "$tmp" | cut -f1) -> s3://${S3_BUCKET}/${key}"
aws s3 cp --only-show-errors "$tmp" "s3://${S3_BUCKET}/${key}"
echo "[backup] $(date -Iseconds) done"
