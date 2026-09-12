/* =====================================================================
   SEED 프로그램 웹앱 — 화면
   목포대학교 교육학과 정윤미 · 2026
   프로그램 내용(질문·문항)은 이 파일에 없습니다. 모두 서버에서 받아옵니다.
   ===================================================================== */

const CFG = {
  url : 'https://btuurgsklmuhcfjenmkw.supabase.co',
  key : 'sb_publishable_ln9ZqLiP-1DhH2Ed5vwJsg_Eoytm-a8',
  draftEverySec : 30,
};

/* ---------- 5유형 이름 (표시용) ---------- */
const AREA = {
  C:'① 인지적 실수 — 몰라서 실수',
  M:'② 메타인지적 실수 — 안다고 착각한 실수',
  L:'③ 실행·자원관리 실수 — 실행이 무너진 실수',
  A:'④ 귀인·해석 반응 — 원인을 잘못 읽는 반응',
  E:'⑤ 정서·회피 반응 — 마음이 막는 반응',
};
const AREA_SHORT = { C:'① 인지', M:'② 메타인지', L:'③ 실행·자원관리', A:'④ 귀인·해석', E:'⑤ 정서·회피' };
const PRIMARY_AREAS = ['C','M','L'];   // 1차 실수 (Target Error는 여기서만)

/* =====================================================================
   1. 서버 호출
   ===================================================================== */
async function rpc(fn, args, jwt){
  let res;
  try{
    res = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':CFG.key,
                'Authorization':'Bearer ' + (jwt || CFG.key) },
      body: JSON.stringify(args || {}),
    });
  }catch(e){ throw new Error('인터넷 연결을 확인해 주세요.'); }
  const text = await res.text();
  let data; try{ data = text ? JSON.parse(text) : null; }catch{ data = text; }
  if(!res.ok) throw new Error(friendly(data));
  return data;
}
function friendly(d){
  const m = (d && (d.message || d.msg || d.error_description || d.error)) || '알 수 없는 오류';
  const t = String(m);
  if(t.includes('SEED_')) return t.replace(/^SEED_[A-Z]+:\s*/, '');
  if(t.includes('JWT') || t.includes('token')) return '로그인이 풀렸습니다. 다시 들어와 주세요.';
  return t;
}
async function authLogin(email, password){
  const res = await fetch(`${CFG.url}/auth/v1/token?grant_type=password`, {
    method:'POST', headers:{'Content-Type':'application/json','apikey':CFG.key},
    body: JSON.stringify({email, password})
  });
  const d = await res.json();
  if(!res.ok) throw new Error(d.error_description || d.msg || '이메일 또는 비밀번호가 맞지 않습니다.');
  keepAuth(d);
  return d;
}

/* 선생님 로그인은 한 시간쯤이면 만료된다. 회기 도중에 풀리지 않도록
   만료 전에 미리 갱신하고, 그래도 거절당하면 한 번 더 갱신해 다시 보낸다. */
function keepAuth(d){
  if(!d || !d.access_token) return;
  Store.jwt = d.access_token;
  if(d.refresh_token) localStorage.setItem('seed_refresh', d.refresh_token);
  const sec = Number(d.expires_in || 3600);
  localStorage.setItem('seed_jwt_exp', String(Date.now() + sec*1000));
}
async function refreshAuth(){
  const rt = localStorage.getItem('seed_refresh');
  if(!rt) return false;
  try{
    const res = await fetch(`${CFG.url}/auth/v1/token?grant_type=refresh_token`, {
      method:'POST', headers:{'Content-Type':'application/json','apikey':CFG.key},
      body: JSON.stringify({ refresh_token: rt })
    });
    const d = await res.json();
    if(!res.ok || !d.access_token) return false;
    keepAuth(d); return true;
  }catch(e){ return false; }
}
function authExpiring(){
  const exp = Number(localStorage.getItem('seed_jwt_exp') || 0);
  return !exp || Date.now() > exp - 120000;      // 만료 2분 전부터 미리 갱신
}
// 선생님 화면 전용 호출. 로그인 만료를 알아서 처리한다.
async function srpc(fn, args){
  if(authExpiring()) await refreshAuth();
  try{
    return await rpc(fn, args, Store.jwt);
  }catch(e){
    if(!/로그인이 풀렸습니다|연구자 계정으로/.test(e.message)) throw e;
    if(!(await refreshAuth())) throw e;
    return await rpc(fn, args, Store.jwt);
  }
}

/* =====================================================================
   2. 보관 (브라우저)
   ===================================================================== */
const Store = {
  get t(){ return localStorage.getItem('seed_token'); },
  set t(v){ v ? localStorage.setItem('seed_token', v) : localStorage.removeItem('seed_token'); },
  get jwt(){ return localStorage.getItem('seed_jwt'); },
  set jwt(v){ v ? localStorage.setItem('seed_jwt', v) : localStorage.removeItem('seed_jwt'); },
  get next(){ return sessionStorage.getItem('seed_next') || ''; },
  set next(v){ v ? sessionStorage.setItem('seed_next', v) : sessionStorage.removeItem('seed_next'); },
};
function device(){
  const w = innerWidth;
  return w < 620 ? 'phone' : (w < 1024 ? 'tablet' : 'pc');
}

/* =====================================================================
   3. 화면 도구
   ===================================================================== */
const $ = (s, r=document) => r.querySelector(s);
const app = () => $('#app');
function h(html){ const d=document.createElement('div'); d.innerHTML=html.trim(); return d.firstElementChild; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(msg, kind=''){
  const box = $('#toast'); const d = document.createElement('div');
  d.className = kind; d.textContent = msg; box.appendChild(d);
  setTimeout(()=>{ d.style.opacity='0'; d.style.transition='.3s'; setTimeout(()=>d.remove(), 320); }, kind==='bad'?4200:2200);
}
// 클릭한 버튼을 돌려준다. await 뒤에는 e.currentTarget 이 비므로 e.target 으로 되찾는다.
function btnOf(e){
  if(!e) return null;
  if(e.currentTarget) return e.currentTarget;
  const t = e.target;
  if(t && t.closest) return t.closest('button') || t;
  return t || null;
}
function busy(btn, on, label){
  if(!btn) return;
  if(on){ btn.dataset.lab = btn.textContent; btn.textContent = label||'잠시만요…'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.lab || btn.textContent; btn.disabled = false; }
}
function fmtTime(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function shell(title, body, opts={}){
  const who = opts.who ? `<span class="who">${esc(opts.who)}</span>` : '';
  const out = opts.out ? `<button class="btn sm ghost" id="signout">나가기</button>` : '';
  app().innerHTML = `
    <header class="top"><div class="bar">
      <span class="brand"><span class="dot"></span>SEED</span>
      <span class="muted" style="font-size:14px">${esc(title)}</span>
      <span class="spacer"></span>${who}${out}
    </div></header>
    <div class="wrap ${opts.wide?'wide':''}">${body}
      <div class="foot">SEED 학업실수 기반 자기주도학습 프로그램 · 목포대학교 교육학과 정윤미<br>
      이 화면의 모든 내용은 연구 목적으로만 사용되며 무단 복제·배포를 금합니다.</div>
    </div>`;
  const so = $('#signout');
  if(so) so.onclick = ()=>{
    if(!confirm('나가시겠습니까? 저장한 내용은 그대로 남아 있습니다.')) return;
    Store.t = null; Store.jwt = null;
    localStorage.removeItem('seed_refresh'); localStorage.removeItem('seed_jwt_exp');
    location.hash = '#/';
  };
}

/* =====================================================================
   4. 길 찾기 (라우터)
   ===================================================================== */
function go(hash){ if(location.hash === hash) route(); else location.hash = hash; }
addEventListener('hashchange', route);

async function route(){
  stopDraftTimer();
  const p = (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
  document.body.className = '';
  try{
    if(p[0] === 'wall')  return await viewProject(p[1]);
    if(p[0] === 't')     return Store.jwt ? await viewStaff(p[1] || 'today') : viewStaffLogin();
    if(p[0] === 's'){
      if(!Store.t){ Store.next = location.hash; return viewLogin(); }
      return await viewStudent(p.slice(1));
    }
    if(p[0] === 'login') return viewLogin();
    return viewGate();
  }catch(e){
    console.error(e);
    shell('오류', `<div class="card"><h2>잠깐 멈췄습니다</h2>
      <p class="muted">${esc(e.message)}</p>
      <div class="row"><button class="btn p" onclick="location.reload()">다시 불러오기</button>
      <a class="btn" href="#/">처음으로</a></div></div>`);
  }
}

/* =====================================================================
   5. 첫 화면 · 로그인
   ===================================================================== */
function viewGate(){
  shell('들어가기', `
    <div class="card center" style="margin-top:36px">
      <h2 style="font-size:26px;margin-bottom:6px">SEED 프로그램</h2>
      <p class="muted">학업실수 기반 자기주도학습 · 9차시</p>
      <div class="row" style="justify-content:center;margin-top:22px">
        <a class="btn p" href="#/login" style="min-width:190px">학생으로 들어가기</a>
        <a class="btn" href="#/t">선생님</a>
      </div>
    </div>`);
}

function viewLogin(){
  shell('학생 로그인', `
    <div class="card" style="margin-top:30px;max-width:440px;margin-left:auto;margin-right:auto">
      <h2>학생 로그인</h2>
      <p class="muted">학번과 받은 접속코드 4자리를 넣어 주세요.</p>
      <div style="margin-top:16px">
        <label class="lab" for="sno">학번</label>
        <input id="sno" type="text" inputmode="numeric" autocomplete="username" placeholder="학번 (숫자만)">
      </div>
      <div style="margin-top:14px">
        <label class="lab" for="code">접속코드 4자리</label>
        <input id="code" class="code-in" type="text" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="····">
      </div>
      <button class="btn p wide" id="doLogin" style="margin-top:18px">들어가기</button>
      <p class="hint">한 번 들어오면 31일 동안 이 기기에서는 다시 넣지 않아도 됩니다.
        휴대폰·태블릿에서도 같은 학번과 코드로 들어올 수 있습니다.</p>
    </div>`);
  const sno = $('#sno'), code = $('#code'), btn = $('#doLogin');
  code.addEventListener('input', ()=>{ code.value = code.value.replace(/\D/g,'').slice(0,4); });
  const submit = async ()=>{
    if(!sno.value.trim()) return toast('학번을 넣어 주세요.','bad');
    if(code.value.length !== 4) return toast('접속코드 4자리를 넣어 주세요.','bad');
    busy(btn, true, '확인 중…');
    try{
      const r = await rpc('seed_login', { p_student_no: sno.value.trim(), p_code: code.value });
      Store.t = r.token;
      const next = Store.next; Store.next = '';
      toast(`${r.name || ''} 반가워요.`, 'ok');
      go(next || '#/s');
    }catch(e){ toast(e.message, 'bad'); busy(btn, false); }
  };
  btn.onclick = submit;
  code.addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });
  sno.addEventListener('keydown', e=>{ if(e.key==='Enter') code.focus(); });
  sno.focus();
}

/* =====================================================================
   6. 학생 화면
   ===================================================================== */
let ME = null;

async function loadMe(force){
  if(!ME || force) ME = await rpc('seed_me', { p_token: Store.t });
  return ME;
}

async function viewStudent(path){
  const me = await loadMe(true);
  if(!me.plant_theme) return viewThemePick(me);

  const tab = path[0] || 'act';
  const open = me.sessions.filter(s=>s.is_open).map(s=>s.session_no);
  const cur  = Number(path[1]) || open[0] || lastTouched(me) || 1;

  const narrow = innerWidth < 620;
  const tabs = [
    ['act', narrow?'활동':'오늘의 활동'], ['wall','공유벽'],
    ['records', narrow?'내 기록':'나의 SEED 기록'], ['grow', narrow?'성장':'나의 성장']
  ].map(([k,l])=>`<button data-tab="${k}" aria-selected="${tab===k}">${l}</button>`).join('');

  shell('학생', `
    ${sessionStrip(me, cur)}
    <div class="tabs">${tabs}</div>
    <div class="panel" id="panel"><p class="muted">불러오는 중…</p></div>
  `, { who: `${me.name||''} · ${me.student_no}`, out:true });

  document.querySelectorAll('.tabs button').forEach(b=>{
    b.onclick = ()=> go(`#/s/${b.dataset.tab}${b.dataset.tab==='act'?'/'+cur:''}`);
  });

  if(tab === 'act')     return paneActivity(cur);
  if(tab === 'wall')    return paneWallPick(cur, path[1]);
  if(tab === 'records') return paneRecords();
  if(tab === 'grow')    return paneGrow();
}

function lastTouched(me){
  const done = me.sessions.filter(s=>(s.done||0) > 0).map(s=>s.session_no);
  return done.length ? Math.max(...done) : null;
}

function sessionStrip(me, cur){
  const items = me.sessions.map(s=>{
    const ratio = s.required ? (s.done||0)/s.required : 0;
    const cls = s.is_open ? 'ok' : (ratio >= 1 ? 'info' : '');
    const d = s.scheduled_date ? s.scheduled_date.slice(5).replace('-','/') : '';
    return `<button class="chip ${cls}" data-s="${s.session_no}" style="border:1.5px solid ${s.session_no==cur?'var(--green)':'transparent'};cursor:pointer;padding:7px 11px">
      ${s.session_no}차시 <span style="opacity:.7;font-weight:600">${d}</span>${s.is_open?' ●':''}</button>`;
  }).join('');
  const c = me.sessions.find(s=>s.session_no==cur) || {};
  const pct = c.required ? Math.round((c.done||0)/c.required*100) : 0;
  return `<div class="card tight" style="margin-top:14px">
    <div class="row" style="gap:6px">${items}</div>
    <div style="margin-top:12px">
      <div class="row"><b>${cur}차시 · ${esc(c.title||'')}</b><span class="spacer"></span>
        <span class="muted">${c.done||0} / ${c.required||0} 칸</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      ${c.is_open ? '' : '<p class="hint">지금은 이 차시 입력이 열려 있지 않습니다. 선생님이 열면 바로 쓸 수 있어요.</p>'}
    </div></div>`;
}

/* ---------- 꽃 / 나무 고르기 ---------- */
function viewThemePick(me){
  shell('시작', `
    <div class="card" style="margin-top:30px">
      <h2>무엇을 키울까요?</h2>
      <p class="muted">9차시 동안 같이 자랍니다. 한 번 고르면 바꾸지 않아요.</p>
      <div class="row" style="margin-top:18px;gap:16px">
        ${['flower','tree'].map(t=>`
          <button class="btn" data-theme="${t}" style="flex:1;min-width:180px;height:auto;flex-direction:column;padding:20px">
            ${plantSVG(t, 9, 120)}
            <b style="margin-top:10px;font-size:17px">${t==='flower'?'꽃':'나무'}</b>
          </button>`).join('')}
      </div>
    </div>`, { who: me.name||'', out:true });
  document.querySelectorAll('[data-theme]').forEach(b=>{
    b.onclick = async ()=>{
      await rpc('seed_set_theme', { p_token: Store.t, p_theme: b.dataset.theme });
      ME = null; toast('좋아요. 같이 키워 봅시다.', 'ok'); go('#/s');
    };
  });
}

/* ---------- 오늘의 활동 ---------- */
const dirty = new Map();          // field_id -> 값
let draftTimer = null;

function stopDraftTimer(){ if(draftTimer){ clearInterval(draftTimer); draftTimer = null; } flushDrafts(); }
function startDraftTimer(){ stopDraftTimer(); draftTimer = setInterval(flushDrafts, CFG.draftEverySec*1000); }
async function flushDrafts(){
  if(!dirty.size || !Store.t) return;
  const items = [...dirty.entries()]; dirty.clear();
  for(const [fid, val] of items){
    try{ await rpc('seed_save_draft', { p_token: Store.t, p_field_id: fid, p_value: val, p_device: device() }); }
    catch(e){ dirty.set(fid, val); }
  }
  const m = $('#draftmark'); if(m){ m.textContent = '임시 보관 ' + fmtTime(new Date().toISOString()); }
}
addEventListener('visibilitychange', ()=>{ if(document.hidden) flushDrafts(); });

async function paneActivity(no){
  const p = $('#panel');
  const data = await rpc('seed_session_fields', { p_token: Store.t, p_session: no });
  const fields = data.fields || [];
  const sc = await rpc('seed_selfcheck', { p_token: Store.t }).catch(()=>({has_result:false}));

  if(!fields.length){
    p.innerHTML = `<p class="muted">이 차시에 쓸 칸이 아직 없습니다.</p>`; return;
  }
  const sess = ME.sessions.find(s=>s.session_no==no) || {};
  p.innerHTML = `
    <div class="row"><h2 style="margin:0">${no}차시 기록</h2><span class="spacer"></span>
      <span class="chip" id="draftmark">30초마다 자동 임시 보관</span></div>
    <p class="muted">칸을 다 쓰고 <b>저장</b>을 눌러야 기록으로 남습니다.
      쓰다가 창을 닫아도 임시 보관본이 남아 이어서 쓸 수 있어요.
      잘 모르겠으면 <b>모르겠다는 그 마음을 그대로</b> 적어 주세요. 그것도 자료입니다.</p>
    ${(data.walls||[]).length ? `<div class="note">이 차시에는 공유벽이 ${data.walls.length}개 있습니다.
      위의 <b>공유벽</b> 탭에서 쓸 수 있어요.</div>` : ''}
    <div id="fields"></div>`;

  const box = $('#fields');
  fields.forEach(f => box.appendChild(fieldCard(f, { sc, session: sess })));
  startDraftTimer();
}

function fieldCard(f, ctx){
  const saved = f.value != null;
  const wrap = h(`<div class="field ${saved?'done':'empty'}" id="f_${f.field_id}">
    <div class="fh"><span class="step">${esc(f.step||'')}</span>
      <label class="lab" for="i_${f.field_id}">${esc(f.label)}</label></div>
    <div class="fb"></div>
    <div class="ft"><span class="state chip ${saved?'ok':''}">${saved?`저장됨 · ${f.revision}번째`:'아직 안 씀'}</span>
      ${f.draft && !saved ? '<span class="chip warn">임시 보관본 있음</span>' : ''}
      <span class="spacer"></span>
      <button class="btn p sm save">저장</button></div>
  </div>`);
  const body = $('.fb', wrap);
  const start = f.value != null ? f.value : (f.draft || '');
  let read = ()=>'';

  if(f.field_id === 'S1_04_d'){                      // 주 영역 / 부 영역
    const m = /주[^:]*:\s*([CMLAE])\D*부[^:]*:\s*([CMLAE])/.exec(start) || [];
    body.innerHTML = `
      <div class="row" style="gap:12px">
        <div style="flex:1;min-width:220px"><label class="lab" style="font-size:14px">주 영역</label>
          ${sel('main_'+f.field_id, PRIMARY_AREAS, m[1])}</div>
        <div style="flex:1;min-width:220px"><label class="lab" style="font-size:14px">부 영역</label>
          ${sel('sub_'+f.field_id, Object.keys(AREA), m[2])}</div>
      </div>
      <p class="hint">주 영역은 ①②③(1차 실수) 중에서 고릅니다. ④⑤는 실수 뒤에 따라온 반응이라 부 영역에 둡니다.</p>`;
    read = ()=>{
      const a = $(`#main_${f.field_id}`, body).value, b = $(`#sub_${f.field_id}`, body).value;
      if(!a || !b) return '';
      return `주: ${AREA_SHORT[a]} / 부: ${AREA_SHORT[b]}`;
    };
  } else if(f.input_type === 'select'){
    body.innerHTML = sel('i_'+f.field_id, Object.keys(AREA), areaOf(start));
    read = ()=>{ const v = $(`#i_${f.field_id}`, body).value; return v ? AREA_SHORT[v] : ''; };
  } else if(f.input_type === 'auto'){
    const tops = (ctx.sc && ctx.sc.has_result) ? (ctx.sc.top_areas||[]) : null;
    const txt = tops ? tops.map(a=>AREA_SHORT[a]||a).join(' · ')
                     : '사전 자기점검 결과가 아직 올라오지 않았습니다. 선생님께 알려 주세요.';
    body.innerHTML = `<div class="note" style="margin:0">${esc(start || txt)}</div>`;
    read = ()=> start || (tops ? tops.map(a=>AREA_SHORT[a]||a).join(' · ') : '');
  } else if(f.input_type === 'card_select'){
    body.innerHTML = `<input type="text" id="i_${f.field_id}" value="${esc(start)}"
        placeholder="예: A-03, C-07, E-02  (화면에 뜬 카드 번호 3개)">
      <p class="hint">큰 화면에 뜬 갤러리에서 고른 카드 <b>3장</b>의 번호를 쉼표로 적어 주세요.</p>`;
    read = ()=> $(`#i_${f.field_id}`, body).value;
  } else {
    const big = /사건|문장|왜|이유|알게/.test(f.label);
    body.innerHTML = `<textarea id="i_${f.field_id}" rows="${big?4:3}"
      placeholder="짧아도 괜찮습니다. 떠오르는 대로.">${esc(start)}</textarea>`;
    read = ()=> $(`#i_${f.field_id}`, body).value;
  }

  // 입력 감지 → 임시 보관 대기줄
  body.querySelectorAll('input,textarea,select').forEach(el=>{
    el.addEventListener('input', ()=>{ const v = read(); if(v) dirty.set(f.field_id, v); });
    if(el.tagName === 'TEXTAREA'){
      const grow = ()=>{ el.style.height='auto'; el.style.height = Math.min(el.scrollHeight+2, 520)+'px'; };
      el.addEventListener('input', grow); setTimeout(grow, 0);
    }
  });

  $('.save', wrap).onclick = async (e)=>{
    const v = (read()||'').trim();
    if(!v) return toast('짧게라도 적어야 저장됩니다.', 'bad');
    const btn = e.currentTarget; busy(btn, true, '저장 중…');
    try{
      dirty.delete(f.field_id);
      const r = await rpc('seed_save', { p_token: Store.t, p_field_id: f.field_id, p_value: v,
                                         p_meta: { device: device() } });
      wrap.classList.remove('empty'); wrap.classList.add('done');
      const st = $('.state', wrap); st.className = 'state chip ok'; st.textContent = `저장됨 · ${r.revision}번째`;
      const w = $('.chip.warn', wrap); if(w) w.remove();
      toast(r.revision > 1 ? `고쳐 쓴 내용을 ${r.revision}번째로 저장했습니다.` : '저장했습니다.', 'ok');
      bumpProgress();
    }catch(err){ toast(err.message, 'bad'); }
    busy(btn, false);
  };
  return wrap;
}
function sel(id, keys, cur){
  return `<select id="${id}"><option value="">— 고르기 —</option>` +
    keys.map(k=>`<option value="${k}"${k===cur?' selected':''}>${esc(AREA[k])}</option>`).join('') + `</select>`;
}
function areaOf(text){
  for(const k of Object.keys(AREA)) if(text && text.includes(AREA_SHORT[k])) return k;
  return '';
}
async function bumpProgress(){
  try{
    const me = await loadMe(true);
    const cur = Number((location.hash.split('/')[3])) || 1;
    const strip = $('.card.tight'); if(strip) strip.outerHTML = sessionStrip(me, cur);
    document.querySelectorAll('.chip[data-s]').forEach(b=> b.onclick = ()=> go(`#/s/act/${b.dataset.s}`));
  }catch(e){}
}

/* ---------- 공유벽 ---------- */
async function paneWallPick(no, qid){
  const p = $('#panel');
  const data = await rpc('seed_session_fields', { p_token: Store.t, p_session: no });
  const walls = data.walls || [];
  if(!walls.length){ p.innerHTML = `<p class="muted">${no}차시에는 공유벽이 없습니다.</p>`; return; }
  const q = walls.find(w=>w.question_id === qid) || walls[0];
  const tabs = walls.length > 1
    ? `<div class="row" style="margin-bottom:12px">${walls.map(w=>
        `<button class="btn sm ${w.question_id===q.question_id?'p':''}" data-q="${w.question_id}">${w.phase==='pre'?'시작 공유벽':w.phase==='post'?'마무리 공유벽':'공유벽'}</button>`).join('')}</div>`
    : '';
  p.innerHTML = tabs + `<div id="wallbox"><p class="muted">불러오는 중…</p></div>`;
  document.querySelectorAll('[data-q]').forEach(b=> b.onclick = ()=> paneWallPick(no, b.dataset.q));
  await renderWall(q, $('#wallbox'));
}

function wallDoneKey(qid){ return 'seed_wall_done_' + qid; }

async function renderWall(q, box){
  const d = await rpc('wall_view', { p_token: Store.t, p_question_id: q.question_id });
  const parts = q.parts || [['line','한 줄']];
  const already = localStorage.getItem(wallDoneKey(q.question_id));
  if(already && !box.dataset.again){
    box.innerHTML = `
      <div class="card tight" style="margin:0 0 14px;border-color:var(--green)">
        <h2 style="font-size:17px">${esc(q.prompt)}</h2>
        <div class="note" style="margin-top:10px">이미 올렸습니다.
          ${already === 'public' ? '선생님이 열면 아래에 이름 없이 뜹니다.' : '큰 화면에는 뜨지 않고 그대로 보관됩니다.'}</div>
        <div class="row end"><button class="btn sm" id="wagain">하나 더 올리기</button></div>
      </div>
      <div class="row"><b>올라온 글</b><span class="spacer"></span>
        <button class="btn sm ghost" id="wrefresh">새로 보기</button></div>
      <div class="wallgrid" id="wposts"></div>`;
    const g = $('#wposts');
    g.innerHTML = (d.posts||[]).length
      ? d.posts.map(p=>`<div class="post">${p.parts.map(x=>`${partLabel(q,x.part_key)}<p>${esc(x.content)}</p>`).join('')}</div>`).join('')
      : `<p class="muted">아직 열리지 않았습니다. 선생님이 한꺼번에 열면 여기에 뜹니다.</p>`;
    $('#wagain').onclick = ()=>{ box.dataset.again = '1'; renderWall(q, box); };
    $('#wrefresh').onclick = async (e)=>{
      busy(btnOf(e), true, '…');
      const n = await rpc('wall_view', { p_token: Store.t, p_question_id: q.question_id });
      g.innerHTML = (n.posts||[]).map(p=>`<div class="post">${
        p.parts.map(x=>`${partLabel(q,x.part_key)}<p>${esc(x.content)}</p>`).join('')}</div>`).join('')
        || `<p class="muted">아직 열리지 않았습니다.</p>`;
      busy(btnOf(e), false);
    };
    return;
  }
  const inputs = parts.map(([key,label],i)=>`
    <div style="margin-top:${i?14:6}px">
      <label class="lab" for="w_${key}">${esc(label)}</label>
      <textarea id="w_${key}" rows="2" placeholder="짧아도 괜찮습니다."></textarea>
    </div>`).join('');

  box.innerHTML = `
    <div class="card tight" style="margin:0 0 14px;border-color:var(--green)">
      <h2 style="font-size:17px">${esc(q.prompt)}</h2>
      ${inputs}
      <div class="vis">
        <label><input type="radio" name="vis" value="public">
          <span><b>공유벽에 올리기</b><span>이름 없이 큰 화면에 뜹니다. 누가 썼는지는 아무도 모릅니다.</span></span></label>
        <label><input type="radio" name="vis" value="private">
          <span><b>나만 보기</b><span>큰 화면에 뜨지 않습니다. 쓴 내용은 그대로 보관됩니다.</span></span></label>
      </div>
      ${q.appendable ? `<div style="margin-top:12px">
        <label class="lab" style="font-size:14px">지난 회기에 받은 글 코드 (이어 쓸 때만)</label>
        <input type="text" id="pcode" placeholder="예: 7A2F1C" style="max-width:220px;text-transform:uppercase">
        <p class="hint">비워 두면 새 글로 올라갑니다.</p></div>` : ''}
      <div class="row end" style="margin-top:14px">
        <button class="btn p" id="wsend">올리기</button></div>
      <p class="hint">공개를 고르든 나만 보기를 고르든, 쓴 내용은 똑같이 연구 자료로 보관됩니다.
        올린 뒤에는 고칠 수 없으니 한 번 읽어 보고 눌러 주세요.</p>
    </div>
    <div class="row"><b>올라온 글</b><span class="spacer"></span>
      <button class="btn sm ghost" id="wrefresh">새로 보기</button></div>
    <div class="wallgrid" id="wposts"></div>`;

  const draw = (posts)=>{
    const g = $('#wposts');
    if(!posts.length){ g.innerHTML = `<p class="muted">아직 열리지 않았습니다. 선생님이 한꺼번에 열면 여기에 뜹니다.</p>`; return; }
    g.innerHTML = posts.map(p=>`<div class="post">${
      p.parts.map(x=>`${partLabel(q, x.part_key)}<p>${esc(x.content)}</p>`).join('')}</div>`).join('');
  };
  draw(d.posts || []);
  $('#wrefresh').onclick = async (e)=>{
    busy(btnOf(e), true, '…');
    const n = await rpc('wall_view', { p_token: Store.t, p_question_id: q.question_id });
    draw(n.posts || []); busy(btnOf(e), false);
  };
  $('#wsend').onclick = async (e)=>{
    const vis = (document.querySelector('input[name=vis]:checked')||{}).value;
    if(!vis) return toast('공유벽에 올릴지, 나만 볼지 골라 주세요.', 'bad');
    const blocks = [];
    for(const [key,label] of parts){
      const v = $('#w_'+key).value.trim();
      if(!v) return toast(`"${label}" 칸을 짧게라도 적어 주세요.`, 'bad');
      blocks.push({ part_key:key, content:v, visibility:vis });
    }
    const btn = e.currentTarget; busy(btn, true, '올리는 중…');
    try{
      const code = q.appendable ? ($('#pcode').value||'').trim() : '';
      const r = code
        ? await rpc('wall_append', { p_token:Store.t, p_post_code:code, p_question_id:q.question_id, p_blocks:blocks })
        : await rpc('wall_submit', { p_token:Store.t, p_question_id:q.question_id, p_blocks:blocks });
      try{ localStorage.setItem(wallDoneKey(q.question_id), vis); }catch(e){}
      delete box.dataset.again;
      if(r.post_code){
        box.querySelector('.card').innerHTML = `<h2 style="font-size:17px">올렸습니다</h2>
          <p class="muted">다음 회기에 이 글에 이어 쓰려면 아래 코드를 워크북에 적어 두세요.</p>
          <div class="center" style="font:800 34px var(--mono);letter-spacing:.2em;margin:14px 0">${esc(r.post_code)}</div>`;
      }else{
        box.querySelector('.card').innerHTML = `<h2 style="font-size:17px">올렸습니다</h2>
          <p class="muted">${vis==='public'
            ? '선생님이 한꺼번에 열면 아래에 이름 없이 뜹니다.'
            : '큰 화면에는 뜨지 않습니다. 쓴 내용은 그대로 보관됩니다.'}</p>`;
      }
      toast('올렸습니다.', 'ok');
    }catch(err){ toast(err.message, 'bad'); busy(btn, false); }
  };
}
function partLabel(q, key){
  const p = (q.parts||[]).find(x=>x[0]===key);
  return (p && (q.parts||[]).length > 1) ? `<span class="pk">${esc(p[1])}</span>` : '';
}

/* ---------- 나의 SEED 기록 ---------- */
async function paneRecords(){
  const p = $('#panel');
  const rows = await rpc('seed_records', { p_token: Store.t });
  if(!rows.length){ p.innerHTML = `<p class="muted">아직 저장한 기록이 없습니다.</p>`; return; }
  const by = {};
  rows.forEach(r=>{ (by[r.session_no] ||= []).push(r); });
  const titles = Object.fromEntries(ME.sessions.map(s=>[s.session_no, s.title]));
  p.innerHTML = `<h2 style="margin-top:0">나의 SEED 기록</h2>
    <p class="muted">지금까지 저장한 내용입니다. 여기서는 읽기만 합니다. 고치려면 <b>오늘의 활동</b>에서 다시 저장하세요.</p>
    ${Object.keys(by).sort((a,b)=>a-b).map(no=>`
      <h3>${no}차시 · ${esc(titles[no]||'')}</h3>
      ${by[no].map(r=>`
        <div class="field ${r.locked?'':'done'}" style="margin:8px 0">
          <div class="lab" style="font-size:14.5px">${esc(r.label)}</div>
          ${r.locked
            ? `<p class="muted">🔒 9차시에 함께 엽니다. 그때까지 아무도 보지 않습니다.</p>`
            : `<p style="white-space:pre-wrap;margin:6px 0 0">${esc(r.value)}</p>
               <span class="chip" style="margin-top:8px">${fmtTime(r.saved_at)}${r.revision>1?` · ${r.revision}번째`:''}</span>`}
        </div>`).join('')}`).join('')}`;
}

/* ---------- 나의 성장 ---------- */
async function paneGrow(){
  const p = $('#panel');
  const me = ME;
  const doneCount = me.sessions.filter(s => s.required > 0 && (s.done||0) >= s.required).length;
  const stage = Math.max(0, Math.min(9, doneCount));
  const sc = await rpc('seed_selfcheck', { p_token: Store.t }).catch(()=>({has_result:false}));

  p.innerHTML = `
    <h2 style="margin-top:0">나의 성장</h2>
    <div class="grow">
      ${plantSVG(me.plant_theme, stage, 210)}
      <div>
        <p style="margin:0 0 4px"><b>${stage}차시</b>만큼 자랐습니다.</p>
        <p class="muted" style="margin:0">한 차시의 칸을 다 채우면 한 칸 자랍니다. 숫자로 잘하고 못하고를 재지 않습니다.</p>
        <div class="stagerow">${me.sessions.map(s=>{
          const on = s.required>0 && (s.done||0) >= s.required;
          return `<i class="${on?'on':''}" title="${s.session_no}차시">${s.session_no}</i>`;
        }).join('')}</div>
      </div>
    </div>
    ${stage >= 9 ? `<div class="note" style="margin-top:20px">
      <b>9차시까지 모두 채웠습니다.</b> 1차시에 봉인해 두었던 시작점 문장을 이제 열 수 있습니다.
      <b>나의 SEED 기록</b>에서 확인해 보세요.</div>` : ''}
    <h3>나의 사전 자기점검</h3>
    <div id="radarbox"></div>`;

  const rb = $('#radarbox');
  if(!sc.has_result){
    rb.innerHTML = `<p class="muted">사전 자기점검(51문항) 결과가 아직 올라오지 않았습니다.</p>`;
  }else{
    const means = sc.area_means || {};
    rb.innerHTML = `<div class="radar">${radarSVG(means)}
      <div class="legend">${Object.keys(AREA).map(k=>`
        <div><b>${means[k]!=null?Number(means[k]).toFixed(1):'–'}</b>
        <span style="width:11px;height:11px;border-radius:3px;background:${AREA_COLOR[k]};display:inline-block"></span>
        ${esc(AREA_SHORT[k])}</div>`).join('')}</div></div>
      <p class="hint">높게 나온 쪽이 <b>지금 자주 걸리는 자리</b>입니다. 좋고 나쁨이 아니라 출발점입니다.
        ${(sc.top_areas||[]).length ? `이번 학기 출발점: <b>${(sc.top_areas||[]).map(a=>AREA_SHORT[a]).join(' · ')}</b>` : ''}</p>`;
  }
}

/* =====================================================================
   7. 그림 (꽃 · 나무 · 레이더)
   ===================================================================== */
const AREA_COLOR = { C:'#4b7f52', M:'#6a9ac4', L:'#c58b3c', A:'#8b6bb1', E:'#c4646a' };

function plantSVG(theme, stage, size=200){
  const S = Math.max(0, Math.min(9, stage|0));
  const W = size, H = size;
  const g = [];
  // 배경 (빈 여백이 허전하지 않게)
  g.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="${W*0.10}" fill="#eef4ea"/>
          <ellipse cx="${W/2}" cy="${H*0.93}" rx="${W*0.40}" ry="${H*0.055}" fill="#dfe9dc"/>`);
  // 화분
  g.push(`<path d="M ${W*0.34} ${H*0.80} L ${W*0.66} ${H*0.80} L ${W*0.62} ${H*0.95} L ${W*0.38} ${H*0.95} Z"
           fill="#c98f63"/><rect x="${W*0.32}" y="${H*0.76}" width="${W*0.36}" height="${H*0.055}" rx="3" fill="#b57d54"/>`);
  if(S === 0){
    g.push(`<ellipse cx="${W/2}" cy="${H*0.78}" rx="${W*0.045}" ry="${W*0.032}" fill="#7c5a3a"/>`);
    return svg(W,H,g.join(''));
  }
  const per = theme === 'tree' ? 0.045 : 0.061;      // 나무는 잎이 커지므로 줄기를 조금 낮게
  const top = H*0.78 - (H*0.06 + S * H*per);         // 자라는 높이
  g.push(`<path d="M ${W/2} ${H*0.79} C ${W*0.47} ${(H*0.79+top)/2}, ${W*0.53} ${(H*0.79+top)/2}, ${W/2} ${top}"
           stroke="${theme==='tree'?'#7b5a3a':'#4b7f52'}" stroke-width="${theme==='tree'?3+S*0.55:3}"
           fill="none" stroke-linecap="round"/>`);
  // 잎
  const leaves = [[-1,.72],[1,.62],[-1,.50],[1,.40],[-1,.30],[1,.22]];
  for(let i=0;i<Math.min(S, leaves.length);i++){
    const [dir, f] = leaves[i];
    const y = H*0.79 - (H*0.79-top)*(1-f);
    g.push(`<ellipse cx="${W/2 + dir*W*0.10}" cy="${y}" rx="${W*0.085}" ry="${W*0.040}"
             fill="#5f9a63" transform="rotate(${dir*-22} ${W/2 + dir*W*0.10} ${y})" opacity=".95"/>`);
  }
  if(theme === 'tree'){
    if(S >= 4){
      const r = W*(0.09 + (S-4)*0.020);
      g.push(`<circle cx="${W/2}" cy="${top - r*0.35}" r="${r}" fill="#5f9a63" opacity=".93"/>`);
      g.push(`<circle cx="${W/2 - r*0.7}" cy="${top + r*0.1}" r="${r*0.72}" fill="#6ba86e" opacity=".93"/>`);
      g.push(`<circle cx="${W/2 + r*0.7}" cy="${top + r*0.1}" r="${r*0.72}" fill="#55925b" opacity=".93"/>`);
    }
    if(S >= 7){
      const fr = [[-0.55,0.1],[0.5,-0.15],[0.05,0.35]].slice(0, S-6);
      const r = W*(0.09 + (S-4)*0.020);
      fr.forEach(([dx,dy])=> g.push(`<circle cx="${W/2 + r*dx}" cy="${top + r*dy}" r="${W*0.026}" fill="#d4644f"/>`));
    }
  }else{
    if(S >= 5){
      const pr = W*(0.028 + (S-5)*0.010);
      const cy = top - pr*0.6;
      const n = 6;
      for(let i=0;i<n;i++){
        const a = (Math.PI*2/n)*i - Math.PI/2;
        g.push(`<ellipse cx="${W/2 + Math.cos(a)*pr*1.25}" cy="${cy + Math.sin(a)*pr*1.25}"
                 rx="${pr}" ry="${pr*0.72}" fill="#e79ab4" opacity=".95"
                 transform="rotate(${a*180/Math.PI} ${W/2 + Math.cos(a)*pr*1.25} ${cy + Math.sin(a)*pr*1.25})"/>`);
      }
      g.push(`<circle cx="${W/2}" cy="${cy}" r="${pr*0.62}" fill="#f2cf62"/>`);
    }else{
      g.push(`<ellipse cx="${W/2}" cy="${top}" rx="${W*0.030}" ry="${W*0.042}" fill="#9ec49f"/>`);
    }
  }
  return svg(W,H,g.join(''));
}
function svg(w,h,inner){ return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${inner}</svg>`; }

function radarSVG(means, size=250){
  const keys = Object.keys(AREA), n = keys.length;
  const cx = size/2, cy = size/2, R = size*0.36;
  const pt = (i, r)=>{ const a = (Math.PI*2/n)*i - Math.PI/2; return [cx + Math.cos(a)*r, cy + Math.sin(a)*r]; };
  let g = '';
  for(let ring=1; ring<=5; ring++){
    const pts = keys.map((_,i)=>pt(i, R*ring/5).map(v=>v.toFixed(1)).join(',')).join(' ');
    g += `<polygon points="${pts}" fill="none" stroke="#dfe5da" stroke-width="1"/>`;
  }
  keys.forEach((_,i)=>{ const [x,y]=pt(i,R); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#dfe5da"/>`; });
  const vals = keys.map((k,i)=>{ const v = Math.max(0, Math.min(5, Number(means[k]||0))); return pt(i, R*v/5); });
  g += `<polygon points="${vals.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ')}"
          fill="rgba(75,127,82,.22)" stroke="#4b7f52" stroke-width="2.2" stroke-linejoin="round"/>`;
  vals.forEach((p,i)=> g += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="${AREA_COLOR[keys[i]]}"/>`);
  keys.forEach((k,i)=>{
    const [x,y] = pt(i, R+18);
    g += `<text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" font-size="12" font-weight="700"
            text-anchor="${x>cx+2?'start':x<cx-2?'end':'middle'}" fill="#5b6458">${AREA_SHORT[k].split(' ')[1]}</text>`;
  });
  return svg(size, size, g);
}

/* =====================================================================
   8. 선생님 화면
   ===================================================================== */
function viewStaffLogin(){
  shell('선생님', `
    <div class="card" style="margin-top:30px;max-width:420px;margin-left:auto;margin-right:auto">
      <h2>선생님 로그인</h2>
      <p class="muted">연구자 계정으로 들어갑니다.</p>
      <div style="margin-top:14px"><label class="lab" for="em">이메일</label>
        <input id="em" type="email" autocomplete="username"></div>
      <div style="margin-top:12px"><label class="lab" for="pw">비밀번호</label>
        <input id="pw" type="password" autocomplete="current-password"></div>
      <button class="btn p wide" id="dologin" style="margin-top:16px">들어가기</button>
      <p class="hint"><a href="#/">처음으로</a></p>
    </div>`);
  const submit = async ()=>{
    const b = $('#dologin'); busy(b, true, '확인 중…');
    try{
      await authLogin($('#em').value.trim(), $('#pw').value);
      go('#/t/today');
    }catch(e){ toast(e.message, 'bad'); busy(b, false); }
  };
  $('#dologin').onclick = submit;
  $('#pw').addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });
}

let OV = null;
async function viewStaff(tab){
  try{ OV = await srpc('staff_overview', {}); }
  catch(e){ Store.jwt = null; localStorage.removeItem('seed_jwt_exp');
            toast('로그인이 필요합니다. 다시 들어와 주세요.', 'bad'); return viewStaffLogin(); }

  const tabs = [['today','오늘 진행'],['wall','공유벽'],['roster','명단·코드'],
                ['data','자기점검 불러오기'],['history','고쳐 쓴 자국']]
    .map(([k,l])=>`<button data-tab="${k}" aria-selected="${tab===k}">${l}</button>`).join('');
  shell('선생님', `<div class="tabs">${tabs}</div><div class="panel" id="panel"></div>`,
        { wide:true, who:'연구자', out:true });
  document.querySelectorAll('.tabs button').forEach(b=> b.onclick = ()=> go('#/t/'+b.dataset.tab));

  if(tab==='today')   return staffToday();
  if(tab==='wall')    return staffWall();
  if(tab==='roster')  return staffRoster();
  if(tab==='data')    return staffData();
  if(tab==='history') return staffHistory();
}

function staffToday(){
  const p = $('#panel');
  const ss = OV.sessions, ps = OV.participants;
  const openNow = ss.filter(s=>s.is_open).map(s=>s.session_no);
  const cur = openNow[0] || todaySession(ss) || 1;

  p.innerHTML = `
    <h2 style="margin-top:0">오늘 진행</h2>
    <div class="scroll" style="max-height:none;margin-bottom:18px">
      <table><thead><tr><th>차시</th><th>날짜</th><th>제목</th><th>입력 열기</th><th>회기 후 창</th></tr></thead>
      <tbody>${ss.map(s=>`<tr>
        <td><b>${s.session_no}</b></td><td>${esc(s.scheduled_date||'')}</td><td>${esc(s.title||'')}</td>
        <td><button class="btn sm ${s.is_open?'p':''}" data-open="${s.session_no}" data-v="${!s.is_open}">
          ${s.is_open?'열림 ●':'닫힘'}</button></td>
        <td><button class="btn sm ${s.post_window_open?'p':''}" data-post="${s.session_no}" data-v="${!s.post_window_open}">
          ${s.post_window_open?'열림 ●':'닫힘'}</button></td></tr>`).join('')}</tbody></table>
    </div>

    <div class="row"><h3 style="margin:0">오늘 빠진 것 — ${cur}차시</h3><span class="spacer"></span>
      <span class="muted">내용은 보이지 않습니다. 저장한 칸 수만 봅니다.</span></div>
    <div class="scroll" style="margin-top:8px">
      <table><thead><tr><th>학번</th><th>이름</th><th>저장</th><th>워크북</th><th>기록</th></tr></thead>
      <tbody>${ps.map(s=>{
        const pr = (s.progress||{})[cur] || {};
        const done = pr.done||0, req = pr.required||0;
        const full = req>0 && done>=req;
        const wb = (OV.workbook||[]).find(w=>w.student_no===s.student_no && w.session_no==cur) || {};
        return `<tr>
          <td><span class="mono">${esc(s.student_no)}</span></td><td>${esc(s.name||'')}</td>
          <td><span class="chip ${full?'ok':done>0?'warn':'bad'}">${done} / ${req}</span></td>
          <td>${wb.collected?'회수 ✓':'—'} ${wb.scanned?'· 스캔 ✓':''}</td>
          <td><button class="btn sm" data-att="${esc(s.student_no)}">출석·워크북</button></td>
        </tr>`;
      }).join('')}</tbody></table>
    </div>
    <p class="hint">회기 마감 3분: ① 빠진 학생 개별 안내 → ② 공유벽 열기 → ③ 워크북 회수·스캔 체크 → ④ 결측 사유 기록.</p>`;

  document.querySelectorAll('[data-open]').forEach(b=> b.onclick = async ()=>{
    busy(b, true, '…');
    await srpc('staff_set_session', { p_session:+b.dataset.open, p_is_open: b.dataset.v==='true' });
    toast(b.dataset.v==='true' ? `${b.dataset.open}차시를 열었습니다.` : `${b.dataset.open}차시를 닫았습니다.`, 'ok');
    go('#/t/today'); route();
  });
  document.querySelectorAll('[data-post]').forEach(b=> b.onclick = async ()=>{
    busy(b, true, '…');
    const s = OV.sessions.find(x=>x.session_no==+b.dataset.post);
    await srpc('staff_set_session', { p_session:+b.dataset.post, p_is_open: s.is_open,
                                      p_post_window: b.dataset.v==='true' });
    toast('회기 후 창을 바꿨습니다.', 'ok'); route();
  });
  document.querySelectorAll('[data-att]').forEach(b=> b.onclick = ()=> attendDialog(b.dataset.att, cur));
}
function todaySession(ss){
  const t = new Date().toISOString().slice(0,10);
  const s = ss.find(x=>x.scheduled_date === t);
  return s ? s.session_no : null;
}

function attendDialog(sno, cur){
  const p = $('#panel');
  const back = p.innerHTML;
  p.innerHTML = `<div class="card" style="max-width:560px">
    <h2>${esc(sno)} · ${cur}차시 기록</h2>
    <div class="row" style="gap:12px;margin-top:10px">
      <div style="flex:1;min-width:180px"><label class="lab" style="font-size:14px">출석</label>
        <select id="a_att"><option value="present">참석</option><option value="late">지각</option>
        <option value="absent">결석</option><option value="remote">원격</option></select></div>
      <div style="flex:1;min-width:180px"><label class="lab" style="font-size:14px">참여 형태</label>
        <select id="a_ptype"><option value="regular">정규</option><option value="makeup">보강</option>
        <option value="retro_entry">소급 입력</option></select></div>
    </div>
    <div class="row" style="gap:12px;margin-top:12px">
      <div style="flex:1;min-width:180px"><label class="lab" style="font-size:14px">워크북</label>
        <select id="a_wb"><option value="">—</option><option value="yes">회수함</option><option value="no">미지참</option></select></div>
      <div style="flex:1;min-width:180px"><label class="lab" style="font-size:14px">스캔</label>
        <select id="a_scan"><option value="">—</option><option value="yes">스캔함</option><option value="no">아직</option></select></div>
    </div>
    <div style="margin-top:12px"><label class="lab" style="font-size:14px">스캔 비고</label>
      <select id="a_note"><option value="">—</option><option value="all">전체 스캔</option>
      <option value="folded_skipped">접어 둔 쪽 제외</option><option value="partial">일부만</option>
      <option value="missing">미지참·분실</option><option value="other">기타</option></select></div>
    <div style="margin-top:12px"><label class="lab" style="font-size:14px">메모</label>
      <input type="text" id="a_memo" placeholder="예: 20분 늦게 들어옴"></div>
    <div class="row end" style="margin-top:16px">
      <button class="btn" id="a_cancel">취소</button>
      <button class="btn p" id="a_save">기록하기</button></div>
  </div>`;
  $('#a_cancel').onclick = ()=>{ p.innerHTML = back; staffToday(); };
  $('#a_save').onclick = async (e)=>{
    busy(btnOf(e), true, '저장 중…');
    try{
      await srpc('staff_set_attendance', { p_student_no: sno, p_session: cur, p_row: {
        attendance_status: $('#a_att').value, participation_type: $('#a_ptype').value,
        workbook_collected: $('#a_wb').value ? $('#a_wb').value==='yes' : null,
        workbook_scanned:  $('#a_scan').value ? $('#a_scan').value==='yes' : null,
        workbook_scan_note: $('#a_note').value || null,
        note: $('#a_memo').value || null,
      }});
      toast('기록했습니다.', 'ok'); go('#/t/today'); route();
    }catch(err){ toast(err.message, 'bad'); busy(btnOf(e), false); }
  };
}

function staffWall(){
  const p = $('#panel');
  const pend = OV.wall_pending || {};
  const keys = Object.keys(pend);
  p.innerHTML = `<h2 style="margin-top:0">공유벽</h2>
    <p class="muted">학생이 올린 글은 <b>대기</b> 상태입니다. 아래 버튼을 누르면 공개 글만 한꺼번에, 무작위 순서로 열립니다.
      미공개 글은 열리지 않고 그대로 보관됩니다.</p>
    <div class="scroll" style="max-height:none;margin-top:12px">
      <table><thead><tr><th>공유벽</th><th>대기 중 공개 글</th><th>미공개 글</th><th></th><th></th></tr></thead>
      <tbody>${keys.length ? keys.map(q=>`<tr>
        <td><b>${esc(q)}</b></td>
        <td><span class="chip ${pend[q].public>0?'warn':''}">${pend[q].public}</span></td>
        <td><span class="chip">${pend[q].private}</span></td>
        <td><button class="btn sm p" data-rel="${esc(q)}" ${pend[q].public>0?'':'disabled'}>한꺼번에 열기</button></td>
        <td><a class="btn sm" href="#/wall/${esc(q)}" target="_blank">큰 화면에 띄우기 ↗</a></td>
      </tr>`).join('') : `<tr><td colspan="5" class="muted">아직 올라온 글이 없습니다.</td></tr>`}</tbody></table>
    </div>
    <div class="note warn" style="margin-top:16px">큰 화면에 띄우기는 <b>새 탭</b>으로 열립니다.
      노트북을 대형 모니터에 연결한 뒤 그 탭을 모니터 쪽으로 옮기고 전체화면(F11)으로 두세요.</div>`;
  document.querySelectorAll('[data-rel]').forEach(b=> b.onclick = async ()=>{
    busy(b, true, '여는 중…');
    const r = await srpc('staff_release_wall', { p_question_id: b.dataset.rel });
    toast(`${r.released}개를 열었습니다.`, 'ok'); route();
  });
}

function staffRoster(){
  const p = $('#panel');
  const ps = OV.participants;
  p.innerHTML = `<h2 style="margin-top:0">명단 · 접속코드</h2>
    <div class="row"><span class="chip info">등록 ${ps.length}명</span>
      <span class="chip ${ps.filter(x=>!x.has_code).length?'warn':'ok'}">코드 없음 ${ps.filter(x=>!x.has_code).length}명</span></div>

    <h3>1) 명단 올리기</h3>
    <p class="muted">한 줄에 한 명. <b>학번</b> 다음에 <b>이름</b>. 쉼표·탭·빈칸 무엇으로 나눠 써도 됩니다. 이미 있는 학번은 건너뜁니다.</p>
    <textarea id="ros" rows="5" placeholder="학번,이름&#10;학번,이름"></textarea>
    <div class="row end" style="margin-top:10px"><button class="btn p" id="rosadd">명단 올리기</button></div>

    <h3>2) 접속코드 발급</h3>
    <p class="muted">코드가 <b>없는 학생만</b> 새로 만듭니다. 만든 코드는 <b>이 화면에서 한 번만</b> 보입니다.
      바로 인쇄해 나눠 주세요. (잃어버리면 그 학생만 다시 발급하면 됩니다.)</p>
    <div class="row"><button class="btn p" id="issue">코드 만들기</button>
      <button class="btn" id="reissue">한 명만 다시 발급</button>
      <button class="btn danger" id="reissueall">전체 다시 발급</button></div>
    <p class="hint">인쇄를 놓쳤으면 <b>전체 다시 발급</b>을 누르세요. 모두에게 새 코드가 나옵니다.
      학생들에게 이미 나눠 준 뒤라면 옛 코드는 쓸 수 없게 되니, 나눠 주기 전에만 쓰세요.</p>
    <div id="codes"></div>

    <h3>3) 명단</h3>
    <div class="scroll"><table><thead><tr><th>학번</th><th>이름</th><th>코드</th>
      ${OV.sessions.map(s=>`<th>${s.session_no}</th>`).join('')}</tr></thead>
      <tbody>${ps.map(s=>`<tr><td>${esc(s.student_no)}</td><td>${esc(s.name||'')}</td>
        <td>${s.has_code?'<span class="chip ok">발급</span>':'<span class="chip bad">없음</span>'}</td>
        ${OV.sessions.map(x=>{ const pr=(s.progress||{})[x.session_no]||{};
          const full = pr.required>0 && pr.done>=pr.required;
          return `<td style="text-align:center">${pr.required? (full?'●':(pr.done?'◐':'○')) : '·'}</td>`; }).join('')}
      </tr>`).join('')}</tbody></table></div>`;

  $('#rosadd').onclick = async (e)=>{
    // 쉼표·탭·빈칸 무엇으로 나눠 써도 받는다. 첫 덩어리가 학번, 나머지가 이름.
    const rows = $('#ros').value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{
      const parts = l.split(/[,\t]+|\s+/).filter(Boolean);
      return { student_no:(parts[0]||'').trim(), name: parts.slice(1).join(' ').trim() };
    }).filter(r=>r.student_no);
    if(!rows.length) return toast('붙여 넣은 내용이 없습니다.', 'bad');
    busy(btnOf(e), true, '올리는 중…');
    try{ const r = await srpc('staff_add_participants', { p_rows: rows });
      toast(`${r.rows}줄 처리. 현재 ${r.total}명.`, 'ok'); route(); }
    catch(err){ toast(err.message, 'bad'); busy(btnOf(e), false); }
  };
  $('#issue').onclick = async (e)=>{
    busy(btnOf(e), true, '만드는 중…');
    try{ showCodes(await srpc('staff_issue_codes', {})); }
    catch(err){ toast(err.message, 'bad'); }
    busy(btnOf(e), false);
  };
  $('#reissueall').onclick = async (e)=>{
    const active = ps.filter(x=>x.status === 'active');
    if(!active.length) return toast('명단이 비어 있습니다.', 'bad');
    if(!confirm(`${active.length}명 모두에게 새 코드를 만듭니다.\n` +
                `지금까지의 코드는 쓸 수 없게 됩니다.\n` +
                `이미 나눠 주셨다면 [취소]를 누르세요.`)) return;
    const btn = e.currentTarget;
    let out = [];
    for(let i=0;i<active.length;i++){
      busy(btn, true, `만드는 중… ${i+1}/${active.length}`);
      try{
        const r = await srpc('staff_issue_codes', { p_reset_student_no: active[i].student_no });
        if(r && r.length) out = out.concat(r);
      }catch(err){ toast(`${active[i].student_no}: ${err.message}`, 'bad'); }
    }
    busy(btn, false);
    showCodes(out);
  };
  $('#reissue').onclick = async ()=>{
    const sno = prompt('다시 발급할 학번을 넣어 주세요.');
    if(!sno) return;
    try{ showCodes(await srpc('staff_issue_codes', { p_reset_student_no: sno.trim() })); }
    catch(err){ toast(err.message, 'bad'); }
  };
  function showCodes(rows){
    if(!rows || !rows.length){ $('#codes').innerHTML = `<p class="muted">새로 만들 코드가 없습니다. (모두 발급됨)</p>`; return; }
    $('#codes').innerHTML = `<div class="note warn no-print">아래 <b>${rows.length}명</b>의 코드는 <b>지금만</b> 보입니다.
        이 화면을 벗어나면 같은 코드는 다시 볼 수 없습니다. <b>바로 인쇄하세요.</b><br>
        종이가 없으면 인쇄 창에서 <b>대상 → PDF로 저장</b>을 고르시면 됩니다.
        (놓치셨어도 괜찮습니다. 위의 <b>전체 다시 발급</b>으로 새로 만들 수 있습니다.)</div>
      <div class="row no-print" style="margin:10px 0"><button class="btn p" onclick="print()">인쇄 / PDF로 저장</button></div>
      <div style="display:none" class="only-print"><b>SEED 프로그램 접속코드 — ${new Date().toLocaleDateString('ko-KR')}</b></div>
      <div class="print-cards">${rows.map(r=>`<div class="pcard">
        <div class="no">${esc(r.student_no)} ${esc(r.name||'')}</div>
        <div class="cd">${esc(r.code)}</div>
        <div style="font-size:12px;color:#5b6458;margin-top:6px">SEED 프로그램 접속코드 · 학번과 함께 넣으세요</div>
      </div>`).join('')}</div>`;
    toast(`${rows.length}명 발급. 지금 인쇄하세요.`, 'ok');
  }
}

function staffData(){
  const p = $('#panel');
  p.innerHTML = `<h2 style="margin-top:0">사전 자기점검 51문항 불러오기</h2>
    <p class="muted">구글폼 응답을 CSV로 내려받아 그대로 붙여 넣으세요.
      첫 줄은 <b>머리글</b>이어야 하고, 학번 열 이름에 <b>학번</b>이 들어가야 합니다.
      나머지 열 이름은 <b>C-01 … E-10</b> 형식이어야 합니다.</p>
    <textarea id="csv" rows="8" placeholder="학번,C-01,C-02,...,E-10&#10;(학번),3,4,...,2"></textarea>
    <div class="row" style="margin-top:10px">
      <input type="text" id="src" placeholder="자료 이름 (예: 2026-09-10 사전검사)" style="max-width:300px">
      <span class="spacer"></span><button class="btn p" id="imp">불러오기</button></div>
    <div id="impres"></div>
    <p class="hint">불러오면 학생 화면의 <b>나의 성장</b>에 5영역 그림이 뜨고,
      1차시 프로파일 칸에 상위 2영역이 자동으로 채워집니다. 솔루션카드는 5차시부터 보입니다.</p>`;
  $('#imp').onclick = async (e)=>{
    const txt = $('#csv').value.trim();
    if(!txt) return toast('붙여 넣은 내용이 없습니다.', 'bad');
    let rows;
    try{ rows = parseCSV(txt); }catch(err){ return toast(err.message, 'bad'); }
    if(!rows.length) return toast('읽을 수 있는 줄이 없습니다.', 'bad');
    busy(btnOf(e), true, '불러오는 중…');
    try{
      const r = await srpc('staff_import_selfcheck', { p_rows: rows, p_source: $('#src').value || null });
      const miss = r.not_found || [];
      $('#impres').innerHTML = `<div class="note ${miss.length?'warn':''}" style="margin-top:14px">
        <b>${r.imported}명</b> 불러왔습니다.
        ${miss.length ? `<br>명단에 없는 학번 ${miss.length}개: ${miss.map(esc).join(', ')} — 명단 탭에서 먼저 등록해 주세요.` : ''}</div>`;
      toast(`${r.imported}명 불러왔습니다.`, 'ok');
    }catch(err){ toast(err.message, 'bad'); }
    busy(btnOf(e), false);
  };
}
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  const head = splitLine(lines[0]);
  const snoIdx = head.findIndex(hd=>/학번|student/i.test(hd));
  if(snoIdx < 0) throw new Error('학번 열을 찾지 못했습니다. 머리글에 "학번"이 있어야 합니다.');
  const items = head.map((hd,i)=>({ i, code:(hd.match(/\b([CMLAE])\s*-?\s*(\d{1,2})\b/i)||[]).slice(1) }))
                    .filter(x=>x.code.length===2)
                    .map(x=>({ i:x.i, code: x.code[0].toUpperCase()+'-'+String(x.code[1]).padStart(2,'0') }));
  if(!items.length) throw new Error('문항 열(C-01 … E-10)을 찾지 못했습니다.');
  return lines.slice(1).map(l=>{
    const c = splitLine(l), scores = {};
    items.forEach(x=>{ const v = Number(c[x.i]); if(!isNaN(v) && c[x.i] !== '') scores[x.code] = v; });
    return { student_no: (c[snoIdx]||'').trim(), scores };
  }).filter(r=>r.student_no && Object.keys(r.scores).length);
}
function splitLine(l){
  const out = []; let cur = '', q = false;
  for(let i=0;i<l.length;i++){
    const ch = l[i];
    if(ch === '"'){ if(q && l[i+1] === '"'){ cur += '"'; i++; } else q = !q; }
    else if((ch === ',' || ch === '\t') && !q){ out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out.map(s=>s.trim());
}

function staffHistory(){
  const p = $('#panel');
  p.innerHTML = `<h2 style="margin-top:0">고쳐 쓴 자국</h2>
    <p class="muted">학생이 저장한 모든 버전을 봅니다. 무엇을 어떻게 고쳐 갔는지가 질적 자료입니다.</p>
    <div class="row"><input type="text" id="hsno" placeholder="학번" style="max-width:200px">
      <input type="text" id="hfid" placeholder="칸 번호 (비우면 전부)" style="max-width:220px">
      <button class="btn p" id="hgo">보기</button></div>
    <div id="hres" style="margin-top:14px"></div>`;
  $('#hgo').onclick = async (e)=>{
    const sno = $('#hsno').value.trim(); if(!sno) return toast('학번을 넣어 주세요.', 'bad');
    busy(btnOf(e), true, '…');
    try{
      const rows = await srpc('staff_history', { p_student_no: sno, p_field_id: $('#hfid').value.trim() || null });
      $('#hres').innerHTML = rows.length ? `<div class="scroll"><table>
        <thead><tr><th>칸</th><th>내용</th><th>버전</th><th>앞 버전</th><th>시각</th></tr></thead>
        <tbody>${rows.map(r=>`<tr>
          <td><b>${esc(r.field_id)}</b><br><span class="muted">${esc(r.label||'')}</span></td>
          <td style="max-width:360px;white-space:pre-wrap">${esc(r.value)}</td>
          <td>${r.revision} / ${r.total}</td>
          <td style="max-width:280px;white-space:pre-wrap;color:#5b6458">${esc(r.prev_value||'')}</td>
          <td>${fmtTime(r.saved_at)}</td></tr>`).join('')}</tbody></table></div>`
        : `<p class="muted">저장된 기록이 없습니다.</p>`;
    }catch(err){ toast(err.message, 'bad'); }
    busy(btnOf(e), false);
  };
}

/* =====================================================================
   9. 큰 화면에 띄우는 공유벽
   ===================================================================== */
let projTimer = null;
async function viewProject(qid){
  if(!Store.jwt){ toast('선생님 계정으로 먼저 들어와 주세요.', 'bad'); return viewStaffLogin(); }
  document.body.className = 'project';
  const draw = async ()=>{
    let d;
    try{ d = await srpc('staff_wall_view', { p_question_id: qid }); }
    catch(e){ toast(e.message, 'bad'); return; }
    const q = d.question || {};
    app().innerHTML = `<div class="wrap wide">
      <div class="phead"><h1>${esc(q.prompt || qid)}</h1>
        <span class="n">${q.session_no ? q.session_no+'차시 · ' : ''}${(d.posts||[]).length}개${d.pending ? ` · 대기 ${d.pending}` : ''}</span>
        <span class="spacer" style="flex:1"></span>
        <button class="btn sm" id="prel" ${d.pending ? '' : 'disabled'}>대기 중인 글 열기 (${d.pending||0})</button>
        <button class="btn sm ghost" id="pback" style="color:#9ecb9c">닫기</button></div>
      <div class="wallgrid">${(d.posts||[]).map(p=>`<div class="post">${
        p.parts.map(x=>`${partLabel(q, x.part_key)}<p>${esc(x.content)}</p>`).join('')}</div>`).join('')
        || `<p style="color:#9ecb9c;font-size:20px">아직 열린 글이 없습니다. [대기 중인 글 열기]를 누르세요.</p>`}</div>
    </div>`;
    $('#prel').onclick = async (e)=>{
      busy(btnOf(e), true, '여는 중…');
      const r = await srpc('staff_release_wall', { p_question_id: qid });
      toast(`${r.released}개를 열었습니다.`, 'ok'); draw();
    };
    $('#pback').onclick = ()=>{ clearInterval(projTimer); go('#/t/wall'); };
  };
  await draw();
  clearInterval(projTimer);
  projTimer = setInterval(draw, 15000);
}

/* ---------- 시작 ---------- */
route();
