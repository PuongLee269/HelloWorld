/* Mori Quest Life RPG: three focused tabs, local progression, tagged AI paste import. */
(function(){
"use strict";
const STORE="tq_liferpg_state_v1",PROFILE="tq_profile",KEYS=["SI","STR","EN","VIT","EQ","Y"];
const NAMES={SI:"Trí tuệ",STR:"Thể lực",EN:"Sức bền",VIT:"Vitality*",EQ:"Cân bằng cảm xúc",Y:"Nội tâm"};
const ENERGY_ICONS=["✨","⚡","🪫","💧","🍎","🏃","🧘","📚","❤️","🌙","🔥","🎯","🍽️","🥗","🥤","☕","🍵","🥛","💊","🛌","😴","🚶","🚴","🏋️","🧠","📝","🎨","🎵","🎮","🌿","🌞","🌧️","💤","🫁","🤝","💬","🐱","🐶","🧹","🧺","🛁","🚿","🥦","🍌","🍊","🥑","🍓","🍇","🍉","🥜","🍫","🛒","💸","🎧","📖","🕯️","🙏","🌊","🧊","😌","😣","🙂","😵‍💫","🫣","☀️","🌱","🏠","💼","🧾","📞","✍️","🧴","🧼","🧽","⏰","🧘‍♀️","🧘‍♂️","👟","⚽","🏀","🏸","🎤","🎬","💻","📱","🔕","🔔","🌈","⭐","🪴","🪷","🕊️"];
const view=document.getElementById("view"),tabsBar=document.getElementById("tabsBar");
let activeTab="tasks";
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const now=()=>new Date().toISOString();
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch(_){return fallback;}};
function fresh(){const old=read(PROFILE,{}),stats={};KEYS.forEach(k=>stats[k]=10);return{schemaVersion:2,currentDate:today(),user:{name:old.name||"Player",goals:[]},level:Math.max(1,Number(old.level)||1),xp:Math.max(0,Number(old.xp)||0),stats,tasks:[],taskRules:[],plans:[],activePlanId:null,planStart:null,planEnd:null,aiConversation:null,quests:[],history:[],preferences:{growthDays:7},bonuses:{},feedback:"",energyButtons:defaultEnergyButtons(),energyEvents:[],energyCooldowns:{},luckyButton:{icon:"🍀",effects:{}},luckyEvents:[]};}
function defaultEnergyButtons(){return[{id:"energy-low",title:"Tụt năng lượng",icon:"🪫",effects:{EN:-1,VIT:-1}},{id:"full-stomach",title:"Đầy bụng",icon:"🍽️",effects:{EN:-1,VIT:-1}},{id:"fap",title:"Fap",icon:"🫣",effects:{EN:-1,VIT:-1}},{id:"drink-water",title:"Uống nước",icon:"💧",effects:{VIT:1}},{id:"eat-fruit",title:"Ăn hoa quả",icon:"🍎",effects:{STR:1,VIT:1}}];}
function state(){
 const raw=read(STORE,null);if(!raw||![1,2].includes(raw.schemaVersion))return fresh();
 const base=fresh(),s=Object.assign(base,raw);s.schemaVersion=2;
 s.user=Object.assign(base.user,raw.user||{});s.stats=Object.assign(base.stats,raw.stats||{});s.preferences=Object.assign(base.preferences,raw.preferences||{});
 ["tasks","taskRules","plans","quests","history","energyEvents"].forEach(k=>s[k]=Array.isArray(raw[k])?raw[k]:[]);
 s.energyButtons=Array.isArray(raw.energyButtons)?raw.energyButtons:defaultEnergyButtons();
 s.energyCooldowns=raw.energyCooldowns&&typeof raw.energyCooldowns==="object"?raw.energyCooldowns:{};
 s.luckyButton=Object.assign({icon:"🍀",effects:{}},raw.luckyButton||{});s.luckyButton.effects=Object.assign({},s.luckyButton.effects||{});KEYS.forEach(k=>s.luckyButton.effects[k]=Math.max(0,Math.min(5,Math.round(Number(s.luckyButton.effects[k])||0))));s.luckyEvents=Array.isArray(raw.luckyEvents)?raw.luckyEvents:[];
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
  outstanding.forEach(t=>{const oldDate=t.taskDate,phase=rulePhase(rule),order=s.tasks.filter(x=>x.taskDate===date&&x.timeOfDay===phase).reduce((m,x)=>Math.max(m,Number(x.queueOrder)||0),-1)+1;t.originalTaskDate=t.originalTaskDate||oldDate;t.taskDate=date;t.timeOfDay=phase;t.queueOrder=order;t.batchOrder=Math.floor(order/3);t.batchId=date+":"+phase+":"+t.batchOrder;t.rescheduledAt=now();todayRows.push(t);log(s,{action:"rescheduled",date,taskId:t.id,ruleId:rule.id,title:t.title,fromDate:oldDate,xpDelta:0,statDelta:{},reason:"Task chưa hoàn thành được chuyển sang ngày phù hợp tiếp theo."});changed=true;});
  let count=0;
  if(rule.taskType==="daily"){
   count=Math.max(0,Math.max(1,Number(rule.target)||1)-todayRows.length);
  }else if(done<Math.max(1,Number(rule.target)||1)&&!todayRows.length){
   let due=false;
   if(rule.taskType==="one_time"){
    const total=oneTime.length,ordinal=oneTimeIndex.get(rule.id)||0,idealDay=Math.floor((ordinal+1)*periodDays/(total+1));
    due=dayIndex>=idealDay;
   }else{
    const target=Math.max(1,Number(rule.target)||1),dueByToday=Math.floor((dayIndex+1)*target/periodDays),daysLeft=periodDays-dayIndex,attempted=s.tasks.filter(t=>t.ruleId===rule.id&&t.taskDate>=bounds.start&&t.taskDate<=bounds.end&&t.status!=="replaced"&&t.status!=="deferred").length;
    due=attempted<dueByToday||(target-done)>=daysLeft;
   }
   if(due)count=1;
  }
  while(count>0&&s.tasks.filter(t=>t.taskDate===date&&t.status!=="replaced"&&t.status!=="deferred").length<50){
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
 const archivedRuleIds=new Set(s.taskRules.filter(r=>r.status==="active").map(r=>r.id));
 s.taskRules.forEach(r=>{if(r.status==="active")r.status="archived";});
 s.plans.forEach(p=>{if(p.status==="active")p.status="archived";});
 s.tasks.forEach(t=>{if(archivedRuleIds.has(t.ruleId)&&t.status==="pending")t.status="archived";});
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
  save(s);refreshImportTool();return -1;
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
function advancePlanBatch(s,phase,batch){
 const plan=s.plans.find(p=>p.id===s.activePlanId&&p.status==="active"),date=today();if(!plan||date>plan.endDate)return 0;
 const batchRules=new Set(batch.map(t=>t.ruleId).filter(Boolean)),cutoff=dateAdd(date,-3);
 const recent=new Set(s.history.filter(e=>e.ruleId&&e.date>=cutoff&&["created","completed","skipped","task_swapped_in","task_deleted"].includes(e.action)).map(e=>e.ruleId));
 const compatible=r=>phase==="evening"?(r.preferredTime==="evening"||r.preferredTime==="any"):r.preferredTime!=="evening";
 const remaining=r=>{
  const target=Math.max(1,Number(r.target)||1),done=ruleCompleted(s,r,date);
  if(r.taskType==="daily")return Math.max(0,target-s.tasks.filter(t=>t.ruleId===r.id&&t.taskDate===date&&t.status!=="replaced"&&t.status!=="deferred"&&t.status!=="archived"&&t.status!=="deleted").length);
  const bounds=periodBounds(r,date,s),pending=s.tasks.filter(t=>t.ruleId===r.id&&t.taskDate>=bounds.start&&t.taskDate<=bounds.end&&t.status==="pending").length;
  return Math.max(0,target-done-pending);
 };
 if(s.tasks.some(t=>t.taskDate===date&&t.timeOfDay===phase&&t.status==="pending"&&!t.hiddenFromQueue&&!batch.some(done=>done.batchId===t.batchId)))return 0;
 const active=s.taskRules.filter(r=>r.planId===plan.id&&r.status==="active"&&compatible(r)&&remaining(r)>0&&!s.tasks.some(t=>t.ruleId===r.id&&t.taskDate===date&&t.status==="pending"));
 const sort=(a,b)=>((a.preferredTime===phase?0:1)-(b.preferredTime===phase?0:1))||String(a.createdAt).localeCompare(String(b.createdAt));
 const preferred=active.filter(r=>!recent.has(r.id)&&!batchRules.has(r.id)).sort(sort),rotation=active.filter(r=>recent.has(r.id)&&!batchRules.has(r.id)).sort(sort),sameRuleRotation=active.filter(r=>batchRules.has(r.id)&&r.taskType!=="daily").sort(sort),choices=preferred.concat(rotation,sameRuleRotation);
 let created=0;
 for(const rule of choices){
  if(created>=3||s.tasks.filter(t=>t.taskDate===date&&!["replaced","deferred","archived","deleted"].includes(t.status)).length>=20)break;
  const order=s.tasks.filter(t=>t.taskDate===date&&t.timeOfDay===phase).reduce((m,t)=>Math.max(m,Number(t.queueOrder)||0),-1)+1;
  const task=ruleOccurrence(s,rule,date,created,phase,order);if(!task)continue;
  s.tasks.push(task);log(s,{action:"created",date,taskId:task.id,ruleId:rule.id,title:task.title,timeOfDay:phase,taskType:rule.taskType,target:rule.target,period:rule.period,xpDelta:0,statDelta:{},reason:"Lượt Task tiếp theo được mở từ gói kế hoạch sau khi hoàn thành bộ trước."});created++;
 }
 return created;
}
function complete(id){
 const s=rollover(state()),t=s.tasks.find(x=>x.id===id);if(!t||t.status!=="pending")return;
 t.status="completed";t.completedAt=now();const effects={};
 Object.keys(t.statEffects||{}).forEach(k=>{if(KEYS.includes(k)){const amount=Math.max(0,Math.min(5,Math.round(Number(t.statEffects[k])||0)));if(amount){s.stats[k]=(Number(s.stats[k])||0)+amount;effects[k]=amount;}}});
 addXp(s,t.xp);
 log(s,{action:"completed",date:today(),taskId:t.id,ruleId:t.ruleId||null,title:t.title,category:t.category,tags:t.tags,difficulty:t.difficulty,xpDelta:t.xp,statDelta:effects,mainQuestId:t.mainQuestId,weeklyQuestId:t.weeklyQuestId,reason:t.reason,createdAt:t.createdAt,completedAt:t.completedAt,originalTaskDate:t.originalTaskDate||t.taskDate});
 const finishedBatch=t.batchId?s.tasks.filter(x=>x.batchId===t.batchId&&!x.hiddenFromQueue&&["pending","completed"].includes(x.status)):[],advanced=finishedBatch.length>0&&finishedBatch.every(x=>x.status==="completed")?advancePlanBatch(s,t.timeOfDay,finishedBatch):0;
 let bonus=0;if(completedToday(s,today())>=6&&!s.bonuses["six-tasks:"+today()]){s.bonuses["six-tasks:"+today()]=true;bonus=3;addXp(s,bonus);log(s,{action:"daily_bonus",date:today(),title:"Thưởng hoàn thành 6 Task",xpDelta:bonus,statDelta:{}});}
 s.feedback="+"+t.xp+" XP · "+taskEffectsLine(effects)+(bonus?" · Thưởng +3 XP":"")+(advanced?" · Đã mở "+advanced+" Task tiếp theo":"");save(s);render("tasks");
}
function skip(id){const s=rollover(state()),t=s.tasks.find(x=>x.id===id);if(!t||t.status!=="pending")return;t.status="skipped";log(s,{action:"skipped",date:today(),taskId:t.id,ruleId:t.ruleId||null,title:t.title,category:t.category,tags:t.tags,difficulty:t.difficulty,xpDelta:0,statDelta:{},reason:"Người dùng bỏ qua Task."});s.feedback="Đã bỏ qua Task; không thay đổi XP/Stats.";save(s);render("tasks");}
function swapTasks(mode){
 const s=rollover(state());applyEveningSwitch(s,false);
 if(s.activePlanId)ensurePlanTasks(s);
 const group=currentBatch(s);if(!group.length){alert("Không có bộ Task đang mở để đổi.");return false;}
 const phase=timeOfDay(),targets=mode==="all"?group.slice():group.filter(t=>t.status==="pending");
 if(!targets.length){alert("Không có Task chưa hoàn thành trong bộ hiện tại.");return false;}
 let replacements=[];
 const plan=s.plans.find(p=>p.id===s.activePlanId&&p.status==="active");
 if(plan){
  const excludedRules=new Set(group.map(t=>t.ruleId).filter(Boolean)),groupIds=new Set(group.map(t=>t.id)),recentCutoff=dateAdd(today(),-3),usedRecently=new Set(s.history.filter(e=>e.ruleId&&e.date>=recentCutoff&&["created","completed","skipped","task_swapped_in","task_deleted"].includes(e.action)).map(e=>e.ruleId));
  const compatible=r=>phase==="evening"?(r.preferredTime==="evening"||r.preferredTime==="any"):r.preferredTime!=="evening";
  const canUse=r=>{
   const target=Math.max(1,Number(r.target)||1),done=ruleCompleted(s,r,today());
   if(s.tasks.some(t=>t.taskDate===today()&&t.ruleId===r.id&&!groupIds.has(t.id)&&!t.hiddenFromQueue&&t.status==="pending"))return true;
   if(r.taskType==="daily")return s.tasks.filter(t=>t.ruleId===r.id&&t.taskDate===today()&&!["replaced","deferred","archived","deleted"].includes(t.status)).length<target;
   const bounds=periodBounds(r,today(),s),pending=s.tasks.filter(t=>t.ruleId===r.id&&t.taskDate>=bounds.start&&t.taskDate<=bounds.end&&t.status==="pending").length;
   return done+pending<target;
  };
  const baseRules=s.taskRules.filter(r=>r.planId===plan.id&&r.status==="active"&&compatible(r)&&!excludedRules.has(r.id)&&canUse(r));
  const sort=(a,b)=>((a.preferredTime===phase?0:1)-(b.preferredTime===phase?0:1))||String(a.createdAt).localeCompare(String(b.createdAt));
  const recycled=s.tasks.filter(t=>t.status==="replaced"&&t.ruleId&&t.taskDate<=today()&&!groupIds.has(t.id)).filter(t=>{
   const r=s.taskRules.find(x=>x.id===t.ruleId&&x.planId===plan.id&&x.status==="active");return !!r&&compatible(r)&&!excludedRules.has(r.id)&&canUse(r);
  }).sort((a,b)=>String(a.replacedAt||a.createdAt).localeCompare(String(b.replacedAt||b.createdAt)));
  const recycledRuleIds=new Set(recycled.map(t=>t.ruleId));
  const fresh=baseRules.filter(r=>!usedRecently.has(r.id)&&!recycledRuleIds.has(r.id)).sort(sort),relaxed=baseRules.filter(r=>usedRecently.has(r.id)&&!recycledRuleIds.has(r.id)).sort(sort);
  const planned=[],chosenRules=new Set(),chosenTasks=new Set();
  function planRule(rule){if(chosenRules.has(rule.id)||planned.length>=targets.length)return;const existing=s.tasks.find(t=>t.taskDate===today()&&t.ruleId===rule.id&&!groupIds.has(t.id)&&!t.hiddenFromQueue&&t.status==="pending"&&!chosenTasks.has(t.id));planned.push({rule,task:existing||null});chosenRules.add(rule.id);if(existing)chosenTasks.add(existing.id);}
  fresh.forEach(planRule);
  recycled.forEach(t=>{if(planned.length>=targets.length||chosenRules.has(t.ruleId)||chosenTasks.has(t.id))return;const rule=s.taskRules.find(r=>r.id===t.ruleId);planned.push({rule,task:t,recycle:true});chosenRules.add(rule.id);chosenTasks.add(t.id);});
  relaxed.forEach(planRule);
  planned.slice(0,targets.length).forEach((item,index)=>{
   let next=item.task;
   if(item.recycle){next.originalTaskDate=next.originalTaskDate||next.taskDate;next.taskDate=today();next.timeOfDay=phase;next.rotatedAt=now();}
   if(!next){
    const order=s.tasks.filter(t=>t.taskDate===today()&&t.timeOfDay===phase).reduce((m,t)=>Math.max(m,Number(t.queueOrder)||0),-1)+1;
    next=ruleOccurrence(s,item.rule,today(),index,phase,order);if(next){s.tasks.push(next);log(s,{action:"created",date:today(),taskId:next.id,ruleId:item.rule.id,title:next.title,timeOfDay:phase,xpDelta:0,statDelta:{},reason:"Task được lấy từ gói kế hoạch khi đổi bộ."});}
   }
   if(next)replacements.push(next);
  });
 }else{  const ids=new Set(group.map(t=>t.id));
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
 if(count>=50){alert("Đã đạt giới hạn 50 Task hôm nay.");return false;}
 const title=String(form.title||"").trim();if(!title){alert("Nhập nội dung Task.");return false;}
 const phase=form.timeOfDay==="evening"?"evening":"day",same=s.tasks.filter(t=>t.taskDate===date&&t.timeOfDay===phase);
 const order=same.reduce((max,t)=>Math.max(max,Number(t.queueOrder)||0),-1)+1;
 const raw={title,tags:String(form.tags||"").split(/[,;|]/).map(x=>x.trim()).filter(Boolean),difficulty:form.difficulty||"Normal",energyRole:form.energyRole||"focus"};
 const task=makeTask(s,raw,order,date,phase,order);if(!task)return false;
 s.tasks.push(task);log(s,{action:"created",date,taskId:task.id,title:task.title,tags:task.tags,difficulty:task.difficulty,timeOfDay:phase,xpDelta:0,statDelta:{},reason:"Task do người dùng thêm thủ công."});
 s.feedback="Đã thêm Task vào hàng chờ "+(phase==="evening"?"buổi tối.":"ban ngày.");
 save(s);if(phase==="evening"&&timeOfDay()==="evening")applyEveningSwitch(s,true);refreshImportTool();return true;
}
function removeTask(id){
 const s=rollover(state()),index=s.tasks.findIndex(t=>t.id===id&&t.taskDate===today());if(index<0)return false;
 const task=s.tasks[index];log(s,{action:"task_deleted",date:today(),taskId:task.id,ruleId:task.ruleId||null,title:task.title,timeOfDay:task.timeOfDay,xpDelta:0,statDelta:{},reason:"Task bị xóa khỏi hàng chờ; history thưởng trước đó vẫn được giữ."});
 if(task.ruleId){task.status="deleted";task.deletedAt=now();}else s.tasks.splice(index,1);
 s.feedback="Đã xóa Task khỏi danh sách hôm nay.";save(s);refreshImportTool();return true;
}
function radar(values,max,title){const cx=120,cy=105,r=72,n=KEYS.length,p=(i,k)=>{const a=-Math.PI/2+i*2*Math.PI/n;return(cx+Math.cos(a)*r*k).toFixed(1)+","+(cy+Math.sin(a)*r*k).toFixed(1);};let x='<svg viewBox="0 0 240 210" role="img" aria-label="'+esc(title)+'">';[.25,.5,.75,1].forEach(k=>x+='<polygon points="'+KEYS.map((_,i)=>p(i,k)).join(" ")+'" fill="none" stroke="#dfe2ed"/>');KEYS.forEach((k,i)=>x+='<line x1="'+cx+'" y1="'+cy+'" x2="'+p(i,1)+'" stroke="#dfe2ed"/>');x+='<polygon points="'+KEYS.map((k,i)=>p(i,Math.min(1,Math.max(0,Number(values[k])||0)/Math.max(1,max)))).join(" ")+'" fill="rgba(124,102,238,.24)" stroke="#7866ee" stroke-width="2"/>';KEYS.forEach((k,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;x+='<text x="'+(cx+Math.cos(a)*99).toFixed(1)+'" y="'+(cy+Math.sin(a)*99+4).toFixed(1)+'" text-anchor="middle" font-size="10" fill="#41445a">'+k+'</text>';});return x+"</svg>";}
function growth(s,days){const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days+1);const key=cutoff.getFullYear()+"-"+String(cutoff.getMonth()+1).padStart(2,"0")+"-"+String(cutoff.getDate()).padStart(2,"0"),out={};KEYS.forEach(k=>out[k]=0);s.history.forEach(e=>{if(["completed","energy_event"].includes(e.action)&&e.date>=key&&e.date<=today())KEYS.forEach(k=>out[k]+=Number((e.statDelta||{})[k])||0);});return out;}
const CSS='.rpg-wrap{display:grid;gap:14px;color:#1b1e2e}.rpg-panel{padding:16px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:rgba(255,255,255,.9);box-shadow:0 12px 32px rgba(0,0,0,.07)}.rpg-panel h2,.rpg-panel h3{margin:0 0 9px}.rpg-muted{color:#777d9a;font-size:13px}.rpg-progress{height:9px;background:#e9e8f4;border-radius:99px;overflow:hidden;margin-top:7px}.rpg-progress span{display:block;height:100%;background:linear-gradient(90deg,#7866ee,#b09bff)}.rpg-manage-form{display:grid;grid-template-columns:2fr 2fr 1fr 1fr auto;gap:7px;align-items:center}.rpg-manage-list{display:grid;gap:6px;margin-top:12px}.rpg-manage-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px;border-bottom:1px solid #eee}.rpg-manage-row small{color:#777d9a}.rpg-swap-actions{justify-content:center}.rpg-task-list{display:grid;gap:9px}.rpg-taskrow{display:flex;align-items:flex-start;gap:12px;padding:16px;border:1px solid #e9e7f4;border-radius:13px;background:rgba(255,255,255,.94);font-size:16px;line-height:1.45;cursor:pointer}.rpg-taskrow input{width:24px;height:24px;min-width:24px;margin:0;accent-color:#7866ee;cursor:pointer}.rpg-taskrow input:checked+span{color:#798096;text-decoration:line-through}.rpg-head{display:flex;justify-content:space-between;gap:10px}.rpg-chip{background:#f1efff;border-radius:99px;padding:3px 8px;font-size:11px}.rpg-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.rpg-feedback{padding:10px 12px;background:#effaf2;border:1px solid #c9efd4;border-radius:12px;color:#226b3b}.rpg-empty{text-align:center;padding:20px;color:#777d9a}.rpg-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.energy-action{display:flex;align-items:center;justify-content:flex-start;gap:12px;width:100%;min-height:64px;text-align:left}.energy-action{position:relative;overflow:visible;transition:transform .12s,filter .12s}.energy-action.energy-pressed{animation:energy-press .32s ease-out}.energy-action:disabled{opacity:.58;cursor:not-allowed;filter:saturate(.55)}.energy-cooldown-label{flex-basis:100%;margin-left:36px;font-size:12px;font-weight:700;color:#7867d8}.energy-king{position:absolute;top:-9px;right:-7px;z-index:8;width:25px;height:25px;display:grid;place-items:center;border-radius:50%;background:#fff4c2;border:1px solid #e4bd47;box-shadow:0 2px 7px rgba(45,35,0,.22);font-size:15px;line-height:1}.energy-float{position:absolute;z-index:5;left:50%;top:3px;white-space:nowrap;pointer-events:none;font-weight:800;font-size:16px;text-shadow:0 1px 4px rgba(255,255,255,.95);animation:energy-rise 1.15s cubic-bezier(.18,.65,.35,1) forwards}.energy-float.positive{color:#168a45}.energy-float.negative{color:#e53935}@keyframes energy-press{0%{transform:scale(1)}35%{transform:scale(.94);filter:brightness(.92)}100%{transform:scale(1);filter:brightness(1)}}@keyframes energy-rise{0%{opacity:0;transform:translate(calc(-50% + var(--energy-x,0px)),12px) scale(.82)}15%{opacity:1;transform:translate(calc(-50% + var(--energy-x,0px)),0) scale(1.08)}75%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--energy-x,0px)),-64px) scale(.96)}}.energy-icon{font-size:25px;line-height:1}.lucky-launch{width:100%;margin:0 0 10px;font-size:18px;font-weight:800}.settings-tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.settings-tools button{min-height:82px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-size:24px}.settings-tools button span{font-size:14px;font-weight:600}.settings-tool-card{width:min(100%,760px)}.settings-tool-card #settings-tool-body{max-height:calc(88vh - 76px);overflow:auto}.settings-tool-card #settings-tool-body>.rpg-wrap{max-width:none;margin:0;padding:0}.rpg-manage-row[data-energy-edit]{width:100%;background:#fff;border:1px solid #e5e7ef;text-align:left;cursor:pointer}.energy-quick{padding:12px}.energy-quick .rpg-head{align-items:center;margin-bottom:8px}.energy-quick .rpg-head h2{font-size:16px}.energy-quick-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px}.energy-modal[hidden],.rpg-reset-confirm[hidden]{display:none}.energy-modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px}.energy-modal-backdrop{position:absolute;inset:0;background:rgba(18,22,45,.55)}.energy-modal-card{position:relative;width:min(100%,560px);max-height:88vh;overflow:auto;padding:18px;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.28);display:grid;gap:12px}.energy-modal-card>.rpg-head{align-items:center}.energy-modal-card label{display:grid;gap:5px}.rpg-reset-confirm{padding:12px;border-radius:12px;background:#fff5e8;border:1px solid #f0d5aa}.rpg-stat{display:flex;justify-content:space-between;padding:8px 3px;border-bottom:1px solid #eee}.rpg-chart{display:grid;grid-template-columns:minmax(200px,1fr) minmax(180px,.8fr);align-items:center;gap:10px}.rpg-chart svg{width:100%;max-width:280px;display:block;margin:auto}.rpg-history{max-height:280px;overflow:auto}.rpg-history div{padding:8px;border-bottom:1px solid #eee;font-size:12px}.rpg-form{display:grid;gap:9px}.rpg-form textarea{height:330px;min-height:220px;resize:vertical;font:14px/1.5 ui-monospace,monospace}.rpg-code{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f2ff;border-radius:12px;padding:12px;font:12px/1.5 ui-monospace,monospace;max-height:460px;overflow:auto}.rpg-quest{padding:10px;border:1px solid #eee;border-radius:10px;margin-top:8px}@media(max-width:650px){.rpg-grid,.rpg-chart{grid-template-columns:1fr}.rpg-manage-form{grid-template-columns:1fr 1fr}.rpg-manage-form input:first-child,.rpg-manage-form button{grid-column:1/-1}}';
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
 view.innerHTML=style()+'<div class="rpg-wrap">'+energyQuickMarkup(s,"tasks")+'<section class="rpg-panel"><div class="rpg-task-list">'+(batch.length?batch.map(t=>taskCard(t)).join(""):'<div class="rpg-empty">Đã xong Task đến hạn hôm nay. Task tiếp theo sẽ mở theo gói kế hoạch và chu kỳ phù hợp.</div>')+'</div>'+(batch.length?'<div class="rpg-actions rpg-swap-actions"><button class="btn-ghost" id="swap-all">Đổi bộ 3 mới</button><button class="btn-ghost" id="swap-pending">Đổi Task chưa xong</button></div>':'')+'</section></div>';
 bindTaskButtons();bindEnergyQuick("tasks");
 const all=document.getElementById("swap-all"),pending=document.getElementById("swap-pending");
 if(all)all.onclick=()=>swapTasks("all");if(pending)pending.onclick=()=>swapTasks("pending");
}
function energyCooldownUntil(s,id){
 let latest=Number(s.energyCooldowns&&s.energyCooldowns[id])||0;
 (s.energyEvents||[]).forEach(e=>{if(e.buttonId===id){const time=Date.parse(e.at);if(Number.isFinite(time))latest=Math.max(latest,time);}});
 return latest?latest+300000:0;
}
function energyCooldownRemaining(s,id){return Math.max(0,energyCooldownUntil(s,id)-Date.now());}
function formatEnergyCooldown(ms){const seconds=Math.ceil(ms/1000),minutes=Math.floor(seconds/60),rest=String(seconds%60).padStart(2,"0");return minutes+":"+rest;}
function updateEnergyCooldownUI(){
 const s=state();document.querySelectorAll("[data-energy-quick]").forEach(button=>{const left=energyCooldownRemaining(s,button.dataset.energyQuick),label=document.querySelector('[data-energy-cooldown="'+button.dataset.energyQuick.replace(/"/g,"\\\"")+'"]');button.disabled=left>0;if(label){label.hidden=left<=0;label.textContent=left>0?"Hồi chiêu "+formatEnergyCooldown(left):"";}});
}
function energyQuickMarkup(s,returnTab){
 if(!s.energyButtons.length)return"";
 const counts={};(s.energyEvents||[]).forEach(e=>{counts[e.buttonId]=(counts[e.buttonId]||0)+1;});
 const ranked=s.energyButtons.map((button,index)=>({button,index,count:counts[button.id]||0})).sort((a,b)=>b.count-a.count||a.index-b.index);
 return'<section class="rpg-panel energy-quick"><div class="rpg-head"><h2>Năng lượng</h2><button type="button" class="btn-ghost" data-open-energy>⚡</button></div><div class="energy-quick-grid">'+ranked.map((item,index)=>{const b=item.button,left=energyCooldownRemaining(s,b.id),king=index===0&&item.count>0?'<span class="energy-king" aria-label="Nút dùng nhiều nhất">👑</span>':"";return'<button type="button" class="btn-ghost energy-action" data-energy-quick="'+esc(b.id)+'"'+(left>0?' disabled':'')+'>'+king+'<span class="energy-icon">'+esc(energyIcon(b))+'</span><span>'+esc(b.title)+'</span><small class="energy-cooldown-label" data-energy-cooldown="'+esc(b.id)+'"'+(left>0?'':' hidden')+'>'+(left>0?'Hồi chiêu '+formatEnergyCooldown(left):'')+'</small></button>';}).join("")+'</div></section>';
}
function bindEnergyQuick(returnTab){
 document.querySelectorAll("[data-energy-quick]").forEach(b=>b.onclick=()=>recordEnergy(b.dataset.energyQuick,returnTab));
 updateEnergyCooldownUI();
 document.querySelectorAll("[data-open-energy]").forEach(b=>b.onclick=()=>{render("settings");openSettingsTool("energy");});
}
function recordEnergy(buttonId,returnTab){
 const s=state(),button=s.energyButtons.find(b=>b.id===buttonId);if(!button)return;
 if(energyCooldownRemaining(s,buttonId)>0){updateEnergyCooldownUI();return;}
 s.energyCooldowns=s.energyCooldowns||{};s.energyCooldowns[buttonId]=Date.now();
 const applied={};KEYS.forEach(k=>{const delta=Math.max(-1,Math.min(1,Math.round(Number((button.effects||{})[k])||0)));if(delta){const before=Math.max(0,Number(s.stats[k])||0),after=Math.max(0,before+delta),actual=after-before;if(actual){s.stats[k]=after;applied[k]=actual;}}});
 const event={id:"energy-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),date:today(),at:now(),buttonId:button.id,title:button.title,statDelta:applied};
 s.energyEvents.push(event);if(s.energyEvents.length>5000)s.energyEvents=s.energyEvents.slice(-5000);
 log(s,{action:"energy_event",date:event.date,at:event.at,title:button.title,energyButtonId:button.id,xpDelta:0,statDelta:applied,reason:"Ghi nhận từ tab Năng lượng."});
 s.feedback=button.title+" · "+(taskEffectsLine(applied)||"Không đổi chỉ số");save(s);render(returnTab||"energy");
 const action=[...document.querySelectorAll("[data-energy-quick]")].find(el=>el.dataset.energyQuick===buttonId);if(!action)return;
 action.classList.remove("energy-pressed");void action.offsetWidth;action.classList.add("energy-pressed");setTimeout(()=>action.classList.remove("energy-pressed"),360);
 const changes=Object.entries(applied);changes.forEach(([stat,delta],i)=>{const float=document.createElement("span");float.className="energy-float "+(delta>0?"positive":"negative");float.textContent=(delta>0?"+":"")+delta+" "+stat;float.style.setProperty("--energy-x",(i-(changes.length-1)/2)*44+"px");float.style.animationDelay=i*130+"ms";action.appendChild(float);setTimeout(()=>float.remove(),1500+i*130);});
}
function addEnergyButton(form){const s=state(),title=String(form.title||"").trim();if(!title){alert("Nhập tên nút.");return false;}const icon=String(form.icon||"✨").trim()||"✨",effects={};KEYS.forEach(k=>{const n=Math.max(-1,Math.min(1,Math.round(Number(form[k])||0)));if(n)effects[k]=n;});if(!Object.keys(effects).length){alert("Chọn ít nhất một chỉ số +1 hoặc -1.");return false;}s.energyButtons.push({id:"custom-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),title:title.slice(0,60),icon,effects,custom:true});save(s);refreshEnergyTool();return true;}
function energyIcon(button){return button.icon||({"Tụt năng lượng":"🪫","Đầy bụng":"🍽️","Fap":"🫣","Uống nước":"💧","Ăn hoa quả":"🍎"}[button.title]||"✨");}
function updateEnergyButton(form){const s=state(),button=s.energyButtons.find(b=>b.id===form.id);if(!button)return;const title=String(form.title||"").trim();if(!title){alert("Nhập tên nút.");return;}const effects={};KEYS.forEach(k=>{const n=Math.max(-1,Math.min(1,Math.round(Number(form[k])||0)));if(n)effects[k]=n;});button.title=title.slice(0,60);button.icon=String(form.icon||"✨").trim()||"✨";button.effects=effects;save(s);refreshEnergyTool();}
function deleteEnergyButton(id){
 const s=state(),i=s.energyButtons.findIndex(b=>b.id===id);if(i<0)return;
 if(s.energyButtons.length<=1){s.feedback="Hãy tạo thêm một nút trước khi xóa nút cuối cùng.";save(s);refreshEnergyTool();openEnergySettings(id);return;}
 s.energyButtons.splice(i,1);s.feedback="Đã xóa nút. Lịch sử ghi nhận trước đây vẫn được giữ.";save(s);refreshEnergyTool();openEnergySettings(s.energyButtons[Math.min(i,s.energyButtons.length-1)].id);
}
function updateEnergyButton(form){const s=state(),button=s.energyButtons.find(b=>b.id===form.id);if(!button)return;const title=String(form.title||"").trim();if(!title){alert("Nhập tên nút.");return;}const effects={};KEYS.forEach(k=>{const n=Math.max(-1,Math.min(1,Math.round(Number(form[k])||0)));if(n)effects[k]=n;});button.title=title.slice(0,60);button.icon=String(form.icon||"✨").trim()||"✨";button.effects=effects;save(s);refreshEnergyTool();openEnergySettings(button.id);}
function requestDeleteEnergyButton(id){
 const b=state().energyButtons.find(x=>x.id===id),panel=document.getElementById("energy-delete-confirm"),message=document.getElementById("energy-delete-message");if(!b||!panel)return;
 panel.dataset.buttonId=id;message.textContent='Xóa nút "'+b.title+'"? Lịch sử cũ vẫn được giữ.';panel.hidden=false;
}
function energyEditorMarkup(s,id){
 const b=s.energyButtons.find(x=>x.id===id);if(!b)return'<p class="rpg-muted">Không tìm thấy nút.</p>';
 const icons=ENERGY_ICONS;
 return'<form id="energy-edit-form" class="rpg-form" data-edit-energy="'+esc(b.id)+'"><label>Icon<select name="icon">'+icons.map(x=>'<option value="'+x+'" '+(energyIcon(b)===x?"selected":"")+'>'+x+'</option>').join("")+'</select></label><label>Mô tả<input name="title" maxlength="60" required value="'+esc(b.title)+'"></label><div class="rpg-grid">'+KEYS.map(k=>'<label>'+k+'<select name="'+k+'"><option value="0" '+(!(Number((b.effects||{})[k]))?"selected":"")+'>0</option><option value="1" '+(Number((b.effects||{})[k])===1?"selected":"")+'>+1</option><option value="-1" '+(Number((b.effects||{})[k])===-1?"selected":"")+'>&minus;1</option></select></label>').join("")+'</div><div class="rpg-actions"><button class="btn-primary">Lưu thay đổi</button>'+(true?'<button type="button" class="btn-ghost" data-delete-energy="'+esc(b.id)+'">Xóa nút</button>':"")+'</div></form>';
}
function bindEnergyEditor(){
 const f=document.getElementById("energy-edit-form");if(f)f.onsubmit=e=>{e.preventDefault();const form=e.currentTarget,data={id:form.dataset.editEnergy,title:form.elements.title.value,icon:form.elements.icon.value};KEYS.forEach(k=>data[k]=form.elements[k].value);updateEnergyButton(data);};
 document.querySelectorAll("[data-delete-energy]").forEach(b=>b.onclick=()=>requestDeleteEnergyButton(b.dataset.deleteEnergy));
}
function openEnergySettings(id){
 const modal=document.getElementById("energy-settings-modal"),select=document.getElementById("energy-edit-select"),editor=document.getElementById("energy-editor-wrap");if(!modal||!select||!editor)return;
 modal.hidden=false;select.value=id||select.value||select.options[0]?.value||"";editor.innerHTML=energyEditorMarkup(state(),select.value);bindEnergyEditor();document.getElementById("energy-settings-close").onclick=()=>{modal.hidden=true;};
}
function clearEnergyHistory(){
 const s=state();s.energyEvents=[];s.history=s.history.filter(e=>e.action!=="energy_event");s.feedback="Đã xóa lịch sử tần suất Năng lượng; chỉ số hiện tại được giữ nguyên.";save(s);refreshEnergyTool();
}
function renderEnergy(s,target=view){
 const mode=new URLSearchParams(location.search).get("energyView")||"day",nowDate=new Date(),weekStart=new Date(nowDate);weekStart.setHours(0,0,0,0);weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
 const events=s.energyEvents.filter(e=>{const d=new Date(e.at);if(Number.isNaN(d.getTime()))return false;if(mode==="hour")return e.date===today()&&d.getHours()===nowDate.getHours();if(mode==="week")return d>=weekStart&&d<=nowDate;return e.date===today();}).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
 const counts={};events.forEach(e=>counts[e.title]=(counts[e.title]||0)+1);const labels={day:"Hôm nay",hour:"Giờ này",week:"Tuần này"};
 const icons=ENERGY_ICONS;
 const iconOptions=icons.map(x=>'<option value="'+x+'">'+x+'</option>').join("");
 const selected=s.energyButtons[0]&&s.energyButtons[0].id||"";
 target.innerHTML=style()+'<div class="rpg-wrap"><section class="rpg-panel"><div class="rpg-head"><h2>Nút năng lượng</h2><span class="rpg-muted">Chọn nút để chỉnh</span></div><div class="rpg-manage-list">'+(s.energyButtons.length?s.energyButtons.map(b=>'<button type="button" class="rpg-manage-row" data-energy-edit="'+esc(b.id)+'"><span>'+esc(energyIcon(b))+' '+esc(b.title)+'</span><span>⚙️</span></button>').join(""):'<div class="rpg-empty">Chưa có nút.</div>')+'</div></section><section class="rpg-panel"><h2>Tần suất · '+labels[mode]+'</h2><label>Xem theo <select id="energy-view"><option value="day" '+(mode==="day"?"selected":"")+'>Ngày</option><option value="hour" '+(mode==="hour"?"selected":"")+'>Giờ</option><option value="week" '+(mode==="week"?"selected":"")+'>Tuần</option></select></label><p><b>'+events.length+'</b> lần ghi nhận trong khoảng đã chọn.</p><div class="rpg-manage-list">'+(Object.keys(counts).length?Object.keys(counts).map(k=>'<div class="rpg-manage-row"><span>'+esc(k)+'</span><strong>'+counts[k]+' lần</strong></div>').join(""):'<div class="rpg-empty">Chưa có ghi nhận.</div>')+'</div><div class="rpg-actions"><button type="button" class="btn-ghost" id="reset-energy-history">Đặt lại lịch sử tần suất</button></div><div id="energy-reset-confirm" class="rpg-reset-confirm" hidden><p>Bạn muốn xóa toàn bộ lịch sử tần suất của các nút? Stats hiện tại sẽ được giữ nguyên.</p><button type="button" class="btn-ghost" id="cancel-reset-energy">Hủy</button> <button type="button" class="btn-primary" id="confirm-reset-energy">Xác nhận xóa</button></div><h3>Lịch sử</h3><div class="rpg-history">'+(events.length?events.slice(0,150).map(e=>'<div><b>'+esc(e.date)+'</b> · '+esc(new Date(e.at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}))+' · '+esc(e.title)+' · '+esc(taskEffectsLine(e.statDelta))+'</div>').join(""):'<div class="rpg-muted">Chưa có ghi nhận.</div>')+'</div></section><section class="rpg-panel"><h2>Tạo nút mới</h2><form id="energy-button-form" class="rpg-form"><label>Icon<select name="icon">'+iconOptions+'</select></label><label>Mô tả nút<input name="title" maxlength="60" required placeholder="Ví dụ: Đi bộ"></label><div class="rpg-grid">'+KEYS.map(k=>'<label>'+k+'<select name="'+k+'"><option value="0">0</option><option value="1">+1</option><option value="-1">&minus;1</option></select></label>').join("")+'</div><button class="btn-primary">Thêm nút</button></form></section><div id="energy-settings-modal" class="energy-modal" hidden><div class="energy-modal-backdrop" data-close-energy-modal></div><section class="energy-modal-card" role="dialog" aria-modal="true" aria-labelledby="energy-modal-title"><div class="rpg-head"><h2 id="energy-modal-title">Cài đặt nút</h2><button type="button" id="energy-settings-close" class="btn-ghost" aria-label="Đóng">×</button></div><label>Chọn nút cần sửa<select id="energy-edit-select">'+s.energyButtons.map(b=>'<option value="'+esc(b.id)+'">'+esc(energyIcon(b))+' '+esc(b.title)+'</option>').join("")+'</select></label><div id="energy-editor-wrap">'+energyEditorMarkup(s,selected)+'</div><div id="energy-delete-confirm" class="rpg-reset-confirm" hidden><p id="energy-delete-message"></p><button type="button" class="btn-ghost" id="cancel-delete-energy">Hủy</button> <button type="button" class="btn-primary" id="confirm-delete-energy">Xác nhận xóa</button></div></section></div>'+(s.feedback?'<p class="rpg-feedback">'+esc(s.feedback)+'</p>':"")+'</div>';
 document.getElementById("energy-view").onchange=e=>{const url=new URL(location.href);url.searchParams.set("energyView",e.target.value);history.replaceState(null,"",url);refreshEnergyTool();};
 document.querySelectorAll("[data-energy-edit]").forEach(b=>b.onclick=()=>openEnergySettings(b.dataset.energyEdit));
 document.getElementById("energy-edit-select").onchange=e=>{document.getElementById("energy-editor-wrap").innerHTML=energyEditorMarkup(state(),e.target.value);bindEnergyEditor();};
 document.getElementById("energy-settings-close").onclick=()=>{document.getElementById("energy-settings-modal").hidden=true;};
 document.getElementById("cancel-delete-energy").onclick=()=>{document.getElementById("energy-delete-confirm").hidden=true;};
 document.getElementById("confirm-delete-energy").onclick=()=>{const id=document.getElementById("energy-delete-confirm").dataset.buttonId;deleteEnergyButton(id);};

 document.getElementById("reset-energy-history").onclick=()=>{document.getElementById("energy-reset-confirm").hidden=false;};
 document.getElementById("cancel-reset-energy").onclick=()=>{document.getElementById("energy-reset-confirm").hidden=true;};
 document.getElementById("confirm-reset-energy").onclick=clearEnergyHistory;
 const form=document.getElementById("energy-button-form");form.onsubmit=e=>{e.preventDefault();const f=e.currentTarget,data={title:f.elements.title.value,icon:f.elements.icon.value};KEYS.forEach(k=>data[k]=f.elements[k].value);if(addEnergyButton(data))f.reset();};
}
function renderSettings(s){
 view.innerHTML=style()+'<div class="rpg-wrap"><section class="rpg-panel"><h2>Cài đặt</h2><p class="rpg-muted">Chọn một mục để mở cửa sổ thao tác.</p><div class="settings-tools"><button type="button" class="btn-ghost" data-settings-tool="energy">⚡<span>Nút năng lượng</span></button><button type="button" class="btn-ghost" data-settings-tool="lucky">🍀<span>Lucky & lịch sử</span></button><button type="button" class="btn-ghost" data-settings-tool="import">📥<span>Nạp Quest & Task</span></button><button type="button" class="btn-ghost" data-settings-tool="manage">🗂️<span>Quản lý Task</span></button><button type="button" class="btn-ghost" data-settings-tool="ai">🤖<span>Prompt AI & tag</span></button><button type="button" class="btn-ghost" data-settings-tool="profile">👤<span>Hồ sơ & sao lưu</span></button></div></section><div id="settings-tool-modal" class="energy-modal" hidden><div class="energy-modal-backdrop" data-settings-close></div><section class="energy-modal-card settings-tool-card" role="dialog" aria-modal="true"><div class="rpg-head"><h2 id="settings-tool-title">Cài đặt</h2><button type="button" class="btn-ghost" data-settings-close aria-label="Đóng">×</button></div><div id="settings-tool-body"></div></section></div></div>';
 view.querySelectorAll("[data-settings-tool]").forEach(b=>b.onclick=()=>openSettingsTool(b.dataset.settingsTool));
 view.querySelectorAll("[data-settings-close]").forEach(b=>b.onclick=()=>{document.getElementById("settings-tool-modal").hidden=true;});
}
function recordLucky(){
 const s=state(),delta={};s.luckyButton=s.luckyButton||{icon:"🍀",effects:{}};
 KEYS.forEach(k=>{const points=Math.max(0,Math.min(5,Math.round(Number(s.luckyButton.effects[k])||0)));if(points){s.stats[k]=Math.max(0,Number(s.stats[k])||0)+points;delta[k]=points;}});
 const event={id:"lucky-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),date:today(),at:now(),statDelta:delta};
 s.luckyEvents=s.luckyEvents||[];s.luckyEvents.push(event);if(s.luckyEvents.length>5000)s.luckyEvents=s.luckyEvents.slice(-5000);
 log(s,{action:"lucky_event",date:event.date,at:event.at,title:"Lucky",xpDelta:0,statDelta:delta,reason:"Ghi nhận thời điểm gặp may."});
 s.feedback="Đã ghi nhận Lucky"+(taskEffectsLine(delta)?" · "+taskEffectsLine(delta):"");save(s);if(activeTab==="stats")render("stats");const button=document.querySelector("[data-lucky-button]");if(button){button.textContent="🍀 Lucky ✓";setTimeout(()=>{if(button.isConnected)button.textContent="🍀 Lucky";},1300);}
}
function luckyHistoryText(events){
 const rows=(events||[]).slice().reverse().map(e=>{const time=new Date(e.at);return(e.date||"")+" "+(Number.isNaN(time.getTime())?"":time.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}))+" | "+(taskEffectsLine(e.statDelta)||"Không cộng chỉ số");});
 return ["Mori Quest — Lucky history","Tổng lượt: "+(events||[]).length,...rows].join("\n");
}
function renderLuckySettings(s,target){
 const events=s.luckyEvents||[],textValue=luckyHistoryText(events),options=Array.from({length:6},(_,n)=>'<option value="'+n+'">'+(n===0?"0":"+"+n)+'</option>').join("");
 target.innerHTML=style()+'<div class="rpg-wrap"><section class="rpg-panel"><h3>Thưởng khi bấm Lucky</h3><p class="rpg-muted">Mỗi chỉ số có thể cộng từ 0 đến +5. Thay đổi chỉ áp dụng cho lần bấm tiếp theo.</p><form id="lucky-config-form" class="rpg-grid">'+KEYS.map(k=>'<label><b>'+k+'</b><select name="'+k+'">'+options+'</select></label>').join("")+'<button class="btn-primary" style="grid-column:1/-1">Lưu mức thưởng</button></form></section><section class="rpg-panel"><div class="rpg-head"><h3>Lịch sử Lucky</h3><button type="button" class="btn-ghost" id="copy-lucky-history">Sao chép để gửi AI</button></div><p class="rpg-muted">Đã ghi nhận '+events.length+' lần.</p><textarea id="lucky-history-export" readonly rows="5" style="width:100%;resize:vertical">'+esc(textValue)+'</textarea><div class="rpg-history">'+(events.length?events.slice().reverse().slice(0,200).map(e=>'<div><b>'+esc(e.date||"")+'</b> · '+esc(new Date(e.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}))+' · Lucky · '+esc(taskEffectsLine(e.statDelta)||"Không cộng chỉ số")+'</div>').join(""):'<div class="rpg-muted">Chưa có lượt Lucky.</div>')+'</div></section></div>';
 const form=document.getElementById("lucky-config-form");KEYS.forEach(k=>form.elements[k].value=String(s.luckyButton&&s.luckyButton.effects&&s.luckyButton.effects[k]||0));
 form.onsubmit=e=>{e.preventDefault();const n=state(),f=e.currentTarget;n.luckyButton=n.luckyButton||{icon:"🍀",effects:{}};n.luckyButton.icon="🍀";n.luckyButton.effects={};KEYS.forEach(k=>n.luckyButton.effects[k]=Math.max(0,Math.min(5,Number(f.elements[k].value)||0)));save(n);renderLuckySettings(state(),target);};
 document.getElementById("copy-lucky-history").onclick=async()=>{const area=document.getElementById("lucky-history-export");try{await navigator.clipboard.writeText(area.value);document.getElementById("copy-lucky-history").textContent="Đã sao chép";}catch(_){area.focus();area.select();try{document.execCommand("copy");document.getElementById("copy-lucky-history").textContent="Đã sao chép";}catch(__){document.getElementById("copy-lucky-history").textContent="Chọn văn bản để sao chép";}}};
}
function openSettingsTool(tool){
 const modal=document.getElementById("settings-tool-modal"),body=document.getElementById("settings-tool-body");if(!modal||!body)return;
 const labels={energy:"Nút năng lượng",lucky:"Lucky & lịch sử",import:"Nạp Quest & Task",manage:"Quản lý Task",ai:"Prompt AI & tag",profile:"Hồ sơ & sao lưu"};
 document.getElementById("settings-tool-title").textContent=labels[tool]||"Cài đặt";modal.hidden=false;
 if(tool==="energy")renderEnergy(state(),body);else if(tool==="lucky")renderLuckySettings(state(),body);else renderImport(state(),body,({import:0,manage:1,ai:2,profile:4})[tool]||0);
}
function refreshEnergyTool(){
 const body=document.getElementById("settings-tool-body"),modal=document.getElementById("settings-tool-modal");if(activeTab==="settings"&&body&&modal&&!modal.hidden)renderEnergy(state(),body);else render("settings");
}
function refreshImportTool(){
 const body=document.getElementById("settings-tool-body"),modal=document.getElementById("settings-tool-modal"),title=document.getElementById("settings-tool-title");if(activeTab==="settings"&&body&&modal&&!modal.hidden){const focus=title.textContent==="Quản lý Task"?1:title.textContent==="Prompt AI & tag"?2:title.textContent==="Hồ sơ & sao lưu"?4:0;renderImport(state(),body,focus);}else render("settings");
}
function renderStats(s){
 const need=needed(s.level),pct=Math.min(100,Math.round(s.xp/need*100)),days=Number(s.preferences.growthDays)||7,g=growth(s,days),max=Math.max(1,...KEYS.map(k=>s.stats[k])),gmax=Math.max(1,...KEYS.map(k=>g[k]));
 view.innerHTML=style()+'<div class="rpg-wrap"><section class="rpg-panel"><div class="rpg-head"><h2>Level '+s.level+'</h2><strong>'+s.xp+' / '+need+' XP</strong></div><div class="rpg-progress"><span style="width:'+pct+'%"></span></div><div class="rpg-muted">Còn '+(need-s.xp)+' XP tới Level '+(s.level+1)+'</div></section><section class="rpg-panel"><h2>6 chỉ số hiện tại</h2><div class="rpg-chart"><div>'+radar(s.stats,max,"Current Stats")+'</div><div>'+KEYS.map(k=>'<div class="rpg-stat"><span><b>'+k+'</b> · '+NAMES[k]+'</span><strong>'+Math.round(s.stats[k]||0)+'</strong></div>').join("")+'</div></div><p class="rpg-muted">VIT là chỉ số game hóa, không phải chẩn đoán hoặc đo tuổi sinh học y khoa.</p></section><section class="rpg-panel"><div class="rpg-head"><h2>Tiến độ tăng trong '+days+' ngày</h2><div><button class="btn-ghost" data-days="7">7 ngày</button> <button class="btn-ghost" data-days="30">30 ngày</button></div></div><div class="rpg-chart"><div>'+radar(g,gmax,"Stat Growth")+'</div><div>'+KEYS.map(k=>'<div class="rpg-stat"><span><b>'+k+'</b> · '+NAMES[k]+'</span><strong>+'+Math.round(g[k]||0)+'</strong></div>').join("")+'</div></div></section><section class="rpg-panel"><h2>Lịch sử XP & Stats</h2><div class="rpg-history">'+(s.history.slice().reverse().slice(0,80).map(e=>'<div><b>'+esc(e.date||"")+'</b> · '+esc(e.title||e.action)+' · '+(Number(e.xpDelta)>0?"+"+e.xpDelta:Number(e.xpDelta)||0)+' XP · '+esc(taskEffectsLine(e.statDelta||{}))+'</div>').join("")||'<div class="rpg-muted">Chưa có lịch sử.</div>')+'</div></section></div>';
 document.querySelectorAll("[data-days]").forEach(b=>b.onclick=()=>{const n=state();n.preferences.growthDays=Number(b.dataset.days);save(n);render("stats");});
}
function buildPrompt(){const s=state(),actions=s.history.filter(e=>e.action==="completed"||e.action==="skipped"),den=actions.length,done=actions.filter(e=>e.action==="completed").length,skipped=actions.filter(e=>e.action==="skipped"||e.action==="task_deleted").slice(-20).map(e=>({title:e.title,action:e.action,date:e.date,reason:e.reason}));return window.LifeRpgTaskEngine.makePrompt({userData:{profile:{name:s.user.name,level:s.level,xp:s.xp},goals:s.user.goals,mainQuest:activeQuest(s,"main"),weeklyQuest:activeQuest(s,"weekly"),currentStats:s.stats,completionRate:den?done/den:0,taskHistory:s.history.slice(-60),skippedOrDeleted:skipped,activePlan:s.plans.find(p=>p.id===s.activePlanId)||null,activeTaskRules:s.taskRules.filter(r=>r.planId===s.activePlanId&&r.status==="active").map(r=>({title:r.title,taskType:r.taskType,target:r.target,period:r.period,preferredTime:r.preferredTime,tags:r.tags})),statGrowth:growth(s,30)},answers:s.aiConversation&&s.aiConversation.status==="ANSWERED"?s.aiConversation.answers||[]:[]});}
function taskManagerMarkup(s){
 const tasks=s.tasks.filter(t=>t.taskDate===today()&&t.status!=="deleted"&&t.status!=="archived").sort((a,b)=>(a.timeOfDay==="evening"?1:0)-(b.timeOfDay==="evening"?1:0)||(Number(a.batchOrder)||0)-(Number(b.batchOrder)||0)||queueOrder(a,b));
 const status={pending:"Chờ",completed:"Đã xong",deferred:"Đã chuyển",inactive:"Phương án dự phòng",replaced:"Đã đổi",skipped:"Bỏ qua"};
 return '<section class="rpg-panel"><h2>Danh sách Task hôm nay</h2><form id="manual-task-form" class="rpg-manage-form"><input name="title" maxlength="140" placeholder="Nội dung Task" required><input name="tags" maxlength="180" placeholder="SI, STR, EN, VIT, EQ, Y" title="SI: tư duy · STR: thể lực · EN: sức bền · VIT: phục hồi · EQ: cảm xúc · Y: nội tâm"><select name="difficulty"><option>Easy</option><option selected>Normal</option><option>Hard</option><option>Epic</option></select><select name="timeOfDay"><option value="day">Ban ngày</option><option value="evening">Buổi tối</option></select><button class="btn-primary">Thêm Task thủ công</button></form><div class="rpg-manage-list">'+(tasks.length?tasks.map(t=>'<div class="rpg-manage-row"><span>'+esc(t.title)+' <small>· '+(t.timeOfDay==="evening"?"Buổi tối":"Ban ngày")+' · '+esc(status[t.status]||t.status)+'</small></span><button class="btn-ghost" data-remove-task="'+esc(t.id)+'" aria-label="Xóa '+esc(t.title)+'">Xóa</button></div>').join(""):'<div class="rpg-empty">Chưa có Task.</div>')+'</div></section>';
}
function renderImport(s,target=view,focus=0){
 const prompt=buildPrompt(),tasks=s.tasks.filter(t=>t.taskDate===today()).length,interview=s.aiConversation&&["NEED_INFO","ANSWERED"].includes(s.aiConversation.status)?(s.aiConversation.status==="NEED_INFO"?'<section class="rpg-panel"><h2>AI cần thêm thông tin</h2><ol>'+(s.aiConversation.questions||[]).map(q=>"<li>"+esc(q)+"</li>").join("")+'</ol><form id="ai-answer-form" class="rpg-form"><label>Câu trả lời, có thể trả lời từng dòng<textarea name="answers" placeholder="Nhập câu trả lời theo thứ tự câu hỏi..." required></textarea></label><button class="btn-primary">Lưu câu trả lời và tạo Prompt tiếp theo</button></form></section>':'<section class="rpg-panel"><h2>Tiếp tục cuộc trao đổi với AI</h2><p class="rpg-muted">Câu trả lời đã được lưu vào USER_DATA. Sao chép Prompt phía dưới, gửi tiếp trong cùng cuộc trò chuyện AI rồi dán phản hồi JSON để nạp kế hoạch.</p></section>'):"";
 target.innerHTML=style()+'<div class="rpg-wrap"><section class="rpg-panel"><h2>Nạp Quest & Task</h2><p class="rpg-muted">Sao chép Prompt bên dưới sang ChatGPT rồi dán phản hồi JSON ở đây. Task sẽ được phân phối từ gói kế hoạch 30 ngày. Hôm nay: '+tasks+' Task đã lên lịch.</p><form id="paste-form" class="rpg-form"><textarea id="paste-input" placeholder=\'Dán JSON NEED_INFO hoặc PLAN_READY ở đây...\'></textarea><button class="btn-primary">Nạp Quest & Task</button></form><div id="import-error" class="rpg-muted" style="color:#a43b3b"></div>'+interview+(s.feedback?'<p class="rpg-feedback">'+esc(s.feedback)+'</p>':"")+'</section>'+taskManagerMarkup(s)+'<section class="rpg-panel"><h2>Quy tắc cho AI tạo Quest và Task</h2><p class="rpg-muted">Sao chép hướng dẫn có kèm profile, mục tiêu, Quest, Stats và lịch sử gần đây; gửi trong ChatGPT rồi dán JSON trả về phía trên.</p><div class="rpg-actions"><button class="btn-ghost" id="copy-prompt">Sao chép prompt AI</button></div><pre class="rpg-code" id="prompt-text">'+esc(prompt)+'</pre></section><section class="rpg-panel"><h2>Cách chấm điểm bằng tag</h2><div class="rpg-muted">Tag chỉ số: SI (tư duy/học tập), STR (thể lực), EN (sức bền/thói quen), VIT (phục hồi trong game), EQ (cảm xúc), Y (nội tâm). Mỗi Task nên có 1–3 tag Stats và tag chủ đề tùy chọn.</div><div class="rpg-quest"><b>Easy</b> · 15 XP · tag đầu +1, tag thứ hai +1<br><b>Normal</b> · 30 XP · +2, +1<br><b>Hard</b> · 55 XP · +3, +2, +1<br><b>Epic</b> · 85 XP · +4, +3, +2<br><span class="rpg-muted">Không có tag Stats hợp lệ: mặc định EN +1. Hoàn thành Task không thể cộng điểm lần thứ hai.</span></div><p class="rpg-muted">Chỉ nhận JSON có status NEED_INFO hoặc PLAN_READY. Mỗi Task rule được lưu một lần; app tạo lượt xuất hiện khi đến ngày phù hợp.</p></section><section class="rpg-panel"><h2>Hồ sơ & dữ liệu</h2><form id="profile-form" class="rpg-form"><label>Tên người chơi<input name="name" maxlength="80"></label><label>Mục tiêu dài hạn, mỗi dòng một mục tiêu<textarea name="goals" style="height:120px" placeholder="Phát triển kênh cá nhân&#10;Học ngoại ngữ"></textarea></label><button class="btn-primary">Lưu hồ sơ và mục tiêu</button></form><div class="rpg-actions"><button class="btn-ghost" id="export-backup">Tải backup</button><label class="btn-ghost" for="restore-backup" style="cursor:pointer">Phục hồi backup</label><input id="restore-backup" type="file" accept="application/json" hidden></div><p class="rpg-muted">Task, Quest, XP, Stats và history được lưu cục bộ trên thiết bị này.</p></section></div>';
 const content=target.querySelector(".rpg-wrap"),sections=content?[...content.children].filter(x=>x.classList&&x.classList.contains("rpg-panel")):[],visible=focus===2?[2,3]:[focus];sections.forEach((section,index)=>{section.hidden=!visible.includes(index);});
 const profile=state();
 document.getElementById("profile-form").elements.name.value=profile.user.name||"";
 document.getElementById("profile-form").elements.goals.value=(profile.user.goals||[]).join("\n");
 document.getElementById("profile-form").onsubmit=e=>{e.preventDefault();const n=state(),f=e.currentTarget;n.user.name=f.elements.name.value.trim()||"Player";n.user.goals=f.elements.goals.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,30);n.feedback="Đã lưu tên và mục tiêu cho prompt AI.";save(n);refreshImportTool();};
 document.getElementById("export-backup").onclick=()=>{const payload={format:"life-rpg-backup.v1",exportedAt:now(),state:state()};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="mori-quest-backup-"+today()+".json";a.click();URL.revokeObjectURL(url);};
 document.getElementById("restore-backup").onchange=e=>{const file=e.target.files&&e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const payload=JSON.parse(String(reader.result||""));if(payload.format!=="life-rpg-backup.v1"||!payload.state||![1,2].includes(payload.state.schemaVersion))throw new Error("File backup không đúng định dạng.");localStorage.setItem(STORE,JSON.stringify(payload.state));refreshImportTool();}catch(ex){alert("Không thể phục hồi: "+String(ex.message||ex));}};reader.readAsText(file);};
 const manual=document.getElementById("manual-task-form");
 manual.onsubmit=e=>{e.preventDefault();const f=e.currentTarget;const ok=addManualTask({title:f.elements.title.value,tags:f.elements.tags.value,difficulty:f.elements.difficulty.value,timeOfDay:f.elements.timeOfDay.value});if(ok)f.reset();};
 document.querySelectorAll("[data-remove-task]").forEach(b=>b.onclick=()=>removeTask(b.dataset.removeTask));
 document.getElementById("paste-form").onsubmit=e=>{e.preventDefault();const err=document.getElementById("import-error");try{const count=importPaste(document.getElementById("paste-input").value);if(count)document.getElementById("paste-input").value="";}catch(ex){err.textContent=String(ex.message||ex);}};
 const answerForm=document.getElementById("ai-answer-form");
 if(answerForm)answerForm.onsubmit=async e=>{e.preventDefault();const n=state(),answers=e.currentTarget.elements.answers.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!answers.length)return;n.aiConversation={status:"ANSWERED",questions:n.aiConversation&&n.aiConversation.questions||[],answers};n.feedback="Đã lưu câu trả lời. Prompt tiếp theo đã sẵn sàng.";save(n);refreshImportTool();};
 document.getElementById("copy-prompt").onclick=async()=>{try{await navigator.clipboard.writeText(prompt);document.getElementById("copy-prompt").textContent="Đã sao chép";}catch(_){const r=document.createRange();r.selectNodeContents(document.getElementById("prompt-text"));const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);document.getElementById("copy-prompt").textContent="Chọn prompt rồi sao chép";}};
}
function render(tab){
 const current=rollover(state());applyEveningSwitch(current,false);activeTab=["tasks","stats","settings"].includes(tab)?tab:"tasks";
 const items=[{id:"tasks",label:"Task",icon:"✅"},{id:"stats",label:"Chỉ số",icon:"📊"},{id:"settings",label:"Cài đặt",icon:"⚙️"}];
 if(tabsBar){tabsBar.innerHTML=items.map(i=>'<button type="button" class="tab-btn '+(activeTab===i.id?"active":"")+'" data-rpg-tab="'+i.id+'" aria-label="'+i.label+'">'+i.icon+'</button>').join("");tabsBar.querySelectorAll("[data-rpg-tab]").forEach(b=>b.onclick=()=>render(b.dataset.rpgTab));}
 const s=rollover(state());if(activeTab==="stats")renderStats(s);else if(activeTab==="settings")renderSettings(s);else renderTasks(s);
}
function rolloverForLegacy(){rollover(state());return true;}
const storageKey="tq_liferpg_state_v1";if(!localStorage.getItem(storageKey))save(fresh());else{try{const stored=JSON.parse(localStorage.getItem(storageKey));if(stored.schemaVersion!==2)save(state());}catch(_){}}
try{if(window.stopDaySyncMonitoring)window.stopDaySyncMonitoring();}catch(_){}
window.LifeRpg={render,rollover:rolloverForLegacy,state,completeTask:complete,skipTask:skip,importPaste,buildPrompt,swapTasks,addManualTask,removeTask,recordLucky};
const heroLucky=document.querySelector("[data-lucky-button]");if(heroLucky)heroLucky.onclick=recordLucky;
window.render=render;render("tasks");
let lastTimeBlock=timeOfDay();window.setInterval(()=>{const nextBlock=timeOfDay(),dayChanged=state().currentDate!==today();if(dayChanged||nextBlock!==lastTimeBlock){lastTimeBlock=nextBlock;render(activeTab);}},60000);
window.setInterval(()=>{if(activeTab==="tasks")updateEnergyCooldownUI();},1000);
window.addEventListener("storage",e=>{if(e.key===STORE)render(activeTab);});
})();