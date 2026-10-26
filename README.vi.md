# Inbox Assistant

Ứng dụng Gmail chạy ngay trên máy bạn và đọc thư giúp bạn. Mỗi thư mới được gắn danh mục, mức ưu tiên, một câu tóm tắt, hạn chót (nếu có) và những việc bạn cần làm. Bạn trả lời ngay trong khung bên dưới mỗi thư, hoặc nhờ trợ lý viết giúp.

**[Trang giới thiệu](https://khangchau12.github.io/Gmail-AI-Assistant/)** · [English](README.md)

- **Hôm nay.** Một màn hình tổng quan: lời chào, ô lớn để hỏi hộp thư, một ô cho mỗi danh mục và danh sách thư cần bạn xử lý.
- **Cần xử lý.** Thư có người đang chờ bạn trả lời, hoặc AI đánh dấu quan trọng, sắp theo hạn chót. Thư rời danh sách khi bạn trả lời từ app hoặc lưu trữ nó.
- **Trả lời tại chỗ.** Dưới mỗi thư có gợi ý trả lời một chạm, nút "Viết bằng AI" từ ghi chú của bạn, chọn giọng văn và nút Gửi.
- **Trợ lý.** Trang chat toàn màn hình, tự tìm và đọc thư. Thư nháp hiện thành thẻ ngay trong chat để bạn sửa, đổi giọng văn và gửi. Cuộc trò chuyện được lưu lại.
- **Cục bộ và riêng tư.** Thư nằm trong một file SQLite ở `data/`. Không cần tạo tài khoản, database hay dịch vụ cloud nào.
- **Đồng bộ nhanh.** Sau lần nhập đầu, mỗi lần sync chỉ tải thư mới và cập nhật các thay đổi đã đọc, gắn sao, lưu trữ, xoá từ Gmail.
- **Ưu tiên bàn phím, song ngữ.** Có `j`/`k`/`e`/`r`, `⌘K` và `⌘J`. Giao diện, tóm tắt và câu trả lời của AI có tiếng Việt và tiếng Anh, kèm theme sáng và tối.

---

## Yêu cầu

- **Node.js 18.18 trở lên** (khuyên dùng bản LTS 20 hoặc 22). Kiểm tra bằng `node -v`.
- **Tài khoản Gmail hoặc Google Workspace đã bật Xác minh 2 bước.** Cần có để tạo App Password.
- **OpenAI API key**, hoặc key của bất kỳ server nào tương thích API OpenAI (xem [Dùng mô hình khác](#dùng-mô-hình-khác)).

App kết nối Gmail qua IMAP/SMTP bằng App Password, nên không cần tạo project Google Cloud hay cấu hình OAuth.

## Cài đặt

### 1. Tải code và cài thư viện

```bash
git clone https://github.com/KhangChau12/Gmail-AI-Assistant.git
cd Gmail-AI-Assistant
npm install
```

> `better-sqlite3` có sẵn bản build cho các nền tảng phổ biến. Nếu `npm install` phải tự biên dịch và bị lỗi, hãy cài công cụ build (Windows: "Desktop development with C++" trong Visual Studio Build Tools; macOS: `xcode-select --install`) rồi chạy lại `npm install`.

### 2. Tạo Gmail App Password

1. Mở <https://myaccount.google.com/security> và kiểm tra **Xác minh 2 bước** đã bật.
2. Vào <https://myaccount.google.com/apppasswords>.
3. Đặt tên, ví dụ `Inbox Assistant`, rồi bấm **Tạo**.
4. Sao chép mật khẩu 16 ký tự. Dán có hoặc không có dấu cách đều được.

> **Tài khoản Workspace (trường học, công ty):** quản trị viên có thể đã tắt App Password. Nếu trang báo "không khả dụng", hãy hỏi quản trị viên hoặc dùng Gmail cá nhân.

### 3. Lấy OpenAI API key

Tạo key tại <https://platform.openai.com/api-keys>. Với mô hình mặc định `gpt-4o-mini`, xử lý vài trăm thư chỉ tốn vài cent.

### 4. Cấu hình `.env`

```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

Điền ba giá trị bắt buộc:

```env
GMAIL_ADDRESS=ban@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
OPENAI_API_KEY=sk-...
```

Các tuỳ chọn khác:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `YOUR_NAME` | — | Dùng trong lời chào và để ký tên cuối thư nháp của AI. Nếu để trống, thư nháp kết thúc không có tên. |
| `APP_LANGUAGE` | `vi` | Ngôn ngữ ban đầu (`vi` hoặc `en`), đồng thời là ngôn ngữ của bộ danh mục mặc định. Có thể đổi sau trong app. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Mô hình dùng cho phân loại, trợ lý và soạn thư. |
| `OPENAI_BASE_URL` | OpenAI | Bất kỳ endpoint nào tương thích API OpenAI. |
| `SYNC_INITIAL_LIMIT` | `200` | Số thư mới nhất được nhập trong lần sync đầu tiên. |
| `DATABASE_PATH` | `data/inbox.db` | Vị trí file SQLite. |

### 5. Chạy

```bash
npm run dev
```

Mở <http://localhost:3000>. Lần sync đầu tiên tự chạy và nhập `SYNC_INITIAL_LIMIT` thư mới nhất. Tóm tắt hiện dần trong lúc chạy; 200 thư mất khoảng một phút. Sau đó app tự sync 5 phút một lần khi tab đang mở. Bạn cũng có thể bấm vào thẻ đồng bộ ở cuối sidebar.

Để dùng hằng ngày, bản build production chạy nhanh hơn:

```bash
npm run build
npm start
```

Nếu thiếu giá trị bắt buộc, app sẽ hiện màn hình hướng dẫn, ghi rõ biến nào còn thiếu, thay vì bị lỗi.

## Sử dụng

Sidebar có bốn mục:
- **Hôm nay** (`/`) là trang tổng quan.
- **Hộp thư** (`/inbox`) gồm danh sách và khung đọc thư. Thêm `?category=` để mở một danh mục, hoặc `?view=action` để xem **Cần xử lý**.
- **Trợ lý AI** (`/assistant`) là trang chat, có lưu lại các cuộc trò chuyện.
- **Thư nháp** liệt kê các bản nháp được lưu từ trình soạn thảo.

| Phím | Thao tác |
| --- | --- |
| `j` / `k` (hoặc `↓` / `↑`) | Thư sau / trước |
| `e` | Lưu trữ |
| `#` | Xoá (chuyển vào Thùng rác) |
| `s` | Gắn / bỏ sao |
| `u` | Đánh dấu chưa đọc |
| `r` | Chuyển tới khung trả lời |
| `c` | Soạn thư |
| `/` | Tìm kiếm |
| `g` rồi `t` / `i` / `a` | Tới Hôm nay / Hộp thư / Cần xử lý |
| `⌘K` / `Ctrl+K` | Bảng lệnh (thao tác, điều hướng, tìm thư) |
| `⌘J` / `Ctrl+J` | Mở trợ lý |
| `⌘↵` / `Ctrl+Enter` | Gửi |
| `,` | Cài đặt |

**Dạy AI phân loại.** Đổi danh mục của một thư bằng nút danh mục trên thanh công cụ của khung đọc. Thư sau này từ người gửi đó sẽ bỏ qua bước phân loại của AI và vào thẳng danh mục ấy. Trong **Cài đặt → Danh mục**, bạn có thể đổi tên, chọn màu và icon, và sửa mô tả mà AI dựa vào để xếp thư. Sau khi sửa mô tả, bấm **Chạy lại AI cho mọi thư**.

**Trả lời.** Với thư đang chờ bạn trả lời, khung trả lời gợi ý ba câu trả lời ngắn. Bấm vào một gợi ý thì AI sẽ viết thành thư hoàn chỉnh. Bạn cũng có thể gõ ý chính rồi bấm **Viết bằng AI**. Nút mở rộng sẽ mở trình soạn thảo đầy đủ.

**Trợ lý.** Hỏi kiểu "tuần này ai đang chờ mình trả lời?", "sắp tới có hạn chót nào không?" hay "soạn trả lời thư mới nhất của Linh". Trợ lý có thể tìm thư (toàn văn, người gửi, danh mục, ngày, chưa đọc, cần xử lý), đọc một thư, thống kê hộp thư và viết thư nháp. Trợ lý không gửi được thư: chỉ bạn mới bấm Gửi.

## Cách hoạt động

```
Gmail ─IMAP─▶ sync engine ─▶ SQLite (thư + chỉ mục FTS5) ◀─ API routes ◀─ React UI
                  │                                            │
                  └─▶ triage (1 lần gọi LLM / thư) ────────────┘
                                                   trợ lý (tool calling) ─▶ SQLite
```

**Sync** (`src/server/sync.ts`) chỉ chạy một lượt tại một thời điểm. Nhiều tab hay nhiều lần bấm sẽ nhập chung vào lượt đang chạy.

1. **Snapshot.** Lấy UID và cờ trạng thái của mọi thư trong INBOX. Mỗi thư chỉ tốn vài byte.
2. **Tải.** Chỉ tải nội dung đầy đủ của các UID lớn hơn UID đã sync gần nhất, mỗi lô 25 thư, rồi parse bằng `mailparser`.
3. **Đồng bộ trạng thái.** Áp dụng thay đổi đã đọc/gắn sao từ Gmail và ẩn những thư đã được lưu trữ hoặc xoá ở ứng dụng khác.
4. **Triage.** Mỗi thư mới cần một lần gọi structured output, chạy song song 4 lần gọi. Kết quả gồm danh mục, mức ưu tiên, tóm tắt, thư có cần trả lời không, hạn chót và tối đa ba việc cần làm. Trạng thái triage lưu riêng cho từng thư, nên nếu bị ngắt giữa chừng thì lần sync sau sẽ làm tiếp.

Nếu Gmail đặt lại `UIDVALIDITY` của thư mục, bản sao cục bộ của thư mục đó sẽ được dựng lại.

**Thao tác** như đọc, gắn sao, lưu trữ, xoá được ghi vào SQLite trước để giao diện phản hồi ngay, rồi lệnh IMAP mới chạy. Nếu lệnh IMAP lỗi, snapshot ở lần sync sau sẽ đưa bản cục bộ về khớp với Gmail.

**Tìm kiếm** dùng SQLite FTS5 có bỏ dấu, nên gõ `thong bao` vẫn tìm ra `thông báo`.

**Thay đổi schema** là các migration đánh số trong `src/server/db.ts`, tự áp dụng khi khởi động. Khi nâng cấp từ bản cũ, thư của bạn được giữ nguyên. Riêng bước triage sẽ chạy lại một lần, tức mỗi thư đã lưu tốn một lần gọi AI.

### Cấu trúc thư mục

```
src/
├── app/
│   ├── (app)/           Hôm nay (page.tsx), inbox/, assistant/ — dùng chung layout có sidebar
│   └── api/             Các route JSON và streaming cho giao diện
├── components/
│   ├── shell/           Khung app: sidebar, state chung, phím tắt, các hộp thoại
│   ├── today/           Trang Hôm nay
│   ├── inbox/           Danh sách thư, khung đọc, trả lời nhanh
│   └── assistant/       Trang chat và thẻ thư nháp sửa được
├── lib/                 Code dùng chung phía client: types, i18n, định dạng, icon/màu danh mục
└── server/              Code chỉ chạy trên server
    ├── db.ts            Kết nối SQLite + migration
    ├── repo.ts          Toàn bộ truy vấn
    ├── mail.ts          IMAP / SMTP (imapflow, mailparser, nodemailer)
    ├── sync.ts          Pipeline đồng bộ
    ├── ai.ts            Triage, gợi ý trả lời, viết thư nháp
    └── assistant.ts     Chat agent dùng tool calling
site/                    Trang giới thiệu tĩnh, deploy lên GitHub Pages
```

## Dùng mô hình khác

Server nào hỗ trợ API Chat Completions của OpenAI, có tool calling và JSON-schema output đều dùng được:

```env
# Ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
OPENAI_MODEL=qwen2.5:14b
```

Mô hình chạy local cỡ nhỏ chọn tool cho trợ lý kém hơn rõ rệt. Phần triage chạy tốt trên đa số mô hình từ 7B trở lên.

## Quyền riêng tư

- Thư chỉ được lưu trong `data/inbox.db` trên máy bạn. Xoá file này là xoá dữ liệu.
- Tiêu đề, người gửi và khoảng 3.000 ký tự đầu của mỗi thư mới được gửi tới nhà cung cấp mô hình để triage. Câu hỏi cho trợ lý và các thư liên quan cũng được gửi đi. Nếu không muốn vậy, hãy trỏ `OPENAI_BASE_URL` tới một mô hình chạy local.
- Thư HTML được hiển thị trong iframe sandbox, không cho chạy script. Ảnh từ bên ngoài vẫn được tải, giống như trên Gmail.
- App không có đăng nhập vì chỉ được thiết kế để chạy ở `localhost`. **Đừng deploy app lên server công khai.** Bất kỳ ai truy cập được đều có thể đọc và gửi thư của bạn. (Trang giới thiệu trong `site/` là trang tĩnh, không chứa code app hay dữ liệu.)

## Trang giới thiệu

`site/` là trang HTML/CSS/JS thuần, không cần bước build. `.github/workflows/pages.yml` sẽ đăng trang lên GitHub Pages mỗi khi `site/` thay đổi trên nhánh `main`. Thiết lập một lần: trong repo, vào **Settings → Pages → Source** và chọn **GitHub Actions**. Để xem thử trên máy, chạy `npx serve site` hoặc mở thẳng `site/index.html`.

## Xử lý sự cố

| Vấn đề | Cách xử lý |
| --- | --- |
| Màn hình cài đặt không biến mất | Khởi động lại `npm run dev` sau khi sửa `.env`. Next.js chỉ đọc file này lúc khởi động. |
| `Invalid credentials` / `AUTHENTICATIONFAILED` | Dùng App Password, không phải mật khẩu Google. Nếu không chắc, hãy tạo mật khẩu mới. |
| Trang App Password báo "không khả dụng" | Bật Xác minh 2 bước. Quản trị viên Workspace có thể chặn App Password. |
| Sync dừng với lỗi `429` / `401` | Hết hạn mức hoặc sai OpenAI key. Thư vẫn nằm trong hàng đợi và sẽ được triage ở lần sync sau. |
| Tóm tắt sai ngôn ngữ | Đổi ngôn ngữ trong Cài đặt, rồi bấm **Chạy lại AI cho mọi thư**. |
| "Cần xử lý" hiện thư cũ hoặc thiếu thư | Mục này chứa thư chưa trả lời, cần trả lời hoặc quan trọng, có hạn chót quá hạn không quá 3 ngày, hoặc nhận trong 14 ngày gần đây. Lưu trữ hoặc trả lời từ app để thư rời danh sách. |
| Muốn làm lại từ đầu | Dừng server và xoá thư mục `data/`. |
| Xem trợ lý gọi tool như thế nào | Chạy `DEBUG_ASSISTANT=1 npm run dev`. |

## Lệnh

```bash
npm run dev        # server phát triển, tự reload
npm run build      # build production
npm start          # chạy bản build production
npm run lint       # ESLint
npm run typecheck  # kiểm tra TypeScript
```
