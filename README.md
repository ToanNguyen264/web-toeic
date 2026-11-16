# TOEIC Vocabulary

Ứng dụng web lưu từ tiếng Anh, nghĩa tiếng Việt và audio phát âm theo từng tài khoản. Audio có thể tải lên hoặc tạo trực tiếp từ từ tiếng Anh bằng ElevenLabs.

## Cấu trúc

- `toeic-vocabulary-fe`: React + Vite + TypeScript.
- `toeic-vocabulary-be`: Express + TypeScript + Prisma ORM.
- MySQL 8.4: lưu tài khoản, refresh token và metadata từ vựng/audio.
- Docker volume `toeic_vocabulary_audio_data`: lưu nội dung file audio riêng tư.

## Chạy toàn bộ bằng Docker

```powershell
docker compose up --build
```

Để dùng nút **Tạo audio bằng AI**, cấu hình trong `toeic-vocabulary-be/.env`:

```dotenv
ELEVENLABS_API_KEY=your-api-key
ELEVENLABS_VOICE_ID=your-voice-id
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
```

API key chỉ được truyền vào backend, không được đóng gói vào frontend. Audio AI được xem trước ở trình duyệt và được lưu vào volume hiện có khi người dùng bấm lưu từ vựng.

Sau khi các service healthy:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api`
- MySQL trên máy host: `localhost:3307`

Cấu hình backend/MySQL nằm trong `toeic-vocabulary-be/.env`; cấu hình công khai của Vite nằm trong `toeic-vocabulary-fe/.env`. Cả hai file đều được Git bỏ qua và Docker Compose đọc trực tiếp, không còn file env ở thư mục gốc.

Tắt service nhưng giữ dữ liệu:

```powershell
docker compose down
```

Chỉ dùng `docker compose down -v` khi thực sự muốn xóa toàn bộ database, audio và dependencies trong volumes.

Hợp đồng API: [toeic-vocabulary-be/docs/openapi.yaml](toeic-vocabulary-be/docs/openapi.yaml).

