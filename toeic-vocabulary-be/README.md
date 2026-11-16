# TOEIC Vocabulary Backend

REST API cho đăng ký/đăng nhập, quản lý từ vựng cá nhân, tạo câu ví dụ TOEIC bằng Gemini và tạo audio bằng ElevenLabs. Backend dùng Express, TypeScript, Prisma ORM 7 và MySQL 8. Audio được lưu trong thư mục/volume riêng; MySQL chỉ lưu đường dẫn và metadata.

## Chạy local

1. Chỉnh `toeic-vocabulary-be/.env` nếu cần thay thông tin MySQL, JWT hoặc ElevenLabs.
2. Cài package: `npm install`.
3. Sinh Prisma Client: `npm run prisma:generate`.
4. Áp dụng migration: `npm run prisma:migrate:deploy`.
5. Chạy dev: `npm run dev`.

API mặc định ở `http://localhost:3000/api`; hợp đồng đầy đủ nằm tại [docs/openapi.yaml](docs/openapi.yaml).

Các biến `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` và `ELEVENLABS_MODEL_ID` cấu hình giọng tiếng Anh. `ELEVENLABS_VI_VOICE_ID` và `ELEVENLABS_VI_MODEL_ID` cấu hình giọng tiếng Việt. Endpoint `POST /api/ai/example-audio` tạo riêng hai đoạn rồi ghép theo thứ tự Anh → nghỉ 1 giây → Việt. Việc ghép audio cần `ffmpeg`; Docker image đã cài sẵn. Không đưa API key sang biến `VITE_*` vì các biến đó có thể xuất hiện trong mã frontend.

Các biến `GEMINI_API_KEY` và `GEMINI_MODEL` cấu hình `POST /api/ai/example`. Gemini chỉ tạo nội dung; audio ví dụ song ngữ vẫn được ElevenLabs tạo qua `POST /api/ai/example-audio`.

`ADMIN_EMAIL` xác định tài khoản quản trị (mặc định `toan@gmail.com`). Quản trị viên có thể thay hai API key qua `GET/PUT /api/admin/ai-settings`; giá trị được mã hóa AES-256-GCM trong bảng `app_settings` và được ưu tiên hơn `.env`.

## Kiểm tra

- `npm run lint`
- `npm run build`
- `npm audit`

Không có xác minh email trong MVP. Access token tồn tại ngắn hạn trong bộ nhớ frontend; refresh token được xoay vòng bằng HttpOnly cookie và bản băm của nó được lưu trong MySQL.

