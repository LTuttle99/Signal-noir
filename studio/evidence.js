(function(){
  "use strict";
  const studio=window.DataHubStudio;if(!studio)return;
  const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s)),esc=studio.escapeHtml;
  const MAX_ROWS=10000;
  let pendingImports=[],activeImport=0,presentationIndex=0,presentationSlides=[];

  function project(){
    const p=studio.state.project;if(!p)return null;
    for(const key of ["savedViews","evidenceThreads","datasetBriefings"]) if(!Array.isArray(p[key]))p[key]=[];
    return p;
  }
  function inferType(values){
    const useful=values.filter(v=>v!==""&&v!=null);if(!useful.length)return"empty";
    const numeric=useful.filter(v=>Number.isFinite(Number(v))).length/useful.length;
    const dates=useful.filter(v=>!Number.isNaN(Date.parse(v))&&/[-/]/.test(String(v))).length/useful.length;
    if(numeric>.8)return"number";if(dates>.8)return"date";
    return new Set(useful.map(String)).size<=Math.min(30,useful.length*.45)?"category":"text";
  }
  function numericColumns(ds){return ds?ds.columns.filter(c=>inferType(ds.rows.map(r=>r[c]))==="number"):[];}
  function format(n){return Number(n).toLocaleString(undefined,{maximumFractionDigits:2});}
  function now(){return new Date().toLocaleString();}

  function buildFindings(){
    const ds=studio.activeDataset(),target=$("#evidence-findings");if(!target)return;
    if(!ds){target.innerHTML='<div class="report-empty"><div><strong>Add data to reveal traceable findings</strong><p>Every insight will link back to its calculation and source rows.</p></div></div>';return;}
    const cells=ds.rows.length*ds.columns.length;
    const filled=ds.rows.reduce((n,r)=>n+ds.columns.filter(c=>r[c]!==""&&r[c]!=null).length,0);
    const completeness=cells?Math.round(filled/cells*100):100;
    const nums=numericColumns(ds),findings=[];
    findings.push({id:"rows",kind:"Coverage",value:format(ds.rows.length)+" rows",detail:ds.columns.length+" fields available for analysis",calculation:"COUNT(rows) = "+format(ds.rows.length),rows:ds.rows.slice(0,12),color:"#37e8ff"});
    findings.push({id:"complete",kind:"Data health",value:completeness+"% complete",detail:format(cells-filled)+" blank cells detected",calculation:"Nonblank cells ÷ all cells × 100 = "+completeness+"%",rows:ds.rows.filter(r=>ds.columns.some(c=>r[c]===""||r[c]==null)).slice(0,12),color:"#9b5cff"});
    if(nums[0]){
      const col=nums[0],vals=ds.rows.map(r=>Number(r[col])).filter(Number.isFinite),total=vals.reduce((a,b)=>a+b,0),avg=vals.length?total/vals.length:0;
      findings.push({id:"metric-"+col,kind:"Leading measure",value:format(total),detail:col+" total · "+format(avg)+" average",calculation:"SUM("+col+") = "+format(total)+"; AVG("+col+") = "+format(avg),rows:[...ds.rows].sort((a,b)=>Number(b[col])-Number(a[col])).slice(0,12),color:"#ff2bd6"});
    }
    const cat=ds.columns.find(c=>inferType(ds.rows.map(r=>r[c]))==="category");
    if(cat){
      const counts={};ds.rows.forEach(r=>{const k=String(r[cat]??"Blank");counts[k]=(counts[k]||0)+1});
      const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
      if(top)findings.push({id:"category-"+cat,kind:"Largest segment",value:top[0],detail:format(top[1])+" records · "+cat,calculation:"Most frequent "+cat+" value; COUNT = "+format(top[1]),rows:ds.rows.filter(r=>String(r[cat]??"Blank")===top[0]).slice(0,12),color:"#ff7448"});
    }
    target.innerHTML=findings.map((f,i)=>'<article class="evidence-finding" data-finding="'+i+'" style="--finding-color:'+f.color+'"><small>'+esc(f.kind)+'</small><strong>'+esc(f.value)+'</strong><span>'+esc(f.detail)+'</span><div class="finding-actions"><button data-inspect="'+i+'">Inspect evidence</button><button data-discuss="'+i+'">Discuss</button></div></article>').join("");
    target._findings=findings;
  }
  function findingAt(i){return $("#evidence-findings")._findings?.[Number(i)];}
  function rowsTable(rows,ds){
    const cols=ds.columns.slice(0,7);
    return '<div class="table-shell"><table><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join("")+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>'<td>'+esc(String(r[c]??""))+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
  }
  function inspectFinding(f){
    const ds=studio.activeDataset();if(!f||!ds)return;
    studio.dialog('<div class="evidence-detail"><span class="eyebrow">'+esc(f.kind)+'</span><h2>'+esc(f.value)+'</h2><p class="muted">'+esc(f.detail)+'</p><div class="evidence-calculation">'+esc(f.calculation)+'</div><div class="surface-head"><h3>Source rows</h3><span class="badge">'+esc(ds.name)+'</span></div>'+rowsTable(f.rows,ds)+'</div>');
  }
  function discussFinding(f){
    if(!f)return;const p=project(),key=studio.activeDataset()?.id+":"+f.id;
    const render=()=>{
      const items=p.evidenceThreads.filter(t=>t.key===key);
      studio.dialog('<div class="evidence-detail"><span class="eyebrow">Finding discussion</span><h2>'+esc(f.value)+'</h2><p class="muted">'+esc(f.detail)+'</p><div class="evidence-thread">'+(items.length?items.map(t=>'<div class="evidence-comment"><strong>'+esc(t.author)+'</strong><small>'+esc(t.at)+'</small><p>'+esc(t.text)+'</p></div>').join(""):'<p class="muted">Start the conversation around this exact finding.</p>')+'</div><form id="evidence-comment-form" class="evidence-comment-form"><input id="evidence-comment-input" placeholder="Add context, a question, or a decision…" required><button class="button primary">Post</button></form></div>');
      $("#evidence-comment-form").onsubmit=e=>{e.preventDefault();const input=$("#evidence-comment-input"),text=input.value.trim();if(!text)return;p.evidenceThreads.push({id:studio.uid("thread"),key,finding:f.value,text,author:localStorage.getItem("datahub_chat_name")||"You",at:now()});studio.addActivity("Commented on a finding");studio.saveProject(true);render();};
    };render();
  }

  function parseDelimited(text,delimiter){
    const rows=[];let row=[],value="",quote=false;
    for(let i=0;i<text.length;i++){const c=text[i],next=text[i+1];if(c==='"'&&quote&&next==='"'){value+='"';i++;}else if(c==='"'){quote=!quote;}else if(c===delimiter&&!quote){row.push(value);value="";}else if((c==="\n"||c==="\r")&&!quote){if(c==="\r"&&next==="\n")i++;row.push(value);if(row.some(x=>x!==""))rows.push(row);row=[];value="";}else value+=c;}
    row.push(value);if(row.some(x=>x!==""))rows.push(row);if(!rows.length)return{columns:[],rows:[]};
    const columns=rows.shift().map((c,i)=>String(c||"Column "+(i+1)).trim());
    return{columns,rows:rows.map(vals=>Object.fromEntries(columns.map((c,i)=>[c,vals[i]??""])))};
  }
  function jsonData(text){
    const raw=JSON.parse(text),arr=Array.isArray(raw)?raw:Array.isArray(raw.data)?raw.data:[raw];
    const columns=[...new Set(arr.flatMap(x=>Object.keys(x||{})))];
    return{columns,rows:arr.map(x=>Object.fromEntries(columns.map(c=>[c,x?.[c]??""])))};
  }
  async function parseFile(file){
    const ext=file.name.split(".").pop().toLowerCase();
    if(["xlsx","xls","xlsm"].includes(ext)&&window.XLSX){
      const book=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});
      return book.SheetNames.map(sheet=>{const rows=XLSX.utils.sheet_to_json(book.Sheets[sheet],{defval:"",raw:false});const columns=[...new Set(rows.flatMap(r=>Object.keys(r)))];return{name:book.SheetNames.length>1?file.name+" · "+sheet:file.name,columns,rows,source:"file",fileName:file.name,sheet}});
    }
    const text=await file.text(),data=ext==="json"?jsonData(text):parseDelimited(text,ext==="tsv"?"\t":",");
    return[{name:file.name,...data,source:"file",fileName:file.name}];
  }
  async function previewFiles(files){
    const supported=files.filter(f=>/\.(csv|tsv|txt|json|xlsx|xls|xlsm)$/i.test(f.name));if(!supported.length)return;
    $("#import-preview").hidden=false;$("#import-preview-body").innerHTML='<div class="report-empty"><div><strong>Reading '+supported.length+' source'+(supported.length===1?"":"s")+'…</strong></div></div>';
    try{pendingImports=(await Promise.all(supported.map(parseFile))).flat().map((x,i)=>({...x,id:"import-"+i,selected:true,types:Object.fromEntries(x.columns.map(c=>[c,inferType(x.rows.map(r=>r[c]))]))}));activeImport=0;renderImport();}
    catch(error){$("#import-preview-body").innerHTML='<div class="report-empty"><div><strong>That file could not be previewed</strong><p>'+esc(error.message)+'</p></div></div>';}
  }
  function renderImport(){
    const x=pendingImports[activeImport];if(!x)return;
    const existing=project().datasets.find(d=>d.name===x.name);
    $("#import-preview-body").innerHTML='<div class="import-file-tabs">'+pendingImports.map((f,i)=>'<button class="import-file-tab '+(i===activeImport?"active":"")+'" data-import-tab="'+i+'">'+esc(f.name)+'</button>').join("")+'</div><div class="import-summary"><div><strong>'+format(x.rows.length)+'</strong><span>Rows detected</span></div><div><strong>'+x.columns.length+'</strong><span>Columns detected</span></div><div><strong>'+(existing?"Replace":"Add")+'</strong><span>'+(existing?"Existing source found":"New dataset")+'</span></div></div><label class="setting-row"><div><strong>Include this dataset</strong><span>'+(existing?"Replacing it will create a change briefing.":"It will be added to the project.")+'</span></div><input id="include-import" type="checkbox" '+(x.selected?"checked":"")+'></label><div class="table-shell"><table><thead><tr>'+x.columns.map(c=>'<th>'+esc(c)+'<select class="type-select" data-type-column="'+esc(c)+'"><option value="text" '+(x.types[c]==="text"?"selected":"")+'>Text</option><option value="number" '+(x.types[c]==="number"?"selected":"")+'>Number</option><option value="date" '+(x.types[c]==="date"?"selected":"")+'>Date</option><option value="category" '+(x.types[c]==="category"?"selected":"")+'>Category</option></select></th>').join("")+'</tr></thead><tbody>'+x.rows.slice(0,8).map(r=>'<tr>'+x.columns.map(c=>'<td>'+esc(String(r[c]??""))+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
    $$("[data-import-tab]").forEach(b=>b.onclick=()=>{activeImport=+b.dataset.importTab;renderImport()});
    $("#include-import").onchange=e=>x.selected=e.target.checked;
    $$("[data-type-column]").forEach(s=>s.onchange=()=>x.types[s.dataset.typeColumn]=s.value);
  }
  function coerce(value,type){
    if(value===""||value==null)return value;if(type==="number")return Number.isFinite(Number(value))?Number(value):value;
    if(type==="date"){const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toISOString();}
    return String(value);
  }
  function compareDataset(before,after){
    const addedCols=after.columns.filter(c=>!before.columns.includes(c)),removedCols=before.columns.filter(c=>!after.columns.includes(c));
    const common=after.columns.filter(c=>before.columns.includes(c)),numeric=common.filter(c=>inferType(after.rows.map(r=>r[c]))==="number");
    const movements=numeric.slice(0,5).map(c=>{const avg=rows=>{const v=rows.map(r=>Number(r[c])).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0};const a=avg(before.rows),b=avg(after.rows);return{column:c,before:a,after:b,delta:a?((b-a)/Math.abs(a))*100:0}}).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
    return{id:studio.uid("brief"),dataset:after.name,at:now(),beforeRows:before.rows.length,afterRows:after.rows.length,addedCols,removedCols,movements};
  }
  function confirmImport(){
    const p=project(),selected=pendingImports.filter(x=>x.selected);if(!selected.length)return studio.toast("Select at least one dataset.");
    let latest=null;
    for(const x of selected){
      const rows=x.rows.slice(0,MAX_ROWS).map(r=>Object.fromEntries(x.columns.map(c=>[c,coerce(r[c],x.types[c])])));
      const next={id:studio.uid("data"),name:x.name,columns:x.columns,rows,originalRowCount:x.rows.length,source:"file",addedAt:Date.now(),columnTypes:x.types};
      const old=p.datasets.find(d=>d.name===x.name);
      if(old){next.id=old.id;const idx=p.datasets.indexOf(old);p.datasets[idx]=next;latest=compareDataset(old,next);p.datasetBriefings.unshift(latest);}
      else p.datasets.push(next);
      p.activeDatasetId=next.id;
    }
    studio.addActivity("Reviewed and imported "+selected.length+" dataset"+(selected.length===1?"":"s"));studio.renderAll();studio.saveProject(true);closeImport();if(latest)renderBriefing(latest);studio.toast(selected.length+" data source"+(selected.length===1?"":"s")+" ready.");
  }
  function closeImport(){$("#import-preview").hidden=true;pendingImports=[];$("#studio-file-input").value="";$("#studio-folder-input").value="";}
  function renderBriefing(b=project().datasetBriefings[0]){
    const panel=$("#change-briefing-panel");if(!b){panel.hidden=true;return;}panel.hidden=false;
    const delta=b.afterRows-b.beforeRows;
    $("#change-briefing-content").innerHTML='<div class="change-grid"><div class="change-stat"><strong>'+format(b.beforeRows)+'</strong><span>Previous rows</span></div><div class="change-stat"><strong>'+format(b.afterRows)+'</strong><span>Current rows</span></div><div class="change-stat"><strong>'+(delta>0?"+":"")+format(delta)+'</strong><span>Row change</span></div><div class="change-stat"><strong>'+format(b.addedCols.length+b.removedCols.length)+'</strong><span>Schema changes</span></div></div><div class="change-list">'+(b.addedCols.map(c=>'<div class="change-item"><span>New field</span><b>+ '+esc(c)+'</b></div>').join("")+b.removedCols.map(c=>'<div class="change-item"><span>Removed field</span><b>− '+esc(c)+'</b></div>').join("")+b.movements.slice(0,4).map(m=>'<div class="change-item"><span>'+esc(m.column)+' average</span><b>'+(m.delta>=0?"+":"")+m.delta.toFixed(1)+'%</b></div>').join("")||'<div class="change-item"><span>No major schema or numeric shifts detected</span><b>Stable</b></div>')+'</div>';
    panel.scrollIntoView({behavior:"smooth",block:"center"});
  }

  async function diagnoseConnection(){
    const type=$("#connector-type").value,url=$("#connector-url").value.trim(),node=$("#connection-diagnosis");node.hidden=false;
    if(!url){node.innerHTML=diagnosis(false,"Add a link first",["Paste the exact share or export URL.","Choose the matching source type.","Run the diagnosis again."]);return;}
    if(type==="database"){node.innerHTML=diagnosis(false,"A secure gateway is required",["Create a read-only HTTPS endpoint for the approved query or view.","Allow this site’s origin in CORS.","Return JSON or CSV, then connect that endpoint as a URL source."]);return;}
    if(type==="google"&&!/\/spreadsheets\/d\//.test(url)){node.innerHTML=diagnosis(false,"This is not a Google Sheets link",["Open the spreadsheet.","Choose Share and enable link access or publish the sheet.","Copy the full Sheets URL."]);return;}
    node.innerHTML=diagnosis(true,"Testing reachability…",[]);
    try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);const response=await fetch(url,{method:"GET",signal:controller.signal});clearTimeout(timer);
      const typeHeader=response.headers.get("content-type")||"unknown";
      node.innerHTML=response.ok?diagnosis(true,"Source is reachable",["Response "+response.status+" received.","Content type: "+typeHeader+".","You can connect this source now."]):diagnosis(false,"The source returned "+response.status,["Check that link sharing is enabled.","Use a direct CSV/JSON export URL.","Confirm the source allows browser requests (CORS)."]);
    }catch(error){node.innerHTML=diagnosis(false,error.name==="AbortError"?"The source timed out":"The browser could not reach this source",["Check that the URL opens in a private browser window.","Confirm link permissions allow anonymous viewing.","If it opens but still fails, the host may block browser requests through CORS."]);}
  }
  function diagnosis(good,title,steps){return '<div class="diagnosis-head"><i class="diagnosis-state '+(good?"good":"")+'"></i><strong>'+esc(title)+'</strong></div>'+(steps.length?'<ol>'+steps.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ol>':"");}

  function captureControls(){
    const root=$(".studio-view.active"),values={};if(!root)return values;
    root.querySelectorAll("select,input:not([type=file]),textarea").forEach(el=>{if(el.id)values[el.id]=el.type==="checkbox"?el.checked:el.value});
    return values;
  }
  function saveView(){
    const p=project(),view=studio.state.activeView,ds=studio.activeDataset();
    studio.dialog('<span class="eyebrow">Saved analysis view</span><h2>Save this exact workspace</h2><p class="muted">Dataset, tool, tabs, filters, and selections will reopen together.</p><form id="save-view-form" class="form-grid" style="margin-top:16px"><input id="saved-view-name" value="'+esc((viewLabels[view]||view)+" · "+(ds?.name||"No data"))+'" required><button class="button primary">Save view</button></form>');
    $("#save-view-form").onsubmit=e=>{e.preventDefault();p.savedViews.unshift({id:studio.uid("view"),name:$("#saved-view-name").value.trim(),view,datasetId:ds?.id||null,controls:captureControls(),analystTab:$("[data-analyst-tab].active")?.dataset.analystTab||null,opsTab:$("[data-ops-tab].active")?.dataset.opsTab||null,at:now()});p.savedViews=p.savedViews.slice(0,30);studio.addActivity("Saved analysis view");studio.saveProject(true);studio.closeDialog();renderViewCount();studio.toast("Analysis view saved.");};
  }
  const viewLabels={overview:"Overview",data:"Data",workflow:"Workflow",dictionary:"Dictionary",quality:"Quality",intelligence:"Intelligence",analyst:"Analyst Lab",operations:"Operations",report:"Report",automate:"Automation",builder:"Tool Builder"};
  function openSavedViews(){
    const p=project();
    studio.dialog('<span class="eyebrow">Saved views</span><h2>Return to an analysis</h2><div class="saved-view-list">'+(p.savedViews.length?p.savedViews.map(v=>'<div class="saved-view"><span><strong>'+esc(v.name)+'</strong><small>'+esc(v.at)+'</small></span><button class="icon-button" data-restore-view="'+v.id+'">Open</button><button class="icon-button" data-delete-view="'+v.id+'">×</button></div>').join(""):'<p class="muted">Save a view to preserve the current dataset, workspace, and controls.</p>')+'</div>');
    $$("[data-restore-view]").forEach(b=>b.onclick=()=>restoreView(b.dataset.restoreView));
    $$("[data-delete-view]").forEach(b=>b.onclick=()=>{p.savedViews=p.savedViews.filter(v=>v.id!==b.dataset.deleteView);studio.markDirty();openSavedViews();renderViewCount()});
  }
  function restoreView(id){
    const v=project().savedViews.find(x=>x.id===id);if(!v)return;if(v.datasetId)project().activeDatasetId=v.datasetId;
    studio.renderAll();studio.showView(v.view);setTimeout(()=>{Object.entries(v.controls||{}).forEach(([id,val])=>{const el=document.getElementById(id);if(el){if(el.type==="checkbox")el.checked=val;else el.value=val;el.dispatchEvent(new Event("change",{bubbles:true}));}});if(v.analystTab)$('[data-analyst-tab="'+v.analystTab+'"]')?.click();if(v.opsTab)$('[data-ops-tab="'+v.opsTab+'"]')?.click();},100);studio.closeDialog();studio.toast("Saved view restored.");
  }
  function renderViewCount(){const p=project();if(!p)return;$("#saved-view-count").textContent=p.savedViews.length;}

  function makeSlides(){
    const p=project(),ds=studio.activeDataset(),r=p.report;
    if(!r&&ds)$("#generate-report-btn")?.click();
    const report=p.report;
    const slides=[{kicker:"Signal Noir Studio",title:p.name,text:p.goal||"A clear path from source data to a defensible decision.",notes:"Open with the decision this work supports and who needs to act."}];
    if(ds)slides.push({kicker:"Evidence base",title:format(ds.rows.length)+" records. "+ds.columns.length+" fields.",text:"Source: "+ds.name+". The analysis remains linked to the underlying rows.",kpis:[[""+format(ds.rows.length),"Rows"],[""+ds.columns.length,"Fields"],[""+(report?.quality?.score??"—"),"Quality"]],notes:"Explain the source, period covered, and any limits before presenting results."});
    if(report?.summary?.numeric?.[0]){const m=report.summary.numeric[0];slides.push({kicker:"Leading measure",title:format(m.total),text:m.column+" totals "+format(m.total)+" with an average of "+format(m.average)+".",kpis:[[format(m.min),"Minimum"],[format(m.average),"Average"],[format(m.max),"Maximum"]],notes:"Connect this measure to the decision. Avoid implying causation unless the analysis supports it."});}
    if(report?.summary?.breakdown?.length){const top=report.summary.breakdown[0];slides.push({kicker:"Largest segment",title:String(top[0]),text:format(top[1])+" records make this the largest "+report.summary.category+" segment.",notes:"Call out whether this mix is expected and what it changes operationally."});}
    slides.push({kicker:"Decision",title:"What happens next?",text:"Review exceptions, agree on the decision, and assign an owner with a due date in Operations.",notes:"Close with one decision, one owner, and one next checkpoint."});
    return slides;
  }
  function openPresentation(){presentationSlides=makeSlides();presentationIndex=0;$("#presentation-mode").hidden=false;document.body.style.overflow="hidden";renderSlide();}
  function closePresentation(){$("#presentation-mode").hidden=true;document.body.style.overflow="";}
  function renderSlide(){
    const s=presentationSlides[presentationIndex];if(!s)return;
    $("#presentation-progress").textContent=(presentationIndex+1)+" / "+presentationSlides.length;
    $("#presentation-slide").innerHTML='<div class="presentation-slide"><span class="presentation-kicker">'+esc(s.kicker)+'</span><h1>'+esc(s.title)+'</h1><p>'+esc(s.text)+'</p>'+(s.kpis?'<div class="presentation-kpis">'+s.kpis.map(k=>'<div class="presentation-kpi"><strong>'+esc(k[0])+'</strong><span>'+esc(k[1])+'</span></div>').join("")+'</div>':"")+'</div>';
    $("#presentation-notes").textContent=s.notes;$("#presentation-dots").innerHTML=presentationSlides.map((_,i)=>'<i class="presentation-dot '+(i===presentationIndex?"active":"")+'"></i>').join("");
    $("#presentation-prev-btn").disabled=presentationIndex===0;$("#presentation-next-btn").textContent=presentationIndex===presentationSlides.length-1?"✓":"→";
  }
  function moveSlide(d){if(presentationIndex+d<0)return;if(presentationIndex+d>=presentationSlides.length){closePresentation();return;}presentationIndex+=d;renderSlide();}

  $("#evidence-findings").addEventListener("click",e=>{const discuss=e.target.closest("[data-discuss]"),inspect=e.target.closest("[data-inspect]"),card=e.target.closest("[data-finding]");if(discuss){e.stopPropagation();discussFinding(findingAt(discuss.dataset.discuss));}else if(inspect){e.stopPropagation();inspectFinding(findingAt(inspect.dataset.inspect));}else if(card)inspectFinding(findingAt(card.dataset.finding));});
  $("#report-canvas").addEventListener("click",e=>{const row=e.target.closest(".bar-row");if(!row)return;const ds=studio.activeDataset(),category=project().report?.summary?.category,label=row.querySelector("span")?.textContent,value=row.querySelector("strong")?.textContent;if(!ds||!category||!label)return;discussFinding({id:"chart-"+category+"-"+label,kind:"Chart segment",value:label,detail:(value||"")+" records in "+category,calculation:"COUNT where "+category+" = "+label,rows:ds.rows.filter(r=>String(r[category]??"Blank")===label).slice(0,12)});});
  $("#refresh-evidence-btn").onclick=buildFindings;
  const fileInput=$("#studio-file-input"),folderInput=$("#studio-folder-input");fileInput.onchange=e=>previewFiles([...e.target.files]);folderInput.onchange=e=>previewFiles([...e.target.files]);
  $("#studio-drop-zone").addEventListener("drop",e=>{const files=[...e.dataTransfer.files];if(files.some(f=>/\.zip$/i.test(f.name)))return;e.preventDefault();e.stopImmediatePropagation();previewFiles(files);},true);
  $("#close-import-preview").onclick=closeImport;$("#cancel-import-btn").onclick=closeImport;$("#confirm-import-btn").onclick=confirmImport;
  $("#import-preview").addEventListener("click",e=>{if(e.target===$("#import-preview"))closeImport()});
  $("#diagnose-connection-btn").onclick=diagnoseConnection;
  $("#dismiss-change-briefing").onclick=()=>$("#change-briefing-panel").hidden=true;
  $("#save-analysis-view-btn").onclick=saveView;$("#open-saved-views-btn").onclick=openSavedViews;
  $("#start-presentation-btn").onclick=openPresentation;$("#close-presentation-btn").onclick=closePresentation;
  $("#present-report-btn").onclick=openPresentation;
  $$('[data-mobile-view]').forEach(button=>button.onclick=()=>studio.showView(button.dataset.mobileView));
  $("#presentation-prev-btn").onclick=()=>moveSlide(-1);$("#presentation-next-btn").onclick=()=>moveSlide(1);
  $("#presentation-notes-btn").onclick=()=>$("#presentation-notes").hidden=!$("#presentation-notes").hidden;
  $("#presentation-fullscreen-btn").onclick=()=>$("#presentation-mode").requestFullscreen?.();
  document.addEventListener("keydown",e=>{if($("#presentation-mode").hidden)return;if(e.key==="ArrowRight"||e.key===" "){e.preventDefault();moveSlide(1)}if(e.key==="ArrowLeft"){e.preventDefault();moveSlide(-1)}if(e.key==="Escape"&&!document.fullscreenElement)closePresentation();});
  window.addEventListener("datahub:project-render",()=>{buildFindings();renderViewCount();});
  if(studio.state.project){buildFindings();renderViewCount();}
})();
