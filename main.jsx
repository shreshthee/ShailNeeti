const {useEffect,useMemo,useRef,useState} = React;

/* ---------------- constants & helpers ---------------- */
const TIME_PER_Q_MIN = 1.2; // 1.2 minutes per question
const timeForN = n => Math.round(n * TIME_PER_Q_MIN * 60); // seconds
const fmt = (s)=>{ const h=(s/3600)|0, m=((s%3600)/60)|0, sec=s%60;
  return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
             : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };
const shuffle = a => { const arr=a.slice(); for(let i=arr.length-1;i>0;i--){const j=(Math.random()*(i+1))|0; [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };
const pickN = (arr,n) => shuffle(arr).slice(0,n);

const LS_KEY = "shailneeti_history_v1";
const store = {
  get(){ try{return JSON.parse(localStorage.getItem(LS_KEY))||[]}catch{return[]}},
  set(v){ try{localStorage.setItem(LS_KEY,JSON.stringify(v))}catch{} }
};

/* ---------------- shared UI bits ---------------- */
const cardWrap = "relative rounded-3xl p-[1px] bg-gradient-to-br from-pink-200/70 via-rose-200/60 to-pink-200/70 shadow-lg shadow-rose-200/40";
const glassCard = "relative rounded-3xl p-6 bg-white/30 backdrop-blur-xl border border-white/40 overflow-visible-important";
const glassBtn = (extra="") => `ripple px-4 py-2 rounded-lg border border-white/40 bg-white/30 hover:bg-white/50
                                 text-gray-800 backdrop-blur-xl transition shadow-sm hover:shadow
                                 transform-gpu hover:scale-[1.03] active:scale-[0.99] ${extra}`;
const solidBtn = (extra="") => `ripple px-5 py-2 rounded-lg text-white shadow-md transform-gpu hover:scale-[1.03] active:scale-[0.99] ${extra}`;

/* ---------------- Background (Ganesh) ---------------- */
function Background() {
  return (
    <>
      {/* soft gradient base */}
      <div className="fixed inset-0 -z-20 bg-rose-50/20" />
      {/* Ganesh left — slightly stronger on desktop, softer on mobile */}
      <div className="pointer-events-none fixed left-2 top-1/2 -translate-y-1/2 -z-10
                      w-[42vmin] h-[58vmin] sm:w-[38vmin] sm:h-[52vmin]
                      bg-[url('./ganesh.png')] bg-no-repeat bg-contain bg-left
                      opacity-40 sm:opacity-35" />
    </>
  );
}

/* ---------------- TopBar ---------------- */
function TopBar({page,mode,timeLeft,onHome,onHistory,onAnalytics}) {
  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-extrabold text-gray-900">
          ShailNeeti <span className="font-semibold text-gray-500">— CUET PG Economics</span>
        </h1>
        <div className="flex items-center gap-2 md:gap-3 text-sm">
          {page==='home' && (
            <>
              <button onClick={onHistory} className={glassBtn()}>Review Past Results</button>
              <button onClick={onAnalytics} className={glassBtn()}>Analytics</button>
            </>
          )}
          {page==='quiz' && mode==='test' && (
            <span className={`px-2 py-1 rounded border ${timeLeft<=30?'border-red-500 text-red-600':'border-gray-300 text-gray-700'}`}>⏱ {fmt(timeLeft)}</span>
          )}
          {page!=='home' && <button onClick={onHome} className={glassBtn()}>Home</button>}
        </div>
      </div>
    </header>
  );
}

/* ---------------- Progress bar ---------------- */
const Progress = ({i,total}) => {
  const pct = total ? Math.round(((i+1)/total)*100) : 0;
  return (
    <div className="w-full bg-white/40 backdrop-blur h-2 rounded-full shadow-inner">
      <div className="bg-teal-500 h-2 rounded-full transition-all" style={{width:`${pct}%`}} />
    </div>
  );
};

/* ---------------- ChapterSelect (desktop custom + mobile native) ---------------- */
function ChapterSelect({ value, onChange, options }) {
  const [open,setOpen] = useState(false);
  const btnRef = useRef(null);

  useEffect(()=>{
    const onDoc=(e)=>{ if(!btnRef.current) return; if(!btnRef.current.contains(e.target)) setOpen(false); };
    const onKey=(e)=>{ if(e.key==='Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return ()=>{ document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  },[]);

  const isCoarse = typeof window!=='undefined' && window.matchMedia && window.matchMedia('(pointer:coarse)').matches;

  if (isCoarse) {
    return (
      <select value={value} onChange={(e)=>onChange(e.target.value)}
              className="w-full p-2 pr-9 border rounded-lg bg-white/70 backdrop-blur hover:bg-white transition">
        {options.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
      </select>
    );
  }

  const label = (options.find(o=>o.id===value)||options[0]||{}).title || '—';

  return (
    <div className="relative z-30">
      <button ref={btnRef} type="button" onClick={()=>setOpen(v=>!v)}
              className="w-full text-left p-2 pr-9 border rounded-lg bg-white/70 backdrop-blur hover:bg-white transition">
        {label}
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-auto rounded-xl bg-white shadow-2xl ring-1 ring-black/10 z-[999]">
          {options.map(opt=>(
            <div key={opt.id}
                 onClick={()=>{ onChange(opt.id); setOpen(false); }}
                 className={`px-3 py-2 cursor-pointer hover:bg-teal-50 ${opt.id===value?'bg-teal-100 text-teal-700 font-medium':''}`}>
              {opt.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- HomeView ---------------- */
function HomeView({
  chapters, chapterId, setChapterId,
  mode, setMode, testCount, setTestCount,
  onStartPractice, onStartTest, estSeconds
}) {
  return (
    <>
      <Background/>
      <main className="relative max-w-6xl mx-auto px-4 py-8">
        {/* Center title */}
        <div className="text-center mb-6">
          <div className="inline-block px-5 py-2 rounded-2xl bg-white/40 backdrop-blur border border-white/60 shadow">
            <div className="text-3xl md:text-4xl font-extrabold text-gray-900">ShailNeeti</div>
            <div className="text-sm md:text-base text-gray-600 -mt-1">MCQ Practice for CUET PG Economics</div>
          </div>
        </div>

        {/* Main card */}
        <section className={cardWrap}>
          <div className={glassCard}>
            <div className="pointer-events-none absolute -top-16 -left-16 w-72 h-72 bg-white/20 rounded-full blur-3xl"></div>

            <p className="text-gray-700">Practice chapter-wise Economics PYQs with instant feedback.</p>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm">Chapter Filter</label>
                <ChapterSelect
                  value={chapterId}
                  onChange={setChapterId}
                  options={[{id:'all',title:'All'}, ...chapters]}
                />
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
              <div className="mt-5 flex flex-col md:flex-row md:items-end gap-4">
                <div>
                  <label className="text-sm">No. of Questions</label>
                  <input type="number" min="1" value={testCount}
                         onChange={e=>setTestCount(e.target.value)}
                         className="w-36 p-2 border rounded-lg bg-white/60 backdrop-blur" />
                </div>
                <div className="md:ml-auto">
                  <label className="text-sm block">Time limit</label>
                  <div className="p-2 border rounded bg-white/60 backdrop-blur text-sm w-36 text-center">
                    {fmt(estSeconds)}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3 flex-wrap">
              {mode==='practice'
                ? <button onClick={onStartPractice} className={solidBtn("bg-teal-600 hover:bg-teal-700")}>Start Practice</button>
                : <button onClick={onStartTest} className={solidBtn("bg-teal-600 hover:bg-teal-700")}>Start Test</button>}
              <button onClick={()=>window.dispatchEvent(new CustomEvent('nav-history'))} className={glassBtn()}>Review Past Results</button>
              <button onClick={()=>window.dispatchEvent(new CustomEvent('nav-analytics'))} className={glassBtn()}>Analytics</button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

/* ---------------- QuizView ---------------- */
function QuizView({
  mode, activeSet, current, setCurrent,
  answers, setAnswers, marked, setMarked, skipped, setSkipped,
  remaining, onSubmit
}) {
  const total = activeSet.length;
  const q = activeSet[current];

  const attemptedCount = useMemo(
    ()=>Object.keys(answers).filter(k=>answers[k]!=null).length,
    [answers]
  );
  const unattempted = Math.max(0, total - attemptedCount);

  if (!q) return null;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <div className="grid lg:grid-cols-[1fr,280px] gap-6">
        <div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">Question {current+1} of {total}</div>
            <div className="w-1/2"><Progress i={current} total={total}/></div>
          </div>

          <section className={cardWrap}>
            <div className={`${glassCard} animate-slide`}>
              <div className="pointer-events-none absolute -top-16 -left-16 w-72 h-72 bg-white/20 rounded-full blur-3xl"></div>

              <div className="flex items-start justify-between">
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wide text-gray-700">Chapter</div>
                  <div className="mb-3 text-base font-medium">{q.chapter || '—'}</div>
                </div>
                <div className="text-xs px-2 py-1 rounded border bg-white/50 backdrop-blur">
                  Attempted: <b>{attemptedCount}</b> • Unattempted: <b>{unattempted}</b>
                </div>
              </div>

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
                  <button onClick={()=>{
                            if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true}));
                            setCurrent(c=>Math.max(0,c-1));
                          }}
                          disabled={current===0}
                          className={glassBtn("disabled:opacity-50")}>Previous</button>

                  <button onClick={()=>setAnswers(p=>{const c={...p}; delete c[current]; return c;})}
                          className={glassBtn()}>Clear Response</button>

                  <button onClick={()=>setMarked(p=>({...p,[current]:!p[current]}))}
                          className={glassBtn(marked[current]
                              ? (answers[current] ? "bg-blue-500/80 text-white border-blue-300 hover:bg-blue-600/80"
                                                  : "bg-violet-500/80 text-white border-violet-300 hover:bg-violet-600/80")
                              : "")}>
                    {marked[current] ? 'Unmark Review' : 'Mark for Review'}
                  </button>
                </div>

                <div className="flex-1" />
                <div className="flex items-center gap-4">
                  {current < total-1 ? (
                    <button onClick={()=>{
                              if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true}));
                              setCurrent(c=>c+1);
                            }}
                            className={solidBtn("bg-teal-600 hover:bg-teal-700")}>Next</button>
                  ) : (
                    <button onClick={()=>{
                              if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true}));
                              onSubmit();
                            }}
                            className={solidBtn("bg-green-600 hover:bg-green-700")}>Submit</button>
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
                const answered = answers[i]!=null, isMarked=!!marked[i], isSkipped=!!skipped[i];
                const s = answered && isMarked ? 'attempted_marked' : !answered && isMarked ? 'marked_only' : !answered && isSkipped ? 'skipped' : answered ? 'attempted' : 'unattempted';
                const base="w-8 h-8 rounded-md flex items-center justify-center text-sm border shadow-sm transition-all duration-200 transform hover:scale-105 hover:shadow-md";
                const ring=(i===current)?" ring-2 ring-teal-500":"";
                const color = s==='attempted_marked' ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                             : s==='marked_only'     ? "bg-violet-500 text-white border-violet-600 hover:bg-violet-600"
                             : s==='skipped'         ? "bg-red-500 text-white border-red-600 hover:bg-red-600"
                             : s==='attempted'       ? "bg-[#32CD32] text-white border-green-600 hover:brightness-95"
                                                     : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100 hover:text-teal-600";
                return <button key={i} onClick={()=>{
                          if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true}));
                          setCurrent(i);
                        }} className={`${base} ${color} ${ring}`}>{i+1}</button>;
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white border border-gray-300"></span> Unattempted</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-[#32CD32] border border-green-600"></span> Attempted</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-violet-500 border border-violet-600"></span> Marked (no answer)</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500 border border-blue-600"></span> Attempted + Marked</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500 border border-red-600"></span> Skipped</div>
            </div>
            <div className="mt-4">
              <button onClick={onSubmit} className={solidBtn("w-full bg-green-600 hover:bg-green-700")}>Submit Test</button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ---------------- ResultView ---------------- */
function ResultView({activeSet,answers,score,onHome}) {
  const total = activeSet.length;
  const pct = total? Math.round(score/total*100) : 0;

  return (
    <>
      <Background/>
      <main className="relative max-w-6xl mx-auto px-4 py-8">
        <section className={cardWrap}>
          <div className={glassCard}>
            <div className="pointer-events-none absolute -top-16 -left-16 w-72 h-72 bg-white/20 rounded-full blur-3xl"></div>
            <h2 className="text-xl font-semibold">Result</h2>
            <p className="mt-1">Score : {score}/{total} ({pct}%)</p>
            {pct>=80 && <p className="text-sm text-teal-700 mt-1">Great job! 🎉</p>}

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
              <button onClick={onHome} className={glassBtn()}>Home</button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

/* ---------------- HistoryView ---------------- */
function HistoryView({onHome}) {
  const [sortBy, setSortBy] = useState('date_desc');
  const h = store.get();
  const sorted = [...h].sort((a,b)=>{
    if (sortBy==='date_desc') return new Date(b.timestamp)-new Date(a.timestamp);
    if (sortBy==='date_asc')  return new Date(a.timestamp)-new Date(b.timestamp);
    if (sortBy==='score_desc')return (b.percent||0)-(a.percent||0);
    if (sortBy==='score_asc') return (a.percent||0)-(b.percent||0);
    return 0;
  });

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
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
      <div className="mt-6">
        <button onClick={onHome} className={glassBtn()}>Home</button>
      </div>
    </main>
  );
}

/* ---------------- AnalyticsView ---------------- */
function AnalyticsView({onHome}) {
  const hist = store.get();
  const agg = {};
  hist.forEach(at => at.questions.forEach((q,i)=>{
    const ch=q.chapter||'Unknown'; if(!agg[ch]) agg[ch]={correct:0,total:0};
    agg[ch].total++; if(at.answers[i]===q.answer) agg[ch].correct++;
  }));
  const rows = Object.entries(agg).map(([ch,{correct,total}])=>({ch,correct,total,pct: total?Math.round(correct/total*100):0}))
                                  .sort((a,b)=>a.ch.localeCompare(b.ch));

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
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
      <div className="mt-6">
        <button onClick={onHome} className={glassBtn()}>Home</button>
      </div>
    </main>
  );
}

/* ---------------- App (no hooks inside conditionals) ---------------- */
function App(){
  /* global state (always same order) */
  const [page, setPage]           = useState('home');     // home | quiz | result | history | analytics
  const [mode, setMode]           = useState('practice'); // practice | test
  const [chapters, setChapters]   = useState([]);         // from questions-index.json (optional)
  const [chapterId, setChapterId] = useState('all');

  const [questions, setQuestions] = useState([]);         // full pool (if you use single file)
  const [activeSet, setActiveSet] = useState([]);
  const [current, setCurrent]     = useState(0);
  const [answers, setAnswers]     = useState({});
  const [marked, setMarked]       = useState({});
  const [skipped, setSkipped]     = useState({});

  const [testCount, setTestCount] = useState(10);
  const [remaining, setRemaining] = useState(0);
  const timer = useRef(null);

  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');

  // Navigation events from Home buttons (so we don’t pass too many props up)
  useEffect(()=>{
    const toHist = ()=>setPage('history');
    const toAna  = ()=>setPage('analytics');
    window.addEventListener('nav-history', toHist);
    window.addEventListener('nav-analytics', toAna);
    return ()=>{ window.removeEventListener('nav-history', toHist); window.removeEventListener('nav-analytics', toAna); };
  },[]);

  // Load single questions.json (fastest path). You can switch later to per-chapter files.
  useEffect(()=>{
    fetch('questions.json?v='+Date.now())
      .then(r=>{ if(!r.ok) throw new Error('bad'); return r.json(); })
      .then(d=>{
        const list = Array.isArray(d)? d : Array.isArray(d?.questions)? d.questions : [];
        setQuestions(list);
        // Build chapters list from data
        const ch = [...new Set(list.map(q=>q.chapter).filter(Boolean))]
                    .map(t=>({id:t, title:t}));
        setChapters(ch);
      })
      .catch(()=>setErr('Could not load questions.json'))
      .finally(()=>setLoading(false));
  },[]);

  const stopTimer = ()=>{ if(timer.current){ clearInterval(timer.current); timer.current=null; } };
  const startTimer = (sec)=>{ stopTimer(); setRemaining(sec);
    timer.current=setInterval(()=>setRemaining(p=>{ if(p<=1){ clearInterval(timer.current); setPage('result'); return 0; } return p-1; }),1000);
  };

  const resetRun = ()=>{ setCurrent(0); setAnswers({}); setMarked({}); setSkipped({}); };

  // Derived
  const filteredPool = useMemo(()=>{
    if (chapterId==='all') return questions;
    return questions.filter(q=>q.chapter===chapterId);
  }, [questions, chapterId]);

  const estSeconds = useMemo(()=>{
    const req = Math.max(1, parseInt(testCount || 1, 10));
    const n   = Math.max(1, Math.min(req, filteredPool.length || 1));
    return timeForN(n);
  }, [testCount, filteredPool]);

  const score = useMemo(()=>activeSet.reduce((s,q,i)=>s+(answers[i]===q.answer?1:0),0),[answers,activeSet]);

  // Persist on result
  useEffect(()=>{
    if (page!=='result' || activeSet.length===0) return;
    const entry = {
      id:'attempt_'+Date.now(), timestamp:new Date().toISOString(),
      mode, chapter: chapterId, total: activeSet.length, score,
      percent: activeSet.length ? Math.round(score/activeSet.length*100) : 0,
      durationSec: mode==='test'? timeForN(activeSet.length) : null,
      answers: Array.from({length:activeSet.length},(_,i)=>answers[i]??null),
      questions: activeSet.map(q=>({chapter:q.chapter, question:q.question, options:q.options, answer:q.answer, source:q.source??null}))
    };
    const h=store.get(); h.unshift(entry); store.set(h.slice(0,50));
  },[page,activeSet,mode,chapterId,score,answers]);

  // Actions
  const onStartPractice = ()=>{
    const s = filteredPool;
    setActiveSet(s); resetRun(); stopTimer(); setPage('quiz');
  };
  const onStartTest = ()=>{
    const req = Math.max(1, parseInt(testCount||1,10));
    const n   = Math.max(1, Math.min(req, filteredPool.length||1));
    const s   = pickN(filteredPool, n);
    setActiveSet(s); resetRun(); startTimer(timeForN(n)); setPage('quiz');
  };

  // RENDER
  return (
    <>
      <TopBar page={page} mode={mode} timeLeft={remaining}
              onHome={()=>{stopTimer(); setPage('home');}}
              onHistory={()=>setPage('history')}
              onAnalytics={()=>setPage('analytics')} />

      {loading && <main className="max-w-6xl mx-auto px-4 py-10 text-center text-gray-500">Loading questions…</main>}
      {!loading && err && <main className="max-w-6xl mx-auto px-4 py-10 text-center text-red-600">{err}</main>}

      {!loading && !err && page==='home' && (
        <HomeView
          chapters={chapters}
          chapterId={chapterId} setChapterId={setChapterId}
          mode={mode} setMode={setMode}
          testCount={testCount} setTestCount={setTestCount}
          onStartPractice={onStartPractice}
          onStartTest={onStartTest}
          estSeconds={estSeconds}
        />
      )}

      {!loading && !err && page==='quiz' && (
        <QuizView
          mode={mode}
          activeSet={activeSet}
          current={current} setCurrent={setCurrent}
          answers={answers} setAnswers={setAnswers}
          marked={marked} setMarked={setMarked}
          skipped={skipped} setSkipped={setSkipped}
          remaining={remaining}
          onSubmit={()=>{ stopTimer(); setPage('result'); }}
        />
      )}

      {!loading && !err && page==='result' && (
        <ResultView
          activeSet={activeSet}
          answers={answers}
          score={score}
          onHome={()=>setPage('home')}
        />
      )}

      {!loading && !err && page==='history' && <HistoryView onHome={()=>setPage('home')} />}
      {!loading && !err && page==='analytics' && <AnalyticsView onHome={()=>setPage('home')} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);