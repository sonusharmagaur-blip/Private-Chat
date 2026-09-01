import { firebaseConfig } from './firebase-config.js';

const $ = (id) => document.getElementById(id);
const state = { role:'a', unlocked:false, messages:[], db:null, roomRef:null, unsubscribe:null, online:false };
const KEYS = { setup:'privateChat.setup', messages:'privateChat.messages' };

function show(id){ ['setupScreen','lockScreen','chatScreen'].forEach(x=>$(x).classList.toggle('hidden',x!==id)); }
async function sha(text){ const data=new TextEncoder().encode(text); const hash=await crypto.subtle.digest('SHA-256',data); return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
function getSetup(){ try{return JSON.parse(localStorage.getItem(KEYS.setup))}catch{return null} }
function localMessages(){ try{return JSON.parse(localStorage.getItem(KEYS.messages))||[]}catch{return[]} }
function setLocalMessages(v){ localStorage.setItem(KEYS.messages,JSON.stringify(v)); }
function escapeText(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function trimMessages(items){ const sorted=[...items].sort((a,b)=>a.createdAt-b.createdAt); const keep=new Set(); ['a','b'].forEach(role=>sorted.filter(m=>m.sender===role).slice(-3).forEach(m=>keep.add(m.id))); return sorted.filter(m=>keep.has(m.id)); }
function time(ts){ return new Intl.DateTimeFormat('en-IN',{hour:'2-digit',minute:'2-digit'}).format(new Date(ts)); }

async function initOnline(setup){
  if(!firebaseConfig?.databaseURL) return false;
  try{
    const {initializeApp}=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const {getAuth,signInAnonymously}=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
    const {getDatabase,ref,onValue,push,set,update,remove,query,orderByChild}=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');
    const app=initializeApp(firebaseConfig); await signInAnonymously(getAuth(app));
    state.db={ref,onValue,push,set,update,remove,query,orderByChild};
    state.roomRef=ref(getDatabase(app),`rooms/${await sha(setup.room)}/messages`);
    state.unsubscribe=onValue(state.roomRef,async snap=>{
      const raw=snap.val()||{}; state.messages=Object.entries(raw).map(([id,v])=>({id,...v}));
      const trimmed=trimMessages(state.messages); const valid=new Set(trimmed.map(m=>m.id));
      await Promise.all(state.messages.filter(m=>!valid.has(m.id)).map(m=>remove(ref(state.roomRef,`/${m.id}`))));
      state.messages=trimmed; markSeen(); render();
    });
    state.online=true; $('statusLine').innerHTML='<i class="status-dot"></i> online'; return true;
  }catch(e){ console.warn('Online sync unavailable',e); return false; }
}

async function openChat(){
  const setup=getSetup(); state.role=setup.role; state.unlocked=true; show('chatScreen');
  if(!await initOnline(setup)){ state.messages=trimMessages(localMessages()); $('statusLine').innerHTML='<i class="status-dot"></i> device-local mode'; markSeen(); render(); }
  $('messageInput').focus();
}
async function markSeen(){
  const now=Date.now(); const unread=state.messages.filter(m=>m.sender!==state.role&&!m.seenAt);
  if(!unread.length)return;
  if(state.online){ await Promise.all(unread.map(m=>state.db.update(state.db.ref(state.roomRef,`/${m.id}`),{seenAt:now}))); }
  else { unread.forEach(m=>m.seenAt=now); setLocalMessages(state.messages); }
}
function render(){
  const list=$('messageList'); list.innerHTML='';
  if(!state.messages.length){ list.innerHTML='<div class="empty-state">Messages private room mein dikhengi. Pehla message bhejiye.</div>'; return; }
  const chip=document.createElement('div'); chip.className='day-chip'; chip.textContent='Recent messages'; list.appendChild(chip);
  state.messages.sort((a,b)=>a.createdAt-b.createdAt).forEach(m=>{
    const row=document.createElement('div'); row.className='message-row '+(m.sender===state.role?'mine':'theirs');
    const ticks=m.sender===state.role?`<span class="ticks ${m.seenAt?'seen':''}">${m.seenAt?'✓✓':'✓✓'}</span>`:'';
    row.innerHTML=`<div class="bubble"><div>${escapeText(m.text)}</div><div class="meta"><span>${time(m.createdAt)}</span>${ticks}</div></div>`; list.appendChild(row);
  }); requestAnimationFrame(()=>list.scrollTop=list.scrollHeight);
}
async function sendMessage(text){
  const msg={sender:state.role,text:text.trim(),createdAt:Date.now(),deliveredAt:Date.now(),seenAt:null}; if(!msg.text)return;
  if(state.online){ const item=state.db.push(state.roomRef); await state.db.set(item,msg); }
  else { state.messages=trimMessages([...state.messages,{id:crypto.randomUUID(),...msg}]); setLocalMessages(state.messages); render(); }
}
function lock(){ state.unlocked=false; $('unlockPin').value=''; show('lockScreen'); }

document.querySelectorAll('.role-btn').forEach(btn=>btn.addEventListener('click',()=>{ document.querySelectorAll('.role-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); state.role=btn.dataset.role; }));
$('saveSetup').addEventListener('click',async()=>{ const pin=$('newPin').value.trim(),room=$('roomCode').value.trim(); if(!/^\d{4,8}$/.test(pin)||room.length<4){$('setupError').textContent='4–8 digit PIN aur minimum 4 character room code daalein.';return} localStorage.setItem(KEYS.setup,JSON.stringify({role:state.role,room,pinHash:await sha(pin)})); $('newPin').value=''; await openChat(); });
$('unlockBtn').addEventListener('click',async()=>{ const setup=getSetup(); if(await sha($('unlockPin').value)===setup.pinHash){$('unlockError').textContent='';await openChat()}else $('unlockError').textContent='Wrong PIN'; });
$('unlockPin').addEventListener('keydown',e=>{if(e.key==='Enter')$('unlockBtn').click()});
$('resetBtn').addEventListener('click',()=>{ if(confirm('Is device ka setup reset karein?')){localStorage.removeItem(KEYS.setup);location.reload()} });
$('lockBtn').addEventListener('click',lock);
$('messageForm').addEventListener('submit',async e=>{e.preventDefault(); const input=$('messageInput'),value=input.value; input.value=''; input.style.height='auto'; await sendMessage(value)});
$('messageInput').addEventListener('input',e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,110)+'px'});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.unlocked)lock()});
window.addEventListener('pagehide',()=>{state.unlocked=false}); window.addEventListener('pageshow',e=>{if(e.persisted&&getSetup())lock()});
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
getSetup()?show('lockScreen'):show('setupScreen');
