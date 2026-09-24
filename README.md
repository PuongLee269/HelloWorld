# Mori Quest — Life RPG MVP

Mori Quest biến Task hằng ngày thành vòng lặp RPG: AI tạo nội dung → người dùng dán vào → app phân loại theo tag → Complete → XP/6 Stats/Level và lịch sử.

## Chạy

App tĩnh, mở index.html qua GitHub Pages hoặc static web server. Có ba tab:

1. **Task** — chỉ hiển thị các Task hôm nay, tag, độ khó, XP/Stats dự kiến, nút Hoàn thành/Bỏ qua.
2. **Chỉ số** — Level, XP tới Level kế tiếp, radar 6 Stats, Growth 7/30 ngày và history.
3. **Nạp Quest & Task** — prompt ngữ cảnh để sao chép vào ChatGPT và ô dán JSON hoặc danh sách Task có gắn thẻ.

## Luồng tạo nội dung AI

Không có kết nối model/API trực tiếp trong MVP. Chọn **Sao chép prompt AI**, gửi prompt trong ChatGPT, rồi dán JSON trả về vào tab Nạp Quest & Task. Prompt mang theo tên, mục tiêu, Quest hiện tại, Stats, completion rate, Task đã bỏ qua, Growth và lịch sử gần đây.

AI cần trả về JSON theo dạng:

    {
      "mainQuest": {"title": "Xây kênh cá nhân", "description": "Mục tiêu dài hạn"},
      "weeklyQuests": [{"title": "Đăng 3 video", "target": 3, "mainQuest": "Xây kênh cá nhân"}],
      "tasks": [{
        "title": "Hoàn thiện một Short",
        "description": "Chỉnh sửa và xuất bản video",
        "category": "YouTube",
        "tags": ["SI", "EN", "YouTube"],
        "difficulty": "Normal",
        "mainQuest": "Xây kênh cá nhân",
        "weeklyQuest": "Đăng 3 video",
        "reason": "Đưa mục tiêu tuần tiến lên"
      }]
    }

Có thể dùng văn bản gắn thẻ thay JSON:

    [MAIN QUEST] Xây kênh cá nhân
    [WEEKLY QUEST] Đăng 3 video
    [TASK] Hoàn thiện một Short
    Tags: SI, EN, YouTube
    Difficulty: Normal
    Description: Chỉnh sửa và xuất bản video
    Main Quest: Xây kênh cá nhân
    Weekly Quest: Đăng 3 video
    Reason: Đưa mục tiêu tuần tiến lên

Mỗi Task cần 1–3 tag Stat chính xác trong SI, STR, EN, VIT, EQ, Y; tag chủ đề có thể thêm tự do. App bỏ qua XP và statEffects do AI gửi, tự tính từ tag và Difficulty để đảm bảo kết quả nhất quán. Tag được nhận diện qua mã Stat và alias tiếng Anh/Việt được liệt kê trong life-rpg-engine.js. Nếu thiếu tag Stat hợp lệ, app mặc định EN +1 và báo số Task dùng mặc định. Mỗi ngày tối đa 20 Task; tiêu đề trùng trong ngày được bỏ qua.

## Quy tắc điểm

- Easy: 15 XP; Stat tag thứ nhất +1, thứ hai +1.
- Normal: 30 XP; +2, +1.
- Hard: 55 XP; +3, +2, +1.
- Epic: 85 XP; +4, +3, +2.
- Chỉ áp điểm cho tối đa ba Stat tag đầu tiên.
- Hoàn thành Task chỉ áp dụng một lần; lần hoàn thành thứ 6 trong ngày cộng thêm 3 XP.
- Qua ngày mà không hoàn thành Task nào: trừ 6 XP khi app hoạt động trở lại.
- Level tách khỏi Stats; XP cần cho Level kế tiếp là 100 + 50 × (Level - 1).
- VIT chỉ là chỉ số game hóa, không phải chẩn đoán sức khỏe hay đo tuổi sinh học.

## Dữ liệu

life-rpg.js quản lý ba tab, nhập Quest/Task, tính thưởng, Level, history và lưu cục bộ. life-rpg-engine.js chứa parser, alias tag, bảng điểm và quy tắc/prompt AI. Dữ liệu nằm trong Local Storage (tq_liferpg_state_v1); tên/Level/XP được mirror sang tq_profile cho hero Mori Quest. Sao lưu/truyền dữ liệu có thể bổ sung trong phiên bản tiếp theo.
