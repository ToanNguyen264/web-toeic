# Kế hoạch triển khai chế độ học Flashcard & gom nhóm chế độ Nghe

## 1. Mục tiêu và nguyên tắc

1. **Giữ nguyên 100% các chức năng hiện tại** (thống kê, thêm/sửa/xóa từ, tạo ví dụ & audio bằng AI, danh sách từ vựng, nghe lẻ, danh sách phát *Nghe tất cả* / *Nghe từ + nghĩa*, tốc độ, số lần lặp…) và gom toàn bộ vào mục **Nghe**.
2. **Bổ sung chế độ học Flashcard** độc lập để ôn tập phản xạ từ vựng nhanh, gọn nhẹ, đồng bộ trực tiếp với kho từ và 3 mức độ thuộc từ trên MySQL.
3. **Ưu tiên thông minh các từ lâu chưa ôn**: mở rộng nhẹ bảng `vocabularies` thêm `last_reviewed_at` và `review_count` để mỗi lượt học luôn ưu tiên đưa các từ **chưa từng ôn** hoặc **lâu ngày chưa ôn** lên trước, tránh học lặp đi lặp lại chỉ vài từ mới thêm.

---

## 2. Các quyết định sản phẩm đã chốt

| Hạng mục | Phương án thống nhất |
|---|---|
| **Điều hướng chính** | Đặt tab chuyển đổi **Nghe** và **Flashcard** ngay trên thanh Header (`AppShell`). Tách 2 route riêng `/listen` và `/flashcards` (giữ redirect tương thích cho `/` và `/vocabularies` về `/listen`). |
| **Nội dung 2 mặt thẻ** | Chiều cố định **Anh → Việt**, thiết kế gọn nhẹ:<br>• **Mặt trước:** Từ tiếng Anh + nhãn mức độ hiện tại + thông tin lần ôn gần nhất + nút phát audio từ vựng.<br>• **Mặt sau:** Nghĩa tiếng Việt nổi bật + từ tiếng Anh cỡ nhỏ để đối chiếu. **Câu ví dụ TOEIC ẩn mặc định**, chỉ hiển thị khi bấm nút *"Xem ví dụ TOEIC"* (kèm bản dịch & nút nghe audio ví dụ). |
| **Đánh giá & Chuyển thẻ** | Sau khi xem mặt sau, có 3 nút chấm nhanh: **Chưa thuộc** (`1`) · **Thuộc sơ sơ** (`2`) · **Thuộc kĩ** (`3`). Bấm chọn sẽ lưu ngay mức độ thuộc + cập nhật `last_reviewed_at = now()`, tăng `review_count + 1` vào DB và tự chuyển sang thẻ tiếp theo. Vẫn có nút **Trước / Tiếp theo** để duyệt tự do và **Màn hình tổng kết cuối phiên**. |
| **Ưu tiên & Bộ lọc phiên học** | • Mặc định sắp xếp **Ưu tiên từ chưa ôn → từ ôn lâu nhất trước** (`review_priority`).<br>• Lọc theo mức độ (`Tất cả`, `Chưa thuộc`, `Thuộc sơ sơ`, `Thuộc kĩ`) + Tìm kiếm từ khóa.<br>• Chọn số lượng thẻ mỗi lượt (`10`, `20`, `50`, `Tất cả` — lấy top N từ lâu chưa ôn nhất) + nút **Xáo trộn (Shuffle)** thứ tự thẻ trong lượt học để tránh học vẹt vị trí. |
| **Âm thanh & Phím tắt** | Có công tắc **Tự động phát audio** khi hiện từ tiếng Anh (nhớ cài đặt qua `localStorage`) + hỗ trợ đầy đủ phím tắt bàn phím (`Space`, `←/→`, `1/2/3`, `R`, `E`). |

---

## 3. Thiết kế Database & Backend API

### 3.1. Mở rộng bảng `vocabularies` (Prisma + MySQL Migration)

Thêm 2 cột vào model `Vocabulary` trong `toeic-vocabulary-be/prisma/schema.prisma`:

- `lastReviewedAt` (`last_reviewed_at` — `DATETIME(3) NULL`):
  - Mặc định `NULL` khi mới tạo từ (biểu thị **từ mới chưa từng ôn bằng Flashcard**).
  - Trong MySQL, sắp xếp `ORDER BY last_reviewed_at ASC` tự động xếp các bản ghi `NULL` (chưa ôn) lên đầu tiên, tiếp đến là các từ có mốc thời gian ôn cũ nhất, và cuối cùng mới tới các từ vừa ôn gần đây.
- `reviewCount` (`review_count` — `INT UNSIGNED NOT NULL DEFAULT 0`):
  - Đếm tổng số lần người dùng đã chấm ôn từ này trong Flashcard.
- **Index mới phục vụ truy vấn nhanh theo từng tài khoản:**
  - `@@index([userId, lastReviewedAt, createdAt(sort: Desc)])`
  - `@@index([userId, masteryLevel, lastReviewedAt, createdAt(sort: Desc)])`
- Tạo file migration SQL chuẩn tại `prisma/migrations/202611260009_add_vocabulary_review_tracking/migration.sql` (tự động áp dụng khi container backend khởi động bằng `npx prisma migrate deploy`, không ảnh hưởng dữ liệu cũ).

### 3.2. Mở rộng Backend API (Tương thích ngược 100% với mục Nghe)

1. **Cập nhật `vocabularyDto` (`src/utils/dto.ts`)**:
   - Trả thêm `last_reviewed_at: string | null` và `review_count: number`.
2. **Bổ sung tham số `sort` cho `GET /api/vocabularies`**:
   - `sort = "newest"` *(mặc định)*: giữ nguyên sắp xếp `createdAt DESC` cho mục **Nghe** hiện tại.
   - `sort = "review_priority"`: sắp xếp `lastReviewedAt ASC, createdAt DESC` chuyên dùng cho chế độ **Flashcard** (từ chưa ôn lần nào lên đầu → từ lâu chưa ôn → từ mới ôn).
3. **Thêm endpoint ghi nhận kết quả ôn Flashcard `POST /api/vocabularies/:id/review`**:
   - Request body: `{ "masteryLevel": "unlearned" | "learning" | "mastered" }`
   - Xử lý nguyên tử (atomic update) trong 1 câu lệnh Prisma:
     - Cập nhật `masteryLevel` và `isLearned` (`masteryLevel === "mastered"`).
     - Đặt `lastReviewedAt = new Date()`.
     - Tăng `reviewCount: { increment: 1 }`.
   - **Lý do tách riêng với `PATCH /:id/mastery`**: Khi người dùng chỉ bấm ngôi sao đổi trạng thái nhanh ở bảng danh sách mục **Nghe**, hệ thống không làm sai lệch bộ đếm số lần ôn hay mốc `last_reviewed_at` của Flashcard. Ngược lại, trong Flashcard, kể cả khi từ đang ở mức *Thuộc sơ sơ* và người học tiếp tục chấm *Thuộc sơ sơ*, `last_reviewed_at` vẫn được làm mới để nhường chỗ ưu tiên cho các từ khác ở lượt học sau.
4. **Cập nhật tài liệu `toeic-vocabulary-be/docs/openapi.yaml`**:
   - Bổ sung trường mới trong schema `Vocabulary`, query param `sort` và endpoint `POST /api/vocabularies/{id}/review`.

---

## 4. Thiết kế chi tiết Frontend

### 4.1. Điều hướng trên Header (`AppShell.tsx` & `App.tsx`)

```text
Header (Sticky)
├── Trái: BrandMark ("TOEIC Vocabulary")
├── Giữa: Cụm tab chuyển chế độ [ 🎧 Nghe | 🗂️ Flashcard ]
└── Phải: Email người dùng · Cấu hình AI (Admin) · Đổi giao diện Sáng/Tối · Đăng xuất
```

- Cụm tab **Nghe | Flashcard** dùng `NavLink` của `react-router`, hiển thị gọn đẹp trên cả Desktop và Mobile.
- Cấu trúc Route trong `App.tsx`:
  - `/listen` → `VocabularyPage` (giữ nguyên toàn bộ code trang hiện tại).
  - `/flashcards` → `FlashcardPage` (trang mới, lazy-loaded).
  - `/` và `/vocabularies` → `<Navigate to="/listen" replace />` (đồng thời cập nhật đường dẫn mặc định sau Login/Register/PublicOnlyRoute về `/listen`).
- Khi chuyển từ **Nghe** sang **Flashcard**, `VocabularyPage` tự động unmount và dừng toàn bộ danh sách phát đang chạy.

### 4.2. Bố cục trang Flashcard (`FlashcardPage.tsx`)

1. **Thanh cấu hình phiên học (`FlashcardToolbar.tsx`)**:
   - **Chọn nhóm từ**: 4 nút pill kèm số lượng thống kê (`Tất cả`, `Chưa thuộc`, `Thuộc sơ sơ`, `Thuộc kĩ`).
   - **Ô tìm kiếm**: debounce 300ms theo từ tiếng Anh / nghĩa tiếng Việt.
   - **Số lượng thẻ mỗi lượt**: Dropdown chọn `10 thẻ`, `20 thẻ` (mặc định), `50 thẻ`, `Tất cả` — tự động cắt lấy **top N từ lâu chưa ôn nhất** từ danh sách ưu tiên.
   - **Nút Xáo trộn (Shuffle)**: Bật/tắt trộn ngẫu nhiên (Fisher–Yates) thứ tự các thẻ bên trong lượt học đã chọn (vừa đảm bảo học đúng nhóm từ lâu chưa ôn, vừa không bị thuộc vẹt thứ tự xuất hiện) + nút tạo lại lượt mới.
   - **Công tắc Tự động phát âm (Auto-play)**: Bật/tắt tự phát audio từ tiếng Anh khi sang thẻ mới (lưu `localStorage`).

2. **Khu vực thẻ học trung tâm (`FlashcardCard.tsx`)**:
   - **Thanh tiến độ phiên học**: Hiển thị `Thẻ X / N`, thanh progress bar mượt mà, và bộ đếm kết quả đã chấm trong phiên.
   - **Thẻ lật 2 mặt 3D** (hỗ trợ `prefers-reduced-motion` và Dark Mode):
     - **Mặt trước**:
       - Góc trên trái: Nhãn mức độ hiện tại (`Chưa thuộc` / `Thuộc sơ sơ` / `Thuộc kĩ`).
       - Góc trên phải: Nhãn lịch sử ôn tinh gọn (*"Chưa ôn lần nào"* hoặc *"Đã ôn X lần · Y ngày trước"* / *"Hôm nay"*).
       - Giữa thẻ: Từ tiếng Anh cỡ lớn (`text-3xl sm:text-4xl font-extrabold`).
       - Nút phát audio từ tiếng Anh (`audio_path`) — có `stopPropagation()` để bấm nghe không làm lật thẻ.
       - Chân thẻ: *"Nhấn vào thẻ hoặc phím Space để xem nghĩa"*.
     - **Mặt sau**:
       - Dòng nhắc nhỏ từ tiếng Anh + nút nghe lại phát âm ở phía trên.
       - **Nghĩa tiếng Việt** cỡ lớn, rõ nét ở trung tâm thẻ.
       - **Khu vực Ví dụ TOEIC thu gọn**:
         - Nếu từ có `example_english`: hiện nút gọn *"Xem ví dụ TOEIC"* (hoặc phím `E`). Bấm vào mới mở câu ví dụ (`example_annotated_english || example_english`), nghĩa câu ví dụ (`example_vietnamese`) và nút nghe audio ví dụ (`example_audio_path`).
         - Tự động đóng lại khi chuyển sang thẻ khác để mặt sau luôn sạch, gọn.

3. **Cụm điều khiển & Chấm mức độ (`FlashcardControls.tsx`)**:
   - Hàng điều hướng tự do: **Trước (`←`)** · **Lật thẻ (`Space`)** · **Tiếp theo (`→`)**.
   - Hàng chấm nhanh (lưu DB qua `POST /vocabularies/:id/review` + tự sang thẻ tiếp theo):
     - `[1] Chưa thuộc`
     - `[2] Thuộc sơ sơ`
     - `[3] Thuộc kĩ`
   - Dòng chú thích phím tắt trên Desktop:
     `Space: Lật thẻ · ←/→: Chuyển thẻ · 1/2/3: Chấm mức độ · R: Nghe lại · E: Mở ví dụ`

### 4.3. Cơ chế "Snapshot phiên học" (Tránh nhảy thẻ giữa chừng)

- Khi bắt đầu lượt học (hoặc khi đổi bộ lọc / từ khóa / số lượng thẻ / bấm tạo lượt mới), danh sách thẻ của phiên (`sessionCards`) được chốt cố định từ kết quả ưu tiên.
- Khi người dùng bấm chấm mức độ `1 / 2 / 3`:
  - Cập nhật ngay trạng thái thẻ trong `sessionCards` (optimistic UI) và lưu kết quả vào thống kê phiên học.
  - Gọi `POST /api/vocabularies/:id/review` dưới nền và invalidate cache danh sách từ để số thống kê tổng & tab **Nghe** đồng bộ tức thì, **nhưng không thay đổi mảng `sessionCards` đang học dở**, tránh hiện tượng thẻ biến mất làm nhảy cóc thứ tự.
  - Khi bấm *"Bắt đầu lượt tiếp theo"* ở cuối phiên, hệ thống lấy danh sách mới từ server — lúc này các từ vừa ôn đã có `last_reviewed_at` mới nhất nên tự động lùi về cuối hàng đợi, nhường chỗ cho 20 từ lâu chưa ôn tiếp theo!

### 4.4. Màn hình tổng kết cuối phiên (`FlashcardSummary.tsx`)

Khi hoàn thành thẻ cuối cùng trong lượt học:
- Hiển thị tổng số thẻ đã học và phân bổ kết quả vừa chấm (`Thuộc kĩ`, `Thuộc sơ sơ`, `Chưa thuộc`, `Chưa chấm`).
- Các nút hành động nhanh:
  1. **Ôn tiếp lượt mới (Ưu tiên từ lâu chưa ôn tiếp theo)** — tải tập thẻ ưu tiên kế tiếp từ kho từ.
  2. **Ôn lại các từ chưa vững vừa học** — lọc riêng các thẻ vừa chấm *Chưa thuộc* hoặc *Thuộc sơ sơ* trong phiên vừa rồi (chỉ hiện khi có ít nhất 1 từ).
  3. **Học lại bộ thẻ vừa rồi** — duyệt lại đúng các thẻ của phiên hiện tại.

### 4.5. Quản lý Audio & Phím tắt an toàn

- Cache `objectURL` của audio bằng `Map<string, string>` trong phiên học và `URL.revokeObjectURL` đầy đủ khi đổi phiên / rời trang.
- Chống race-condition khi chuyển thẻ liên tục (hủy lượt phát cũ trước khi phát audio thẻ mới khi bật Auto-play).
- Tự động tắt phím tắt khi con trỏ đang ở trong `INPUT`, `TEXTAREA`, `SELECT` hoặc khi đang mở modal (`[role="dialog"]`).

---

## 5. Danh sách file dự kiến thay đổi và tạo mới

### Backend (`toeic-vocabulary-be`)

1. `prisma/schema.prisma` — Thêm `lastReviewedAt`, `reviewCount` và index ưu tiên ôn tập cho `Vocabulary`.
2. `prisma/migrations/202611260009_add_vocabulary_review_tracking/migration.sql` *(mới)* — Lệnh `ALTER TABLE` thêm 2 cột và index.
3. `src/utils/dto.ts` — Trả thêm `last_reviewed_at` và `review_count` trong `vocabularyDto`.
4. `src/utils/validation.ts` — Thêm tham số `sort` (`newest` | `review_priority`) vào `listQuerySchema`.
5. `src/routes/vocabulary.routes.ts` — Hỗ trợ `sort=review_priority` trong `GET /vocabularies` và thêm route `POST /vocabularies/:id/review`.
6. `docs/openapi.yaml` — Cập nhật tài liệu OpenAPI cho trường và endpoint mới.

### Frontend (`toeic-vocabulary-fe`)

1. `src/types/vocabulary.ts` — Thêm `last_reviewed_at`, `review_count` và kiểu `VocabularySort`.
2. `src/services/vocabulary.service.ts` — Thêm `listFlashcardVocabularies` (gọi `sort=review_priority`) và `reviewVocabulary` (`POST /vocabularies/:id/review`).
3. `src/components/layout/AppShell.tsx` — Thêm cụm tab điều hướng **Nghe** | **Flashcard** trên Header.
4. `src/App.tsx`, `src/router/ProtectedRoute.tsx`, `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx` — Cấu hình route `/listen`, `/flashcards` và redirect mặc định.
5. `src/index.css` — Bổ sung class CSS lật thẻ 3D tương thích `prefers-reduced-motion`.
6. `src/hooks/useFlashcardPool.ts` *(mới)* — Hook lấy danh sách thẻ theo thứ tự ưu tiên ôn tập.
7. `src/components/flashcard/FlashcardToolbar.tsx` *(mới)* — Thanh lọc mức độ, tìm kiếm, số thẻ mỗi lượt, Shuffle, Auto-play.
8. `src/components/flashcard/FlashcardCard.tsx` *(mới)* — Thẻ 2 mặt Anh → Việt, hiển thị lịch sử ôn tập, ẩn/mở ví dụ TOEIC, phát audio.
9. `src/components/flashcard/FlashcardControls.tsx` *(mới)* — Nút điều hướng Trước/Lật/Sau, 3 nút chấm mức độ và gợi ý phím tắt.
10. `src/components/flashcard/FlashcardSummary.tsx` *(mới)* — Tổng kết cuối phiên & chọn lượt học kế tiếp.
11. `src/pages/FlashcardPage.tsx` *(mới)* — Trang điều phối phiên học Flashcard.

*(Lưu ý: `VocabularyPage.tsx` và toàn bộ các component trong mục **Nghe** được giữ nguyên vẹn, không thay đổi logic.)*

---

## 6. Kế hoạch triển khai & Kiểm thử nghiệm thu

1. **Bước 1 — Database & Backend**:
   - Cập nhật `schema.prisma`, tạo migration SQL, generate Prisma Client, mở rộng DTO, route `GET /vocabularies?sort=review_priority` và `POST /vocabularies/:id/review`.
   - Kiểm tra `npm run lint` và `npm run build` ở `toeic-vocabulary-be`.
2. **Bước 2 — Điều hướng & Dịch vụ Frontend**:
   - Cập nhật kiểu dữ liệu, service gọi API mới, thanh tab **Nghe | Flashcard** trên `AppShell` và route `/listen`, `/flashcards`.
3. **Bước 3 — Giao diện & Luồng học Flashcard**:
   - Xây dựng bộ component Flashcard, snapshot phiên học, auto-play audio, phím tắt và màn hình tổng kết chuyển lượt ưu tiên kế tiếp.
4. **Bước 4 — Nghiệm thu toàn diện**:
   - Kiểm tra `npm run lint` và `npm run build` ở `toeic-vocabulary-fe`.
   - Áp dụng migration lên MySQL (nếu Docker đang chạy) và kiểm tra luồng thực tế end-to-end.
