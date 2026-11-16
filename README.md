# TOEIC Vocabulary

Ứng dụng web lưu từ tiếng Anh, nghĩa tiếng Việt và audio phát âm theo từng tài khoản.

## Cấu trúc

- `toeic-vocabulary-fe`: React + Vite + TypeScript.
- `toeic-vocabulary-be`: Express + TypeScript + Prisma ORM.
- MySQL 8.4: lưu tài khoản, refresh token và metadata từ vựng/audio.
- Docker volume `toeic_vocabulary_audio_data`: lưu nội dung file audio riêng tư.

## Chạy toàn bộ bằng Docker

```powershell
docker compose up --build
```

Sau khi các service healthy:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api`
- MySQL trên máy host: `localhost:3307`

Có thể sao chép `.env.example` thành `.env` để thay mật khẩu MySQL, JWT secrets hoặc các cổng. Giá trị mặc định trong Compose chỉ dành cho phát triển local.

Tắt service nhưng giữ dữ liệu:

```powershell
docker compose down
```

Chỉ dùng `docker compose down -v` khi thực sự muốn xóa toàn bộ database, audio và dependencies trong volumes.

Hợp đồng API: [toeic-vocabulary-be/docs/openapi.yaml](toeic-vocabulary-be/docs/openapi.yaml).

