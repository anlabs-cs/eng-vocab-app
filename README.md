# Từ Vựng Của Tôi (Eng Vocab App)

Ứng dụng học từ vựng tiếng Anh chạy hoàn toàn trên trình duyệt (không cần backend/server). Tạo bộ từ, học bằng flashcard, chế độ học (learn) và làm bài kiểm tra, theo dõi tiến độ và streak học tập.

Trải nghiệm trực tiếp tại đây: [Quizlet](https://doan23092008-cell.github.io/eng-vocab-app/)

## Tính năng

- Quản lý bộ từ vựng: tạo, chỉnh sửa, xoá các bộ từ (set), thêm/sửa/xoá từng thẻ từ (thuật ngữ + định nghĩa).
- Flashcards: lật thẻ để ôn tập, đánh dấu "Đã thuộc" / "Đang học", hoàn tác đánh giá gần nhất, phát âm bằng Text-to-Speech.
  - Nút Trộn thẻ hoạt động như công tắc bật/tắt: khi bật sẽ xáo trộn thứ tự thẻ và nút chuyển sang trạng thái nổi bật; khi tắt sẽ quay về thứ tự gốc.
- Chế độ Learn: học theo lộ trình, ôn lại các từ chưa thuộc.
- Chế độ Test: kiểm tra kiến thức với các dạng câu hỏi khác nhau, xem kết quả sau khi hoàn thành.
- Theo dõi tiến độ: lưu số ngày học liên tiếp (streak) và lịch sử hoạt động học tập.
- Đồng bộ dữ liệu với file trên máy: hỗ trợ File System Access API, kết nối trực tiếp tới một file .json trên máy để tự động lưu mỗi khi có thay đổi. Trình duyệt không hỗ trợ (Firefox, Safari) sẽ tự động dùng phương án tải xuống/tải lên thủ công.
- Lưu cục bộ (localStorage): dữ liệu bộ từ và tiến độ được lưu ngay trên trình duyệt, không mất khi tải lại trang.
- Phím tắt: hỗ trợ điều khiển nhanh bằng bàn phím ở chế độ Flashcards và xem trước bộ từ.

## Cấu trúc thư mục

```
eng-vocab-app/
├── index.html            # Điểm vào của ứng dụng
├── style.css             # Toàn bộ giao diện
└── js/
    ├── state.js           # Lớp dữ liệu (load/save bộ từ)
    ├── filesync.js        # Đồng bộ dữ liệu với file .json trên máy
    ├── progress.js        # Theo dõi streak/tiến độ học
    ├── helpers.js         # Các hàm dùng chung (escape HTML, ...)
    ├── main.js             # Khởi động app + phím tắt
    └── views/
        ├── home.js         # Màn hình danh sách bộ từ
        ├── detail.js       # Chi tiết bộ từ, xem trước thẻ
        ├── editor.js       # Thêm/sửa bộ từ và thẻ
        ├── flashcards.js   # Chế độ học bằng Flashcards
        ├── learn.js        # Chế độ Learn
        ├── test.js         # Chế độ Test/kiểm tra
        └── results.js      # Màn hình kết quả sau khi học/test
```

## Cách chạy

Đây là ứng dụng thuần HTML/CSS/JS, không có bước build. Bạn có thể chạy theo một trong hai cách sau.

### Cách 1: Mở trực tiếp

Mở file index.html bằng trình duyệt (double click hoặc kéo file vào cửa sổ trình duyệt).

Lưu ý: một số trình duyệt giới hạn tính năng khi mở file trực tiếp (file://). Nếu gặp lỗi, hãy dùng Cách 2.

### Cách 2: Dùng local server (khuyến nghị)

```bash
# Dùng Python
python3 -m http.server 8000

# Hoặc dùng Node.js (http-server)
npx http-server -p 8000
```

Sau đó mở trình duyệt tại http://localhost:8000.

### Cách 3: Dùng bản deploy trên GitHub Pages

Truy cập trực tiếp: [Quizlet](https://doan23092008-cell.github.io/eng-vocab-app/)

## Lưu trữ dữ liệu

- Mặc định, dữ liệu được lưu trong localStorage của trình duyệt.
- Nếu trình duyệt hỗ trợ File System Access API (Chrome, Edge...), bạn có thể kết nối tới một file .json trên máy để dữ liệu được ghi trực tiếp ra file mỗi khi có thay đổi, tiện cho việc backup hoặc đồng bộ thủ công giữa các thiết bị.

## Phím tắt

| Phím | Chức năng (chế độ Flashcards) |
|---|---|
| Space | Lật thẻ |
| Mũi tên phải | Thẻ tiếp theo |
| Mũi tên trái | Thẻ trước |
| 1 | Đánh dấu "Đang học" |
| 2 hoặc 3 | Đánh dấu "Đã thuộc" |

## Công nghệ sử dụng

- HTML5, CSS3, JavaScript thuần (Vanilla JS), không dùng framework.
- Web Speech API (Text-to-Speech) để phát âm từ vựng.
- File System Access API để đồng bộ dữ liệu với file cục bộ.
- Font chữ: Be Vietnam Pro (Google Fonts).

## Giấy phép

Dự án cá nhân, sử dụng tự do cho mục đích học tập.
