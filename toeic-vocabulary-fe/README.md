# TOEIC Vocabulary Frontend

Giao diện React/Vite/TypeScript cho kho từ vựng cá nhân. Frontend gọi REST API của `toeic-vocabulary-be`; dự án không còn dùng Supabase.

## Chạy local

1. Sao chép `.env.example` thành `.env.local` nếu API không chạy tại `http://localhost:3000/api`.
2. `npm install`
3. `npm run dev`

## Kiểm tra

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm audit`

Frontend giữ access token trong bộ nhớ, tự gọi refresh cookie HttpOnly khi tải lại trang hoặc khi access token hết hạn. Các file audio được tải bằng request có xác thực rồi phát qua object URL trong trình duyệt.

