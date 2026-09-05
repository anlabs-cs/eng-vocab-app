/* =========================================================
   TEST MODE
========================================================= */
function renderTestSetup(){
  const s = getSet(currentSetId);
  const max = s.terms.length;
  if(!session.testConfig){
    session.testConfig = {
      count: Math.min(20, max),
      trueFalse: false,
      multipleChoice: true,
      written: false
    };
  }
  const cfg = session.testConfig;

  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal" style="position:relative;">
        <button class="modal-close" onclick="go('detail')">✕</button>
        <div style="display:flex; align-items:center; gap:14px; margin-bottom:6px;">
          <div class="brand-badge"></div>
          <div>
            <div style="color:var(--text-dim); font-size:13px;">${escapeHtml(s.title)}</div>
            <h2 style="margin:0;">Thiết lập bài kiểm tra</h2>
          </div>
        </div>

        <div class="modal-row">
          <span>Số câu hỏi (tối đa ${max})</span>
          <input type="number" class="num-input" id="qCount" min="1" max="${max}" value="${cfg.count}">
        </div>

        <div class="modal-row">
          <span>Trắc nghiệm Đúng/Sai</span>
          <button class="switch ${cfg.trueFalse?'on':''}" onclick="toggleTestOpt('trueFalse', this)"><span class="knob"></span></button>
        </div>
        <div class="modal-row">
          <span>Trắc nghiệm nhiều lựa chọn</span>
          <button class="switch ${cfg.multipleChoice?'on':''}" onclick="toggleTestOpt('multipleChoice', this)"><span class="knob"></span></button>
        </div>
        <div class="modal-row">
          <span>Tự luận (viết đáp án)</span>
          <button class="switch ${cfg.written?'on':''}" onclick="toggleTestOpt('written', this)"><span class="knob"></span></button>
        </div>

        <div class="modal-actions">
          <button class="btn-ghost" onclick="go('detail')">Hủy</button>
          <button class="btn-primary" onclick="startTest()">Bắt đầu kiểm tra</button>
        </div>
      </div>
    </div>
  `;
}

function toggleTestOpt(key, btn){
  session.testConfig[key] = !session.testConfig[key];
  btn.classList.toggle('on');
}

function startTest(){
  const s = getSet(currentSetId);
  const cfg = session.testConfig;
  cfg.count = Math.max(1, Math.min(s.terms.length, parseInt(document.getElementById('qCount').value)||s.terms.length));

  const types = [];
  if(cfg.trueFalse) types.push('tf');
  if(cfg.multipleChoice) types.push('mc');
  if(cfg.written) types.push('written');
  if(types.length===0) types.push('mc');

  const chosenTerms = shuffle(s.terms).slice(0, cfg.count);
  const questions = chosenTerms.map(term=>{
    const type = types[Math.floor(Math.random()*types.length)];
    if(type==='tf'){
      const isTrue = Math.random() < 0.5;
      let shownDef = term.definition;
      if(!isTrue){
        const others = s.terms.filter(t=>t.id!==term.id);
        if(others.length>0) shownDef = others[Math.floor(Math.random()*others.length)].definition;
        else shownDef = term.definition + ' (khác)';
      }
      return { type:'tf', term, shownDef, correctAnswer: isTrue, userAnswer:null };
    } else if(type==='written'){
      return { type:'written', term, userAnswer:'' };
    } else {
      const pool = s.terms.filter(t=>t.id!==term.id);
      const wrongs = shuffle(pool).slice(0, Math.min(3,pool.length)).map(t=>t.definition);
      const options = shuffle([term.definition, ...wrongs]);
      return { type:'mc', term, options, userAnswer:null };
    }
  });

  session.testQuestions = questions;
  go('test', session);
}

function renderTest(){
  const s = getSet(currentSetId);
  const qs = session.testQuestions;

  const qHtml = qs.map((q,i)=>{
    let body='';
    if(q.type==='tf'){
      body = `
        <div style="margin-bottom:12px; color:var(--text-dim);">Definition: <strong style="color:var(--text);">${escapeHtml(q.shownDef)}</strong></div>
        <div class="tf-row">
          <div class="tf-choice ${q.userAnswer===true?'sel':''}" onclick="setTfAnswer(${i}, true)">True</div>
          <div class="tf-choice ${q.userAnswer===false?'sel':''}" onclick="setTfAnswer(${i}, false)">False</div>
        </div>
      `;
    } else if(q.type==='mc'){
      body = `<div class="choices">
        ${q.options.map((opt,oi)=>`
          <button class="choice ${q.userAnswer===opt?'sel':''}" style="${q.userAnswer===opt?'border-color:var(--accent);':''}" onclick="setMcAnswer(${i}, ${JSON.stringify(opt).replace(/"/g,'&quot;')})">
            <span class="idx">${oi+1}</span><span>${escapeHtml(opt||'(trống)')}</span>
          </button>
        `).join('')}
      </div>`;
    } else {
      body = `<input type="text" class="written-input" placeholder="Your answer" value="${escapeAttr(q.userAnswer)}" oninput="setWrittenAnswer(${i}, this.value)">`;
    }
    return `
      <div class="test-q">
        <div class="qn">${i+1} of ${qs.length}</div>
        <div class="qterm">${escapeHtml(q.term.term)}</div>
        ${body}
      </div>
    `;
  }).join('');

  root.innerHTML = `
    <div class="study-screen">
      <div class="study-top">
        <div class="left">📝 Test</div>
        <div class="center"><span class="setname">${escapeHtml(s.title)}</span></div>
        <div class="right"><button class="icon-btn" onclick="go('detail')">✕</button></div>
      </div>
      <div class="study-body">
        <div class="study-inner">
          ${qHtml}
          <div style="text-align:center; margin-top:10px;">
            <button class="btn-primary" onclick="submitTest()">Nộp bài</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function setTfAnswer(i, val){ session.testQuestions[i].userAnswer = val; renderTest(); }
function setMcAnswer(i, val){ session.testQuestions[i].userAnswer = val; renderTest(); }
function setWrittenAnswer(i, val){ session.testQuestions[i].userAnswer = val; }

function submitTest(){
  const qs = session.testQuestions;
  let correct = 0;
  qs.forEach(q=>{
    let isCorrect = false;
    if(q.type==='tf') isCorrect = (q.userAnswer===q.correctAnswer);
    else if(q.type==='mc') isCorrect = (q.userAnswer===q.term.definition);
    else if(q.type==='written') isCorrect = (q.userAnswer||'').trim().toLowerCase() === (q.term.definition||'').trim().toLowerCase();
    q.isCorrect = isCorrect;
    if(isCorrect) correct++;
    setTermMastery(currentSetId, q.term.id, isCorrect);
  });
  recordStudyActivity();
  go('results', {mode:'test', correct, total:qs.length, questions:qs});
}
