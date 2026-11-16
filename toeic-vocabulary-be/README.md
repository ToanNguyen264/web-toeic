# TOEIC Vocabulary Backend

REST API cho đăng ký/đăng nhập, quản lý từ vựng cá nhân, audio tải lên và tạo audio phát âm bằng ElevenLabs. Backend dùng Express, TypeScript, Prisma ORM 7 và MySQL 8. Audio được lưu trong thư mục/volume riêng; MySQL chỉ lưu đường dẫn và metadata.

## Chạy local

1. Chỉnh `toeic-vocabulary-be/.env` nếu cần thay thông tin MySQL, JWT hoặc ElevenLabs.
2. Cài package: `npm install`.
3. Sinh Prisma Client: `npm run prisma:generate`.
4. Áp dụng migration: `npm run prisma:migrate:deploy`.
5. Chạy dev: `npm run dev`.

API mặc định ở `http://localhost:3000/api`; hợp đồng đầy đủ nằm tại [docs/openapi.yaml](docs/openapi.yaml).

Các biến `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` và `ELEVENLABS_MODEL_ID` cấu hình tính năng `POST /api/ai/audio`. Không đưa API key sang biến `VITE_*` vì các biến đó có thể xuất hiện trong mã frontend.

## Kiểm tra

- `npm run lint`
- `npm run build`
- `npm audit`

Không có xác minh email trong MVP. Access token tồn tại ngắn hạn trong bộ nhớ frontend; refresh token được xoay vòng bằng HttpOnly cookie và bản băm của nó được lưu trong MySQL.

