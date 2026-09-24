/* Mori Quest Life RPG: three focused tabs, local progression, tagged AI paste import. */
(function(){
"use strict";
const STORE="tq_liferpg_state_v1",PROFILE="tq_profile",KEYS=["SI","STR","EN","VIT","EQ","Y"];
const NAMES={SI:"Trí tuệ",STR:"Thể lực",EN:"Sức bền",VIT:"Vitality*",EQ:"Cân bằng cảm xúc",Y:"Nội tâm"};
const view=document.getElementById("view"),tabsBar=document.getElementById("tabsBar");
let activeTab="tasks";
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const now=()=>new Date().toISOString();
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch(_){return fallback;}};
function fresh(){const old=read(PROFILE,{}),stats={};KEYS.forEach(k=>stats[k]=10);return{schemaVersion:1,currentDate:today(),user:{name:old.name||"Player",goals:[]},level:Math.max(1,Number(old.level)||1),xp:Math.max(0,Number(old.xp)||0),stats,tasks:[],quests:[],history:[],preferences:{growthDays:7},bonuses:{},feedback:""};}
function state(){const raw=read(STORE,null);if(!raw||raw.schemaVersion!==1)return fresh();const base=fresh(),s=Object.assign(base,raw);s.user=Object.assign(base.user,raw.user||{});s.stats=Object.assign(base.stats,raw.stats||{});s.preferences=Object.assign(base.preferences,raw.preferences||{});["tasks","quests","history"].forEach(k=>s[k]=Array.isArray(raw[k])?raw[k]:[]);s.bonuses=raw.bonuses||{};return s;}
function save(s){s.updatedAt=now();localStorage.setItem(STORE,JSON.stringify(s));const p=read(PROFILE,{});p.name=s.user.name||p.name||"Player";p.level=s.level;p.xp=s.xp;try{localStorage.setItem(PROFILE,JSON.stringify(p));}catch(_){}try{if(window.renderHero)window.renderHero();if(window.scheduleAutoSync)window.scheduleAutoSync();}catch(_){}}
function log(s,event){s.history.push(Object.assign({id:"event-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),at:now()},event));if(s.history.length>5000)s.history=s.history.slice(-5000);}
function needed(level){return 100+Math.max(0,(Number(level)||1)-1)*50;}
function addXp(s,amount){s.xp=Math.max(0,s.xp+(Number(amount)||0));while(s.xp>=needed(s.level)){s.xp-=needed(s.level);s.level++;}}
function completedToday(s,date){return s.history.filter(e=>e.action==="completed"&&e.date===date).length;}
function rollover(s){const t=today();if(!s.currentDate)s.currentDate=t;let cursor=s.currentDate,guard=0;while(cursor<t&&guard++<366){if(!completedToday(s,cursor)&&!s.bonuses["penalty:"+cursor]){s.bonuses["penalty:"+cursor]=true;addXp(s,-6);log(s,{action:"daily_penalty",date:cursor,xpDelta:-6,statDelta:{},title:"Không hoàn thành task trong ngày"});}const d=new Date(cursor+"T00:00:00");d.setDate(d.getDate()+1);cursor=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}if(s.currentDate!==t){s.currentDate=t;save(s);}return s;}
function activeQuest(s,type){return s.quests.find(q=>q.type===type&&q.status==="active")||null;}
function taskEffectsLine(e){return Object.keys(e||{}).map(k=>k+" +"+e[k]).join(" · ");}
function taskSort(a,b){const order={pending:0,completed:1,skipped:2};return(order[a.status]??3)-(order[b.status]??3)||String(a.createdAt).localeCompare(String(b.createdAt));}
function addQuest(s,type,raw){
 if(!raw)return null;const title=typeof raw==="string"?raw:String(raw.title||raw.name||"").trim();if(!title)return null;
 const found=s.quests.find(q=>q.type===type&&q.title.toLowerCase()===title.toLowerCase()&&q.status==="active");
 if(found){if(raw.description)found.description=String(raw.description);return found;}
 if(type==="main")s.quests.forEach(q=>{if(q.type==="main"&&q.status==="active")q.status="completed";});
 const quest={id:"quest-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),type,title,description:String(raw.description||""),target:Math.max(1,Number(raw.target)||4),status:"active",createdAt:now(),mainQuestId:null};
 const parent=raw.mainQuest||raw.main_quest;if(type==="weekly"&&parent){const m=addQuest(s,"main",parent);quest.mainQuestId=m&&m.id;}
 s.quests.push(quest);log(s,{action:"quest_created",date:today(),questType:type,title,xpDelta:0,statDelta:{},reason:"Được nhập từ gói Quest AI."});return quest;
}
function makeTask(s,raw,index,date){
 const title=String(raw.title||raw.text||"").trim();if(!title)return null;
 const tags=window.LifeRpgTaskEngine.statTags(raw.tags||raw.category||"");
 const score=window.LifeRpgTaskEngine.score(tags,raw.difficulty);
 const allTags=(Array.isArray(raw.tags)?raw.tags:String(raw.tags||"").split(/[,;|]/)).map(x=>String(x).trim()).filter(Boolean).slice(0,12);
 const main=raw.mainQuestId?s.quests.find(q=>q.id===raw.mainQuestId):s.quests.find(q=>q.type==="main"&&q.status==="active"&&raw.mainQuest&&q.title.toLowerCase()===String(raw.mainQuest).toLowerCase());
 const weekly=raw.weeklyQuestId?s.quests.find(q=>q.id===raw.weeklyQuestId):s.quests.find(q=>q.type==="weekly"&&q.status==="active"&&raw.weeklyQuest&&q.title.toLowerCase()===String(raw.weeklyQuest).toLowerCase());
 return{id:"task-"+Date.now()+"-"+index+"-"+Math.random().toString(36).slice(2,7),title,description:String(raw.description||"").slice(0,300),category:String(raw.category||allTags.find(t=>KEYS.includes(t.toUpperCase()))||"Daily").slice(0,60),tags:allTags,difficulty:score.difficulty,xp:score.xp,statEffects:score.statEffects,status:"pending",createdAt:now(),taskDate:date,completedAt:null,mainQuestId:main?main.id:null,weeklyQuestId:weekly?weekly.id:null,reason:String(raw.reason||"Được phân loại theo tag và chấm điểm trong ứng dụng.").slice(0,300),usedDefaultTag:score.usedDefaultTag};
}
function importPaste(text){
 const s=rollover(state()),parsed=window.LifeRpgTaskEngine.parse(text);
 if(!parsed||!Array.isArray(parsed.tasks)||!parsed.tasks.length)throw new Error("Không đọc thấy Task. Hãy dán JSON hoặc danh sách có tag theo mẫu.");
 const date=today(),before=s.tasks.filter(t=>t.taskDate===date).length,remaining=Math.max(0,20-before);
 if(!remaining)throw new Error("Đã đạt giới hạn 20 Task hôm nay.");
 const main=parsed.mainQuest||parsed.quests&&parsed.quests.find(q=>q.type==="main");
 if(main)addQuest(s,"main",main);
 (parsed.weeklyQuests||[]).forEach(q=>addQuest(s,"weekly",q));
 (parsed.quests||[]).forEach(q=>{const type=String(q.type||"").toLowerCase();if(type==="main"||type==="weekly")addQuest(s,type,q);});
 const accepted=[],duplicates=[];
 parsed.tasks.slice(0,remaining).forEach((raw,index)=>{
  const title=String(raw.title||raw.text||"").trim();if(!title)return;
  const exists=s.tasks.some(t=>t.taskDate===date&&t.title.toLowerCase()===title.toLowerCase());
  if(exists){duplicates.push(title);return;}
  const t=makeTask(s,raw,index,date);if(t)accepted.push(t);
 });
 if(!accepted.length)throw new Error(duplicates.length?"Các Task này đã có trong hôm nay.":"Không có Task hợp lệ.");
 s.tasks=s.tasks.concat(accepted);
 const fallback=accepted.filter(t=>t.usedDefaultTag).length;
 s.feedback="Đã nạp "+accepted.length+" Task"+(duplicates.length?" · bỏ qua "+duplicates.length+" mục trùng":"")+(fallback?" · "+fallback+" Task thiếu tag Stats được mặc định EN":"")+".";
 log(s,{action:"imported",date,count:accepted.length,taskIds:accepted.map(t=>t.id),xpDelta:0,statDelta:{},reason:"Task nhập từ nội dung AI; XP và Stats được tính từ tag."});
 accepted.forEach(t=>log(s,{action:"created",date,taskId:t.id,title:t.title,category:t.category,tags:t.tags,difficulty:t.difficulty,xpDelta:0,statDelta:{},mainQuestId:t.mainQuestId,weeklyQuestId:t.weeklyQuestId,reason:t.reason}));
 save(s);render("tasks");return accepted.length;
}
function complete(id){
 const s=rollover(state()),t=s.tasks.find(x=>x.id===id);if(!t||t.status!=="pending")return;
 t.status="completed";t.completedAt=now();const effects={};
 Object.keys(t.statEffects||{}).forEach(k=>{if(KEYS.includes(k)){const amount=Math.max(0,Math.min(5,Math.round(Number(t.statEffects[k])||0)));if(amount){s.stats[k]=(Number(s.stats[k])||0)+amount;effects[k]=amount;}}});
 addXp(s,t.xp);
 log(s,{action:"completed",date:today(),taskId:t.id,title:t.title,category:t.category,tags:t.tags,difficulty:t.difficulty,xpDelta:t.xp,statDelta:effects,mainQuestId:t.mainQuestId,weeklyQuestId:t.weeklyQuestId,reason:t.reason,createdAt:t.createdAt,completedAt:t.completedAt});
 let bonus=0;if(completedToday(s,today())>=6&&!s.bonuses["six-tasks:"+today()]){s.bonuses["six-tasks:"+today()]=true;bonus=3;addXp(s,bonus);log(s,{action:"daily_bonus",date:today(),title:"Thưởng hoàn thành 6 Task",xpDelta:bonus,statDelta:{}});}
 s.feedback="+"+t.xp+" XP · "+taskEffectsLine(effects)+(bonus?" · Thưởng +3 XP":"");save(s);render("tasks");
}
function skip(id){const s=rollover(state()),t=s.tasks.find(x=>x.id===id);if(!t||t.status!=="pending")return;t.status="skipped";log(s,{action:"skipped",date:today(),taskId:t.id,title:t.title,category:t.category,tags:t.tags,difficulty:t.difficulty,xpDelta:0,statDelta:{},reason:"Người dùng bỏ qua Task."});s.feedback="Đã bỏ qua Task; không thay đổi XP/Stats.";save(s);render("tasks");}
function radar(values,max,title){const cx=120,cy=105,r=72,n=KEYS.length,p=(i,k)=>{const a=-Math.PI/2+i*2*Math.PI/n;return(cx+Math.cos(a)*r*k).toFixed(1)+","+(cy+Math.sin(a)*r*k).toFixed(1);};let x='<svg viewBox="0 0 240 210" role="img" aria-label="'+esc(title)+'">';[.25,.5,.75,1].forEach(k=>x+='<polygon points="'+KEYS.map((_,i)=>p(i,k)).join(" ")+'" fill="none" stroke="#dfe2ed"/>');KEYS.forEach((k,i)=>x+='<line x1="'+cx+'" y1="'+cy+'" x2="'+p(i,1)+'" stroke="#dfe2ed"/>');x+='<polygon points="'+KEYS.map((k,i)=>p(i,Math.min(1,Math.max(0,Number(values[k])||0)/Math.max(1,max)))).join(" ")+'" fill="rgba(124,102,238,.24)" stroke="#7866ee" stroke-width="2"/>';KEYS.forEach((k,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;x+='<text x="'+(cx+Math.cos(a)*99).toFixed(1)+'" y="'+(cy+Math.sin(a)*99+4).toFixed(1)+'" text-anchor="middle" font-size="10" fill="#41445a">'+k+'</text>';});return x+"</svg>";}
function growth(s,days){const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days+1);const key=cutoff.getFullYear()+"-"+String(cutoff.getMonth()+1).padStart(2,"0")+"-"+String(cutoff.getDate()).padStart(2,"0"),out={};KEYS.forEach(k=>out[k]=0);s.history.forEach(e=>{if(e.action==="completed"&&e.date>=key&&e.date<=today())KEYS.forEach(k=>out[k]+=Number((e.statDelta||{})[k])||0);});return out;}
const CSS='.rpg-wrap{display:grid;gap:14px;color:#1b1e2e}.rpg-panel{padding:16px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:rgba(255,255,255,.9);box-shadow:0 12px 32px rgba(0,0,0,.07)}.rpg-panel h2,.rpg-panel h3{margin:0 0 9px}.rpg-muted{color:#777d9a;font-size:13px}.rpg-progress{height:9px;background:#e9e8f4;border-radius:99px;overflow:hidden;margin-top:7px}.rpg-progress span{display:block;height:100%;background:linear-gradient(90deg,#7866ee,#b09bff)}.rpg-task-list{display:grid;gap:9px}.rpg-task{padding:13px;border:1px solid #e9e7f4;border-radius:13px;background:#fff}.rpg-task-completed{border-color:#bce7ce;background:#f7fff9}.rpg-task-skipped{opacity:.7}.rpg-head{display:flex;justify-content:space-between;gap:10px}.rpg-task-title{font-weight:700}.rpg-meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.rpg-chip{background:#f1efff;border-radius:99px;padding:3px 8px;font-size:11px}.rpg-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.rpg-feedback{padding:10px 12px;background:#effaf2;border:1px solid #c9efd4;border-radius:12px;color:#226b3b}.rpg-empty{text-align:center;padding:20px;color:#777d9a}.rpg-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rpg-stat{display:flex;justify-content:space-between;padding:8px 3px;border-bottom:1px solid #eee}.rpg-chart{display:grid;grid-template-columns:minmax(200px,1fr) minmax(180px,.8fr);align-items:center;gap:10px}.rpg-chart svg{width:100%;max-width:280px;display:block;margin:auto}.rpg-history{max-height:280px;overflow:auto}.rpg-history div{padding:8px;border-bottom:1px solid #eee;font-size:12px}.rpg-form{display:grid;gap:9px}.rpg-form textarea{height:330px;min-height:220px;resize:vertical;font:14px/1.5 ui-monospace,monospace}.rpg-code{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f2ff;border-radius:12px;padding:12px;font:12px/1.5 ui-monospace,monospace;max-height:460px;overflow:auto}.rpg-quest{padding:10px;border:1px solid #eee;border-radius:10px;margin-top:8px}@media(max-width:650px){.rpg-grid,.rpg-chart{grid-template-columns:1fr}}';
function style(){return"<style>"+CSS+"</style>";}
function taskCard(t,s){const main=s.quests.find(q=>q.id===t.mainQuestId);return'<article class="rpg-task rpg-task-'+esc(t.status)+'"><div class="rpg-head"><div><div class="rpg-task-title">'+esc(t.title)+'</div>'+(t.description?'<div class="rpg-muted">'+esc(t.description)+'</div>':"")+'</div><span class="rpg-muted">'+({pending:"Chờ làm",completed:"Hoàn thành",skipped:"Đã bỏ qua"}[t.status]||"")+'</span></div><div class="rpg-meta"><span class="rpg-chip">'+esc(t.difficulty)+'</span><span class="rpg-chip">+'+t.xp+' XP</span><span class="rpg-chip">'+esc(taskEffectsLine(t.statEffects))+'</span>'+t.tags.map(tag=>'<span class="rpg-chip">'+esc(tag)+'</span>').join("")+(main?'<span class="rpg-chip">Main: '+esc(main.title)+'</span>':"")+'</div><div class="rpg-muted" style="margin-top:7px">'+esc(t.reason||"")+'</div>'+(t.status==="pending"?'<div class="rpg-actions"><button class="btn-primary" data-do="complete" data-id="'+esc(t.id)+'">Hoàn thành</button><button class="btn-ghost" data-do="skip" data-id="'+esc(t.id)+'">Bỏ qua</button></div>':"")+'</article>';}
function bindTaskButtons(){document.querySelectorAll("[data-do=complete]").forEach(b=>b.onclick=()=>complete(b.dataset.id));document.querySelectorAll("[data-do=skip]").forEach(b=>b.onclick=()=>skip(b.dataset.id));}
function renderTasks(s){
 const list=s.tasks.filter(t=>t.taskDate===today()).sort(taskSort),done=completedToday(s,today()),pending=list.filter(t=>t.status==="pending").length;
 view.innerHTML=style()+'<div class="rpg-wrap"><section class="rpg-panel"><h2>Task hôm nay</h2><div class="rpg-muted">'+done+' hoàn thành · '+pending+' đang chờ · thưởng +3 XP khi hoàn thành 6 Task</div>'+(s.feedback?'<p class="rpg-feedback">'+esc(s.feedback)+'</p>':"")+'<div class="rpg-task-list">'+(list.length?list.map(t=>taskCard(t,s)).join(""):'<div class="rpg-empty">Chưa có Task hôm nay. Mở tab “Nạp Quest & Task” để dán danh sách AI tạo.</div>')+'</div></section></div>';
 bindTaskButtons();
}
function renderStats(s){
 const need=needed(s.level),pct=Math.min(100,Math.round(s.xp/need*100)),days=Number(s.preferences.growthDays)||7,g=growth(s,days),max=Math.max(1,...KEYS.map(k=>s.stats[k])),gmax=Math.max(1,...KEYS.map(k=>g[k]));
 view.innerHTML=style()+'<div class="rpg-wrap"><section class="rpg-panel"><div class="rpg-head"><h2>Level '+s.level+'</h2><strong>'+s.xp+' / '+need+' XP</strong></div><div class="rpg-progress"><span style="width:'+pct+'%"></span></div><div class="rpg-muted">Còn '+(need-s.xp)+' XP tới Level '+(s.level+1)+'</div></section><section class="rpg-panel"><h2>6 chỉ số hiện tại</h2><div class="rpg-chart"><div>'+radar(s.stats,max,"Current Stats")+'</div><div>'+KEYS.map(k=>'<div class="rpg-stat"><span><b>'+k+'</b> · '+NAMES[k]+'</span><strong>'+Math.round(s.stats[k]||0)+'</strong></div>').join("")+'</div></div><p class="rpg-muted">VIT là chỉ số game hóa, không phải chẩn đoán hoặc đo tuổi sinh học y khoa.</p></section><section class="rpg-panel"><div class="rpg-head"><h2>Tiến độ tăng trong '+days+' ngày</h2><div><button class="btn-ghost" data-days="7">7 ngày</button> <button class="btn-ghost" data-days="30">30 ngày</button></div></div><div class="rpg-chart"><div>'+radar(g,gmax,"Stat Growth")+'</div><div>'+KEYS.map(k=>'<div class="rpg-stat"><span><b>'+k+'</b> · '+NAMES[k]+'</span><strong>+'+Math.round(g[k]||0)+'</strong></div>').join("")+'</div></div></section><section class="rpg-panel"><h2>Lịch sử XP & Stats</h2><div class="rpg-history">'+(s.history.slice().reverse().slice(0,80).map(e=>'<div><b>'+esc(e.date||"")+'</b> · '+esc(e.title||e.action)+' · '+(Number(e.xpDelta)>0?"+"+e.xpDelta:Number(e.xpDelta)||0)+' XP · '+esc(taskEffectsLine(e.statDelta||{}))+'</div>').join("")||'<div class="rpg-muted">Chưa có lịch sử.</div>')+'</div></section></div>';
 document.querySelectorAll("[data-days]").forEach(b=>b.onclick=()=>{const n=state();n.preferences.growthDays=Number(b.dataset.days);save(n);render("stats");});
}
function buildPrompt(){const s=state(),actions=s.history.filter(e=>e.action==="completed"||e.action==="skipped"),den=actions.length,done=actions.filter(e=>e.action==="completed").length,skipped=actions.filter(e=>e.action==="skipped").slice(-12).map(e=>({title:e.title,category:e.category,difficulty:e.difficulty,date:e.date,reason:e.reason}));return window.LifeRpgTaskEngine.makePrompt({userProfile:{name:s.user.name,level:s.level,xp:s.xp},goals:s.user.goals,mainQuest:activeQuest(s,"main"),weeklyQuest:activeQuest(s,"weekly"),currentStats:s.stats,recentTaskHistory:s.history.slice(-30),completionRate:den?done/den:0,skippedTasks:skipped,statGrowth:growth(s,7)});}
function renderImport(s){
 const prompt=buildPrompt(),tasks=s.tasks.filter(t=>t.taskDate===today()).length;
 view.innerHTML=style()+'<div class="rpg-wrap"><section class="rpg-panel"><h2>Nạp Quest & Task</h2><p class="rpg-muted">Dán nội dung do ChatGPT tạo. Ứng dụng đọc tag, tạo Quest liên quan và tự chấm XP/6 Stats. Hôm nay: '+tasks+' / 20 Task.</p><form id="paste-form" class="rpg-form"><textarea id="paste-input" placeholder=\'Dán JSON AI hoặc dạng gắn thẻ ở đây...\'></textarea><button class="btn-primary">Nạp Quest & Task</button></form><div id="import-error" class="rpg-muted" style="color:#a43b3b"></div>'+(s.feedback?'<p class="rpg-feedback">'+esc(s.feedback)+'</p>':"")+'</section><section class="rpg-panel"><h2>Quy tắc cho AI tạo Quest và Task</h2><p class="rpg-muted">Sao chép hướng dẫn có kèm profile, mục tiêu, Quest, Stats và lịch sử gần đây; gửi trong ChatGPT rồi dán JSON trả về phía trên.</p><div class="rpg-actions"><button class="btn-ghost" id="copy-prompt">Sao chép prompt AI</button></div><pre class="rpg-code" id="prompt-text">'+esc(prompt)+'</pre></section><section class="rpg-panel"><h2>Cách chấm điểm bằng tag</h2><div class="rpg-muted">Tag chỉ số: SI (tư duy/học tập), STR (thể lực), EN (sức bền/thói quen), VIT (phục hồi trong game), EQ (cảm xúc), Y (nội tâm). Mỗi Task nên có 1–3 tag Stats và tag chủ đề tùy chọn.</div><div class="rpg-quest"><b>Easy</b> · 15 XP · tag đầu +1, tag thứ hai +1<br><b>Normal</b> · 30 XP · +2, +1<br><b>Hard</b> · 55 XP · +3, +2, +1<br><b>Epic</b> · 85 XP · +4, +3, +2<br><span class="rpg-muted">Không có tag Stats hợp lệ: mặc định EN +1. Hoàn thành Task không thể cộng điểm lần thứ hai.</span></div><p class="rpg-muted">Có thể dán JSON với mainQuest, weeklyQuests, tasks hoặc danh sách gắn thẻ như: [TASK] Tạo một Short / Tags: SI, EN, YouTube / Difficulty: Normal / Main Quest: Xây kênh.</p></section><section class="rpg-panel"><h2>Hồ sơ & dữ liệu</h2><form id="profile-form" class="rpg-form"><label>Tên người chơi<input name="name" maxlength="80"></label><label>Mục tiêu dài hạn, mỗi dòng một mục tiêu<textarea name="goals" style="height:120px" placeholder="Phát triển kênh cá nhân&#10;Học ngoại ngữ"></textarea></label><button class="btn-primary">Lưu hồ sơ và mục tiêu</button></form><div class="rpg-actions"><button class="btn-ghost" id="export-backup">Tải backup</button><label class="btn-ghost" for="restore-backup" style="cursor:pointer">Phục hồi backup</label><input id="restore-backup" type="file" accept="application/json" hidden></div><p class="rpg-muted">Task, Quest, XP, Stats và history được lưu cục bộ trên thiết bị này.</p></section></div>';
 const profile=state();
 document.getElementById("profile-form").elements.name.value=profile.user.name||"";
 document.getElementById("profile-form").elements.goals.value=(profile.user.goals||[]).join("\n");
 document.getElementById("profile-form").onsubmit=e=>{e.preventDefault();const n=state(),f=e.currentTarget;n.user.name=f.elements.name.value.trim()||"Player";n.user.goals=f.elements.goals.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,30);n.feedback="Đã lưu tên và mục tiêu cho prompt AI.";save(n);render("import");};
 document.getElementById("export-backup").onclick=()=>{const payload={format:"life-rpg-backup.v1",exportedAt:now(),state:state()};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="mori-quest-backup-"+today()+".json";a.click();URL.revokeObjectURL(url);};
 document.getElementById("restore-backup").onchange=e=>{const file=e.target.files&&e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const payload=JSON.parse(String(reader.result||""));if(payload.format!=="life-rpg-backup.v1"||!payload.state||payload.state.schemaVersion!==1)throw new Error("File backup không đúng định dạng.");localStorage.setItem(STORE,JSON.stringify(payload.state));render("import");}catch(ex){alert("Không thể phục hồi: "+String(ex.message||ex));}};reader.readAsText(file);};
 document.getElementById("paste-form").onsubmit=e=>{e.preventDefault();const err=document.getElementById("import-error");try{const count=importPaste(document.getElementById("paste-input").value);if(count)document.getElementById("paste-input").value="";}catch(ex){err.textContent=String(ex.message||ex);}};
 document.getElementById("copy-prompt").onclick=async()=>{try{await navigator.clipboard.writeText(prompt);document.getElementById("copy-prompt").textContent="Đã sao chép";}catch(_){const r=document.createRange();r.selectNodeContents(document.getElementById("prompt-text"));const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);document.getElementById("copy-prompt").textContent="Chọn prompt rồi sao chép";}};
}
function render(tab){
 rollover(state());activeTab=["tasks","stats","import"].includes(tab)?tab:"tasks";
 const items=[{id:"tasks",label:"Task",icon:"✅"},{id:"stats",label:"Chỉ số",icon:"📊"},{id:"import",label:"Nạp Quest & Task",icon:"📋"}];
 if(tabsBar){tabsBar.innerHTML=items.map(i=>'<button type="button" class="tab-btn '+(activeTab===i.id?"active":"")+'" data-rpg-tab="'+i.id+'" aria-label="'+i.label+'" title="'+i.label+'">'+i.icon+' '+i.label+'</button>').join("");tabsBar.querySelectorAll("[data-rpg-tab]").forEach(b=>b.onclick=()=>render(b.dataset.rpgTab));}
 const s=rollover(state());if(activeTab==="stats")renderStats(s);else if(activeTab==="import")renderImport(s);else renderTasks(s);
}
function rolloverForLegacy(){rollover(state());return true;}
const storageKey="tq_liferpg_state_v1";if(!localStorage.getItem(storageKey))save(fresh());
try{if(window.stopDaySyncMonitoring)window.stopDaySyncMonitoring();}catch(_){}
window.LifeRpg={render,rollover:rolloverForLegacy,state,completeTask:complete,skipTask:skip,importPaste,buildPrompt};
window.render=render;render("tasks");
window.setInterval(()=>{if(state().currentDate!==today())render(activeTab);},60000);
window.addEventListener("storage",e=>{if(e.key===STORE)render(activeTab);});
})();