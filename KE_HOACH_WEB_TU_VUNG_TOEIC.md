# Kế hoạch chi tiết website TOEIC Vocabulary

## 1. Mục tiêu và phạm vi MVP

Website giúp mỗi người dùng tạo tài khoản, đăng nhập và quản lý kho từ vựng riêng gồm:

- Từ tiếng Anh.
- Nghĩa tiếng Việt.
- File audio phát âm tùy chọn, có thể nghe lại trực tiếp.

MVP không xác minh email, không quên mật khẩu, không đăng nhập mạng xã hội, không flashcard hoặc quiz. Ưu tiên là luồng: đăng ký/đăng nhập → thêm từ → tải audio → lưu MySQL → hiển thị → nghe lại.

## 2. Chức năng đã thống nhất

### Tài khoản

- Đăng ký bằng email và mật khẩu, đăng nhập ngay sau khi tạo tài khoản.
- Đăng nhập, đăng xuất và duy trì phiên khi tải lại trang.
- Mật khẩu được băm bằng bcrypt, không lưu dạng văn bản thuần.
- Mỗi tài khoản chỉ đọc/sửa/xóa dữ liệu của chính mình.

### Từ vựng

- Thêm, sửa, xóa từ tiếng Anh và nghĩa tiếng Việt.
- Tìm kiếm ở cả hai trường, sắp xếp từ mới nhất trước và phân trang.
- Kiểm tra từ tiếng Anh có khả năng trùng; người dùng vẫn được phép lưu nghĩa khác sau khi xác nhận.
- Giao diện responsive, có trạng thái tải, lỗi, rỗng và thông báo kết quả.

### Audio

- Audio không bắt buộc; hỗ trợ MP3, M4A, WAV, OGG và WebM, tối đa 5 MB.
- Nghe thử file trước khi lưu; nghe/phát dừng trong danh sách sau khi lưu.
- Thay hoặc xóa audio độc lập khi sửa từ.
- Backend kiểm tra MIME, dung lượng và magic bytes để ngăn file giả định dạng.
- Khi thay/xóa từ, file audio cũ được dọn khỏi storage.

## 3. Kiến trúc đã chọn

```text
Trình duyệt
  └── toeic-vocabulary-fe (React/Vite, cổng 5173)
        └── REST/JSON + multipart
              └── toeic-vocabulary-be (Express/TypeScript, cổng 3000)
                    ├── MySQL 8.4: users, refresh_tokens, vocabularies
                    └── Private audio volume: nội dung file audio
```

Dự án chia rõ hai thư mục frontend/backend. Không sử dụng Supabase. MySQL lưu dữ liệu nghiệp vụ và metadata audio; file audio nằm trong Docker named volume để database không phình to và việc stream file đơn giản hơn.

## 4. Cấu trúc thư mục

```text
web toeic/
├── docker-compose.yml
├── README.md
├── KE_HOACH_WEB_TU_VUNG_TOEIC.md
├── toeic-vocabulary-fe/
│   ├── .env
│   ├── src/
│   ├── Dockerfile
│   └── package.json
└── toeic-vocabulary-be/
    ├── .env
    ├── src/
    ├── prisma/
    ├── docs/openapi.yaml
    ├── Dockerfile
    └── package.json
```

## 5. Database schema

### `users`

- `id` UUID, khóa chính.
- `email` duy nhất.
- `password_hash`.
- `created_at`, `updated_at`.

### `refresh_tokens`

- `id`, `user_id`.
- `token_hash` duy nhất; không lưu refresh token thô.
- `expires_at`, `revoked_at`, `created_at`.

### `vocabularies`

- `id`, `user_id`.
- `english_word`, `normalized_word`, `vietnamese_meaning`.
- `audio_path`, `audio_name`, `audio_type`, `audio_size` có thể null.
- `created_at`, `updated_at`.
- Index theo người dùng/ngày tạo và người dùng/từ đã chuẩn hóa.

Quan hệ có cascade delete từ `users` tới refresh token và vocabulary.

## 6. Xác thực và bảo mật

- Access JWT sống ngắn (mặc định 15 phút), frontend chỉ giữ trong bộ nhớ.
- Refresh JWT 30 ngày nằm trong cookie `HttpOnly`, `SameSite=Lax`; production phải bật `Secure`.
- Mỗi lần refresh sẽ thu hồi token cũ và phát token mới.
- Mọi API vocabulary lấy `userId` từ access token, không tin `userId` do client gửi.
- Helmet, CORS có whitelist, giới hạn JSON và giới hạn upload.
- JWT secrets và mật khẩu database lấy từ environment, không commit `.env`.

## 7. Hợp đồng API

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/vocabularies`
- `GET /api/vocabularies/check-duplicate`
- `POST /api/vocabularies`
- `PUT /api/vocabularies/:id`
- `DELETE /api/vocabularies/:id`
- `GET /api/vocabularies/:id/audio`
- `POST /api/ai/audio`: tạo MP3 từ từ tiếng Anh bằng ElevenLabs; yêu cầu đăng nhập.

Chi tiết request, response và lỗi được duy trì tại `toeic-vocabulary-be/docs/openapi.yaml`.

## 8. Docker Compose

Compose tạo ba service:

- `frontend`: hot reload source React.
- `backend`: sinh Prisma Client, áp dụng migration rồi chạy Express hot reload.
- `mysql`: MySQL 8.4 có healthcheck.

Named volumes:

- `toeic_vocabulary_mysql_data`: dữ liệu MySQL.
- `toeic_vocabulary_audio_data`: file audio.
- `toeic_vocabulary_backend_node_modules` và `toeic_vocabulary_frontend_node_modules`: dependencies container.

Backend chỉ khởi động sau khi MySQL healthy; frontend chỉ khởi động sau khi backend healthy.

## 9. Tiêu chí hoàn thành

- Lint, TypeScript build và audit dependency đều đạt ở frontend/backend.
- Docker build và healthcheck đạt cho cả ba service.
- Kiểm thử thực tế được: đăng ký, đăng nhập, refresh, CRUD từ vựng, upload/phát/thay/xóa audio, tìm kiếm, kiểm tra trùng và đăng xuất.
- Có thể tạo audio AI, nghe thử rồi lưu bằng đúng luồng upload hiện có; API key chỉ tồn tại ở backend.
- Tài khoản thứ hai không thể đọc hay phát audio của tài khoản thứ nhất.
- Không còn file, dependency hoặc tài liệu Supabase/Nex Chat trong dự án.

## 10. Hướng phát triển sau MVP

- Quên/đặt lại mật khẩu và xác minh email.
- IPA, loại từ, ví dụ, chủ đề, gắn sao.
- Flashcard, spaced repetition và quiz.
- Object storage S3-compatible khi triển khai nhiều backend instance.
- Rate limiting, backup tự động, HTTPS và CI/CD cho production.

## 11. Nâng cấp audio AI bằng ElevenLabs

- Modal thêm/sửa từ vựng có nút tạo audio từ nội dung cột tiếng Anh.
- Frontend nhận MP3 dưới dạng blob, chuyển thành `File` để xem trước và tái sử dụng luồng lưu audio hiện có.
- Backend giữ `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` và model trong environment; không gửi khóa sang trình duyệt.
- Endpoint giới hạn văn bản 150 ký tự, timeout 15 giây, kiểm tra MIME/kích thước phản hồi và chuẩn hóa lỗi từ nhà cung cấp.
- Audio chỉ trở thành dữ liệu lâu dài sau khi người dùng bấm lưu từ vựng; vì vậy không cần đổi schema MySQL.

