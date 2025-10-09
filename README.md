# 📧 Gmail AI Assistant

<div align="center">

![Gmail AI Assistant](https://img.shields.io/badge/Gmail-AI%20Assistant-blue?style=for-the-badge&logo=gmail)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-green?style=for-the-badge&logo=openai)

**Trợ lý AI thông minh giúp bạn quản lý email Gmail một cách hiệu quả**

[Demo](#demo) • [Tính năng](#tính-năng) • [Cài đặt](#cài-đặt) • [Sử dụng](#sử-dụng)

</div>

---

## ✨ Tính năng

### 🤖 Trò chuyện với AI
- Chat với AI về email của bạn bằng ngôn ngữ tự nhiên
- Hiểu ngữ cảnh và trả lời thông minh
- Hỗ trợ Markdown trong câu trả lời

### 🔍 Tìm kiếm thông minh
- Tìm email nhanh chóng với AI hiểu ngữ cảnh
- Lọc theo người gửi, chủ đề, thời gian
- Tìm kiếm semantic (hiểu ý nghĩa)

### ✍️ Soạn thảo email
- AI viết email chuyên nghiệp
- Trả lời tự động dựa trên ngữ cảnh
- Hỗ trợ nhiều phong cách viết

### 📊 Phân tích & Tóm tắt
- Tóm tắt nội dung email dài
- Thống kê inbox
- Phân loại email tự động

### 🎨 Giao diện đẹp mắt
- Dark/Light mode
- Responsive design
- Animations mượt mà
- Drag & resize chatbox

---

## 🎥 Demo

Truy cập `/homepage` để xem landing page showcase!

### Screenshots

```
📸 Thêm screenshots của bạn vào đây
```

---

## 🚀 Cài đặt

### Yêu cầu hệ thống

- Node.js >= 18.0.0
- npm hoặc yarn
- Tài khoản Gmail
- OpenAI API Key
- Supabase account

### Bước 1: Clone repository

```bash
git clone https://github.com/KhangChau12/gmail-ai-assistant.git
cd gmail-ai-assistant
```

### Bước 2: Cài đặt dependencies

```bash
npm install
# hoặc
yarn install
```

### Bước 3: Cấu hình môi trường

1. Copy file `.env.example` thành `.env`:
```bash
cp .env.example .env
```

2. Điền thông tin vào file `.env`:

#### 🗄️ Supabase Database

1. Tạo project tại [supabase.com](https://supabase.com)
2. Lấy **Project URL** và **API Keys** từ Settings > API
3. Điền vào `.env`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

#### 📧 Gmail App Password

1. Bật 2-Step Verification cho Gmail
2. Truy cập [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Tạo App Password mới cho "Mail"
4. Điền vào `.env`:
```env
GMAIL_ADDRESS=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_16_character_password
```

#### 🤖 OpenAI API

1. Đăng ký tại [platform.openai.com](https://platform.openai.com)
2. Tạo API Key tại [API Keys page](https://platform.openai.com/api-keys)
3. Điền vào `.env`:
```env
OPENAI_API_KEY=your_openai_api_key
```

#### 🔐 NextAuth Secret

Tạo random string cho NextAuth:
```bash
openssl rand -base64 32
```
Hoặc dùng bất kỳ chuỗi ngẫu nhiên nào, rồi điền vào:
```env
NEXTAUTH_SECRET=your_random_secret_string
NEXTAUTH_URL=http://localhost:3000
```

### Bước 4: Setup Database

Chạy script để tạo các bảng trong Supabase:

```bash
npm run db:setup
```

Script này sẽ tạo các bảng:
- `emails` - Lưu trữ email
- `email_summary` - Thống kê email
- `contacts` - Danh bạ

### Bước 5: Chạy development server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) để xem kết quả!

---

## 📖 Sử dụng

### 1. Đồng bộ email

Khi vào trang chính, click vào **"Đồng bộ email"** để lấy email mới nhất từ Gmail.

### 2. Chat với AI

Click vào icon chatbox ở góc dưới bên phải và bắt đầu trò chuyện:

**Ví dụ câu hỏi:**
- "Tìm email từ John gửi tuần này"
- "Tóm tắt inbox của tôi"
- "Viết email cảm ơn cho khách hàng"
- "Có email quan trọng nào chưa đọc không?"

### 3. Soạn email

Click vào **"Soạn email"** hoặc yêu cầu AI viết email cho bạn.

### 4. Tìm kiếm

Sử dụng thanh search hoặc hỏi AI để tìm email cụ thể.

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **React Markdown** - Markdown rendering

### Backend
- **Next.js API Routes** - Server endpoints
- **ImapFlow** - Gmail IMAP connection
- **Nodemailer** - Send emails

### Database
- **Supabase** - PostgreSQL database
- **Supabase Storage** - File storage

### AI
- **OpenAI GPT-4** - Natural language processing
- **Streaming responses** - Real-time AI responses

---

## 📁 Cấu trúc project

```
gmail-ai-assistant/
├── app/
│   ├── api/              # API routes
│   │   ├── ai/          # AI chat endpoint
│   │   ├── db/          # Database operations
│   │   ├── emails/      # Email sync & management
│   │   └── gmail/       # Gmail send email
│   ├── homepage/        # Landing page showcase
│   └── page.tsx         # Main app page
├── components/
│   ├── ChatBox.tsx      # AI chatbox component
│   ├── EmailComposerWithChat.tsx
│   └── ...
├── lib/
│   ├── supabase.ts      # Supabase client
│   └── utils.ts         # Utility functions
├── types/
│   └── index.ts         # TypeScript types
├── scripts/
│   └── setup-db-fixed.js # Database setup script
├── .env.example         # Environment variables template
└── README.md            # You are here!
```

---

## 🎨 Customization

### Thay đổi theme colors

Chỉnh sửa `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#your-color',
        // ...
      }
    }
  }
}
```

### Thêm tính năng AI mới

Chỉnh sửa `app/api/ai/route.ts` để thêm prompts và logic mới.

---

## 🔒 Bảo mật

- ✅ Không lưu mật khẩu Gmail (chỉ dùng App Password)
- ✅ API Keys được giữ bí mật (server-side only)
- ✅ Supabase RLS (Row Level Security) enabled
- ✅ HTTPS cho production
- ⚠️ **QUAN TRỌNG**: Không commit file `.env` lên GitHub!

---

## 🐛 Troubleshooting

### Lỗi kết nối Gmail

```
Error: Invalid credentials
```

**Giải pháp:**
1. Kiểm tra App Password đã đúng chưa
2. Đảm bảo 2-Step Verification đã bật
3. Thử tạo App Password mới

### Lỗi OpenAI API

```
Error: Incorrect API key
```

**Giải pháp:**
1. Kiểm tra API Key từ [platform.openai.com](https://platform.openai.com/api-keys)
2. Đảm bảo tài khoản OpenAI còn credits
3. Kiểm tra format key (bắt đầu với `sk-`)

### Lỗi Supabase

```
Error: Invalid Supabase credentials
```

**Giải pháp:**
1. Kiểm tra URL và Keys từ Supabase dashboard
2. Chạy lại `npm run db:setup`
3. Kiểm tra RLS policies

---

## 🤝 Contributing

Contributions are welcome!

1. Fork repository
2. Tạo branch mới: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Tạo Pull Request

---

## 📝 License

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

## 👨‍💻 Author

**Your Name**

- GitHub: [@your-username](https://github.com/your-username)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) - GPT-4 API
- [Supabase](https://supabase.com) - Database & Auth
- [Next.js](https://nextjs.org) - React Framework
- [Lucide](https://lucide.dev) - Beautiful icons

---

<div align="center">

**⭐ Nếu project hữu ích, đừng quên để lại một star nhé! ⭐**

Made with ❤️ and ☕

</div>
