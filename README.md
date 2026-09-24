# Mori Quest — Life RPG MVP

MVP biến task hằng ngày thành vòng lặp RPG: Profile/Goals → Daily Tasks → Complete/Skip → Stats + XP → Level và history.

## Chạy

Đây là app tĩnh, không cần build. Mở `index.html` qua GitHub Pages hoặc một static web server. Trên Dashboard, cập nhật Main Quest/Weekly Quest và Goals trong tab Profile & Quests; task sẽ được tạo tự động. Có thể tạo thêm tối đa 20 task/ngày hoặc tự thêm một Daily Task.

## Các module mới

- `life-rpg.js`: dashboard, hồ sơ/quest, complete/skip, XP/Level, radar, history, backup và lưu trữ.
- `life-rpg-engine.js`: schema task, context builder boundary và bộ tạo task local thích ứng. Thay `generateWithProvider()` để nối model/API khác.
- `index.html`: giữ giao diện Mori Quest hiện có, chuyển dashboard/task rendering sang MVP và nạp hai module mới.

## Lưu dữ liệu

Nguồn dữ liệu MVP nằm trong Local Storage tại `tq_liferpg_state_v1`; mọi task, Stat, XP, quest và event history được ghi chung trong một state để thao tác Complete không cộng XP hai lần. Level/XP/tên được mirror sang `tq_profile` để tương thích với hero và đồng bộ hồ sơ cũ.

Dữ liệu hiện lưu trên thiết bị/trình duyệt. Dùng nút **Tải backup** trong Profile & Quests để xuất JSON; **Phục hồi backup** nạp lại bản xuất. Xóa browser storage sẽ xóa tiến trình nếu chưa có backup.

## Daily Task AI

Không cần API để dùng MVP. Engine local đề xuất tối đa 8 task mỗi lần, cho phép tối đa 20 task/ngày, ưu tiên Stats yếu hơn, goals, Main/Weekly Quest và lịch sử hoàn thành/bỏ qua. Danh sách mẫu lặp lại được sau một tuần.

Có thể điền **AI Task endpoint** trong Profile & Goals. Endpoint nhận POST JSON gồm `schema: life-rpg-daily-tasks.v1`, `requestedCount`, `taskDate`, `context`, `responseFormat`, và trả về mảng task hoặc object `{ "tasks": [...] }`. Endpoint cần hỗ trợ CORS khi app chạy trên domain khác. Nếu endpoint lỗi, app tự dùng generator local. Không gửi khóa API từ trình duyệt; endpoint thật nên chạy qua backend.

Task có schema gồm id, title, description, category/tags, difficulty, XP, statEffects (tối đa 3 Stats), status, createdAt/taskDate/completedAt, mainQuestId/weeklyQuestId và reason. VIT chỉ là chỉ số mô phỏng trong game, không phải chẩn đoán sức khỏe.

## Cách tính

- XP theo độ khó: Easy 15, Normal 30, Hard 55, Epic 85; công thức XP lên Level: `100 + 50 × (Level - 1)`.
- Complete cộng XP và Stat theo task; complete lặp lại không được thưởng lần nữa.
- Đạt 6 task hoàn thành trong ngày nhận thêm 3 XP.
- Ngày không hoàn thành task nào bị trừ 6 XP khi app mở lại qua ngày.
- Radar hiển thị Stats hiện tại và Growth 7/30 ngày từ event history.
