(function () {
  "use strict";
  const ENDPOINT_KEY = "mori_quest_ai_endpoint_v1";
  const TOKEN_KEY = "mori_quest_session_v1";
  const gate = document.getElementById("mori-auth-gate");
  const app = document.querySelector("[data-mori-private]");
  const form = document.getElementById("mori-auth-form");
  const error = document.getElementById("mori-auth-error");
  const endpointInput = form && form.elements.endpoint;
  const connectionPanel = document.getElementById("mori-auth-connection");
  const saveEndpointButton = document.getElementById("mori-auth-save-endpoint");
  const challengeBox = document.getElementById("mori-auth-turnstile");
  let widget = null;
  let turnstileKey = "";

  const endpoint = () => String(localStorage.getItem(ENDPOINT_KEY) || "").trim().replace(/\/+$/, "");
  const setError = message => { if (error) error.textContent = message || ""; };
  function unlock() {
    if (app) app.classList.add("mori-unlocked");
    if (gate) gate.hidden = true;
  }
  async function loadTurnstile() {
    if (window.turnstile) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true; script.defer = true;
      script.onload = resolve; script.onerror = () => reject(new Error("Không tải được xác thực Turnstile."));
      document.head.appendChild(script);
    });
  }
  async function getConfig(base) {
    const response = await fetch(base + "/api/config", { headers: { Accept: "application/json" } });
    const config = await response.json().catch(() => ({}));
    if (!response.ok || !config.turnstileSiteKey || !config.authEnabled) throw new Error(config.error || "Worker chưa cấu hình đăng nhập. Hãy cấu hình các Secret theo hướng dẫn triển khai.");
    return config;
  }
  async function getChallenge(siteKey) {
    await loadTurnstile();
    if (widget !== null && turnstileKey === siteKey) window.turnstile.remove(widget);
    challengeBox.replaceChildren(); turnstileKey = siteKey;
    return new Promise((resolve, reject) => {
      let finished = false;
      widget = window.turnstile.render(challengeBox, {
        sitekey: siteKey, action: "mori_quest_login",
        callback: token => { finished = true; resolve(token); },
        "expired-callback": () => { finished = true; reject(new Error("Mã xác thực hết hạn. Hãy thử lại.")); },
        "error-callback": () => { finished = true; reject(new Error("Xác thực chống spam thất bại.")); }
      });
      setTimeout(() => { if (!finished) reject(new Error("Hãy hoàn tất xác thực chống spam.")); }, 120000);
    });
  }
  async function validateSavedSession(base) {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (!saved) return false;
    try {
      const response = await fetch(base + "/api/verify-session", {
        method: "POST", headers: { Authorization: "Bearer " + saved, Accept: "application/json" }
      });
      if (!response.ok) { sessionStorage.removeItem(TOKEN_KEY); return false; }
      unlock(); return true;
    } catch (_) { return false; }
  }

  if (endpointInput) endpointInput.value = endpoint();
  if (connectionPanel && !endpoint()) connectionPanel.open = true;
  (async function init() {
    if (!gate || !app || !form) return;
    const base = endpoint();
    if (!base) { setError("Thiết lập kết nối một lần trong mục bên dưới để bật đăng nhập."); return; }
    if (!/^https:\/\//i.test(base)) { setError("Worker URL phải dùng HTTPS."); return; }
    if (await validateSavedSession(base)) return;
    try { await getConfig(base); setError(""); }
    catch (e) { setError(e.message || "Không kết nối được Worker."); }
  })();

  if (saveEndpointButton) saveEndpointButton.onclick = async () => {
    const value = String(endpointInput && endpointInput.value || "").trim().replace(/\/+$/, "");
    if (!/^https:\/\//i.test(value)) { setError("Worker URL phải dùng HTTPS."); return; }
    saveEndpointButton.disabled = true; saveEndpointButton.textContent = "Đang kiểm tra…";
    try {
      await getConfig(value);
      localStorage.setItem(ENDPOINT_KEY, value);
      if (connectionPanel) connectionPanel.open = false;
      setError("Đã lưu kết nối. Lần sau chỉ cần nhập mật khẩu.");
    } catch (e) { setError(e.message || "Không thể kết nối Worker."); }
    finally { saveEndpointButton.disabled = false; saveEndpointButton.textContent = "Lưu kết nối trên thiết bị này"; }
  };

  if (form) form.onsubmit = async event => {
    event.preventDefault(); setError("");
    const base = endpoint();
    if (!base) { if (connectionPanel) connectionPanel.open = true; setError("Lưu kết nối Worker một lần trước khi đăng nhập."); return; }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true; button.textContent = "Đang xác thực…";
    try {
      const config = await getConfig(base);
      const token = await getChallenge(config.turnstileSiteKey);
      const response = await fetch(base + "/api/login", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ password: form.elements.password.value, turnstileToken: token })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.token) throw new Error(result.error || "Đăng nhập thất bại.");
      form.elements.password.value = "";
      sessionStorage.setItem(TOKEN_KEY, result.token);
      unlock();
    } catch (e) { setError(e.message || "Đăng nhập thất bại."); }
    finally { button.disabled = false; button.textContent = "Đăng nhập"; }
  };
})();