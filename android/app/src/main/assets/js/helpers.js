/* =========================================================
   HELPERS
========================================================= */
function escapeHtml(str){
  return String(str??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(str){ return escapeHtml(str); }
// safe to embed as a JS string argument inside an inline onclick="..." handler
function jsArg(str){ return escapeHtml(JSON.stringify(String(str??''))); }

/* Shared answer normalizer for Learn + Test.
   exact:   NFC + trim + lowercase (so Unikey "Unicode tổ hợp" input still matches)
   lenient: also drops punctuation and collapses spaces, keeping Vietnamese letters */
function normalizeAnswer(str, lenient){
  let v = String(str??'').normalize('NFC').trim().toLowerCase();
  if(lenient) v = v.replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').trim();
  return v;
}

/* ---------------------------------------------------------
   BULK IMPORT PARSER
   One term per line. Supported formats:
   - Tab separated (Excel / Google Sheets / Anki export):
       term <TAB> definition <TAB> example <TAB> part of speech <TAB> phonetic
   - CSV with the same column order ("quoted, fields" allowed)
   - term - definition   (also –, —, =, :, or a comma)
     only the FIRST separator splits, so the definition may contain commas/dashes
   Lines starting with # (Anki headers) are ignored. Basic HTML from Anki is stripped.
--------------------------------------------------------- */
function stripImportHtml(s){
  if(!/[<&]/.test(s)) return s;
  return s.replace(/<br\s*\/?>/gi,'; ')
    .replace(/<[^>]+>/g,'')
    .replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
}

function parseCsvLine(line){
  const out = [];
  let cur = '', inQ = false;
  for(let i=0;i<line.length;i++){
    const c = line[i];
    if(inQ){
      if(c === '"' && line[i+1] === '"'){ cur += '"'; i++; }
      else if(c === '"') inQ = false;
      else cur += c;
    } else if(c === '"') inQ = true;
    else if(c === ',' || c === ';'){ out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const IMPORT_SEPARATORS = [' - ', ' – ', ' — ', ' = ', ': ', ':', ','];

function parseImportLine(line, csv){
  let cols;
  if(line.includes('\t')){
    cols = line.split('\t');
  } else if(csv || line.startsWith('"')){
    cols = parseCsvLine(line);
  } else {
    cols = [line];
    for(const sep of IMPORT_SEPARATORS){
      const at = line.indexOf(sep);
      if(at > 0){ cols = [line.slice(0, at), line.slice(at + sep.length)]; break; }
    }
  }
  cols = cols.map(c => stripImportHtml(c).trim());
  const [term = '', definition = '', example = '', pos = '', phonetic = ''] = cols;
  if(!term) return null;
  const t = { term, definition };
  if(example) t.example = example;
  if(pos) t.pos = pos;
  if(phonetic) t.phonetic = phonetic;
  return t;
}

// opts.csv: treat every line as CSV (used when a .csv file is loaded)
function parseImportText(text, opts){
  const csv = !!(opts && opts.csv);
  return String(text||'').split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => parseImportLine(l, csv))
    .filter(Boolean);
}

/* Card faces shared by the detail preview and flashcards:
   front = term + part of speech + phonetic, back = definition + example */
function frontFaceHtml(t){
  const meta = [t.pos ? `<span class="pos-tag">${escapeHtml(t.pos)}</span>` : '', t.phonetic ? `<span class="phonetic">${escapeHtml(t.phonetic)}</span>` : ''].filter(Boolean).join(' ');
  return `<div>${escapeHtml(t.term)}</div>${meta ? `<div class="face-meta">${meta}</div>` : ''}`;
}
function backFaceHtml(t, emptyText){
  return `<div>${escapeHtml(t.definition || emptyText)}</div>${t.example ? `<div class="face-example">“${escapeHtml(t.example)}”</div>` : ''}`;
}
