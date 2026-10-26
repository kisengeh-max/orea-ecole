const db=supabase.createClient(OREA_CONFIG.SUPABASE_URL,OREA_CONFIG.SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s);
const CUR=['CDF','USD','EUR'],SYM={CDF:'FC',USD:'$',EUR:'€'};
const S={me:null,school:null,classes:[],stu:[],cls:null,sort:'alpha',tab:'eleves',cur:localStorage.cur||'CDF'};
document.documentElement.dataset.theme=localStorage.theme||'dark';
const dir=()=>S.me.role==='directeur';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(n,d=2)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
const fmt=n=>nf(n/(S.school.rates[S.cur]||1),S.cur==='CDF'?0:2)+' '+SYM[S.cur];
const toast=m=>{const t=$('#toast');t.textContent=m;t.hidden=false;setTimeout(()=>t.hidden=true,4000)};
const show=h=>{const d=$('#dlg');d.innerHTML=h;if(!d.open)d.showModal();return d};
const sum=a=>a.reduce((t,p)=>t+Number(p.amount_cdf),0);
const out=async()=>{await db.auth.signOut();location.reload()};

function ask(title,fields,ok){
  const d=show(`<form method=dialog><h3>${title}</h3>${fields.map(f=>`<label>${f.l}${f.o?`<select name=${f.n}>${f.o.map(o=>`<option value="${o[0]}" ${o[0]===f.v?'selected':''}>${o[1]}</option>`).join('')}</select>`:`<input name=${f.n} type=${f.t||'text'} step=any value="${esc(f.v)}" ${f.r===false?'':'required'}>`}</label>`).join('')}<div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Valider</button></div></form>`);
  d.querySelector('form').onsubmit=async e=>{if(e.submitter.value!=='ok')return;const v=Object.fromEntries(new FormData(e.target));try{await ok(v)}catch(x){toast(x.message||'Erreur')}};
}

/* ---------- Démarrage ---------- */
async function boot(){
  $('#dlg').close?.();
  const{data:{session}}=await db.auth.getSession();
  if(!session)return authView();
  const{data:adm}=await db.rpc('is_platform_admin');
  if(adm===true){$('#hs').textContent='Administration';return adminView()}
  const{data:p}=await db.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
  if(!p)return setupView();
  S.me=p;
  const{data:s}=await db.from('schools').select('*').eq('id',p.school_id).single();
  S.school=s;$('#hs').textContent=s.name;
  if(s.sub_until){
    const left=Math.ceil((new Date(s.sub_until)-Date.now())/864e5);
    if(left<=0)return lockView();
    if(left<=7&&dir())toast('Abonnement : il reste '+left+' jour(s). Contacte l’administrateur.');
  }
  await autoRate();await load();render();
}
async function load(){
  const[a,b]=await Promise.all([db.from('classes').select('*').order('name'),db.from('student_balance').select('*')]);
  if(a.error||b.error)return toast((a.error||b.error).message);
  S.classes=a.data;S.stu=b.data;
}
async function autoRate(){
  const s=S.school;
  if(!dir()||!s.auto_rates||Date.now()-new Date(s.rates_at)<432e5)return;
  try{
    const r=(await(await fetch('https://open.er-api.com/v6/latest/USD')).json()).rates;
    const rates={CDF:1,USD:Math.round(r.CDF*100)/100,EUR:Math.round(r.CDF/r.EUR*100)/100};
    const{data}=await db.from('schools').update({rates,rates_at:new Date().toISOString()}).eq('id',s.id).select().single();
    if(data)S.school=data;
  }catch{}
}

/* ---------- Connexion ---------- */
function authView(){
  $('#nav').hidden=true;
  $('#main').innerHTML=`<div class=auth><img class=ld src=logo-dark.png alt="ORÉA École"><img class=ll src=logo-light.png alt=""><form id=af class=col><input name=email type=email placeholder="E-mail" required><input name=pw type=password placeholder="Mot de passe (8 caractères min.)" minlength=8 required><button>Se connecter</button><button type=button class=ghost id=su>Créer un compte</button></form></div>`;
  $('#af').onsubmit=async e=>{e.preventDefault();const f=e.target;const{error}=await db.auth.signInWithPassword({email:f.email.value,password:f.pw.value});error?toast(error.message):boot()};
  $('#su').onclick=async()=>{const f=$('#af');if(!f.reportValidity())return;const{data,error}=await db.auth.signUp({email:f.email.value,password:f.pw.value});if(error)return toast(error.message);data.session?boot():toast('Compte créé. Confirme ton e-mail, puis connecte-toi.')};
}
function setupView(){
  $('#nav').hidden=true;
  $('#main').innerHTML=`<div class=auth><h2>Bienvenue</h2><button id=c1>Je crée mon école (directeur)</button><button class=ghost id=c2>Je rejoins une école avec un code</button><button class=ghost id=lo>Déconnexion</button></div>`;
  $('#lo').onclick=out;
  $('#c1').onclick=()=>ask('Nouvelle école',[{n:'school',l:'Nom de l’école'},{n:'me',l:'Ton nom'}],async v=>{const{error}=await db.rpc('create_school',{school_name:v.school,my_name:v.me});if(error)throw error;boot()});
  $('#c2').onclick=()=>ask('Rejoindre',[{n:'code',l:'Code d’invitation'},{n:'me',l:'Ton nom'}],async v=>{const{error}=await db.rpc('join_school',{invite:v.code.trim(),my_name:v.me});if(error)throw error;boot()});
}

/* ---------- Écrans ---------- */
function render(){
  $('#nav').hidden=false;
  document.querySelectorAll('#nav button').forEach(b=>{b.classList.toggle('on',b.dataset.t===S.tab);b.onclick=()=>{S.tab=b.dataset.t;render()}});
  ({eleves:vEleves,caisse:vCaisse,reglages:vReglages})[S.tab]();
}
const sorts={
  alpha:(a,b)=>a.name.localeCompare(b.name,'fr'),
  solde:(a,b)=>b.balance_cdf-a.balance_cdf,
  retard:(a,b)=>{const k=s=>s.balance_cdf>0?(s.last_pay?+new Date(s.last_pay):0):9e15;return k(a)-k(b)}
};
function vEleves(){
  const cl=S.classes;let h='';
  if(!cl.length)h='<p class=empty>Aucune classe pour le moment.</p>';
  else{
    if(!cl.some(c=>c.id===S.cls))S.cls=cl[0].id;
    h=`<div class=bar><select id=cs>${cl.map(c=>`<option value="${c.id}" ${c.id===S.cls?'selected':''}>${esc(c.name)}</option>`).join('')}</select><select id=so><option value=alpha>Alphabétique A → Z</option><option value=solde>Plus grand solde dû</option><option value=retard>Retard de paiement</option></select></div>`;
    const l=S.stu.filter(s=>s.class_id===S.cls).sort(sorts[S.sort]);
    h+=l.length?l.map(s=>`<div class=card onclick="menu('${s.id}')"><b>${esc(s.name)}</b><span class="${s.balance_cdf>0?'due':'ok'}">${s.balance_cdf>0?'Doit '+fmt(s.balance_cdf):'✓ Soldé'}</span></div>`).join(''):'<p class=empty>Aucun élève dans cette classe.</p>';
  }
  if(dir())h+=`<div class=row><button class=ghost onclick=addClass()>+ Classe</button>${cl.length?'<button onclick=addStudent()>+ Élève</button><button class=ghost onclick=bulkAdd()>+ Liste</button>':''}</div>`;
  $('#main').innerHTML=h;
  if($('#cs')){$('#so').value=S.sort;$('#cs').onchange=e=>{S.cls=e.target.value;vEleves()};$('#so').onchange=e=>{S.sort=e.target.value;vEleves()}}
}
function addClass(){
  ask('Nouvelle classe',[{n:'name',l:'Nom (ex : 3e A)'},{n:'year',l:'Année scolaire (ex : 2026-2027)'},{n:'fee',l:'Frais officiels',t:'number'},{n:'cur',l:'Devise des frais',o:CUR.map(c=>[c,c]),v:S.cur}],async v=>{
    const{error}=await db.from('classes').insert({school_id:S.school.id,name:v.name.trim(),year:v.year.trim(),fee:+v.fee,fee_currency:v.cur});
    if(error)throw error;await load();render()});
}
function addStudent(){
  ask('Nouvel élève',[{n:'name',l:'Nom complet'},{n:'phone',l:'WhatsApp du parent (facultatif)',t:'tel',r:false},{n:'cls',l:'Classe',o:S.classes.map(c=>[c.id,esc(c.name)]),v:S.cls}],async v=>{
    const{error}=await db.from('students').insert({school_id:S.school.id,class_id:v.cls,name:v.name.trim(),parent_phone:v.phone.trim()||null});
    if(error)throw error;S.cls=v.cls;await load();render()});
}
function menu(id){
  const s=S.stu.find(x=>x.id===id);
  const d=show(`<h3>${esc(s.name)}</h3><p>${s.balance_cdf>0?'Reste dû : '+fmt(s.balance_cdf):'Soldé'}</p><div class=col><button id=m1>Encaisser un paiement</button><button class=ghost id=m2>Historique et reçus</button>${dir()?'<button class=ghost id=m4>Modifier l’élève</button><button class=ghost id=m5>Supprimer l’élève</button>':''}<button class=ghost id=m3>Fermer</button></div>`);
  d.querySelector('#m1').onclick=()=>pay(id);d.querySelector('#m2').onclick=()=>hist(id);d.querySelector('#m3').onclick=()=>d.close();
  if(dir()){d.querySelector('#m4').onclick=()=>editStudent(id);d.querySelector('#m5').onclick=()=>{d.close();delStudent(id)}}
}
function editStudent(id){
  const s=S.stu.find(x=>x.id===id);
  ask('Modifier l’élève',[{n:'name',l:'Nom complet',v:s.name},{n:'phone',l:'WhatsApp du parent',t:'tel',r:false,v:s.parent_phone},{n:'cls',l:'Classe',o:S.classes.map(c=>[c.id,esc(c.name)]),v:s.class_id}],async v=>{
    const{data,error}=await db.from('students').update({name:v.name.trim(),parent_phone:v.phone.trim()||null,class_id:v.cls}).eq('id',id).select();
    if(error)throw error;if(!data.length)throw Error('Modification refusée');
    S.cls=v.cls;await load();render();toast('Élève modifié')});
}
async function delStudent(id){
  const s=S.stu.find(x=>x.id===id);
  if(!confirm('Supprimer '+s.name+' ?'))return;
  const{data,error}=await db.from('students').delete().eq('id',id).select();
  if(error)return toast(error.code==='23503'?'Impossible : cet élève a des paiements.':error.message);
  if(!data.length)return toast('Suppression refusée');
  await load();render();toast('Élève supprimé');
}
const parseList=t=>{const seen=new Set();return t.split('\n').map(l=>l.replace(/^\s*\d+\s*[.)\-–]\s*/,'').trim()).filter(Boolean).map(l=>{const[n,p]=l.split(/[;\t]/);return{name:n.trim().replace(/\s+/g,' '),phone:(p||'').trim()||null}}).filter(r=>r.name&&!seen.has(r.name.toLowerCase())&&seen.add(r.name.toLowerCase()))};
function bulkAdd(){
  const d=show(`<form method=dialog><h3>Ajouter une liste d’élèves</h3><label>Classe<select name=cls>${S.classes.map(c=>`<option value="${c.id}" ${c.id===S.cls?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label>Un nom par ligne (téléphone facultatif après un « ; »)<textarea name=txt rows=10 style="width:100%" required></textarea></label><div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Enregistrer</button></div></form>`);
  d.querySelector('form').onsubmit=async e=>{
    if(e.submitter.value!=='ok')return;
    const f=e.target,cls=f.cls.value;
    const have=new Set(S.stu.filter(s=>s.class_id===cls).map(s=>s.name.toLowerCase()));
    const all=parseList(f.txt.value),rows=all.filter(r=>!have.has(r.name.toLowerCase()));
    if(!rows.length)return toast('Aucun nouveau nom à ajouter');
    const{error}=await db.from('students').insert(rows.map(r=>({school_id:S.school.id,class_id:cls,name:r.name,parent_phone:r.phone})));
    if(error)return toast(error.message);
    S.cls=cls;await load();render();
    toast(rows.length+' élève(s) ajouté(s)'+(all.length>rows.length?' · '+(all.length-rows.length)+' déjà présent(s) ignoré(s)':''));
  };
}

/* ---------- Abonnement et administrateur ---------- */
const ADMIN_WA=''; // ton numéro WhatsApp avec indicatif, sans + (ex : 243812345678)
function lockView(){
  $('#nav').hidden=true;
  $('#main').innerHTML=`<div class=auth><h2>Abonnement expiré</h2><p>L’accès de ${esc(S.school.name)} est suspendu depuis le ${new Date(S.school.sub_until).toLocaleDateString('fr-FR')}. Contacte l’administrateur d’ORÉA École pour le réactiver.</p>${ADMIN_WA?`<a class=btn style="text-align:center;text-decoration:none" href="https://wa.me/${ADMIN_WA}">Contacter l’administrateur</a>`:''}<button class=ghost onclick=out()>Déconnexion</button></div>`;
}
async function adminView(){
  $('#nav').hidden=true;
  const{data,error}=await db.rpc('admin_list_schools');
  if(error)return toast(error.message);
  const now=Date.now(),act=data.filter(s=>new Date(s.sub_until)>now).length;
  $('#main').innerHTML=`<h3>Espace administrateur</h3><div class=card><span>Écoles actives / total</span><b>${act} / ${data.length}</b></div>`+(data.length?data.map(s=>{
    const d=new Date(s.sub_until),left=Math.ceil((d-now)/864e5),ok=left>0;
    return `<div class="card col"><b>${esc(s.name)}</b><span>${esc(s.director_name||'—')} · ${esc(s.director_email||'')}</span><small>${s.students} élèves · ${s.members} compte(s) · code ${esc(s.code)}</small><span class="${ok&&left>7?'ok':'due'}">${ok?'Actif jusqu’au '+d.toLocaleDateString('fr-FR')+' ('+left+' j)':'⛔ Expiré le '+d.toLocaleDateString('fr-FR')}</span><div class=row>${[1,2,3,6].map(n=>`<button class=ghost onclick="ext('${s.id}',${n})">+${n} mois</button>`).join('')}</div></div>`}).join(''):'<p class=empty>Aucune école pour le moment.</p>')+'<button class=ghost onclick=out()>Déconnexion</button>';
}
async function ext(id,n){
  if(!confirm('Prolonger de '+n+' mois ?'))return;
  const{error}=await db.rpc('admin_extend',{sid:id,n});
  error?toast(error.message):(toast('Abonnement prolongé'),adminView());
}
function pay(id){
  const s=S.stu.find(x=>x.id===id);
  ask('Encaisser — '+esc(s.name),[{n:'amount',l:'Montant',t:'number'},{n:'currency',l:'Devise',o:CUR.map(c=>[c,c]),v:S.cur},{n:'method',l:'Mode de paiement',o:[['especes','Espèces'],['mobile_money','Mobile Money']]},{n:'reference',l:'Référence Mobile Money (obligatoire si Mobile Money)',r:false}],async v=>{
    const mm=v.method==='mobile_money';
    if(mm&&!v.reference.trim())throw Error('Référence Mobile Money obligatoire');
    const{data,error}=await db.from('payments').insert({student_id:id,amount:+v.amount,currency:v.currency,method:v.method,reference:mm?v.reference.trim():null}).select().single();
    if(error)throw error.code==='23505'?Error('Cette référence existe déjà'):error;
    await load();render();receipt(data,id);
  });
}
async function hist(id){
  const{data,error}=await db.from('payments').select('*').eq('student_id',id).order('created_at',{ascending:false});
  if(error)return toast(error.message);
  const d=show(`<h3>Reçus</h3>${data.length?data.map((p,i)=>`<div class=card><span>${new Date(p.created_at).toLocaleDateString('fr-FR')} · ${nf(p.amount)} ${p.currency}</span><button class=ghost style=width:auto data-i=${i}>Reçu</button></div>`).join(''):'<p class=empty>Aucun paiement.</p>'}<button class=ghost id=hc>Fermer</button>`);
  d.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>receipt(data[b.dataset.i],id));
  d.querySelector('#hc').onclick=()=>d.close();
}
async function receipt(p,sid){
  const s=S.stu.find(x=>x.id===sid),c=S.classes.find(x=>x.id===s.class_id);
  const cv=document.createElement('canvas');cv.width=640;cv.height=900;const x=cv.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,640,900);
  const im=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src='logo-light.png'});
  if(im)x.drawImage(im,210,10,220,220);
  x.fillStyle='#111211';x.textAlign='center';x.font='bold 28px sans-serif';x.fillText(S.school.name,320,270);
  x.font='20px sans-serif';x.fillText('REÇU DE PAIEMENT N° '+p.id.slice(0,8).toUpperCase(),320,305);
  const L=[['Élève',s.name],['Classe',c?c.name:''],['Montant payé',nf(p.amount)+' '+p.currency],['Mode',p.method==='especes'?'Espèces':'Mobile Money']];
  if(p.reference)L.push(['Référence',p.reference]);
  L.push(['Date',new Date(p.created_at).toLocaleString('fr-FR')]);
  if(p.collector_id===S.me.id)L.push(['Perçu par',S.me.full_name]);
  L.push(['Solde actuel',s.balance_cdf>0?fmt(s.balance_cdf):'Soldé']);
  L.forEach((r,i)=>{const y=370+i*55;x.strokeStyle='#ddd';x.beginPath();x.moveTo(40,y+16);x.lineTo(600,y+16);x.stroke();
    x.textAlign='left';x.fillStyle='#6b6a60';x.font='18px sans-serif';x.fillText(r[0],40,y);
    x.textAlign='right';x.fillStyle='#111211';x.font='bold 20px sans-serif';x.fillText(r[1],600,y)});
  x.textAlign='center';x.fillStyle='#6b6a60';x.font='16px sans-serif';x.fillText('Merci — ORÉA École',320,870);
  const d=show(`<h3>Reçu</h3><img src="${cv.toDataURL('image/png')}" alt="Reçu"><div class=row><a class=btn style="text-align:center;text-decoration:none" download="recu-${p.id.slice(0,8)}.png" href="${cv.toDataURL('image/png')}">Télécharger PNG</a></div><button class=ghost id=rc>Fermer</button>`);
  d.querySelector('#rc').onclick=()=>d.close();
}

/* ---------- Caisse ---------- */
async function vCaisse(){
  const t0=new Date();t0.setHours(0,0,0,0);
  const{data:ps=[]}=await db.from('payments').select('*').gte('created_at',t0.toISOString());
  const mine=ps.filter(p=>p.collector_id===S.me.id);
  const tot=a=>[sum(a.filter(p=>p.method==='especes')),sum(a.filter(p=>p.method==='mobile_money'))];
  const[c,m]=tot(dir()?ps:mine);
  let h=`<h3>Aujourd’hui ${dir()?'(toute l’école)':'(ma caisse)'}</h3><div class=card><span>Espèces</span><b>${fmt(c)}</b></div><div class=card><span>Mobile Money</span><b>${fmt(m)}</b></div><div class=card><span>Paiements</span><b>${(dir()?ps:mine).length}</b></div>`;
  if(S.me.role==='percepteur')h+='<button onclick=closeDay()>Clôturer ma journée</button>';
  const{data:cl=[]}=await db.from('closures').select('*').order('created_at',{ascending:false}).limit(30);
  const{data:pr=[]}=await db.from('profiles').select('id,full_name');
  const nm=Object.fromEntries(pr.map(p=>[p.id,p.full_name]));
  h+='<h3>Clôtures</h3>'+(cl.length?cl.map(k=>{const e=k.declared_cash-k.expected_cash,bad=Math.abs(e)>0.5;
    return `<div class="card col"><b>${k.day} · ${esc(nm[k.collector_id]||'')}</b><span>Attendu ${fmt(k.expected_cash)} · Compté ${fmt(k.declared_cash)}</span><span class="${bad?'due':'ok'}">${bad?'⚠ Écart : '+fmt(e):'✓ Aucun écart'}</span><small>${k.status==='controlee'?'Contrôlée':'À contrôler'}${k.note?' · '+esc(k.note):''}</small>${dir()&&k.status==='enregistree'?`<button class=ghost onclick="ctl('${k.id}')">Marquer comme contrôlée</button>`:''}</div>`}).join(''):'<p class=empty>Aucune clôture.</p>');
  $('#main').innerHTML=h;
}
function closeDay(){
  ask('Clôture de caisse',[{n:'cash',l:'Espèces comptées (en '+S.cur+')',t:'number'},{n:'note',l:'Remarque (facultatif)',r:false}],async v=>{
    const t0=new Date();t0.setHours(0,0,0,0);
    const{data:ps}=await db.from('payments').select('*').gte('created_at',t0.toISOString());
    const mine=ps.filter(p=>p.collector_id===S.me.id);
    const{error}=await db.from('closures').insert({day:new Date().toLocaleDateString('sv-SE'),expected_cash:sum(mine.filter(p=>p.method==='especes')),declared_cash:+v.cash*S.school.rates[S.cur],mobile_total:sum(mine.filter(p=>p.method==='mobile_money')),note:v.note.trim()||null});
    if(error)throw error.code==='23505'?Error('Journée déjà clôturée'):error;
    toast('Clôture enregistrée. Le directeur la contrôlera.');render();
  });
}
async function ctl(id){
  const{error}=await db.from('closures').update({status:'controlee',reviewed_by:S.me.id,reviewed_at:new Date().toISOString()}).eq('id',id);
  error?toast(error.message):render();
}

/* ---------- Réglages ---------- */
function vReglages(){
  const sc=S.school;
  let h=`<div class=card><span>Devise d’affichage</span><select id=cu style=width:auto;margin:0>${CUR.map(c=>`<option ${c===S.cur?'selected':''}>${c}</option>`).join('')}</select></div><div class=card><span>Thème</span><button class=ghost style=width:auto id=th>Clair / Sombre</button></div>`;
  if(dir())h+=`<div class="card col"><b>Taux de change (1 unité en FC)</b><label>USD<input id=r1 type=number step=any value="${sc.rates.USD}"></label><label>EUR<input id=r2 type=number step=any value="${sc.rates.EUR}"></label><label><input id=au type=checkbox style=width:auto ${sc.auto_rates?'checked':''}> Mise à jour automatique (désactive pour garder ton taux)</label><button id=sr>Enregistrer les taux</button><small>Code d’invitation des percepteurs : <b>${sc.code}</b></small></div>`;
  h+=`<details><summary>Guide rapide</summary><p><b>Encaisser</b> : Élèves → touche l’élève → Encaisser.<br><b>Reçu</b> : Élève → Historique et reçus → Télécharger PNG.<br><b>Clôture</b> : Caisse → Clôturer ma journée (le directeur contrôle les écarts).<br><b>Correction</b> : demande au directeur ; un paiement ne se supprime jamais.</p></details><button class=ghost id=lo>Déconnexion</button>`;
  $('#main').innerHTML=h;
  $('#lo').onclick=out;
  $('#cu').onchange=e=>{S.cur=e.target.value;localStorage.cur=S.cur;toast('Devise : '+S.cur)};
  $('#th').onclick=()=>{const t=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=localStorage.theme=t};
  if(dir())$('#sr').onclick=async()=>{
    const rates={CDF:1,USD:+$('#r1').value,EUR:+$('#r2').value};
    const{data,error}=await db.from('schools').update({rates,auto_rates:$('#au').checked,rates_at:new Date().toISOString()}).eq('id',sc.id).select().single();
    if(error)return toast(error.message);S.school=data;await load();toast('Taux enregistrés');
  };
}

if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
boot();
