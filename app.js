const tfetch=(u,o={})=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);if(o.signal)o.signal.addEventListener('abort',()=>c.abort());return fetch(u,{...o,signal:c.signal}).finally(()=>clearTimeout(t))};
const db=supabase.createClient(OREA_CONFIG.SUPABASE_URL,OREA_CONFIG.SUPABASE_ANON_KEY,{global:{fetch:tfetch}});
const $=s=>document.querySelector(s);
const CUR=['CDF','USD','EUR'],SYM={CDF:'FC',USD:'$',EUR:'€'};
const S={me:null,school:null,classes:[],stu:[],cls:null,sort:'alpha',tab:'accueil',cur:localStorage.cur||'CDF',year:null,q:'',ft:'all',offline:false,fees:[],fpaid:{},terms:{},depenses:[],depDate:null,bilDate:null,impcls:'',impf:'all',imps:'anciennete',_bilan:null,events:[],evMonth:null,absM:null,sanM:null};
document.documentElement.dataset.theme=localStorage.theme||'dark';
const dir=()=>S.me.role==='directeur';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(n,d=2)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
const fmt=n=>nf(n/(S.school.rates[S.cur]||1),S.cur==='CDF'?0:2)+' '+SYM[S.cur];
const isNet=e=>!!e&&(e.name==='AuthRetryableFetchError'||e.status===0||/fetch|network|abort|load failed|timed? ?out/i.test(e.message||''));
const toast=m=>{m=/failed to fetch|networkerror|network request|abort|load failed/i.test(m)?'Pas de connexion internet.':m;const t=$('#toast');t.textContent=m;t.hidden=false;setTimeout(()=>t.hidden=true,4000)};
let dlgPushed=false,ignorePop=false;
const show=h=>{const d=$('#dlg');d.innerHTML=h;if(!d.open){d.showModal();if(!dlgPushed){history.pushState({dlg:1},'');dlgPushed=true}}return d};
$('#dlg').addEventListener('close',()=>setTimeout(()=>{const d=$('#dlg');if(!d.open&&dlgPushed){dlgPushed=false;ignorePop=true;history.back()}},0));
window.addEventListener('popstate',()=>{if(ignorePop){ignorePop=false;return}const d=$('#dlg');if(d.open){dlgPushed=false;d.close();return}if(S.me&&!['accueil','menu'].includes(S.tab)){if(['impayes','depenses','bilan','presences','caisse','absences','sanctions','calendrier'].includes(S.tab)){S.tab='menu';render()}else{S.tab='accueil';render()}}});
const sum=a=>a.reduce((t,p)=>t+Number(p.amount_cdf),0);
const out=async()=>{const n=S.me?qget().length:0;if(n&&!confirm(n+' élément(s) pas encore envoyé(s) seront perdus. Se déconnecter quand même ?'))return;if(S.me)localStorage.removeItem('orea_q_'+S.me.id);localStorage.removeItem('orea_snap');await db.auth.signOut();location.reload()};

let defPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();defPrompt=e});
window.addEventListener('appinstalled',()=>{defPrompt=null;const b=$('#ibc');if(b)b.remove()});
const isInstalled=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const installCard=()=>isInstalled()?'':`<div class=card><span>Application</span><button id=ibc class=ghost style=width:auto onclick=installApp()>📲 Installer</button></div>`;
async function installApp(){
  if(defPrompt){defPrompt.prompt();const{outcome}=await defPrompt.userChoice;if(outcome==='accepted')defPrompt=null;return}
  show('<h3>Installer ORÉA École</h3><p>Dans Chrome, touche le menu <b>⋮</b> en haut à droite, puis <b>Ajouter à l’écran d’accueil</b> (ou <b>Installer l’application</b>).</p><form method=dialog><button>OK</button></form>');
}

function ask(title,fields,ok){
  const d=show(`<form method=dialog><h3>${title}</h3>${fields.map(f=>`<label>${f.l}${f.o?`<select name=${f.n}>${f.o.map(o=>`<option value="${o[0]}" ${o[0]===f.v?'selected':''}>${o[1]}</option>`).join('')}</select>`:f.t==='textarea'?`<textarea name=${f.n} rows=4 style="width:100%" ${f.r===false?'':'required'}>${esc(f.v)}</textarea>`:`<input name=${f.n} type=${f.t||'text'} step=any value="${esc(f.v)}" ${f.r===false?'':'required'}>`}</label>`).join('')}<div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Valider</button></div></form>`);
  d.querySelector('form').onsubmit=async e=>{if(e.submitter.value!=='ok')return;const v=Object.fromEntries(new FormData(e.target));try{await ok(v)}catch(x){toast(x.message||'Erreur')}};
}

/* ---------- Années scolaires ---------- */
const cy=c=>c.year||'Sans année';
const yrs=()=>[...new Set(S.classes.map(cy))].sort((a,b)=>a==='Sans année'?1:b==='Sans année'?-1:b.localeCompare(a,'fr'));
function pickYear(){const y=yrs(),k='orea_year_'+S.school.id;if(!S.year||!y.includes(S.year)){const st=localStorage[k];S.year=y.includes(st)?st:(y[0]||'')}}
const yc=()=>{pickYear();return S.classes.filter(c=>cy(c)===S.year)};
const ys=()=>{const ids=new Set(yc().map(c=>c.id));return S.stu.filter(s=>ids.has(s.class_id))};
function setYear(v){S.year=v;localStorage['orea_year_'+S.school.id]=v;S.cls=null;render()}
const ybar=()=>yrs().length>1?`<div class=bar><select onchange="setYear(this.value)">${yrs().map(y=>`<option value="${esc(y)}" ${y===S.year?'selected':''}>${esc(y)}</option>`).join('')}</select></div>`:'';
const nrm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const rno=p=>p.receipt_no?'REC-'+String(p.receipt_no).padStart(4,'0'):'REC-…';
function newYear(){
  const m=String(S.year).match(/(\d{4})\D+(\d{4})/),sg=m?(+m[1]+1)+'-'+(+m[2]+1):'';
  ask('Nouvelle année scolaire',[{n:'y',l:'Année (ex : 2027-2028)',v:sg},{n:'cp',l:'Classes de départ',o:[['1','Copier les classes et les frais de '+esc(S.year)],['0','Partir de zéro']],v:'1'}],async v=>{
    const y=v.y.trim();
    if(!y)throw Error('Année obligatoire');
    if(yrs().includes(y))throw Error('Cette année existe déjà');
    if(v.cp==='0'){setTimeout(()=>addClass(y),60);return}
    const rows=yc().map(c=>({school_id:S.school.id,name:c.name,year:y,fee_t1:c.fee_t1,fee_t2:c.fee_t2,fee_t3:c.fee_t3,fee_currency:c.fee_currency}));
    if(!rows.length)throw Error('Aucune classe à copier');
    const{data:nc,error}=await db.from('classes').insert(rows).select();if(error)throw error;
    const fo=S.fees.filter(f=>cy(f)===S.year&&!f.student_id);
    if(fo.length&&nc){const nm=Object.fromEntries(S.classes.map(c=>[c.id,c.name])),fr=fo.map(f=>{const cn=f.class_id?nc.find(c=>c.name===nm[f.class_id]):null;return f.class_id&&!cn?null:{school_id:S.school.id,year:y,name:f.name,amount:f.amount,currency:f.currency,class_id:cn?cn.id:null}}).filter(Boolean);if(fr.length){const{error:e2}=await db.from('extra_fees').insert(fr);if(e2)toast(e2.message)}}
    S.year=y;S.cls=null;localStorage['orea_year_'+S.school.id]=y;await load();render();toast('Année '+y+' créée. Utilise « Passage de classe ».');
  });
}
function promote(){
  const oth=yrs().filter(y=>y!==S.year);
  if(!oth.length)return toast('Crée d’abord la nouvelle année (+ Nouvelle année).');
  const src=yc();if(!src.length)return toast('Aucune classe à faire passer.');
  let tg=oth[0];
  const guess=(n,tc)=>{const m=n.match(/\d+/);if(!m)return'';const g=n.replace(/\d+/,+m[0]+1).toLowerCase(),c=tc.find(x=>x.name.toLowerCase()===g);return c?c.id:''};
  const d=show(`<form method=dialog><h3>Passage de classe</h3><small>De ${esc(S.year)} vers :</small><select id=py>${oth.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join('')}</select><div id=pm></div><small>Les élèves gardent leur ancien dossier (paiements) dans l’année précédente. Les remises ne sont pas reportées.</small><label><input type=checkbox name=pc checked style=width:auto> Reporter les impayés de ${esc(S.year)} (frais « Arriérés »)</label><div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Faire passer</button></div></form>`);
  const draw=()=>{const tc=S.classes.filter(c=>cy(c)===tg);d.querySelector('#pm').innerHTML=src.map(c=>{const n=S.stu.filter(s=>s.class_id===c.id).length,g=guess(c.name,tc);return `<label>${esc(c.name)} (${n} élève${n>1?'s':''}) →<select name="m_${c.id}"><option value="">— Ne pas passer —</option>${tc.map(t=>`<option value="${t.id}" ${t.id===g?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>`}).join('')};
  draw();
  d.querySelector('#py').onchange=e=>{tg=e.target.value;draw()};
  d.querySelector('form').onsubmit=async e=>{
    if(e.submitter.value!=='ok')return;
    e.preventDefault();
    const f=e.target,rows=[],bal={},carry=f.elements.pc.checked;
    for(const c of src){const dest=f.elements['m_'+c.id].value;if(!dest)continue;const have=new Set(S.stu.filter(s=>s.class_id===dest).map(s=>s.name.toLowerCase()));S.stu.filter(s=>s.class_id===c.id).forEach(s=>{if(!have.has(s.name.toLowerCase())){rows.push({school_id:S.school.id,class_id:dest,name:s.name,parent_phone:s.parent_phone});if(carry&&s.balance_cdf>0)bal[dest+'|'+s.name.toLowerCase()]=Math.round(s.balance_cdf)}})}
    if(!rows.length)return toast('Aucun élève à faire passer');
    const nb=Object.keys(bal).length;
    if(!confirm(rows.length+' élève(s) seront inscrits en '+tg+(nb?' ; '+nb+' impayé(s) seront reportés (arriérés)':'')+'. Continuer ?'))return;
    e.submitter.disabled=true;const ns=[];
    for(let i=0;i<rows.length;i+=300){const{data,error}=await db.from('students').insert(rows.slice(i,i+300)).select('id,class_id,name');if(error){e.submitter.disabled=false;return toast(error.message)}ns.push(...data)}
    let rep=0;
    if(nb){const fr=ns.filter(n=>bal[n.class_id+'|'+n.name.toLowerCase()]).map(n=>({school_id:S.school.id,year:tg,name:'Arriérés '+S.year,amount:bal[n.class_id+'|'+n.name.toLowerCase()],currency:'CDF',class_id:n.class_id,student_id:n.id}));
      for(let i=0;i<fr.length;i+=300){const{error}=await db.from('extra_fees').insert(fr.slice(i,i+300));if(error){toast('Élèves inscrits, mais report impossible : '+error.message);break}rep+=Math.min(300,fr.length-i)}}
    d.close();S.year=tg;localStorage['orea_year_'+S.school.id]=tg;S.cls=null;await load();render();toast(rows.length+' élève(s) inscrit(s) en '+tg+(rep?' · '+rep+' impayé(s) reporté(s)':''));
  };
}

/* ---------- Hors connexion : copie locale et file d'attente ---------- */
function saveSnap(){try{localStorage.orea_snap=JSON.stringify({uid:S.me.id,me:S.me,school:S.school,classes:S.classes,stu:S.stu,fees:S.fees,fpaid:S.fpaid,terms:S.terms,at:Date.now()})}catch{}}
function readSnap(){try{return JSON.parse(localStorage.orea_snap||'null')}catch{return null}}
function goOffline(sn){S.me=sn.me;S.school=sn.school;S.classes=sn.classes;S.stu=sn.stu;S.fees=sn.fees||[];S.fpaid=sn.fpaid||{};S.terms=sn.terms||{};S.offline=true;$('#hs').textContent=sn.school.name;render();toast('Mode hors connexion : tu peux encaisser et faire l’appel.')}
function netView(){$('#nav').hidden=true;$('#main').innerHTML='<div class=auth><h2>Pas de connexion</h2><p>Connecte-toi à internet une première fois pour charger tes données.</p><button onclick=boot()>Réessayer</button></div>'}
const qkey=()=>'orea_q_'+(S.me&&S.me.id);
function qget(){if(!S.me)return[];try{return JSON.parse(localStorage[qkey()]||'[]')}catch{return[]}}
function qset(a){localStorage[qkey()]=JSON.stringify(a);qui()}
function qadd(it){let a=qget();if(it.k==='att')a=a.filter(x=>!(x.k==='att'&&x.student_id===it.student_id&&x.day===it.day));a.push({...it,qid:crypto.randomUUID(),at:it.at||new Date().toISOString()});qset(a)}
function qui(){
  let b=$('#qb');
  const a=qget(),bad=a.filter(x=>x.err).length,off=S.offline||!navigator.onLine;
  if(!S.me||(!a.length&&!off)){if(b)b.hidden=true;return}
  if(!b){b=document.createElement('div');b.id='qb';b.onclick=qview;$('header').after(b)}
  b.hidden=false;b.className=off?'off':'';
  b.textContent=[off?'📴 Hors connexion':'',a.length?'⏳ '+a.length+' en attente d’envoi':'',bad?'⚠ '+bad+' à vérifier':''].filter(Boolean).join(' · ');
}
function applyLocal(sid,term,cdf){
  const s=S.stu.find(x=>x.id===sid);if(!s)return;
  const rem=trims(s)[term-1][1];
  s['p'+term+'_cdf']=Number(s['p'+term+'_cdf']||0)+cdf;
  s.paid_cdf=Number(s.paid_cdf||0)+cdf;
  s.balance_cdf=Math.max(0,Number(s.balance_cdf)-Math.min(cdf,rem));
  s.last_pay=new Date().toISOString();
}
const cdfOf=x=>x.amount*(S.school.rates[x.currency]||1);
function overlayQ(){qget().forEach(x=>{if(x.k==='pay')applyLocal(x.student_id,x.term,cdfOf(x));else if(x.k==='fpay')applyLocalFee(x)})}
function qToday(){const t0=new Date();t0.setHours(0,0,0,0);return qget().filter(x=>(x.k==='pay'||x.k==='fpay')&&new Date(x.at)>=t0).reduce((t,x)=>t+cdfOf(x),0)}
function payOffline(row){
  const at=new Date().toISOString(),isF=!!row.fee_id;
  qadd({k:isF?'fpay':'pay',...row,at});
  if(isF)applyLocalFee(row);else applyLocal(row.student_id,row.term,cdfOf(row));
  saveSnap();render();
  toast('Enregistré hors connexion. Envoi automatique dès que le réseau revient.');
  receipt({...row,created_at:at,collector_id:S.me.id,receipt_no:null},row.student_id);
}
async function qsend(it){
  if(it.k==='att'){const{k,qid,at,err,...row}=it;return db.from('attendance').upsert(row,{onConflict:'student_id,day'})}
  const{k,qid,at,err,...row}=it;
  const tb=k==='fpay'?'fee_payments':'payments';
  let r=await db.from(tb).insert({...row,created_at:at});
  if(r.error&&r.error.code==='42501')r=await db.from(tb).insert(row);
  if(r.error&&r.error.code==='23505'){if(/pkey/.test(r.error.message||''))return{};return{error:{message:'Référence Mobile Money déjà utilisée'}}}
  return r;
}
let syncing=false;
async function qsync(){
  if(syncing||!S.me||S.offline||!navigator.onLine)return;
  const todo=qget().filter(x=>!x.err);if(!todo.length)return;
  syncing=true;let done=0;
  try{
    for(const it of todo){
      let r;try{r=await qsend(it)}catch(e){r={error:e}}
      if(r.error&&isNet(r.error))break;
      const cur=qget();
      if(!r.error){qset(cur.filter(x=>x.qid!==it.qid));done++}
      else qset(cur.map(x=>x.qid===it.qid?{...x,err:r.error.message||'Refusé'}:x));
    }
  }finally{syncing=false}
  if(done){await load();if(!$('#dlg').open)render();toast(done+' élément(s) envoyé(s) ✓')}
}
function qview(){
  const a=qget(),sn=id=>(S.stu.find(x=>x.id===id)||{}).name||'?';
  const d=show(`<h3>En attente d’envoi</h3>${a.length?a.map(x=>`<div class="card col"><b>${x.k==='pay'?'Paiement · '+esc(sn(x.student_id))+' · '+nf(x.amount)+' '+x.currency+' (T'+x.term+')':x.k==='fpay'?'Frais · '+esc(sn(x.student_id))+' · '+esc(x.fee_name||'')+' · '+nf(x.amount)+' '+x.currency:'Présence · '+esc(sn(x.student_id))+' · '+x.status}</b><small>${new Date(x.at).toLocaleString('fr-FR')}</small>${x.err?`<span class=due>⚠ ${esc(x.err)}</span><div class=row><button class=ghost data-r="${x.qid}">Réessayer</button><button class=ghost data-d="${x.qid}">Supprimer</button></div>`:''}</div>`).join(''):'<p class=empty>Rien en attente.</p>'}<div class=col><button id=qs>Envoyer maintenant</button><button class=ghost id=qc>Fermer</button></div>`);
  d.querySelector('#qc').onclick=()=>d.close();
  d.querySelector('#qs').onclick=async()=>{d.close();await qsync()};
  d.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{qset(qget().map(x=>x.qid===b.dataset.r?{...x,err:undefined}:x));d.close();qsync()});
  d.querySelectorAll('[data-d]').forEach(b=>b.onclick=async()=>{if(!confirm('Supprimer cet élément ? Il ne sera jamais envoyé.'))return;qset(qget().filter(x=>x.qid!==b.dataset.d));d.close();await load();render()});
}

/* ---------- Démarrage ---------- */
async function boot(){
  $('#dlg').close?.();
  const snap=readSnap();
  let session=null;
  try{
    const r=await db.auth.getSession();session=r.data.session;
    if(!session&&snap&&(isNet(r.error)||!navigator.onLine))return goOffline(snap);
  }catch(e){if(snap)return goOffline(snap)}
  if(!session)return authView();
  if(!navigator.onLine&&snap&&snap.uid===session.user.id)return goOffline(snap);
  const{data:adm,error:ea}=await db.rpc('is_platform_admin');
  if(isNet(ea))return snap&&snap.uid===session.user.id?goOffline(snap):netView();
  if(adm===true){$('#hs').textContent='Administration';return adminView()}
  const{data:p,error:ep}=await db.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
  if(isNet(ep))return snap&&snap.uid===session.user.id?goOffline(snap):netView();
  if(!p)return setupView();
  if(p.active===false){$('#nav').hidden=true;$('#main').innerHTML='<div class=auth><h2>Compte désactivé</h2><p>Contacte le directeur de ton école.</p><button class=ghost onclick=out()>Déconnexion</button></div>';return}
  S.me=p;
  db.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',p.id).then(()=>{},()=>{});
  const{data:s,error:es}=await db.from('schools').select('*').eq('id',p.school_id).single();
  if(!s)return isNet(es)&&snap&&snap.uid===p.id?goOffline(snap):netView();
  S.school=s;$('#hs').textContent=s.name;
  if(s.sub_until){
    const left=Math.ceil((new Date(s.sub_until)-Date.now())/864e5);
    if(left<=0)return lockView();
  }
  await autoRate();await qsync();await load();render();
}

/* ---------- Autres frais, trimestres, statistiques ---------- */
const rateOf=cur=>S.school.rates[cur]||1;
const fees4=s=>{const c=S.classes.find(x=>x.id===s.class_id);if(!c)return[];return S.fees.filter(f=>cy(f)===cy(c)&&(!f.class_id||f.class_id===c.id)&&(!f.student_id||f.student_id===s.id))};
const feeRem=(s,f)=>Math.max(0,Number(f.amount)-(S.fpaid[s.id+':'+f.id]||0));
const feeRemCdf=(s,f)=>feeRem(s,f)*rateOf(f.currency);
async function pageAll(mk){let all=[],i=0;for(;;){const{data,error}=await mk().order('id').range(i,i+999);if(error)return{error};all=all.concat(data);if(data.length<1000)break;i+=1000}return{data:all}}
function augment(){
  S.stu.forEach(s=>{
    const fs=fees4(s);let due=0,exp=0;
    fs.forEach(f=>{exp+=Number(f.amount)*rateOf(f.currency);due+=feeRemCdf(s,f)});
    s.fee_due_cdf=due;s.fee_exp_cdf=exp;
    s.balance_cdf=Number(s.balance_cdf||0)+due;
    s.paid_cdf=Number(s.paid_cdf||0)+(exp-due);
  });
}
function applyLocalFee(x){
  const s=S.stu.find(i=>i.id===x.student_id),f=S.fees.find(i=>i.id===x.fee_id);if(!s||!f)return;
  const before=feeRemCdf(s,f),k=s.id+':'+f.id;
  S.fpaid[k]=(S.fpaid[k]||0)+x.amount*rateOf(x.currency)/rateOf(f.currency);
  const d=before-feeRemCdf(s,f);
  s.balance_cdf=Math.max(0,s.balance_cdf-d);s.fee_due_cdf-=d;s.paid_cdf+=d;
}
const hasTerms=()=>{const t=S.terms[S.year];return !!(t&&(t.t1||t.t2||t.t3))};
function curTerm(year){const t=S.terms[year];if(!t||!(t.t1||t.t2||t.t3))return null;const now=tdy();let k=0;[t.t1,t.t2,t.t3].forEach((d,i)=>{if(d&&d<=now)k=i+1});return k}
function status(s){
  if(s.balance_cdf<=0)return'paid';
  const c=S.classes.find(x=>x.id===s.class_id),k=c?curTerm(cy(c)):null;
  if(k===null)return'due';
  return trims(s).slice(0,k).some(t=>t[1]>0)?'late':'ok';
}
function stTag(s){
  const st=status(s);
  if(st==='paid')return'<span class=ok>✓ Soldé</span>';
  if(st==='ok')return`<span class=ok>✅ À jour<br><small>reste ${fmt(s.balance_cdf)}</small></span>`;
  if(st==='late')return`<span class=due>🔴 En retard<br><small>Doit ${fmt(s.balance_cdf)}</small></span>`;
  return`<span class=due>Doit ${fmt(s.balance_cdf)}</span>`;
}
function lateCard(){
  if(!hasTerms())return'';
  const n=ys().filter(s=>status(s)==='late').length;
  return`<div class=card onclick="menuGo('impayes')"><span>🔴 Élèves en retard</span><b class="${n?'due':'ok'}">${n}</b></div>`;
}
const short=cdf=>{const v=cdf/rateOf(S.cur);return v>=1e6?nf(v/1e6,1)+' M':v>=1e3?nf(Math.round(v/1e3),0)+' k':nf(v,0)};
function classBars(){
  const r=yc().map(c=>{const l=S.stu.filter(s=>s.class_id===c.id),exp=l.reduce((t,s)=>t+Number(s.due1_cdf||0)+Number(s.due2_cdf||0)+Number(s.due3_cdf||0)+Number(s.fee_exp_cdf||0),0),due=l.reduce((t,s)=>t+Number(s.balance_cdf||0),0);return{n:c.name,p:exp>0?Math.max(0,Math.min(100,Math.round(100*(1-due/exp)))):null}}).filter(x=>x.p!==null);
  if(!r.length)return'';
  return`<div class="card col"><b>Recouvrement par classe</b>${r.map(x=>`<div><div class=row style="justify-content:space-between;margin:2px 0"><small>${esc(x.n)}</small><small><b>${x.p} %</b></small></div><div class=pbar><i style="width:${x.p}%;background:var(${x.p>=80?'--ok':x.p>=50?'--gold':'--bad'})"></i></div></div>`).join('')}</div>`;
}
async function monthChart(){
  const now=new Date(),
