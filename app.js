const db=supabase.createClient(OREA_CONFIG.SUPABASE_URL,OREA_CONFIG.SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s);
const CUR=['CDF','USD','EUR'],SYM={CDF:'FC',USD:'$',EUR:'€'};
const S={me:null,school:null,classes:[],stu:[],cls:null,sort:'alpha',tab:'accueil',cur:localStorage.cur||'CDF'};
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
  if(p.active===false){$('#nav').hidden=true;$('#main').innerHTML='<div class=auth><h2>Compte désactivé</h2><p>Contacte le directeur de ton école.</p><button class=ghost onclick=out()>Déconnexion</button></div>';return}
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
  const R=S.me.role,tabs=[['accueil','🏠 Accueil'],['eleves','👨‍🎓 Élèves'],['presences','📅 Présences'],...(R!=='enseignant'?[['caisse','💰 Caisse']]:[]),['reglages','⚙️ Réglages']];
  if(!tabs.some(x=>x[0]===S.tab))S.tab='accueil';
  $('#nav').innerHTML=tabs.map(x=>`<button data-t=${x[0]}>${x[1]}</button>`).join('');
  document.querySelectorAll('#nav button').forEach(b=>{b.classList.toggle('on',b.dataset.t===S.tab);b.onclick=()=>{S.tab=b.dataset.t;render()}});
  ({accueil:vAccueil,eleves:vEleves,presences:vPresences,caisse:vCaisse,reglages:vReglages})[S.tab]();
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
  ask('Nouvelle classe',[{n:'name',l:'Nom (ex : 3e A)'},{n:'year',l:'Année scolaire (ex : 2026-2027)'},{n:'t1',l:'Frais 1er trimestre',t:'number'},{n:'t2',l:'Frais 2e trimestre',t:'number'},{n:'t3',l:'Frais 3e trimestre',t:'number'},{n:'cur',l:'Devise des frais',o:CUR.map(c=>[c,c]),v:S.cur}],async v=>{
    const{error}=await db.from('classes').insert({school_id:S.school.id,name:v.name.trim(),year:v.year.trim(),fee_t1:+v.t1,fee_t2:+v.t2,fee_t3:+v.t3,fee_currency:v.cur});
    if(error)throw error;await load();render()});
}
function addStudent(){
  ask('Nouvel élève',[{n:'name',l:'Nom complet'},{n:'phone',l:'WhatsApp du parent (facultatif)',t:'tel',r:false},{n:'cls',l:'Classe',o:S.classes.map(c=>[c.id,esc(c.name)]),v:S.cls}],async v=>{
    const{error}=await db.from('students').insert({school_id:S.school.id,class_id:v.cls,name:v.name.trim(),parent_phone:v.phone.trim()||null});
    if(error)throw error;S.cls=v.cls;await load();render()});
}
function menu(id){
  const s=S.stu.find(x=>x.id===id),R=S.me.role;
  const d=show(`<h3>${esc(s.name)}</h3><p>${s.balance_cdf>0?'Reste dû : '+fmt(s.balance_cdf):'Soldé'}</p><p><small>${trims(s).map(t=>'T'+t[0]+' : '+(t[2]>0?(t[1]>0?'reste '+fmt(t[1]):'✓'):'—')).join(' · ')}</small></p><div class=col>${R!=='enseignant'?'<button id=m1>Encaisser un paiement</button><button class=ghost id=m2>Historique et reçus</button>':''}${R!=='percepteur'?'<button class=ghost id=m7>Sanctions</button>':''}${dir()?'<button class=ghost id=m6>Message WhatsApp au parent</button><button class=ghost id=m4>Modifier l’élève</button><button class=ghost id=m5>Supprimer l’élève</button>':''}<button class=ghost id=m3>Fermer</button></div>`);
  const b=(k,f)=>{const e=d.querySelector('#'+k);if(e)e.onclick=f};
  b('m1',()=>pay(id));b('m2',()=>hist(id));b('m3',()=>d.close());b('m4',()=>editStudent(id));b('m5',()=>{d.close();delStudent(id)});b('m6',()=>wa(id));b('m7',()=>sanc(id));
}
/* ---------- Trimestres et WhatsApp ---------- */
const COUNTRY='243'; // indicatif pays utilisé quand le numéro commence par 0 (243 = RDC)
const trims=s=>[1,2,3].map(i=>{const due=Number(s['due'+i+'_cdf']||0),paid=Number(s['p'+i+'_cdf']||0);return[i,Math.max(0,due-paid),due,paid]});
function waLink(phone,msg){
  let n=String(phone||'').replace(/[^\d]/g,'');
  if(!n)return null;
  if(n.startsWith('00'))n=n.slice(2);else if(n.startsWith('0'))n=COUNTRY+n.slice(1);
  return 'https://wa.me/'+n+'?text='+encodeURIComponent(msg);
}
const logMsg=(sid,kind,body)=>db.from('messages_log').insert({school_id:S.school.id,student_id:sid,kind,body}).then(()=>{},()=>{});
const feeMsg=s=>{const hi=`Bonjour, ici ${S.school.name}. `,rest=trims(s).filter(t=>t[1]>0).map(t=>'T'+t[0]+' : '+fmt(t[1])).join(', ');return s.balance_cdf>0?`${hi}Concernant ${s.name} : il reste ${fmt(s.balance_cdf)} à payer (${rest}). Merci de régulariser dès que possible.`:`${hi}Les frais de ${s.name} sont entièrement soldés. Merci !`};
async function wa(id){
  const s=S.stu.find(x=>x.id===id);
  if(!s.parent_phone){toast('Ajoute d’abord le numéro du parent (Modifier l’élève).');return}
  const[{data:ab},{data:sa}]=await Promise.all([db.from('attendance').select('day').eq('student_id',id).eq('status','absent').order('day',{ascending:false}).limit(5),db.from('sanctions').select('*').eq('student_id',id).order('created_at',{ascending:false}).limit(1)]);
  const A=ab||[],X=sa||[],fd=x=>new Date(x+'T00:00').toLocaleDateString('fr-FR'),hi=`Bonjour, ici ${S.school.name}. `;
  const M={
    frais:feeMsg(s),
    absence:A.length?`${hi}${s.name} a été absent(e) le ${A.map(a=>fd(a.day)).join(', ')}. Merci de nous en indiquer la raison.`:`${hi}${s.name} n’a pas d’absence récente.`,
    sanction:X.length?`${hi}${s.name} a reçu la sanction suivante le ${fd(X[0].day)} : ${X[0].kind}${X[0].note?' ('+X[0].note+')':''}. Merci de passer à l’école.`:`${hi}Aucune sanction enregistrée pour ${s.name}.`,
    libre:hi
  };
  const d=show(`<h3>Message à ${esc(s.name)}</h3><label>Sujet<select id=wk><option value=frais>Frais restants</option><option value=absence>Absences</option><option value=sanction>Sanction</option><option value=libre>Message libre</option></select></label><label>Message<textarea id=wm rows=6 style="width:100%">${esc(M.frais)}</textarea></label><div class=col><button id=ws>Ouvrir WhatsApp</button><button class=ghost id=wc>Annuler</button></div>`);
  d.querySelector('#wk').onchange=e=>{d.querySelector('#wm').value=M[e.target.value]};
  d.querySelector('#wc').onclick=()=>d.close();
  d.querySelector('#ws').onclick=()=>{const m=d.querySelector('#wm').value,u=waLink(s.parent_phone,m);if(!u)return toast('Numéro invalide');window.open(u,'_blank');logMsg(id,d.querySelector('#wk').value,m);d.close()};
}
function editFees(id){
  const c=S.classes.find(x=>x.id===id);
  ask('Frais — '+esc(c.name),[{n:'t1',l:'1er trimestre',t:'number',v:c.fee_t1},{n:'t2',l:'2e trimestre',t:'number',v:c.fee_t2},{n:'t3',l:'3e trimestre',t:'number',v:c.fee_t3},{n:'cur',l:'Devise',o:CUR.map(x=>[x,x]),v:c.fee_currency}],async v=>{
    const{data,error}=await db.from('classes').update({fee_t1:+v.t1,fee_t2:+v.t2,fee_t3:+v.t3,fee_currency:v.cur}).eq('id',id).select();
    if(error)throw error;if(!data.length)throw Error('Modification refusée');
    await load();render();toast('Frais enregistrés')});
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
  const dt=(trims(s).find(x=>x[1]>0)||[1])[0];
  ask('Encaisser — '+esc(s.name),[{n:'term',l:'Trimestre payé',o:[['1','1er trimestre'],['2','2e trimestre'],['3','3e trimestre']],v:String(dt)},{n:'amount',l:'Montant',t:'number'},{n:'currency',l:'Devise',o:CUR.map(c=>[c,c]),v:S.cur},{n:'method',l:'Mode de paiement',o:[['especes','Espèces'],['mobile_money','Mobile Money']]},{n:'reference',l:'Référence Mobile Money (obligatoire si Mobile Money)',r:false}],async v=>{
    const mm=v.method==='mobile_money';
    if(mm&&!v.reference.trim())throw Error('Référence Mobile Money obligatoire');
    const{data,error}=await db.from('payments').insert({student_id:id,term:+v.term,amount:+v.amount,currency:v.currency,method:v.method,reference:mm?v.reference.trim():null}).select().single();
    if(error)throw error.code==='23505'?Error('Cette référence existe déjà'):error;
    await load();render();receipt(data,id);
  });
}
async function hist(id){
  const{data,error}=await db.from('payments').select('*').eq('student_id',id).order('created_at',{ascending:false});
  if(error)return toast(error.message);
  const ids=data.map(p=>p.id);
  const{data:pend=[]}=ids.length?await db.from('change_requests').select('payment_id').eq('status','en_attente').in('payment_id',ids):{data:[]};
  const pe=new Set(pend.map(r=>r.payment_id));
  const d=show(`<h3>Reçus</h3>${data.length?data.map((p,i)=>`<div class="card col"><span>${new Date(p.created_at).toLocaleDateString('fr-FR')} · T${p.term} · ${nf(p.amount)} ${p.currency}</span><div class=row><button class=ghost data-i=${i}>Reçu</button>${pe.has(p.id)?'<small>⏳ demande en attente</small>':`<button class=ghost data-c=${i}>${dir()?'Corriger':'Demander une correction'}</button>`}</div></div>`).join(''):'<p class=empty>Aucun paiement.</p>'}<button class=ghost id=hc>Fermer</button>`);
  d.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>receipt(data[b.dataset.i],id));
  d.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>fixPay(data[b.dataset.c],id));
  d.querySelector('#hc').onclick=()=>d.close();
}
function fixPay(p,sid){
  const T=[['1','1er trimestre'],['2','2e trimestre'],['3','3e trimestre']],D=dir();
  const d=show(`<h3>Paiement de ${nf(p.amount)} ${p.currency} (T${p.term})</h3><div class=col><button id=f1>${D?'Modifier le montant ou le trimestre':'Demander une modification'}</button><button class=ghost id=f2>${D?'Supprimer ce paiement':'Demander la suppression'}</button><button class=ghost id=f3>Retour</button></div>`);
  d.querySelector('#f3').onclick=()=>hist(sid);
  d.querySelector('#f1').onclick=()=>ask(D?'Modifier le paiement':'Demande de modification',[{n:'amount',l:'Montant ('+p.currency+')',t:'number',v:p.amount},{n:'term',l:'Trimestre',o:T,v:String(p.term)},...(D?[]:[{n:'reason',l:'Motif',r:false}])],async v=>{
    if(D){const{data,error}=await db.from('payments').update({amount:+v.amount,term:+v.term}).eq('id',p.id).select();if(error)throw error;if(!data.length)throw Error('Modification refusée');await load();render();toast('Paiement modifié')}
    else{const{error}=await db.from('change_requests').insert({payment_id:p.id,kind:'edit_payment',new_amount:+v.amount,new_term:+v.term,reason:(v.reason||'').trim()||null});if(error)throw error.code==='23505'?Error('Une demande est déjà en attente'):error;toast('Demande envoyée au directeur')}
  });
  d.querySelector('#f2').onclick=()=>{
    if(D){d.close();if(!confirm('Supprimer ce paiement ?'))return;db.from('payments').delete().eq('id',p.id).select().then(async({data,error})=>{if(error||!data.length)return toast(error?error.message:'Suppression refusée');await load();render();toast('Paiement supprimé')})}
    else ask('Demande de suppression',[{n:'reason',l:'Motif',r:false}],async v=>{const{error}=await db.from('change_requests').insert({payment_id:p.id,kind:'delete_payment',reason:(v.reason||'').trim()||null});if(error)throw error.code==='23505'?Error('Une demande est déjà en attente'):error;toast('Demande envoyée au directeur')});
  };
}
async function decide(id,ok){
  if(!confirm(ok?'Approuver cette demande ?':'Refuser cette demande ?'))return;
  const{error}=await db.rpc('decide_request',{rid:id,approve:ok});
  if(error)return toast(error.message);
  await load();render();toast(ok?'Demande approuvée':'Demande refusée');
}
async function journal(){
  const[{data:a=[]},{data:pr=[]}]=await Promise.all([db.from('audit_log').select('*').order('created_at',{ascending:false}).limit(60),db.from('profiles').select('id,full_name')]);
  const nm=Object.fromEntries(pr.map(p=>[p.id,p.full_name])),T={payments:'Paiement',students:'Élève',classes:'Classe'};
  const line=r=>{const o=r.old_row||{},n=r.new_row||{};
    if(r.tbl==='payments')return r.op==='DELETE'?`supprimé (${nf(o.amount)} ${o.currency}, T${o.term})`:`modifié : ${nf(o.amount)} → ${nf(n.amount)} ${n.currency}, T${o.term} → T${n.term}`;
    return r.op==='DELETE'?`supprimé : ${o.name}`:`modifié : ${n.name}`};
  const d=show(`<h3>Journal d’activité</h3>${a.length?a.map(r=>`<div class="card col"><b>${T[r.tbl]||r.tbl} ${esc(line(r))}</b><small>${new Date(r.created_at).toLocaleString('fr-FR')} · ${esc(nm[r.user_id]||'?')}</small></div>`).join(''):'<p class=empty>Aucune activité.</p>'}<button class=ghost id=jc>Fermer</button>`);
  d.querySelector('#jc').onclick=()=>d.close();
}
async function receipt(p,sid){
  const s=S.stu.find(x=>x.id===sid),c=S.classes.find(x=>x.id===s.class_id);
  const cv=document.createElement('canvas');cv.width=640;cv.height=900;const x=cv.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,640,900);
  const im=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src='logo-light.png'});
  if(im)x.drawImage(im,210,10,220,220);
  x.fillStyle='#111211';x.textAlign='center';x.font='bold 28px sans-serif';x.fillText(S.school.name,320,270);
  x.font='20px sans-serif';x.fillText('REÇU DE PAIEMENT N° '+p.id.slice(0,8).toUpperCase(),320,305);
  const L=[['Élève',s.name],['Classe',c?c.name:''],['Montant payé',nf(p.amount)+' '+p.currency+' (T'+(p.term||1)+')'],['Mode',p.method==='especes'?'Espèces':'Mobile Money']];
  if(p.reference)L.push(['Référence',p.reference]);
  L.push(['Date',new Date(p.created_at).toLocaleString('fr-FR')]);
  if(p.collector_id===S.me.id)L.push(['Perçu par',S.me.full_name]);
  const tt=trims(s)[(p.term||1)-1];L.push(['Reste T'+(p.term||1),tt&&tt[1]>0?fmt(tt[1]):'Soldé']);
  L.push(['Solde actuel',s.balance_cdf>0?fmt(s.balance_cdf):'Soldé']);
  L.forEach((r,i)=>{const y=370+i*55;x.strokeStyle='#ddd';x.beginPath();x.moveTo(40,y+16);x.lineTo(600,y+16);x.stroke();
    x.textAlign='left';x.fillStyle='#6b6a60';x.font='18px sans-serif';x.fillText(r[0],40,y);
    x.textAlign='right';x.fillStyle='#111211';x.font='bold 20px sans-serif';x.fillText(r[1],600,y)});
  x.textAlign='center';x.fillStyle='#6b6a60';x.font='16px sans-serif';x.fillText('Merci — ORÉA École',320,870);
  const d=show(`<h3>Reçu</h3><img src="${cv.toDataURL('image/png')}" alt="Reçu"><div class=row><a class=btn style="text-align:center;text-decoration:none" download="recu-${p.id.slice(0,8)}.png" href="${cv.toDataURL('image/png')}">Télécharger PNG</a></div><button class=ghost id=rc>Fermer</button>`);
  d.querySelector('#rc').onclick=()=>d.close();
}

/* ---------- Accueil ---------- */
const tdy=()=>new Date().toLocaleDateString('sv-SE');
async function vAccueil(){
  const t0=new Date();t0.setHours(0,0,0,0);const R=S.me.role;
  const[pp,aa,rq,ml]=await Promise.all([
    R==='enseignant'?{data:[]}:db.from('payments').select('amount_cdf,collector_id').gte('created_at',t0.toISOString()),
    db.from('attendance').select('status').eq('day',tdy()),
    R==='directeur'?db.from('change_requests').select('id').eq('status','en_attente'):{data:[]},
    R==='directeur'?db.from('messages_log').select('*').order('created_at',{ascending:false}).limit(5):{data:[]}]);
  const st=S.stu,sm=k=>st.reduce((a,s)=>a+Number(s[k]||0),0),A=aa.data||[],cnt=k=>A.filter(a=>a.status===k).length;
  const tod=sum((pp.data||[]).filter(p=>R==='directeur'||p.collector_id===S.me.id)),pend=(rq.data||[]).length;
  const exp=sm('due1_cdf')+sm('due2_cdf')+sm('due3_cdf'),due=sm('balance_cdf');
  let h=`<h3>Bonjour ${esc(S.me.full_name)}</h3>`;
  const left=S.school.sub_until?Math.ceil((new Date(S.school.sub_until)-Date.now())/864e5):99;
  if(R==='directeur'&&left<=14)h+=`<div class="card col"><b class=due>⚠ Abonnement : ${left} jour(s) restant(s)</b><small>Contacte l’administrateur pour prolonger.</small></div>`;
  if(pend)h+=`<div class="card" onclick="S.tab='caisse';render()"><span>Demandes à approuver</span><b class=due>${pend}</b></div>`;
  if(R!=='enseignant'){
    h+=`<div class=card><span>Encaissé aujourd’hui ${R==='directeur'?'(école)':'(ma caisse)'}</span><b>${fmt(tod)}</b></div><div class=card><span>Total encaissé</span><b>${fmt(sm('paid_cdf'))}</b></div><div class=card><span>Reste à encaisser</span><b class=due>${fmt(due)}</b></div><div class=card><span>Taux de recouvrement</span><b>${exp>0?Math.round(100*(1-due/exp)):0} %</b></div>`;
    h+='<h3>Par trimestre</h3>'+[1,2,3].map(i=>`<div class=card><span>T${i}</span><b>${fmt(sm('p'+i+'_cdf'))} / ${fmt(sm('due'+i+'_cdf'))}</b></div>`).join('');
  }
  h+=`<h3>Présences du jour</h3><div class=card><span>Présents · Absents · Retards</span><b>${cnt('present')} · ${cnt('absent')} · ${cnt('retard')}</b></div><div class=card><span>Élèves inscrits</span><b>${st.length}</b></div><div class=row><button onclick="S.tab='presences';render()">Faire l’appel</button>${R==='directeur'?'<button class=ghost onclick=reminders()>Rappels d’impayés</button>':''}</div>`;
  const ms=ml.data||[],K={frais:'Frais',absence:'Absence',sanction:'Sanction',libre:'Message'};
  if(R==='directeur')h+='<h3>Derniers messages</h3>'+(ms.length?ms.map(m=>{const s=st.find(x=>x.id===m.student_id);return `<div class="card col"><b>${esc(s?s.name:'')} · ${K[m.kind]||m.kind}</b><small>${new Date(m.created_at).toLocaleString('fr-FR')}</small></div>`}).join(''):'<p class=empty>Aucun message envoyé.</p>');
  $('#main').innerHTML=h;
}
function reminders(){
  const l=S.stu.filter(s=>s.balance_cdf>0&&s.parent_phone).sort((a,b)=>b.balance_cdf-a.balance_cdf),no=S.stu.filter(s=>s.balance_cdf>0&&!s.parent_phone).length;
  const d=show(`<h3>Rappels d’impayés</h3>${l.length?l.map(s=>`<div class=card><span>${esc(s.name)}<br><small>${fmt(s.balance_cdf)}</small></span><button class=ghost style=width:auto data-w=${s.id}>WhatsApp</button></div>`).join(''):'<p class=empty>Aucun impayé avec numéro.</p>'}${no?`<small>${no} élève(s) sans numéro ignoré(s).</small>`:''}<button class=ghost id=rc2>Fermer</button>`);
  d.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{const s=S.stu.find(x=>x.id===b.dataset.w),m=feeMsg(s),u=waLink(s.parent_phone,m);if(u){window.open(u,'_blank');logMsg(s.id,'frais',m);b.textContent='✓ Envoyé';b.disabled=true}});
  d.querySelector('#rc2').onclick=()=>d.close();
}

/* ---------- Présences ---------- */
async function vPresences(){
  if(!S.classes.length){$('#main').innerHTML='<p class=empty>Crée d’abord une classe dans Élèves.</p>';return}
  if(!S.classes.some(c=>c.id===S.cls))S.cls=S.classes[0].id;
  S.day=S.day||tdy();
  const{data}=await db.from('attendance').select('student_id,status').eq('day',S.day);
  S.att=Object.fromEntries((data||[]).map(a=>[a.student_id,a.status]));
  drawAtt();
}
function drawAtt(){
  const l=S.stu.filter(s=>s.class_id===S.cls).sort(sorts.alpha),A=S.att||{};
  const n=k=>l.filter(s=>A[s.id]===k).length,un=l.filter(s=>!A[s.id]).length,B=[['present','Présent'],['absent','Absent'],['retard','Retard']];
  let h=`<div class=bar><select id=cs>${S.classes.map(c=>`<option value="${c.id}" ${c.id===S.cls?'selected':''}>${esc(c.name)}</option>`).join('')}</select><input id=dy type=date value="${S.day}" max="${tdy()}"></div><div class=card><small>Présents ${n('present')} · Absents ${n('absent')} · Retards ${n('retard')} · Non marqués ${un}</small></div>`;
  h+=l.length?(un?'<button class=ghost onclick=allPresent()>Tout le monde présent</button>':'')+l.map(s=>`<div class="card col"><b>${esc(s.name)}</b><div class=row>${B.map(b=>`<button class="${A[s.id]===b[0]?'':'ghost'}" onclick="mark('${s.id}','${b[0]}')">${A[s.id]===b[0]?'✓ ':''}${b[1]}</button>`).join('')}</div></div>`).join(''):'<p class=empty>Aucun élève dans cette classe.</p>';
  h+='<button class=ghost onclick=icsRappel()>Ajouter un rappel d’appel à l’agenda</button>';
  $('#main').innerHTML=h;
  $('#cs').onchange=e=>{S.cls=e.target.value;drawAtt()};
  $('#dy').onchange=e=>{S.day=e.target.value||tdy();vPresences()};
}
async function mark(id,st){
  const A=S.att=S.att||{},old=A[id];A[id]=st;drawAtt();
  const{error}=await db.from('attendance').upsert({school_id:S.school.id,student_id:id,day:S.day,status:st},{onConflict:'student_id,day'});
  if(error){A[id]=old;drawAtt();toast(error.message)}
}
async function allPresent(){
  const A=S.att=S.att||{},rows=S.stu.filter(s=>s.class_id===S.cls&&!A[s.id]).map(s=>({school_id:S.school.id,student_id:s.id,day:S.day,status:'present'}));
  if(!rows.length)return;
  const{error}=await db.from('attendance').upsert(rows,{onConflict:'student_id,day'});
  if(error)return toast(error.message);
  rows.forEach(r=>A[r.student_id]='present');drawAtt();
}
function icsRappel(){
  const d=new Date(Date.now()+864e5),p=n=>String(n).padStart(2,'0'),ds=''+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate());
  const stamp=new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//OREA Ecole//FR','BEGIN:VEVENT','UID:appel-'+S.school.id+'@orea','DTSTAMP:'+stamp,'DTSTART:'+ds+'T073000','DTEND:'+ds+'T080000','RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR','SUMMARY:Faire l\'appel - OREA Ecole','BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Faire l\'appel','TRIGGER:PT0M','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));a.download='rappel-appel.ics';a.click();
}

/* ---------- Sanctions et équipe ---------- */
async function sanc(id){
  const s=S.stu.find(x=>x.id===id);
  const{data,error}=await db.from('sanctions').select('*').eq('student_id',id).order('created_at',{ascending:false});
  if(error)return toast(error.message);
  const d=show(`<h3>Sanctions — ${esc(s.name)}</h3>${data.length?data.map(x=>`<div class="card col"><b>${esc(x.kind)}</b><small>${new Date(x.day+'T00:00').toLocaleDateString('fr-FR')}${x.note?' · '+esc(x.note):''}</small>${dir()?`<button class=ghost data-x=${x.id}>Supprimer</button>`:''}</div>`).join(''):'<p class=empty>Aucune sanction.</p>'}<div class=col><button id=sa>+ Ajouter une sanction</button><button class=ghost id=sc>Fermer</button></div>`);
  d.querySelector('#sc').onclick=()=>d.close();
  d.querySelectorAll('[data-x]').forEach(b=>b.onclick=async()=>{if(!confirm('Supprimer cette sanction ?'))return;const{error}=await db.from('sanctions').delete().eq('id',b.dataset.x);error?toast(error.message):sanc(id)});
  d.querySelector('#sa').onclick=()=>ask('Nouvelle sanction',[{n:'kind',l:'Type',o:['Avertissement','Retenue','Exclusion temporaire','Autre'].map(k=>[k,k])},{n:'day',l:'Date',t:'date',v:tdy()},{n:'note',l:'Détail (facultatif)',r:false}],async v=>{
    const{error}=await db.from('sanctions').insert({school_id:S.school.id,student_id:id,kind:v.kind,day:v.day,note:v.note.trim()||null});
    if(error)throw error;toast('Sanction enregistrée');sanc(id)});
}
async function team(){
  const{data,error}=await db.from('profiles').select('*').order('full_name');
  if(error)return toast(error.message);
  const RL={directeur:'Directeur',percepteur:'Percepteur',enseignant:'Enseignant'},l=data.filter(p=>p.id!==S.me.id);
  const d=show(`<h3>Équipe</h3>${l.length?l.map(p=>`<div class="card col"><b>${esc(p.full_name)}</b><span class="${p.active===false?'due':''}">${RL[p.role]}${p.active===false?' · désactivé':''}</span><div class=row>${p.role==='directeur'?'':`<button class=ghost data-r=${p.id}>→ ${p.role==='percepteur'?'Enseignant':'Percepteur'}</button>`}<button class=ghost data-a=${p.id}>${p.active===false?'Réactiver':'Désactiver'}</button></div></div>`).join(''):'<p class=empty>Personne d’autre pour le moment. Donne ton code d’invitation à tes percepteurs et enseignants.</p>'}<small>Code d’invitation : <b>${esc(S.school.code)}</b></small><button class=ghost id=tc>Fermer</button>`);
  const up=async(id,patch)=>{const{data:x,error}=await db.from('profiles').update(patch).eq('id',id).select();if(error||!x.length)return toast(error?error.message:'Modification refusée');team()};
  d.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const p=data.find(x=>x.id===b.dataset.r);up(p.id,{role:p.role==='percepteur'?'enseignant':'percepteur'})});
  d.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const p=data.find(x=>x.id===b.dataset.a);up(p.id,{active:p.active===false})});
  d.querySelector('#tc').onclick=()=>d.close();
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
  const{data:rq=[]}=await db.from('change_requests').select('*').order('created_at',{ascending:false}).limit(20);
  const st={en_attente:'⏳ En attente',approuvee:'✓ Approuvée',refusee:'✗ Refusée'};
  const reqHtml=rq.length?'<h3>Demandes de correction</h3>'+rq.map(r=>`<div class="card col"><b>${esc(r.info||'Paiement supprimé')}</b><span>${r.kind==='delete_payment'?'Suppression':'Correction → '+nf(r.new_amount)+' · T'+r.new_term}${nm[r.requested_by]?' · '+esc(nm[r.requested_by]):''}</span><small>${st[r.status]}${r.reason?' · '+esc(r.reason):''}</small>${dir()&&r.status==='en_attente'?`<div class=row><button onclick="decide('${r.id}',true)">Approuver</button><button class=ghost onclick="decide('${r.id}',false)">Refuser</button></div>`:''}</div>`).join(''):'';
  h+=reqHtml+'<h3>Clôtures</h3>'+(cl.length?cl.map(k=>{const e=k.declared_cash-k.expected_cash,bad=Math.abs(e)>0.5;
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
  if(dir())h+=`<div class="card col"><b>Frais par trimestre</b>${S.classes.length?S.classes.map(c=>`<button class=ghost onclick="editFees('${c.id}')">${esc(c.name)} · ${nf(c.fee)} ${c.fee_currency}</button>`).join(''):'<small>Aucune classe.</small>'}<small>Touche une classe pour modifier T1, T2 et T3.</small></div>`;
  if(dir())h+='<button class=ghost onclick=team()>Équipe</button><button class=ghost onclick=journal()>Journal d’activité</button>';
  h+=`<details><summary>Guide rapide</summary><p><b>Encaisser</b> : Élèves → touche l’élève → Encaisser.<br><b>Reçu</b> : Élève → Historique et reçus → Télécharger PNG.<br><b>Clôture</b> : Caisse → Clôturer ma journée (le directeur contrôle les écarts).<br><b>Correction</b> : Élève → Historique et reçus → Corriger. Le directeur corrige directement ; le percepteur envoie une demande que le directeur approuve dans Caisse.</p></details><button class=ghost id=lo>Déconnexion</button>`;
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
