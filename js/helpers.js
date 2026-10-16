/* =========================================================
   HELPERS
========================================================= */
function escapeHtml(str){
  return String(str??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(str){ return escapeHtml(str); }
// safe to embed as a JS string argument inside an inline onclick="..." handler
function jsArg(str){ return escapeHtml(JSON.stringify(String(str??''))); }
