# Chạy Production

Các lệnh dưới đây chạy từ **thư mục gốc repo** trên server.

Stack production (`docker-compose.prod.yml`) gồm 4 service:

| Service     | Vai trò                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `web`       | Nginx phục vụ frontend, proxy `/v1/` sang backend                       |
| `backend`   | API Node.js; **tự chạy `prisma migrate deploy` mỗi lần khởi động**      |
| `postgres`  | PostgreSQL 16, dữ liệu nằm trong volume `prod_postgres_data`            |
| `db-backup` | Backup database lên S3 lúc 00:00 mỗi ngày (giờ `Asia/Ho_Chi_Minh`)      |

## 1. Chuẩn bị lần đầu

```bash
cp env/prod/prod.env.example env/prod/prod.env
# Sửa env/prod/prod.env: mật khẩu DB, JWT_SECRET, SMTP, S3, FRONTEND_URL...
```

- `env/prod/prod.env` đã nằm trong `.gitignore`. **Không commit file này.**
- `DATABASE_URL` phải trỏ tới host `postgres` (tên service), cùng user/password/db với `POSTGRES_*`.
- `JWT_SECRET` nên là chuỗi ngẫu nhiên dài, ví dụ tạo bằng `openssl rand -hex 32`.

## 2. Lệnh chính

Luôn truyền `--env-file`: Compose cần file này để điền `POSTGRES_*`, `APP_PORT`, `VITE_*` vào cấu hình. Thiếu nó, lệnh sẽ báo lỗi `POSTGRES_USER` trống.

```bash
# Đặt alias cho ngắn (có thể thêm vào ~/.bashrc hoặc ~/.zshrc)
alias dcp='docker compose -f docker-compose.prod.yml --env-file env/prod/prod.env'
```

| Việc cần làm                       | Lệnh                                  |
| ---------------------------------- | ------------------------------------- |
| Build và chạy (lần đầu / cập nhật) | `dcp up -d --build`                   |
| Xem trạng thái                     | `dcp ps`                              |
| Xem log tất cả                     | `dcp logs -f --tail=200`              |
| Xem log backend                    | `dcp logs -f --tail=200 backend`      |
| Khởi động lại backend              | `dcp restart backend`                 |
| Dừng (giữ nguyên dữ liệu)          | `dcp down`                            |

Không có alias thì viết đầy đủ, ví dụ:

```bash
docker compose -f docker-compose.prod.yml --env-file env/prod/prod.env up -d --build
```

## 3. Cập nhật phiên bản mới

```bash
git pull
dcp up -d --build
dcp logs -f --tail=100 backend   # kiểm tra migration chạy xong và server đã start
```

Migration mới được áp dụng tự động khi backend khởi động lại. Nên **backup trước** nếu bản cập nhật có migration xóa cột hoặc đổi dữ liệu (xem mục 5).

## 4. Truy cập

- App lắng nghe ở `127.0.0.1:${APP_PORT}` (mặc định `8080`). Cổng này chỉ mở trên chính server.
- Muốn truy cập từ ngoài, cần đặt reverse proxy có HTTPS (Nginx/Caddy trên host) trỏ vào cổng đó. Cookie refresh token yêu cầu HTTPS.

## 5. Backup và khôi phục

```bash
# Chạy backup ngay (ngoài lịch 00:00 hằng ngày)
dcp exec db-backup backup.sh

# Xem log backup
dcp logs --tail=50 db-backup
```

File backup được lưu ở `s3://$S3_BUCKET/pharm-db/<năm>/<tháng>/<db>-<thời gian>.dump`.

**Khôi phục** (ghi đè toàn bộ dữ liệu hiện tại, chỉ làm khi thật sự cần):

```bash
aws s3 cp s3://<bucket>/pharm-db/2026/10/<file>.dump ./restore.dump
dcp stop backend
dcp exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < restore.dump
dcp start backend
```

## 6. Những lệnh KHÔNG chạy trên production

| Lệnh                        | Lý do                                                                     |
| --------------------------- | ------------------------------------------------------------------------- |
| `dcp down -v`               | `-v` **xóa volume database**, mất toàn bộ dữ liệu                         |
| `npm test` trong backend    | Test reset database đang cấu hình                                         |
| `prisma migrate dev`/`reset`| Dành cho môi trường dev, có thể xóa dữ liệu                               |
| `npm run prisma:seed`       | Tạo tài khoản và dữ liệu mẫu với mật khẩu mặc định đã biết                |

## Môi trường dev (để so sánh)

```bash
docker compose -f docker-compose.dev.yml up --build
```
