# MinhSoora — Live Chat Overlay

Overlay tự động mở khung chat YouTube khi kênh của bạn bắt đầu livestream — dùng làm **Browser Source** trong OBS (hoặc bất kỳ phần mềm stream nào khác).

## Overlay này làm gì?

Bạn cắm URL overlay vào OBS. Khi bạn **chưa** stream, overlay chỉ hiện một ảnh tĩnh, không làm gì cả. Ngay khi bạn **bắt đầu livestream** trên YouTube, overlay tự phát hiện và chuyển sang khung chat trực tiếp của video đó — không cần bạn phải tự tay dán lại link mỗi lần lên sóng.

## Cách sử dụng

### 1. Lấy link overlay

Thêm tham số `?id=` vào cuối domain overlay, giá trị là kênh YouTube của bạn:

```
https://youtube-live-chatbox-fetcher.vercel.app/?id=@ten-kenh-cua-ban
```

`id` có thể là:
| Dạng | Ví dụ |
|---|---|
| Handle kênh (có hoặc không có `@`) | `?id=@ten-kenh-cua-ban` hoặc `?id=ten-kenh-cua-ban` |
| Channel ID (24 ký tự, bắt đầu bằng `UC`) | `?id=UCEcZC1dyDrhWueALsmutdHA` |  

Ví dụ:  
```
https://youtube-live-chatbox-fetcher.vercel.app/?id=MinhSoora
```

> Không thêm `?id=` → overlay chỉ hiện ảnh tĩnh, không chạy logic tìm kênh/kiểm tra live nào cả (trạng thái nghỉ).

### 2. Gắn vào OBS

1. Trong OBS: **Sources → + → Browser**.
2. Dán link ở bước 1 vào ô **URL**.
3. Đặt kích thước bằng đúng độ phân giải canvas của bạn (ví dụ 1920×1080).
4. Trong tab **Properties**, mở **Page permissions** và chọn **Read OBS Data** — bước này giúp overlay biết chính xác lúc nào bạn nhấn "Start Streaming" thay vì phải tự đoán qua YouTube.

### 3. Bắt đầu stream như bình thường

Bấm **Start Streaming** trên OBS và bắt đầu phát trên YouTube. Overlay sẽ tự lo phần còn lại — không cần thao tác gì thêm trên overlay.

## Overlay hoạt động như thế nào?

Khi trang được mở với `?id=...`, overlay chạy tuần tự qua các bước sau, mỗi bước hiện 1 dòng trạng thái ngắn (chữ có gradient chạy, trượt lên/xuống mỗi khi đổi):

1. **Nhận diện ngôn ngữ** — overlay tra IP người xem để tự chọn tiếng Việt hoặc tiếng Anh cho các dòng trạng thái.
2. **Tìm kênh** — nếu bạn nhập handle (`@ten-kenh`), overlay tự tra ra Channel ID thật đằng sau nó. Nếu bạn nhập sẵn Channel ID (`UC...`), bước này được bỏ qua.
   - Không tìm thấy kênh → overlay báo lỗi và hiện luân phiên 2 dòng ví dụ URL đúng để bạn đối chiếu.
3. **Chờ OBS xác nhận đang stream** (nếu overlay được nhúng trong OBS và đã cấp quyền *Read OBS Data*) — tránh việc overlay đi tìm livestream khi bạn còn chưa bấm Start Streaming.
4. **Kiểm tra kênh có đang livestream không** — overlay gọi tới link `/channel/{id}/live` của kênh qua một proxy riêng (để vượt giới hạn CORS của trình duyệt) và tìm tín hiệu "đang live" trong trang.
   - **Có livestream** → overlay lấy `videoId`, hiện dòng "đã tìm thấy livestream" rồi tự chuyển hướng sang khung live chat popup của YouTube (`youtube.com/live_chat?is_popout=1&v=...`).
   - **Chưa có livestream** → overlay đếm ngược (mặc định 6 giây) rồi tự thử lại, lặp lại cho đến khi tìm thấy.
5. **Ở màn hình chat** — từ lúc này overlay không còn việc gì để làm nữa, khung chat của YouTube tự cập nhật bình thường.

### Vì sao cần proxy riêng?

Trình duyệt không cho phép JavaScript đọc thẳng nội dung trang YouTube từ một domain khác (giới hạn CORS). Overlay giải quyết việc này bằng một serverless function nhỏ (`/api`) nằm chung server với overlay: overlay gọi `/api?url=<link YouTube>`, function tải trang đó ở phía server rồi trả HTML về cho overlay đọc.

### Log lỗi

Nếu có sự cố (mất mạng, timeout, không tìm thấy kênh...), bên dưới dòng trạng thái sẽ xuất hiện nút **"Xem chi tiết lỗi"** — bấm vào để xem log kỹ thuật (thời gian, loại lỗi) mà không làm rối giao diện chính.

## Câu hỏi thường gặp

**Overlay không tự chuyển sang chat dù tôi đang live?**
Kiểm tra lại `?id=` đã đúng kênh chưa, và chờ hết một vòng đếm ngược (mặc định 6 giây/lần thử). Có thể xem log lỗi để biết chi tiết.

**Overlay báo "đang chờ OBS bắt đầu livestream" dù tôi đã bấm Start Streaming?**
Vào lại **Properties** của Browser Source trong OBS, kiểm tra **Page permissions** đã đặt **Read OBS Data** chưa.

**Dùng được cho phần mềm stream khác ngoài OBS không?**
Được — chỉ cần phần mềm đó hỗ trợ nhúng Browser Source/webview, overlay vẫn hoạt động bình thường (trừ bước 3 dựa vào API riêng của OBS, khi đó overlay sẽ tự bỏ qua bước này và kiểm tra live theo chu kỳ đếm ngược như thường lệ).
