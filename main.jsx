/* ================= ShailNeeti main.jsx (fast, polished) ================== */
const {useEffect, useMemo, useRef, useState} = React;

/* -------- Timer rule -------- */
const TIME_PER_Q_MIN = 1.2;
const timeForN = n => Math.round(n * TIME_PER_Q_MIN * 60);
const fmt = s => {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
             : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

/* -------- Storage -------- */
const LS = "shailneeti_results_v1";
const store = {
  get(){ try{return JSON.parse(localStorage.getItem(LS))||[];}catch{return[];} },
  set(v){ try{localStorage.setItem(LS,JSON.stringify(v));}catch{} }
};

/* -------- Utils -------- */
const shuffle = a=>{const x=a.slice(); for(let i=x.length-1;i>0;i--){const j=(Math.random()*(i+1))|0; [x[i],x[j]]=[x[j],x[i]];} return x;};
const pickN = (a,n)=>shuffle(a).slice(0,n);
const fetchJson = async p => { const r=await fetch(`${p}?v=${Date.now()}`); if(!r.ok) throw new Error(p); return r.json(); };

/* -------- FancySelect (auto flip + scroll, no clipping) -------- */
function FancySelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState('bottom');
  const btnRef = useRef(null); const listRef = useRef(null);

  useEffect(()=>{
    const close = e => {
      if(!btnRef.current || !listRef.current) return;
      if(!btnRef.current.contains(e.target) && !listRef.current.contains(e.target)) setOpen(false);
    };
    const esc = e=>{ if(e.key==='Escape') setOpen(false); };
    document.addEventListener('mousedown',close);
    document.addEventListener('keydown',esc);
    return ()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',esc);};
  },[]);

  const toggle = ()=>{
    const r = btnRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const needs = 240; // px
    setPlace(below >= needs ? 'bottom':'top');
    setOpen(o=>!o);
  };

  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggle}
              className="w-full text-left p-2 pr-8 rounded-lg border glass hover:shadow"
              aria-haspopup="listbox" aria-expanded={open}>
        {value}<span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">▾</span>
      </button>

      {open && (
        <ul ref={listRef} role="listbox"
            className={`absolute z-20 left-0 right-0 rounded-xl border bg-white/95 backdrop-blur shadow-xl max-h-60 overflow-auto ${place==='bottom'?'mt-2 top-full':'mb-2 bottom-full'}`}>
          {options.map(opt=>(
            <li key={opt} role="option" aria-selected={opt===value}
                className={`px-3 py-2 cursor-pointer hover:bg-teal-50 ${opt===value?'bg-teal-100 text-teal-700 font-medium':''}`}
                onClick={()=>{onChange(opt); setOpen(false);}}>
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------- Ripple helper for palette -------- */
function ripple(e){
  const host = e.currentTarget;
  const r = document.createElement('span');
  const rect = host.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = e.clientX - rect.left - size/2;
  const y = e.clientY - rect.top - size/2;
  r.className='r';
  r.style.width=r.style.height=size+'px';
  r.style.left=x+'px'; r.style.top=y+'px';
  r.style.animation='ripple .6s ease-out';
  host.appendChild(r);
  r.addEventListener('animationend',()=>r.remove(),{once:true});
}

/* ============================ APP =================================== */
function App(){
  const [page,setPage] = useState('home');    // home | quiz | result | history | analytics
  const [mode,setMode] = useState('practice');
  const [chapters,setChapters] = useState([]); // from questions-index.json
  const [chapter,setChapter] = useState('');   // selected title
  const [questions,setQuestions] = useState([]); // loaded (selected)
  const [active,setActive] = useState([]);
  const [testCount,setTestCount] = useState(10);

  const [current,setCurrent] = useState(0);
  const [answers,setAnswers] = useState({});
  const [marked,setMarked] = useState({});
  const [skipped,setSkipped] = useState({});

  const [remaining,setRemaining] = useState(0);
  const timer = useRef(null);

  const [loading,setLoading] = useState(true);
  const [err,setErr] = useState('');

  /* ---- boot: load index, then default to first chapter (fast) ---- */
  useEffect(()=>{
    (async()=>{
      try{
        const idx = await fetchJson('./questions-index.json');
        setChapters(idx);
        const first = idx?.[0]?.title || 'All';
        setChapter(first);
        if(idx?.[0]) {
          const q = await fetchJson(`./questions/${idx[0].file}`);
          setQuestions(q);
        } else {
          setQuestions([]);
        }
      }catch(e){
        setErr('Could not load questions-index.json');
      }finally{
        setLoading(false);
      }
    })();
  },[]);

  /* ---- change chapter ---- */
  async function handleChapterChange(newChapter){
    setChapter(newChapter);
    setLoading(true);
    try{
      if(newChapter === 'All'){
        // Lazy-load ALL files only when requested
        const idx = chapters || [];
        const list = await Promise.allSettled(idx.map(c=>fetchJson(`./questions/${c.file}`)));
        const merged = [];
        list.forEach(p=>{ if(p.status==='fulfilled' && Array.isArray(p.value)) merged.push(...p.value); });
        setQuestions(merged);
      }else{
        const found = chapters.find(c=>c.title===newChapter || c.id===newChapter);
        if(!found) throw new Error('Chapter not found');
        setQuestions(await fetchJson(`./questions/${found.file}`));
      }
      setErr('');
    }catch(e){
      console.error(e);
      setErr('Could not load selected chapter file');
    }finally{
      setLoading(false);
    }
  }

  const total = active.length;
  const attempted = useMemo(()=>Object.keys(answers).filter(k=>answers[k]!=null).length,[answers,total]);
  const unattempted = Math.max(0, total - attempted);
  const score = useMemo(()=>active.reduce((s,q,i)=>s+(answers[i]===q.answer?1:0),0),[answers,active]);

  const stopTimer = ()=>{ if(timer.current){ clearInterval(timer.current); timer.current=null; } };
  const startTimer = sec => {
    stopTimer(); setRemaining(sec);
    timer.current = setInterval(()=>{
      setRemaining(p=>{
        if(p<=1){ clearInterval(timer.current); setPage('result'); return 0; }
        return p-1;
      });
    }, 1000);
  };

  function resetRun(){ setCurrent(0); setAnswers({}); setMarked({}); setSkipped({}); }
  function startPractice(){ setActive(questions); resetRun(); stopTimer(); setPage('quiz'); }
  function startTest(){
    const n = Math.max(1, Math.min(parseInt(testCount||1,10), questions.length));
    setActive(pickN(questions, n));
    resetRun(); startTimer(timeForN(n)); setPage('quiz');
  }

  /* ---- save attempt ---- */
  useEffect(()=>{
    if(page!=='result' || !total) return;
    const entry = {
      id:'attempt_'+Date.now(), timestamp:new Date().toISOString(),
      mode, chapter, total, score, percent: total?Math.round(score/total*100):0,
      durationSec: mode==='test'? timeForN(total): null,
      answers: Array.from({length:total},(_,i)=>answers[i]??null),
      questions: active.map(q=>({chapter:q.chapter,question:q.question,options:q.options,answer:q.answer,source:q.source??null}))
    };
    const h=store.get(); h.unshift(entry); store.set(h.slice(0,50));
  },[page]);

  /* ---------------- RENDER ---------------- */
  const TopBarBtns = () => (
    <div className="flex sm:hidden gap-2 px-4 py-2 sticky top-[52px] bg-white/80 backdrop-blur z-10 border-b">
      <button className="glassBtn px-3 py-2 rounded-lg" onClick={()=>setPage('history')}>Review Past Results</button>
      <button className="glassBtn px-3 py-2 rounded-lg" onClick={()=>setPage('analytics')}>Analytics</button>
      <button className="glassBtn px-3 py-2 rounded-lg" onClick={()=>setPage('home')}>Home</button>
    </div>
  );

  if(loading) return <main className="text-center text-gray-600 py-10">Loading…</main>;
  if(err) return <main className="text-center text-red-600 py-10">{err}</main>;

  /* ---- HOME ---- */
  if(page==='home'){
    const titles = ['All', ...chapters.map(c=>c.title)];
    const filteredCount = questions.length;
    const req = Math.max(1, parseInt(testCount || 1, 10));
    const eff = Math.min(req, filteredCount || 1);
    const est = timeForN(eff);

    return (
      <>
        <TopBarBtns/>
        <section className="liquid rounded-3xl p-5 md:p-6 shadow-glass border animate-slideIn glassCard">
          <h2 className="text-xl md:text-2xl font-extrabold">MCQ Practice for CUET PG Economics</h2>
          <p className="text-gray-600 mt-1">Practice chapter-wise Economics PYQs with instant feedback.</p>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm">Chapter Filter</label>
              <FancySelect value={chapter||titles[0]} onChange={handleChapterChange} options={titles}/>
            </div>
            <div>
              <label className="text-sm">Mode</label>
              <div className="flex gap-5 mt-2">
                <label className="flex items-center gap-2"><input type="radio" checked={mode==='practice'} onChange={()=>setMode('practice')}/> Practice</label>
                <label className="flex items-center gap-2"><input type="radio" checked={mode==='test'} onChange={()=>setMode('test')}/> Test</label>
              </div>
            </div>
          </div>

          {mode==='test' && (
            <div className="grid sm:grid-cols-2 gap-4 mt-4 items-end">
              <div>
                <label className="text-sm">No. of Questions</label>
                <input type="number" min="1" max={filteredCount} value={testCount}
                       onChange={e=>setTestCount(e.target.value)}
                       className="w-40 p-2 rounded-lg border glass hover:shadow"/>
                <div className="text-xs text-gray-600 mt-1">Available: {filteredCount}</div>
              </div>
              <div className="sm:justify-self-end">
                <label className="text-sm block">Time limit</label>
                <div className="glass inline-block px-3 py-2 rounded-lg border text-sm">{fmt(est)}</div>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {mode==='practice'
              ? <button className="px-4 py-2 rounded-lg text-white bg-teal-600 hover:brightness-95 transition" onClick={startPractice}>Start Practice</button>
              : <button className="px-4 py-2 rounded-lg text-white bg-teal-600 hover:brightness-95 transition" onClick={startTest}>Start Test</button>}
            <button className="glassBtn px-4 py-2 rounded-lg hover:shadow" onClick={()=>setPage('history')}>Review Past Results</button>
            <button className="glassBtn px-4 py-2 rounded-lg hover:shadow" onClick={()=>setPage('analytics')}>Analytics</button>
          </div>
        </section>
      </>
    );
  }

  /* ---- QUIZ ---- */
  if(page==='quiz'){
    const q = active[current]; if(!q) return null;

    const status = (i) => {
      const an = answers[i]!=null, mk = !!marked[i], sk=!!skipped[i];
      if(an && mk) return 'attempted_marked';
      if(!an && mk) return 'marked_only';
      if(!an && sk) return 'skipped';
      if(an) return 'attempted';
      return 'unattempted';
    };

    return (
      <>
        <TopBarBtns/>
        <div className="grid lg:grid-cols-[1fr,280px] gap-6 animate-slideIn">
          <section className="glassCard rounded-2xl p-4 border relative">
            <div className="absolute right-4 top-3 text-xs glass px-2 py-1 rounded border">
              Attempted: <b>{attempted}</b> • Unattempted: <b>{unattempted}</b>
            </div>

            <div className="text-sm text-gray-500 mb-1">CHAPTER</div>
            <div className="mb-2 font-medium">{q.chapter || '—'}</div>

            <h3 className="text-lg font-semibold leading-relaxed">{q.question}</h3>
            {q.source && <div className="mt-1 text-xs text-gray-500">Source: {q.source}</div>}

            <div className="mt-4 grid gap-3">
              {q.options.map((opt, idx)=>(
                <label key={idx}
                       className={`flex items-center gap-3 p-3 rounded-lg border glass cursor-pointer hover:shadow transition
                                  ${answers[current]===opt?'border-teal-500 ring-1 ring-teal-200':''}`}>
                  <input type="radio" name={`q-${current}`} className="accent-teal-600"
                         checked={answers[current]===opt}
                         onChange={()=>{ setAnswers(p=>({...p,[current]:opt})); setSkipped(p=>{const c={...p}; delete c[current]; return c;}); }}/>
                  <span className="font-medium">{String.fromCharCode(65+idx)}.</span>
                  <span>{opt}</span>
                </label>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button className="glassBtn px-3 py-2 rounded-lg"
                      onClick={()=>setCurrent(c=>Math.max(0,c-1))} disabled={current===0}>Previous</button>
              <button className="glassBtn px-3 py-2 rounded-lg"
                      onClick={()=>setAnswers(p=>{const c={...p}; delete c[current]; return c;})}>Clear Response</button>
              <button className={`px-3 py-2 rounded-lg border transition ${answers[current]? (marked[current]?'bg-blue-500 text-white border-blue-600':'glassBtn') : (marked[current]?'bg-violet-500 text-white border-violet-600':'glassBtn')}`}
                      onClick={()=>setMarked(p=>({...p,[current]:!p[current]}))}>
                {marked[current]?'Unmark Review':'Mark for Review'}
              </button>

              <div className="ml-auto" />
              {current < active.length-1 ? (
                <button className="px-4 py-2 rounded-lg text-white bg-teal-600 hover:brightness-95"
                        onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); setCurrent(c=>c+1); }}>
                  Next
                </button>
              ) : (
                <button className="px-4 py-2 rounded-lg text-white bg-green-600 hover:brightness-95"
                        onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); stopTimer(); setPage('result'); }}>
                  Submit
                </button>
              )}
            </div>
          </section>

          {/* Palette */}
          <aside className="glassCard rounded-2xl p-4 border">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Question Palette</div>
              {mode==='test' && <div className="glass px-2 py-1 rounded border text-xs">⏱ {fmt(remaining)}</div>}
            </div>

            <div className="grid grid-cols-5 gap-2">
              {active.map((_,i)=>{
                const s = status(i);
                const cls = s==='attempted_marked' ? "bg-blue-500 text-white border-blue-600"
                          : s==='marked_only'     ? "bg-violet-500 text-white border-violet-600"
                          : s==='skipped'         ? "bg-red-500 text-white border-red-600"
                          : s==='attempted'       ? "bg-emerald-500 text-white border-emerald-600"
                                                  : "bg-white text-gray-800 border-gray-300";
                return (
                  <button key={i} onClick={(e)=>{ ripple(e); if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); setCurrent(i); }}
                          className={`rippleContainer w-8 h-8 rounded-md border text-sm transition transform hover:scale-105 hover:shadow ${cls}`}>
                    {i+1}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mt-4">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white border"></span> Unattempted</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500"></span> Attempted</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-violet-500"></span> Marked (no answer)</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500"></span> Attempted + Marked</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500"></span> Skipped</div>
            </div>

            <div className="mt-4">
              <button className="w-full px-4 py-2 rounded-lg text-white bg-green-600 hover:brightness-95"
                      onClick={()=>{ stopTimer(); setPage('result'); }}>
                Submit Test
              </button>
            </div>
          </aside>
        </div>
      </>
    );
  }

  /* ---- RESULT ---- */
  if(page==='result'){
    const percent = total?Math.round(score/total*100):0;
    return (
      <>
        <TopBarBtns/>
        <section className="glassCard rounded-2xl p-4 border animate-slideIn">
          <h2 className="text-xl font-bold">Result</h2>
          <p className="mt-1">Score: {score}/{total} ({percent}%)</p>
          <div className="space-y-3 mt-3">
            {active.map((qq,i)=>{
              const ok = (answers[i]===qq.answer);
              return (
                <div key={i} className="p-3 glass rounded-lg border">
                  <div className="flex justify-between">
                    <b>Q{i+1}. {qq.question}</b>
                    <span className={`px-2 py-1 text-xs rounded ${ok?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{ok?'Correct':'Incorrect'}</span>
                  </div>
                  <div className="text-sm mt-1">Your: {answers[i]||'Not answered'} • Correct: <b className="text-green-700">{qq.answer}</b></div>
                  {qq.explanation && <div className="text-sm text-gray-600">{qq.explanation}</div>}
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <button className="glassBtn px-4 py-2 rounded-lg" onClick={()=>setPage('home')}>Home</button>
          </div>
        </section>
      </>
    );
  }

  /* ---- HISTORY ---- */
  if(page==='history'){
    const h = store.get();
    return (
      <>
        <TopBarBtns/>
        <section className="glassCard rounded-2xl p-4 border animate-slideIn">
          <h2 className="text-xl font-bold">Past Results</h2>
          {h.length===0 ? <div className="text-gray-500">No attempts yet.</div> : (
            <div className="space-y-3 mt-3">
              {h.map(a=>(
                <details key={a.id} className="glass rounded-lg border p-3">
                  <summary className="cursor-pointer font-medium">{new Date(a.timestamp).toLocaleString()} • {a.mode} • {a.chapter}</summary>
                  <div className="text-sm text-gray-600 mt-2">Score: {a.score}/{a.total} ({a.percent}%) {a.durationSec?`• Time: ${fmt(a.durationSec)}`:''}</div>
                </details>
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  /* ---- ANALYTICS ---- */
  if(page==='analytics'){
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
        <TopBarBtns/>
        <section className="glassCard rounded-2xl p-4 border animate-slideIn">
          <h2 className="text-xl font-bold">Chapter-wise Analytics</h2>
          {rows.length===0 ? <div className="text-gray-500">No data yet.</div> : (
            <div className="space-y-3 mt-3">
              {rows.map(r=>(
                <div key={r.ch} className="glass rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{r.ch}</div>
                    <div className="text-sm text-gray-600">{r.correct}/{r.total} • {r.pct}%</div>
                  </div>
                  <div className="mt-2 h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500" style={{width:`${r.pct}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  return null;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);