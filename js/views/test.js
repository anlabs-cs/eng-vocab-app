/* =========================================================
   TEST MODE
========================================================= */
function renderTestSetup(){
  const s = getSet(currentSetId);
  const starredCount = s.terms.filter(t=>t.starred).length;
  const max = s.terms.length;
  if(!session.testConfig){
    session.testConfig = {
      count: Math.min(20, max),
      starredOnly: false,
      trueFalse: false,
      multipleChoice: true,
      matching: false,
      written: false,
      answerWith: 'definition',   // 'definition' | 'term'
      showImages: true,
      grading: 'exact'            // 'exact' | 'lenient'
    };
  }
  const cfg = session.testConfig;
  const poolSize = cfg.starredOnly ? starredCount : max;

  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal" style="position:relative;">
        <button class="modal-close" onclick="go('detail')">✕</button>
        <h2>Options</h2>

        <div class="modal-row">
          <span>Questions <span style="color:var(--text-dim); font-weight:400;">(max ${poolSize||1})</span></span>
          <input type="number" class="num-input" id="qCount" min="1" max="${poolSize||1}" value="${Math.min(cfg.count, poolSize||1)}">
        </div>

        <div class="modal-row">
          <span>Study only starred terms</span>
          <button class="switch ${cfg.starredOnly?'on':''}" onclick="toggleTestOpt('starredOnly', this)"><span class="knob"></span></button>
        </div>

        <hr class="modal-sep">

        <div class="modal-row">
          <span>True/False</span>
          <button class="switch ${cfg.trueFalse?'on':''}" onclick="toggleTestOpt('trueFalse', this)"><span class="knob"></span></button>
        </div>
        <div class="modal-row">
          <span>Multiple choice</span>
          <button class="switch ${cfg.multipleChoice?'on':''}" onclick="toggleTestOpt('multipleChoice', this)"><span class="knob"></span></button>
        </div>
        <div class="modal-row">
          <span>Matching</span>
          <button class="switch ${cfg.matching?'on':''}" onclick="toggleTestOpt('matching', this)"><span class="knob"></span></button>
        </div>
        <div class="modal-row">
          <span>Written</span>
          <button class="switch ${cfg.written?'on':''}" onclick="toggleTestOpt('written', this)"><span class="knob"></span></button>
        </div>

        <hr class="modal-sep">

        <div class="modal-row" style="cursor:pointer;" onclick="toggleTestSection('formatOpen')">
          <span>Question format</span>
          <span class="modal-row-link">View <span style="display:inline-block; transform:${session.formatOpen?'rotate(180deg)':'rotate(0)'};">▾</span></span>
        </div>
        ${session.formatOpen ? `
          <div class="modal-subpanel">
            <div class="modal-row">
              <span>Answer with</span>
              <select class="select-input" onchange="setTestOpt('answerWith', this.value)">
                <option value="definition" ${cfg.answerWith==='definition'?'selected':''}>Definition</option>
                <option value="term" ${cfg.answerWith==='term'?'selected':''}>Term</option>
              </select>
            </div>
            <div class="modal-row">
              <span>Show images with</span>
              <button class="switch ${cfg.showImages?'on':''}" onclick="toggleTestOpt('showImages', this)"><span class="knob"></span></button>
            </div>
          </div>
        ` : ''}

        <div class="modal-row" style="cursor:pointer;" onclick="toggleTestSection('gradingOpen')">
          <span>Grading options</span>
          <span class="modal-row-link">View <span style="display:inline-block; transform:${session.gradingOpen?'rotate(180deg)':'rotate(0)'};">▾</span></span>
        </div>
        ${session.gradingOpen ? `
          <div class="modal-subpanel">
            <div class="modal-row">
              <span>Grading strictness</span>
              <select class="select-input" onchange="setTestOpt('grading', this.value)">
                <option value="exact" ${cfg.grading==='exact'?'selected':''}>Exact match</option>
                <option value="lenient" ${cfg.grading==='lenient'?'selected':''}>Lenient (ignore case/typos)</option>
              </select>
            </div>
          </div>
        ` : ''}

        <div class="modal-actions">
          <button class="btn-primary" onclick="startTest()">Create new test</button>
        </div>

        <div class="modal-footer-row">
          <a class="modal-row-link" href="#" onclick="return false;">Privacy Policy</a>
          <button class="btn-ghost" onclick="go('detail')">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function toggleTestSection(key){
  session[key] = !session[key];
  renderTestSetup();
}

function setTestOpt(key, value){
  session.testConfig[key] = value;
}

function toggleTestOpt(key, btn){
  session.testConfig[key] = !session.testConfig[key];
  if(key === 'starredOnly'){
    renderTestSetup(); // re-render to update the max question count shown
    return;
  }
  btn.classList.toggle('on');
}

function startTest(){
  const s = getSet(currentSetId);
  const cfg = session.testConfig;
  const basePool = cfg.starredOnly ? s.terms.filter(t=>t.starred) : s.terms;
  if(basePool.length === 0){
    alert('No starred terms found. Turn off "Study only starred terms" or star some terms first.');
    return;
  }
  cfg.count = Math.max(1, Math.min(basePool.length, parseInt(document.getElementById('qCount').value)||basePool.length));

  const types = [];
  if(cfg.trueFalse) types.push('tf');
  if(cfg.multipleChoice) types.push('mc');
  if(cfg.matching) types.push('matching');
  if(cfg.written) types.push('written');
  if(types.length===0) types.push('mc');

  const chosenTerms = shuffle(basePool).slice(0, cfg.count);

  // Matching is handled as a single question block covering all chosen terms if selected
  const nonMatchingTypes = types.filter(t=>t!=='matching');
  const questions = [];

  if(types.includes('matching') && nonMatchingTypes.length===0){
    // Pure matching test: one matching question with all chosen terms (capped at 8 pairs for usability)
    const matchTerms = chosenTerms.slice(0, Math.min(8, chosenTerms.length));
    questions.push(buildMatchingQuestion(matchTerms, cfg));
  } else {
    chosenTerms.forEach(term=>{
      const pickFrom = nonMatchingTypes.length ? nonMatchingTypes : ['mc'];
      const type = pickFrom[Math.floor(Math.random()*pickFrom.length)];
      questions.push(buildTestQuestion(type, term, s, cfg));
    });
  }

  session.testQuestions = questions;
  go('test', session);
}

function buildTestQuestion(type, term, s, cfg){
  const answerWithTerm = cfg.answerWith === 'term';
  if(type==='tf'){
    const isTrue = Math.random() < 0.5;
    let shownDef = answerWithTerm ? term.term : term.definition;
    if(!isTrue){
      const others = s.terms.filter(t=>t.id!==term.id);
      if(others.length>0) shownDef = answerWithTerm ? others[Math.floor(Math.random()*others.length)].term : others[Math.floor(Math.random()*others.length)].definition;
      else shownDef = shownDef + ' (other)';
    }
    return { type:'tf', term, shownDef, correctAnswer: isTrue, userAnswer:null, answerWithTerm };
  } else if(type==='written'){
    return { type:'written', term, userAnswer:'', answerWithTerm };
  } else {
    const pool = s.terms.filter(t=>t.id!==term.id);
    const field = answerWithTerm ? 'term' : 'definition';
    const wrongs = shuffle(pool).slice(0, Math.min(3,pool.length)).map(t=>t[field]);
    const options = shuffle([term[field], ...wrongs]);
    return { type:'mc', term, options, userAnswer:null, answerWithTerm };
  }
}

function buildMatchingQuestion(terms, cfg){
  const left = terms.map(t=>({id:t.id, text:t.term}));
  const right = shuffle(terms.map(t=>({id:t.id, text:t.definition})));
  return { type:'matching', terms, left, right, matches:{}, selectedLeft:null };
}

function renderTest(){
  const s = getSet(currentSetId);
  const qs = session.testQuestions;

  const qHtml = qs.map((q,i)=>{
    let body='';
    if(q.type==='tf'){
      body = `
        <div style="margin-bottom:12px; color:var(--text-dim);">${q.answerWithTerm?'Term':'Definition'}: <strong style="color:var(--text);">${escapeHtml(q.shownDef)}</strong></div>
        <div class="tf-row">
          <div class="tf-choice ${q.userAnswer===true?'sel':''}" onclick="setTfAnswer(${i}, true)">True</div>
          <div class="tf-choice ${q.userAnswer===false?'sel':''}" onclick="setTfAnswer(${i}, false)">False</div>
        </div>
      `;
    } else if(q.type==='mc'){
      body = `<div class="choices">
        ${q.options.map((opt,oi)=>`
          <button class="choice ${q.userAnswer===opt?'sel':''}" style="${q.userAnswer===opt?'border-color:var(--accent);':''}" onclick="setMcAnswer(${i}, ${JSON.stringify(opt).replace(/"/g,'&quot;')})">
            <span class="idx">${oi+1}</span><span>${escapeHtml(opt||'(empty)')}</span>
          </button>
        `).join('')}
      </div>`;
    } else if(q.type==='matching'){
      body = renderMatchingBody(q, i);
    } else {
      body = `<input type="text" class="written-input" placeholder="Your answer" value="${escapeAttr(q.userAnswer)}" oninput="setWrittenAnswer(${i}, this.value)">`;
    }
    const qterm = q.type==='matching' ? 'Match each term to its definition' : (q.answerWithTerm ? q.term.definition : q.term.term);
    return `
      <div class="test-q">
        <div class="qn">${i+1} of ${qs.length}</div>
        <div class="qterm">${escapeHtml(qterm)}</div>
        ${body}
      </div>
    `;
  }).join('');

  root.innerHTML = `
    <div class="study-screen">
      <div class="study-top">
        <div class="left">Test</div>
        <div class="center"><span class="setname">${escapeHtml(s.title)}</span></div>
        <div class="right"><button class="icon-btn" onclick="go('detail')">✕</button></div>
      </div>
      <div class="study-body">
        <div class="study-inner">
          ${qHtml}
          <div style="text-align:center; margin-top:10px;">
            <button class="btn-primary" onclick="submitTest()">Submit</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMatchingBody(q, qi){
  return `
    <div class="matching-grid">
      <div class="matching-col">
        ${q.left.map(l=>`
          <button class="matching-item ${q.selectedLeft===l.id?'sel':''} ${q.matches[l.id]?'matched':''}"
            onclick="matchSelectLeft(${qi}, '${l.id}')" ${q.matches[l.id]?'disabled':''}>
            ${escapeHtml(l.text)}
          </button>
        `).join('')}
      </div>
      <div class="matching-col">
        ${q.right.map(r=>{
          const takenBy = Object.keys(q.matches).find(k=>q.matches[k]===r.id);
          return `
          <button class="matching-item ${takenBy?'matched':''}"
            onclick="matchSelectRight(${qi}, '${r.id}')" ${takenBy?'disabled':''}>
            ${escapeHtml(r.text)}
          </button>
        `;}).join('')}
      </div>
    </div>
  `;
}

function matchSelectLeft(qi, leftId){
  const q = session.testQuestions[qi];
  q.selectedLeft = leftId;
  renderTest();
}
function matchSelectRight(qi, rightId){
  const q = session.testQuestions[qi];
  if(!q.selectedLeft) return;
  q.matches[q.selectedLeft] = rightId;
  q.selectedLeft = null;
  renderTest();
}

function setTfAnswer(i, val){ session.testQuestions[i].userAnswer = val; renderTest(); }
function setMcAnswer(i, val){ session.testQuestions[i].userAnswer = val; renderTest(); }
function setWrittenAnswer(i, val){ session.testQuestions[i].userAnswer = val; }

function normalizeAnswer(str, lenient){
  let v = (str||'').trim().toLowerCase();
  if(lenient) v = v.replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
  return v;
}

function submitTest(){
  const qs = session.testQuestions;
  const cfg = session.testConfig || {};
  const lenient = cfg.grading === 'lenient';
  let correct = 0;
  let totalGraded = 0;
  qs.forEach(q=>{
    if(q.type==='matching'){
      let allCorrect = q.terms.length>0;
      q.terms.forEach(t=>{
        const isRight = q.matches[t.id] === t.id;
        if(!isRight) allCorrect = false;
        setTermMastery(currentSetId, t.id, isRight);
      });
      q.isCorrect = allCorrect;
      totalGraded += q.terms.length;
      correct += q.terms.filter(t=>q.matches[t.id]===t.id).length;
      return;
    }
    let isCorrect = false;
    if(q.type==='tf') isCorrect = (q.userAnswer===q.correctAnswer);
    else if(q.type==='mc') isCorrect = (q.userAnswer===(q.answerWithTerm?q.term.term:q.term.definition));
    else if(q.type==='written'){
      const target = q.answerWithTerm ? q.term.term : q.term.definition;
      isCorrect = normalizeAnswer(q.userAnswer, lenient) === normalizeAnswer(target, lenient) && normalizeAnswer(q.userAnswer,lenient).length>0;
    }
    q.isCorrect = isCorrect;
    totalGraded++;
    if(isCorrect) correct++;
    setTermMastery(currentSetId, q.term.id, isCorrect);
  });
  recordStudyActivity();
  go('results', {mode:'test', correct, total:totalGraded, questions:qs});
}