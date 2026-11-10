/* Lugar à Mesa — Organizador de Mesas de Casamento e Batizado
   Tudo corre no browser. Os dados ficam em localStorage (só neste dispositivo). */
(function(){
'use strict';

const KEY='lugar-a-mesa-v1', LKEY='lugar-a-mesa-lang';
const THEMES=['agua','salvia','rosa','lavanda','noite'];
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

let S, sel=null, filter='all', q='', drag=null, saveWarned=false;
let gmap=new Map(), shortOf=new Map();
const hist=[];

/* ================= idioma ================= */
function detectLang(){
  try{const s=localStorage.getItem(LKEY);if(s&&LANGS[s])return s}catch(e){}
  const n=(navigator.language||'pt').toLowerCase();
  return n.startsWith('en')?'en':n.startsWith('es')?'es':'pt';
}
let LANG=detectLang();
function t(key,vars){
  let v=LANGS[LANG].d[key];
  if(v===undefined)v=LANGS.pt.d[key];
  if(v===undefined)return key;
  if(typeof v!=='string')return v;
  return v.replace(/\{(\w+)\}/g,(m,k)=>vars&&vars[k]!==undefined?vars[k]:m);
}
const tc=(key,n,vars)=>t(key+(n===1?'_one':'_other'),Object.assign({n},vars||{}));
const ageL=a=>t('age.'+a);
const tbName=tb=>tb.name||(tb.main?t('tbl.main'):t('tbl.n',{n:tb.num}));
const lines=s=>esc(s).replace(/\n/g,'<br>');

/* ================= estado ================= */
function blankState(){
  const T=(num,col,row)=>({id:'t'+num,name:'',num,col,row,guests:[]});
  return {v:1,event:'',theme:'agua',cols:3,rows:3,nextNum:5,nextGid:1,
    short:false,sort:'list',orient:'auto',min:8,max:12,mainCap:6,guests:[],
    tables:[{id:'main',name:'',main:true,col:1,row:0,guests:[]},
      T(1,0,1),T(2,1,1),T(3,2,1),T(4,0,2)]};
}
const clampInt=(v,lo,hi,d)=>{v=parseInt(v,10);return Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d};

/* nomes por defeito ficam vazios, para seguirem o idioma escolhido */
function cleanName(t,num){
  const raw=String(t.name||'').trim().slice(0,30);
  if(!raw)return '';
  if(t.main&&/^(mesa principal|main table)$/i.test(raw))return '';
  const m=/^(mesa|table)\s+(\d+)$/i.exec(raw);
  if(!t.main&&m&&+m[2]===num)return '';
  return raw;
}
function sanitize(raw){
  if(!raw||typeof raw!=='object'||!Array.isArray(raw.tables))return null;
  const d=blankState(), s=Object.assign({},d,raw);
  // convidados
  const cand=new Set(),used=new Set();
  (Array.isArray(raw.guests)?raw.guests:[]).forEach(g=>{if(g&&typeof g.id==='string'&&g.id&&!cand.has(g.id))cand.add(g.id)});
  let n=0;const gen=()=>{let id;do{id='g'+(++n)}while(cand.has(id)||used.has(id));used.add(id);return id};
  const seenId=new Set();
  s.guests=(Array.isArray(raw.guests)?raw.guests:[]).filter(g=>g&&typeof g.name==='string'&&g.name.trim()).map(g=>{
    let id=(typeof g.id==='string'&&g.id&&!seenId.has(g.id))?g.id:gen();
    seenId.add(id);
    return {id,name:g.name.trim().slice(0,80),age:['a','k','b'].includes(g.age)?g.age:'a',diet:typeof g.diet==='string'?g.diet.trim().slice(0,60):''};
  });
  const ids=new Set(s.guests.map(g=>g.id));
  // mesas
  const seenG=new Set(),seenT=new Set();
  s.tables=raw.tables.filter(t=>t&&typeof t==='object').map((t,i)=>{
    let id=(typeof t.id==='string'&&t.id&&!seenT.has(t.id))?t.id:'t'+(i+1)+'_'+Math.random().toString(36).slice(2,6);
    seenT.add(id);
    const num=t.main?undefined:(Number.isFinite(+t.num)?+t.num:i+1);
    return {id,name:cleanName(t,num),main:!!t.main,
      num,
      col:clampInt(t.col,0,60,0),row:clampInt(t.row,0,60,0),
      guests:(Array.isArray(t.guests)?t.guests:[]).filter(x=>ids.has(x)&&!seenG.has(x)&&seenG.add(x))};
  });
  let mainSeen=false;s.tables.forEach(t=>{if(t.main){if(mainSeen)t.main=false;mainSeen=true}});
  if(!mainSeen)s.tables.unshift({id:'main',name:'',main:true,col:0,row:0,guests:[]});
  s.tables.forEach(t=>{if(!t.main&&t.num===undefined)t.num=1});
  s.cols=clampInt(raw.cols,1,30,3);s.rows=clampInt(raw.rows,1,30,3);
  // evita mesas sobrepostas
  const occ=new Set();
  s.tables.forEach(t=>{
    s.cols=Math.max(s.cols,t.col+1);s.rows=Math.max(s.rows,t.row+1);
  });
  s.tables.forEach(t=>{
    const k=t.col+','+t.row;
    if(!occ.has(k)){occ.add(k);return}
    let placed=false;
    for(let r=0;r<s.rows&&!placed;r++)for(let c=0;c<s.cols&&!placed;c++){
      if(!occ.has(c+','+r)){t.col=c;t.row=r;occ.add(c+','+r);placed=true}
    }
    if(!placed){t.col=0;t.row=s.rows;s.rows++;occ.add('0,'+t.row)}
  });
  s.nextNum=Math.max(clampInt(raw.nextNum,1,9999,1),...s.tables.map(t=>(t.num||0)+1));
  s.nextGid=Math.max(clampInt(raw.nextGid,1,999999,1),...s.guests.map(g=>(parseInt(g.id.slice(1),10)||0)+1),1);
  s.theme=THEMES.includes(raw.theme)?raw.theme:'agua';
  s.event=typeof raw.event==='string'?raw.event.slice(0,80):'';
  s.min=clampInt(raw.min,1,30,8);s.max=Math.max(s.min,clampInt(raw.max,1,30,12));s.mainCap=clampInt(raw.mainCap,1,30,6);
  s.short=!!raw.short;s.sort=raw.sort==='az'?'az':'list';
  s.orient=['auto','landscape','portrait'].includes(raw.orient)?raw.orient:'auto';
  s.v=1;
  return s;
}
function load(){
  try{const raw=localStorage.getItem(KEY);return raw?sanitize(JSON.parse(raw)):null}catch(e){return null}
}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(S))}
  catch(e){if(!saveWarned){saveWarned=true;toast(t('save.fail'))}}
}
const DATA_KEYS=['guests','tables','cols','rows','nextNum','nextGid','min','max','mainCap'];
const snap=()=>JSON.stringify(DATA_KEYS.reduce((o,k)=>(o[k]=S[k],o),{}));
function commit(){hist.push(snap());if(hist.length>60)hist.shift()}
function undo(){if(!hist.length)return;Object.assign(S,JSON.parse(hist.pop()));sel=null;render()}

function reindex(){
  gmap=new Map(S.guests.map(g=>[g.id,g]));
  const parts=g=>g.name.trim().split(/\s+/);
  const base=g=>{const p=parts(g);return p.length>1?p[0]+' '+p[p.length-1]:p[0]};
  const cnt={};S.guests.forEach(g=>{const b=base(g);cnt[b]=(cnt[b]||0)+1});
  shortOf=new Map(S.guests.map(g=>{const p=parts(g);let s=base(g);if(cnt[s]>1&&p.length>2)s=p[0]+' '+p[1]+' '+p[p.length-1];return[g.id,s]}));
}
const G=id=>gmap.get(id);
const nm=g=>S.short?(shortOf.get(g.id)||g.name):g.name;
const tbl=id=>S.tables.find(t=>t.id===id);
const seatedSet=()=>new Set(S.tables.flatMap(t=>t.guests));
const rowEmpty=r=>!S.tables.some(t=>t.row===r);
const colEmpty=c=>!S.tables.some(t=>t.col===c);
const orderedTables=()=>[...S.tables].sort((a,b)=>a.row-b.row||a.col-b.col);

/* ================= utilitários ================= */
let toastTimer;
function toast(msg){
  const t=$('#toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3200);
}
const libs={};
function loadLib(src){
  if(!libs[src])libs[src]=new Promise((res,rej)=>{
    const s=document.createElement('script');s.src=src;s.onload=res;
    s.onerror=()=>{delete libs[src];rej(new Error('Não foi possível carregar '+src))};
    document.head.appendChild(s);
  });
  return libs[src];
}
function download(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
const fname=ext=>(S.event.trim()?slug()+'-':'')+t('x.fileSuffix')+ext;
const slug=()=>norm(S.event||t('x.fileDefault')).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'mesas';

/* ================= ações ================= */
function moveGuest(gid,toId,idx){
  commit();
  S.tables.forEach(t=>{
    const i=t.guests.indexOf(gid);
    if(i>-1){t.guests.splice(i,1);if(t.id===toId&&idx!=null&&i<idx)idx--}
  });
  if(toId){
    const t=tbl(toId);
    if(idx==null||idx>t.guests.length)idx=t.guests.length;
    t.guests.splice(idx,0,gid);
  }
  render();
}
function nudge(tid,gid,d){
  const t=tbl(tid),i=t.guests.indexOf(gid),j=i+d;
  if(j<0||j>=t.guests.length)return;
  commit();[t.guests[i],t.guests[j]]=[t.guests[j],t.guests[i]];render();
}
function placeTable(id,col,row){
  const t=tbl(id);if(t.col===col&&t.row===row)return;
  commit();
  const o=S.tables.find(x=>x.id!==id&&x.col===col&&x.row===row);
  if(o){o.col=t.col;o.row=t.row}
  t.col=col;t.row=row;render();
}
function newTable(col,row){
  const num=S.nextNum++;
  S.tables.push({id:'t'+num+'_'+Math.random().toString(36).slice(2,6),name:'',num,col,row,guests:[]});
}
function addTableAt(col,row){commit();newTable(col,row);render()}
function addTableAuto(){
  for(let r=0;r<S.rows;r++)for(let c=0;c<S.cols;c++){
    if(!S.tables.some(t=>t.col===c&&t.row===r))return addTableAt(c,r);
  }
  commit();S.rows++;newTable(0,S.rows-1);render();
}
function delTable(id){
  const t=tbl(id);if(!t||t.main)return;
  commit();S.tables=S.tables.filter(x=>x.id!==id);render();
}
function edge(k){
  commit();
  switch(k){
    case 'top-add':S.tables.forEach(t=>t.row++);S.rows++;break;
    case 'bottom-add':S.rows++;break;
    case 'left-add':S.tables.forEach(t=>t.col++);S.cols++;break;
    case 'right-add':S.cols++;break;
    case 'top-del':if(rowEmpty(0)&&S.rows>1){S.tables.forEach(t=>t.row--);S.rows--}break;
    case 'bottom-del':if(rowEmpty(S.rows-1)&&S.rows>1)S.rows--;break;
    case 'left-del':if(colEmpty(0)&&S.cols>1){S.tables.forEach(t=>t.col--);S.cols--}break;
    case 'right-del':if(colEmpty(S.cols-1)&&S.cols>1)S.cols--;break;
  }
  render();
}

/* ================= convidados: adicionar / editar ================= */
let editId=null;
function openGuest(id){
  editId=id||null;const g=id?G(id):null;
  $('#gTitle').textContent=t(g?'g.edit':'g.add');
  $('#gName').value=g?g.name:'';$('#gAge').value=g?g.age:'a';$('#gDiet').value=g?g.diet:'';
  $('#gSave').textContent=t(g?'g.save':'g.addBtn');
  $('#gDelete').hidden=!g;
  closeDialogs();$('#dlgGuest').showModal();$('#gName').focus();
}
$('#fGuest').addEventListener('submit',e=>{
  e.preventDefault();
  const name=$('#gName').value.trim().replace(/\s+/g,' ');
  if(!name){$('#gName').focus();return}
  const age=$('#gAge').value,diet=$('#gDiet').value.trim();
  if(editId){
    commit();Object.assign(G(editId),{name,age,diet});
    $('#dlgGuest').close();toast(t('g.saved'));render();
  }else{
    const dup=S.guests.some(g=>norm(g.name)===norm(name));
    commit();S.guests.push({id:'g'+(S.nextGid++),name,age,diet});
    toast(t('g.added',{name})+(dup?t('g.dup'):''));
    $('#gName').value='';$('#gDiet').value='';$('#gName').focus();render();
  }
});
$('#gClose').addEventListener('click',()=>$('#dlgGuest').close());
$('#gDelete').addEventListener('click',()=>{
  if(!editId)return;
  commit();S.guests=S.guests.filter(g=>g.id!==editId);
  S.tables.forEach(tb=>tb.guests=tb.guests.filter(x=>x!==editId));
  $('#dlgGuest').close();toast(t('g.deleted'));render();
});

/* ================= Excel: modelo e importação ================= */
const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function parseAge(v){
  if(typeof v==='number')return v<=3?'b':v<=9?'k':'a';
  const s=norm(v).replace(/[–—]/g,'-').trim();
  if(/^\d+$/.test(s)){const n=+s;return n<=3?'b':n<=9?'k':'a'}
  if(/bebe|baby|babies|infant/.test(s)||/(^|\D)0\s*(-|a|ate|to)\s*3/.test(s))return 'b';
  if(/crianca|child|nino|kid/.test(s)||/(^|\D)4\s*(-|a|ate|to)\s*9/.test(s))return 'k';
  return 'a';
}
async function downloadTemplate(){
  await loadLib('vendor/xlsx.full.min.js');
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([[t('x.col.name'),t('x.col.age'),t('x.col.diet')]]);
  ws['!cols']=[{wch:40},{wch:12},{wch:32}];
  XLSX.utils.book_append_sheet(wb,ws,t('tpl.sheet'));
  const info=XLSX.utils.aoa_to_sheet([[t('tpl.i0')],[t('tpl.i1')],[t('tpl.i2')],[t('tpl.i3')],[t('tpl.i4')]]);
  info['!cols']=[{wch:90}];
  XLSX.utils.book_append_sheet(wb,info,t('tpl.info'));
  download(new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:XLSX_MIME}),t('x.templateFile')+'.xlsx');
}
const NAME_COLS=['nome','name','nombre','convidado','guest','invitado'];
const AGE_COLS=['idade','age','edad','faixa etaria','age group'];
const DIET_COLS=['restricao','restricoes','restricao alimentar','restricoes alimentares','dieta','alergias','restriction','restrictions','dietary','dietary requirement','dietary requirements','diet','allergies','restriccion','restricciones','restriccion alimentaria','restricciones alimentarias'];
async function readExcel(file){
  await loadLib('vendor/xlsx.full.min.js');
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
  const sheet=wb.SheetNames.find(n=>/convidad|invitad|guest|lista|list/i.test(n))||wb.SheetNames[0];
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:'',raw:true});
  let hi=-1,cn=0,ca=1,cd=2;
  for(let i=0;i<Math.min(rows.length,15)&&hi<0;i++){
    const r=rows[i].map(c=>norm(String(c).trim()));
    const n=r.findIndex(c=>NAME_COLS.includes(c));
    if(n>-1){hi=i;cn=n;ca=r.findIndex(c=>AGE_COLS.includes(c));cd=r.findIndex(c=>DIET_COLS.includes(c))}
  }
  const list=[];
  for(let i=hi+1;i<rows.length;i++){
    const r=rows[i],name=String(r[cn]??'').trim().replace(/\s+/g,' ');
    if(!name||norm(name)==='vazio')continue;
    const ageRaw=ca>-1?r[ca]:'';
    if(norm(String(ageRaw))==='vazio')continue;
    list.push({name:name.slice(0,80),age:parseAge(ageRaw),diet:cd>-1?String(r[cd]??'').trim().slice(0,60):''});
  }
  return {sheet,list};
}
let pending=null;
async function onExcelChosen(file){
  try{
    const res=await readExcel(file);
    if(!res.list.length){toast(t('imp.none'));return}
    pending=res;
    if(!S.guests.length){applyImport('replace');return}
    $('#impInfo').textContent=t('imp.info',{found:tc('guests',res.list.length),sheet:res.sheet,have:tc('guests',S.guests.length)});
    closeDialogs();$('#dlgImport').showModal();
  }catch(err){toast(t('imp.err',{msg:err.message}))}
}
function applyImport(mode){
  if(!pending)return;
  commit();
  if(mode==='replace'){S.guests=[];S.tables.forEach(tb=>tb.guests=[]);S.nextGid=1}
  const have=new Set(S.guests.map(g=>norm(g.name)));
  let add=0,skip=0;
  pending.list.forEach(x=>{
    if(mode==='append'&&have.has(norm(x.name))){skip++;return}
    S.guests.push({id:'g'+(S.nextGid++),name:x.name,age:x.age,diet:x.diet});have.add(norm(x.name));add++;
  });
  pending=null;closeDialogs();render();
  toast(tc('imp.added',add)+(skip?' · '+tc('imp.skipped',skip):''));
}

/* ================= JSON ================= */
function exportJSON(){
  const data={app:'lugar-a-mesa',version:1,exportedAt:new Date().toISOString(),state:S};
  download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),slug()+'.json');
  toast(t('json.exported'));
}
async function onJsonChosen(file){
  try{
    const raw=JSON.parse(await file.text());
    const st=sanitize(raw&&raw.state?raw.state:raw);
    if(!st)throw new Error(t('json.format'));
    commit();S=st;sel=null;closeDialogs();render();
    toast(t('json.imported',{g:tc('guests',S.guests.length),t:tc('tables',S.tables.length)}));
  }catch(err){toast(t('json.err',{msg:err.message}))}
}

/* ================= exportar lista das mesas ================= */
function listModel(){
  const seated=seatedSet();
  return {
    title:S.event||t('x.title'),
    tables:orderedTables().map(tb=>({name:tbName(tb),guests:tb.guests.map(G)})),
    left:S.guests.filter(g=>!seated.has(g.id))
  };
}
const extraOf=(g,plain)=>[g.age!=='a'?(plain?ageL(g.age).replace(/–/g,'-'):ageL(g.age)):'',g.diet].filter(Boolean).join(' · ');
const countAge=(list,a)=>list.filter(g=>g.age===a).length;

async function exportXlsx(){
  await loadLib('vendor/xlsx.full.min.js');
  const m=listModel();
  const rows=[[t('x.col.table'),t('x.col.seat'),t('x.col.name'),t('x.col.age'),t('x.col.diet')]];
  m.tables.forEach(tb=>{
    if(!tb.guests.length)rows.push([tb.name,'',t('x.noGuestsRow'),'','']);
    tb.guests.forEach((g,i)=>rows.push([tb.name,i+1,g.name,ageL(g.age),g.diet]));
  });
  m.left.forEach(g=>rows.push([t('x.unseated'),'',g.name,ageL(g.age),g.diet]));
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:22},{wch:7},{wch:40},{wch:11},{wch:30}];
  const sum=[[t('x.col.table'),t('x.sumPeople'),ageL('a'),ageL('k'),ageL('b')]];
  m.tables.forEach(tb=>sum.push([tb.name,tb.guests.length,countAge(tb.guests,'a'),countAge(tb.guests,'k'),countAge(tb.guests,'b')]));
  if(m.left.length)sum.push([t('x.unseated'),m.left.length,countAge(m.left,'a'),countAge(m.left,'k'),countAge(m.left,'b')]);
  const ws2=XLSX.utils.aoa_to_sheet(sum);ws2['!cols']=[{wch:22},{wch:9},{wch:10},{wch:10},{wch:10}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,t('x.sheetTables'));
  XLSX.utils.book_append_sheet(wb,ws2,t('x.sheetSummary'));
  download(new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:XLSX_MIME}),fname('.xlsx'));
}
async function exportDocx(){
  await loadLib('vendor/docx.min.js');
  const {Document,Packer,Paragraph,TextRun,HeadingLevel}=docx;
  const m=listModel(),kids=[new Paragraph({text:m.title,heading:HeadingLevel.TITLE})];
  const block=(title,guests,emptyText)=>{
    kids.push(new Paragraph({text:title,heading:HeadingLevel.HEADING_2,spacing:{before:260,after:80},keepNext:true}));
    if(!guests.length)kids.push(new Paragraph({children:[new TextRun({text:emptyText,italics:true,color:'777777'})]}));
    guests.forEach((g,i)=>{
      const ex=extraOf(g,false);
      kids.push(new Paragraph({children:[new TextRun(`${i+1}. ${g.name}`),...(ex?[new TextRun({text:'   '+ex,color:'666666',size:19})]:[])]}));
    });
  };
  m.tables.forEach(tb=>block(`${tb.name} (${tc('people',tb.guests.length)})`,tb.guests,t('x.noGuests')));
  if(m.left.length)block(t('x.leftHeading',{n:m.left.length}),m.left,'');
  const blob=await Packer.toBlob(new Document({sections:[{children:kids}]}));
  download(blob,fname('.docx'));
}
async function exportPdf(){
  await loadLib('vendor/jspdf.umd.min.js');
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'});
  const m=listModel(),M=18,W=210,H=297,LH=5.6;
  let y=M;
  const ensure=h=>{if(y+h>H-M){doc.addPage();y=M}};
  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text(m.title,M,y+5);y+=11;
  const total=m.tables.reduce((n,tb)=>n+tb.guests.length,0);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(110);
  doc.text(t('x.summary',{seated:tc('x.seated',total),tables:tc('tables',m.tables.length)})+(m.left.length?' · '+t('x.leftNote',{n:m.left.length}):''),M,y);y+=8;
  doc.setTextColor(0);
  const block=(title,guests,emptyText)=>{
    const h=9+Math.max(1,guests.length)*LH;
    ensure(h<=H-2*M?h:20);
    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text(title,M,y+4);y+=8;
    doc.setFontSize(10.5);
    if(!guests.length){doc.setFont('helvetica','italic');doc.setTextColor(120);doc.text(emptyText,M+2,y+3);doc.setTextColor(0);y+=LH}
    guests.forEach((g,i)=>{
      ensure(LH+2);
      doc.setFont('helvetica','normal');doc.setTextColor(0);
      const line=`${i+1}. ${g.name}`;doc.text(line,M+2,y+3);
      const ex=extraOf(g,true);
      if(ex){doc.setFontSize(9);doc.setTextColor(110);doc.text(ex,M+2+doc.getTextWidth(line)+4,y+3);doc.setFontSize(10.5);doc.setTextColor(0)}
      y+=LH;
    });
    y+=4;
  };
  m.tables.forEach(tb=>block(`${tb.name}  (${tb.guests.length})`,tb.guests,t('x.noGuests')));
  if(m.left.length)block(t('x.leftHeading',{n:m.left.length}),m.left,'');
  const pages=doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(130);doc.text(`${i}/${pages}`,W-M,H-9,{align:'right'})}
  download(doc.output('blob'),fname('.pdf'));
}
async function runExport(fn){
  try{toast(t('x.preparing'));await fn();toast(t('x.done'))}
  catch(err){toast(t('x.error',{msg:err.message}))}
}

/* ================= vistas ================= */
const legendHTML=()=>['a','k','b'].map(a=>`<span class="lg"><i style="background:var(--${a==='a'?'adult':a==='k'?'kid':'baby'})"></i>${esc(ageL(a))}</span>`).join('');

function applyStatic(){
  document.documentElement.lang=LANGS[LANG].code;
  document.title='Lugar à Mesa — '+t('brand.sub');
  $$('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  $$('[data-i18n-ph]').forEach(el=>el.placeholder=t(el.dataset.i18nPh));
  $$('[data-i18n-title]').forEach(el=>el.title=t(el.dataset.i18nTitle));
  $$('[data-i18n-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.i18nAria)));
  $('#dietList').innerHTML=t('diets').map(d=>`<option value="${esc(d)}">`).join('');
  $('#sideLegend').innerHTML=legendHTML();$('#printLegend').innerHTML=legendHTML();
  $('#lang').value=LANG;
  const w=$('#btnWipe');w.classList.remove('armed');w.textContent=t('fl.wipe');
}
function chipsHTML(g){
  let h='';
  if(g.age==='k'||g.age==='b')h+='<span class="chip"><i></i>'+esc(ageL(g.age))+'</span>';
  if(g.diet)h+='<span class="chip diet">'+esc(g.diet)+'</span>';
  return h?'<span class="gchips">'+h+'</span>':'';
}
function dot(x,y,r,gid){
  if(!gid)return `<circle class="seat-dot empty" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`;
  const g=G(gid);
  return `<circle class="seat-dot ${g.age}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"><title>${esc(g.name)}</title></circle>`;
}
function ringSVG(tb){
  const n=tb.guests.length;
  if(tb.main){
    const slots=Math.max(n,S.mainCap),top=Math.ceil(slots/2),bot=slots-top;
    const xs=(k,c)=>c===1?50:20+60*k/(c-1);
    let d='';
    for(let i=0;i<slots;i++){
      let x,y;
      if(i<top){x=xs(i,top);y=19}else{x=xs(bot-1-(i-top),bot);y=81}
      d+=dot(x,y,slots>10?4.5:6,tb.guests[i]);
    }
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect class="tbl main" x="7" y="33" width="86" height="34" rx="17"/><text class="tlabel" x="50" y="50.5">${esc(t('tbl.mainShort'))}</text>${d}</svg>`;
  }
  const slots=Math.max(n,S.min),r=slots>12?5:6;
  let d='';
  for(let i=0;i<slots;i++){
    const a=(-90+i*360/slots)*Math.PI/180;
    d+=dot(50+38*Math.cos(a),50+38*Math.sin(a),r,tb.guests[i]);
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="tbl" cx="50" cy="50" r="25"/><text class="tnum" x="50" y="51">${tb.num||''}</text>${d}</svg>`;
}
function statusOf(tb){
  const n=tb.guests.length;
  if(tb.main){
    const c=S.mainCap;
    if(n<c)return[tc('st.mainFree',c-n),'warn'];
    if(n===c)return[t('st.mainFull'),'ok'];
    return[t('st.mainOver',{n:n-c}),'bad'];
  }
  if(n<S.min)return[t('st.missing',{n:S.min-n,min:S.min}),'warn'];
  if(n>S.max)return[t('st.over',{n:n-S.max,max:S.max}),'bad'];
  const f=S.max-n;return[f?tc('st.free',f):t('st.full'),'ok'];
}
function mixOf(tb){
  const c={a:0,k:0,b:0};tb.guests.forEach(id=>c[G(id).age]++);
  const p=[];
  if(c.a)p.push(tc('m.adult',c.a));
  if(c.k)p.push(tc('m.kid',c.k));
  if(c.b)p.push(tc('m.baby',c.b));
  return p.join(', ');
}
function tableHTML(tb){
  const n=tb.guests.length,cap=tb.main?S.mainCap:S.max;
  const [st,cls]=statusOf(tb);
  const seats=tb.guests.map((id,i)=>{
    const g=G(id);
    return `<li class="seat ag-${g.age}" draggable="true" data-gid="${id}"><span class="sn">${i+1}</span><span class="sbody"><span class="gname">${esc(nm(g))}</span>${chipsHTML(g)}</span><span class="acts"><button data-act="edit" aria-label="${esc(t('act.edit'))}" title="${esc(t('act.edit'))}">✎</button><button data-act="up" aria-label="${esc(t('act.up'))}" title="${esc(t('act.up'))}">↑</button><button data-act="down" aria-label="${esc(t('act.down'))}" title="${esc(t('act.down'))}">↓</button><button data-act="out" aria-label="${esc(t('act.out'))}" title="${esc(t('act.out'))}">×</button></span></li>`;
  }).join('');
  const sg=sel?G(sel):null;
  return `<article class="table-card${tb.main?' main':''}" data-table="${tb.id}">
    <header class="th">
      <div class="tablehandle" draggable="true" title="${esc(t('tbl.handle'))}">${ringSVG(tb)}</div>
      <div class="tinfo">
        <input class="tname" value="${esc(tbName(tb))}" aria-label="${esc(t('tbl.nameAria'))}" maxlength="30" data-tid="${tb.id}">
        <div class="tcount"><b>${n}</b><span>/${cap}</span></div>
        <div class="tstatus ${cls}">${esc(st)}</div>
      </div>
      ${tb.main?'':`<button class="icon" data-act="deltable" aria-label="${esc(t('tbl.del'))}" title="${esc(t('tbl.delTitle'))}">×</button>`}
    </header>
    <ol class="seats">${seats}</ol>
    ${n?'':`<div class="empty-note">${esc(t('tbl.empty'))}</div>`}
    ${sg?`<button class="add-here" data-act="seathere">${esc(t('tbl.seatHere',{name:nm(sg)}))}</button>`:''}
    ${n?`<div class="mix">${esc(mixOf(tb))}</div>`:''}
  </article>`;
}
function renderRoom(){
  const room=$('#room');
  room.style.setProperty('--cols',S.cols);room.style.setProperty('--rows',S.rows);
  let h='';
  for(let r=0;r<S.rows;r++)for(let c=0;c<S.cols;c++){
    const tb=S.tables.find(x=>x.col===c&&x.row===r);
    const pos=`style="grid-column:${c+1};grid-row:${r+1}" data-col="${c}" data-row="${r}"`;
    h+=tb?`<div class="cell" ${pos}>${tableHTML(tb)}</div>`
         :`<div class="cell empty" ${pos}><button class="add-table" data-act="addat">${esc(t('cell.add'))}</button></div>`;
  }
  room.innerHTML=h;
  const dis={'top-del':!(rowEmpty(0)&&S.rows>1),'bottom-del':!(rowEmpty(S.rows-1)&&S.rows>1),
             'left-del':!(colEmpty(0)&&S.cols>1),'right-del':!(colEmpty(S.cols-1)&&S.cols>1)};
  $$('[data-edge]').forEach(b=>{const k=b.dataset.edge;if(k in dis)b.disabled=dis[k]});
}
function matchFilter(g){
  if(filter==='a'||filter==='k'||filter==='b'){if(g.age!==filter)return false}
  else if(filter==='diet'){if(!g.diet)return false}
  if(q&&!norm(g.name).includes(q))return false;
  return true;
}
function renderPool(){
  const seated=seatedSet();
  const all=S.guests.filter(g=>!seated.has(g.id));
  let list=S.sort==='az'?[...all].sort((a,b)=>a.name.localeCompare(b.name,LANGS[LANG].code)):all;
  list=list.filter(matchFilter);
  $('#poolCount').textContent=t('pool.count',{a:all.length,b:S.guests.length});
  let h=list.map(g=>`<div class="guest ag-${g.age}${sel===g.id?' sel':''}" draggable="true" tabindex="0" data-gid="${g.id}"><span class="gname">${esc(nm(g))}</span>${chipsHTML(g)}<button class="edit" data-act="edit" aria-label="${esc(t('pool.editAria',{name:g.name}))}" title="${esc(t('act.edit'))}">✎</button></div>`).join('');
  if(!S.guests.length)h=`<p class="note">${lines(t('pool.none'))}</p>`;
  else if(!all.length)h=`<p class="note">${esc(t('pool.all'))}</p>`;
  else if(!list.length)h=`<p class="note">${esc(t('pool.nomatch'))}</p>`;
  $('#poolList').innerHTML=h;
}
function renderHead(){
  const seated=seatedSet().size,left=S.guests.length-seated;
  const bad=S.tables.filter(tb=>!tb.main&&(tb.guests.length<S.min||tb.guests.length>S.max)).length;
  const lim={min:S.min,max:S.max};
  $('#stats').innerHTML=S.guests.length
    ?`<span><b>${seated}</b> ${esc(t('stats.seated'))}</span><span><b>${left}</b> ${esc(t('stats.left'))}</span>`+
      (bad?`<span class="warn"><b>${bad}</b> ${esc(tc('stats.bad',bad,lim).replace(/^\d+\s*/,''))}</span>`:`<span class="ok"><b>✓</b> ${esc(t('stats.ok',lim))}</span>`)
    :`<span>${esc(t('stats.none'))}</span>`;
  $('#btnUndo').disabled=!hist.length;
  $$('[data-names]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.names==='short')===S.short)));
  $$('[data-sort]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sort===S.sort)));
  $$('[data-f]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.f===filter)));
  $$('#themes [data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===S.theme)));
  document.documentElement.dataset.theme=S.theme;
  if(document.activeElement!==$('#eventName'))$('#eventName').value=S.event;
  $('#printTitle').textContent=S.event||t('print.title');
  const hint=$('#hint');
  if(sel&&G(sel)){hint.hidden=false;hint.innerHTML=`<span>${esc(t('hint.text',{name:nm(G(sel))}))}</span><button class="btn" data-act="cancelsel">${esc(t('hint.cancel'))}</button>`}
  else hint.hidden=true;
}
function render(){
  reindex();
  if(sel&&(!G(sel)||seatedSet().has(sel)))sel=null;
  renderHead();renderPool();renderRoom();save();setPage();
}

/* ================= impressão A4 ================= */
const pageStyle=document.createElement('style');document.head.appendChild(pageStyle);
const MM=96/25.4;
function fitScale(land){
  const room=$('#room'),w=room.offsetWidth,h=room.offsetHeight;
  const pw=((land?297:210)-20)*MM,ph=((land?210:297)-20)*MM-48;
  return Math.min(pw*.98/w,ph*.97/h);
}
function isLandscape(){
  if(S.orient==='landscape')return true;
  if(S.orient==='portrait')return false;
  return fitScale(true)>=fitScale(false);
}
function setPage(){
  const land=isLandscape();
  pageStyle.textContent=`@page{size:A4 ${land?'landscape':'portrait'};margin:10mm}`;
  return land;
}
function preparePrint(){
  const land=setPage(),room=$('#room'),w=room.offsetWidth,h=room.offsetHeight;
  const s=Math.min(fitScale(land),1.3),st=document.documentElement.style;
  st.setProperty('--ps',s.toFixed(4));
  st.setProperty('--fw',Math.ceil(w*s)+'px');
  st.setProperty('--fh',Math.ceil(h*s)+'px');
}
window.addEventListener('beforeprint',preparePrint);

/* ================= eventos ================= */
function closeDialogs(){$$('dialog[open]').forEach(d=>d.close())}
function pickFile(id){const f=$(id);f.value='';f.click()}
let wipeTimer;
document.addEventListener('click',e=>{
  const el=e.target;
  const th=el.closest('#themes [data-theme]');if(th){S.theme=th.dataset.theme;return render()}
  const names=el.closest('[data-names]');if(names){S.short=names.dataset.names==='short';return render()}
  const so=el.closest('[data-sort]');if(so){S.sort=so.dataset.sort;return render()}
  const f=el.closest('[data-f]');if(f){filter=f.dataset.f;return render()}
  const ed=el.closest('[data-edge]');if(ed&&!ed.disabled)return edge(ed.dataset.edge);
  const a=el.closest('[data-act]');
  if(a){
    const act=a.dataset.act,card=a.closest('.table-card'),item=a.closest('[data-gid]');
    switch(act){
      case 'up':return nudge(card.dataset.table,item.dataset.gid,-1);
      case 'down':return nudge(card.dataset.table,item.dataset.gid,1);
      case 'out':return moveGuest(item.dataset.gid,null);
      case 'edit':return openGuest(item.dataset.gid);
      case 'deltable':return delTable(card.dataset.table);
      case 'addat':{const c=a.closest('.cell');return addTableAt(+c.dataset.col,+c.dataset.row)}
      case 'seathere':{const g=sel;sel=null;return moveGuest(g,card.dataset.table)}
      case 'cancelsel':sel=null;return render();
      case 'addguest':return openGuest(null);
      case 'importxlsx':return pickFile('#fileXlsx');
      case 'importjson':return pickFile('#fileJson');
      case 'template':return runExport(downloadTemplate);
      case 'exportjson':return exportJSON();
      case 'exportxlsx':return runExport(exportXlsx);
      case 'exportdocx':return runExport(exportDocx);
      case 'exportpdf':return runExport(exportPdf);
      case 'closedlg':return closeDialogs();
    }
  }
  const g=el.closest('#poolList .guest');
  if(g){sel=sel===g.dataset.gid?null:g.dataset.gid;return render()}
});
document.addEventListener('keydown',e=>{
  const tag=e.target.tagName;
  if(e.key==='Escape'&&sel&&!document.querySelector('dialog[open]')){sel=null;render()}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#poolList .guest')){e.preventDefault();e.target.click()}
  if(e.key==='Enter'&&e.target.matches&&e.target.matches('.tname,#eventName'))e.target.blur();
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='SELECT'){e.preventDefault();undo()}
});
document.addEventListener('change',e=>{
  if(e.target.matches('.tname')){
    const tb=tbl(e.target.dataset.tid);if(!tb)return;
    const v=e.target.value.trim().slice(0,30),def=tb.main?t('tbl.main'):t('tbl.n',{n:tb.num});
    commit();tb.name=(!v||v===def)?'':v;
    e.target.value=tbName(tb);save();$('#btnUndo').disabled=false;
  }
});
$('#eventName').addEventListener('input',e=>{S.event=e.target.value;$('#printTitle').textContent=S.event||t('print.title');save()});
$('#search').addEventListener('input',e=>{q=norm(e.target.value.trim());renderPool()});
$('#btnUndo').addEventListener('click',undo);
$('#btnAdd').addEventListener('click',addTableAuto);
$('#btnFiles').addEventListener('click',()=>$('#dlgFiles').showModal());
$('#btnOpts').addEventListener('click',()=>{
  $('#oMin').value=S.min;$('#oMax').value=S.max;$('#oMain').value=S.mainCap;$('#oOrient').value=S.orient;
  $('#dlgOpts').showModal();
});
['#oMin','#oMax','#oMain'].forEach(id=>$(id).addEventListener('change',()=>{
  S.min=clampInt($('#oMin').value,1,30,8);
  S.max=Math.max(S.min,clampInt($('#oMax').value,1,30,12));
  S.mainCap=clampInt($('#oMain').value,1,30,6);
  $('#oMin').value=S.min;$('#oMax').value=S.max;$('#oMain').value=S.mainCap;render();
}));
$('#oOrient').addEventListener('change',e=>{S.orient=e.target.value;render()});
$('#btnPrint').addEventListener('click',()=>{preparePrint();window.print()});
$('#fileXlsx').addEventListener('change',e=>{const f=e.target.files[0];if(f)onExcelChosen(f)});
$('#fileJson').addEventListener('change',e=>{const f=e.target.files[0];if(f)onJsonChosen(f)});
$('#impAppend').addEventListener('click',()=>applyImport('append'));
$('#impReplace').addEventListener('click',()=>applyImport('replace'));
$('#lang').addEventListener('change',e=>{
  LANG=LANGS[e.target.value]?e.target.value:'pt';
  try{localStorage.setItem(LKEY,LANG)}catch(err){}
  applyStatic();render();
});
$('#footToggle').addEventListener('click',()=>{
  const p=$('#footPanel'),open=p.hidden;p.hidden=!open;
  $('#footToggle').setAttribute('aria-expanded',String(open));
  if(open)p.scrollIntoView({block:'nearest'});
});
$('#btnWipe').addEventListener('click',e=>{
  const b=e.currentTarget;
  if(!b.classList.contains('armed')){
    b.classList.add('armed');b.textContent=t('fl.wipeConfirm');
    clearTimeout(wipeTimer);wipeTimer=setTimeout(()=>{b.classList.remove('armed');b.textContent=t('fl.wipe')},4000);return;
  }
  clearTimeout(wipeTimer);b.classList.remove('armed');b.textContent=t('fl.wipe');
  commit();const keep={theme:S.theme,short:S.short,sort:S.sort,orient:S.orient};
  S=Object.assign(blankState(),keep);sel=null;closeDialogs();render();toast(t('wipe.done'));
});

/* ================= arrastar e largar ================= */
const elOf=e=>{const t=e.target;return t&&t.closest?t:(t&&t.parentElement)};
function clearInd(){$$('.ins-before,.ins-end,.over,.over-cell').forEach(el=>el.classList.remove('ins-before','ins-end','over','over-cell'))}
function calcIdx(card,y){
  const seats=$$('.seat',card);
  for(let i=0;i<seats.length;i++){const r=seats[i].getBoundingClientRect();if(y<r.top+r.height/2)return i}
  return seats.length;
}
document.addEventListener('dragstart',e=>{
  const el=elOf(e);if(!el)return;
  const handle=el.closest('.tablehandle'),item=el.closest('.seat, #poolList .guest');
  if(handle){
    const card=handle.closest('.table-card');
    drag={type:'table',id:card.dataset.table,target:null};
    e.dataTransfer.setDragImage(card,24,24);
    requestAnimationFrame(()=>card.classList.add('dragging'));
  }else if(item){
    const card=item.closest('.table-card');
    drag={type:'guest',id:item.dataset.gid,from:card?card.dataset.table:'pool',target:null};
    requestAnimationFrame(()=>item.classList.add('dragging'));
  }else return;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',drag.id);
});
document.addEventListener('dragover',e=>{
  if(!drag)return;
  const el=elOf(e);if(!el)return;
  clearInd();drag.target=null;
  if(drag.type==='guest'){
    const card=el.closest('.table-card');
    if(card){
      e.preventDefault();e.dataTransfer.dropEffect='move';
      const idx=calcIdx(card,e.clientY);
      card.classList.add('over');
      const seats=$$('.seat',card);
      if(idx<seats.length)seats[idx].classList.add('ins-before');else $('.seats',card).classList.add('ins-end');
      drag.target={table:card.dataset.table,idx};
    }else if(el.closest('#pool')&&drag.from!=='pool'){
      e.preventDefault();e.dataTransfer.dropEffect='move';
      $('#pool').classList.add('over');drag.target={table:null};
    }
  }else{
    const cell=el.closest('.cell');
    if(cell){
      e.preventDefault();e.dataTransfer.dropEffect='move';
      cell.classList.add('over-cell');
      drag.target={col:+cell.dataset.col,row:+cell.dataset.row};
    }
  }
});
document.addEventListener('drop',e=>{
  if(!drag||!drag.target)return;
  e.preventDefault();
  const d=drag;drag=null;clearInd();
  if(d.type==='guest')moveGuest(d.id,d.target.table,d.target.idx);
  else placeTable(d.id,d.target.col,d.target.row);
});
document.addEventListener('dragend',()=>{drag=null;clearInd();$$('.dragging').forEach(el=>el.classList.remove('dragging'))});

/* ================= arranque ================= */
S=load()||blankState();
applyStatic();
render();
window.addEventListener('resize',setPage);
})();
