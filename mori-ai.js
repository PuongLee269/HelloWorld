(function () {
  "use strict";

  const ENDPOINT_KEY = "mori_quest_ai_endpoint_v1";
  const TOKEN_KEY = "mori_quest_session_v1";
  const TURNSTILE_ACTION = "mori_quest_ai";
  let pendingPlan = null;
  let pendingAnswers = [];
  let turnstileWidget = null;
  let lastSiteKey = "";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  function endpointValue() {
    return String(localStorage.getItem(ENDPOINT_KEY) || "").trim().replace(/\/+$/, "");
  }

  function selectedContext(appState, form) {
    const context = {};
    if (form.elements.shareProfile.checked) {
      context.profile = { name: String(appState.user && appState.user.name || "").slice(0, 80) };
    }
    if (form.elements.shareGoals.checked) {
      context.goals = (appState.user && Array.isArray(appState.user.goals) ? appState.user.goals : []).slice(0, 10).map(x => String(x).slice(0, 300));
    }
    if (form.elements.shareQuests.checked) {
      context.quests = (appState.quests || []).filter(q => q.status === "active").slice(0, 12).map(q => ({
        type: q.type, title: String(q.title || "").slice(0, 120), description: String(q.description || "").slice(0, 240), target: q.target
      }));
      context.activePlan = (appState.taskRules || []).filter(r => r.status === "active").slice(0, 20).map(r => ({
        title: String(r.title || "").slice(0, 140), taskType: r.taskType, target: r.target, period: r.period, preferredTime: r.preferredTime, tags: (r.tags || []).slice(0, 8)
      }));
    }
    if (form.elements.shareStats.checked) {
      context.progress = { level: appState.level, xp: appState.xp, currentStats: appState.stats || {} };
    }
    if (form.elements.shareHistory.checked) {
      context.recentHistory = (appState.history || []).slice(-15).map(e => ({ action: e.action, date: e.date, title: String(e.title || "").slice(0, 140), reason: String(e.reason || "").slice(0, 160), xpDelta: e.xpDelta }));
    }
    return context;
  }

  function selectedLabels(form) {
    const labels = [];
    if (form.elements.shareProfile.checked) labels.push("tên hồ sơ");
    if (form.elements.shareGoals.checked) labels.push("mục tiêu");
    if (form.elements.shareQuests.checked) labels.push("Quest và kế hoạch");
    if (form.elements.shareStats.checked) labels.push("Level, XP và 6 chỉ số");
    if (form.elements.shareHistory.checked) labels.push("15 sự kiện lịch sử gần nhất");
    return labels;
  }

  function validateResponse(raw) {
    const parsed = window.LifeRpgTaskEngine.parse(JSON.stringify(raw));
    if (!parsed || !["NEED_INFO", "PLAN_READY"].includes(parsed.status)) throw new Error("AI trả dữ liệu không đúng cấu trúc.");
    if (parsed.status === "NEED_INFO") {
      if (!Array.isArray(parsed.questions) || parsed.questions.length < 3 || parsed.questions.length > 6 || parsed.questions.some(q => !String(q).trim() || String(q).length > 300)) {
        throw new Error("Phản hồi NEED_INFO cần có 3–6 câu hỏi ngắn.");
      }
      return { status: "NEED_INFO", questions: parsed.questions };
    }
    if (!raw.mainQuest || typeof raw.mainQuest !== "object" || !String(raw.mainQuest.title || "").trim()) throw new Error("Kế hoạch cần có mainQuest với tiêu đề.");
    if (!Array.isArray(raw.weeklyQuests) || !Array.isArray(raw.tasks) || raw.tasks.length < 1 || raw.tasks.length > 20) throw new Error("Kế hoạch cần có 1–20 Task và danh sách weeklyQuests hợp lệ.");
    const validTypes = ["daily", "weekly", "recurring", "one_time"];
    const validDifficulty = ["Easy", "Normal", "Hard", "Epic"];
    raw.tasks.forEach((task, index) => {
      if (!task || typeof task !== "object" || !String(task.title || "").trim() || String(task.title).length > 140) throw new Error("Task " + (index + 1) + " thiếu tiêu đề hợp lệ.");
      if (!validTypes.includes(task.taskType) || !validDifficulty.includes(task.difficulty)) throw new Error("Task " + (index + 1) + " có loại hoặc độ khó không hợp lệ.");
      const expectedPeriod = task.taskType === "daily" ? "day" : task.taskType === "weekly" ? "week" : "month";
      if (task.period !== expectedPeriod || !Number.isInteger(Number(task.target)) || Number(task.target) < 1 || Number(task.target) > 30) throw new Error("Task " + (index + 1) + " có mục tiêu/chu kỳ không hợp lệ.");
      if (!Array.isArray(task.tags) || task.tags.length < 1 || task.tags.length > 12 || !window.LifeRpgTaskEngine.statTags(task.tags).length) throw new Error("Task " + (index + 1) + " cần 1–12 tag, trong đó có ít nhất một tag chỉ số hợp lệ.");
      ["description", "category", "energyRole", "preferredTime", "mainQuest", "weeklyQuest", "reason"].forEach(key => {
        if (task[key] != null && String(task[key]).length > 300) throw new Error("Trường " + key + " của Task " + (index + 1) + " quá dài.");
      });
    });
    raw.weeklyQuests.forEach(q => { if (!q || !String(q.title || "").trim() || String(q.title).length > 120) throw new Error("Weekly Quest có tiêu đề không hợp lệ."); });
    return raw;
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-mori-turnstile]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("Không thể tải xác thực Turnstile.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true; script.defer = true; script.dataset.moriTurnstile = "true";
      script.onload = resolve; script.onerror = () => reject(new Error("Không thể tải xác thực Turnstile."));
      document.head.appendChild(script);
    });
  }

  async function getConfig(endpoint) {
    const response = await fetch(endpoint + "/api/config", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Không lấy được cấu hình Worker (HTTP " + response.status + ").");
    const config = await response.json();
    if (!config || !config.turnstileSiteKey) throw new Error("Worker chưa cấu hình Turnstile site key.");
    return config;
  }

  async function getTurnstileToken(siteKey, box) {
    await loadTurnstile();
    if (turnstileWidget !== null && lastSiteKey === siteKey) window.turnstile.remove(turnstileWidget);
    box.replaceChildren();
    lastSiteKey = siteKey;
    return new Promise((resolve, reject) => {
      let settled = false;
      turnstileWidget = window.turnstile.render(box, {
        sitekey: siteKey,
        action: TURNSTILE_ACTION,
        callback: token => { settled = true; resolve(token); },
        "expired-callback": () => { settled = true; reject(new Error("Mã xác thực đã hết hạn. Hãy thử lại.")); },
        "error-callback": () => { settled = true; reject(new Error("Xác thực Turnstile thất bại.")); }
      });
      setTimeout(() => { if (!settled) reject(new Error("Hãy hoàn tất xác thực chống spam trước khi gửi.")); }, 120000);
    });
  }

  function renderPlan(target, plan, contextLabels) {
    const tasks = plan.tasks || [];
    target.innerHTML = '<section class="rpg-panel"><h3>Xem trước kế hoạch AI</h3><p><b>Main Quest:</b> ' + escapeHtml(plan.mainQuest.title) + '</p><p><b>Weekly Quest:</b> ' + escapeHtml((plan.weeklyQuests || []).map(q => q.title).join(" · ") || "Không có") + '</p><ol>' + tasks.map(t => '<li><b>' + escapeHtml(t.title) + '</b> · ' + escapeHtml(t.taskType) + ' · ' + escapeHtml(t.difficulty) + '<br><span class="rpg-muted">' + escapeHtml(t.description || "") + ' · Tag: ' + escapeHtml((t.tags || []).join(", ")) + '</span></li>').join("") + '</ol><p class="rpg-muted">Dữ liệu đã gửi: ' + escapeHtml(contextLabels.join(", ") || "không chọn dữ liệu hồ sơ; chỉ có câu trả lời nếu có") + '.</p><div class="rpg-actions"><button type="button" class="btn-primary" id="mori-ai-apply">Thêm Quest & Task</button><button type="button" class="btn-ghost" id="mori-ai-discard">Bỏ bản xem trước</button></div></section>';
    target.querySelector("#mori-ai-apply").onclick = () => {
      try { const count = window.LifeRpg.importPaste(JSON.stringify(plan)); pendingPlan = null; pendingAnswers = []; target.innerHTML = '<p class="rpg-feedback">Đã thêm gói kế hoạch với ' + count + ' Task rule.</p>'; }
      catch (error) { target.insertAdjacentHTML("beforeend", '<p class="rpg-feedback" role="alert">' + escapeHtml(error.message || error) + '</p>'); }
    };
    target.querySelector("#mori-ai-discard").onclick = () => { pendingPlan = null; pendingAnswers = []; target.innerHTML = '<p class="rpg-muted">Đã bỏ bản xem trước và câu trả lời tạm.</p>'; };
  }

  function renderQuestions(target, questions, form, appState) {
    target.innerHTML = '<section class="rpg-panel"><h3>AI cần thêm thông tin</h3><ol>' + questions.map(q => '<li>' + escapeHtml(q) + '</li>').join("") + '</ol><label>Trả lời theo thứ tự câu hỏi<textarea id="mori-ai-answers" rows="5" maxlength="3000" placeholder="Mỗi dòng một câu trả lời"></textarea></label><div class="rpg-actions"><button type="button" class="btn-primary" id="mori-ai-answer">Gửi câu trả lời</button><button type="button" class="btn-ghost" id="mori-ai-clear">Xóa trao đổi tạm</button></div></section>';
    target.querySelector("#mori-ai-answer").onclick = () => {
      pendingAnswers = target.querySelector("#mori-ai-answers").value.split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 6);
      run(form, appState, target).catch(error => showError(target, error));
    };
    target.querySelector("#mori-ai-clear").onclick = () => { pendingAnswers = []; pendingPlan = null; target.replaceChildren(); };
  }

  function showError(target, error) {
    const box = target.querySelector("[data-ai-error]") || target;
    box.innerHTML = '<p class="rpg-feedback" role="alert">' + escapeHtml(error && error.message || error || "Có lỗi khi gọi AI.") + '</p>';
  }

  async function run(form, appState, resultTarget) {
    const endpoint = endpointValue();
    if (!endpoint || !/^https:\/\//i.test(endpoint)) throw new Error("Nhập URL HTTPS của Cloudflare Worker và lưu cấu hình trước.");
    const labels = selectedLabels(form);
    const context = selectedContext(appState, form);
    const answers = pendingAnswers.slice(0, 6).map(x => x.slice(0, 500));
    const preview = JSON.stringify({ context, answers }, null, 2);
    if (preview.length > 20000) throw new Error("Dữ liệu chia sẻ quá lớn. Bỏ chọn lịch sử hoặc rút gọn mục tiêu.");
    const confirmed = window.confirm("Sắp gửi dữ liệu đã chọn (" + (labels.join(", ") || "không có trường hồ sơ; chỉ câu trả lời tạm nếu có") + ") đến " + endpoint + " và nhà cung cấp AI. Bản xem trước đầy đủ của các trường đã chọn đang hiển thị ngay trong cửa sổ AI Quest. Tiếp tục?");
    if (!confirmed) return;

    const button = resultTarget.querySelector("#mori-ai-generate, #mori-ai-answer");
    if (button) { button.disabled = true; button.textContent = "Đang tạo kế hoạch…"; }
    try {
      const config = await getConfig(endpoint);
      const token = await getTurnstileToken(config.turnstileSiteKey, resultTarget.querySelector("#mori-ai-turnstile") || resultTarget);
      const sessionToken = sessionStorage.getItem(TOKEN_KEY);
      if (!sessionToken) throw new Error("Phiên đăng nhập đã hết. Tải lại ứng dụng và đăng nhập lại.");
      const response = await fetch(endpoint + "/api/quest-plan", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + sessionToken },
        body: JSON.stringify({ context, answers, turnstileToken: token })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Worker trả lỗi HTTP " + response.status + ".");
      const valid = validateResponse(payload.result);
      resultTarget.replaceChildren();
      if (valid.status === "NEED_INFO") renderQuestions(resultTarget, valid.questions, form, appState);
      else { pendingPlan = valid; renderPlan(resultTarget, valid, labels); }
    } catch (error) {
      if (button && button.isConnected) { button.disabled = false; button.textContent = button.id === "mori-ai-answer" ? "Gửi câu trả lời" : "Tạo bản xem trước"; }
      throw error;
    }
  }

  function render(appState, target) {
    target.innerHTML = '<div class="rpg-wrap"><section class="rpg-panel"><h3>Tạo Quest bằng AI</h3><p class="rpg-muted">Nhập URL Worker đã triển khai. Mặc định không chia sẻ dữ liệu hồ sơ; hãy chọn từng nhóm trước khi xem phần sẽ gửi. Khóa AI phải được đặt trong Worker, không nhập vào ứng dụng này.</p><form id="mori-ai-form" class="rpg-form"><label>Cloudflare Worker URL<input name="endpoint" type="url" inputmode="url" placeholder="https://mori-quest-ai.example.workers.dev" value="' + escapeHtml(endpointValue()) + '" required></label><button class="btn-ghost" type="button" id="mori-ai-save">Lưu URL Worker trên thiết bị này</button><fieldset><legend>Chọn dữ liệu chia sẻ (mặc định tắt)</legend><label><input type="checkbox" name="shareProfile"> Tên hồ sơ</label><label><input type="checkbox" name="shareGoals"> Mục tiêu</label><label><input type="checkbox" name="shareQuests"> Quest và kế hoạch Task hiện tại</label><label><input type="checkbox" name="shareStats"> Level, XP và 6 chỉ số</label><label><input type="checkbox" name="shareHistory"> Tối đa 15 sự kiện lịch sử gần nhất</label></fieldset><details id="mori-ai-data-preview"><summary>Xem chính xác dữ liệu được chọn để gửi</summary><pre id="mori-ai-data-preview-body"></pre></details><p class="rpg-muted">Dữ liệu đã chọn sẽ gửi tới Worker và nhà cung cấp AI. Ứng dụng không lưu câu trả lời AI trên máy; Worker mẫu không ghi nội dung yêu cầu vào log. Có thể bỏ bản xem trước để xóa câu trả lời tạm.</p><div id="mori-ai-turnstile"></div><div class="rpg-actions"><button class="btn-primary" type="submit" id="mori-ai-generate">Tạo bản xem trước</button><button class="btn-ghost" type="button" id="mori-ai-clear">Xóa dữ liệu trao đổi tạm</button></div><div id="mori-ai-error" data-ai-error aria-live="polite"></div></form></section><div id="mori-ai-result"></div><section class="rpg-panel"><h3>Triển khai Worker</h3><p class="rpg-muted">Cần đặt OPENAI_API_KEY, TURNSTILE_SECRET_KEY và TURNSTILE_SITE_KEY trong Cloudflare Worker Secrets/Vars, rồi nhập URL Worker ở trên. Hướng dẫn nằm trong worker/README.md của mã nguồn.</p></section></div>';
    const form = target.querySelector("#mori-ai-form"), result = target.querySelector("#mori-ai-result");
    const updateDataPreview = () => {
      const data = { context: selectedContext(appState, form), answers: pendingAnswers };
      target.querySelector("#mori-ai-data-preview-body").textContent = JSON.stringify(data, null, 2);
    };
    form.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener("change", updateDataPreview));
    updateDataPreview();
    target.querySelector("#mori-ai-save").onclick = () => {
      const value = String(form.elements.endpoint.value || "").trim().replace(/\/+$/, "");
      if (!/^https:\/\//i.test(value)) { showError(target.querySelector("#mori-ai-error"), new Error("Chỉ lưu URL HTTPS.")); return; }
      localStorage.setItem(ENDPOINT_KEY, value);
      target.querySelector("#mori-ai-error").textContent = "Đã lưu URL Worker trên thiết bị này.";
    };
    form.onsubmit = event => {
      event.preventDefault(); localStorage.setItem(ENDPOINT_KEY, String(form.elements.endpoint.value || "").trim().replace(/\/+$/, ""));
      target.querySelector("#mori-ai-error").replaceChildren();
      run(form, appState, result).catch(error => showError(target.querySelector("#mori-ai-error"), error));
    };
    target.querySelector("#mori-ai-clear").onclick = () => {
      pendingAnswers = []; pendingPlan = null; result.replaceChildren(); target.querySelector("#mori-ai-error").textContent = "Đã xóa câu trả lời và bản xem trước tạm.";
      if (turnstileWidget !== null && window.turnstile) { window.turnstile.remove(turnstileWidget); turnstileWidget = null; }
    };
  }

  function saveBackup(button) {
    const state = window.LifeRpg && window.LifeRpg.state && window.LifeRpg.state();
    if (!state) { window.alert("Không thể lưu: chưa đọc được hồ sơ và tiến trình cá nhân."); return; }
    const date = new Date().toISOString().slice(0, 10);
    const payload = { format: "life-rpg-backup.v1", exportedAt: new Date().toISOString(), state };
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "mori-quest-backup-" + date + ".json";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      window.alert("Đã lưu hồ sơ và toàn bộ tiến trình cá nhân trong bản sao lưu JSON trên thiết bị này.");
    } catch (error) {
      window.alert("Không thể tải bản sao lưu. Hãy thử lại hoặc kiểm tra quyền tải tệp của trình duyệt.");
    }
  }

  function installSaveButton() {
    const meta = document.querySelector(".hero-meta");
    if (!meta || document.getElementById("mori-save-data")) return;
    const button = document.createElement("button");
    button.type = "button"; button.id = "mori-save-data"; button.className = "hero-lucky";
    button.textContent = "💾 Lưu dữ liệu"; button.setAttribute("aria-label", "Tải bản sao lưu dữ liệu Mori Quest về thiết bị này");
    button.addEventListener("click", () => saveBackup(button));
    meta.appendChild(button);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installSaveButton, { once: true });
  else installSaveButton();

  window.MoriQuestAI = { render };
})();