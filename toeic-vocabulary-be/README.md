# TOEIC Vocabulary Backend

REST API cho đăng ký/đăng nhập, quản lý từ vựng cá nhân và audio. Backend dùng Express, TypeScript, Prisma ORM 7 và MySQL 8. Audio được lưu trong thư mục/volume riêng; MySQL chỉ lưu đường dẫn và metadata.

## Chạy local

1. Sao chép `.env.example` thành `.env` và sửa thông tin MySQL/secrets.
2. Cài package: `npm install`.
3. Sinh Prisma Client: `npm run prisma:generate`.
4. Áp dụng migration: `npm run prisma:migrate:deploy`.
5. Chạy dev: `npm run dev`.

API mặc định ở `http://localhost:3000/api`; hợp đồng đầy đủ nằm tại [docs/openapi.yaml](docs/openapi.yaml).

## Kiểm tra

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm audit`

Không có xác minh email trong MVP. Access token tồn tại ngắn hạn trong bộ nhớ frontend; refresh token được xoay vòng bằng HttpOnly cookie và bản băm của nó được lưu trong MySQL.

