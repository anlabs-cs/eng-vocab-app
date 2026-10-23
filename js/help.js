/* =========================================================
   HELP: floating "?" button (bottom-left) + popup with the
   usage guide, keyboard shortcuts and a contact e-mail.
   Lives outside #app so re-rendering a view never removes it.
========================================================= */
const HELP_EMAIL = 'doan23092008@gmail.com'; // <- contact address (change here)

const HELP_SHORTCUTS = [
  ['Mọi nơi', [
    ['D', 'Bật/tắt Dark Mode'],
    ['Esc', 'Đóng menu/hộp thoại, hoặc quay lại màn hình trước'],
  ]],
  ['Trang chủ', [
    ['/', 'Tìm bộ từ'],
    ['N', 'Tạo bộ từ mới'],
  ]],
  ['Trang bộ từ', [
    ['Space', 'Lật thẻ xem trước'],
    ['← / →', 'Thẻ trước / thẻ sau'],
    ['S', 'Đọc to từ đang xem'],
    ['F / L / T', 'Mở Flashcards / Learn / Test'],
    ['R', 'Ôn các từ đến hạn'],
    ['E', 'Sửa bộ từ'],
  ]],
  ['Sửa bộ từ', [
    ['Enter', 'Ô Term → ô Definition; ở ô Definition: dùng nghĩa gợi ý'],
    ['Ctrl + Enter', 'Thêm thẻ mới'],
    ['Ctrl + S', 'Lưu bộ từ'],
  ]],
  ['Flashcards', [
    ['Space / ↑ / ↓', 'Lật thẻ'],
    ['→ hoặc 2', 'Đã thuộc'],
    ['← hoặc 1', 'Chưa thuộc'],
    ['Z / Backspace', 'Hoàn tác thẻ vừa đánh dấu'],
    ['S', 'Đọc to mặt thẻ đang hiện'],
    ['O', 'Mở tuỳ chọn'],
  ]],
  ['Learn', [
    ['1–9', 'Chọn đáp án (trắc nghiệm)'],
    ['?', 'Không biết'],
    ['Enter / Space', 'Câu tiếp theo (sau khi trả lời)'],
    ['Enter', 'Tự luận: kiểm tra, hiện đáp án đúng'],
    ['1 / 2', 'Tự luận: tự chọn sai / đúng'],
  ]],
  ['Test & Kết quả', [
    ['Enter', 'Tạo bài test (màn hình tạo bài)'],
    ['Ctrl + Enter', 'Nộp bài'],
    ['R', 'Học lại các từ sai (màn hình kết quả)'],
  ]],
];

const HELP_GUIDE = [
  ['Tạo bộ từ', 'Ở Trang chủ bấm <b>Create a set</b> (hoặc phím <kbd>N</kbd>), rồi nhập từ và nghĩa. Có thể dán danh sách hoặc tải file <code>.txt</code> / <code>.csv</code> / <code>.tsv</code> trong mục <b>Data</b>; nghĩa còn trống sẽ được gợi ý tự động.'],
  ['Học từ', 'Mở một bộ từ rồi chọn <b>Flashcards</b> (lật thẻ), <b>Learn</b> (trắc nghiệm / tự luận) hoặc <b>Test</b> (làm bài kiểm tra).'],
  ['Ôn tập đúng hạn', 'Mỗi từ có lịch ôn riêng (1 → 2 → 4 → 8 → 16 → 32 ngày; trả lời sai thì quay lại từ đầu). Bấm <b>Review</b> để ôn các từ đến hạn hôm nay.'],
  ['Học lại từ sai', 'Sau Flashcards / Learn / Test có nút học lại riêng các từ chưa thuộc hoặc làm sai.'],
  ['Đồng bộ & Offline', 'Đăng nhập Google để lưu bộ từ vào Google Drive và dùng trên nhiều máy, hoặc chọn dùng không cần đăng nhập. Có thể cài ứng dụng (PWA) để học khi không có mạng.'],
];

function helpIsOpen(){ return !!document.getElementById('helpOverlay'); }

function helpOpen(){
  if(helpIsOpen()) return;
  const guide = HELP_GUIDE.map(([t, d]) =>
    `<li><strong>${t}.</strong> ${d}</li>`).join('');
  const keys = HELP_SHORTCUTS.map(([group, rows]) => `
    <tr class="help-group"><th colspan="2">${group}</th></tr>
    ${rows.map(([k, d]) => `<tr><td class="help-keys"><kbd>${k.split(' + ').join('</kbd> + <kbd>')}</kbd></td><td>${d}</td></tr>`).join('')}
  `).join('');
  const el = document.createElement('div');
  el.id = 'helpOverlay';
  el.className = 'modal-overlay help-overlay';
  el.onclick = helpClose;
  el.innerHTML = `
    <div class="modal help-modal" role="dialog" aria-modal="true" aria-label="Trợ giúp" onclick="event.stopPropagation()">
      <button class="modal-close" id="helpCloseBtn" title="Đóng" onclick="helpClose()"><img src="img/icon/x.png" class="theme-icon"></button>
      <h2>Trợ giúp</h2>

      <h3 class="modal-subtitle">Hướng dẫn sử dụng</h3>
      <ul class="help-guide">${guide}</ul>

      <h3 class="modal-subtitle">Phím tắt</h3>
      <p class="modal-hint">Phím tắt không hoạt động khi đang gõ trong ô nhập (trừ các tổ hợp có <kbd>Ctrl</kbd>). Nhấn <kbd>Esc</kbd> để thoát khỏi ô nhập. Trên macOS dùng <kbd>⌘</kbd> thay cho <kbd>Ctrl</kbd>.</p>
      <table class="help-table"><tbody>${keys}</tbody></table>

      <h3 class="modal-subtitle">Liên hệ</h3>
      <p class="modal-hint">Có góp ý hoặc gặp lỗi? Hãy gửi email về:</p>
      <p class="help-contact">${HELP_EMAIL}</p>
    </div>`;
  document.body.appendChild(el);
  const c = document.getElementById('helpCloseBtn');
  if(c) c.focus();
}

function helpClose(){
  const el = document.getElementById('helpOverlay');
  if(el) el.remove();
  // don't leave a button focused: Space/Enter would re-trigger it
  if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

(function mountHelpButton(){
  if(document.getElementById('helpFab')) return;
  const b = document.createElement('button');
  b.id = 'helpFab';
  b.className = 'help-fab';
  b.type = 'button';
  b.title = 'Trợ giúp';
  b.setAttribute('aria-label', 'Trợ giúp');
  b.textContent = '?';
  b.onclick = (e) => { e.currentTarget.blur(); helpOpen(); };
  document.body.appendChild(b);
})();