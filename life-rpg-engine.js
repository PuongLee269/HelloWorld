/* Life RPG daily-task engine.
 * Provider boundary: generateWithProvider() is the only function that needs
 * replacing when a hosted model/API is introduced. The local provider is usable offline.
 */
(function (root) {
  "use strict";

  const STAT_KEYS = ["SI", "STR", "EN", "VIT", "EQ", "Y"];
  const DIFFICULTY_XP = { Easy: 15, Normal: 30, Hard: 55, Epic: 85 };
  const STAT_COPY = {
    SI: "Tư duy, học tập và sáng tạo",
    STR: "Sức khỏe và thể lực",
    EN: "Sức bền và khả năng duy trì",
    VIT: "Vitality trong trò chơi",
    EQ: "Cân bằng cảm xúc",
    Y: "Nội tâm và sự tĩnh tâm"
  };
  const CATALOG = [
    { title:"Đọc hoặc học tập trung 20 phút", description:"Chọn một chủ đề đang phục vụ mục tiêu của bạn.", category:"Learning", tags:["learning","focus"], effects:{SI:2,EN:1}, difficulty:"Easy" },
    { title:"Viết lại một ý tưởng thành ghi chú ngắn", description:"Tóm tắt điều bạn vừa học bằng lời của mình.", category:"Learning", tags:["learning","writing"], effects:{SI:2,EQ:1}, difficulty:"Easy" },
    { title:"Hoàn thành một phiên làm việc tập trung 25 phút", description:"Chọn một việc quan trọng và tắt các xao nhãng.", category:"Work", tags:["focus","work"], effects:{EN:2,SI:1}, difficulty:"Normal" },
    { title:"Đi bộ nhẹ ngoài trời 15 phút", description:"Đi theo nhịp thoải mái, dừng lại nếu thấy không ổn.", category:"Movement", tags:["movement","recovery"], effects:{STR:2,VIT:1}, difficulty:"Easy" },
    { title:"Vận động có chủ đích trong 25 phút", description:"Chọn hoạt động phù hợp với thể trạng và không gian của bạn.", category:"Movement", tags:["movement","fitness"], effects:{STR:3,EN:1}, difficulty:"Normal" },
    { title:"Chuẩn bị một khoảng nghỉ không màn hình", description:"Để điện thoại sang bên và nghỉ ngơi có chủ đích.", category:"Recovery", tags:["recovery","routine"], effects:{VIT:2,EQ:1}, difficulty:"Easy" },
    { title:"Hoàn tất việc nhỏ bạn đã trì hoãn", description:"Chọn một việc có thể hoàn tất trong 15 phút.", category:"Consistency", tags:["consistency","focus"], effects:{EN:2,EQ:1}, difficulty:"Normal" },
    { title:"Viết vài dòng về cảm xúc hôm nay", description:"Ghi nhận điều đang diễn ra mà không cần phán xét.", category:"Reflection", tags:["reflection","wellbeing"], effects:{EQ:2,Y:1}, difficulty:"Easy" },
    { title:"Dành 10 phút tĩnh tâm hoặc cầu nguyện", description:"Chọn cách thực hành phù hợp với niềm tin của bạn.", category:"Reflection", tags:["reflection","mindfulness"], effects:{Y:2,EQ:1}, difficulty:"Easy" },
    { title:"Lên kế hoạch cho ba bước tiếp theo của mục tiêu", description:"Chuyển mục tiêu dài hạn thành các hành động nhỏ.", category:"Planning", tags:["planning","goals"], effects:{SI:2,EN:1}, difficulty:"Normal" },
    { title:"Hoàn thành một đầu việc quan trọng trong ngày", description:"Tập trung vào một kết quả cụ thể có thể kiểm tra.", category:"Work", tags:["work","consistency"], effects:{EN:2,SI:1}, difficulty:"Hard" },
    { title:"Chia sẻ hoặc hoàn thiện một sản phẩm sáng tạo", description:"Đưa một phần công việc sáng tạo đến trạng thái có thể xem được.", category:"Creativity", tags:["creativity","publishing"], effects:{SI:2,EN:2}, difficulty:"Hard" },
    { title:"Dành 30 phút làm bước tiếp theo của Main Quest", description:"Chọn một kết quả nhỏ có thể hoàn tất trong phiên này.", category:"Main Quest", tags:["goals","focus"], effects:{SI:2,EN:2}, difficulty:"Normal", questRelated:true },
    { title:"Thực hiện một phiên tập trung sâu 45 phút", description:"Chia phiên làm việc thành các phần nghỉ ngắn nếu cần.", category:"Focus", tags:["focus","consistency"], effects:{EN:3,SI:2}, difficulty:"Epic" }
  ];

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }

  function cleanEffects(value) {
    const source = value && typeof value === "object" ? value : {};
    const result = {};
    STAT_KEYS.forEach(function (key) {
      const delta = Math.round(clampNumber(source[key], 0, 5, 0));
      if (delta > 0) result[key] = delta;
    });
    return Object.keys(result).length <= 3 ? result : Object.fromEntries(Object.entries(result).slice(0, 3));
  }

  function normalizeTask(raw, index, context, date) {
    const item = raw && typeof raw === "object" ? raw : {};
    const difficulty = DIFFICULTY_XP[item.difficulty] ? item.difficulty : "Normal";
    const effects = cleanEffects(item.statEffects || item.effects);
    if (!Object.keys(effects).length) effects.EN = 1;
    const tags = Array.isArray(item.tags) ? item.tags.map(String).map(function (tag) { return tag.trim().slice(0, 40); }).filter(Boolean).slice(0, 8) : [];
    const mainQuest = context && context.mainQuest;
    return {
      id: String(item.id || ("task-" + Date.now() + "-" + index + "-" + Math.random().toString(36).slice(2, 8))),
      title: String(item.title || item.text || "Nhiệm vụ mới").trim().slice(0, 140),
      description: String(item.description || "").trim().slice(0, 240),
      category: String(item.category || "Daily").trim().slice(0, 48),
      tags: tags,
      difficulty: difficulty,
      xp: Math.round(clampNumber(item.xp, 1, 200, DIFFICULTY_XP[difficulty])),
      statEffects: effects,
      status: "pending",
      createdAt: item.createdAt || new Date().toISOString(),
      taskDate: date,
      completedAt: null,
      mainQuestId: item.mainQuestId || (mainQuest && mainQuest.id) || null,
      weeklyQuestId: item.weeklyQuestId || (context && context.weeklyQuest && context.weeklyQuest.id) || null,
      reason: String(item.reason || "Được chọn từ mục tiêu và thói quen của bạn.").trim().slice(0, 240)
    };
  }

  function preferenceScore(context, item) {
    const behavior = context && context.behavior || {};
    const category = behavior.categoryRates && behavior.categoryRates[item.category];
    const difficulty = behavior.difficultyRates && behavior.difficultyRates[item.difficulty];
    return (category ? category.rate * 2 : 0) + (difficulty ? difficulty.rate : 0);
  }

  function statFocus(context, item) {
    const stats = context && context.currentStats || {};
    const allValues = STAT_KEYS.map(function (key) { return Number(stats[key]) || 0; });
    const average = allValues.reduce(function (sum, value) { return sum + value; }, 0) / Math.max(1, allValues.length);
    const effects = item.effects;
    return Object.keys(effects).reduce(function (sum, key) {
      return sum + Math.max(-5, Math.min(10, average - (Number(stats[key]) || 0))) * effects[key];
    }, 0);
  }

  function goalScore(context, item) {
    const mainQuest = context && context.mainQuest;
    const goalText = [mainQuest && mainQuest.title, ...(context && context.goals || [])].join(" ").toLowerCase();
    const words = goalText.split(/[^a-z0-9\u00C0-\u024F]+/i).filter(function (word) { return word.length > 3; });
    const haystack = (item.title + " " + item.description + " " + item.tags.join(" ")).toLowerCase();
    return words.reduce(function (score, word) { return score + (haystack.includes(word) ? 4 : 0); }, item.questRelated ? 2 : 0);
  }

  function contextSummary(context) {
    const stats = context && context.currentStats || {};
    const weak = STAT_KEYS.slice().sort(function (a, b) { return (Number(stats[a]) || 0) - (Number(stats[b]) || 0); }).slice(0, 2);
    return weak;
  }

  function parseDate(value) {
    const parts = String(value || "").split("-").map(Number);
    if (parts.length !== 3) return new Date();
    return new Date(parts[0], parts[1]-1, parts[2]);
  }

  function generateLocal(context, count, date) {
    const history = Array.isArray(context && context.recentTaskHistory) ? context.recentTaskHistory : [];
    const currentDate = parseDate(date);
    currentDate.setDate(currentDate.getDate() - 7);
    const cutoffDate = currentDate.getFullYear() + "-" + String(currentDate.getMonth()+1).padStart(2,"0") + "-" + String(currentDate.getDate()).padStart(2,"0");
    const recentTitles = new Set(history.filter(function (event) {
      return (event.action === "completed" || event.action === "skipped") && String(event.date || "") >= cutoffDate;
    }).map(function (event) { return String(event.title || "").toLowerCase(); }));
    const available = CATALOG.filter(function (item) {
      return !recentTitles.has(item.title.toLowerCase());
    });
    const focus = contextSummary(context);
    available.sort(function (a, b) {
      return (statFocus(context, b) - statFocus(context, a)) +
        (goalScore(context, b) - goalScore(context, a)) +
        (preferenceScore(context, b) - preferenceScore(context, a)) +
        (focus.some(function (key) { return b.effects[key]; }) ? 0.5 : 0) -
        (focus.some(function (key) { return a.effects[key]; }) ? 0.5 : 0);
    });
    const chosen = available.slice(0, Math.max(0, count));
    const mainQuest = context && context.mainQuest;
    return chosen.map(function (item, index) {
      let title = item.title;
      let description = item.description;
      let reason = "Phù hợp với hồ sơ, chỉ số hiện tại và lịch sử hoạt động.";
      if (item.questRelated && mainQuest) {
        description = "Dành một phiên ngắn để làm bước tiếp theo: " + mainQuest.title + ".";
        reason = "Task này gắn trực tiếp với Main Quest hiện tại của bạn.";
      }
      return normalizeTask({
        title: title,
        description: description,
        category: item.category,
        tags: item.tags,
        difficulty: item.difficulty,
        xp: DIFFICULTY_XP[item.difficulty],
        statEffects: item.effects,
        reason: reason
      }, index, context, date);
    });
  }

  async function generateWithProvider(context, count, date, endpoint) {
    const url = String(endpoint || "").trim();
    if (!url) return generateLocal(context, count, date);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schema: "life-rpg-daily-tasks.v1",
        requestedCount: count,
        taskDate: date,
        context: context,
        responseFormat: {
          type: "array",
          maxItems: 20,
          fields: ["id", "title", "description", "category", "tags", "difficulty", "xp", "statEffects", "status", "createdAt", "taskDate", "completedAt", "mainQuestId", "reason"]
        },
        safety: "VIT is a game statistic, never a medical diagnosis. Do not create diagnostic or treatment advice."
      })
    });
    if (!response.ok) throw new Error("Task AI endpoint returned " + response.status);
    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : (Array.isArray(payload.tasks) ? payload.tasks : null);
    if (!items) throw new Error("Task AI response must contain a tasks array");
    return items.slice(0, count).map(function (task, index) { return normalizeTask(task, index, context, date); }).filter(function (task) { return task.title; });
  }

  function generate(context, count, date, endpoint) {
    const requested = Math.max(0, Math.min(20, Math.floor(Number(count) || 0)));
    return generateWithProvider(context || {}, requested, date || new Date().toISOString().slice(0, 10), endpoint);
  }

  root.LifeRpgTaskEngine = {
    statKeys: STAT_KEYS.slice(),
    statCopy: Object.assign({}, STAT_COPY),
    difficultyXp: Object.assign({}, DIFFICULTY_XP),
    normalizeTask: normalizeTask,
    generate: generate,
    generateLocal: generateLocal,
    schema: {
      version: "life-rpg-daily-tasks.v1",
      statuses: ["pending", "completed", "skipped"],
      maxDailyTasks: 20
    }
  };
})(window);
