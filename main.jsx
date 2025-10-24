/* ================= ShailNeeti main.jsx (chapter-wise loader) =============== */
const { useEffect, useMemo, useRef, useState } = React;

const TIME_PER_Q_MIN = 1.2;
const timeForN = n => Math.round(n * TIME_PER_Q_MIN * 60);
const fmt = s => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

const LS_KEY = "shailneeti_results";
const store = {
  get(){ try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } },
  set(v){ try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch{} }
};

const shuffle = arr => { const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]];} return a; };
const pickN = (arr,n) => shuffle(arr).slice(0,n);

/* ---------- data loading ---------- */
async function fetchJson(path){
  const r = await fetch(`${path}?v=${Date.now()}`);
  if(!r.ok) throw new Error(path + " not found");
  return r.json();
}

/** Load chapter list then a single chapter file */
async function loadChapter(file){
  const data = await fetchJson(`./questions/${file}`);
  if(!Array.isArray(data)) return [];
  return data;
}

/** Load *all* chapters listed in questions-index.json */
async function loadAllChapters(index){
  const merged = [];
  for(const c of index){
    try{
      const rows = await loadChapter(c.file);
      merged.push(...rows);
    }catch(e){
      console.warn("Missing chapter file:", c.file);
    }
  }
  return merged;
}

/* ------------------------ UI ------------------------ */
function App(){
  const [page, setPage] = useState("home"); // home | quiz | result | history | analytics
  const [mode, setMode] = useState("practice");
  const [index, setIndex] = useState([]);   // [{id,title,file}]
  const [chapter, setChapter] = useState("All");

  const [questions, setQuestions] = useState([]); // loaded for selected chapter(s)
  const [active, setActive] = useState([]);       // used in the run
  const [testCount, setTestCount] = useState(10);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState({});
  const [skipped, setSkipped] = useState({});

  const [remaining, setRemaining] = useState(0);
  const timer = useRef(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ---- initial load: chapters index, then load 'All' by default
  useEffect(()=>{
    (async ()=>{
      try{
        const idx = await fetchJson('./questions-index.json');
        setIndex(idx);
        const all = await loadAllChapters(idx);
        setQuestions(all);
      }catch(e){
        setErr("Could not load question files");
      }finally{
        setLoading(false);
      }
    })();
  },[]);

  // ---- when user changes chapter in HOME, load just that chapter (or All)
  async function changeChapter(ch){
    setChapter(ch);
    setLoading(true);
    try{
      if(ch === "All"){
        setQuestions(await loadAllChapters(index));
      }else{
        const found = index.find(i => i.title === ch || i.id === ch);
        if(!found) throw new Error("Chapter not in index");
        setQuestions(await loadChapter(found.file));
      }
      setErr("");
    }catch(e){
      console.error(e);
      setErr("Could not load selected chapter file.");
    }finally{
      setLoading(false);
    }
  }

  const total = active.length;
  const attempted = useMemo(()=>Object.keys(answers).filter(k=>answers[k]!=null).length,[answers,active]);
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

  function resetRun(){
    setCurrent(0); setAnswers({}); setMarked({}); setSkipped({});
  }

  function startPractice(){
    setActive(questions);
    resetRun(); stopTimer();
    setPage('quiz');
  }

  function startTest(){
    const n = Math.max(1, Math.min(parseInt(testCount||1,10), questions.length));
    const set = pickN(questions, n);
    setActive(set); resetRun(); startTimer(timeForN(n));
    setPage('quiz');
  }

  // persist history on result
  useEffect(()=>{
    if(page!=='result' || !total) return;
    const entry = {
      id:'attempt_'+Date.now(),
      timestamp: new Date().toISOString(),
      mode, chapter, total, score,
      percent: total?Math.round(score/total*100):0,
      durationSec: mode==='test'? timeForN(total) : null,
      answers: Array.from({length: total},(_,i)=>answers[i] ?? null),
      questions: active.map(q=>({chapter:q.chapter,question:q.question,options:q.options,answer:q.answer,source:q.source??null}))
    };
    const h = store.get(); h.unshift(entry); store.set(h.slice(0,50));
  },[page]);

  // ---------------- RENDER ----------------
  if(loading){
    return (<main className="max-w-5xl mx-auto p-6 text-center text-gray-600">Loading…</main>);
  }
  if(err){
    return (<main className="max-w-5xl mx-auto p-6 text-center text-red-600">{err}</main>);
  }

  if(page==='home'){
    const allChapters = ['All', ...index.map(i=>i.title)];
    const filteredCount = questions.length;
    const est = timeForN(Math.max(1, Math.min(parseInt(testCount||1,10), filteredCount||1)));

    return (
      <>
        <header className="sticky top-0 bg-white/90 backdrop-blur border-b">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="font-semibold">ShailNeeti — CUET PG Economics</h1>
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded bg-white/70 border" onClick={()=>setPage('history')}>Review Past Results</button>
              <button className="px-3 py-2 rounded bg-white/70 border" onClick={()=>setPage('analytics')}>Analytics</button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="rounded-3xl border bg-gradient-to-br from-rose-50 to-rose-100 p-6 shadow">
            <h2 className="text-xl font-bold mb-4">MCQ Practice for CUET PG Economics</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm">Chapter Filter</label>
                <select className="w-full p-2 border rounded bg-white/70"
                        value={chapter}
                        onChange={e=>changeChapter(e.target.value)}>
                  {allChapters.map(c=> <option key={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm">Mode</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2"><input type="radio" checked={mode==='practice'} onChange={()=>setMode('practice')} /> Practice</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={mode==='test'} onChange={()=>setMode('test')} /> Test</label>
                </div>
              </div>
            </div>

            {mode==='test' && (
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="text-sm">No. of Questions</label>
                  <input type="number" min="1" max={filteredCount} value={testCount}
                         onChange={e=>setTestCount(e.target.value)}
                         className="w-40 p-2 border rounded bg-white/70" />
                  <div className="text-xs text-gray-600 mt-1">Available: {filteredCount}</div>
                </div>
                <div className="flex items-end">
                  <div className="p-2 border rounded bg-white/70">Time limit: {fmt(est)}</div>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              {mode==='practice'
                ? <button className="px-4 py-2 rounded text-white bg-teal-600" onClick={startPractice}>Start Practice</button>
                : <button className="px-4 py-2 rounded text-white bg-teal-600" onClick={startTest}>Start Test</button>}
              <button className="px-4 py-2 rounded bg-white/70 border" onClick={()=>setPage('history')}>Review Past Results</button>
              <button className="px-4 py-2 rounded bg-white/70 border" onClick={()=>setPage('analytics')}>Analytics</button>
            </div>
          </div>
        </main>
      </>
    );
  }

  if(page==='quiz'){
    const q = active[current]; if(!q) return null;
    const unattempted = active.length - attempted;

    return (
      <>
        <header className="sticky top-0 bg-white/90 backdrop-blur border-b">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>Question {current+1} of {active.length}</div>
            {mode==='test' && <div className="px-3 py-1 rounded border">⏱ {fmt(remaining)}</div>}
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr,280px] gap-6">
          <section className="rounded-2xl p-4 bg-white/70 backdrop-blur border">
            <div className="text-xs uppercase">Chapter</div>
            <div className="mb-3">{q.chapter}</div>
            <h3 className="text-lg font-semibold">{q.question}</h3>
            {q.source && <div className="text-xs text-gray-600 mt-1">Source: {q.source}</div>}

            <div className="mt-5 grid gap-3">
              {q.options.map((opt, idx)=>(
                <label key={idx} className={`flex items-center gap-3 p-3 border rounded cursor-pointer bg-white/70 ${answers[current]===opt?'border-teal-500 ring-1 ring-teal-200':''}`}>
                  <input type="radio" className="accent-teal-600"
                         checked={answers[current]===opt}
                         onChange={()=>{ setAnswers(p=>({...p,[current]:opt})); setSkipped(p=>{const c={...p}; delete c[current]; return c;}); }}/>
                  <span className="font-medium">{String.fromCharCode(65+idx)}.</span>
                  <span>{opt}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button className="px-3 py-2 border rounded bg-white/70"
                      onClick={()=>setCurrent(c=>Math.max(0,c-1))}
                      disabled={current===0}>Previous</button>
              <button className="px-3 py-2 border rounded bg-white/70"
                      onClick={()=>setAnswers(p=>{const c={...p}; delete c[current]; return c;})}>Clear Response</button>
              <button className={`px-3 py-2 border rounded ${marked[current]?'bg-violet-100 border-violet-400':'bg-white/70'}`}
                      onClick={()=>setMarked(p=>({...p,[current]:!p[current]}))}>
                {marked[current]?'Unmark Review':'Mark for Review'}
              </button>
              <div className="ml-auto text-sm text-gray-600">Attempted: <b>{attempted}</b> • Unattempted: <b>{unattempted}</b></div>
              {current<active.length-1
                ? <button className="px-4 py-2 rounded text-white bg-teal-600"
                          onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); setCurrent(c=>c+1); }}>Next</button>
                : <button className="px-4 py-2 rounded text-white bg-green-600"
                          onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); stopTimer(); setPage('result'); }}>Submit</button>}
            </div>
          </section>

          <aside className="rounded-2xl p-4 bg-white/70 backdrop-blur border">
            <div className="font-semibold mb-2">Question Palette</div>
            <div className="grid grid-cols-5 gap-2">
              {active.map((_,i)=>{
                const answered = answers[i]!=null, isMarked=!!marked[i], isSkipped=!!skipped[i];
                let cls="bg-white text-gray-800 border-gray-300";
                if(answered && isMarked) cls="bg-blue-500 text-white border-blue-600";
                else if(!answered && isMarked) cls="bg-violet-500 text-white border-violet-600";
                else if(!answered && isSkipped) cls="bg-red-500 text-white border-red-600";
                else if(answered) cls="bg-emerald-500 text-white border-emerald-600";
                return (
                  <button key={i}
                    className={`w-8 h-8 rounded-md border text-sm ${cls}`}
                    onClick={()=>{ if(!answers[current] && !marked[current]) setSkipped(p=>({...p,[current]:true})); setCurrent(i); }}>
                    {i+1}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mt-4">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white border"></span> Unattempted</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500"></span> Attempted</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-violet-500"></span> Marked</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500"></span> Attempted+Marked</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500"></span> Skipped</div>
            </div>

            <div className="mt-4">
              <button className="w-full px-4 py-2 rounded text-white bg-green-600"
                      onClick={()=>{ stopTimer(); setPage('result'); }}>
                Submit Test
              </button>
            </div>
          </aside>
        </main>
      </>
    );
  }

  if(page==='result'){
    const percent = total?Math.round(score/total*100):0;
    return (
      <>
        <header className="sticky top-0 bg-white/90 backdrop-blur border-b">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="font-semibold">Result</div>
            <button className="px-3 py-2 border rounded bg-white/70" onClick={()=>setPage('home')}>Home</button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6">
          <div className="mb-4">Score: {score}/{total} ({percent}%)</div>
          <div className="space-y-3">
            {active.map((qq,i)=>{
              const sel = answers[i], ok = sel===qq.answer;
              return (
                <div key={i} className="p-3 border rounded bg-white/70">
                  <div className="flex justify-between">
                    <b>Q{i+1}. {qq.question}</b>
                    <span className={`text-xs px-2 py-1 rounded ${ok?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                      {ok?'Correct':'Incorrect'}
                    </span>
                  </div>
                  <div className="text-sm mt-1">Your: {sel || 'Not answered'} • Correct: <b className="text-green-700">{qq.answer}</b></div>
                  {qq.explanation && <div className="text-sm text-gray-700">{qq.explanation}</div>}
                </div>
              );
            })}
          </div>
        </main>
      </>
    );
  }

  if(page==='history'){
    const h = store.get();
    return (
      <>
        <header className="sticky top-0 bg-white/90 backdrop-blur border-b">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="font-semibold">Past Results</div>
            <button className="px-3 py-2 border rounded bg-white/70" onClick={()=>setPage('home')}>Home</button>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">
          {h.length===0 ? <div className="text-gray-500">No attempts yet.</div> :
            <div className="space-y-3">
              {h.map(a=>(
                <details key={a.id} className="p-3 border rounded bg-white/70">
                  <summary className="cursor-pointer">{new Date(a.timestamp).toLocaleString()} • {a.mode} • {a.chapter} • {a.score}/{a.total} ({a.percent}%)</summary>
                  <div className="mt-2 text-sm text-gray-700">{a.durationSec?`Time: ${fmt(a.durationSec)}`:''}</div>
                </details>
              ))}
            </div>}
        </main>
      </>
    );
  }

  if(page==='analytics'){
    const hist = store.get();
    const agg = {};
    hist.forEach(at => at.questions.forEach((q,i)=>{
      const ch = q.chapter || 'Unknown';
      if(!agg[ch]) agg[ch]={correct:0,total:0};
      agg[ch].total++; if(at.answers[i]===q.answer) agg[ch].correct++;
    }));
    const rows = Object.entries(agg).map(([ch,{correct,total}])=>({ch,correct,total,pct: total?Math.round(correct/total*100):0}))
                                    .sort((a,b)=>a.ch.localeCompare(b.ch));

    return (
      <>
        <header className="sticky top-0 bg-white/90 backdrop-blur border-b">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="font-semibold">Chapter-wise Analytics</div>
            <button className="px-3 py-2 border rounded bg-white/70" onClick={()=>setPage('home')}>Home</button>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">
          {rows.length===0 ? <div className="text-gray-500">No data yet.</div> :
            <div className="space-y-3">
              {rows.map(r=>(
                <div key={r.ch} className="p-3 border rounded bg-white/70">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{r.ch}</div>
                    <div className="text-sm text-gray-700">{r.correct}/{r.total} • {r.pct}%</div>
                  </div>
                  <div className="mt-2 h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500" style={{width:`${r.pct}%`}}></div>
                  </div>
                </div>
              ))}
            </div>}
        </main>
      </>
    );
  }

  return null;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);