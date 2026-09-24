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
      if(Array.isArray(payload))return{status:"PLAN_READY",tasks:payload.map(normalizeTask).filter(Boolean)};
      if(typeof payload!=="object")return null;
      const status=String(payload.status||"").toUpperCase();
      if(status==="NEED_INFO")return{status:"NEED_INFO",questions:Array.isArray(payload.questions)?payload.questions.map(String).filter(Boolean).slice(0,6):[]};
      const rawTasks=firstValue(payload,["tasks","dailyTasks","daily_tasks","taskList","task_list","items"],[]);
      const tasks=Array.isArray(rawTasks)?rawTasks.map(normalizeTask).filter(Boolean):(rawTasks&&typeof rawTasks==="object"?[normalizeTask(rawTasks)].filter(Boolean):[]);
      const weekly=firstValue(payload,["weeklyQuests","weekly_quests","weeklyQuest","weekly_quest"],[]);
      const quests=firstValue(payload,["quests"],[]);
      return{status:status||"PLAN_READY",mainQuest:firstValue(payload,["mainQuest","main_quest","mainGoal","main_goal"],null),weeklyQuests:Array.isArray(weekly)?weekly:(weekly?[weekly]:[]),quests:Array.isArray(quests)?quests:[],tasks:tasks};
    }
    return parseTaggedText(text);
  }
  function makePrompt(context){
    const ctx=context||{};
    const base=[
      "Bạn là AI lập kế hoạch cá nhân cho ứng dụng Life RPG.",
      "Mỗi lần Nạp Quest & Task, hãy thiết kế một gói nhiệm vụ cho khoảng 30 ngày tiếp theo.",
      "Đọc USER_DATA trước. Nếu thiếu thông tin quan trọng để cá nhân hóa kế hoạch tháng, chưa tạo Task; trả NEED_INFO và hỏi 3-6 câu ngắn nhất về ưu tiên, deadline, thời gian, hoạt động muốn duy trì, điều muốn cải thiện hoặc tránh. Không hỏi lại điều đã có trong USER_DATA.",
      "Khi đã đủ dữ liệu, tự quyết định mỗi Task thuộc daily, weekly, recurring hoặc one_time; tự chọn target, period và preferredTime. Không mặc định tần suất cao là tốt, không biến mọi sở thích thành nghĩa vụ, và tính tổng tải để duy trì khoảng 30 ngày.",
      "Ưu tiên mục tiêu hiện tại, hoạt động người dùng thực sự muốn làm, dự án, kỹ năng, lịch sử hoàn thành, Task bị bỏ qua/xóa; cân bằng trí óc, thể chất, sáng tạo, hồi phục khi phù hợp. Task cụ thể, có điều kiện hoàn thành rõ ràng. Không chung chung, không đổi tên Task cũ để lặp lại, không tạo Task chỉ để farm Stats.",
      "Main Quest là hướng phát triển lớn. Chỉ tạo Weekly Quest nếu có mục tiêu tuần đáng theo dõi.",
      "Mỗi Task có 1-3 tag chỉ số từ SI, STR, EN, VIT, EQ, Y; có thể thêm tag chủ đề. difficulty chỉ Easy, Normal, Hard, Epic. energyRole chỉ focus, movement, recovery, connection, reflection. preferredTime chỉ morning, daytime, evening, any.",
      "Không xuất XP hoặc điểm Stats. VIT chỉ là chỉ số game hóa, không phải đánh giá y khoa.",
      "Luôn trả đúng một JSON object hợp lệ, không markdown, không code fence, không văn bản ngoài JSON. Dùng dấu ngoặc kép ASCII, không dấu phẩy thừa.",
      "Nếu chưa đủ thông tin, schema là {status: NEED_INFO, questions: array gồm 3-6 câu ngắn}. Nếu đủ, schema là {status: PLAN_READY, mainQuest: object hoặc null, weeklyQuests: array, tasks: array}. Mỗi Task cần title, description, category, taskType, target, period, preferredTime, tags, difficulty, energyRole, mainQuest, weeklyQuest, reason.",
      "Task type rules: daily => target là số lần/ngày, period day; weekly => số lần/tuần, period week; recurring => số lần trong chu kỳ 30 ngày, period month; one_time => target 1, period month. Các giá trị này phải khớp nhau.",
      "USER_DATA: "+JSON.stringify(ctx.userData||ctx),
      "CÂU TRẢ LỜI MỚI CỦA NGƯỜI DÙNG: "+JSON.stringify(ctx.answers||[])
    ];
    return base.join("\n");
  }
  root.LifeRpgTaskEngine={statKeys:STAT_KEYS.slice(),difficulty:Object.assign({},DIFFICULTY),statTags:statTags,score:score,parse:parse,makePrompt:makePrompt,schema:{version:"life-rpg-tagged-import.v1",maxDailyTasks:20,statuses:["pending","completed","skipped"]}};
})(window);