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
    const tick=String.fromCharCode(96).repeat(3), pattern=new RegExp("^"+tick+"(?:json)?\\s*|\\s*"+tick+"$","gi");
    return String(text||"").trim().replace(pattern,"").trim();
  }
  function parseJson(text){
    const source=stripFence(text);
    try{return JSON.parse(source);}catch(_){}
    const start=source.indexOf("{"),end=source.lastIndexOf("}");
    if(start>=0&&end>start)return JSON.parse(source.slice(start,end+1));
    const a=source.indexOf("["),b=source.lastIndexOf("]");
    if(a>=0&&b>a){try{return JSON.parse(source.slice(a,b+1));}catch(_){}}
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
      match=trimmed.match(/^(tags?|difficulty|description|main quest|weekly quest|reason|category)\s*:\s*(.*)$/i);
      if(!match)return;
      const key=normalizeText(match[1]),value=match[2].trim();
      if(key==="tag"||key==="tags")current.tags=splitTags(value);
      else if(key==="difficulty")current.difficulty=value;
      else if(key==="description")current.description=value;
      else if(key==="main quest")current.mainQuest=value;
      else if(key==="weekly quest")current.weeklyQuest=value;
      else if(key==="reason")current.reason=value;
      else if(key==="category")current.category=value;
    });
    return result;
  }
  function parse(text){
    const payload=parseJson(text);
    if(payload){
      if(Array.isArray(payload))return{tasks:payload};
      return{mainQuest:payload.mainQuest||payload.main_quest||null,weeklyQuests:payload.weeklyQuests||payload.weekly_quests||[],quests:payload.quests||[],tasks:payload.tasks||payload.dailyTasks||payload.daily_tasks||[],eveningTasks:payload.eveningTasks||payload.evening_tasks||[]};
    }
    return parseTaggedText(text);
  }
  function makePrompt(context){
    const ctx=context||{},stats=ctx.currentStats||{};
    const statsLine=STAT_KEYS.map(function(key){return key+":"+(Number(stats[key])||0);}).join(", ");
    return[
      "Bạn là AI lập kế hoạch Daily Task cho ứng dụng Life RPG. Dựa trên hồ sơ bên dưới, hãy tạo 3, 6 hoặc 9 Task ban ngày cùng đúng số Task tối thay thế tương ứng (tổng tối đa 18 Task/ngày). Mỗi nhóm ban ngày gồm 3 Task; mỗi Task tối thay thế một Task ban ngày tương ứng.",
      "Chỉ trả JSON hợp lệ, không markdown, theo schema:",
      '{"mainQuest":{"title":"...","description":"..."},"weeklyQuests":[{"title":"...","description":"...","target":4,"mainQuest":"..."}],"tasks":[{"title":"...","description":"...","category":"...","tags":["SI","EN","YouTube"],"difficulty":"Normal","energyRole":"focus|movement|recovery|connection|reflection","mainQuest":"...","weeklyQuest":"...","reason":"..."}],"eveningTasks":[{"title":"...","replacesTask":"exact daytime task title","tags":["EQ","VIT"],"difficulty":"Easy","energyRole":"recovery","reason":"..."}]}',
      "Quy tắc: mỗi task có 1–3 tag chỉ số chính xác trong SI, STR, EN, VIT, EQ, Y; có thể thêm tag chủ đề. Difficulty chỉ dùng Easy, Normal, Hard, Epic. Không gửi XP hay điểm Stats; ứng dụng tự tính theo tag và độ khó. Không chẩn đoán sức khỏe. VIT chỉ là chỉ số game hóa, không phải đánh giá y khoa. Đề xuất hành động cụ thể, an toàn, gắn mục tiêu và lịch sử. Không lặp lại Task gần đây; ưu tiên cách người dùng thường hoàn thành. Xếp các Task thành từng bộ ba liên tiếp có bổ trợ nhau: không quá một Task Hard/Epic trong mỗi bộ; có ít nhất một việc nhẹ hoặc hồi phục; phối hợp vai trò focus, movement, recovery, connection, reflection; tránh dồn ba việc tiêu hao cùng một kiểu năng lượng. Ưu tiên nhịp làm vừa sức, có khoảng thở, không đặt nhiều việc nặng liên tiếp. Mỗi Task ghi energyRole phù hợp. Mỗi eveningTask phải là phương án cụ thể, nhẹ nhàng, phù hợp buổi tối và có replacesTask trùng chính xác tiêu đề Task ban ngày. Chỉ thay các Task ban ngày chưa hoàn thành lúc 18:00 giờ địa phương; nếu ban ngày đã xong thì không cần mở Task tối. Task tối không được chỉ là đổi tên Task cũ.",
      "Tên: "+String((ctx.userProfile||{}).name||"Player"),"Mục tiêu: "+(ctx.goals||[]).join("; "),
      "Main Quest hiện tại: "+String((ctx.mainQuest||{}).title||"chưa có"),"Weekly Quest: "+String((ctx.weeklyQuest||{}).title||"chưa có"),
      "Stats hiện tại: "+statsLine,"Tỷ lệ hoàn thành gần đây: "+Math.round((Number(ctx.completionRate)||0)*100)+"%",
      "Task đã bỏ qua gần đây: "+(ctx.skippedTasks||[]).slice(-10).map(function(item){return item.title;}).join("; "),
      "Growth 7 ngày: "+JSON.stringify(ctx.statGrowth||{}),"Lịch sử Task gần đây: "+JSON.stringify((ctx.recentTaskHistory||[]).slice(-20))
    ].join("\n");
  }
  root.LifeRpgTaskEngine={statKeys:STAT_KEYS.slice(),difficulty:Object.assign({},DIFFICULTY),statTags:statTags,score:score,parse:parse,makePrompt:makePrompt,schema:{version:"life-rpg-tagged-import.v1",maxDailyTasks:20,statuses:["pending","completed","skipped"]}};
})(window);