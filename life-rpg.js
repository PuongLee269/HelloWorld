/* Life RPG MVP UI and local-first persistence. */
(function () {
  "use strict";
  const STORE = "tq_liferpg_state_v1";
  const PROFILE = "tq_profile";
  const STAT_KEYS = ["SI", "STR", "EN", "VIT", "EQ", "Y"];
  const STAT_NAMES = {
    SI: "Trí tuệ",
    STR: "Thể lực",
    EN: "Sức bền",
    VIT: "Vitality*",
    EQ: "Cân bằng",
    Y: "Nội tâm"
  };
  const view = document.getElementById("view");
  const tabsBar = document.getElementById("tabsBar");
  let busy = false;
  let activeTab = "dashboard";

  function isoNow() { return new Date().toISOString(); }
  function dateKey(date) {
    const d = date || new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }
  function parseDate(value) {
    const parts = String(value || "").split("-").map(Number);
    return parts.length === 3 ? new Date(parts[0], parts[1]-1, parts[2]) : new Date();
  }
  function addDays(value, amount) {
    const d = parseDate(value);
    d.setDate(d.getDate()+amount);
    return dateKey(d);
  }
  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  }
  function legacyProfile() {
    const p = readJson(PROFILE, {});
    return p && typeof p === "object" ? p : {};
  }
  function freshState() {
    const old = legacyProfile();
    const stats = {};
    STAT_KEYS.forEach(function (key) { stats[key] = 10; });
    return {
      schemaVersion: 1,
      currentDate: dateKey(),
      user: { name: String(old.name || "Player"), goals: [] },
      level: Math.max(1, Number(old.level) || 1),
      xp: Math.max(0, Number(old.xp) || 0),
      stats: stats,
      tasks: [],
      quests: [],
      history: [],
      preferences: { aiEndpoint: "", growthDays: 7 },
      bonuses: {},
      feedback: ""
    };
  }
  function state() {
    const raw = readJson(STORE, null);
    if (!raw || raw.schemaVersion !== 1) return freshState();
    const base = freshState();
    const out = Object.assign(base, raw);
    out.user = Object.assign(base.user, raw.user || {});
    out.preferences = Object.assign(base.preferences, raw.preferences || {});
    out.stats = Object.assign(base.stats, raw.stats || {});
    out.tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    out.quests = Array.isArray(raw.quests) ? raw.quests : [];
    out.history = Array.isArray(raw.history) ? raw.history : [];
    out.bonuses = raw.bonuses && typeof raw.bonuses === "object" ? raw.bonuses : {};
    return out;
  }
  function mirrorProfile(s) {
    const old = legacyProfile();
    old.name = s.user.name || old.name || "Player";
    old.level = s.level;
    old.xp = s.xp;
    try { localStorage.setItem(PROFILE, JSON.stringify(old)); } catch (_) {}
    if (typeof window.renderHero === "function") {
      try { window.renderHero(); } catch (_) {}
    }
    if (typeof window.scheduleAutoSync === "function") {
      try { window.scheduleAutoSync(); } catch (_) {}
    }
  }
  function saveState(s) {
    s.updatedAt = isoNow();
    localStorage.setItem(STORE, JSON.stringify(s));
    mirrorProfile(s);
  }
  function addHistory(s, event) {
    s.history.push(Object.assign({ id: "event-" + Date.now() + "-" + Math.random().toString(36).slice(2,7), at: isoNow() }, event));
    if (s.history.length > 5000) s.history = s.history.slice(-5000);
  }
  function applyXp(s, delta) {
    const total = Number(delta) || 0;
    if (total >= 0) {
      s.xp += total;
      while (s.xp >= xpNeeded(s.level)) {
        s.xp -= xpNeeded(s.level);
        s.level += 1;
      }
    } else {
      s.xp = Math.max(0, s.xp + total);
    }
  }
  function xpNeeded(level) {
    return 100 + Math.max(0, (Number(level) || 1) - 1) * 50;
  }
  function completedCount(s, date) {
    return s.history.filter(function (event) { return event.action === "completed" && event.date === date; }).length;
  }
  function rollover(s) {
    const today = dateKey();
    if (!s.currentDate) s.currentDate = today;
    let cursor = s.currentDate;
    let guard = 0;
    while (cursor < today && guard++ < 366) {
      const count = completedCount(s, cursor);
      if (count === 0 && !s.bonuses["penalty:" + cursor]) {
        s.bonuses["penalty:" + cursor] = true;
        applyXp(s, -6);
        addHistory(s, { action:"daily_penalty", date:cursor, xpDelta:-6, statDelta:{}, title:"Không hoàn thành task trong ngày", reason:"Quy tắc ngày không có task hoàn thành." });
      }
      cursor = addDays(cursor, 1);
    }
    if (s.currentDate !== today) {
      s.currentDate = today;
      saveState(s);
    }
    return s;
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  function number(value) { return Math.round(Number(value) || 0); }
  function currentQuest(s, type) {
    return s.quests.find(function (quest) { return quest.type === type && quest.status === "active"; }) || null;
  }
  function weekStart(date) {
    const d = parseDate(date);
    const weekday = d.getDay();
    d.setDate(d.getDate() - ((weekday + 6) % 7));
    return dateKey(d);
  }
  function weeklyProgress(s, quest) {
    const start = weekStart(dateKey());
    return s.history.filter(function (event) {
      return event.action === "completed" && event.weeklyQuestId === quest.id && event.date >= start && event.date <= dateKey();
    }).length;
  }
  function taskEffectLine(effects) {
    return Object.keys(effects || {}).map(function (key) {
      return key + " +" + effects[key];
    }).join(" · ");
  }
  function taskSort(a, b) {
    const order = { pending:0, completed:1, skipped:2 };
    return (order[a.status] - order[b.status]) || String(a.createdAt).localeCompare(String(b.createdAt));
  }
  function radarSvg(values, maxValue, title) {
    const cx = 130, cy = 116, radius = 76, count = STAT_KEYS.length;
    const point = function (index, scale) {
      const angle = (-Math.PI/2) + index * (2*Math.PI/count);
      return (cx + Math.cos(angle)*radius*scale).toFixed(1) + "," + (cy + Math.sin(angle)*radius*scale).toFixed(1);
    };
    let svg = '<svg viewBox="0 0 260 232" role="img" aria-label="' + esc(title) + '">';
    [0.25,0.5,0.75,1].forEach(function (scale) {
      svg += '<polygon points="' + STAT_KEYS.map(function (_, index) { return point(index,scale); }).join(" ") + '" fill="none" stroke="#e5e7ef" stroke-width="1"/>';
    });
    STAT_KEYS.forEach(function (key,index) {
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + point(index,1) + '" stroke="#d8dbe7"/>';
    });
    const points = STAT_KEYS.map(function (key,index) {
      const value = Math.max(0, Number(values[key]) || 0);
      return point(index, Math.min(1, value / Math.max(1,maxValue)));
    }).join(" ");
    svg += '<polygon points="' + points + '" fill="rgba(124,102,238,.24)" stroke="#7866ee" stroke-width="2"/>';
    STAT_KEYS.forEach(function (key,index) {
      const angle = (-Math.PI/2) + index * (2*Math.PI/count);
      const x = cx + Math.cos(angle)*104;
      const y = cy + Math.sin(angle)*104 + 4;
      svg += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" font-size="11" fill="#41445a">' + key + '</text>';
    });
    return svg + "</svg>";
  }
  function growthValues(s, days) {
    const cutoff = addDays(dateKey(), -days+1);
    const totals = {};
    STAT_KEYS.forEach(function (key) { totals[key] = 0; });
    s.history.forEach(function (event) {
      if (event.action !== "completed" || event.date < cutoff || event.date > dateKey()) return;
      STAT_KEYS.forEach(function (key) { totals[key] += Number((event.statDelta || {})[key]) || 0; });
    });
    return totals;
  }
  function contextFor(s) {
    const today = dateKey();
    const currentTasks = s.tasks.filter(function (task) { return task.taskDate === today; });
    const actions = s.history.filter(function (event) { return event.action === "completed" || event.action === "skipped"; });
    const completed = actions.filter(function (event) { return event.action === "completed"; }).length;
    const skipped = actions.filter(function (event) { return event.action === "skipped"; }).length;
    const categoryRates = {}, difficultyRates = {};
    actions.forEach(function (event) {
      const bucket = event.action === "completed" ? "done" : "skip";
      const category = event.category || "Daily";
      const difficulty = event.difficulty || "Normal";
      categoryRates[category] = categoryRates[category] || { done:0, skip:0 };
      difficultyRates[difficulty] = difficultyRates[difficulty] || { done:0, skip:0 };
      categoryRates[category][bucket] += 1;
      difficultyRates[difficulty][bucket] += 1;
    });
    function ratesFor(source) {
      const result = {};
      Object.keys(source).forEach(function (key) {
        const total = source[key].done + source[key].skip;
        result[key] = { rate: total ? source[key].done / total : 0.5, completed:source[key].done, skipped:source[key].skip };
      });
      return result;
    }
    const mainQuest = currentQuest(s,"main");
    const weeklyQuest = currentQuest(s,"weekly");
    const recent = s.history.slice(-100).map(function (event) { return Object.assign({},event); });
    const recentActions = actions.slice(-100);
    const recentDone = recentActions.filter(function (event) { return event.action === "completed"; }).length;
    const recentSkipped = recentActions.filter(function (event) { return event.action === "skipped"; });
    return {
      userProfile: { name:s.user.name, goals:s.user.goals.slice(), level:s.level, xp:s.xp },
      goals:s.user.goals.slice(),
      mainQuest: mainQuest,
      weeklyQuest: weeklyQuest,
      currentStats:Object.assign({},s.stats),
      recentTaskHistory:recent,
      completionRate:recentActions.length ? recentDone/recentActions.length : 0,
      skippedTasks:recentSkipped.map(function (event) { return {title:event.title, category:event.category, difficulty:event.difficulty, date:event.date, reason:event.reason}; }),
      behavior:{categoryRates:ratesFor(categoryRates), difficultyRates:ratesFor(difficultyRates), recentDailyTaskCount:currentTasks.length},
      statGrowth: growthValues(s,7),
      preferenceProfile:{preferredCategories:Object.keys(ratesFor(categoryRates)).filter(function (key) { return ratesFor(categoryRates)[key].rate >= 0.65; })},
      taskPreferences:s.preferences.taskPreferences || {}
    };
  }
  function mainAndWeekly(s) {
    return { main:currentQuest(s,"main"), weekly:currentQuest(s,"weekly") };
  }
  function createManualTask(title, mainId, weeklyId) {
    const s=rollover(state());
    const text=String(title||"").trim();
    if(!text)return;
    const date=dateKey();
    const count=s.tasks.filter(function (task) { return task.taskDate===date; }).length;
    if(count>=20){alert("Đã đạt giới hạn 20 task hôm nay.");return;}
    const main=s.quests.find(function (quest) { return quest.id===mainId; });
    const weekly=s.quests.find(function (quest) { return quest.id===weeklyId; });
    const task={
      id:"task-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),
      title:text,description:"Task do bạn tự thêm.",category:"Daily",tags:["custom"],difficulty:"Normal",xp:30,
      statEffects:{EN:1},status:"pending",createdAt:isoNow(),taskDate:date,completedAt:null,
      mainQuestId:main?main.id:null,weeklyQuestId:weekly?weekly.id:null,reason:"Bạn chủ động thêm task này."
    };
    s.tasks.push(task);
    addHistory(s,{action:"created",date:date,taskId:task.id,title:task.title,category:task.category,tags:task.tags,difficulty:task.difficulty,xpDelta:0,statDelta:{},mainQuestId:task.mainQuestId,weeklyQuestId:task.weeklyQuestId,reason:task.reason});
    s.feedback="";
    saveState(s);
    render("dashboard");
  }
  async function generateTasks() {
    if(busy)return;
    let s=rollover(state());
    const today=dateKey();
    const todayTasks=s.tasks.filter(function (task) { return task.taskDate===today; });
    const remaining=Math.max(0,20-todayTasks.length);
    if(!remaining){alert("Hôm nay đã có đủ 20 task.");return;}
    const requested=Math.min(8,remaining);
    busy=true;
    render("dashboard");
    try {
      const context=contextFor(s);
      let generated=[];
      const endpoint=s.preferences.aiEndpoint;
      try {
        generated=await window.LifeRpgTaskEngine.generate(context,requested,today,endpoint);
      } catch(error) {
        generated=window.LifeRpgTaskEngine.generateLocal(context,requested,today);
        s=state();
        s.feedback="AI endpoint chưa khả dụng; đã dùng bộ tạo task local.";
      }
      s=rollover(state());
      const freshCount=s.tasks.filter(function (task) { return task.taskDate===today; }).length;
      const accepted=generated.slice(0,Math.max(0,20-freshCount));
      s.tasks=s.tasks.concat(accepted);
      if(!s.tasks.some(function(task){return task.taskDate===today&&task.status==="pending";})&&accepted.length===0){
        s.feedback="Chưa tìm được task phù hợp mới. Hãy cập nhật mục tiêu hoặc thử lại sau.";
      } else if (!s.feedback) {
        s.feedback="Đã tạo "+accepted.length+" task dựa trên hồ sơ và lịch sử gần đây.";
      }
      addHistory(s,{action:"generated",date:today,taskIds:accepted.map(function(task){return task.id;}),count:accepted.length,reason:"Tạo task từ profile, mục tiêu, chỉ số và lịch sử."});
      saveState(s);
    } catch(error) {
      s=state();
      s.feedback="Không thể tạo task: "+String(error&&error.message||error);
      saveState(s);
    } finally {
      busy=false;
      render("dashboard");
    }
  }
  function completeTask(taskId) {
    const s=rollover(state());
    const task=s.tasks.find(function(item){return item.id===taskId;});
    if(!task||task.status!=="pending")return;
    task.status="completed";
    task.completedAt=isoNow();
    task.xp=Math.max(1,number(task.xp));
    const effects={};
    Object.keys(task.statEffects||{}).slice(0,3).forEach(function(key){
      if(STAT_KEYS.indexOf(key)<0)return;
      const delta=Math.max(0,Math.min(5,number(task.statEffects[key])));
      if(delta){s.stats[key]=(Number(s.stats[key])||0)+delta;effects[key]=delta;}
    });
    applyXp(s,task.xp);
    const today=dateKey();
    addHistory(s,{
      action:"completed",date:today,taskId:task.id,title:task.title,category:task.category,tags:task.tags,
      difficulty:task.difficulty,xpDelta:task.xp,statDelta:effects,mainQuestId:task.mainQuestId||null,
      weeklyQuestId:task.weeklyQuestId||null,reason:task.reason,createdAt:task.createdAt,completedAt:task.completedAt
    });
    let bonus=0;
    if(completedCount(s,today)>=6&&!s.bonuses["six-tasks:"+today]){
      s.bonuses["six-tasks:"+today]=true;
      bonus=3;
      applyXp(s,bonus);
      addHistory(s,{action:"daily_bonus",date:today,xpDelta:bonus,statDelta:{},title:"Thưởng hoàn thành 6 task",reason:"Hoàn thành ít nhất 6 task trong ngày."});
    }
    const effectsText=Object.keys(effects).map(function(key){return key+" +"+effects[key];}).join(", ");
    s.feedback="+"+task.xp+" XP"+(effectsText?" · "+effectsText:"")+(bonus?" · Thưởng +3 XP":"");
    saveState(s);
    render("dashboard");
  }
  function skipTask(taskId) {
    const s=rollover(state());
    const task=s.tasks.find(function(item){return item.id===taskId;});
    if(!task||task.status!=="pending")return;
    task.status="skipped";
    task.completedAt=null;
    addHistory(s,{
      action:"skipped",date:dateKey(),taskId:task.id,title:task.title,category:task.category,tags:task.tags,
      difficulty:task.difficulty,xpDelta:0,statDelta:{},mainQuestId:task.mainQuestId||null,
      weeklyQuestId:task.weeklyQuestId||null,reason:"Người dùng bỏ qua task.",createdAt:task.createdAt
    });
    s.feedback="Task đã được đánh dấu bỏ qua; không thay đổi XP hoặc Stats.";
    saveState(s);
    render("dashboard");
  }
  function backup() {
    const s=rollover(state());
    const payload={format:"life-rpg-backup.v1",exportedAt:isoNow(),state:s,legacyProfile:legacyProfile()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;link.download="life-rpg-backup-"+dateKey()+".json";link.click();
    URL.revokeObjectURL(url);
  }
  function restore(file) {
    const reader=new FileReader();
    reader.onload=function(){
      try{
        const payload=JSON.parse(String(reader.result||""));
        if(payload.format!=="life-rpg-backup.v1"||!payload.state||payload.state.schemaVersion!==1)throw new Error("File backup không đúng định dạng.");
        localStorage.setItem(STORE,JSON.stringify(payload.state));
        mirrorProfile(payload.state);
        render("dashboard");
      }catch(error){alert("Không thể phục hồi: "+String(error.message||error));}
    };
    reader.readAsText(file);
  }
  function radarValuesHtml(s, values, growth) {
    return '<div class="rpg-radar-grid"><div class="rpg-radar">'+radarSvg(values,growth?Math.max(1,...STAT_KEYS.map(function(key){return Math.max(0,values[key]);})):Math.max(10,...STAT_KEYS.map(function(key){return values[key];})),growth?"Stat Growth":"Current Stats")+'</div>'+
      '<div class="rpg-stat-list">'+STAT_KEYS.map(function(key){
        const val=number(values[key]);
        return '<div class="rpg-stat"><span><b>'+key+'</b> '+esc(STAT_NAMES[key])+'</span><strong class="'+(growth&&val>0?'rpg-positive':'')+'">'+(growth&&val>0?"+":"")+val+'</strong></div>';
      }).join("")+'</div></div>';
  }
  function taskCard(task) {
    const stats=taskEffectLine(task.statEffects);
    const related=task.mainQuestId;
    const main=related&&state().quests.find(function(q){return q.id===related;});
    return '<article class="rpg-task rpg-task-'+esc(task.status)+'"><div class="rpg-task-head"><div>'+
      '<div class="rpg-task-title">'+esc(task.title)+'</div>'+
      (task.description?'<div class="rpg-muted">'+esc(task.description)+'</div>':'')+
      '</div><span class="rpg-status">'+({pending:"Chờ làm",completed:"Hoàn thành",skipped:"Đã bỏ qua"}[task.status]||task.status)+'</span></div>'+
      '<div class="rpg-task-meta"><span class="rpg-chip">'+esc(task.difficulty)+'</span><span class="rpg-chip">+'+number(task.xp)+' XP</span>'+
      '<span class="rpg-chip">'+esc(task.category)+'</span>'+task.tags.slice(0,3).map(function(tag){return '<span class="rpg-chip">'+esc(tag)+'</span>';}).join("")+
      (stats?'<span class="rpg-chip rpg-stat-chip">'+esc(stats)+'</span>':'')+
      (main?'<span class="rpg-chip">Main: '+esc(main.title)+'</span>':'')+'</div>'+
      '<div class="rpg-muted rpg-reason">Gợi ý vì: '+esc(task.reason||"")+'</div>'+
      (task.status==="pending"?'<div class="rpg-task-actions"><button class="btn-primary" data-action="complete" data-id="'+esc(task.id)+'">Hoàn thành</button><button class="btn-ghost" data-action="skip" data-id="'+esc(task.id)+'">Bỏ qua</button></div>':
      (task.completedAt?'<div class="rpg-muted">Cập nhật: '+esc(new Date(task.completedAt).toLocaleString("vi-VN"))+'</div>':''))+'</article>';
  }
  function mainQuestMarkup(s) {
    const main=currentQuest(s,"main");
    const weekly=currentQuest(s,"weekly");
    let html='<div class="rpg-quest-grid">';
    html+='<section class="rpg-quest"><h3>Main Quest</h3>'+
      (main?'<strong>'+esc(main.title)+'</strong><p class="rpg-muted">'+esc(main.description||"Mục tiêu dài hạn")+'</p>':
      '<p class="rpg-muted">Chưa có mục tiêu dài hạn. Tạo Main Quest để task bám sát điều bạn muốn xây dựng.</p>')+
      '<form id="rpg-main-form" class="rpg-inline-form"><input name="title" required maxlength="120" placeholder="Ví dụ: Xây kênh cá nhân"><input name="description" maxlength="180" placeholder="Mô tả ngắn"><button class="btn-primary">Đặt Main Quest</button></form></section>';
    html+='<section class="rpg-quest"><h3>Weekly Quest</h3>'+
      (weekly?'<strong>'+esc(weekly.title)+'</strong><p class="rpg-muted">'+weeklyProgress(s,weekly)+' / '+number(weekly.target||5)+' task đã hoàn thành tuần này</p>'+
      '<div class="rpg-progress"><span style="width:'+Math.min(100,weeklyProgress(s,weekly)/Math.max(1,number(weekly.target||5))*100)+'%"></span></div>':
      '<p class="rpg-muted">Gom các hành động trong tuần thành một mốc nhỏ.</p>')+
      '<form id="rpg-weekly-form" class="rpg-inline-form"><input name="title" required maxlength="120" placeholder="Ví dụ: 4 phiên học trong tuần"><input name="target" type="number" min="1" max="30" value="4" aria-label="Số task mục tiêu"><button class="btn-primary">Tạo Weekly Quest</button></form></section></div>';
    return html;
  }
  function renderDashboard() {
    const s=rollover(state());
    const today=dateKey();
    const tasks=s.tasks.filter(function(task){return task.taskDate===today;}).sort(taskSort);
    const pending=tasks.filter(function(task){return task.status==="pending";}).length;
    const growthDays=Number(s.preferences.growthDays)||7;
    const growth=growthValues(s,growthDays);
    const levelNeed=xpNeeded(s.level);
    const percent=Math.min(100,Math.round(s.xp/levelNeed*100));
    const weekly=currentQuest(s,"weekly");
    const main=currentQuest(s,"main");
    const allTaskCount=tasks.length;
    const generatedLine=allTaskCount>=20?"Đã đạt giới hạn 20 task hôm nay.":(allTaskCount?allTaskCount+" / 20 task hôm nay":"Chưa có task hôm nay.");
    view.innerHTML='<style>'+
      '.rpg-wrap{display:grid;gap:14px;color:#1b1e2e}.rpg-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}.rpg-panel{padding:16px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:rgba(255,255,255,.88);box-shadow:0 12px 32px rgba(0,0,0,.07)}'+
      '.rpg-panel h2,.rpg-panel h3{margin:0 0 9px}.rpg-muted{color:#777d9a;font-size:13px}.rpg-progress{height:9px;background:#e9e8f4;border-radius:99px;overflow:hidden;margin-top:7px}.rpg-progress span{display:block;height:100%;background:linear-gradient(90deg,#7866ee,#b09bff);border-radius:99px}'+
      '.rpg-stats-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.rpg-radar-grid{display:grid;grid-template-columns:minmax(200px,1fr) minmax(180px,.8fr);align-items:center;gap:10px}.rpg-radar svg{width:100%;max-width:280px;display:block;margin:auto}.rpg-stat-list{display:grid;gap:6px}.rpg-stat{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #f0eff6;padding:4px 0;font-size:13px}.rpg-positive{color:#218653}.rpg-toggle{display:flex;gap:5px}.rpg-toggle button{min-height:32px;padding:4px 9px}.rpg-task-list{display:grid;gap:9px;margin-top:12px}.rpg-task{padding:13px;border:1px solid #e9e7f4;border-radius:13px;background:#fff}.rpg-task-completed{border-color:#bce7ce;background:#f7fff9}.rpg-task-skipped{opacity:.72}.rpg-task-head{display:flex;justify-content:space-between;gap:10px}.rpg-task-title{font-weight:700}.rpg-status{font-size:12px;white-space:nowrap;color:#696982}.rpg-task-meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.rpg-chip{background:#f1efff;border-radius:99px;padding:3px 8px;font-size:11px}.rpg-stat-chip{background:#eaf7ef}.rpg-reason{margin-top:7px}.rpg-task-actions{display:flex;gap:7px;margin-top:10px}.rpg-feedback{padding:10px 12px;background:#effaf2;border:1px solid #c9efd4;border-radius:12px;color:#226b3b}.rpg-inline-form{display:grid;gap:7px;margin-top:10px}.rpg-inline-form input,.rpg-field{min-height:42px}.rpg-inline-form textarea{min-height:78px}.rpg-quest-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rpg-quest{padding:12px;border:1px solid #eeedf5;border-radius:13px}.rpg-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.rpg-toolbar select{width:auto;min-height:36px}.rpg-vitality-note{font-size:11px;color:#7d82a8;margin-top:8px}.rpg-actions{display:flex;gap:8px;flex-wrap:wrap}.rpg-empty{text-align:center;padding:20px;color:#777d9a}.rpg-count{font-weight:600;color:#666}.rpg-field-grid{display:grid;gap:9px}.rpg-history{display:grid;gap:6px;max-height:260px;overflow:auto}.rpg-history-item{font-size:12px;padding:8px;border-bottom:1px solid #eee}.rpg-error{color:#a43b3b}.rpg-main-form{display:grid;grid-template-columns:1fr 1fr;gap:7px}.rpg-main-form button{grid-column:1/-1}'+
      '@media(max-width:650px){.rpg-row,.rpg-quest-grid{grid-template-columns:1fr}.rpg-radar-grid{grid-template-columns:1fr}.rpg-main-form{grid-template-columns:1fr}.rpg-main-form button{grid-column:auto}}'+
      '</style><div class="rpg-wrap">'+
      '<div class="rpg-panel"><div class="rpg-stats-top"><div><div class="rpg-muted">HERO · LEVEL '+s.level+'</div><h2>'+esc(s.user.name||"Player")+'</h2></div><div class="rpg-count">'+s.xp+' / '+levelNeed+' XP</div></div><div class="rpg-progress"><span style="width:'+percent+'%"></span></div><div class="rpg-muted">Còn '+Math.max(0,levelNeed-s.xp)+' XP đến Level '+(s.level+1)+'</div></div>'+
      '<div class="rpg-row"><section class="rpg-panel"><div class="rpg-stats-top"><h2>Current Stats</h2><span class="rpg-muted">VIT là chỉ số trò chơi, không phải chẩn đoán y khoa.</span></div>'+radarValuesHtml(s,s.stats,false)+'</section>'+
      '<section class="rpg-panel"><div class="rpg-stats-top"><h2>Growth · '+growthDays+' ngày</h2><div class="rpg-toggle"><button class="btn-ghost" data-growth="7">7 ngày</button><button class="btn-ghost" data-growth="30">30 ngày</button></div></div>'+radarValuesHtml(s,growth,true)+'</section></div>'+
      '<section class="rpg-panel"><div class="rpg-stats-top"><div><h2>Task hôm nay</h2><div class="rpg-muted">'+generatedLine+' · '+pending+' đang chờ</div></div><div class="rpg-actions"><button class="btn-primary" id="rpg-generate" '+(allTaskCount>=20||busy?"disabled":"")+'>Tạo Daily Task</button></div></div>'+
      (s.feedback?'<p class="rpg-feedback">'+esc(s.feedback)+'</p>':'')+
      '<form id="rpg-add-task" class="rpg-main-form"><input name="title" maxlength="140" placeholder="Thêm hành động của tôi..." required><select name="mainQuest"><option value="">Không gắn Main Quest</option>'+s.quests.filter(function(q){return q.type==="main"&&q.status==="active";}).map(function(q){return '<option value="'+esc(q.id)+'">'+esc(q.title)+'</option>';}).join("")+'</select><select name="weeklyQuest"><option value="">Không gắn Weekly Quest</option>'+s.quests.filter(function(q){return q.type==="weekly"&&q.status==="active";}).map(function(q){return '<option value="'+esc(q.id)+'">'+esc(q.title)+'</option>';}).join("")+'</select><button class="btn-ghost">Thêm Daily Task (+30 XP)</button></form>'+
      '<div class="rpg-task-list">'+(tasks.length?tasks.map(taskCard).join(""):'<div class="rpg-empty">Chưa có task. Tạo task hôm nay để bắt đầu vòng lặp RPG.</div>')+'</div></section>'+
      '<section class="rpg-panel"><div class="rpg-stats-top"><div><h2>Quest Board</h2><div class="rpg-muted">Daily task → Weekly Quest → Main Quest</div></div></div>'+mainQuestMarkup(s)+'</section>'+
      '<section class="rpg-panel"><div class="rpg-stats-top"><h2>Lịch sử tiến trình</h2><span class="rpg-muted">Các thay đổi XP và Stats đã lưu</span></div><div class="rpg-history">'+
      (s.history.slice(-12).reverse().map(function(event){return '<div class="rpg-history-item"><b>'+esc(event.date||"")+'</b> · '+esc(event.title||event.action)+' · '+(number(event.xpDelta)>0?"+"+number(event.xpDelta)+" XP":number(event.xpDelta)<0?number(event.xpDelta)+" XP":"")+' '+esc(taskEffectLine(event.statDelta||{}))+'</div>';}).join("")||'<div class="rpg-muted">Hoàn thành task để tạo history.</div>')+
      '</div></section></div>';
    bindDashboard(s);
  }
  function bindDashboard(s) {
    const generate=document.getElementById("rpg-generate");
    if(generate)generate.onclick=generateTasks;
    document.querySelectorAll("[data-action='complete']").forEach(function(button){button.onclick=function(){completeTask(button.dataset.id);};});
    document.querySelectorAll("[data-action='skip']").forEach(function(button){button.onclick=function(){skipTask(button.dataset.id);};});
    document.querySelectorAll("[data-growth]").forEach(function(button){button.onclick=function(){
      const next=state();next.preferences.growthDays=Number(button.dataset.growth)||7;saveState(next);render("dashboard");
    };});
    const addForm=document.getElementById("rpg-add-task");
    if(addForm)addForm.onsubmit=function(event){event.preventDefault();createManualTask(addForm.elements.title.value,addForm.elements.mainQuest.value,addForm.elements.weeklyQuest.value);};
    const mainForm=document.getElementById("rpg-main-form");
    if(mainForm)mainForm.onsubmit=function(event){
      event.preventDefault();const title=mainForm.elements.title.value.trim();if(!title)return;
      const next=state();next.quests.forEach(function(q){if(q.type==="main"&&q.status==="active")q.status="completed";});
      const quest={id:"quest-"+Date.now(),type:"main",title:title,description:mainForm.elements.description.value.trim(),status:"active",createdAt:isoNow()};
      next.quests.push(quest);
      addHistory(next,{action:"quest_created",date:dateKey(),title:quest.title,questType:"main",xpDelta:0,statDelta:{},reason:"Đặt Main Quest."});
      next.feedback="Đã cập nhật Main Quest. Task tiếp theo sẽ cân nhắc mục tiêu này.";
      saveState(next);render("dashboard");
    };
    const weeklyForm=document.getElementById("rpg-weekly-form");
    if(weeklyForm)weeklyForm.onsubmit=function(event){
      event.preventDefault();const title=weeklyForm.elements.title.value.trim();if(!title)return;
      const next=state();next.quests.forEach(function(q){if(q.type==="weekly"&&q.status==="active")q.status="completed";});
      const quest={id:"quest-"+Date.now(),type:"weekly",title:title,target:Math.max(1,number(weeklyForm.elements.target.value)||4),status:"active",createdAt:isoNow(),mainQuestId:(currentQuest(next,"main")||{}).id||null};
      next.quests.push(quest);
      addHistory(next,{action:"quest_created",date:dateKey(),title:quest.title,questType:"weekly",xpDelta:0,statDelta:{},reason:"Đặt Weekly Quest."});
      next.feedback="Đã tạo Weekly Quest.";
      saveState(next);render("dashboard");
    };
  }
  function renderProfile() {
    const s=rollover(state());
    view.innerHTML='<style>.rpg-wrap{display:grid;gap:14px}.rpg-panel{padding:16px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:rgba(255,255,255,.88);box-shadow:0 12px 32px rgba(0,0,0,.07)}.rpg-panel h2{margin:0 0 8px}.rpg-muted{color:#777d9a;font-size:13px}.rpg-form{display:grid;gap:10px}.rpg-form label{display:grid;gap:5px;font-weight:600}.rpg-form input,.rpg-form textarea{font:inherit;border:1px solid #ddd;border-radius:10px;padding:10px}.rpg-form textarea{min-height:100px}.rpg-actions{display:flex;gap:8px;flex-wrap:wrap}.rpg-quest-list{display:grid;gap:8px;margin-top:10px}.rpg-quest-item{padding:10px;border:1px solid #eee;border-radius:10px}</style>'+
      '<div class="rpg-wrap"><section class="rpg-panel"><h2>Profile & Goals</h2><p class="rpg-muted">Thông tin này giúp bộ tạo task đề xuất hành động phù hợp hơn.</p>'+
      '<form id="rpg-profile-form" class="rpg-form"><label>Tên người chơi<input name="name" maxlength="80" value="'+esc(s.user.name)+'"></label>'+
      '<label>Mục tiêu dài hạn, mỗi dòng một mục tiêu<textarea name="goals" placeholder="Xây kênh cá nhân&#10;Học ngoại ngữ">'+esc(s.user.goals.join("\n"))+'</textarea></label>'+
      '<label>AI Task endpoint (tùy chọn)<input name="endpoint" type="url" value="'+esc(s.preferences.aiEndpoint)+'" placeholder="https://your-service.example/api/daily-tasks"></label>'+
      '<div class="rpg-actions"><button class="btn-primary">Lưu hồ sơ</button><button type="button" class="btn-ghost" id="rpg-export">Tải backup</button><label class="btn-ghost" for="rpg-restore" style="cursor:pointer">Phục hồi backup</label><input id="rpg-restore" type="file" accept="application/json" hidden></div></form></section>'+
      '<section class="rpg-panel"><h2>Quest hiện có</h2><div class="rpg-quest-list">'+
      (s.quests.slice().reverse().map(function(q){return '<div class="rpg-quest-item"><b>'+esc(q.type==="main"?"Main Quest":q.type==="weekly"?"Weekly Quest":"Daily Quest")+'</b> · '+esc(q.title)+' <span class="rpg-muted">('+esc(q.status)+')</span></div>';}).join("")||'<p class="rpg-muted">Chưa có quest. Tạo Main Quest hoặc Weekly Quest trên Dashboard.</p>')+
      '</div></section><section class="rpg-panel"><h2>Dữ liệu & giới hạn MVP</h2><p class="rpg-muted">Task, Stats, XP, Quest và history được lưu cục bộ trên thiết bị. Tải backup định kỳ để chuyển hoặc phục hồi dữ liệu.</p><p class="rpg-muted">VIT (Vitality) là chỉ số mô phỏng trong game, không phải đo tuổi sinh học hay chẩn đoán y khoa.</p></section></div>';
    const form=document.getElementById("rpg-profile-form");
    form.onsubmit=function(event){
      event.preventDefault();const next=state();
      next.user.name=form.elements.name.value.trim()||"Player";
      next.user.goals=form.elements.goals.value.split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean).slice(0,30);
      next.preferences.aiEndpoint=form.elements.endpoint.value.trim();
      next.feedback="Đã lưu hồ sơ và mục tiêu.";
      saveState(next);render("profile");
    };
    document.getElementById("rpg-export").onclick=backup;
    document.getElementById("rpg-restore").onchange=function(event){const file=event.target.files&&event.target.files[0];if(file)restore(file);};
  }
  function render(tab) {
    rollover(state());
    activeTab=tab==="profile"?"profile":"dashboard";
    if(tabsBar){
      const items=[{id:"dashboard",label:"Dashboard",icon:"✅"},{id:"profile",label:"Profile & Quests",icon:"🎯"}];
      tabsBar.innerHTML=items.map(function(item){return '<button type="button" class="tab-btn '+(activeTab===item.id?"active":"")+'" data-rpg-tab="'+item.id+'" aria-label="'+item.label+'" title="'+item.label+'">'+item.icon+'</button>';}).join("");
      tabsBar.querySelectorAll("[data-rpg-tab]").forEach(function(button){button.onclick=function(){render(button.dataset.rpgTab);};});
    }
    if(activeTab==="profile")renderProfile();else renderDashboard();
  }
  function rolloverForLegacy(opts) {
    const s=rollover(state());
    return true;
  }

  const engineKey="tq_liferpg_state_v1";
  if(!localStorage.getItem(engineKey)){
    const first=freshState();
    saveState(first);
  }
  try { if(typeof window.stopDaySyncMonitoring==="function")window.stopDaySyncMonitoring(); } catch (_) {}
  window.LifeRpg={render:render,rollover:rolloverForLegacy,state:state,completeTask:completeTask,skipTask:skipTask,generateTasks:generateTasks,contextFor:contextFor};
  window.render=function(tab){render(tab);};
  render("dashboard");
  if(!state().tasks.some(function(task){return task.taskDate===dateKey();}))generateTasks();
  window.addEventListener("storage",function(event){if(event.key===STORE)render(activeTab);});
})();