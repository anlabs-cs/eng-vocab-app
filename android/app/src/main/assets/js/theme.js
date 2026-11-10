/* =========================================================
   THEME (light "paper" / dark)
   Uses CSS variables in style.css: :root is the light paper
   theme, :root[data-theme="dark"] overrides it. First visit
   follows the system setting; the toggle remembers a choice.
========================================================= */
const THEME_KEY = 'vocabapp_theme_v1';

function loadTheme(){
  try{
    const saved = localStorage.getItem(THEME_KEY);
    if(saved) return saved;
  }catch(e){}
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  try{ localStorage.setItem(THEME_KEY, theme); }catch(e){ /* ignore */ }
}

function currentTheme(){
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function toggleTheme(){
  applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
  render();
}

/* apply saved preference immediately (before first render, so there's no flash) */
applyTheme(loadTheme());
