const STORAGE='cofre.claudio.v1';
const VAULT_META='cofre.claudio.vault.meta';
const VAULT_DATA='cofre.claudio.vault.data';
const encoder=new TextEncoder(),decoder=new TextDecoder();

const defaults={
  projects:[
    {id:'gelo-tutoia',name:'Gelo Tutóia',description:'Vendas, automações e ideias do gelo'},
    {id:'radar-seguro',name:'Radar Seguro',description:'Mapa, navegação, comunidades e postos'},
    {id:'meu-ingles',name:'Meu Inglês',description:'Curso, aulas, voz e IA'},
    {id:'claudio-turbo',name:'Cláudio Turbo Agent',description:'Motor central de IA e integrações'},
    {id:'geral',name:'Ideias Gerais',description:'Assuntos que não pertencem a um app específico'}
  ],
  notes:[]
};
let data=load();
let editingNoteId=null;
let vaultKey=null;
let decryptedPasswords=[];

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function load(){
  try{
    const raw=localStorage.getItem(STORAGE);
    if(!raw)return structuredClone(defaults);
    const parsed=JSON.parse(raw);
    return {projects:Array.isArray(parsed.projects)?parsed.projects:structuredClone(defaults.projects),notes:Array.isArray(parsed.notes)?parsed.notes:[]};
  }catch{return structuredClone(defaults)}
}
function persist(){localStorage.setItem(STORAGE,JSON.stringify(data))}
function uid(prefix='id'){return prefix+'-'+crypto.randomUUID()}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function projectName(id){return data.projects.find(p=>p.id===id)?.name||'Sem projeto'}
function typeLabel(type){return ({ideia:'💡 Ideia',decisao:'✅ Decisão',importante:'📌 Importante',tarefa:'🛠️ Tarefa',geral:'📝 Geral'})[type]||type}
function dateText(v){return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}

function renderProjectOptions(){
  const options=data.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  $('#projectFilter').innerHTML='<option value="">Todos os projetos</option>'+options;
  $('#noteProject').innerHTML=options;
  $('#passwordProject').innerHTML=options;
}
function activeSearch(){return $('#search').value.trim().toLowerCase()}
function activeProject(){return $('#projectFilter').value}
function renderNotes(){
  const q=activeSearch(),pf=activeProject();
  let notes=[...data.notes].sort((a,b)=>(b.favorite-a.favorite)||new Date(b.updatedAt)-new Date(a.updatedAt));
  notes=notes.filter(n=>(!pf||n.projectId===pf)&&(!q||[n.title,n.text,projectName(n.projectId),typeLabel(n.type)].join(' ').toLowerCase().includes(q)));
  const box=$('#notesList');box.innerHTML='';
  if(!notes.length){box.append($('#emptyTpl').content.cloneNode(true));return}
  for(const n of notes){
    const el=document.createElement('article');el.className='card';
    el.innerHTML=`<div class="cardTop"><div><h3>${esc(n.title)}</h3><div class="meta"><span class="pill">${esc(projectName(n.projectId))}</span><span class="pill">${esc(typeLabel(n.type))}</span><span class="pill">${dateText(n.updatedAt)}</span></div></div><button class="star" data-fav="${n.id}">${n.favorite?'★':'☆'}</button></div><p>${esc(n.text)}</p><div class="cardActions"><button class="mini" data-edit="${n.id}">Editar</button><button class="mini" data-delete="${n.id}">Excluir</button></div>`;
    box.append(el);
  }
  box.querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>{const n=data.notes.find(x=>x.id===b.dataset.fav);if(n){n.favorite=!n.favorite;n.updatedAt=new Date().toISOString();persist();renderNotes()}});
  box.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openNote(b.dataset.edit));
  box.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Excluir esta nota?')){data.notes=data.notes.filter(n=>n.id!==b.dataset.delete);persist();renderNotes()}});
}
function renderProjects(){
  const box=$('#projectList');box.innerHTML='';
  for(const p of data.projects){
    const count=data.notes.filter(n=>n.projectId===p.id).length;
    const el=document.createElement('article');el.className='card projectCard';
    el.innerHTML=`<h3>${esc(p.name)}</h3><p>${esc(p.description||'')}</p><div class="meta"><span class="pill">${count} nota${count===1?'':'s'}</span></div><div class="cardActions">${['gelo-tutoia','radar-seguro','meu-ingles','claudio-turbo','geral'].includes(p.id)?'':'<button class="mini" data-project-delete="'+p.id+'">Excluir</button>'}</div>`;
    box.append(el);
  }
  box.querySelectorAll('[data-project-delete]').forEach(b=>b.onclick=()=>{const id=b.dataset.projectDelete;if(data.notes.some(n=>n.projectId===id))return alert('Esse projeto ainda tem notas. Mova ou exclua as notas primeiro.');if(confirm('Excluir este projeto?')){data.projects=data.projects.filter(p=>p.id!==id);persist();renderAll()}});
}
function renderAll(){renderProjectOptions();renderNotes();renderProjects();if(vaultKey)renderPasswords()}

function openNote(id=null){
  editingNoteId=id;
  const n=id?data.notes.find(x=>x.id===id):null;
  $('#noteDialogTitle').textContent=n?'Editar nota':'Nova nota';
  $('#noteTitle').value=n?.title||'';
  $('#noteProject').value=n?.projectId||activeProject()||data.projects[0]?.id||'geral';
  $('#noteType').value=n?.type||'ideia';
  $('#noteText').value=n?.text||'';
  $('#noteFavorite').checked=Boolean(n?.favorite);
  $('#noteDialog').showModal();
}
$('#noteForm').addEventListener('submit',e=>{
  if(e.submitter?.value==='cancel')return;
  e.preventDefault();
  const now=new Date().toISOString();
  if(editingNoteId){
    const n=data.notes.find(x=>x.id===editingNoteId);
    Object.assign(n,{title:$('#noteTitle').value.trim(),projectId:$('#noteProject').value,type:$('#noteType').value,text:$('#noteText').value.trim(),favorite:$('#noteFavorite').checked,updatedAt:now});
  }else data.notes.push({id:uid('note'),title:$('#noteTitle').value.trim(),projectId:$('#noteProject').value,type:$('#noteType').value,text:$('#noteText').value.trim(),favorite:$('#noteFavorite').checked,createdAt:now,updatedAt:now});
  persist();$('#noteDialog').close();renderNotes();renderProjects();
});
$('#projectForm').addEventListener('submit',e=>{
  if(e.submitter?.value==='cancel')return;
  e.preventDefault();
  const name=$('#projectName').value.trim();
  if(!name)return;
  data.projects.push({id:uid('project'),name,description:$('#projectDescription').value.trim()});
  persist();$('#projectDialog').close();$('#projectForm').reset();renderAll();
});

async function deriveKey(password,saltBytes){
  const base=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:saltBytes,iterations:250000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function b64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes)))}
function unb64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function encryptJson(obj,key){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(obj)));
  return {iv:b64(iv),data:b64(cipher)};
}
async function decryptJson(pack,key){
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(pack.iv)},key,unb64(pack.data));
  return JSON.parse(decoder.decode(plain));
}
async function unlockVault(){
  const password=$('#masterPassword').value;
  if(!password)return;
  $('#vaultMessage').textContent='';
  try{
    let meta=JSON.parse(localStorage.getItem(VAULT_META)||'null');
    if(!meta){
      const salt=crypto.getRandomValues(new Uint8Array(16));
      const key=await deriveKey(password,salt);
      const check=await encryptJson({ok:'cofre-do-claudio'},key);
      meta={salt:b64(salt),check};
      localStorage.setItem(VAULT_META,JSON.stringify(meta));
      localStorage.setItem(VAULT_DATA,JSON.stringify(await encryptJson([],key)));
      vaultKey=key;decryptedPasswords=[];
    }else{
      const key=await deriveKey(password,unb64(meta.salt));
      const check=await decryptJson(meta.check,key);
      if(check.ok!=='cofre-do-claudio')throw new Error('Senha incorreta');
      vaultKey=key;
      const pack=JSON.parse(localStorage.getItem(VAULT_DATA)||'null');
      decryptedPasswords=pack?await decryptJson(pack,key):[];
    }
    $('#masterPassword').value='';
    $('#vaultLocked').hidden=true;$('#vaultOpen').hidden=false;renderPasswords();
  }catch{$('#vaultMessage').textContent='Senha-mestra incorreta.'}
}
async function persistVault(){
  if(!vaultKey)return;
  localStorage.setItem(VAULT_DATA,JSON.stringify(await encryptJson(decryptedPasswords,vaultKey)));
}
function lockVault(){vaultKey=null;decryptedPasswords=[];$('#vaultOpen').hidden=true;$('#vaultLocked').hidden=false;$('#passwordList').innerHTML=''}
function renderPasswords(){
  const box=$('#passwordList');box.innerHTML='';
  const q=activeSearch(),pf=activeProject();
  const list=decryptedPasswords.filter(p=>(!pf||p.projectId===pf)&&(!q||[p.name,p.user,p.url,projectName(p.projectId)].join(' ').toLowerCase().includes(q)));
  if(!list.length){box.append($('#emptyTpl').content.cloneNode(true));return}
  for(const p of list){
    const el=document.createElement('article');el.className='card';
    el.innerHTML=`<div class="cardTop"><div><h3>${esc(p.name)}</h3><div class="meta"><span class="pill">${esc(projectName(p.projectId))}</span></div></div></div><p>${esc(p.user||'')}</p><div class="secretValue">••••••••••••</div><div class="cardActions"><button class="mini" data-reveal="${p.id}">Mostrar</button><button class="mini" data-copy="${p.id}">Copiar senha</button><button class="mini" data-pass-delete="${p.id}">Excluir</button></div>`;
    box.append(el);
  }
  box.querySelectorAll('[data-reveal]').forEach(b=>b.onclick=()=>{const p=decryptedPasswords.find(x=>x.id===b.dataset.reveal);const box=b.closest('.card').querySelector('.secretValue');const showing=box.dataset.show==='1';box.textContent=showing?'••••••••••••':p.password;box.dataset.show=showing?'0':'1';b.textContent=showing?'Mostrar':'Ocultar'});
  box.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const p=decryptedPasswords.find(x=>x.id===b.dataset.copy);await navigator.clipboard.writeText(p.password);b.textContent='Copiada';setTimeout(()=>b.textContent='Copiar senha',1200)});
  box.querySelectorAll('[data-pass-delete]').forEach(b=>b.onclick=async()=>{if(confirm('Excluir esta senha?')){decryptedPasswords=decryptedPasswords.filter(p=>p.id!==b.dataset.passDelete);await persistVault();renderPasswords()}});
}
$('#passwordForm').addEventListener('submit',async e=>{
  if(e.submitter?.value==='cancel')return;
  e.preventDefault();
  decryptedPasswords.push({id:uid('pass'),name:$('#passwordName').value.trim(),projectId:$('#passwordProject').value,user:$('#passwordUser').value.trim(),password:$('#passwordValue').value,url:$('#passwordUrl').value.trim(),createdAt:new Date().toISOString()});
  await persistVault();$('#passwordDialog').close();$('#passwordForm').reset();renderPasswords();
});

function exportBackup(){
  const backup={format:'cofre-do-claudio',version:1,exportedAt:new Date().toISOString(),data, vaultMeta:localStorage.getItem(VAULT_META),vaultData:localStorage.getItem(VAULT_DATA)};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cofre-do-claudio-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function importBackup(file){
  const text=await file.text();const backup=JSON.parse(text);
  if(backup.format!=='cofre-do-claudio')throw new Error('Arquivo inválido');
  if(!confirm('Restaurar este backup? Os dados atuais serão substituídos.'))return;
  data=backup.data||structuredClone(defaults);persist();
  if(backup.vaultMeta)localStorage.setItem(VAULT_META,backup.vaultMeta);else localStorage.removeItem(VAULT_META);
  if(backup.vaultData)localStorage.setItem(VAULT_DATA,backup.vaultData);else localStorage.removeItem(VAULT_DATA);
  lockVault();renderAll();alert('Backup restaurado.');
}

$$('.tab').forEach(btn=>btn.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$('#'+btn.dataset.tab).classList.add('active')});
$('#quickAdd').onclick=()=>openNote();
$('#newNote').onclick=()=>openNote();
$('#newProject').onclick=()=>$('#projectDialog').showModal();
$('#newPassword').onclick=()=>$('#passwordDialog').showModal();
$('#unlockVault').onclick=unlockVault;
$('#lockVault').onclick=lockVault;
$('#exportBackup').onclick=exportBackup;
$('#importBackup').onchange=async e=>{try{if(e.target.files?.[0])await importBackup(e.target.files[0])}catch(err){alert('Não foi possível restaurar: '+err.message)}finally{e.target.value=''}};
$('#search').addEventListener('input',()=>{renderNotes();if(vaultKey)renderPasswords()});
$('#projectFilter').addEventListener('change',()=>{renderNotes();if(vaultKey)renderPasswords()});

renderAll();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));