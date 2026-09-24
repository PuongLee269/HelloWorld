/* Life RPG tagged-task importer and deterministic scoring rules. */
(function (root) {
  "use strict";
  const STAT_KEYS = ["SI", "STR", "EN", "VIT", "EQ", "Y"];
  const DIFFICULTY = { Easy:{xp:15,stats:[1,1,0]}, Normal:{xp:30,stats:[2,1,0]}, Hard:{xp:55,stats:[3,2,1]}, Epic:{xp:85,stats:[4,3,2]} };
  const ALIASES = {
    SI:["si","intelligence","learning","learn","study","education","knowledge","research","writing","reading","creativity","creative","planning","strategy","problem solving","analysis","language","critical thinking","tu duy","hoc tap","sang tao","nghien cuu","doc sach","lap ke hoach"],
    STR:["str","strength","fitness","exercise","workout","movement","sport","sports","training","physical","running","walking","mobility","the luc","van dong","tap luyen","chay bo","di bo","suc khoe"],
    EN:["en","endurance","consistency","discipline","focus","persistence","execution","habit","deep work","deepwork","follow through","resilience","suc ben","ki luat","tap trung","thoi quen","kien tri","thuc thi"],
    VIT:["vit","vitality","recovery","rest","sleep routine","routine","energy care","wellbeing routine","phuc hoi","nghi ngoi","ngu","duong suc","nang luong"],
    EQ:["eq","emotional","emotion","empathy","mindfulness","journaling","relationship","balance","stress management","self awareness","communication","cam xuc","dong cam","can bang","quan he","giao tiep","viet nhat ky"],
    Y:["y","spirituality","spiritual","meditation","prayer","gratitude","values","purpose","reflection","inner growth","noi tam","tinh tam","thien","cau nguyen","biet on","gia tri","muc dich","suy ngam"]
  };
  function normalizeText(value) {
    const text=String(value||"");
    return text.normalize ? text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase().replace(/[_-]+/g," ").trim() : text.toLowerCase().trim();
  }
  function unique(values){return values.filter(function(value,index){return values.indexOf(value)===index;});}
  function statTags(tags){
    const found=[];
    (Array.isArray(tags)?tags:String(tags||"").split(/[,;|]/)).forEach(function(tag){
      const value=normalizeText(tag).replace(/^#/,"");
      STAT_KEYS.forEach(function(key){if(ALIASES[key].indexOf(value)>=0||value===key.toLowerCase())found.push(key);});
    });
    return unique(found).slice(0,3);
  }
  function score(tags,difficulty){
    const level=DIFFICULTY[difficulty]?difficulty:"Normal";
    const keys=statTags(tags), selected=keys.length?keys:["EN"], amounts=DIFFICULTY[level].stats, effects={};
    selected.forEach(function(key,index){if(amounts[index]>0)effects[key]=amounts[index];});
    return {difficulty:level,xp:DIFFICULTY[level].xp,statEffects:effects,statTags:selected,usedDefaultTag:keys.length===0};
  }
  function stripFence(text){
    return String(text||"").replace(/^\uFEFF/,"").replace(/[\u200B-\u200D\u2060]/g,"").trim()
      .replace(/^\`\`\`[a-zA-Z0-9_-]*\s*/,"").replace(/\s*\`\`\`$/,"").trim();
  }
  function balancedJsonCandidates(source){
    const out=[];
    for(let start=0;start<source.length;start++){
      const first=source[start];if(first!=="{"&&first!=="[")continue;
      const stack=[];let quoted=false,escape=false;
      for(let i=start;i<source.length;i++){
        const c=source[i];
        if(quoted){if(escape)escape=false;else if(c==="\\")escape=true;else if(c==='"')quoted=false;continue;}
        if(c==='"'){quoted=true;continue;}
        if(c==="{"||c==="[")stack.push(c);
        else if(c==="}"||c==="]"){
          const open=stack.pop();if((open==="{"&&c!=="}")||(open==="["&&c!=="]"))break;
          if(!stack.length){out.push(source.slice(start,i+1));break;}
        }
      }
    }
    return out.sort(function(a,b){return b.length-a.length;});
  }
  function parseJson(text){
    const source=stripFence(text);
    try{return JSON.parse(source);}catch(_){}
    const candidates=balancedJsonCandidates(source);
    for(let i=0;i<candidates.length;i++){try{return JSON.parse(candidates[i]);}catch(_){}}
    return null;
  }
  function splitTags(value){return(Array.isArray(value)?value.map(String):String(value||"").split(/[,;|]/)).map(function(tag){return tag.replace(/^#/,"").trim();}).filter(Boolean);}
  function parseTaggedText(text){
    const result={mainQuest:null,weeklyQuests:[],tasks:[],eveningTasks:[]};let current=null;
    String(text||"").split(/\r?\n/).forEach(function(line){
      const trimmed=line.trim();if(!trimmed)return;
      let match=trimmed.match(/^\[(MAIN QUEST|WEEKLY QUEST|EVENING TASK|TASK)\]\s*(.*)$/i);
      if(match){
        const kind=match[1].toUpperCase(),title=match[2].replace(/^[-*]\s*/,"").trim();
        if(kind==="MAIN QUEST")result.mainQuest={title:title};
        else if(kind==="WEEKLY QUEST"){current={title:title,target:4};result.weeklyQuests.push(current);}
        else if(kind==="EVENING TASK"){current={title:title,tags:[],timeOfDay:"evening"};result.eveningTasks.push(current);}
        else{current={title:title,tags:[],timeOfDay:"day"};result.tasks.push(current);}
        return;
      }
      match=trimmed.match(/^[-*]\s+(.+)$/);
      if(match){current={title:match[1].trim(),tags:[]};result.tasks.push(current);return;}
      if(!current)return;
      match=trimmed.match(/^(tags?|difficulty|description|main quest|weekly quest|replaces task|reason|category)\s*:\s*(.*)$/i);
      if(!match)return;
      const key=normalizeText(match[1]),value=match[2].trim();
      if(key==="tag"||key==="tags")current.tags=splitTags(value);
      else if(key==="difficulty")current.difficulty=value;
      else if(key==="description")current.description=value;
      else if(key==="main quest")current.mainQuest=value;
      else if(key==="weekly quest")current.weeklyQuest=value;
      else if(key==="replaces task")current.replacesTask=value;
      else if(key==="reason")current.reason=value;
      else if(key==="category")current.category=value;
    });
    return result;
  }
  function firstValue(object,keys,fallback){
    for(let i=0;i<keys.length;i++){const value=object&&object[keys[i]];if(value!==undefined&&value!==null)return value;}
    return fallback;
  }
  function normalizeTask(raw){
    if(typeof raw==="string")return{title:raw};
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
    const task=Object.assign({},raw);
    task.title=firstValue(raw,["title","text","name","content","task"],"");
    task.tags=firstValue(raw,["tags","tag","stats","statTags","stat_tags"],[]);
    task.difficulty=firstValue(raw,["difficulty","level"],"Normal");
    return task;
  }
  function parse(text){
    const payload=parseJson(text);
    if(payload){
      if(Array.isArray(payload))return{tasks:payload.map(normalizeTask).filter(Boolean)};
      if(typeof payload!=="object")return null;
      const rawTasks=firstValue(payload,["tasks","dailyTasks","daily_tasks","taskList","task_list","dailyQuest","daily_quests","items"],[]);
      const tasks=Array.isArray(rawTasks)?rawTasks.map(normalizeTask).filter(Boolean):(rawTasks&&typeof rawTasks==="object"?[normalizeTask(rawTasks)].filter(Boolean):[]);
      const rawEvening=firstValue(payload,["eveningTasks","evening_tasks","nightTasks","night_tasks","replacementTasks","replacement_tasks"],[]);
      const eveningTasks=Array.isArray(rawEvening)?rawEvening.map(normalizeTask).filter(Boolean):(rawEvening&&typeof rawEvening==="object"?[normalizeTask(rawEvening)].filter(Boolean):[]);
      const weekly=firstValue(payload,["weeklyQuests","weekly_quests","weeklyQuest","weekly_quest"],[]);
      const quests=firstValue(payload,["quests"],[]);
      return{mainQuest:firstValue(payload,["mainQuest","main_quest","mainGoal","main_goal"],null),weeklyQuests:Array.isArray(weekly)?weekly:(weekly?[weekly]:[]),quests:Array.isArray(quests)?quests:[],tasks:tasks,eveningTasks:eveningTasks};
    }
    return parseTaggedText(text);
  }
  function makePrompt(context){
    const ctx=context||{},stats=ctx.currentStats||{};
    const statsLine=STAT_KEYS.map(function(key){return key+":"+(Number(stats[key])||0);}).join(", ");
    return[
      "Bạn là AI lập kế hoạch cá nhân cho ứng dụng Life RPG. Hãy tự phân tích dữ liệu người dùng và tự sáng tạo Quest/Task phù hợp riêng với họ. Không dùng danh sách gợi ý có sẵn, không lặp ví dụ hoặc mẫu Task.",
      "Đầu ra phải là đúng một JSON object hợp lệ. Không markdown, không code fence, không lời dẫn/kết luận. Dùng dấu ngoặc kép ASCII cho chuỗi, không dấu phẩy thừa. Mọi danh sách phải là JSON array; nếu không có dữ liệu thì dùng array rỗng.",
      "Schema: object gồm mainQuest (object có title, description hoặc null); weeklyQuests (array object có title, description, target, mainQuest); tasks (array object, mỗi phần tử có title, tags, difficulty, energyRole và có thể có description, category, mainQuest, weeklyQuest, reason); eveningTasks (array object, mỗi phần tử có title, replacesTask, tags, difficulty, energyRole và có thể có description, reason).",
      "Tạo 3, 6 hoặc 9 Task ban ngày, luôn theo nhóm đủ 3; không bắt buộc chọn số lượng lớn. Với mỗi Task ban ngày tạo đúng một phương án buổi tối tương ứng trong eveningTasks. replacesTask phải khớp chính xác title của Task ban ngày. Tổng số phần tử hai danh sách không vượt quá 20.",
      "Tự chọn nội dung dựa trên mục tiêu, hồ sơ, lịch sử và hoàn cảnh người dùng; ưu tiên Task cụ thể, khả thi, đa dạng, tránh trùng lặp. Không đưa Task chung chung hoặc nhiệm vụ không liên quan. Ghép mỗi nhóm 3 Task để bổ trợ nhau và giữ nhịp năng lượng vừa sức; tối đa một Task Hard/Epic trong nhóm, có việc nhẹ/hồi phục, không dồn các việc tiêu hao cùng kiểu năng lượng. Task buổi tối ngắn, nhẹ và phù hợp thời gian tối.",
      "Mỗi Task có 1–3 tag chỉ số trong đúng các mã SI, STR, EN, VIT, EQ, Y; có thể thêm tag chủ đề liên quan. Difficulty chỉ dùng Easy, Normal, Hard, Epic. energyRole chỉ dùng focus, movement, recovery, connection, reflection. Không xuất XP hoặc điểm Stats vì ứng dụng tự tính theo tag và độ khó. Không đưa ra chẩn đoán y tế; VIT chỉ là chỉ số game hóa, không phải đánh giá y khoa.",
      "Chọn Quest và Task cá nhân hóa, không mặc định mục tiêu hay lĩnh vực nào nếu dữ liệu người dùng không nêu. Nếu thiếu thông tin, tạo số Task ít hơn và an toàn thay vì tự bịa hồ sơ.",
      "DỮ LIỆU NGƯỜI DÙNG:",
      "Tên và tiến độ: "+JSON.stringify({name:(ctx.userProfile||{}).name||"Player",level:(ctx.userProfile||{}).level||1,xp:(ctx.userProfile||{}).xp||0}),
      "Mục tiêu dài hạn: "+JSON.stringify(ctx.goals||[]),
      "Main Quest hiện tại: "+JSON.stringify(ctx.mainQuest||null),
      "Weekly Quest hiện tại: "+JSON.stringify(ctx.weeklyQuest||null),
      "Stats hiện tại: "+statsLine,
      "Tỷ lệ hoàn thành gần đây: "+Math.round((Number(ctx.completionRate)||0)*100)+"%",
      "Task đã bỏ qua gần đây: "+JSON.stringify((ctx.skippedTasks||[]).slice(-10)),
      "Tăng trưởng Stats 7 ngày: "+JSON.stringify(ctx.statGrowth||{}),
      "Lịch sử Task gần đây: "+JSON.stringify((ctx.recentTaskHistory||[]).slice(-20))
    ].join("\\n");
  }
  root.LifeRpgTaskEngine={statKeys:STAT_KEYS.slice(),difficulty:Object.assign({},DIFFICULTY),statTags:statTags,score:score,parse:parse,makePrompt:makePrompt,schema:{version:"life-rpg-tagged-import.v1",maxDailyTasks:20,statuses:["pending","completed","skipped"]}};
})(window);