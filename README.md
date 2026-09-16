# MinhSoora — Live Chat Overlay (React + Vercel, 1 project duy nhất)

Toàn bộ overlay (giao diện React) và proxy CORS (serverless API) nằm chung 1 project Vercel.
Vì cùng domain nên frontend gọi API bằng đường dẫn tương đối `/api?url=...` — **không cần** cấu hình hay đổi URL proxy sau khi deploy.

## Cấu trúc

```
├── api/
│   └── index.js        # Serverless function: proxy lấy HTML YouTube (tránh CORS)
├── src/
│   ├── App.jsx          # Toàn bộ logic overlay (tìm kênh, kiểm tra live, đếm ngược, chuyển hướng...)
│   ├── App.css           # Gradient chữ chạy liên tục + hiệu ứng slide up/down khi đổi trạng thái
│   ├── i18n.js            # Bản dịch vi/en
│   └── main.jsx            # Entry point React
├── index.html               # Entry HTML cho Vite
├── vite.config.js
├── vercel.json
└── package.json
```

## Cài đặt & chạy thử local

```bash
npm install

# Cách 1 (khuyên dùng): chạy cả frontend lẫn API cùng lúc như trên Vercel
npx vercel dev

# Cách 2: chỉ chạy frontend (API /api sẽ không hoạt động ở chế độ này)
npm run dev
```

## Deploy lên Vercel

1. Đẩy toàn bộ thư mục này lên 1 repo GitHub.
2. Vào https://vercel.com → **Add New Project** → import repo đó → Deploy.
3. Vercel tự nhận diện Vite (build `npm run build`, output `dist/`) và tự nhận `api/index.js` thành endpoint `/api`.
4. Xong — cả trang overlay lẫn proxy đều chạy trên cùng 1 domain, ví dụ:
   ```
   https://ten-du-an-cua-ban.vercel.app/?id=UCEcZC1dyDrhWueALsmutdHA
   ```

## Cách dùng overlay (OBS Browser Source)

Thêm `?id=` vào cuối URL, giá trị là:
- Channel ID (dạng `UCxxxxxxxxxxxxxxxxxxxxxx`), hoặc
- Handle kênh (`@ten-kenh` hoặc `ten-kenh`)

Ví dụ:
```
https://ten-du-an-cua-ban.vercel.app/?id=@ten-kenh-cua-ban
```

Không có `?id=` → chỉ hiện ảnh tĩnh (trạng thái idle), không chạy logic gì.
