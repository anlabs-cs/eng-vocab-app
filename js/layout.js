/* =========================================================
   LAYOUT: render dispatcher (+ login gate) + shared top nav.
   Loaded on every page, before the view files.
   Views that don't exist on the current page are skipped via
   typeof checks (e.g. index.html only loads home.js).
========================================================= */
const VIEW_RENDERERS = {
  'home': 'renderHome',
  'detail': 'renderDetail',
  'editor': 'renderEditor',
  'flashcards': 'renderFlashcards',
  'learn': 'renderLearn',
  'test-setup': 'renderTestSetup',
  'test': 'renderTest',
  'results': 'renderResults'
};

function render(){
  if(typeof DriveSync !== 'undefined' && DriveSync.needsLogin()){
    root.innerHTML = DriveSync.loginHtml();
    return;
  }
  const fn = window[VIEW_RENDERERS[view]];
  if(typeof fn === 'function') return fn();
}

function topNav(){
  const showInstall = window.deferredPrompt ? 'inline-block' : 'none';
  return `
    <div class="topnav">
      <div class="brand" onclick="go('home')">EngVocab</div>
      <div class="spacer"></div>
      <button id="installAppBtn" class="btn-ghost" style="display:${showInstall};" onclick="installPWA()">Install app</button>
      <div class="drive-box" id="driveBox">${typeof driveUiHtml === 'function' ? driveUiHtml() : ''}</div>
      <button class="icon-btn" title="${currentTheme()==='light'?'Switch to dark mode':'Switch to light mode'}" onclick="toggleTheme()">${currentTheme()==='light'?'<img src="img/icon/moon.png" class="theme-icon">':'<img src="img/icon/sun.png" class="theme-icon">'}</button>
    </div>
  `;
}

/* Light/dark button for the study screens (Flashcards / Learn / Test).
   Switches the theme in place WITHOUT re-rendering, so half-typed answers
   and the current card/question are left untouched. */
function studyThemeBtnHtml(){
  const light = currentTheme()==='light';
  return `<button class="icon-btn" id="studyThemeBtn" title="${light?'Switch to dark mode':'Switch to light mode'}" onclick="studyToggleTheme()"><img src="img/icon/${light?'moon':'sun'}.png" class="theme-icon"></button>`;
}
function studyToggleTheme(){
  applyTheme(currentTheme()==='light' ? 'dark' : 'light');
  const b = document.getElementById('studyThemeBtn');
  if(b){
    const light = currentTheme()==='light';
    b.title = light ? 'Switch to dark mode' : 'Switch to light mode';
    b.innerHTML = `<img src="img/icon/${light?'moon':'sun'}.png" class="theme-icon">`;
  }
}
