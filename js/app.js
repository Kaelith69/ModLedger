/* ModLedger — simplified app.js
   - Binary status: suspended / active
   - No confidence, reportedBy removed
   - Reason optional
*/

const STATUS_META = {
  suspended: { label: 'Suspended', short:'SUSP', hex:'#d94f4f', bg:'#1e0a0a', border:'#4a1515' },
  active:    { label: 'Active',    short:'ACTV', hex:'#3d9e6a', bg:'#071510', border:'#0e2e1e' },
};

const REASONS = [
  'Ban evasion','Harassment','Spam','Coordinated behavior','Doxxing / Privacy','Hate','Misinformation','Brigading','Vote manipulation','Other'
];

const uid = () => Date.now() + Math.floor(Math.random()*9999);
const IS_MOCK = true;
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtDate = iso => !iso ? '—' : new Date(iso).toLocaleDateString();
const fmtRel = iso => { if(!iso) return 'pending'; const m=Math.floor((Date.now()-new Date(iso))/60000); if(m<1) return 'just now'; if(m<60) return `${m}m ago`; const h=Math.floor(m/60); if(h<24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`; };

// MOCK DATA (simplified)
const RAW = [
  {username:'xX_Void_Xx', subreddit:'r/gaming', reason:'Ban evasion', status:'suspended', notes:'Linked accounts found.'},
  {username:'throwaway_8821', subreddit:'r/news', reason:'Harassment', status:'active', notes:''},
  {username:'real_person_99', subreddit:'r/worldnews', reason:'Spam', status:'suspended', notes:''},
  {username:'NotABot2024', subreddit:'r/politics', reason:'Coordinated behavior', status:'active', notes:''},
  {username:'shadow_acc_lol', subreddit:'r/gaming', reason:'Ban evasion', status:'active', notes:'Needs follow-up.'},
  {username:'fresh_start_444', subreddit:'r/technology', reason:'Ban evasion', status:'suspended', notes:''},
  {username:'user_deleted_1', subreddit:'r/science', reason:'Doxxing / Privacy', status:'suspended', notes:''},
  {username:'burner_acc_92', subreddit:'r/news', reason:'Harassment', status:'active', notes:''},
  {username:'AltAccount_v2', subreddit:'r/worldnews', reason:'Ban evasion', status:'active', notes:''},
  {username:'totally_new_guy', subreddit:'r/gaming', reason:'Spam', status:'active', notes:''},
];

let DB = RAW.map((u,i)=>({ ...u, id:i+1, dateReported:new Date(Date.now()-(i+1)*86400000).toISOString(), lastChecked:new Date().toISOString(), nextCheck:new Date(Date.now()+3600000).toISOString(), history:[{id:0,from:null,to:u.status,checkedAt:new Date().toISOString(),source:'mock'}]}));

const State = { view:'users', search:'', statusFilter:'all', subFilter:'all', sortKey:'dateReported', sortDir:'desc', page:0, pageSize:25, selected:new Set(), refreshing:new Set(), flashIds:new Set() };

function badgeHTML(status, sm){ const m = STATUS_META[status]||STATUS_META.active; const cls = sm ? 'badge badge-sm' : 'badge'; return `<span class="${cls} status-${status}"><span class="badge-dot"></span>${esc(m.short)}</span>`; }

const COLS = [
  {key:'username', label:'User', w:160},
  {key:'subreddit', label:'Sub', w:110},
  {key:'status', label:'Status', w:110},
  {key:'reason', label:'Reason', w:180},
  {key:'dateReported', label:'Date', w:90},
  {key:'lastChecked', label:'Last Check', w:90},
];

function getFiltered(){ let r=DB; if(State.search.trim()){ const q=State.search.toLowerCase(); r=r.filter(u=>u.username.toLowerCase().includes(q)||u.subreddit.toLowerCase().includes(q)|| (u.reason||'').toLowerCase().includes(q) || (u.notes||'').toLowerCase().includes(q)); } if(State.statusFilter!=='all') r=r.filter(u=>u.status===State.statusFilter); if(State.subFilter!=='all') r=r.filter(u=>u.subreddit===State.subFilter); const fns={username:u=>u.username.toLowerCase(), subreddit:u=>u.subreddit, status:u=>u.status, reason:u=>u.reason||'', dateReported:u=>u.dateReported, lastChecked:u=>u.lastChecked||''}; const fn=fns[State.sortKey]||fns.dateReported; return [...r].sort((a,b)=>{const av=fn(a),bv=fn(b); return State.sortDir==='asc'?(av<bv?-1:av>bv?1:0):(av>bv?-1:av<bv?1:0); }); }

function renderStats(){ const s={ total:DB.length, suspended:DB.filter(u=>u.status==='suspended').length, active:DB.filter(u=>u.status==='active').length }; const cards=[ {label:'Tracked', value:s.total}, {label:'Suspended', value:s.suspended}, {label:'Active', value:s.active} ]; const accentClasses = ['stat-accent-a','stat-accent-b','stat-accent-c']; document.getElementById('stats-row').innerHTML = cards.map((c,i)=>`<div class="stat-card ${accentClasses[i]}"><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>`).join('') + `<div class="spacer"></div><div class="stat-actions"><button class="btn btn-md btn-primary" id="add-user-btn">＋ Track User</button></div>`; document.getElementById('sb-text').textContent = `MODLEDGER · ${s.total} tracked · ${s.suspended} suspended`; document.getElementById('add-user-btn')?.addEventListener('click', ()=>ML.openAddModal()); }

function renderPills(){ const counts = DB.reduce((a,u)=>{ a[u.status]=(a[u.status]||0)+1; return a; },{}); counts.all = DB.length; const filters=[{key:'all',label:'ALL'},...Object.keys(STATUS_META).map(k=>({key:k,label:STATUS_META[k].short}))]; document.getElementById('filter-pills').innerHTML = filters.map(f=>`<button class="pill ${State.statusFilter===f.key?'active':''}" data-sf="${f.key}">${f.label}${counts[f.key]!==undefined?`<span class="pill-count">${counts[f.key]}</span>`:''}</button>`).join(''); document.querySelectorAll('.pill').forEach(p=>p.addEventListener('click',()=>{ State.statusFilter=p.dataset.sf; State.page=0; renderPills(); renderTable(); })); }

function renderSubFilter(){ const subs=['all',...new Set(DB.map(u=>u.subreddit))].sort(); const sel=document.getElementById('sub-sel'); sel.innerHTML=subs.map(s=>`<option ${s===State.subFilter?'selected':''}>${s}</option>`).join(''); sel.addEventListener('change',()=>{ State.subFilter=sel.value; State.page=0; renderTable(); }); }

function spinnerHTML(size=10){ const sz = size<=12 ? 'spinner-sm' : size<=18 ? 'spinner-md' : 'spinner-lg'; return `<div class="spinner ${sz}"></div>`; }

function renderTableHead(){ const allSel = false; const head = `<tr><th class="th-select"><input type="checkbox" id="select-all" class="row-cb" /></th>${COLS.map(c=>`<th data-col="${c.key}" style="min-width:${c.w}px" class="${State.sortKey===c.key?'sort-active':''}">${c.label}<span class="sort-arrow">${State.sortKey===c.key?(State.sortDir==='asc'?'▲':'▼'):'⬍'}</span></th>`).join('')}<th class="th-actions">ACTIONS</th></tr>`; document.getElementById('table-head').innerHTML = head; document.querySelectorAll('#table-head th[data-col]').forEach(th=>{ th.addEventListener('click',()=>{ const key=th.dataset.col; if(State.sortKey===key) State.sortDir=State.sortDir==='asc'?'desc':'asc'; else{ State.sortKey=key; State.sortDir='desc'; } updateTableHeadSort(); renderTable(); }); }); }

function updateTableHeadSort(){ document.querySelectorAll('#table-head th[data-col]').forEach(th=>{ const key=th.dataset.col; th.classList.toggle('sort-active', State.sortKey===key); const span = th.querySelector('.sort-arrow'); if(span) span.textContent = State.sortKey===key ? (State.sortDir==='asc'?'▲':'▼') : '⬍'; }); }

function renderTable(){
  const filtered=getFiltered();
  const total=filtered.length;
  const totalPages=Math.ceil(total/State.pageSize);
  if(State.page>=totalPages && totalPages>0) State.page=totalPages-1;
  if(State.page<0) State.page=0;
  const paged=filtered.slice(State.page*State.pageSize,(State.page+1)*State.pageSize);
  const allSel = paged.length>0 && paged.every(u=>State.selected.has(u.id));

  // keep header stable — update select-all and sync sort UI
  const selAllEl = document.getElementById('select-all'); if(selAllEl) selAllEl.checked = allSel; updateTableHeadSort();

  if(paged.length===0){
    document.getElementById('table-body').innerHTML = `<tr class="empty-row"><td colspan="${COLS.length+2}">${State.search||State.statusFilter!=='all'||State.subFilter!=='all'?'No users match the current filters.':'No tracked users yet.'}</td></tr>`;
  } else {
    document.getElementById('table-body').innerHTML = paged.map(u=>{
      const isSel = State.selected.has(u.id);
      const isRef = State.refreshing.has(u.id);
      const isFlash = State.flashIds.has(u.id);
      return `<tr data-id="${u.id}" class="${isSel?'sel':''} ${isFlash?'row-flash':''}"><td><input type="checkbox" class="row-cb" data-id="${u.id}" ${isSel?'checked':''}/></td><td class="td-user"><div class="td-user-inner">${isRef?spinnerHTML(10):''}<a href="https://reddit.com/user/${esc(u.username)}" target="_blank" rel="noopener noreferrer">u/${esc(u.username)}</a></div></td><td class="td-sub">${esc(u.subreddit)}</td><td>${badgeHTML(u.status,false)}</td><td class="td-reason" title="${esc(u.reason||'')}">${esc(u.reason||'—')}</td><td class="td-date">${fmtDate(u.dateReported)}</td><td class="td-check">${isRef?`<span class="check-loading">${spinnerHTML(10)}checking…</span>`:fmtRel(u.lastChecked)}</td><td class="td-actions"><div class="action-btns"><div class="tip-wrap"><button class="action-btn" data-action="refresh" data-id="${u.id}" ${isRef?'disabled':''} title="Refresh">${isRef?spinnerHTML(10):'↻'}</button><span class="tip">Refresh status</span></div><div class="tip-wrap"><button class="action-btn" data-action="history" data-id="${u.id}">≡</button><span class="tip">View history</span></div><div class="tip-wrap"><button class="action-btn" data-action="edit" data-id="${u.id}">✎</button><span class="tip">Edit</span></div><div class="tip-wrap"><button class="action-btn danger-btn" data-action="delete" data-id="${u.id}">×</button><span class="tip">Remove</span></div></div></td></tr>`;
    }).join('');
  }

  document.getElementById('result-count').textContent = `${total} result${total!==1?'s':''}`;
  const bulkEl = document.getElementById('bulk-actions'); const countEl = document.getElementById('bulk-count'); if(State.selected.size>0){ bulkEl.style.display='flex'; countEl.textContent = `${State.selected.size} selected`; } else { bulkEl.style.display='none'; }

  const pagEl = document.getElementById('pagination'); const piEl = document.getElementById('page-info'); const pbEl = document.getElementById('page-btns');
  if(totalPages>1){
    pagEl.style.display='flex'; piEl.textContent = `${State.page*State.pageSize+1}–${Math.min((State.page+1)*State.pageSize,total)} of ${total}`;
    let pBtns = `<button class="btn btn-sm btn-secondary" data-page="0" ${State.page===0?'disabled':''}>«</button><button class="btn btn-sm btn-secondary" data-page="${State.page-1}" ${State.page===0?'disabled':''}>‹ Prev</button>`;
    const maxP=Math.min(totalPages,7); const start=totalPages<=7?0:State.page<4?0:State.page>totalPages-4?totalPages-7:State.page-3;
    for(let i=0;i<maxP;i++){const p=start+i;pBtns+=`<button class="btn btn-sm page-num ${p===State.page?'active':''}" data-page="${p}">${p+1}</button>`;}
    pBtns+=`<button class="btn btn-sm btn-secondary" data-page="${State.page+1}" ${State.page===totalPages-1?'disabled':''}>Next ›</button><button class="btn btn-sm btn-secondary" data-page="${totalPages-1}" ${State.page===totalPages-1?'disabled':''}>»</button>`;
    pbEl.innerHTML=pBtns;
  } else { pagEl.style.display='none'; }

  bindTableEvents();
}

function bindTableEvents(){
  document.getElementById('select-all')?.addEventListener('change',e=>{ const filtered=getFiltered(); const paged=filtered.slice(State.page*State.pageSize,(State.page+1)*State.pageSize); if(e.target.checked) paged.forEach(u=>State.selected.add(u.id)); else paged.forEach(u=>State.selected.delete(u.id)); renderTable(); });
  document.querySelectorAll('.row-cb').forEach(cb=>{ cb.addEventListener('change',e=>{ const id=Number(e.target.dataset.id); e.target.checked?State.selected.add(id):State.selected.delete(id); renderTable(); }); });
  document.querySelectorAll('[data-action]').forEach(btn=>{ btn.addEventListener('click',e=>{ const id=Number(btn.dataset.id); const action=btn.dataset.action; if(action==='refresh') ML.refresh(id); else if(action==='history') ML.openHistory(id); else if(action==='edit') ML.openEdit(id); else if(action==='delete') ML.confirmDelete(id); }); });
  document.querySelectorAll('[data-page]').forEach(btn=>{ btn.addEventListener('click',()=>{ if(!btn.disabled){ State.page=Number(btn.dataset.page); renderTable(); } }); });
  document.getElementById('bulk-refresh-btn')?.addEventListener('click',()=>{ State.selected.forEach(id=>ML.refresh(id)); ML.toast(`Refreshing ${State.selected.size} users…`,'info'); });
  document.getElementById('bulk-delete-btn')?.addEventListener('click',()=>ML.confirmBulkDelete());
}

function renderAnalytics(){ const el=document.getElementById('view-analytics'); const total=DB.length; if(!total){ el.innerHTML='<div class="no-data-analytics">No data to analyze.</div>'; return; } const byStatus=Object.entries(DB.reduce((a,u)=>{ a[u.status]=(a[u.status]||0)+1; return a; },{})); const bySub=Object.entries(DB.reduce((a,u)=>{ a[u.subreddit]=(a[u.subreddit]||0)+1; return a; },{})).sort((a,b)=>b[1]-a[1]).slice(0,8); const suspRate=Math.round((DB.filter(u=>u.status==='suspended').length/total)*100);
  const heroItem=(label,value,color,sub='')=>`<div class="hero-metric"><div class="hero-value" style="--hv:${color}">${value}</div><div class="hero-label">${label}</div>${sub?`<div class="hero-sub">${sub}</div>`:''}</div>`;
  const barHTML=(label,v,color)=>{ const pct = (v/total*100).toFixed(1); return `<div class="bar-row"><div class="bar-row-head"><span class="bar-row-label">${esc(label)}</span><span class="bar-row-val" style="color:${color||'var(--t1)'}">${v} <span class="bar-row-pct">(${Math.round(v/total*100)}%)</span></span></div><div class="bar-track"><div class="bar-fill" style="--pct:${pct}%;--fill:${color||'var(--ac)'}"></div></div></div>` };
  el.innerHTML = `<div class="analytics-hero">${heroItem('Suspension Rate',suspRate+'%','#d94f4f')}<div class="vdiv"></div>${heroItem('Tracked',total,'#4a4acc')}</div><div class="analytics-grid"><div class="a-section"><div class="a-section-title">Top Subreddits</div>${bySub.map(([s,v])=>barHTML(s,v,'var(--ac)')).join('')}</div><div class="a-section"><div class="a-section-title">By Status</div>${byStatus.map(([s,v])=>barHTML(STATUS_META[s]?.label||s,v,STATUS_META[s]?.hex)).join('')}</div></div>`; }

function renderSettings(){ const el=document.getElementById('view-settings'); el.innerHTML=`<div class="settings-wrap"><div class="settings-card"><div class="settings-section">Appearance</div><div class="field"><label class="field-label">Theme</label><select><option>Dark</option><option>Light</option></select></div><div class="settings-section">Data Export</div><div class="field"><label class="field-label">Export Format</label><select><option>CSV</option><option>JSON</option></select></div><div class="settings-footer"><button class="btn btn-md btn-primary" id="save-settings-btn">✓ Save Settings</button></div></div></div>`; document.getElementById('save-settings-btn')?.addEventListener('click',()=>{ ML.toast('Settings saved','success'); }); }

function flashRow(id){ State.flashIds.add(id); setTimeout(()=>{ State.flashIds.delete(id); renderTable(); },1200); }

function toast(msg,type='info'){ const container=document.getElementById('toast-container'); const t=document.createElement('div'); t.className=`toast ${type}`; t.textContent=msg; container.appendChild(t); setTimeout(()=>t.remove(),3000); }

const ML = {
  toast,
  refresh(id){ if(State.refreshing.has(id)) return; State.refreshing.add(id); renderTable(); updateStatusBar(); setTimeout(()=>{ State.refreshing.delete(id); const u=DB.find(x=>x.id===id); if(u){ const maybeFlip = IS_MOCK && Math.random()>0.85; if(maybeFlip) u.status = (u.status==='suspended'?'active':'suspended'); u.lastChecked = new Date().toISOString(); u.history.push({id:u.history.length,from:u.history[u.history.length-1]?.to||null,to:u.status,checkedAt:new Date().toISOString(),source:'check'}); } flashRow(id); updateStatusBar(); toast(`${u?.username} refreshed`,'success'); },800+Math.random()*800); },

  openAddModal(){ const body=`<div id="form-error" class="form-error"></div><div class="field"><label class="field-label">Reddit Username</label><input id="fi-username" placeholder="u/username" autofocus/></div><div class="field"><label class="field-label">Subreddit</label><input id="fi-sub" placeholder="r/gaming"/></div><div class="field"><label class="field-label">Reason (optional)</label><select id="fi-reason">${REASONS.map(r=>`<option>${r}</option>`).join('')}</select></div><div class="field"><label class="field-label">Notes</label><textarea id="fi-notes" rows="3" placeholder="Optional"></textarea></div><div class="modal-footer"><button class="btn btn-md btn-secondary" onclick="ML.closeModal()">Cancel</button><button class="btn btn-md btn-primary" id="add-submit-btn">＋ Add to Ledger</button></div>`; openModal('Track New User',body,480); setTimeout(()=>document.getElementById('fi-username')?.focus(),50); document.getElementById('add-submit-btn').addEventListener('click',()=>{ const un=(document.getElementById('fi-username').value||'').trim().replace(/^u\//,''); if(!un){const e=document.getElementById('form-error'); e.style.display='block'; e.textContent='Username is required.'; return;} const nu={ id:uid(), username:un, subreddit:document.getElementById('fi-sub').value||'r/unknown', reason:document.getElementById('fi-reason').value||'', notes:document.getElementById('fi-notes').value||'', status:'active', dateReported:new Date().toISOString(), lastChecked:null, nextCheck:new Date(Date.now()+900000).toISOString(), history:[] }; DB.unshift(nu); State.page=0; ML.closeModal(); renderAll(); flashRow(nu.id); toast(`u/${nu.username} added`,'success'); }); },

  openBulkModal(){ const body=`<div class="field"><label class="field-label">Usernames</label><div class="field-hint compact">One per line or comma-separated. u/ prefix optional.</div><textarea id="bulk-text" rows="7" placeholder="u/user1\nu/user2\nuser3, user4"></textarea></div><div id="bulk-preview" class="bulk-preview"></div><div class="form-row"><div class="field"><label class="field-label">Subreddit</label><input id="bulk-sub" placeholder="r/gaming"/></div><div class="field"><label class="field-label">Reason</label><select id="bulk-reason">${REASONS.map(r=>`<option>${r}</option>`).join('')}</select></div></div><div class="modal-footer"><button class="btn btn-md btn-secondary" onclick="ML.closeModal()">Cancel</button><button class="btn btn-md btn-primary" id="bulk-submit-btn">⬆ Import 0 Users</button></div>`; openModal('Bulk Import Users',body,560); const textEl=document.getElementById('bulk-text'); const previewEl=document.getElementById('bulk-preview'); const submitEl=document.getElementById('bulk-submit-btn'); const getParsed=()=>textEl.value.split(/[,\n]+/).map(u=>u.trim().replace(/^u\//,'')).filter(Boolean); textEl.addEventListener('input',()=>{ const p=getParsed(); submitEl.textContent=`⬆ Import ${p.length} User${p.length!==1?'s':''}`; previewEl.textContent=p.length?`${p.length} user${p.length>1?'s':''} detected: ${p.slice(0,5).join(', ')}${p.length>5?` +${p.length-5} more`:''}` :''; }); submitEl.addEventListener('click',()=>{ const parsed=getParsed(); if(!parsed.length) return; const now=new Date().toISOString(); const ns=parsed.map((username,i)=>({ id:uid()+i, username, subreddit:document.getElementById('bulk-sub').value||'r/unknown', reason:document.getElementById('bulk-reason').value||'', notes:'', status:'active', dateReported:now, lastChecked:null, nextCheck:new Date(Date.now()+900000).toISOString(), history:[] })); DB.unshift(...ns); State.page=0; ML.closeModal(); renderAll(); toast(`${ns.length} user${ns.length>1?'s':''} imported`,'success'); }); },

  openEdit(id){ const u=DB.find(x=>x.id===id); if(!u) return; const statusOpts=Object.entries(STATUS_META).map(([v,m])=>`<option value="${v}" ${u.status===v?'selected':''}>${m.label}</option>`).join(''); const body=`<div class="field"><label class="field-label">Status</label><select id="ei-status">${statusOpts}</select></div><div class="field"><label class="field-label">Reason (optional)</label><select id="ei-reason">${REASONS.map(r=>`<option ${r===u.reason?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label class="field-label">Subreddit</label><input id="ei-sub" value="${esc(u.subreddit)}"/></div><div class="field"><label class="field-label">Notes</label><textarea id="ei-notes" rows="4">${esc(u.notes)}</textarea></div><div class="modal-footer"><button class="btn btn-md btn-secondary" onclick="ML.closeModal()">Cancel</button><button class="btn btn-md btn-primary" id="edit-submit-btn">✓ Save</button></div>`; openModal(`Edit · u/${u.username}`,body,440); document.getElementById('edit-submit-btn').addEventListener('click',()=>{ u.status=document.getElementById('ei-status').value; u.reason=document.getElementById('ei-reason').value; u.subreddit=document.getElementById('ei-sub').value; u.notes=document.getElementById('ei-notes').value; ML.closeModal(); renderAll(); flashRow(u.id); toast(`u/${u.username} updated`,'success'); }); },

  confirmDelete(id){ const u=DB.find(x=>x.id===id); if(!u) return; const body=`<div class="modal-confirm">Remove u/${esc(u.username)} from the ledger?</div><div class="modal-footer"><button class="btn btn-md btn-secondary" onclick="ML.closeModal()">Cancel</button><button class="btn btn-md btn-danger" id="del-confirm-btn">⚠ Confirm</button></div>`; openModal('Confirm Action',body,380); document.getElementById('del-confirm-btn').addEventListener('click',()=>{ DB=DB.filter(x=>x.id!==id); State.selected.delete(id); ML.closeModal(); renderAll(); toast(`u/${u.username} removed`,'info'); }); },

  confirmBulkDelete(){ const n=State.selected.size; const body=`<div class="modal-confirm">Remove ${n} user${n>1?'s':''} from the ledger?</div><div class="modal-footer"><button class="btn btn-md btn-secondary" onclick="ML.closeModal()">Cancel</button><button class="btn btn-md btn-danger" id="bdel-confirm-btn">⚠ Confirm Delete</button></div>`; openModal('Confirm Action',body,380); document.getElementById('bdel-confirm-btn').addEventListener('click',()=>{ DB=DB.filter(u=>!State.selected.has(u.id)); State.selected.clear(); ML.closeModal(); renderAll(); toast(`${n} user${n>1?'s':''} removed`,'info'); }); },

  openHistory(id){ const u=DB.find(x=>x.id===id); if(!u) return; const drawer=document.getElementById('drawer'); drawer.dataset.userId=id; const isRef=State.refreshing.has(id); const m=STATUS_META[u.status]||STATUS_META.active; drawer.innerHTML = `<div class="drawer-header"><div><div class="drawer-title-row"><a href="https://reddit.com/user/${esc(u.username)}" target="_blank" class="drawer-user-link">u/${esc(u.username)}</a>${badgeHTML(u.status,false)}</div><div class="drawer-subtle">${esc(u.subreddit)} · ${esc(u.reason||'')}</div></div><button class="drawer-close" onclick="ML.closeDrawer()">×</button></div><div class="drawer-body"><div class="status-card"><div class="status-card-label">Current Status</div><div class="drawer-subtle drawer-meta-row">${badgeHTML(u.status,false)}</div><div class="drawer-meta"><div><div class="drawer-meta-key">Last checked</div><div class="drawer-meta-val">${fmtRel(u.lastChecked)}</div></div><div><div class="drawer-meta-key">Next check</div><div class="drawer-meta-val">${fmtRel(u.nextCheck)}</div></div><div><div class="drawer-meta-key">Reported</div><div class="drawer-meta-val">${fmtDate(u.dateReported)}</div></div></div>${u.notes?`<div class="drawer-note">${esc(u.notes)}</div>`:''}</div><div class="timeline-label">Status History</div>${u.history.length===0?'<div class="drawer-subtle">No history yet.</div>':u.history.slice().reverse().map((h,i)=>{ return `<div class="timeline-item"><div class="timeline-dot-col"><div class="timeline-dot status-${h.to}"></div>${i<u.history.length-1?'<div class="timeline-line"></div>':''}</div><div class="timeline-content"><div class="timeline-date">${fmtDate(h.checkedAt)}</div><div class="timeline-badges">${h.from?`${badgeHTML(h.from,true)}<span class="timeline-arrow">→</span>`:''}${badgeHTML(h.to,true)}</div><div class="timeline-tags"><span class="tag">${esc(h.source)}</span></div></div></div>`; }).join('')}`; document.getElementById('drawer-overlay').style.display='block'; drawer.style.display='block'; document.getElementById('drawer-refresh-btn')?.addEventListener('click',()=>{ ML.refresh(id); setTimeout(()=>ML.openHistory(id),100); }); },

  closeDrawer(){ document.getElementById('drawer-overlay').style.display='none'; document.getElementById('drawer').style.display='none'; },
  closeModal(){ document.getElementById('modal-overlay').style.display='none'; document.getElementById('modal-body').innerHTML=''; },
  exportCSV(){ const filtered=getFiltered(); const rows=[['Username','Subreddit','Status','Reason','Date Reported','Last Checked','Notes'], ...filtered.map(u=>[u.username,u.subreddit,u.status,u.reason||'',u.dateReported,u.lastChecked||'',u.notes||''])]; const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`modledger-${new Date().toISOString().slice(0,10)}.csv`; a.click(); toast(`Exported ${filtered.length} users`,'success'); }
};

function openModal(title,body,width=480){ document.getElementById('modal-title').textContent=title; document.getElementById('modal-body').innerHTML=body; document.getElementById('modal-box').style.width=width+'px'; document.getElementById('modal-overlay').style.display='flex'; }
function updateStatusBar(){ const n=State.refreshing.size; const sbCheck=document.getElementById('sb-checking'); const sbSep=document.getElementById('sb-sep'); const sbCheckText=document.getElementById('sb-checking-text'); if(n>0){ sbCheck.style.display='flex'; sbSep.style.display='block'; sbCheckText.textContent=`CHECKING ${n} USER${n>1?'S':''}`; } else { sbCheck.style.display='none'; sbSep.style.display='none'; } }

function setView(v){ State.view=v; ['users','analytics','settings'].forEach(name=>{ document.getElementById(`view-${name}`).style.display = name===v ? 'block' : 'none'; }); document.querySelectorAll('.nav-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===v)); renderStats(); if(v==='analytics') renderAnalytics(); if(v==='settings') renderSettings(); }

function renderAll(){ renderStats(); renderPills(); renderSubFilter(); renderTable(); updateStatusBar(); }

// render static table head once before initial render
renderTableHead();

(function init(){ document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view))); const sinp=document.getElementById('search-inp'); const sclear=document.getElementById('search-clear'); let searchTimer; sinp.addEventListener('input',()=>{ clearTimeout(searchTimer); sclear.style.display=sinp.value?'block':'none'; searchTimer=setTimeout(()=>{ State.search=sinp.value; State.page=0; renderTable(); },150); }); sclear.addEventListener('click',()=>{ sinp.value=''; sclear.style.display='none'; State.search=''; State.page=0; renderTable(); }); document.addEventListener('keydown',e=>{ if(e.key==='/'&&document.activeElement?.tagName!=='INPUT'&&document.activeElement?.tagName!=='TEXTAREA'){ e.preventDefault(); sinp.focus(); } if(e.key==='Escape'){ sinp.value=''; sclear.style.display='none'; State.search=''; State.statusFilter='all'; State.subFilter='all'; State.page=0; document.getElementById('sub-sel').value='all'; sinp.blur(); renderPills(); renderSubFilter(); renderTable(); } if((e.metaKey||e.ctrlKey)&&e.key==='n'){ e.preventDefault(); ML.openAddModal(); } if((e.metaKey||e.ctrlKey)&&e.key==='i'){ e.preventDefault(); ML.openBulkModal(); } if(e.key==='Escape'){ ML.closeModal(); ML.closeDrawer(); } }); renderAll(); setView('users'); })();

