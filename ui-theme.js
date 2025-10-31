// ui-theme.js

// UI THEME CONFIG
window.UI_THEME = {
  // icon cho từng tab (đổi icon ở đây)
  tabIcons: {
    tasks:        "🗒️",
    map:          "🗺️",
    leaderboard:  "🏆",
    stats:        "📈",
    settings:     "⚙️"
  },

  // nền gradient cho từng tab (đổi màu ở đây)
  backgrounds:{
    tasks:       "linear-gradient(160deg,#d4f1ff 0%,#c8ffe0 50%,#fff6d8 100%)",
    map:         "linear-gradient(160deg,#a0e0ff 0%,#6dd6a8 50%,#fff1b8 100%)",
    leaderboard: "linear-gradient(160deg,#fff4d2 0%,#ffd087 50%,#ff9f6b 100%)",
    stats:       "linear-gradient(160deg,#d5ccff 0%,#a3a3ff 40%,#6bd5ff 100%)",
    settings:    "linear-gradient(160deg,#ececec 0%,#d5d9ff 50%,#ffffff 100%)"
  },

  // style khối .wrap kiểu kính mờ
  wrapStyle: `
    max-width:960px;
    margin:12px auto;
    padding:20px;
    background:rgba(255,255,255,.9);
    backdrop-filter:blur(12px);
    border-radius:24px;
    border:1px solid rgba(255,255,255,.6);
    box-shadow:0 24px 60px rgba(0,0,0,.15);
  `
};

// đổi nền body theo tab
window.applyTabBackground = function(tabKey){
  const uiTheme = window.UI_THEME || {};
  const configTheme = window.APP_CONFIG && window.APP_CONFIG.BACKGROUND_THEME ? window.APP_CONFIG.BACKGROUND_THEME : {};
  const tabOverrides = configTheme.tabBackgrounds || configTheme.tabs || {};
  const uiFallback = uiTheme.backgrounds && uiTheme.backgrounds[tabKey];
  const rawBg = (tabOverrides && tabOverrides[tabKey]) || configTheme.appDefaultBgUrl || uiFallback || "#f6f7ff";
  const trimmed = (rawBg || "").toString().trim();
  const lower = trimmed.toLowerCase();
  const isColor = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(trimmed);
  const isImageValue = lower.startsWith("url(") || lower.includes("gradient(");

  document.body.style.background = "";

  if(isColor){
    document.body.style.backgroundColor = trimmed;
    document.body.style.backgroundImage = "";
  } else if(trimmed){
    const imageValue = isImageValue ? trimmed : `url('${trimmed.replace(/'/g,"\\'")}')`;
    document.body.style.backgroundColor = "";
    document.body.style.backgroundImage = imageValue;
  } else {
    document.body.style.backgroundColor = "";
    document.body.style.backgroundImage = "";
  }

  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundAttachment = "fixed";
  document.body.style.backgroundRepeat = "no-repeat";
};

// apply style kính mờ cho .wrap
window.applyThemeToWrap = function(){
  const w = document.querySelector(".wrap");
  if(!w) return;
  w.setAttribute("style", window.UI_THEME.wrapStyle);
};

// build lại thanh tabs dựa trên icon từ config
window.buildTabsBar = function(activeKey, onClickTab){
  const TAB_ORDER = [
    {key:"tasks",        label:"Tasks"},
    {key:"map",          label:"Map"},
    {key:"leaderboard",  label:"Leaderboard"},
    {key:"stats",        label:"Stats"},
    {key:"settings",     label:"Settings"}
  ];
  const bar = document.getElementById("tabsBar");
  if(!bar) return;
  bar.innerHTML = TAB_ORDER.map(t=>{
    const icon = (window.UI_THEME.tabIcons && window.UI_THEME.tabIcons[t.key]) || "";
    return `
      <button class="btn ${t.key===activeKey?'active':''}" data-tab="${t.key}">
        <span class="tab-icon" style="font-size:16px;line-height:1">${icon}</span>
        <span class="tab-label" style="margin-left:6px">${t.label}</span>
      </button>
    `;
  }).join("");

  // gán click
  [...bar.querySelectorAll("[data-tab]")].forEach(b=>{
    b.onclick = ()=> onClickTab(b.dataset.tab);
  });
};
