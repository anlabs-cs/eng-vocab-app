/* =========================================================
   THEME (light / dark)
   Uses CSS variables in style.css: :root (dark, default) and
   :root[data-theme="light"] (light overrides). This file only
   toggles the attribute and remembers the choice.
========================================================= */
const THEME_KEY = 'vocabapp_theme_v1';

function loadTheme(){
  try{
    return localStorage.getItem(THEME_KEY) || 'dark';
  }catch(e){ return 'dark'; }
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
