#!/bin/bash

TOKEN="$1"   # truyền token qua tham số dòng lệnh, xem lý do bên dưới
URL="https://api23387.tlgo.vn/api/AProduct/ProductLibarySearch"
OUTPUT="all_products.json"
TOTAL_PAGES=1767
PAGE_SIZE=15

if [ -z "$TOKEN" ]; then
  echo "Cách dùng: ./get_all_products.sh <TOKEN>"
  exit 1
fi

echo "[]" > "$OUTPUT"

for ((page=1; page<=TOTAL_PAGES; page++)); do
  echo "Đang lấy trang $page / $TOTAL_PAGES..."

  RESPONSE=$(curl -s "$URL" \
    -X POST \
    -H 'Accept: application/json, text/plain, */*' \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -H 'Origin: https://gpp.tlgo.vn' \
    -H 'Referer: https://gpp.tlgo.vn/' \
    --data-raw "{\"Search\":\"\",\"OptionType\":1,\"pageIndex\":$page,\"pageSize\":$PAGE_SIZE,\"IsViewInternal\":1,\"IsViewNational\":0}")

  # Kiểm tra StatusCode trước khi gộp, tránh gộp lỗi (401, 500...) vào file
  STATUS=$(echo "$RESPONSE" | jq -r '.StatusCode // empty')
  if [ "$STATUS" != "200" ]; then
    echo "  ⚠️  Lỗi ở trang $page: $(echo "$RESPONSE" | jq -r '.Message // "unknown error"')"
    echo "  Dừng lại. Token có thể đã hết hạn."
    break
  fi

  jq --argjson new "$RESPONSE" '. + $new.Data.DataSource' "$OUTPUT" > tmp.json && mv tmp.json "$OUTPUT"

  sleep 0.3
done

echo "Hoàn tất. Dữ liệu lưu tại $OUTPUT"