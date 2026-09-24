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
function fresh(){const old=read(PROFILE,{}),stats={};KEYS.forEach(k=>stats[k]=10);return{schemaVersion:2,currentDate:today(),user:{name:old.name||"Player",goals:[]},level:Math.max(1,Number(old.level)||1),xp:Math.max(0,Number(old.xp)||0),stats,tasks:[],taskRules:[],plans:[],activePlanId:null,planStart:null,planEnd:null,aiConversation:null,quests:[],history:[],preferences:{growthDays:7},bonuses:{},feedback:""};}
function state(){
 const raw=read(STORE,null);if(!raw||![1,2].includes(raw.schemaVersion))return fresh();
 const base=fresh(),s=Object.assign(base,raw);s.schemaVersion=2;
 s.user=Object.assign(base.user,raw.user||{});s.stats=Object.assign(base.stats,raw.stats||{});s.preferences=Object.assign(base.preferences,raw.preferences||{});
 ["tasks","taskRules","plans","quests","history"].forEach(k=>s[k]=Array.isArray(raw[k])?raw[k]:[]);
 s.tasks.forEach(t=>{
  if(t.status==="skipped"&&!t.ruleId)t.status="pending";
  if(!t.taskType)t.taskType="one_time";
  if(!Number.isFinite(Number(t.target)))t.target=1;
  if(!t.period)t.period="month";
  if(!t.preferredTime)t.preferredTime=t.timeOfDay==="evening"?"evening":"any";
 });
 s.taskRules.forEach(r=>{
  if(!r.taskType)r.taskType="one_time";if(!Number.isFinite(Number(r.target)))r.target=1;
  if(!r.period)r.period=r.taskType==="daily"?"day":r.taskType==="weekly"?"week":"month";
  if(!r.preferredTime)r.preferredTime="any";if(!r.status)r.status="active";
 });
 const legacy=s.tasks.filter(t=>!t.batchId).sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
 const legacyGroups={};legacy.forEach(t=>{const phase=t.timeOfDay==="evening"?"evening":"day",key=t.taskDate+":"+phase;let linked=null;if(phase==="evening"&&t.replacesTask)linked=legacy.find(x=>x.taskDate===t.taskDate&&x.timeOfDay!=="evening"&&x.title.toLowerCase()===t.replacesTask.toLowerCase());const order=linked?linked.batchOrder:(legacyGroups[key]||0);t.queueOrder=Number.isFinite(t.queueOrder)?t.queueOrder:order;t.batchOrder=Number.isFinite(t.batchOrder)?t.batchOrder:Math.floor(order/3);t.batchId=linked?linked.batchId:(t.taskDate+":"+phase+":"+t.batchOrder);if(!linked)legacyGroups[key]=order+1;});
 s.bonuses=raw.bonuses||{};s.plans=s.plans||[];s.aiConversation=s.aiConversation||null;return s;
}
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
function makeTask(s,raw,index,date,forcedTime,sequence){
 const title=String(raw.title||raw.text||"").trim();if(!title)return null;
 const tags=window.LifeRpgTaskEngine.statTags(raw.tags||raw.category||"");
 const score=window.LifeRpgTaskEngine.score(tags,raw.difficulty);
 const allTags=(Array.isArray(raw.tags)?raw.tags:String(raw.tags||"").split(/[,;|]/)).map(x=>String(x).trim()).filter(Boolean).slice(0,12);
 const shift=forcedTime||(["day","evening"].includes(raw.timeOfDay)?raw.timeOfDay:"day");
 const order=Number.isFinite(sequence)?sequence:(s.tasks.filter(t=>t.taskDate===date&&t.timeOfDay===shift).length+index),batchOrder=Math.floor(order/3);
 const main=raw.mainQuestId?s.quests.find(q=>q.id===raw.mainQuestId):s.quests.find(q=>q.type==="main"&&q.status==="active"&&raw.mainQuest&&q.title.toLowerCase()===String(raw.mainQuest).toLowerCase());
 const weekly=raw.weeklyQuestId?s.quests.find(q=>q.id===raw.weeklyQuestId):s.quests.find(q=>q.type==="weekly"&&q.status==="active"&&raw.weeklyQuest&&q.title.toLowerCase()===String(raw.weeklyQuest).toLowerCase());
 return{id:"task-"+Date.now()+"-"+index+"-"+Math.random().toString(36).slice(2,7),queueOrder:order,batchOrder:batchOrder,batchId:date+":"+shift+":"+batchOrder,title,description:String(raw.description||"").slice(0,300),category:String(raw.category||allTags.find(t=>KEYS.includes(t.toUpperCase()))||"Daily").slice(0,60),tags:allTags,difficulty:score.difficulty,timeOfDay:shift,replacesTask:String(raw.replacesTask||"").slice(0,140),energyRole:["focus","movement","recovery","connection","reflection"].includes(raw.energyRole)?raw.energyRole:"focus",xp:score.xp,statEffects:score.statEffects,status:"pending",createdAt:now(),taskDate:date,completedAt:null,mainQuestId:main?main.id:null,weeklyQuestId:weekly?weekly.id:null,reason:String(raw.reason||"Được phân loại theo tag và chấm điểm trong ứng dụng.").slice(0,300),usedDefaultTag:score.usedDefaultTag};
}
function dateAdd(value,days){const d=new Date(value+"T00:00:00");d.setDate(d.getDate()+days);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function dateDiff(from,to){return Math.round((new Date(to+"T00:00:00")-new Date(from+"T00:00:00"))/86400000);}
function periodBounds(rule,date,s){
 if(rule.taskType==="daily")return{start:date,end:date};
 if(rule.taskType==="weekly"){const anchor=s.planStart||rule.planStartDate||date,offset=Math.max(0,dateDiff(anchor,date)),start=dateAdd(anchor,Math.floor(offset/7)*7);return{start,end:dateAdd(start,6)};}
 return{start:s.planStart||rule.planStartDate,end:s.planEnd||rule.planEndDate};
}
function ruleCompleted(s,rule,date){
 const bounds=periodBounds(rule,date,s);
 return s.history.filter(e=>e.action==="completed"&&e.ruleId===rule.id&&e.date>=bounds.start&&e.date<=bounds.end).length;
}
function rulePhase(rule){if(rule.preferredTime==="evening")return"evening";if(rule.preferredTime==="any")return timeOfDay()==="evening"?"evening":"day";return"day";}
function ruleOccurrence(s,rule,date,index,phase,order){
 const raw={title:rule.title,description:rule.description,category:rule.category,tags:rule.tags,difficulty:rule.difficulty,energyRole:rule.energyRole,mainQuestId:rule.mainQuestId,weeklyQuestId:rule.weeklyQuestId,reason:rule.reason};
 const t=makeTask(s,raw,index,date,phase,order);if(!t)return null;
 t.ruleId=rule.id;t.taskType=rule.taskType;t.target=rule.target;t.period=rule.period;t.preferredTime=rule.preferredTime;
 t.batchId=date+":"+phase+":"+Math.floor(order/3);t.batchOrder=Math.floor(order/3);t.occurrenceIndex=index;
 return t;
}
function ensurePlanTasks(s){
 const plan=s.plans.find(p=>p.id===s.activePlanId&&p.status==="active");if(!plan)return false;
 const date=today();if(date<plan.startDate||date>plan.endDate)return false;
 const dayRules=s.taskRules.filter(r=>r.planId===plan.id&&r.status==="active");
 const oneTime=dayRules.filter(r=>r.taskType==="one_time"),oneTimeIndex=new Map(oneTime.map((r,i)=>[r.id,i]));
 let changed=false,created=0;
 for(const rule of dayRules){
  const bounds=periodBounds(rule,date,s),periodDays=Math.max(1,dateDiff(bounds.start,bounds.end)+1),dayIndex=Math.max(0,Math.min(periodDays-1,dateDiff(bounds.start,date)));
  const done=ruleCompleted(s,rule,date),todayRows=s.tasks.filter(t=>t.taskDate===date&&t.ruleId===rule.id);
  const outstanding=s.tasks.filter(t=>t.ruleId===rule.id&&t.taskDate<date&&t.status==="pending");
  outstanding.forEach(t=>{t.status="deferred";t.deferredAt=now();log(s,{action:"rescheduled",date,taskId:t.id,ruleId:rule.id,title:t.title,xpDelta:0,statDelta:{},reason:"Task chưa hoàn thành được giữ trong lịch sử và xét lại theo hạn mức của chu kỳ."});changed=true;});
  let count=0;
  if(rule.taskType==="daily"){
   count=Math.max(0,Math.max(1,Number(rule.target)||1)-todayRows.length);
  }else if(done<Math.max(1,Number(rule.target)||1)&&!todayRows.length){
   let due=false;
   if(rule.taskType==="one_time"){
    const total=oneTime.length,ordinal=oneTimeIndex.get(rule.id)||0,idealDay=Math.floor((ordinal+1)*periodDays/(total+1));
    due=dayIndex>=idealDay;
   }else{
    const target=Math.max(1,Number(rule.target)||1),dueByToday=Math.floor((dayIndex+1)*target/periodDays),daysLeft=periodDays-dayIndex,pending=s.tasks.filter(t=>t.ruleId===rule.id&&t.taskDate>=bounds.start&&t.taskDate<=bounds.end&&t.status==="pending").length,committed=done+pending;
    due=committed<dueByToday||(target-committed)>=daysLeft;
   }
   if(due)count=1;
  }
  while(count>0&&s.tasks.filter(t=>t.taskDate===date&&t.status!=="replaced"&&t.status!=="deferred").length<20){
   const phase=rulePhase(rule),order=s.tasks.filter(t=>t.taskDate===date&&t.timeOfDay===phase).reduce((m,t)=>Math.max(m,Number(t.queueOrder)||0),-1)+1;
   const t=ruleOccurrence(s,rule,date,todayRows.length+created,phase,order);if(!t)break;
   s.tasks.push(t);todayRows.push(t);log(s,{action:"created",date,taskId:t.id,ruleId:rule.id,title:t.title,category:t.category,tags:t.tags,difficulty:t.difficulty,taskType:t.taskType,target:t.target,period:t.period,preferredTime:t.preferredTime,timeOfDay:phase,xpDelta:0,statDelta:{},reason:t.reason});
   changed=true;created++;count--;
  }
 }
 return changed;
}
function importPlan(s,parsed){
 const rules=parsed.tasks.map(raw=>{
  const title=String(raw.title||raw.text||raw.name||"").trim();if(!title)return null;
  const taskType=["daily","weekly","recurring","one_time"].includes(raw.taskType)?raw.taskType:"one_time";
  const period=taskType==="daily"?"day":taskType==="weekly"?"week":"month";
  const target=taskType==="one_time"?1:Math.max(1,Math.min(taskType==="daily"?5:taskType==="weekly"?14:30,Math.round(Number(raw.target)||1)));
  const rawTags=Array.isArray(raw.tags)?raw.tags:String(raw.tags||"").split(/[,;|]/).filter(Boolean);
  const stats=window.LifeRpgTaskEngine.statTags(rawTags),score=window.LifeRpgTaskEngine.score(stats,raw.difficulty);
  const tags=rawTags.map(x=>String(x).trim()).filter(Boolean).slice(0,12);
  const main=s.quests.find(q=>q.type==="main"&&q.status==="active"&&q.title.toLowerCase()===String(raw.mainQuest||"").toLowerCase());
  const weekly=s.quests.find(q=>q.type==="weekly"&&q.status==="active"&&q.title.toLowerCase()===String(raw.weeklyQuest||"").toLowerCase());
  return{id:"rule-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),title,description:String(raw.description||"").slice(0,300),category:String(raw.category||tags[0]||"").slice(0,60),taskType,target,period,preferredTime:["morning","daytime","evening","any"].includes(raw.preferredTime)?raw.preferredTime:"any",tags,difficulty:score.difficulty,energyRole:["focus","movement","recovery","connection","reflection"].includes(raw.energyRole)?raw.energyRole:"focus",mainQuestId:main?main.id:null,weeklyQuestId:weekly?weekly.id:null,mainQuest:String(raw.mainQuest||"").slice(0,140),weeklyQuest:String(raw.weeklyQuest||"").slice(0,140),reason:String(raw.reason||"").slice(0,300),xp:score.xp,statEffects:score.statEffects,usedDefaultTag:score.usedDefaultTag,status:"active",createdAt:now()};
 }).filter(Boolean);
 const unique=[],seen=new Set();rules.forEach(r=>{const key=r.title.toLowerCase();if(!seen.has(key)){seen.add(key);unique.push(r);}});
 if(!unique.length)throw new Error("Gói kế hoạch chưa có Task hợp lệ.");
 s.taskRules.forEach(r=>{if(r.status==="active")r.status="archived";});
 s.plans.forEach(p=>{if(p.status==="active")p.status="archived";});
 const start=today(),end=dateAdd(start,29),planId="plan-"+Date.now()+"-"+Math.random().toString(36).slice(2,7);
 const main=parsed.mainQuest;if(main)addQuest(s,"main",main);
 (parsed.weeklyQuests||[]).forEach(q=>addQuest(s,"weekly",q));
 unique.forEach(r=>{const m=s.quests.find(q=>q.type==="main"&&q.status==="active"&&q.title.toLowerCase()===r.mainQuest.toLowerCase()),w=s.quests.find(q=>q.type==="weekly"&&q.status==="active"&&q.title.toLowerCase()===r.weeklyQuest.toLowerCase());r.mainQuestId=m?m.id:null;r.weeklyQuestId=w?w.id:null;});
 const plan={id:planId,startDate:start,endDate:end,status:"active",createdAt:now(),taskRuleIds:unique.map(r=>r.id)};
 s.plans.push(plan);s.activePlanId=planId;s.planStart=start;s.planEnd=end;
 unique.forEach(r=>{r.planId=planId;r.planStartDate=start;r.planEndDate=end;s.taskRules.push(r);});
 s.aiConversation={status:"PLAN_READY",questions:[],answers:[]};
 s.feedback="Đã nạp gói kế hoạch 30 ngày với "+unique.length+" Task rule.";
 ensurePlanTasks(s);
 log(s,{action:"plan_imported",date:start,planId,count:unique.length,xpDelta:0,statDelta:{},reason:"Đã lưu Task dưới dạng rule/template; các lần xuất hiện được phân phối theo lịch."});
 save(s);render("tasks");return unique.length;
}
function importPaste(text){
 const s=rollover(state()),parsed=window.LifeRpgTaskEngine.parse(text);
 if(!parsed)throw new Error("Không đọc được JSON. Hãy dán nguyên phản hồi JSON của AI.");
 if(parsed.status==="NEED_INFO"){
  if(!parsed.questions||parsed.questions.length<3)throw new Error("AI cần trả 3–6 câu hỏi trong JSON NEED_INFO.");
  s.aiConversation={status:"NEED_INFO",questions:parsed.questions.slice(0,6),answers:[]};
  s.feedback="AI cần thêm thông tin trước khi lập kế hoạch tháng.";
  save(s);render("import");return -1;
 }
 if(parsed.status!=="PLAN_READY"||!Array.isArray(parsed.tasks)||!parsed.tasks.length)throw new Error("Không thấy gói PLAN_READY có danh sách tasks.");
 return importPlan(s,parsed);
}
function timeOfDay(){return new Date().getHours()>=18?"evening":"day";}
function applyEveningSwitch(s,force){
 if(s.activePlanId&&s.taskRules.some(r=>r.planId===s.activePlanId&&r.status==="active"))return false;
 if(timeOfDay()!=="evening")return false;
 const flag="evening-switch:"+today(),already=!!s.bonuses[flag];
 if(already&&!force)return false;
 const pending=s.tasks.filter(t=>t.taskDate===today()&&t.timeOfDay!=="evening"&&t.status==="pending");
 if(!pending.length){if(!already){s.bonuses[flag]=true;s.tasks.filter(t=>t.taskDate===today()&&t.timeOfDay==="evening"&&t.status==="pending").forEach(t=>t.status="inactive");log(s,{action:"evening_check",date:today(),title:"Không còn Task ban ngày cần thay thế",xpDelta:0,statDelta:{}});save(s);}return false;}
 const alts=s.tasks.filter(t=>t.taskDate===today()&&t.timeOfDay==="evening"&&(t.status==="pending"||t.status==="inactive"));
 if(!alts.length)return false;
 const selected=alts.filter(e=>pending.some(d=>e.replacesTask&&e.replacesTask.toLowerCase()===d.title.toLowerCase()));
 const replacements=selected.length?selected:alts.filter(e=>!e.replacesTask);
 if(!replacements.length)return false;
 pending.forEach(d=>{const alt=selected.find(e=>e.replacesTask.toLowerCase()===d.title.toLowerCase())||(!selected.length?replacements[0]:null);if(!alt)return;d.status="deferred";d.deferredAt=now();log(s,{action:"evening_replaced",date:today(),taskId:d.id,title:d.title,replacedBy:alt.title,timeOfDay:"day",xpDelta:0,statDelta:{},reason:"Task ban ngày chưa hoàn thành được thay bằng kế hoạch buổi tối."});});
 const selectedIds=new Set(replacements.map(t=>t.id));
 alts.forEach(t=>{if(selectedIds.has(t.id))t.status="pending";else t.status="inactive";});
 s.bonuses[flag]=true;s.eveningActivatedDate=today();
 log(s,{action:"evening_plan_activated",date:today(),title:"Đã chuyển Task còn lại sang buổi tối",count:replacements.length,xpDelta:0,statDelta:{}});
 save(s);return true;
}
function complete(id){
 const s=rollover(state()),t=s.tasks.find(x=>x.id===id);if(!t||t.status!=="pending")return;
 t.status="completed";t.completedAt=now();const effects={};
 Object.keys(t.statEffects||{}).forEach(k=>{if(KEYS.includes(k)){const amount=Math.max(0,Math.min(5,Math.round(Number(t.statEffects[k])||0)));if(amount){s.stats[k]=(Number(s.stats[k])||0)+amount;effects[k]=amount;}}});
 addXp(s,t.xp);
 log(s,{action:"completed",date:today(),taskId:t.id,ruleId:t.ruleId||null,title:t.title,category:t.category,tags:t.tags,difficulty:t.difficulty,xpDelta:t.xp,statDelta:effects,mainQuestId:t.mainQuestId,weeklyQuestId:t.weeklyQuestId,reason:t.reason,createdAt:t.createdAt,completedAt:t.completedAt});
 let bonus=0;if(completedToday(s,today())>=6&&!s.bonuses["six-tasks:"+today()]){s.bonuses["six-tasks:"+today()]=true;bonus=3;addXp(s,bonus);log(s,{action:"daily_bonus",date:today(),title:"Thưởng hoàn thành 6 Task",xpDelta:bonus,statDelta:{}});}
 s.feedback="+"+t.xp+" XP · "+taskEffectsLine(effects)+(bonus?" · Thưởng +3 XP":"");save(s);render("tasks");
}
function skip(id){const s=rollover(state()),t=s.tasks.find(x=>x.id===id);if(!t||t.status!=="pending")return;t.status="skipped";log(s,{action:"skipped",date:today(),taskId:t.id,title:t.title,category:t.category,tags:t.tags,difficulty:t.difficulty,xpDelta:0,statDelta:{},reason:"Người dùng bỏ qua Task."});s.feedback="Đã bỏ qua Task; không thay đổi XP/Stats.";save(s);render("tasks");}
function swapTasks(mode){
 const s=rollover(state());applyEveningSwitch(s,false);
 if(s.activePlanId)ensurePlanTasks(s);
 const group=currentBatch(s);if(!group.length){alert("Không có bộ Task đang mở để đổi.");return false;}
 const phase=timeOfDay(),targets=mode==="all"?group.slice():group.filter(t=>t.status==="pending");
 if(!targets.length){alert("Không có Task chưa hoàn thành trong bộ hiện tại.");return false;}
 let replacements=[];
 const plan=s.plans.find(p=>p.id===s.activePlanId&&p.status==="active");
 if(plan){
  const excludedRules=new Set(group.map(t=>t.ruleId).filter(Boolean)),recentCutoff=dateAdd(today(),-3),usedRecently=new Set(s.history.filter(e=>e.ruleId&&e.date>=recentCutoff&&["created","completed","skipped","task_swapped_in"].includes(e.action)).map(e=>e.ruleId));
  const rules=s.taskRules.filter(r=>{
   if(r.planId!==plan.id||r.status!=="active"||excludedRules.has(r.id)||usedRecently.has(r.id))return false;
   if((phase==="evening"&&r.preferredTime!=="evening"&&r.preferredTime!=="any")||(phase!=="evening"&&r.preferredTime==="evening"))return false;
   if(s.tasks.some(t=>t.taskDate===today()&&t.ruleId===r.id&&t.status!=="replaced"&&t.status!=="deferred"))return false;
   return ruleCompleted(s,r,today())<Math.max(1,Number(r.target)||1);
  }).sort((a,b)=>{
   const pref=r=>r.preferredTime===phase||r.preferredTime==="any"?0:1;
   return pref(a)-pref(b)||String(a.createdAt).localeCompare(String(b.createdAt));
  });
  rules.slice(0,targets.length).forEach((rule,index)=>{
   const order=s.tasks.filter(t=>t.taskDate===today()&&t.timeOfDay===phase).reduce((m,t)=>Math.max(m,Number(t.queueOrder)||0),-1)+1;
   const next=ruleOccurrence(s,rule,today(),index,phase,order);if(next){s.tasks.push(next);log(s,{action:"created",date:today(),taskId:next.id,ruleId:rule.id,title:next.title,timeOfDay:phase,xpDelta:0,statDelta:{},reason:"Task được chọn từ rule của gói kế hoạch khi đổi Task."});replacements.push(next);}
  });
 }else{
  const ids=new Set(group.map(t=>t.id));
  const candidates=s.tasks.filter(t=>t.taskDate===today()&&t.timeOfDay===phase&&!ids.has(t.id)&&!t.hiddenFromQueue&&(phase==="evening"?(t.status==="pending"||t.status==="inactive"):t.status==="pending")).sort((a,b)=>(Number(a.batchOrder)||0)-(Number(b.batchOrder)||0)||queueOrder(a,b));
  replacements=candidates.slice(0,targets.length);
 }
 if(replacements.length<targets.length){alert("Không đủ Task hợp lệ khác trong gói kế hoạch hiện tại để đổi. Không có Task nào bị thay đổi.");return false;}
 const batchId=group[0].batchId,batchOrder=Number(group[0].batchOrder)||0;
 targets.forEach((old,index)=>{
  const next=replacements[index];
  if(old.status==="pending")old.status="replaced";
  old.hiddenFromQueue=true;old.replacedAt=now();
  log(s,{action:"task_swapped_out",date:today(),taskId:old.id,ruleId:old.ruleId||null,title:old.title,timeOfDay:old.timeOfDay,replacedBy:next.title,xpDelta:0,statDelta:{},reason:"Người dùng đổi Task."});
  next.status="pending";next.hiddenFromQueue=false;next.timeOfDay=phase;next.batchId=batchId;next.batchOrder=batchOrder;next.queueOrder=Number(old.queueOrder)||index;next.replacesTask=old.title;next.swappedAt=now();
  log(s,{action:"task_swapped_in",date:today(),taskId:next.id,ruleId:next.ruleId||null,title:next.title,timeOfDay:phase,replacesTask:old.title,xpDelta:0,statDelta:{},reason:"Task được đưa vào bộ hiện tại theo yêu cầu người dùng."});
 });
 if(phase==="evening")s.eveningActivatedDate=today();
 s.feedback="Đã đổi "+targets.length+" Task trong khung "+(phase==="evening"?"buổi tối":"ban ngày")+".";
 save(s);render("tasks");return true;
}
function addManualTask(form){
 const s=rollover(state()),date=today(),count=s.tasks.filter(t=>t.taskDate===date).length;
 if(count>=20){alert("Đã đạt giới hạn 20 Task hôm nay.");return false;}
 const title=String(form.title||"").trim();if(!title){alert("Nhập nội dung Task.");return false;}
 const phase=form.timeOfDay==="evening"?"evening":"day",same=s.tasks.filter(t=>t.taskDate===date&&t.timeOfDay===phase);
 const order=same.reduce((max,t)=>Math.max(max,Number(t.queueOrder)||0),-1)+1;
 const raw={title,tags:String(form.tags||"").split(/[,;|]/).map(x=>x.trim()).filter(Boolean),difficulty:form.difficulty||"Normal",energyRole:form.energyRole||"focus"};
 const task=makeTask(s,raw,order,date,phase,order);if(!task)return false;
 s.tasks.push(task);log(s,{action:"created",date,taskId:task.id,title:task.title,tags:task.tags,difficulty:task.difficulty,timeOfDay:phase,xpDelta:0,statDelta:{},reason:"Task do người dùng thêm thủ công."});
 s.feedback="Đã thêm Task vào hàng chờ "+(phase==="evening"?"buổi tối.":"ban ngày.");
 save(s);if(phase==="evening"&&timeOfDay()==="evening")applyEveningSwitch(s,true);render("import");return true;
}
function removeTask(id){
 const s=rollover(state()),index=s.tasks.findIndex(t=>t.id===id&&t.taskDate===today());if(index<0)return false;
 const task=s.tasks[index];log(s,{action:"task_deleted",date:today(),taskId:task.id,ruleId:task.ruleId||null,title:task.title,timeOfDay:task.timeOfDay,xpDelta:0,statDelta:{},reason:"Task bị xóa khỏi hàng chờ; history thưởng trước đó vẫn được giữ."});
 if(task.ruleId){task.status="deleted";task.deletedAt=now();}else s.tasks.splice(index,1);
 s.feedback="Đã xóa Task khỏi danh sách hôm nay.";save(s);render("import");return true;
}
function radar(values,max,title){const cx=120,cy=105,r=72,n=KEYS.length,p=(i,k)=>{const a=-Math.PI/2+i*2*Math.PI/n;return(cx+Math.cos(a)*r*k).toFixed(1)+","+(cy+Math.sin(a)*r*k).toFixed(1);};let x='<svg viewBox="0 0 240 210" role="img" aria-label="'+esc(title)+'">';[.25,.5,.75,1].forEach(k=>x+='<polygon points="'+KEYS.map((_,i)=>p(i,k)).join(" ")+'" fill="none" stroke="#dfe2ed"/>');KEYS.forEach((k,i)=>x+='<line x1="'+cx+'" y1="'+cy+'" x2="'+p(i,1)+'" stroke="#dfe2ed"/>');x+='<polygon points="'+KEYS.map((k,i)=>p(i,Math.min(1,Math.max(0,Number(values[k])||0)/Math.max(1,max)))).join(" ")+'" fill="rgba(124,102,238,.24)" stroke="#7866ee" stroke-width="2"/>';KEYS.forEach((k,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;x+='<text x="'+(cx+Math.cos(a)*99).toFixed(1)+'" y="'+(cy+Math.sin(a)*99+4).toFixed(1)+'" text-anchor="middle" font-size="10" fill="#41445a">'+k+'</text>';});return x+"</svg>";}
function growth(s,days){const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days+1);const key=cutoff.getFullYear()+"-"+String(cutoff.getMonth()+1).padStart(2,"0")+"-"+String(cutoff.getDate()).padStart(2,"0"),out={};KEYS.forEach(k=>out[k]=0);s.history.forEach(e=>{if(e.action==="completed"&&e.date>=key&&e.date<=today())KEYS.forEach(k=>out[k]+=Number((e.statDelta||{})[k])||0);});return out;}
const CSS='.rpg-wrap{display:grid;gap:14px;color:#1b1e2e}.rpg-panel{padding:16px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:rgba(255,255,255,.9);box-shadow:0 12px 32px rgba(0,0,0,.07)}.rpg-panel h2,.rpg-panel h3{margin:0 0 9px}.rpg-muted{color:#777d9a;font-size:13px}.rpg-progress{height:9px;background:#e9e8f4;border-radius:99px;overflow:hidden;margin-top:7px}.rpg-progress span{display:block;height:100%;background:linear-gradient(90deg,#7866ee,#b09bff)}.rpg-manage-form{display:grid;grid-template-columns:2fr 2fr 1fr 1fr auto;gap:7px;align-items:center}.rpg-manage-list{display:grid;gap:6px;margin-top:12px}.rpg-manage-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px;border-bottom:1px solid #eee}.rpg-manage-row small{color:#777d9a}.rpg-swap-actions{justify-content:center}.rpg-task-list{display:grid;gap:9px}.rpg-taskrow{display:flex;align-items:flex-start;gap:12px;padding:16px;border:1px solid #e9e7f4;border-radius:13px;background:rgba(255,255,255,.94);font-size:16px;line-height:1.45;cursor:pointer}.rpg-taskrow input{width:24px;height:24px;min-width:24px;margin:0;accent-color:#7866ee;cursor:pointer}.rpg-taskrow input:checked+span{color:#798096;text-decoration:line-through}.rpg-head{display:flex;justify-content:space-between;gap:10px}.rpg-chip{background:#f1efff;border-radius:99px;padding:3px 8px;font-size:11px}.rpg-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.rpg-feedback{padding:10px 12px;background:#effaf2;border:1px solid #c9efd4;border-radius:12px;color:#226b3b}.rpg-empty{text-align:center;padding:20px;color:#777d9a}.rpg-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rpg-stat{display:flex;justify-content:space-between;padding:8px 3px;border-bottom:1px solid #eee}.rpg-chart{display:grid;grid-template-columns:minmax(200px,1fr) minmax(180px,.8fr);align-items:center;gap:10px}.rpg-chart svg{width:100%;max-width:280px;display:block;margin:auto}.rpg-history{max-height:280px;overflow:auto}.rpg-history div{padding:8px;border-bottom:1px solid #eee;font-size:12px}.rpg-form{display:grid;gap:9px}.rpg-form textarea{height:330px;min-height:220px;resize:vertical;font:14px/1.5 ui-monospace,monospace}.rpg-code{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f2ff;border-radius:12px;padding:12px;font:12px/1.5 ui-monospace,monospace;max-height:460px;overflow:auto}.rpg-quest{padding:10px;border:1px solid #eee;border-radius:10px;margin-top:8px}@media(max-width:650px){.rpg-grid,.rpg-chart{grid-template-columns:1fr}.rpg-manage-form{grid-template-columns:1fr 1fr}.rpg-manage-form input:first-child,.rpg-manage-form button{grid-column:1/-1}}';
function style(){return"<style>"+CSS+"</style>";}
function taskCard(t){const checked=t.status==="completed"?" checked disabled":"";return'<label class="rpg-taskrow"><input type="checkbox" data-do="complete" data-id="'+esc(t.id)+'"'+checked+'><span>'+esc(t.title)+'</span></label>';}
function bindTaskButtons(){document.querySelectorAll("[data-do=complete]").forEach(b=>b.onchange=()=>{if(b.checked)complete(b.dataset.id);});}
function queueOrder(a,b){if(Number.isFinite(a.queueOrder)&&Number.isFinite(b.queueOrder))return a.queueOrder-b.queueOrder;return String(a.createdAt||"").localeCompare(String(b.createdAt||""))||String(a.id).localeCompare(String(b.id));}
function firstPendingGroup(tasks){
 const visible=tasks.filter(t=>!t.hiddenFromQueue&&(t.status==="pending"||t.status==="completed")),groups={};
 visible.forEach(t=>{const key=t.batchId||t.taskDate+":"+t.timeOfDay+":"+Math.floor((Number(t.queueOrder)||0)/3);(groups[key]||(groups[key]=[])).push(t);});
 const ordered=Object.keys(groups).map(key=>({key,items:groups[key],order:Math.min(...groups[key].map(t=>Number(t.batchOrder)||0))})).sort((a,b)=>a.order-b.order||a.key.localeCompare(b.key));
 for(const group of ordered){if(group.items.some(t=>t.status==="pending"))return group.items.sort(queueOrder);}
 return[];
}
function currentBatch(s){
 const evening=timeOfDay()==="evening",hasPlan=!!(s.activePlanId&&s.taskRules.some(r=>r.planId===s.activePlanId&&r.status==="active"));
 if(evening&&(hasPlan||s.eveningActivatedDate===today())){
  const night=firstPendingGroup(s.tasks.filter(t=>t.taskDate===today()&&t.timeOfDay==="evening"));
  if(night.length)return night;
  return firstPendingGroup(s.tasks.filter(t=>t.taskDate===today()&&t.timeOfDay!=="evening"));
 }
 return firstPendingGroup(s.tasks.filter(t=>t.taskDate===today()&&t.timeOfDay!=="evening"));
}
function renderTasks(s){
 if(ensurePlanTasks(s))save(s);
 const batch=currentBatch(s);
 view.innerHTML=style()+'<div class="rpg-wrap"><section class="rpg-panel"><div class="rpg-task-list">'+(batch.length?batch.map(t=>taskCard(t)).join(""):'<div class="rpg-empty">Đã hoàn thành toàn bộ Task hiện có. Nạp nhóm Task tiếp theo khi sẵn sàng.</div>')+'</div>'+(batch.length?'<div class="rpg-actions rpg-swap-actions"><button class="btn-ghost" id="swap-all">Đổi bộ 3 mới</button><button class="btn-ghost" id="swap-pending">Đổi Task chưa xong</button></div>':'')+'</section></div>';
 bindTaskButtons();
 const all=document.getElementById("swap-all"),pending=document.getElementById("swap-pending");
 if(all)all.onclick=()=>swapTasks("all");if(pending)pending.onclick=()=>swapTasks("pending");
}
function renderStats(s){
 const need=needed(s.level),pct=Math.min(100,Math.round(s.xp/need*100)),days=Number(s.preferences.growthDays)||7,g=growth(s,days),max=Math.max(1,...KEYS.map(k=>s.stats[k])),gmax=Math.max(1,...KEYS.map(k=>g[k]));
 view.innerHTML=style()+'<div class="rpg-wrap"><section class="rpg-panel"><div class="rpg-head"><h2>Level '+s.level+'</h2><strong>'+s.xp+' / '+need+' XP</strong></div><div class="rpg-progress"><span style="width:'+pct+'%"></span></div><div class="rpg-muted">Còn '+(need-s.xp)+' XP tới Level '+(s.level+1)+'</div></section><section class="rpg-panel"><h2>6 chỉ số hiện tại</h2><div class="rpg-chart"><div>'+radar(s.stats,max,"Current Stats")+'</div><div>'+KEYS.map(k=>'<div class="rpg-stat"><span><b>'+k+'</b> · '+NAMES[k]+'</span><strong>'+Math.round(s.stats[k]||0)+'</strong></div>').join("")+'</div></div><p class="rpg-muted">VIT là chỉ số game hóa, không phải chẩn đoán hoặc đo tuổi sinh học y khoa.</p></section><section class="rpg-panel"><div class="rpg-head"><h2>Tiến độ tăng trong '+days+' ngày</h2><div><button class="btn-ghost" data-days="7">7 ngày</button> <button class="btn-ghost" data-days="30">30 ngày</button></div></div><div class="rpg-chart"><div>'+radar(g,gmax,"Stat Growth")+'</div><div>'+KEYS.map(k=>'<div class="rpg-stat"><span><b>'+k+'</b> · '+NAMES[k]+'</span><strong>+'+Math.round(g[k]||0)+'</strong></div>').join("")+'</div></div></section><section class="rpg-panel"><h2>Lịch sử XP & Stats</h2><div class="rpg-history">'+(s.history.slice().reverse().slice(0,80).map(e=>'<div><b>'+esc(e.date||"")+'</b> · '+esc(e.title||e.action)+' · '+(Number(e.xpDelta)>0?"+"+e.xpDelta:Number(e.xpDelta)||0)+' XP · '+esc(taskEffectsLine(e.statDelta||{}))+'</div>').join("")||'<div class="rpg-muted">Chưa có lịch sử.</div>')+'</div></section></div>';
 document.querySelectorAll("[data-days]").forEach(b=>b.onclick=()=>{const n=state();n.preferences.growthDays=Number(b.dataset.days);save(n);render("stats");});
}
function buildPrompt(){const s=state(),actions=s.history.filter(e=>e.action==="completed"||e.action==="skipped"),den=actions.length,done=actions.filter(e=>e.action==="completed").length,skipped=actions.filter(e=>e.action==="skipped"||e.action==="task_deleted").slice(-20).map(e=>({title:e.title,action:e.action,date:e.date,reason:e.reason}));return window.LifeRpgTaskEngine.makePrompt({userData:{profile:{name:s.user.name,level:s.level,xp:s.xp},goals:s.user.goals,mainQuest:activeQuest(s,"main"),weeklyQuest:activeQuest(s,"weekly"),currentStats:s.stats,completionRate:den?done/den:0,taskHistory:s.history.slice(-60),skippedOrDeleted:skipped,activePlan:s.plans.find(p=>p.id===s.activePlanId)||null,activeTaskRules:s.taskRules.filter(r=>r.planId===s.activePlanId&&r.status==="active").map(r=>({title:r.title,taskType:r.taskType,target:r.target,period:r.period,preferredTime:r.preferredTime,tags:r.tags})),statGrowth:growth(s,30)},answers:s.aiConversation&&s.aiConversation.status==="ANSWERED"?s.aiConversation.answers||[]:[]});}
function taskManagerMarkup(s){
 const tasks=s.tasks.filter(t=>t.taskDate===today()&&t.status!=="deleted").sort((a,b)=>(a.timeOfDay==="evening"?1:0)-(b.timeOfDay==="evening"?1:0)||(Number(a.batchOrder)||0)-(Number(b.batchOrder)||0)||queueOrder(a,b));
 const status={pending:"Chờ",completed:"Đã xong",deferred:"Đã chuyển",inactive:"Phương án dự phòng",replaced:"Đã đổi",skipped:"Bỏ qua"};
 return '<section class="rpg-panel"><h2>Danh sách Task hôm nay</h2><form id="manual-task-form" class="rpg-manage-form"><input name="title" maxlength="140" placeholder="Nội dung Task" required><input name="tags" maxlength="180" placeholder="Tag chỉ số hoặc chủ đề (tùy chọn)"><select name="difficulty"><option>Easy</option><option selected>Normal</option><option>Hard</option><option>Epic</option></select><select name="timeOfDay"><option value="day">Ban ngày</option><option value="evening">Buổi tối</option></select><button class="btn-primary">Thêm Task thủ công</button></form><div class="rpg-manage-list">'+(tasks.length?tasks.map(t=>'<div class="rpg-manage-row"><span>'+esc(t.title)+' <small>· '+(t.timeOfDay==="evening"?"Buổi tối":"Ban ngày")+' · '+esc(status[t.status]||t.status)+'</small></span><button class="btn-ghost" data-remove-task="'+esc(t.id)+'" aria-label="Xóa '+esc(t.title)+'">Xóa</button></div>').join(""):'<div class="rpg-empty">Chưa có Task.</div>')+'</div></section>';
}
function renderImport(s){
 const prompt=buildPrompt(),tasks=s.tasks.filter(t=>t.taskDate===today()).length,interview=s.aiConversation&&["NEED_INFO","ANSWERED"].includes(s.aiConversation.status)?(s.aiConversation.status==="NEED_INFO"?'<section class="rpg-panel"><h2>AI cần thêm thông tin</h2><ol>'+(s.aiConversation.questions||[]).map(q=>"<li>"+esc(q)+"</li>").join("")+'</ol><form id="ai-answer-form" class="rpg-form"><label>Câu trả lời, có thể trả lời từng dòng<textarea name="answers" placeholder="Nhập câu trả lời theo thứ tự câu hỏi..." required></textarea></label><button class="btn-primary">Lưu câu trả lời và tạo Prompt tiếp theo</button></form></section>':'<section class="rpg-panel"><h2>Tiếp tục cuộc trao đổi với AI</h2><p class="rpg-muted">Câu trả lời đã được lưu vào USER_DATA. Sao chép Prompt phía dưới, gửi tiếp trong cùng cuộc trò chuyện AI rồi dán phản hồi JSON để nạp kế hoạch.</p></section>'):"";
 view.innerHTML=style()+'<div class="rpg-wrap"><section class="rpg-panel"><h2>Nạp Quest & Task</h2><p class="rpg-muted">Sao chép Prompt bên dưới sang ChatGPT rồi dán phản hồi JSON ở đây. Task sẽ được phân phối từ gói kế hoạch 30 ngày. Hôm nay: '+tasks+' Task đã lên lịch.</p><form id="paste-form" class="rpg-form"><textarea id="paste-input" placeholder=\'Dán JSON AI hoặc dạng gắn thẻ ở đây...\'></textarea><button class="btn-primary">Nạp Quest & Task</button></form><div id="import-error" class="rpg-muted" style="color:#a43b3b"></div>'+interview+(s.feedback?'<p class="rpg-feedback">'+esc(s.feedback)+'</p>':"")+'</section>'+taskManagerMarkup(s)+'<section class="rpg-panel"><h2>Quy tắc cho AI tạo Quest và Task</h2><p class="rpg-muted">Sao chép hướng dẫn có kèm profile, mục tiêu, Quest, Stats và lịch sử gần đây; gửi trong ChatGPT rồi dán JSON trả về phía trên.</p><div class="rpg-actions"><button class="btn-ghost" id="copy-prompt">Sao chép prompt AI</button></div><pre class="rpg-code" id="prompt-text">'+esc(prompt)+'</pre></section><section class="rpg-panel"><h2>Cách chấm điểm bằng tag</h2><div class="rpg-muted">Tag chỉ số: SI (tư duy/học tập), STR (thể lực), EN (sức bền/thói quen), VIT (phục hồi trong game), EQ (cảm xúc), Y (nội tâm). Mỗi Task nên có 1–3 tag Stats và tag chủ đề tùy chọn.</div><div class="rpg-quest"><b>Easy</b> · 15 XP · tag đầu +1, tag thứ hai +1<br><b>Normal</b> · 30 XP · +2, +1<br><b>Hard</b> · 55 XP · +3, +2, +1<br><b>Epic</b> · 85 XP · +4, +3, +2<br><span class="rpg-muted">Không có tag Stats hợp lệ: mặc định EN +1. Hoàn thành Task không thể cộng điểm lần thứ hai.</span></div><p class="rpg-muted">Có thể dán JSON hoặc văn bản gắn thẻ với các mục [MAIN QUEST], [WEEKLY QUEST], [TASK], [EVENING TASK]. Không cần theo danh sách Task mẫu.</p></section><section class="rpg-panel"><h2>Hồ sơ & dữ liệu</h2><form id="profile-form" class="rpg-form"><label>Tên người chơi<input name="name" maxlength="80"></label><label>Mục tiêu dài hạn, mỗi dòng một mục tiêu<textarea name="goals" style="height:120px" placeholder="Phát triển kênh cá nhân&#10;Học ngoại ngữ"></textarea></label><button class="btn-primary">Lưu hồ sơ và mục tiêu</button></form><div class="rpg-actions"><button class="btn-ghost" id="export-backup">Tải backup</button><label class="btn-ghost" for="restore-backup" style="cursor:pointer">Phục hồi backup</label><input id="restore-backup" type="file" accept="application/json" hidden></div><p class="rpg-muted">Task, Quest, XP, Stats và history được lưu cục bộ trên thiết bị này.</p></section></div>';
 const profile=state();
 document.getElementById("profile-form").elements.name.value=profile.user.name||"";
 document.getElementById("profile-form").elements.goals.value=(profile.user.goals||[]).join("\n");
 document.getElementById("profile-form").onsubmit=e=>{e.preventDefault();const n=state(),f=e.currentTarget;n.user.name=f.elements.name.value.trim()||"Player";n.user.goals=f.elements.goals.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,30);n.feedback="Đã lưu tên và mục tiêu cho prompt AI.";save(n);render("import");};
 document.getElementById("export-backup").onclick=()=>{const payload={format:"life-rpg-backup.v1",exportedAt:now(),state:state()};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="mori-quest-backup-"+today()+".json";a.click();URL.revokeObjectURL(url);};
 document.getElementById("restore-backup").onchange=e=>{const file=e.target.files&&e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const payload=JSON.parse(String(reader.result||""));if(payload.format!=="life-rpg-backup.v1"||!payload.state||![1,2].includes(payload.state.schemaVersion))throw new Error("File backup không đúng định dạng.");localStorage.setItem(STORE,JSON.stringify(payload.state));render("import");}catch(ex){alert("Không thể phục hồi: "+String(ex.message||ex));}};reader.readAsText(file);};
 const manual=document.getElementById("manual-task-form");
 manual.onsubmit=e=>{e.preventDefault();const f=e.currentTarget;const ok=addManualTask({title:f.elements.title.value,tags:f.elements.tags.value,difficulty:f.elements.difficulty.value,timeOfDay:f.elements.timeOfDay.value});if(ok)f.reset();};
 document.querySelectorAll("[data-remove-task]").forEach(b=>b.onclick=()=>removeTask(b.dataset.removeTask));
 document.getElementById("paste-form").onsubmit=e=>{e.preventDefault();const err=document.getElementById("import-error");try{const count=importPaste(document.getElementById("paste-input").value);if(count)document.getElementById("paste-input").value="";}catch(ex){err.textContent=String(ex.message||ex);}};
 const answerForm=document.getElementById("ai-answer-form");
 if(answerForm)answerForm.onsubmit=async e=>{e.preventDefault();const n=state(),answers=e.currentTarget.elements.answers.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!answers.length)return;n.aiConversation={status:"ANSWERED",questions:n.aiConversation&&n.aiConversation.questions||[],answers};n.feedback="Đã lưu câu trả lời. Prompt tiếp theo đã sẵn sàng.";save(n);render("import");};
 document.getElementById("copy-prompt").onclick=async()=>{try{await navigator.clipboard.writeText(prompt);document.getElementById("copy-prompt").textContent="Đã sao chép";}catch(_){const r=document.createRange();r.selectNodeContents(document.getElementById("prompt-text"));const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);document.getElementById("copy-prompt").textContent="Chọn prompt rồi sao chép";}};
}
function render(tab){
 const current=rollover(state());applyEveningSwitch(current,false);activeTab=["tasks","stats","import"].includes(tab)?tab:"tasks";
 const items=[{id:"tasks",label:"Task",icon:"✅"},{id:"stats",label:"Chỉ số",icon:"📊"},{id:"import",label:"Nạp Quest & Task",icon:"📋"}];
 if(tabsBar){tabsBar.innerHTML=items.map(i=>'<button type="button" class="tab-btn '+(activeTab===i.id?"active":"")+'" data-rpg-tab="'+i.id+'" aria-label="'+i.label+'">'+i.icon+'</button>').join("");tabsBar.querySelectorAll("[data-rpg-tab]").forEach(b=>b.onclick=()=>render(b.dataset.rpgTab));}
 const s=rollover(state());if(activeTab==="stats")renderStats(s);else if(activeTab==="import")renderImport(s);else renderTasks(s);
}
function rolloverForLegacy(){rollover(state());return true;}
const storageKey="tq_liferpg_state_v1";if(!localStorage.getItem(storageKey))save(fresh());else{try{const stored=JSON.parse(localStorage.getItem(storageKey));if(stored.schemaVersion!==2)save(state());}catch(_){}}
try{if(window.stopDaySyncMonitoring)window.stopDaySyncMonitoring();}catch(_){}
window.LifeRpg={render,rollover:rolloverForLegacy,state,completeTask:complete,skipTask:skip,importPaste,buildPrompt,swapTasks,addManualTask,removeTask};
window.render=render;render("tasks");
let lastTimeBlock=timeOfDay();window.setInterval(()=>{const nextBlock=timeOfDay(),dayChanged=state().currentDate!==today();if(dayChanged||nextBlock!==lastTimeBlock){lastTimeBlock=nextBlock;render(activeTab);}},60000);
window.addEventListener("storage",e=>{if(e.key===STORE)render(activeTab);});
})();