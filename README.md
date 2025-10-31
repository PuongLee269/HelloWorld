# HelloWorld

## Cấu hình nền giao diện

Trong `index.html`, vùng cấu hình (`CONFIG`) hỗ trợ tùy biến nền thông qua khóa `BACKGROUND_THEME`.

```js
const CONFIG = {
  BACKGROUND_THEME: {
    appDefaultBgUrl: 'linear-gradient(...)',
    heroByLevel: [
      {
        minLevel: 1,
        maxLevel: 3,
        heroBgUrl: 'https://example.com/hero-background.png',
        appBgUrl: 'linear-gradient(...)'
      }
    ]
  }
};
```

- `appDefaultBgUrl`: nền mặc định cho toàn ứng dụng khi không có override khác.
- `heroByLevel`: danh sách các preset nền cho hero, xét theo level (`level`, `levels`, hoặc cặp `minLevel`/`maxLevel`).
  - `heroBgUrl`: giá trị CSS hợp lệ cho `background-image` của hero (chấp nhận `url(...)`, `linear-gradient(...)`, v.v.).
  - `appBgUrl`: (tùy chọn) nền đồng bộ cho toàn app khi hero ở preset đó.

Các giá trị nền có thể là URL ảnh (`https://...`, `data:`) hoặc bất kỳ CSS background hợp lệ nào như gradient. Nếu cung cấp chuỗi URL thô, ứng dụng sẽ tự bọc lại thành `url('...')`.
