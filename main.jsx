const {useEffect,useMemo,useRef,useState} = React;

/* ---------------- storage ---------------- */
const LS_HISTORY = 'sn_history_v1';
const store = {
  get(){ try{ return JSON.parse(localStorage.getItem(LS_HISTORY))||[] }catch{ return [] } },
  set(v){ try{ localStorage.setItem(LS_HISTORY, JSON.stringify(v)) }catch{} }
};

/* ---------------- time helpers ---------------- */
const PER_Q_MIN = 1.2;
const secsFor = n => Math.round(n * PER_Q_MIN * 60);
const fmt = s => {
  const h=(s/3600)|0,m=((s%3600)/60)|0,sec=(s%60)|0;
  return h?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
          :`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

/* ---------------- util ---------------- */
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a};
const pickN=(arr,n)=>shuffle(arr).slice(0,n);

/* ---------------- UI helpers ---------------- */
const Btn = ({className='',children,...p}) =>
  <button {...p} className={`glass-btn ripple px-4 py-2 rounded-md text-gray-800 ${className}`} >{children}</button>;

const Solid = ({className='',children,...p}) =>
  <button {...p} className={`px-5 py-2 rounded-md text-white bg-teal-600 hover:bg-teal-700 ripple`}>{children}</button>;

/* ---------------- Top bar ---------------- */
const TopBar = ({onHome,onHistory,onAnalytics}) => (
  <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
    <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <h1 className="font-semibold">
        <span className="font-extrabold text-gray-900">ShailNeeti</span>
        <span className="text-gray-500"> — CUET PG Economics</span>
      </h1>
      <div className="flex gap-2 text-sm">
        <Btn onClick={onHistory}>Review Past Results</Btn>
        <Btn onClick={onAnalytics}>Analytics</Btn>
        <Btn onClick={onHome}>Home</Btn>
      </div>
    </div>
  </header>
);

/* ---------------- App ---------------- */
const App = ()=>{
  const [page,setPage] = useState('home');   // home | quiz | result | history | analytics
  const [chapters,setChapters] = useState([]);
  const [chapter,setChapter] = useState('');
  const [mode,setMode] = useState('practice');
  const [count,setCount] = useState(10);

  const [loading,setLoading] = useState(true);
  const [err,setErr] = useState('');

  const [active,setActive] = useState([]);      // questions in current run
  const [current,setCurrent] = useState(0);
  const [answers,setAnswers] = useState({});
  const [marked,setMarked] = useState({});
  const [skipped,setSkipped] = useState({});

  const [remaining,setRemaining] = useState(0);
  const timer = useRef(null);

  /* ---- load index only (fast) ---- */
  useEffect(()=>{
    fetch('questions-index.json?v='+Date.now())
      .then(r=>r.json()).then(d=>{
        setChapters(d.chapters||[]);
        setChapter(d.chapters?.[0]?.id || '');
      })
      .catch(()=>setErr('Could not load questions.json'))
      .finally(()=>setLoading(false));
  },[]);

  /* ---- derived ---- */
  const total = active.length;
  const attempted = useMemo(()=>Object.keys(answers).filter(k=>answers[k]!=null).length,[answers]);
  const unattempted = Math.max(0,total-attempted);
  const score = useMemo(()=>active.reduce((s,q,i)=>s+(answers[i]===q.answer?1:0),0),[answers,active]);

  const stop = ()=>{ if(timer.current){ clearInterval(timer.current); timer.current=null; } };
  const start = sec => { stop(); setRemaining(sec); timer.current=setInterval(()=>setRemaining(p=>p<=1?(stop(),setPage('result'),0):p-1),1000) };

  const resetRun = ()=>{ setCurrent(0); setAnswers({}); setMarked({}); setSkipped({}); };

  /* ---- chapter loader (lazy) ---- */
  async function loadChapterItems(chId){
    const ch = chapters.find(c=>c.id===chId);
    if(!ch) return [];
    const url = `questions/${ch.file}?v=${Date.now()}`;
    const d = await fetch(url).then(r=>r.json());
    return Array.isArray(d)?d:(d.questions||[]);
  }

  async function startPractice(){
    const items = await loadChapterItems(chapter);
    setActive(items); resetRun(); stop(); setPage('quiz');
  }
  async function startTest(){
    const items = await loadChapterItems(chapter);
    const req = Math.max(1, parseInt(count||1,10));
    const n = Math.max(1, Math.min(req, items.length));
    const set = pickN(items, n);
    setActive(set); resetRun(); start(secsFor(n)); setPage('quiz');
  }

  /* ---- persist history at result ---- */
  useEffect(()=>{
    if(page!=='result'||!total) return;
    const ch = chapters.find(c=>c.id===chapter)?.name || chapter;
    const h = store.get();
    h.unshift({
      id:'attempt_'+Date.now(),
      timestamp:new Date().toISOString(),
      mode, chapter: ch, total, score,
      percent: total?Math.round(score/total*100):0,
      durationSec: mode==='test'?secsFor(total):null,
      answers: Array.from({length: total},(_,i)=>answers[i]??null),
      questions: active.map(q=>({chapter:q.chapter,question:q.question,options:q.options,answer:q.answer,source:q.source||null}))
    });
    store.set(h.slice(0,60));
  },[page]);

  /* ---------------- Renders ---------------- */
  if (loading) return (
    <>
      <TopBar onHome={()=>setPage('home')} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
      <div className="max-w-6xl mx-auto px-4 py-10 text-gray-500">Loading…</div>
    </>
  );
  if (err) return (
    <>
      <TopBar onHome={()=>setPage('home')} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
      <div className="max-w-6xl mx-auto px-4 py-10 text-red-600">{err}</div>
    </>
  );

  /* ---- HOME ---- */
  if(page==='home'){
    const currentChapterName = chapters.find(c=>c.id===chapter)?.name || '—';
    const est = fmt(secsFor(Math.max(1, parseInt(count||1,10))));

    return (
      <>
        <TopBar
          onHome={()=>setPage('home')}
          onHistory={()=>setPage('history')}
          onAnalytics={()=>setPage('analytics')}
        />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center mb-4">
            <div className="text-3xl font-extrabold text-rose-400">ShailNeeti</div>
            <img src="ganesh.png" alt="Ganesh" className="mx-auto mt-2 h-24 opacity-60" />
          </div>

          <section className="glass-card p-6">
            <h2 className="text-xl md:text-2xl font-bold">MCQ Practice for CUET PG Economics</h2>
            <p className="text-gray-600">Practice chapter-wise Economics PYQs with instant feedback.</p>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-sm">Chapter Filter</label>
                <select value={chapter} onChange={e=>setChapter(e.target.value)}
                        className="w-full mt-1 p-2 rounded-md border bg-white">
                  {chapters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">Mode</label>
                <div className="flex items-center gap-6 mt-1">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode==='practice'} onChange={()=>setMode('practice')} /> Practice
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode==='test'} onChange={()=>setMode('test')} /> Test
                  </label>
                </div>
              </div>
            </div>

            {/* Number ↔ Time limit */}
            {mode==='test' && (
              <div className="grid md:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-sm">No. of Questions</label>
                  <input type="number" min="1" value={count}
                         onChange={e=>setCount(e.target.value)}
                         className="w-40 p-2 rounded-md border bg-white"/>
                </div>
                <div className="md:ml-auto">
                  <label className="text-sm block">Time limit</label>
                  <div className="w-40 p-2 rounded-md border bg-white text-center">{est}</div>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {mode==='practice'
                ? <Solid onClick={startPractice}>Start Practice</Solid>
                : <Solid onClick={startTest}>Start Test</Solid>
              }
              <Btn onClick={()=>setPage('history')}>Review Past Results</Btn>
              <Btn onClick={()=>setPage('analytics')}>Analytics</Btn>
            </div>
          </section>
        </main>
      </>
    );
  }

  /* ---- QUIZ ---- */
  if(page==='quiz'){
    const q = active[current];

    const setAns = opt => {
      setAnswers(p=>({...p,[current]:opt}));
      setSkipped(p=>{ const m={...p}; delete m[current]; return m;});
    };
    const toggleMark = () => setMarked(p=>({...p,[current]:!p[current]}));

    const statusClass = (i)=>{
      const answered = answers[i]!=null; const m = !!marked[i]; const s = !!skipped[i];
      if(answered && m) return 'bg-blue-500 text-white';
      if(!answered && m) return 'bg-violet-500 text-white';
      if(!answered && s) return 'bg-red-500 text-white';
      if(answered) return 'bg-emerald-500 text-white';
      return 'bg-white text-gray-800 border';
    };

    return (
      <>
        <TopBar
          onHome={()=>{stop();setPage('home')}}
          onHistory={()=>setPage('history')}
          onAnalytics={()=>setPage('analytics')}
        />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-[1fr,280px] gap-6">

            {/* left: question */}
            <section className="glass-card p-5 relative overflow-hidden">
              <img src="ganesh.png" className="absolute -top-10 left-1/2 -translate-x-1/2 h-14 opacity-40" />
              <div className="absolute right-3 top-3 text-xs bg-white/70 backdrop-blur px-2 py-1 rounded border">
                Attempted: <b>{attempted}</b> • Unattempted: <b>{unattempted}</b>
              </div>

              <div className="mb-2 text-xs text-gray-600 uppercase">Chapter</div>
              <div className="font-medium mb-2">{q?.chapter||'—'}</div>

              <h3 className="text-lg font-semibold leading-relaxed">{q?.question}</h3>
              {q?.source && <div className="text-xs text-gray-600">Source: {q.source}</div>}

              <div className="mt-4 space-y-3 animate-[slide_.25s_ease]">
                {q?.options?.map((opt,idx)=>{
                  const active = answers[current]===opt;
                  return (
                    <label key={idx}
                           className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer bg-white hover:bg-slate-50 ${active?'ring-1 ring-teal-300 border-teal-400':''}`}>
                      <input type="radio" name={`q-${current}`} className="accent-teal-600"
                             checked={active} onChange={()=>setAns(opt)} />
                      <span className="font-medium">{String.fromCharCode(65+idx)}.</span>
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Btn onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); setCurrent(c=>Math.max(0,c-1));}}>Previous</Btn>
                <Btn onClick={()=>setAnswers(p=>{const m={...p}; delete m[current]; return m;})}>Clear Response</Btn>
                <Btn
                  onClick={toggleMark}
                  className={`${answers[current] ? (marked[current]?'text-white bg-blue-500 border-blue-500':'') : (marked[current]?'text-white bg-violet-500 border-violet-500':'')}`}
                >
                  {marked[current]?'Unmark Review':'Mark for Review'}
                </Btn>

                <div className="flex-1"></div>
                {current<active.length-1
                  ? <Solid onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); setCurrent(c=>c+1);}}>Next</Solid>
                  : <Solid className="bg-emerald-600 hover:bg-emerald-700" onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); stop(); setPage('result');}}>Submit</Solid>
                }
              </div>
            </section>

            {/* right: palette */}
            <aside className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Question Palette</h4>
                {mode==='test' && <span className={`text-xs px-2 py-1 rounded border ${remaining<=30?'border-red-500 text-red-600':'border-gray-300 text-gray-700'}`}>⏱ {fmt(remaining)}</span>}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {active.map((_,i)=>{
                  const cls = statusClass(i);
                  const ring = i===current?' ring-2 ring-teal-500':'';
                  return (
                    <button key={i} onClick={()=>setCurrent(i)}
                      className={`ripple w-8 h-8 rounded-md text-sm flex items-center justify-center ${cls} ${ring}`}>
                      {i+1}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white border"></span> Unattempted</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500"></span> Attempted</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-violet-500"></span> Marked (no answer)</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500"></span> Attempted + Marked</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500"></span> Skipped</div>
              </div>
              <div className="mt-4">
                <Solid className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={()=>{stop();setPage('result')}}>Submit Test</Solid>
              </div>
            </aside>
          </div>
        </main>
      </>
    );
  }

  /* ---- RESULT ---- */
  if(page==='result'){
    const percent = total?Math.round(score/total*100):0;
    return (
      <>
        <TopBar onHome={()=>setPage('home')} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold">Result</h2>
            <p>Score: {score}/{total} ({percent}%)</p>
            <div className="mt-3 space-y-2">
              {active.map((qq,i)=>{
                const ok = answers[i]===qq.answer;
                return (
                  <div key={i} className="p-3 rounded-md border bg-white">
                    <div className="flex justify-between">
                      <b>Q{i+1}. {qq.question}</b>
                      <span className={`text-xs px-2 py-1 rounded ${ok?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{ok?'Correct':'Incorrect'}</span>
                    </div>
                    <div className="text-sm">Your: {answers[i]||'Not answered'} • Correct: <b>{qq.answer}</b></div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3"><Btn onClick={()=>setPage('home')}>Home</Btn></div>
          </section>
        </main>
      </>
    )
  }

  /* ---- HISTORY ---- */
  if(page==='history'){
    const [sortBy,setSortBy] = useState('date_desc');
    const h = store.get();
    const sorted = [...h].sort((a,b)=>{
      if (sortBy==='date_desc') return new Date(b.timestamp)-new Date(a.timestamp);
      if (sortBy==='date_asc') return new Date(a.timestamp)-new Date(b.timestamp);
      if (sortBy==='score_desc') return (b.percent||0)-(a.percent||0);
      if (sortBy==='score_asc') return (a.percent||0)-(b.percent||0);
      return 0;
    });
    return (
      <>
        <TopBar onHome={()=>setPage('home')} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Past Results</h2>
            <select className="border rounded px-2 py-1" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="score_desc">Score high → low</option>
              <option value="score_asc">Score low → high</option>
            </select>
          </div>
          {sorted.length===0 ? <div className="text-gray-500">No attempts yet.</div> : (
            <div className="space-y-3">
              {sorted.map(a=>(
                <details key={a.id} className="glass-card p-4">
                  <summary className="cursor-pointer flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{new Date(a.timestamp).toLocaleString()} • {a.mode} • {a.chapter}</div>
                      <div className="text-sm text-gray-600">Score {a.score}/{a.total} ({a.percent}%) {a.durationSec?`• Time: ${fmt(a.durationSec)}`:''}</div>
                    </div>
                  </summary>
                  <div className="mt-2 space-y-1">
                    {a.questions.map((q,i)=>{
                      const your = a.answers[i]; const ok = your===q.answer;
                      return (
                        <div key={i} className="p-2 border rounded bg-white">
                          <div className="flex justify-between">
                            <b>Q{i+1}. {q.question}</b>
                            <span className={`text-xs px-2 py-1 rounded ${ok?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{ok?'Correct':'Incorrect'}</span>
                          </div>
                          <div className="text-sm text-gray-600">Chapter: {q.chapter||'—'} • Source: {q.source||'—'}</div>
                          <div className="text-sm">Your: {your||'Not answered'} • Correct: <b>{q.answer}</b></div>
                        </div>
                      )
                    })}
                  </div>
                </details>
              ))}
            </div>
          )}
        </main>
      </>
    )
  }

  /* ---- ANALYTICS ---- */
  if(page==='analytics'){
    const hist = store.get();
    const agg = {};
    hist.forEach(at => at.questions.forEach((q,i)=>{
      const ch = q.chapter||'Unknown'; if(!agg[ch]) agg[ch]={correct:0,total:0};
      agg[ch].total++; if(at.answers[i]===q.answer) agg[ch].correct++;
    }));
    const rows = Object.entries(agg)
      .map(([ch,{correct,total}])=>({ch,correct,total,pct: total?Math.round(correct/total*100):0}))
      .sort((a,b)=>a.ch.localeCompare(b.ch));

    return (
      <>
        <TopBar onHome={()=>setPage('home')} onHistory={()=>setPage('history')} onAnalytics={()=>setPage('analytics')} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <h2 className="text-xl font-semibold mb-3">Chapter-wise Analytics</h2>
          {rows.length===0 ? <div className="text-gray-500">No data yet.</div> : (
            <div className="space-y-3">
              {rows.map(r=>(
                <div key={r.ch} className="glass-card p-3">
                  <div className="flex justify-between">
                    <div className="font-semibold">{r.ch}</div>
                    <div className="text-sm text-gray-700">{r.correct}/{r.total} • {r.pct}%</div>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-teal-500" style={{width:`${r.pct}%`}} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </>
    );
  }

  return null;
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);