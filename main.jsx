/* ===================== ShailNeeti - main.jsx (final merged) ===================== */
const { useEffect, useMemo, useRef, useState } = React;

/* ----------------- LocalStorage helpers ----------------- */
const LS_KEY = "shailneeti_history_v1";
const store = {
  get() { try { return JSON.parse(localStorage.getItem(LS_KEY)) ?? []; } catch { return []; } },
  set(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {} }
};

/* ----------------- Time helpers (rule: 1.2 min per Q) ----------------- */
const TIME_PER_Q_MIN = 1.2;
const timeForN = (n) => Math.round(n * TIME_PER_Q_MIN * 60);
const fmt = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

/* ----------------- Small utils ----------------- */
const shuffle = (arr) => { const a = arr.slice(); for (let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]];} return a; };
const pickN = (arr, n) => shuffle(arr).slice(0, n);

/* ----------------- Background (Ganesh left, responsive) ----------------- */
const Background = () => (
  <>
    <div className="fixed inset-0 -z-10 bg-gradient-to-b from-rose-50/60 to-teal-50/60" />
    <div className="pointer-events-none fixed left-0 top-1/2 -translate-y-1/2
                    w-[44vmin] h-[58vmin] sm:w-[40vmin] sm:h-[52vmin]
                    bg-[url('./ganesh.png')] bg-no-repeat bg-contain opacity-45" />
  </>
);

/* ----------------- UI helpers ----------------- */
const glassCard = "relative overflow-hidden rounded-3xl p-6 bg-white/40 backdrop-blur-xl border border-white/60 shadow-lg";
const cardWrap  = "relative rounded-3xl p-[1px] bg-gradient-to-br from-rose-200 via-red-100 to-rose-200 shadow-md";
const glassBtn  = (extra="") => `px-4 py-2 rounded-lg border border-white/60 bg-white/40 hover:bg-white/60
                                text-gray-800 backdrop-blur-md transition-all shadow-sm hover:shadow-md
                                hover:scale-[1.03] active:scale-[0.98] ${extra}`;
const solidBtn  = (extra="") => `px-5 py-2 rounded-lg text-white shadow-md hover:shadow-lg transform-gpu
                                hover:scale-[1.03] active:scale-[0.97] ${extra}`;

/* ----------------- Confetti (on high score) ----------------- */
const Confetti = ({ on }) => {
  useEffect(() => {
    if (!on) return;
    const c = document.createElement('canvas'); c.style.position='fixed'; c.style.inset='0'; c.style.pointerEvents='none'; c.style.zIndex=9999;
    document.body.appendChild(c);
    const ctx=c.getContext('2d'); const resize=()=>{c.width=innerWidth; c.height=innerHeight;}; resize(); addEventListener('resize',resize);
    const colors=["#14b8a6","#f43f5e","#60a5fa","#a78bfa","#22c55e","#f59e0b"];
    const N=Math.min(240, ((c.width+c.height)/6)|0); const G=0.12, D=0.985, cx=c.width/2, cy=c.height*0.15;
    const p=Array.from({length:N}).map(()=>{const ang=Math.random()*Math.PI-Math.PI/2, sp=6+Math.random()*8;
      return {x:cx+(Math.random()*80-40), y:cy+(Math.random()*20-10), vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp-2,
              s:2+Math.random()*4, r:Math.random()*Math.PI*2, vr:(Math.random()-0.5)*0.2, col:colors[(Math.random()*colors.length)|0], life:0, ttl:250+Math.random()*100};});
    let raf=0, frame=0;
    const tick=()=>{frame++; ctx.clearRect(0,0,c.width,c.height);
      p.forEach(o=>{o.vx*=D; o.vy=o.vy*D+G; o.x+=o.vx; o.y+=o.vy; o.r+=o.vr; o.life++;
        const a=Math.max(0,1-o.life/o.ttl); ctx.globalAlpha=a; ctx.save(); ctx.translate(o.x,o.y); ctx.rotate(o.r);
        ctx.fillStyle=o.col; ctx.fillRect(-o.s,-o.s*0.5,o.s*2,o.s); ctx.restore(); ctx.globalAlpha=1;});
      if(frame<600) raf=requestAnimationFrame(tick); else cleanup(); };
    const cleanup=()=>{cancelAnimationFrame(raf); removeEventListener('resize',resize); c.remove();};
    raf=requestAnimationFrame(tick); return cleanup;
  },[on]);
  return null;
};

/* ----------------- TopBar ----------------- */
const TopBar = ({ onHome, onHistory, onAnalytics, page, mode, timeLeft }) => (
  <header className="sticky top-0 z-10 backdrop-blur-md bg-white/70 border-b border-white/50 shadow-sm">
    <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <h1 className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-teal-600">
        ShailNeeti <span className="font-semibold text-gray-600">— CUET PG Economics</span>
      </h1>
      <div className="flex items-center gap-3 text-sm">
        {page==='home' && (
          <>
            <button onClick={onHistory}   className={glassBtn()}>📘 Review Past Results</button>
            <button onClick={onAnalytics} className={glassBtn()}>📊 Analytics</button>
          </>
        )}
        {page==='quiz' && mode==='test' && (
          <span className={`px-2 py-1 rounded border ${timeLeft<=30?'border-red-500 text-red-600':'border-gray-400 text-gray-700'}`}>⏱ {fmt(timeLeft)}</span>
        )}
        {page!=='home' && <button onClick={onHome} className={glassBtn()}>🏠 Home</button>}
      </div>
    </div>
  </header>
);

/* ----------------- Progress ----------------- */
const Progress = ({ i, total }) => {
  const pct = total ? Math.round(((i+1)/total)*100) : 0;
  return (
    <div className="w-full bg-white/50 backdrop-blur h-2 rounded-full shadow-inner">
      <div className="bg-teal-500 h-2 rounded-full transition-all" style={{width:`${pct}%`}} />
    </div>
  );
};

/* ----------------- FancySelect (auto flips + scroll; not clipped) ----------------- */
function FancySelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState('bottom'); // 'bottom' | 'top'
  const btnRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!btnRef.current || !listRef.current) return;
      if (!btnRef.current.contains(e.target) && !listRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); }
  }, []);

  const toggle = () => {
    if (!btnRef.current) { setOpen(v=>!v); return; }
    const r = btnRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const menuH = 240;
    setPlacement(below >= menuH ? 'bottom' : 'top');
    setOpen(v=>!v);
  };

  return (
    <div className="relative">
      <button ref={btnRef} type="button" onClick={toggle}
              className="w-full text-left p-2 pr-9 border rounded-lg bg-white/70 backdrop-blur hover:bg-white/90 transition">
        {value}
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">▾</span>
      </button>

      {open && (
        <ul ref={listRef}
            className={`absolute left-0 right-0 max-h-60 overflow-y-auto overscroll-contain rounded-xl border bg-white/95 backdrop-blur-xl shadow-xl
                        ${placement==='bottom' ? 'mt-2 top-full' : 'mb-2 bottom-full'} z-30`}
            style={{scrollbarWidth:"thin"}}
            role="listbox">
          {options.map(opt => (
            <li key={opt} role="option" aria-selected={opt===value}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`px-3 py-2 cursor-pointer hover:bg-teal-50 ${opt===value?'bg-teal-100 text-teal-700 font-medium':''}`}>
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ====================================================================== */
const App = () => {
  /* ---- global state ---- */
  const [page, setPage] = useState('home');           // home | quiz | result | history | analytics
  const [mode, setMode] = useState('practice');       // practice | test
  const [questions, setQuestions] = useState([]);
  const [activeSet, setActiveSet] = useState([]);
  const [chapter, setChapter] = useState('All');
  const [testCount, setTestCount] = useState(10);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState({});
  const [skipped, setSkipped] = useState({});

  const [remaining, setRemaining] = useState(0);
  const timer = useRef(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');

  /* ---- load questions ---- */
  useEffect(() => {
    fetch('questions.json?v=' + Date.now())
      .then(r => { if(!r.ok) throw new Error('bad'); return r.json(); })
      .then(d => Array.isArray(d) ? setQuestions(d) : setQuestions(d?.questions ?? []))
      .catch(()=> setErr('Could not load questions.json'))
      .finally(()=> setLoading(false));
  }, []);

  /* ---- derived ---- */
  const total = activeSet.length;
  const attemptedCount = useMemo(()=>Object.keys(answers).filter(k=>answers[k]!=null).length,[answers]);
  const unattemptedCount = Math.max(0,total-attemptedCount);
  const score = useMemo(()=>activeSet.reduce((s,q,i)=>s+(answers[i]===q.answer?1:0),0),[answers,activeSet]);

  /* ---- timer ---- */
  const stopTimer = ()=>{ if (timer.current){ clearInterval(timer.current); timer.current=null; } };
  const startTimer = (sec)=>{ stopTimer(); setRemaining(sec);
    timer.current=setInterval(()=>{ setRemaining(p=>{ if(p<=1){ clearInterval(timer.current); setPage('result'); return 0; } return p-1; }); }, 1000);
  };

  /* ---- navigation helpers ---- */
  const resetRun = ()=>{ setCurrent(0); setAnswers({}); setMarked({}); setSkipped({}); };
  const startPractice = ()=>{ const s = chapter==='All'?questions:questions.filter(q=>q.chapter===chapter); setActiveSet(s); resetRun(); stopTimer(); setPage('quiz'); };

  const startTest = ()=>{ 
    const pool = chapter==='All'?questions:questions.filter(q=>q.chapter===chapter);
    const requestedN = Math.max(1, parseInt(testCount || 1, 10));
    const n = Math.max(1, Math.min(requestedN, pool.length));
    const s = pickN(pool, n);
    setActiveSet(s); resetRun(); startTimer(timeForN(n)); setPage('quiz'); 
  };

  const statusOf = (i) => {
    const answered = answers[i]!=null; const isMarked = !!marked[i]; const isSkipped = !!skipped[i];
    if (answered && isMarked) return 'attempted_marked';
    if (!answered && isMarked) return 'marked_only';
    if (!answered && isSkipped) return 'skipped';
    if (answered) return 'attempted';
    return 'unattempted';
  };

  /* ---- persist to history on result ---- */
  useEffect(() => {
    if (page !== 'result' || !total) return;
    const entry = {
      id: 'attempt_' + Date.now(),
      timestamp: new Date().toISOString(),
      mode, chapter, total, score,
      percent: total ? Math.round((score/total)*100) : 0,
      durationSec: mode==='test' ? timeForN(total) : null,
      answers: Array.from({length: total}, (_,i)=>answers[i] ?? null),
      questions: activeSet.map(q=>({chapter:q.chapter, question:q.question, options:q.options, answer:q.answer, source:q.source ?? null}))
    };
    const h = store.get(); h.unshift(entry); store.set(h.slice(0,50));
  }, [page, total, score, answers, activeSet, mode, chapter]);

  /* ----------------- RENDER ----------------- */
  if (loading) {
    return (<>
      <TopBar page={page} mode={mode} timeLeft={remaining} onHome={()=>setPage('home')} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
      <main className="max-w-6xl mx-auto px-4 py-10 text-center text-gray-500">Loading questions…</main>
    </>);
  }
  if (err) {
    return (<>
      <TopBar page={page} mode={mode} timeLeft={remaining} onHome={()=>setPage('home')} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
      <main className="max-w-6xl mx-auto px-4 py-10 text-center text-red-600">{err}</main>
    </>);
  }

  /* ---- HOME ---- */
  if (page==='home') {
    const chapterList = ['All',...new Set(questions.map(q=>q.chapter).filter(Boolean))];
    const filteredCount = chapter==='All'?questions.length:questions.filter(q=>q.chapter===chapter).length;
    const requestedN = Math.max(1, parseInt(testCount || 1, 10));
    const effectiveN = Math.min(requestedN, filteredCount || 1);
    const est = timeForN(effectiveN);

    return (
      <>
        <TopBar page={page} mode={mode} timeLeft={remaining}
                onHome={()=>setPage('home')} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
        <Background/>
        <main className="relative max-w-6xl mx-auto px-4 py-10">
          {/* Big headline block */}
          <div className="text-center mb-6">
            <div className="text-4xl md:text-5xl font-extrabold text-gray-900">ShailNeeti</div>
            <div className="text-base md:text-lg text-gray-600 mt-1">MCQ Practice – CUET PG Economics</div>
          </div>

          <section className={cardWrap}>
            <div className={glassCard}>
              <div className="pointer-events-none absolute -top-16 -left-16 w-72 h-72 bg-white/30 rounded-full blur-3xl"></div>
              <p className="text-gray-700">Practice chapter-wise Economics PYQs with instant feedback.</p>

              <div className="mt-6 grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm">Chapter Filter</label>
                  <FancySelect value={chapter} onChange={setChapter} options={chapterList} />
                </div>
                <div>
                  <label className="text-sm">Mode</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={mode==='practice'} onChange={()=>setMode('practice')} /> Practice
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={mode==='test'} onChange={()=>setMode('test')} /> Test
                    </label>
                  </div>
                </div>
              </div>

              {mode==='test' && (
                <div className="mt-5 flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
                  <div>
                    <label className="text-sm">No. of Questions</label>
                    <input
                      type="number"
                      min="1"
                      max={filteredCount}
                      value={testCount}
                      onChange={e=>setTestCount(e.target.value)}
                      className="w-28 p-2 border rounded-lg bg-white/60 backdrop-blur"
                    />
                    <p className="text-xs text-gray-700 mt-1">
                      Available: {filteredCount}
                      {requestedN > filteredCount && (
                        <span className="ml-2 text-rose-600 font-medium">
                          (Requested {requestedN}, using {effectiveN})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="md:ml-auto">
                    <label className="text-sm block">Time Limit</label>
                    <div className="p-2 border rounded bg-white/60 backdrop-blur text-sm w-32 text-center">
                      {fmt(est)}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-3 flex-wrap">
                {mode==='practice' ? (
                  <button
                    onClick={startPractice}
                    className={solidBtn("bg-teal-600 hover:bg-teal-700")}
                  >
                    Start Practice
                  </button>
                ) : (
                  <button
                    onClick={startTest}
                    className={solidBtn("bg-teal-600 hover:bg-teal-700")}
                  >
                    Start Test
                  </button>
                )}
                <button onClick={()=>setPage('history')} className={glassBtn()}>Review Past Results</button>
                <button onClick={()=>setPage('analytics')} className={glassBtn()}>Analytics</button>
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  /* ---- QUIZ ---- */
  if (page==='quiz') {
    const q = activeSet[current]; if (!q) return null;

    return (
      <>
        <TopBar page={page} mode={mode} timeLeft={remaining}
                onHome={()=>{ stopTimer(); setPage('home'); }} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-[1fr,280px] gap-6">
            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="text-sm text-gray-600">Question {current+1} of {total}</div>
                <div className="w-1/2"><Progress i={current} total={total}/></div>
              </div>

              <section className={cardWrap}>
                <div className={`${glassCard} animate-[slide_.35s_ease_both]`}>
                  <div className="pointer-events-none absolute -top-16 -left-16 w-72 h-72 bg-white/20 rounded-full blur-3xl"></div>

                  {/* counters on right */}
                  <div className="absolute right-4 top-4 text-right text-[13px] text-gray-700 leading-tight">
                    <div>Attempted: <b>{attemptedCount}</b></div>
                    <div className="mt-1">Unattempted: <b>{unattemptedCount}</b></div>
                  </div>

                  <div className="mb-2 text-xs uppercase tracking-wide text-gray-700">Chapter</div>
                  <div className="mb-4 text-base font-medium">{q.chapter || '—'}</div>

                  <h3 className="text-lg font-semibold leading-relaxed">{q.question}</h3>
                  {q.source && <div className="mt-1 text-xs text-gray-700">Source: {q.source}</div>}

                  <div className="mt-5 grid gap-3">
                    {q.options.map((opt, idx) => {
                      const active = answers[current] === opt;
                      return (
                        <label key={idx}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition
                                      bg-white/50 backdrop-blur hover:bg-white/70
                                      ${active?'border-teal-500 ring-1 ring-teal-300':'border-white/50'}`}>
                          <input type="radio" name={`q-${current}`} className="accent-teal-500"
                                 checked={active}
                                 onChange={()=>{ 
                                   setAnswers(p=>({...p,[current]:opt}));
                                   setSkipped(p=>{const c={...p}; delete c[current]; return c;}); 
                                 }} />
                          <span className="font-medium">{String.fromCharCode(65+idx)}.</span>
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); setCurrent(c=>Math.max(0,c-1)); }} disabled={current===0} className={glassBtn("disabled:opacity-50")}>Previous</button>
                      <button onClick={()=>setAnswers(p=>{const c={...p}; delete c[current]; return c;})} className={glassBtn()}>Clear Response</button>
                      <button onClick={()=>setMarked(p=>({...p,[current]:!p[current]}))}
                              className={glassBtn(
                                answers[current]
                                  ? (marked[current] ? " bg-blue-500/80 text-white border-blue-300 hover:bg-blue-600/80" : "")
                                  : (marked[current] ? " bg-violet-500/80 text-white border-violet-300 hover:bg-violet-600/80" : "")
                              )}>
                        {marked[current] ? 'Unmark Review' : 'Mark for Review'}
                      </button>
                    </div>

                    <div className="flex-1" />
                    <div className="flex items-center gap-4">
                      {current < total-1 ? (
                        <button onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); setCurrent(c=>c+1); }} className={solidBtn("bg-teal-600 hover:bg-teal-700")}>Next</button>
                      ) : (
                        <button onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); stopTimer(); setPage('result'); }} className={solidBtn("bg-green-600 hover:bg-green-700")}>Submit</button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Palette */}
            <aside className="lg:sticky lg:top-[72px]">
              <div className="rounded-2xl p-4 bg-white/70 backdrop-blur border border-white/60 shadow">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Question Palette</h4>
                  {mode==='test' && <span className={`text-xs px-2 py-1 rounded border ${remaining<=30?'border-red-500 text-red-600':'border-gray-300 text-gray-700'}`}>⏱ {fmt(remaining)}</span>}
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {activeSet.map((_,i)=>{
                    const s = statusOf(i);
                    const base="w-8 h-8 rounded-md flex items-center justify-center text-sm border shadow-sm transition-all duration-200 transform hover:scale-105 hover:shadow-md";
                    const ring=(i===current)?" ring-2 ring-teal-500":"";
                    const color = s==='attempted_marked' ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                                 : s==='marked_only'     ? "bg-violet-500 text-white border-violet-600 hover:bg-violet-600"
                                 : s==='skipped'         ? "bg-red-500 text-white border-red-600 hover:bg-red-600"
                                 : s==='attempted'       ? "bg-[#32CD32] text-white border-green-600 hover:brightness-95"
                                                         : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100 hover:text-teal-600";
                    return <button key={i} onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); setCurrent(i); }} className={`${base} ${color} ${ring}`}>{i+1}</button>;
                  })}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white border border-gray-300"></span> Unattempted</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-[#32CD32] border border-green-600"></span> Attempted</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-violet-500 border border-violet-600"></span> Marked (no answer)</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500 border-blue-600"></span> Attempted + Marked</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500 border-red-600"></span> Skipped</div>
                </div>

                <div className="mt-4">
                  <button onClick={()=>{ stopTimer(); setPage('result'); }} className={solidBtn("w-full bg-green-600 hover:bg-green-700")}>Submit Test</button>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </>
    );
  }

  /* ---- RESULT ---- */
  if (page==='result') {
    const percent = total?Math.round(score/total*100):0;
    return (
      <>
        <Confetti on={percent>=80}/>
        <TopBar page={page} mode={mode} timeLeft={remaining}
                onHome={()=>setPage('home')} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
        <Background/>
        <main className="relative max-w-6xl mx-auto px-4 py-8">
          <section className={cardWrap}>
            <div className={glassCard}>
              <div className="pointer-events-none absolute -top-16 -left-16 w-72 h-72 bg-white/20 rounded-full blur-3xl"></div>
              <h2 className="text-xl font-semibold">Result</h2>
              <p className="mt-1">Score : {score}/{total} ({percent}%)</p>
              {percent>=80 && <p className="text-sm text-teal-700 mt-1">Great job! 🎉</p>}

              <div className="space-y-3 mt-4">
                {activeSet.map((qq,i)=>{
                  const sel=answers[i]; const ok=sel===qq.answer;
                  return (
                    <div key={i} className="p-3 border rounded bg-white/60 backdrop-blur">
                      <div className="flex justify-between">
                        <b>Q{i+1}. {qq.question}</b>
                        <span className={`text-xs px-2 py-1 rounded ${ok?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{ok?'Correct':'Incorrect'}</span>
                      </div>
                      <p className="text-sm mt-1">Your: {sel||'Not answered'} | Correct: <b className="text-green-700">{qq.answer}</b></p>
                      {qq.explanation && <p className="text-sm text-gray-700 mt-1">{qq.explanation}</p>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <button onClick={()=>setPage('home')} className={glassBtn()}>Home</button>
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  /* ---- HISTORY ---- */
  if (page==='history') {
    const h = store.get();
    const sorted = [...h].sort((a,b)=>{
      if (sortBy==='date_desc') return new Date(b.timestamp) - new Date(a.timestamp);
      if (sortBy==='date_asc')  return new Date(a.timestamp) - new Date(b.timestamp);
      if (sortBy==='score_desc') return (b.percent||0) - (a.percent||0);
      if (sortBy==='score_asc')  return (a.percent||0) - (b.percent||0);
      return 0;
    });

    return (
      <>
        <TopBar page={page} mode={mode} timeLeft={remaining}
                onHome={()=>setPage('home')} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <section className={cardWrap}>
            <div className={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Past Results</h2>
                <select className="border rounded px-2 py-1 bg-white/70 backdrop-blur" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                  <option value="date_desc">Newest first</option>
                  <option value="date_asc">Oldest first</option>
                  <option value="score_desc">Score high → low</option>
                  <option value="score_asc">Score low → high</option>
                </select>
              </div>

              {sorted.length===0 ? (
                <div className="text-gray-500">No attempts yet.</div>
              ) : (
                <div className="space-y-4">
                  {sorted.map(a=>(
                    <details key={a.id} className="rounded-xl border bg-white/70 backdrop-blur p-4">
                      <summary className="cursor-pointer flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{new Date(a.timestamp).toLocaleString()} • {a.mode} • {a.chapter}</div>
                          <div className="text-sm text-gray-700">Score: {a.score}/{a.total} ({a.percent}%) {a.durationSec?`• Time: ${fmt(a.durationSec)}`:''}</div>
                        </div>
                      </summary>
                      <div className="mt-3 space-y-2">
                        {a.questions.map((q,i)=>{
                          const your=a.answers[i]; const ok=your===q.answer;
                          return (
                            <div key={i} className="p-3 border rounded bg-white/60">
                              <div className="flex justify-between">
                                <b>Q{i+1}. {q.question}</b>
                                <span className={`text-xs px-2 py-1 rounded ${ok?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{ok?'Correct':'Incorrect'}</span>
                              </div>
                              <div className="text-sm text-gray-700">Chapter: {q.chapter || '—'} • Source: {q.source || '—'}</div>
                              <div className="text-sm">Your: {your || 'Not answered'} • Correct: <b className="text-green-700">{q.answer}</b></div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </>
    );
  }

  /* ---- ANALYTICS ---- */
  if (page==='analytics') {
    const hist = store.get();
    const agg = {};
    hist.forEach(at => at.questions.forEach((q,i)=>{
      const ch=q.chapter||'Unknown'; if(!agg[ch]) agg[ch]={correct:0,total:0};
      agg[ch].total++; if(at.answers[i]===q.answer) agg[ch].correct++;
    }));
    const rows = Object.entries(agg).map(([ch,{correct,total}])=>({ch,correct,total,pct: total?Math.round(correct/total*100):0}))
                                   .sort((a,b)=>a.ch.localeCompare(b.ch));

    return (
      <>
        <TopBar page={page} mode={mode} timeLeft={remaining}
                onHome={()=>setPage('home')} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <section className={cardWrap}>
            <div className={glassCard}>
              <h2 className="text-xl font-semibold mb-4">Chapter-wise Analytics</h2>
              {rows.length===0 ? <div className="text-gray-500">No data yet.</div> : (
                <div className="space-y-3">
                  {rows.map(r=>(
                    <div key={r.ch} className="p-3 border rounded-xl bg-white/70 backdrop-blur">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{r.ch}</div>
                        <div className="text-sm text-gray-700">{r.correct}/{r.total} correct • {r.pct}%</div>
                      </div>
                      <div className="mt-2 h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500" style={{width:`${r.pct}%`}}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </>
    );
  }

  return null;
};
/* ====================================================================== */

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
