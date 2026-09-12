# Eng Vocab App

Ứng dụng học từ vựng tiếng Anh chạy hoàn toàn trên trình duyệt (không cần backend/server). Tạo bộ từ, học bằng flashcard, chế độ học (learn) và làm bài kiểm tra, theo dõi tiến độ và streak học tập.

## Demo

| Danh sách bộ từ | Flashcards |
|---|---|
| ![Trang chủ](/img/screenshots/Home.jpeg) | ![Flashcards](/img/screenshots/Flashcard.jpeg) |

| Chế độ Learn | Chế độ Test |
|---|---|
| ![Learn](/img/screenshots/Learn.jpeg) | ![Test](/img/screenshots/Test.jpeg) |

## Usage

Direct Link: [eng-vocab](https://anlabs-cs.github.io/eng-vocab-app/)

## Lưu trữ dữ liệu

- Mặc định, dữ liệu được lưu trong localStorage của trình duyệt.
- Nếu trình duyệt hỗ trợ File System Access API (Chrome, Edge...), bạn có thể kết nối tới một file .json trên máy để dữ liệu được ghi trực tiếp ra file mỗi khi có thay đổi, tiện cho việc backup hoặc đồng bộ thủ công giữa các thiết bị.

## Tech stack

- HTML5, CSS3, JavaScript.
- Web Speech API (Text-to-Speech).
- File System Access API.
