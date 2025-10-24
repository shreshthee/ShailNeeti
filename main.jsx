const {useEffect,useMemo,useRef,useState} = React;

/* ---------------- constants ---------------- */
const PER_Q_MIN = 1.2;
const secsFor = n => Math.round(n * PER_Q_MIN * 60);
const fmt = s => { const h=(s/3600)|0,m=((s%3600)/60)|0,sec=(s%60)|0; return h?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };

const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a};
const pickN=(arr,n)=>shuffle(arr).slice(0,n);

/* ---------------- storage ---------------- */
const LS='sn_hist_v1';
const hist = { get(){ try{return JSON.parse(localStorage.getItem(LS))||[]}catch{return[]} }, set(v){ try{localStorage.setItem(LS,JSON.stringify(v))}catch{} } };

/* ---------------- UI pieces ---------------- */
const TopBar = ({goHome,goHist,goAnal}) => (
  <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
    <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <h1 className="font-semibold">
        <span className="font-extrabold text-gray-900">ShailNeeti</span>
        <span className="text-gray-500"> — CUET PG Economics</span>
      </h1>
      <div className="flex gap-2 text-sm">
        <button className="btn" onClick={goHist}>Review Past Results</button>
        <button className="btn" onClick={goAnal}>Analytics</button>
        <button className="btn" onClick={goHome}>Home</button>
      </div>
    </div>
  </header>
);

/* ---------------- App ---------------- */
const App = ()=>{
  const [page,setPage] = useState('home');  // home | quiz | result | history | analytics
  const [chapters,setChapters] = useState([]);
  const [chapter,setChapter] = useState('');
  const [mode,setMode] = useState('practice');
  const [count,setCount] = useState(10);

  const [active,setActive] = useState([]);
  const [current,setCurrent] = useState(0);
  const [ans,setAns] = useState({});
  const [mark,setMark] = useState({});
  const [skip,setSkip] = useState({});

  const [remain,setRemain] = useState(0);
  const t = useRef(null);

  const [loading,setLoading] = useState(true);
  const [err,setErr] = useState('');

  useEffect(()=>{
    fetch('./questions-index.json?'+Date.now())
      .then(r=>r.json()).then(d=>{
        setChapters(d.chapters||[]);
        setChapter(d.chapters?.[0]?.id || '');
      }).catch(()=>setErr('Could not load questions.json')).finally(()=>setLoading(false));
  },[]);

  const total = active.length;
  const attempted = useMemo(()=>Object.keys(ans).filter(k=>ans[k]!=null).length,[ans]);
  const unattempted = Math.max(0,total-attempted);
  const score = useMemo(()=>active.reduce((s,q,i)=>s+(ans[i]===q.answer?1:0),0),[ans,active]);

  const stop=()=>{ if(t.current){ clearInterval(t.current); t.current=null; } };
  const start=sec=>{ stop(); setRemain(sec); t.current=setInterval(()=>setRemain(p=>p<=1?(stop(),setPage('result'),0):p-1),1000); };

  const reset=()=>{ setCurrent(0); setAns({}); setMark({}); setSkip({}); };

  async function loadChapter(ch){
    const item = chapters.find(c=>c.id===ch); if(!item) return [];
    const url = './questions/'+item.file+'?v='+Date.now();
    const d = await fetch(url).then(r=>r.json()).catch(()=>[]);
    return Array.isArray(d)?d:(d.questions||[]);
  }

  async function startPractice(){
    const items = await loadChapter(chapter);
    setActive(items); reset(); stop(); setPage('quiz');
  }
  async function startTest(){
    const items = await loadChapter(chapter);
    const req = Math.max(1, parseInt(count||1,10));
    const n = Math.max(1, Math.min(req, items.length));
    const set = pickN(items, n);
    setActive(set); reset(); start(secsFor(n)); setPage('quiz');
  }

  useEffect(()=>{
    if(page!=='result'||!total) return;
    const chName = chapters.find(c=>c.id===chapter)?.name || chapter;
    const h = hist.get();
    h.unshift({
      id:'a_'+Date.now(), timestamp:new Date().toISOString(),
      mode, chapter: chName, total, score,
      percent: total?Math.round(score/total*100):0,
      durationSec: mode==='test'?secsFor(total):null,
      answers: Array.from({length:total},(_,i)=>ans[i]??null),
      questions: active.map(q=>({chapter:q.chapter,question:q.question,options:q.options,answer:q.answer,source:q.source||null}))
    });
    hist.set(h.slice(0,80));
  },[page]);

  if(loading) return (<><TopBar goHome={()=>setPage('home')} goHist={()=>setPage('history')} goAnal={()=>setPage('analytics')} /><div className="max-w-6xl mx-auto px-4 py-10 text-gray-500">Loading…</div></>);
  if(err) return (<><TopBar goHome={()=>setPage('home')} goHist={()=>setPage('history')} goAnal={()=>setPage('analytics')} /><div className="max-w-6xl mx-auto px-4 py-10 text-red-600">{err}</div></>);

  /* ------------ HOME ------------ */
  if(page==='home'){
    const est = fmt(secsFor(Math.max(1,parseInt(count||1,10))));
    return (
      <>
        <TopBar goHome={()=>setPage('home')} goHist={()=>setPage('history')} goAnal={()=>setPage('analytics')} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center mb-5">
            <div className="text-3xl font-extrabold text-rose-400">ShailNeeti</div>
            <img src="ganesh.png" className="mx-auto h-20 mt-2 opacity-70" alt="Ganesh"/>
          </div>

          <section className="glass p-6">
            <h2 className="text-xl md:text-2xl font-bold">MCQ Practice for CUET PG Economics</h2>
            <p className="text-gray-600">Practice chapter-wise Economics PYQs with instant feedback.</p>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-sm">Chapter Filter</label>
                <select value={chapter} onChange={e=>setChapter(e.target.value)} className="w-full p-2 mt-1 border rounded-md bg-white">
                  {chapters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">Mode</label>
                <div className="flex gap-6 mt-1">
                  <label className="flex items-center gap-2"><input type="radio" checked={mode==='practice'} onChange={()=>setMode('practice')}/> Practice</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={mode==='test'} onChange={()=>setMode('test')}/> Test</label>
                </div>
              </div>
            </div>

            {mode==='test' && (
              <div className="grid md:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-sm">No. of Questions</label>
                  <input type="number" min="1" value={count} onChange={e=>setCount(e.target.value)} className="w-32 p-2 border rounded-md bg-white"/>
                </div>
                <div className="md:ml-auto">
                  <label className="text-sm block">Time limit</label>
                  <div className="w-32 p-2 text-center border rounded-md bg-white">{est}</div>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {mode==='practice' ? <button className="btn" onClick={startPractice}>Start Practice</button> : <button className="px-5 py-2 rounded-md text-white bg-teal-600 hover:bg-teal-700" onClick={startTest}>Start Test</button>}
              <button className="btn" onClick={()=>setPage('history')}>Review Past Results</button>
              <button className="btn" onClick={()=>setPage('analytics')}>Analytics</button>
            </div>
          </section>
        </main>
      </>
    );
  }

  /* ------------ QUIZ ------------ */
  if(page==='quiz'){
    const q = active[current];

    const setAnswer = opt => { setAns(p=>({...p,[current]:opt})); setSkip(p=>{const m={...p}; delete m[current]; return m;}); };
    const toggleMark = () => setMark(p=>({...p,[current]:!p[current]}));

    const statusClass = i => {
      const a = ans[i]!=null; const m=!!mark[i]; const s=!!skip[i];
      if(a&&m) return 'bg-blue-500 text-white';
      if(!a&&m) return 'bg-violet-500 text-white';
      if(!a&&s) return 'bg-red-500 text-white';
      if(a) return 'bg-emerald-500 text-white';
      return 'bg-white text-gray-800 border';
    };

    return (
      <>
        <TopBar goHome={()=>{stop();setPage('home')}} goHist={()=>setPage('history')} goAnal={()=>setPage('analytics')} />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-[1fr,280px] gap-6">
            <section className="glass p-5 relative">
              <div className="absolute right-3 top-3 text-xs bg-white/70 px-2 py-1 rounded border">Attempted: <b>{attempted}</b> • Unattempted: <b>{unattempted}</b></div>

              <div className="mb-2 text-xs text-gray-600 uppercase">Chapter</div>
              <div className="font-medium mb-2">{q?.chapter||'—'}</div>
              <h3 className="text-lg font-semibold">{q?.question}</h3>
              {q?.source && <div className="text-xs text-gray-600">Source: {q.source}</div>}

              <div className="mt-4 space-y-3 animate-[slide_.25s_ease_both]">
                {q?.options?.map((opt,i)=>{
                  const act = ans[current]===opt;
                  return (
                    <label key={i} className={`flex items-center gap-3 p-3 rounded-md border bg-white hover:bg-slate-50 ${act?'ring-1 ring-teal-300 border-teal-400':''}`}>
                      <input type="radio" name={`q${current}`} className="accent-teal-600" checked={act} onChange={()=>setAnswer(opt)} />
                      <span className="font-medium">{String.fromCharCode(65+i)}.</span>
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button className="btn" onClick={()=>{ if(!ans[current] && !mark[current]) setSkip(p=>({...p,[current]:true})); setCurrent(c=>Math.max(0,c-1)); }}>Previous</button>
                <button className="btn" onClick={()=>setAns(p=>{const m={...p}; delete m[current]; return m;})}>Clear Response</button>
                <button className={`btn ${ans[current]?(mark[current]?'text-white bg-blue-500':''):(mark[current]?'text-white bg-violet-500':'')}`} onClick={toggleMark}>{mark[current]?'Unmark Review':'Mark for Review'}</button>

                <div className="flex-1"></div>
                {current<active.length-1
                  ? <button className="px-5 py-2 rounded-md text-white bg-teal-600 hover:bg-teal-700" onClick={()=>{ if(!ans[current] && !mark[current]) setSkip(p=>({...p,[current]:true})); setCurrent(c=>c+1); }}>Next</button>
                  : <button className="px-5 py-2 rounded-md text-white bg-emerald-600 hover:bg-emerald-700" onClick={()=>{ if(!ans[current] && !mark[current]) setSkip(p=>({...p,[current]:true})); stop(); setPage('result'); }}>Submit</button>
                }
              </div>
            </section>

            <aside className="glass p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Question Palette</h4>
                {mode==='test' && <span className={`text-xs px-2 py-1 rounded border ${remain<=30?'border-red-500 text-red-600':'border-gray-300 text-gray-700'}`}>⏱ {fmt(remain)}</span>}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {active.map((_,i)=>{
                  const cls=statusClass(i); const ring=i===current?' ring-2 ring-teal-500':'';
                  return <button key={i} onClick={()=>setCurrent(i)} className={`w-8 h-8 rounded-md text-sm flex items-center justify-center ${cls} ${ring}`}>{i+1}</button>
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white border"></span> Unattempted</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500"></span> Attempted</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-violet-500"></span> Marked (no answer)</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500"></span> Attempted + Marked</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500"></span> Skipped</div>
              </div>
              <div className="mt-4"><button className="px-5 py-2 rounded-md text-white bg-emerald-600 hover:bg-emerald-700 w-full" onClick={()=>{stop();setPage('result')}}>Submit Test</button></div>
            </aside>
          </div>
        </main>
      </>
    );
  }

  /* ------------ RESULT ------------ */
  if(page==='result'){
    const percent = total?Math.round(score/total*100):0;
    return (
      <>
        <TopBar goHome={()=>setPage('home')} goHist={()=>setPage('history')} goAnal={()=>setPage('analytics')} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <section className="glass p-6">
            <h2 className="text-xl font-semibold">Result</h2>
            <p>Score : {score}/{total} ({percent}%)</p>
            <div className="mt-3 space-y-2">
              {active.map((q,i)=>{
                const ok = ans[i]===q.answer;
                return (
                  <div key={i} className="p-3 rounded-md border bg-white">
                    <div className="flex justify-between">
                      <b>Q{i+1}. {q.question}</b>
                      <span className={`text-xs px-2 py-1 rounded ${ok?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{ok?'Correct':'Incorrect'}</span>
                    </div>
                    <div className="text-sm">Your: {ans[i]||'Not answered'} • Correct: <b>{q.answer}</b></div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4"><button className="btn" onClick={()=>setPage('home')}>Home</button></div>
          </section>
        </main>
      </>
    );
  }

  /* ------------ HISTORY ------------ */
  if(page==='history'){
    const [sort,setSort] = useState('date_desc');
    const h = hist.get();
    const sorted=[...h].sort((a,b)=>{
      if(sort==='date_desc') return new Date(b.timestamp)-new Date(a.timestamp);
      if(sort==='date_asc')  return new Date(a.timestamp)-new Date(b.timestamp);
      if(sort==='score_desc') return (b.percent||0)-(a.percent||0);
      if(sort==='score_asc')  return (a.percent||0)-(b.percent||0);
      return 0;
    });
    return (
      <>
        <TopBar goHome={()=>setPage('home')} goHist={()=>setPage('history')} goAnal={()=>setPage('analytics')} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Past Results</h2>
            <select className="border rounded px-2 py-1" value={sort} onChange={e=>setSort(e.target.value)}>
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="score_desc">Score high → low</option>
              <option value="score_asc">Score low → high</option>
            </select>
          </div>
          {sorted.length===0 ? <div className="text-gray-500">No attempts yet.</div> : (
            <div className="space-y-3">
              {sorted.map(a=>(
                <details key={a.id} className="glass p-4">
                  <summary className="cursor-pointer flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{new Date(a.timestamp).toLocaleString()} • {a.mode} • {a.chapter}</div>
                      <div className="text-sm text-gray-600">Score {a.score}/{a.total} ({a.percent}%) {a.durationSec?`• Time: ${fmt(a.durationSec)}`:''}</div>
                    </div>
                  </summary>
                  <div className="mt-2 space-y-1">
                    {a.questions.map((q,i)=>{
                      const your=a.answers[i]; const ok=your===q.answer;
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
    );
  }

  /* ------------ ANALYTICS ------------ */
  if(page==='analytics'){
    const h = hist.get();
    const agg={};
    h.forEach(a=>a.questions.forEach((q,i)=>{
      const ch=q.chapter||'Unknown'; if(!agg[ch]) agg[ch]={c:0,t:0};
      agg[ch].t++; if(a.answers[i]===q.answer) agg[ch].c++;
    }));
    const rows=Object.entries(agg).map(([ch,{c,t}])=>({ch,c,t,p:t?Math.round(c/t*100):0})).sort((a,b)=>a.ch.localeCompare(b.ch));
    return (
      <>
        <TopBar goHome={()=>setPage('home')} goHist={()=>setPage('history')} goAnal={()=>setPage('analytics')} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <h2 className="text-xl font-semibold mb-3">Chapter-wise Analytics</h2>
          {rows.length===0 ? <div className="text-gray-500">No data yet.</div> : (
            <div className="space-y-3">
              {rows.map(r=>(
                <div key={r.ch} className="glass p-3">
                  <div className="flex justify-between">
                    <div className="font-semibold">{r.ch}</div>
                    <div className="text-sm text-gray-700">{r.c}/{r.t} • {r.p}%</div>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-teal-500" style={{width:`${r.p}%`}}></div>
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