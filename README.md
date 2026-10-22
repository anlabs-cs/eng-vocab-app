# Eng Vocab App

Ứng dụng học từ vựng tiếng Anh tối giản, chạy 100% trên trình duyệt và hỗ trợ offline hoàn toàn (không cần backend/server). Thích hợp để người học tự học, tự lưu trữ và cài đặt vĩnh viễn trên máy cá nhân.

## Tính năng nổi bật
- **Học tập chủ động:** Tạo bộ từ, học bằng flashcard, ôn luyện với chế độ Learn, làm bài kiểm tra và theo dõi chuỗi ngày học (streak).
- **Lặp lại ngắt quãng:** Mỗi từ có lịch ôn riêng (1 → 2 → 4 → 8 → 16 → 32 ngày; trả lời sai thì quay lại từ đầu). Trang chủ và trang bộ từ hiện số từ cần ôn hôm nay, bấm **Review** để ôn đúng những từ đó.
- **Học lại từ sai:** Sau Flashcards / Learn / Test có nút học lại riêng các từ chưa thuộc hoặc làm sai.
- **Thông tin từ đầy đủ:** Ngoài nghĩa, mỗi từ có thể có loại từ, phiên âm và câu ví dụ.
- **Nhập nhanh:** Dán danh sách hoặc tải file `.txt` / `.csv` / `.tsv` (xuất từ Excel, Google Sheets, Anki), tự dịch nghĩa còn trống sang tiếng Việt.
- **Hoạt động Offline (PWA):** Có thể cài đặt ứng dụng thành phần mềm độc lập trên máy tính/điện thoại. Sau khi cài, ứng dụng hoạt động không cần mạng Internet (trừ tính năng gợi ý nghĩa).
- **Đăng nhập Google & đồng bộ:** Đăng nhập bằng Google để lưu bộ từ, tiến độ và streak vào Google Drive (thư mục ẩn của ứng dụng), dùng chung trên nhiều máy. Mở lại web vẫn giữ đăng nhập. Có thể chọn **Dùng không cần đăng nhập** — khi đó dữ liệu chỉ lưu trên trình duyệt; đăng xuất sẽ đưa dữ liệu về đúng như trước khi đăng nhập.
- **Phát âm từ vựng:** Tích hợp sẵn *Web Speech API (Text-to-Speech)* đọc tiếng Anh.
- **Giao diện thân thiện:** Dark Mode, dùng tốt trên điện thoại, có [phím tắt](#phím-tắt) cho các thao tác chính.

## Phím tắt

Phím tắt không hoạt động khi đang gõ trong ô nhập (trừ các tổ hợp có `Ctrl`). Nhấn `Esc` để thoát khỏi ô nhập.

| Màn hình | Phím | Tác dụng |
|---|---|---|
| Mọi nơi | `D` | Bật/tắt Dark Mode |
| | `Esc` | Đóng menu/hộp thoại, hoặc quay lại màn hình trước (không áp dụng khi đang sửa bộ từ hay làm bài test, để tránh mất dữ liệu) |
| Trang chủ | `/` | Tìm bộ từ |
| | `N` | Tạo bộ từ mới |
| Trang bộ từ | `Space` | Lật thẻ xem trước |
| | `←` / `→` | Thẻ trước / thẻ sau |
| | `S` | Đọc to từ đang xem |
| | `F` / `L` / `T` | Mở Flashcards / Learn / Test |
| | `R` | Ôn các từ đến hạn |
| | `E` | Sửa bộ từ |
| Sửa bộ từ | `Enter` (ở ô **Term**) | Chuyển sang ô Definition của cùng thẻ |
| | `Enter` (ở ô **Definition**) | Dùng nghĩa gợi ý (khi ô còn trống) |
| | `Ctrl` + `Enter` | Thêm thẻ mới và nhảy tới ô Term |
| | `Ctrl` + `S` | Lưu bộ từ |
| Flashcards | `Space` / `↑` / `↓` | Lật thẻ |
| | `→` hoặc `2` | Đã thuộc |
| | `←` hoặc `1` | Chưa thuộc |
| | `Z` / `Backspace` | Hoàn tác thẻ vừa đánh dấu |
| | `S` | Đọc to mặt thẻ đang hiện |
| | `O` | Mở tuỳ chọn |
| Learn (trắc nghiệm) | `1`–`9` | Chọn đáp án |
| | `?` | Không biết |
| | `Enter` / `Space` | Câu tiếp theo (sau khi trả lời) |
| | `S` | Đọc to từ |
| Learn (tự luận) | `Enter` | Kiểm tra: hiện đáp án đúng |
| | `1` / `2` | Tự chọn **sai** / **đúng** (sau khi xem đáp án) |
| | `Enter` (sau khi xem đáp án) | Chọn theo gợi ý được tô sáng |
| Tạo bài Test | `Enter` | Tạo bài test |
| Làm bài Test | `Ctrl` + `Enter` | Nộp bài |
| Kết quả | `R` | Học lại các từ sai |
| | `Enter` | Quay lại bộ từ |

Trong Flashcards / Learn / Test, góc trên bên phải khung làm bài có nút **sáng/tối**, **cài đặt** và **đóng (X)**.

### Trên macOS
Dùng bảng trên, chỉ đổi các phím sau:

| Windows / Linux | macOS |
|---|---|
| `Ctrl` | `⌘ Command` (phím `Ctrl` vẫn dùng được) |
| `Backspace` | `⌫ Delete` |
| `Enter` | `↩ Return` |

Ví dụ: lưu bộ từ là `⌘` + `S`, thêm thẻ mới là `⌘` + `↩`, nộp bài Test là `⌘` + `↩`.

> Khi gõ tiếng Việt (Unikey/Telex/VNI), phím `Enter` dùng để xác nhận từ đang gõ sẽ không bị tính là phím tắt.

## Câu tự luận: bạn tự quyết định đúng/sai
Vì tiếng Việt có dấu nên rất khó gõ khớp hoàn toàn, ứng dụng **không tự chấm** câu tự luận:
- **Learn:** gõ đáp án rồi bấm `Enter` / **Check** → ứng dụng hiện đáp án đúng → bạn bấm **I was right** (`2`) hoặc **I was wrong** (`1`). Nút nào ứng dụng đoán đúng sẽ được tô sáng (chỉ là gợi ý), nhưng quyết định là của bạn.
- **Test:** khi nộp bài, ứng dụng chấm tạm; ở trang kết quả mỗi câu tự luận có nút **Right / Wrong** để bạn sửa lại, điểm và danh sách từ sai tự cập nhật theo.

## Định dạng nhập danh sách
Mỗi dòng một từ:
```
accommodation - chỗ ở, nơi ở
look up: tra cứu
```
Hoặc các cột cách nhau bằng Tab (dán từ Excel/Sheets) hay file CSV, theo thứ tự:
`từ | nghĩa | câu ví dụ | loại từ | phiên âm` (chỉ 2 cột đầu là bắt buộc).

## Dùng chung dữ liệu trên nhiều máy
Đăng nhập cùng một tài khoản Google trên các máy, dữ liệu sẽ tự đồng bộ qua Google Drive.
Để chia sẻ một bộ từ cho bạn bè: trong trang bộ từ bấm nút **Share** (danh sách `từ - nghĩa`), người nhận dán vào ô nhập nhanh khi tạo bộ từ mới.

## Hướng dẫn sử dụng & Cài đặt

### Cách 1: Sử dụng và Cài đặt từ Web (Khuyên dùng)
Truy cập ứng dụng tại: **[Eng-Vocab Web](https://anlabs-cs.github.io/eng-vocab-app/)**

**Để cài đặt ứng dụng về máy tính (Dùng vĩnh viễn không cần mạng):**
1. Mở link web bằng trình duyệt **Google Chrome** hoặc **Microsoft Edge**.
2. Nhấn vào nút **"Install app"** trên thanh menu trên cùng của ứng dụng.
3. *(Hoặc)* Nhìn lên góc bên phải của thanh địa chỉ (Address bar) của trình duyệt, bạn sẽ thấy biểu tượng màn hình máy tính có dấu `+` (Install). Nhấn vào đó.
4. Chọn **Install/Cài đặt**. Ứng dụng sẽ được tạo shortcut ngoài màn hình Desktop. Từ nay, bạn mở nó lên học bình thường kể cả khi ngắt kết nối Wifi.

### Cách 2: Chạy cục bộ trên máy (Mã nguồn tải về)
Nếu bạn tải mã nguồn gốc `.zip` về máy, bạn nên chạy ứng dụng thông qua script tích hợp sẵn để đăng nhập Google và Service Worker hoạt động đúng:
- **Trên Windows:** Nháy đúp vào file `start.bat`.
- **Trên Mac/Linux:** Mở Terminal ở thư mục gốc và chạy `./start.sh`.
- Trình duyệt sẽ tự động hướng dẫn bạn vào địa chỉ `http://localhost:8765`.

## Demo

| Danh sách bộ từ | Flashcards |
|---|---|
| ![Trang chủ](img/screenshots/Home.png) | ![Flashcards](img/screenshots/Flashcard.png) |

| Chế độ Learn | Chế độ Test |
|---|---|
| ![Learn](img/screenshots/Learn.png) | ![Test](img/screenshots/Test.png) |

## Tech Stack
- Frontend: HTML5, CSS3, Vanilla JavaScript.
- Offline Core: Service Worker (PWA Manifest).
- Browser APIs: Web Speech API, Google Identity Services + Google Drive API (appDataFolder).
