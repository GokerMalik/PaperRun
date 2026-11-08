import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronRight, FileText, Flag, Footprints, LockKeyhole, Pause, Play, RotateCcw, Upload, X, Download, ShieldCheck, Smartphone } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PaperGeometry } from './lib/paper';
import { Run, clock } from './lib/run';
import { supportsMobileRun } from './lib/device';
import { loadPdfRenderer } from './lib/pdf';
type Paper = PaperGeometry & { name: string; pdf: PDFDocumentProxy; words: number; pageWords: number[]; textComplete: boolean };
type Phase = 'home' | 'loading' | 'ready' | 'running' | 'paused' | 'finished';

function PaperCanvas({ paper, pageIndex }: { paper: Paper; pageIndex: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false; let task: { cancel: () => void } | undefined;
    setFailed(false);
    void paper.pdf.getPage(pageIndex + 1).then(page => {
      if (cancelled || !canvas.current) return;
      // Keep the source PDF's normal reading orientation. Downward finger
      // movement advances the course while the paper view scrolls naturally.
      const rotation = page.rotate;
      const viewport = page.getViewport({ scale: 1, rotation });
      const rendered = page.getViewport({ scale: Math.min(1600 / viewport.width, 2400 / viewport.height), rotation });
      canvas.current.width = Math.ceil(rendered.width); canvas.current.height = Math.ceil(rendered.height);
      const renderTask = page.render({ canvas: canvas.current, viewport: rendered }); task = renderTask;
      return renderTask.promise;
    }).catch(e => { if (!cancelled && e?.name !== 'RenderingCancelledException') setFailed(true); });
    return () => { cancelled = true; task?.cancel(); };
  }, [paper, pageIndex]);
  return failed ? <div className="render-error">Page preview unavailable. Reload this paper to retry.</div> : <canvas ref={canvas} aria-label={`PDF page ${pageIndex + 1}`} />;
}
function Viewer({ paper, distance, running }: { paper: Paper; distance: number; running: boolean }) {
  const container = useRef<HTMLDivElement>(null); const [width, setWidth] = useState(400);
  useEffect(() => { const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width)); if (container.current) observer.observe(container.current); return () => observer.disconnect(); }, []);
  const found = paper.pages.findIndex(p => distance < p.startMm + p.heightMm);
  const index = found < 0 ? paper.pages.length - 1 : found;
  const page = paper.pages[index]; const scale = (width - 40) / page.widthMm;
  return <div className={`paper-viewport ${running ? 'in-run' : ''}`} ref={container}><div className="paper-stack" style={{ transform: `translateY(${24 - (running ? (distance - page.startMm) * scale : 0)}px)` }}>{[index, index+1].filter(i => i < paper.pages.length).map(i => <div className="paper-sheet" key={i} style={{height:paper.pages[i].heightMm*scale,width:paper.pages[i].widthMm*scale}}><PaperCanvas paper={paper} pageIndex={i}/></div>)}</div>{running && <div className="reading-line"><span>YOU ARE HERE</span></div>}<span className="page-tag">PAGE {index+1} / {paper.pages.length}</span></div>;
}
function TrailArt() {
  return <div className="trail-art" aria-hidden="true"><span className="art-label"><i className="little-dot"/> A DIFFERENT KIND OF PAPER TRAIL</span><div className="art-page back"/><div className="art-page front"><div className="art-page-top">FIELD NOTES <span>№ 001</span></div><div className="art-title">On the pursuit<br/>of a good run.</div><div className="art-byline">A study in small steps & big ideas.</div><div className="art-rule"/><div className="art-columns">{[0,1].map(i => <div key={i}>{[85,100,94,100,72,96,100,82,99,88,100,67].map((w,j) => <i key={j} style={{width:`${w}%`}}/>)}</div>)}</div><svg className="art-route" viewBox="0 0 280 280"><path d="M45 258 V185 Q45 150 82 150 H190 Q226 150 226 112 V66 Q226 32 191 32 H110 Q76 32 76 67 V82" fill="none" stroke="#e4dbfa" strokeWidth="38"/><path d="M45 258 V185 Q45 150 82 150 H190 Q226 150 226 112 V66 Q226 32 191 32 H110 Q76 32 76 67 V82" fill="none" stroke="#a991dc" strokeWidth="2" strokeDasharray="5 7"/></svg><div className="runner-marker"><Footprints size={28}/></div><div className="art-page-footer">297 mm of possibility <span>01</span></div></div><span className="art-note"><ArrowUpRight size={20}/> Your paper. Your pace.</span><div className="distance-ticket"><span>REAL PAPER. REAL DISTANCE.</span><strong>Every mm counts.</strong><div><Check size={13}/> Measured from your PDF</div></div></div>;
}
export default function Home() {
  const [mobile,setMobile]=useState<boolean|null>(null);
  useEffect(() => {
    const device = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    const desktopTest = new URLSearchParams(window.location.search).get('desktop-test') === '1';
    setMobile(desktopTest || supportsMobileRun({ userAgent: device.userAgent, platform: device.platform, maxTouchPoints: device.maxTouchPoints, mobileHint: device.userAgentData?.mobile }));
  }, []);
  const [phase,setPhase]=useState<Phase>('home'); const [paper,setPaper]=useState<Paper|null>(null);
  const [error,setError]=useState(''); const [status,setStatus]=useState(''); const [dragging,setDragging]=useState(false); const [help,setHelp]=useState(false);
  const [,redraw]=useState(0); const [activeSide,setActiveSide]=useState<number|null>(null);
  const input=useRef<HTMLInputElement>(null); const engine=useRef<Run|null>(null); const documentRef=useRef<PDFDocumentProxy|null>(null); const loading=useRef(false);
  const helpClose=useRef<HTMLButtonElement>(null); const helpOpener=useRef<HTMLButtonElement>(null);
  useEffect(()=>()=>{void documentRef.current?.destroy();},[]);
  useEffect(()=>{if(help) helpClose.current?.focus();},[help]);
  const closeHelp=()=>{setHelp(false);helpOpener.current?.focus();};
  async function loadFile(file?:File) {
    if(mobile !== true || loading.current)return; loading.current=true;setError('');setPhase('loading');
    let pdf:PDFDocumentProxy|undefined;
    try {
      if(file && file.size>30*1024*1024)throw new Error('Please choose a PDF smaller than 30 MB.');
      if(file && !file.name.toLowerCase().endsWith('.pdf') && file.type!=='application/pdf')throw new Error('Please choose a PDF file.');
      setStatus('Checking the physical size of every page…');
      const { validatePaper } = await import('./lib/paper');
      let bytes: Uint8Array;
      if (file) {
        bytes = new Uint8Array(await file.arrayBuffer());
      } else {
        setStatus('Opening The Tortoise and the Hare…');
        const response = await fetch(`${import.meta.env.BASE_URL}samples/the-tortoise-and-the-hare.pdf`);
        if (!response.ok) throw new Error('The story sample could not be downloaded. Please try again.');
        bytes = new Uint8Array(await response.arrayBuffer());
      }
      const geometry=await validatePaper(bytes);
      setStatus('Preparing your paper trail…');const pdfjs=await loadPdfRenderer(`${import.meta.env.BASE_URL}pdf.worker.min.mjs`);
      pdf=await pdfjs.getDocument({data:geometry.renderBytes.slice(),isEvalSupported:false,cMapUrl:`${import.meta.env.BASE_URL}cmaps/`,cMapPacked:true,standardFontDataUrl:`${import.meta.env.BASE_URL}standard_fonts/`,wasmUrl:`${import.meta.env.BASE_URL}wasm/`,stopAtErrors:true}).promise;
      if(pdf.numPages!==geometry.pages.length)throw new Error('The PDF page structure could not be verified.');
      const pageWords:number[]=[];let textComplete=true;
      const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'word'}):null;
      for(let i=1;i<=pdf.numPages;i++) {
        setStatus(`Counting words locally · page ${i} of ${pdf.numPages}`);
        try {const page=await pdf.getPage(i);const content=await page.getTextContent();const text=content.items.map(item=>'str' in item?item.str:'').join(' ');const count=segmenter?Array.from(segmenter.segment(text)).filter(s=>s.isWordLike).length:(text.match(/[\p{L}\p{N}]+/gu)??[]).length;pageWords.push(count);if(!count)textComplete=false;page.cleanup();}catch{pageWords.push(0);textComplete=false;}
      }
      await documentRef.current?.destroy();documentRef.current=pdf;
      setPaper({...geometry,renderBytes:new Uint8Array(),name:file?.name??'The Tortoise and the Hare.pdf',pdf,words:pageWords.reduce((a,b)=>a+b,0),pageWords,textComplete});
      engine.current=new Run(geometry.pages.map(p=>p.heightMm));setPhase('ready');redraw(v=>v+1);
    } catch(e) {await pdf?.destroy();const message=e instanceof Error?e.message:'This file could not be opened.';setError(/encrypt|password/i.test(message)?'This PDF is password protected. Please choose an unlocked copy.':message);setPhase(paper?'ready':'home');}
    finally{loading.current=false;if(input.current)input.current.value='';}
  }
  function start(){if(!paper || mobile !== true)return;if(phase==='finished')engine.current=new Run(paper.pages.map(p=>p.heightMm));engine.current?.resume(Date.now());setPhase('running');}
  function pause(){engine.current?.pause(Date.now());setActiveSide(null);setPhase('paused');}
  function clearPaper(){engine.current?.pause(Date.now());engine.current=null;void documentRef.current?.destroy();documentRef.current=null;setPaper(null);setPhase('home');setError('');setActiveSide(null);}
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return;
    let frame = 0, last = 0;
    const tick = (frameTime: number) => {
      if (frameTime - last > 70) { engine.current?.sample(Date.now()); redraw(v => v + 1); last = frameTime; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hidden = () => { if (document.hidden && phase === 'running') pause(); };
    const blur = () => { if (phase === 'running') pause(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('blur', blur);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('blur', blur); };
  }, [phase]);
  const run=engine.current;const now=Date.now();const elapsed=run?.time(now)??0;const distance=run?.distance??0;const speed=run?.speed(now)??0;const progress=paper?Math.min(100,distance/paper.totalMm*100):0;const average=elapsed>0?distance/elapsed*3.6:0;const isRunning=phase==='running'||phase==='paused';
  function moved(){if(run&&run.distance>=run.total){setPhase('finished');setActiveSide(null);}redraw(v=>v+1);}
  function downloadResults(){if(!paper||!run)return;const data={file:paper.name,lengthMetres:paper.totalMm/1000,totalTimeSeconds:elapsed/1000,averageKmh:average,wordsPerSecond:elapsed>0?paper.words/(elapsed/1000):0,extractedWords:paper.words,textComplete:paper.textComplete,pages:run.splits.map(s=>({page:s.page,lengthMetres:s.mm/1000,timeSeconds:s.seconds,averageKmh:s.seconds?s.mm/s.seconds*.0036:0,extractedWords:paper.pageWords[s.page-1]}))};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='paperrun-results.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <main><header className="site-header"><a href={import.meta.env.BASE_URL} className="brand" aria-label="PaperRun home"><span className="brand-symbol"><Footprints size={23}/></span>paper<span>run</span></a><div className="header-right"><span className="private-note"><LockKeyhole size={13}/> Just you and your PDF.</span><button className="text-button" ref={helpOpener} onClick={()=>setHelp(true)}>How to run <ArrowUpRight size={15}/></button></div></header>
  {isRunning&&paper&&mobile?<section className="run-layout"><div className="run-heading"><div><span className="eyebrow">{phase==='paused'?'EVERY SECOND COUNTS':'FIND YOUR STRIDE'}</span><h1>{phase==='paused'?'The clock keeps running.':'One foot after the other.'}</h1></div><button className="secondary small" onClick={phase==='paused'?start:pause}>{phase==='paused'?<Play size={16}/>:<Pause size={16}/>} {phase==='paused'?'Resume':'Pause'}</button></div><div className="live-stats"><div><span>SPEED</span><strong>{speed.toFixed(3)} <small>km/h</small></strong></div><div><span>DISTANCE</span><strong>{(distance/1000).toFixed(3)} <small>m</small></strong></div><div><span>TOTAL TIME</span><strong>{clock(elapsed)}</strong></div><div><span>THE FINISH LINE</span><strong>{progress.toFixed(0)} <small>%</small></strong></div></div><div className="progress-track"><i style={{width:`${progress}%`}}/></div><div className="run-stage"><Viewer paper={paper} distance={distance} running/>{phase==='paused'&&<div className="pause-overlay"><Pause size={28}/><h2>The clock keeps running.</h2><p>Your break counts towards your finish time.</p><button className="primary" onClick={start}>Back to the trail <Play size={16}/></button><button className="text-button" onClick={clearPaper}>End run & choose another PDF</button></div>}</div><div className="controls-caption"><span>Slide down in either lane, then switch.</span><span>Next: {run?.lastSide===null?'either foot':run?.lastSide===0?'right foot':'left foot'}</span></div><div className="swipe-controls">{[0,1].map(side=><button key={side} className={`swipe-pad ${activeSide===side?'pressed':''} ${run?.lastSide===side?'resting':''}`} disabled={phase!=='running'} aria-label={`${side===0?'Left':'Right'} foot. Swipe down with your finger.`} onPointerDown={e=>{if(e.pointerType !== 'touch' || mobile !== true)return;if(run?.begin(e.pointerId,side,e.clientY)){e.currentTarget.setPointerCapture(e.pointerId);setActiveSide(side);}}} onPointerMove={e=>{if(e.pointerType !== 'touch')return;run?.move(e.pointerId,e.clientY,Date.now());moved();}} onPointerUp={e=>{run?.end(e.pointerId);setActiveSide(null);redraw(v=>v+1);}} onPointerCancel={e=>{run?.end(e.pointerId);setActiveSide(null);}} onLostPointerCapture={e=>{run?.end(e.pointerId);setActiveSide(null);}}><ArrowDown size={21}/><Footprints size={26}/><span>{side===0?'LEFT':'RIGHT'} FOOT</span><small>{run?.lastSide===side?'Lift & switch':'Slide down to move'}</small></button>)}</div><p className="fine-print center">Distance follows the paper’s real dimensions. Screen sensitivity may vary by device.</p></section>
  :phase==='finished'&&paper&&run?<section className="results"><div className="finish-badge"><Flag size={25}/></div><span className="eyebrow">PAPER CONQUERED</span><h1>That’s a wrap.<br/><em>Every millimetre earned.</em></h1><p className="results-file">{paper.name}</p><div className="result-stats"><div><span>TOTAL LENGTH</span><strong>{(paper.totalMm/1000).toFixed(3)}<small> m</small></strong></div><div><span>TOTAL TIME</span><strong>{clock(elapsed)}</strong></div><div><span>AVERAGE SPEED</span><strong>{average.toFixed(3)}<small> km/h</small></strong></div><div><span>WORDS / SECOND</span><strong>{(elapsed>0?paper.words/(elapsed/1000):0).toFixed(2)}</strong></div></div><div className="splits-card"><div className="card-heading"><h2>Your paper, page by page.</h2><span>{paper.pages.length} splits</span></div><div className="table-scroll"><table><thead><tr><th>PAGE</th><th>SIZE (MM)</th><th>TIME</th><th>AVG. KM/H</th><th>WORDS</th></tr></thead><tbody>{run.splits.map(s=><tr key={s.page}><td className="page-number">{String(s.page).padStart(2,'0')}</td><td>{paper.pages[s.page-1].widthMm.toFixed(1)} × {s.mm.toFixed(1)}</td><td>{s.seconds.toFixed(1)} s</td><td>{(s.seconds>0?s.mm/s.seconds*.0036:0).toFixed(3)}</td><td>{paper.pageWords[s.page-1].toLocaleString()}</td></tr>)}</tbody></table></div></div>{!paper.textComplete&&<p className="fine-print">Some pages contain no extractable text. Word totals exclude scanned text; OCR is not included.</p>}<div className="result-actions"><button className="primary" onClick={start}><RotateCcw size={17}/> Run it again</button><button className="secondary" onClick={clearPaper}>Choose another PDF <ArrowUpRight size={16}/></button><button className="text-button" onClick={downloadResults}><Download size={15}/> Save results</button></div><p className="fine-print center">Every second counts, including breaks. Results stay here until you leave or choose another PDF.</p></section>
  :<><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="orange-dot"/> THE SMALLEST RUN OF YOUR DAY</div><h1>A little cardio.<br/>A lot of <em>paper.</em></h1><p className="hero-description">Turn your PDF into a running track.<br/>Two fingers. A little rhythm. All the way to the last page.</p><div className={`upload-card ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);const file=e.dataTransfer.files[0];if(file&&phase!=='loading')void loadFile(file);}}>{mobile === null ? <div className="device-notice" role="status"><Smartphone size={28}/><h2>Getting your trail ready…</h2></div> : !mobile ? <div className="device-notice" role="status"><span className="device-icon"><Smartphone size={28}/></span><h2>Please use a mobile device</h2><p>Made for two fingers and a little rhythm.<br/>Open PaperRun on your phone or tablet to start.</p><span className="device-footnote">Your fingertips do the legwork.</span></div> : phase==='loading'?<div className="loading-state" role="status"><div className="spinner"/><strong>Mapping your paper trail</strong><p>{status}</p></div>:paper?<><div className="loaded-file"><span className="file-icon"><FileText size={24}/></span><div><strong>{paper.name}</strong><span><Check size={13}/> All {paper.pages.length} page sizes verified</span></div><button className="icon-button" aria-label="Remove PDF" onClick={clearPaper}><X size={18}/></button></div><div className="course-details"><div><strong>{(paper.totalMm/1000).toFixed(3)} m</strong><span>REAL PAPER LENGTH</span></div><div><strong>{paper.pages.length}</strong><span>PAGES</span></div><div><strong>{paper.words.toLocaleString()}</strong><span>EXTRACTED WORDS</span></div></div><button className="primary wide" onClick={start}>Let’s run this paper <ArrowUpRight size={18}/></button>{!paper.textComplete&&<p className="fine-print">Some pages have no extractable text; scanned words are not counted.</p>}</>:<><div className="upload-intro"><span className="file-icon"><Upload size={23}/></span><div><h2>Your next run starts here.</h2><p>Pick a PDF from your device.</p></div></div><button className="primary wide" onClick={()=>input.current?.click()}>Choose your PDF <ArrowUpRight size={18}/></button><div className="upload-meta"><span>PDF · up to 30 MB · 300 pages</span><button className="text-button" onClick={()=>void loadFile()}>Try a sample <ChevronRight size={13}/></button></div></>}</div>{error&&<div className="error-message" role="alert"><strong>We couldn’t prepare that paper.</strong><p>{error}</p></div>}<div className="privacy-line"><ShieldCheck size={16}/><span>Your PDF never leaves your device. Seriously.</span></div></div><div className="hero-visual">{paper&&phase!=='loading'?<div className="preview-card"><div className="preview-label"><i className="little-dot"/> YOUR COURSE IS READY <span>{paper.pages[0].widthMm.toFixed(1)} × {paper.pages[0].heightMm.toFixed(1)} mm</span></div><Viewer paper={paper} distance={0} running={false}/><p><Flag size={15}/> From the first millimetre to the very last.</p></div>:<TrailArt/>}</div></section><section className="how-section" id="how-it-works"><div className="how-title"><span className="eyebrow">LESS SCROLLING. MORE STROLLING.</span><h2>Research meets recess.</h2></div><div className="how-grid">{[['Pick your paper.','A journal article, your thesis, that report.','We measure every page, right here.'],['Find your rhythm.','Slide up with alternating fingers.','Your fingertips do the legwork.'],['Meet your finish line.','Get your time, speed, and page splits.','A tiny run. A satisfying finish.']].map(([title,a,b],i)=><article key={title}><span className="step-number">0{i+1}</span><div><h3>{title}</h3><p>{a}<br/>{b}</p></div></article>)}</div></section></>}
  {mobile === true && <input type="file" accept="application/pdf,.pdf" ref={input} className="visually-hidden" aria-label="Choose a PDF" onChange={e=>{const file=e.target.files?.[0];if(file)void loadFile(file);}}/>}<footer><span className="footer-brand">paper<span>run</span></span><span>Made for curious minds & restless fingers.</span><span><LockKeyhole size={12}/> Local by design.</span></footer>
  {help&&<div className="modal-backdrop" onClick={closeHelp}><div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')closeHelp();if(e.key==='Tab'){e.preventDefault();helpClose.current?.focus();}}}><button className="icon-button modal-close" ref={helpClose} onClick={closeHelp} aria-label="Close instructions"><X size={21}/></button><Footprints size={32} className="purple"/><h2 id="help-title">A quick warm-up.</h2><ol><li><strong>Choose a PDF.</strong> Every page needs a valid physical size. Different page sizes and rotations are welcome.</li><li><strong>Use both lanes.</strong> Swipe down in either lane and alternate fingers. The paper stays in its normal reading direction while the course advances. Use a phone or tablet; the running controls respond only to touch.</li><li><strong>Cross the finish line.</strong> Travel the full height of every page to see your results. The clock runs from start to finish, including pauses, background time, and screen lock.</li></ol><p className="help-note">Distance comes from the PDF’s full paper dimensions. Swipe sensitivity uses standard screen units, so physical finger travel can differ between devices. Word counts use extractable text; scanned text is not recognised.</p><div className="privacy-line"><LockKeyhole size={15}/> No uploads. No stored PDFs.</div></div></div>}</main>;
}
