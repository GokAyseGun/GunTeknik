// Gün Teknik ERP — Sağlık modülü
// Yalnız sağlık sahibinin hesabında yüklenir (index.html → sglBaslat). Veri Supabase'te "sadece sahibi" kurallı
// saglik_* tablolarında durur; bu dosyada (herkese açık depo) hiçbir kişisel sağlık verisi YOKTUR.
(function(){
'use strict';
const S=window.SGL={v:{},yuklendi:false,yukleniyor:null,sekme:'ozet',aralik:30,gun:null,acik:{},konu:'hepsi',duzenle:false,sabahSonra:0};

// ───────────────────────────────────────── yardımcılar
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n1=(v,d=1)=>v==null||!isFinite(v)?'—':Number(v).toLocaleString('tr-TR',{maximumFractionDigits:d,minimumFractionDigits:0});
const sayi=x=>{if(x==null)return null;const v=parseFloat(String(x).replace(/\s/g,'').replace(',','.'));return isFinite(v)?v:null;};
const pad=n=>String(n).padStart(2,'0');
const gStr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const bugun=()=>gStr(new Date());
const gTs=g=>{const [y,m,d]=g.split('-').map(Number);return new Date(y,m-1,d).getTime();};
const gEkle=(g,n)=>{const [y,m,d]=g.split('-').map(Number);return gStr(new Date(y,m-1,d+n));};
const gFark=(a,b)=>Math.round((gTs(b)-gTs(a))/864e5);
const zGun=z=>gStr(new Date(z));
const saat=z=>{const d=new Date(z);return pad(d.getHours())+':'+pad(d.getMinutes());};
const trT=g=>{if(!g)return '—';const [y,m,d]=String(g).slice(0,10).split('-');return d+'.'+m+'.'+y;};
const trK=g=>{const d=new Date(gTs(g));return d.toLocaleDateString('tr-TR',{day:'numeric',month:'short'});};
const trGun=g=>new Date(gTs(g)).toLocaleDateString('tr-TR',{weekday:'short'});
const ort=a=>{const b=a.filter(x=>x!=null&&isFinite(x));return b.length?b.reduce((s,x)=>s+x,0)/b.length:null;};
const top=a=>a.reduce((s,x)=>s+(Number(x)||0),0);
const toast=(m,t)=>{try{showToast(m,t||'blue');}catch(e){console.log(m);}};
const dtYerel=d=>{d=d||new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());};
const RENK={mg:'var(--mg)',cy:'var(--cy)',yesil:'var(--green)',kirmizi:'var(--red)',amber:'var(--amber)',mor:'var(--purple)',gri:'var(--text3)'};
const TUR_AD={yuruyus:'🚶 Yürüyüş',kosu:'🏃 Koşu',bisiklet:'🚴 Bisiklet',trekking:'🥾 Trekking',ev:'🏋️ Ev antrenmanı',diger:'✨ Diğer'};
const TUR_RENK={yuruyus:'#00E5FF',kosu:'#E8197A',bisiklet:'#FFAB00',trekking:'#00E676',ev:'#7C4DFF',diger:'#909090'};
const DIS_TURLER=['yuruyus','kosu','bisiklet','trekking'];

// ───────────────────────────────────────── ayarlar
const PANELLER={
  sabah:{ad:'☀️ Sabah formu',sekme:'ozet',boy:'tam'},
  ruh:{ad:'🧠 Atak · mod · stres · mutluluk',sekme:'ruh',boy:'tam'},
  ilac:{ad:'💊 İlaçlar',sekme:'ilac',boy:'tam'},
  adim:{ad:'👣 Adım ve aktivite',sekme:'aktivite',boy:'yarim'},
  kilo:{ad:'⚖️ Kilo ve vücut',sekme:'vucut',boy:'yarim'},
  dis:{ad:'🗺️ Dış aktiviteler',sekme:'aktivite',boy:'yarim'},
  ev:{ad:'🏋️ Ev antrenmanı',sekme:'aktivite',boy:'yarim'},
  uyku:{ad:'😴 Uyku',sekme:'vucut',boy:'yarim'},
  nabiz:{ad:'❤️ Nabız',sekme:'kalp',boy:'yarim'},
  tansiyon:{ad:'🩺 Tansiyon',sekme:'kalp',boy:'yarim'},
  su:{ad:'💧 Su',sekme:'vucut',boy:'yarim'},
  kafein:{ad:'☕ Kahve',sekme:'ruh',boy:'yarim'},
  sigara:{ad:'🚭 Sigarasız',sekme:'ozet',boy:'yarim'},
  tahlil:{ad:'🧪 Tahliller',sekme:'tahlil',boy:'yarim'},
  randevu:{ad:'🩻 Doktor ve randevular',sekme:'tahlil',boy:'yarim'},
  yolculuk:{ad:'🏅 Kilo yolculuğu ve seriler',sekme:'vucut',boy:'tam'},
  claude:{ad:'✨ Claude\'un yorumu',sekme:'claude',boy:'tam'}
};
const VARSAYILAN={
  paneller:['sabah','ruh','ilac','kilo','adim','su','kafein','uyku','tansiyon','dis','ev','nabiz','sigara','tahlil','randevu','yolculuk','claude'],
  hedef:{kilo:null,kiloTarih:null,boy:null,adim:8000,su:3000,spor:3,kafein:2,uyku:7.5},
  sigara:{birakis:null,paketFiyat:100,gunlukPaket:1},
  takviyeler:['Balık yağı','D vitamini','Multivitamin','Magnezyum','C vitamini']
};
function ayar(){const a=(S.v.ayar&&S.v.ayar.veri)||{};const v=JSON.parse(JSON.stringify(VARSAYILAN));
  if(Array.isArray(a.paneller))v.paneller=a.paneller.filter(p=>PANELLER[p]);
  Object.assign(v.hedef,a.hedef||{});if(!(v.hedef.su>=500))v.hedef.su=3000;Object.assign(v.sigara,a.sigara||{});if(Array.isArray(a.takviyeler)&&a.takviyeler.length)v.takviyeler=a.takviyeler;v.isaretIlac=a.isaretIlac||null;
  v.tumu=a.paneller?Object.keys(PANELLER):v.paneller;return v;}
async function ayarKaydet(degis){const a=Object.assign({},(S.v.ayar&&S.v.ayar.veri)||{},degis);
  const r=await sbFetch('saglik_ayar?on_conflict=kullanici_id',{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:JSON.stringify({veri:a,updated_at:new Date().toISOString()})});
  S.v.ayar=(Array.isArray(r)&&r[0])||{veri:a};}

// ───────────────────────────────────────── veri
const TABLOLAR={olcum:'saglik_olcum?select=*&order=zaman.asc',gunluk:'saglik_gunluk?select=*&order=tarih.asc',aktivite:'saglik_aktivite?select=*&order=baslangic.asc',
  atak:'saglik_atak?select=*&order=zaman.asc',ilac:'saglik_ilac?select=*&order=sira.asc,id.asc',alim:'saglik_ilac_alim?select=*&order=zaman.asc',
  tahlil:'saglik_tahlil?select=*&order=tarih.asc',randevu:'saglik_randevu?select=*&order=sira.asc,tarih.asc.nullslast,id.asc',giris:'saglik_giris?select=*&order=zaman.asc',
  sabah:'saglik_sabah?select=*&order=tarih.asc',claude:'saglik_claude?select=*&order=zaman.desc&limit=300',ayar:'saglik_ayar?select=*',
  ck:'checkinler?select=tarih,ruh,stres,kaygi,eglence,enerji,umut,uyku,kacirildi,etkenler,notu&order=tarih.asc'};
const SINIR={olcum:'zaman',aktivite:'baslangic',atak:'zaman',alim:'tarih',giris:'zaman',gunluk:'tarih'};
async function yukle(zorla){
  if(S.yukleniyor)return S.yukleniyor;if(S.yuklendi&&!zorla)return;
  const bas=gEkle(bugun(),-760);
  S.yukleniyor=(async()=>{
    const anah=Object.keys(TABLOLAR);
    const sonuc=await Promise.all(anah.map(k=>{let p=TABLOLAR[k];if(SINIR[k])p+='&'+SINIR[k]+'=gte.'+bas;
      const f=(typeof sbFetchAll==='function'&&k!=='claude'&&k!=='ayar')?sbFetchAll:sbFetch;return f(p).then(r=>Array.isArray(r)?r:[]).catch(e=>{console.warn('sağlık',k,e);return null;});}));
    anah.forEach((k,i)=>{if(sonuc[i]!=null)S.v[k]=sonuc[i];else if(!S.v[k])S.v[k]=[];});
    if(Array.isArray(S.v.ayar))S.v.ayar=S.v.ayar[0]||null;
    ckUykuBirlestir();S.yuklendi=true;
  })().finally(()=>{S.yukleniyor=null;});
  return S.yukleniyor;
}
// Akşam check-in'den "dün gece uyku" sorusu sabah formuna taşındı: ERP'nin check-in analizleri (uyku↔ruh) için sabah puanı aynı güne işlenir.
function ckUykuBirlestir(){try{const ck=(typeof PS!=='undefined'&&Array.isArray(PS.checkinler))?PS.checkinler:null;const sb={};(S.v.sabah||[]).forEach(r=>{if(r.uyku_kalite)sb[r.tarih]=r.uyku_kalite;});
  [ck,S.v.ck].forEach(L=>{if(L)L.forEach(c=>{if(!c.uyku&&sb[c.tarih])c.uyku=sb[c.tarih];});});}catch(e){}}
S.ckUykuBirlestir=ckUykuBirlestir;
async function ekle(k,tablo,row){const r=await sbFetch(tablo,{method:'POST',prefer:'return=representation',body:JSON.stringify(row)});const x=Array.isArray(r)?r:[];(S.v[k]=S.v[k]||[]).push(...x);return x[0];}
async function guncelle(k,tablo,id,p){const r=await sbFetch(tablo+'?id=eq.'+id,{method:'PATCH',prefer:'return=representation',body:JSON.stringify(p)});const x=Array.isArray(r)&&r[0];if(x){const L=S.v[k]||[];const i=L.findIndex(y=>y.id===id);if(i>=0)L[i]=x;}return x;}
async function sil(k,tablo,id){await sbFetch(tablo+'?id=eq.'+id,{method:'DELETE'});S.v[k]=(S.v[k]||[]).filter(y=>y.id!==id);}
async function upsert(k,tablo,row,cakisma,anahtar){const r=await sbFetch(tablo+'?on_conflict='+cakisma,{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:JSON.stringify(row)});
  const x=Array.isArray(r)&&r[0];if(x){const L=S.v[k]=S.v[k]||[];const i=L.findIndex(y=>anahtar(y)===anahtar(x));if(i>=0)L[i]=x;else L.push(x);}return x;}

// ───────────────────────────────────────── hesaplar
const olcumler=tur=>(S.v.olcum||[]).filter(o=>o.tur===tur);
const NABIZ_AN=[['dinlenme','Dinlenme','#00E676'],['gunluk','Gündelik','#00E5FF'],['hafif','Hafif aktivite','#FFAB00'],['agir','Ağır aktivite','#FF6D00'],['atak','Atak anı','#FF1744']];
const nabizAd=b=>(NABIZ_AN.find(x=>x[0]===b)||[0,b||'—'])[1],nabizRenk=b=>(NABIZ_AN.find(x=>x[0]===b)||[0,0,'var(--mg)'])[2];
// Dinlenik nabız: saatten gelen günlük değer, yoksa o gün elle girilen "Dinlenme" ölçümlerinin ortalaması
function dinlenikG(g){const r=gunluk(g);if(r&&r.nabiz_dinlenik)return Number(r.nabiz_dinlenik);const L=olcumler('nabiz').filter(o=>o.baglam==='dinlenme'&&zGun(o.zaman)===g).map(o=>Number(o.deger));return L.length?Math.round(ort(L)):null;}
const sonOlcum=tur=>{const L=olcumler(tur);return L[L.length-1]||null;};
const gunluk=g=>(S.v.gunluk||[]).find(r=>r.tarih===g)||null;
const sabahG=g=>(S.v.sabah||[]).find(r=>r.tarih===g&&!r.kacirildi)||null;
const girisG=(tur,g)=>(S.v.giris||[]).filter(r=>r.tur===tur&&zGun(r.zaman)===g);
const atakG=g=>(S.v.atak||[]).filter(a=>zGun(a.zaman)===g);
const ckG=g=>(S.v.ck||[]).find(c=>c.tarih===g&&!c.kacirildi&&c.ruh>0)||null;
const aktiviteler=()=>(S.v.aktivite||[]).filter(a=>!a.ikiz_id);
function kiloGun(){const m={};olcumler('kilo').forEach(o=>{m[zGun(o.zaman)]=Number(o.deger);});return m;}
function adimG(g){const r=gunluk(g);return r&&r.adim!=null?r.adim:null;}
function uykuSaatG(g){const r=gunluk(g);if(r&&r.uyku_dk)return r.uyku_dk/60;const s=sabahG(g);return s&&s.uyku_saat!=null?Number(s.uyku_saat):null;}
function kafeinG(g){const L=girisG('kafein',g);return {top:top(L.map(x=>x.miktar)),ac:top(L.filter(x=>x.ac).map(x=>x.miktar))};}
const suMl=x=>{const m=Number(x.miktar)||0;return m<50?m*200:m;};
function suG(g){return top(girisG('su',g).map(suMl));}
const litre=ml=>n1((ml||0)/1000,1)+' L';
function vki(kg){const b=(ayar().hedef.boy||0)/100;return b?kg/(b*b):null;}
function gunler(n,son){son=son||bugun();const L=[];for(let i=n-1;i>=0;i--)L.push(gEkle(son,-i));return L;}
function ilacPlan(g){const L=[];(S.v.ilac||[]).filter(i=>i.aktif&&i.tur!=='gerektiginde'&&(!i.baslangic||i.baslangic<=g)&&(!i.bitis||i.bitis>=g)).forEach(i=>(i.zamanlar||[]).forEach(d=>L.push({ilac:i,dilim:d})));
  const s={sabah:0,ogle:1,aksam:2};return L.sort((a,b)=>s[a.dilim]-s[b.dilim]||a.ilac.sira-b.ilac.sira);}
const alimBul=(ilacId,g,dilim)=>(S.v.alim||[]).find(a=>a.ilac_id===ilacId&&a.tarih===g&&a.dilim===dilim)||null;
const krizIlac=()=>(S.v.ilac||[]).find(i=>i.tur==='gerektiginde'&&i.aktif)||null;
const krizG=g=>{const k=krizIlac();return k?(S.v.alim||[]).filter(a=>a.ilac_id===k.id&&a.tarih===g&&a.dilim==='kriz'&&a.alindi):[];};
function ilacUyum(gunL){let p=0,a=0;gunL.forEach(g=>ilacPlan(g).forEach(x=>{p++;const r=alimBul(x.ilac.id,g,x.dilim);if(r&&r.alindi)a++;}));return p?a/p:null;}
function isaretIlac(){const id=ayar().isaretIlac;const p=id&&(S.v.ilac||[]).find(i=>i.id===id);return p&&p.baslangic?p:null;}
function sigaraGun(){const s=ayar().sigara;return s.birakis?gFark(s.birakis,bugun()):null;}
function haftaBas(g){const d=new Date(gTs(g));const w=(d.getDay()+6)%7;return gEkle(g,-w);}
function evHaftalar(n){const L=[];let h=haftaBas(bugun());for(let i=0;i<n;i++){const son=gEkle(h,6);const gunS=new Set(aktiviteler().filter(a=>a.tur==='ev'&&zGun(a.baslangic)>=h&&zGun(a.baslangic)<=son).map(a=>zGun(a.baslangic)));L.unshift({bas:h,gun:gunS.size});h=gEkle(h,-7);}return L;}
function evSeri(){const H=evHaftalar(52);const hedef=ayar().hedef.spor;let s=0;for(let i=H.length-1;i>=0;i--){if(i===H.length-1&&H[i].gun<hedef)continue;if(H[i].gun>=hedef)s++;else break;}return s;}
function formSeri(){let s=0;let g=sabahG(bugun())?bugun():gEkle(bugun(),-1);while(sabahG(g)){s++;g=gEkle(g,-1);}return s;}
function ilacSeri(){let s=0;let g=gEkle(bugun(),-1);for(let i=0;i<400;i++){const P=ilacPlan(g);if(!P.length)break;if(P.every(x=>{const r=alimBul(x.ilac.id,g,x.dilim);return r&&r.alindi;})){s++;g=gEkle(g,-1);}else break;}
  const P=ilacPlan(bugun());if(P.length&&P.every(x=>{const r=alimBul(x.ilac.id,bugun(),x.dilim);return r&&r.alindi;}))s++;return s;}
function aktiviteEsle(z){const t=new Date(z).getTime();return aktiviteler().find(a=>{const b=new Date(a.baslangic).getTime();const e=a.bitis?new Date(a.bitis).getTime():b+(a.sure_sn||1800)*1000;return t>=b-15*60000&&t<=e+60*60000;})||null;}
const tahminiAtak=a=>/^Geriye dönük tahmini/.test(a.notu||'');
function tahlilSeri(test){return (S.v.tahlil||[]).filter(t=>t.test===test&&t.deger!=null).sort((a,b)=>a.tarih<b.tarih?-1:1);}
function tahlilDurum(t){if(t.isaret)return t.isaret;if(t.deger==null)return 'normal';if(t.ref_ust!=null&&t.deger>t.ref_ust)return 'yuksek';if(t.ref_alt!=null&&t.deger<t.ref_alt)return 'dusuk';return 'normal';}
const DURUM_RENK={yuksek:'var(--red)',dusuk:'var(--amber)',sinir:'var(--amber)',normal:'var(--green)'};
const DURUM_IS={yuksek:'↑',dusuk:'↓',sinir:'≈',normal:''};
const ONEMLI_TEST=['HbA1c','Trigliserid','HDL','Ürik asit','ALT','B12','Glukoz','LDL','Folat','İnsülin (tokluk)'];

// ───────────────────────────────────────── grafikler (saf SVG, tema renkleriyle)
// ── Grafikler: ERP Özet grafiği diliyle (degrade alan, ince kesik ızgara, dokununca imleç + üstte değer)
const GW=340;S.gr={};let grNo=0;
function eksenTarih(bas,bit,n){const L=[];for(let i=0;i<n;i++){const t=bas+(bit-bas)*i/(n-1);L.push(t);}return L;}
function yAralik(deg,ek){let a=Math.min(...deg,...ek),b=Math.max(...deg,...ek);if(!isFinite(a)){a=0;b=1;}if(a===b){a-=1;b+=1;}const p=(b-a)*0.14;return [a-p,b+p];}
function tKisa(t){const d=new Date(t);return d.getDate()+' '+d.toLocaleDateString('tr-TR',{month:'short'});}
function tUzun(t){const d=new Date(t);return d.toLocaleDateString('tr-TR',{day:'numeric',month:'long',weekday:'short'});}
// Yumuşak eğri (monoton kübik): aşırı salınım yapmaz, veriyi olduğundan farklı göstermez
function egri(P){if(P.length<2)return '';if(P.length===2)return `M${P[0][0]},${P[0][1]}L${P[1][0]},${P[1][1]}`;
  const n=P.length,d=[],m=[];for(let i=0;i<n-1;i++){const dx=P[i+1][0]-P[i][0];d.push(dx?(P[i+1][1]-P[i][1])/dx:0);}
  m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
  let s=`M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for(let i=0;i<n-1;i++){const dx=(P[i+1][0]-P[i][0])/3;s+=`C${(P[i][0]+dx).toFixed(1)},${(P[i][1]+m[i]*dx).toFixed(1)} ${(P[i+1][0]-dx).toFixed(1)},${(P[i+1][1]-m[i+1]*dx).toFixed(1)} ${P[i+1][0].toFixed(1)},${P[i+1][1].toFixed(1)}`;}return s;}
function adimBul(r){const e=Math.pow(10,Math.floor(Math.log10(r||1)));const f=r/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e;}
function tikler(a,b,n){const st=adimBul((b-a)/n);const L=[];for(let v=Math.ceil(a/st)*st;v<=b+1e-9;v+=st)L.push(+v.toFixed(6));return L.filter(v=>v>a+(b-a)*0.04&&v<b-(b-a)*0.02);}
function rId(){return 'sgg'+(++grNo);}
// Başlık şeridi: soldaki büyük değer + sağda diğer seriler; dokunulan noktada güncellenir
function grBaslik(id,sol,sag,kk){return `<div class="sg-gb${kk?' kk':''}" id="${id}-b"><div class="sg-gb-sol">${sol}</div><div class="sg-gb-sag">${sag||''}</div></div>`;}
function vYaz(v,birim,d){return v==null?'—':n1(v,d==null?(Math.abs(v)<1000?1:0):d)+(birim?`<small> ${esc(birim)}</small>`:'');}
// hareketli ortalama (zamana göre): her nokta için son `gun` gündeki değerlerin ortalaması
function hareketli(P,gun){const w=gun*864e5;let j=0,t=0;return P.map((p,i)=>{t+=p[1];while(p[0]-P[j][0]>=w){t-=P[j][1];j++;}return [p[0],t/(i-j+1)];});}
function grafikCizgi(o){
  const H=o.h||150,PL=4,PR=30,PT=8,PB=18,W=GW;const bas=o.bas,bit=o.bit;
  const tum=[];o.seriler.forEach(s=>s.n.forEach(p=>tum.push(p[1])));
  if(!tum.length)return bosGrafik(o.bos);
  const dmin=Math.min(...tum),dmax=Math.max(...tum),pay=Math.max(1,(dmax-dmin)*0.35);
  const ek=[];(o.hedef||[]).forEach(h=>{if(h.v!=null&&(!o.yakin||(h.v>=dmin-pay&&h.v<=dmax+pay)))ek.push(h.v);});if(o.bant&&!o.yakin){if(o.bant[0]!=null)ek.push(o.bant[0]);if(o.bant[1]!=null)ek.push(o.bant[1]);}
  const [y0,y1]=o.y?o.y:yAralik(tum,ek);
  const X=t=>PL+(W-PL-PR)*(bit===bas?0.5:(t-bas)/(bit-bas)),Y=v=>PT+(H-PT-PB)*(1-(v-y0)/(y1-y0));
  const id=rId(),bir=o.birim||'';
  const SR=o.seriler.map(sr=>{const P=sr.n.slice().sort((a,b)=>a[0]-b[0]);return {sr,P,A:sr.trend&&P.length>2?hareketli(P,sr.trend):null};}).filter(x=>x.P.length);
  let s=`<svg class="sg-svg" id="${id}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs>`;
  SR.forEach((x,j)=>{s+=`<linearGradient id="${id}-g${j}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${x.sr.renk};stop-opacity:${j===0?0.22:0.10}"/><stop offset="1" style="stop-color:${x.sr.renk};stop-opacity:0.01"/></linearGradient>`;});
  s+='</defs>';
  if(o.bant){const a=Math.max(o.bant[0]??y0,y0),b=Math.min(o.bant[1]??y1,y1);if(b>a)s+=`<rect x="${PL}" y="${Y(b)}" width="${W-PL-PR}" height="${Y(a)-Y(b)}" style="fill:var(--green)" opacity="0.07"/>`;}
  tikler(y0,y1,3).forEach(v=>{s+=`<line x1="${PL}" x2="${W-PR}" y1="${Y(v)}" y2="${Y(v)}" class="sg-izg"/><text x="${W-PR+4}" y="${Y(v)+3}" class="sg-ax">${n1(v,2)}</text>`;});
  eksenTarih(bas,bit,3).forEach((t,i)=>{s+=`<text x="${X(t)}" y="${H-4}" class="sg-ax" text-anchor="${i===0?'start':i===2?'end':'middle'}">${tKisa(t)}</text>`;});
  if(o.bugunCizgi&&bit>Date.now()+864e5){const xb=X(Date.now());s+=`<line x1="${xb}" x2="${xb}" y1="${PT}" y2="${H-PB}" class="sg-izg" stroke-dasharray="1 2"/><text x="${xb+3}" y="${H-PB-3}" class="sg-ax">bugün</text>`;}
  (o.dikey||[]).forEach(d=>{if(d.t<bas||d.t>bit)return;s+=`<line x1="${X(d.t)}" x2="${X(d.t)}" y1="${PT}" y2="${H-PB}" style="stroke:${d.renk||'var(--amber)'}" stroke-dasharray="2 3" stroke-width="1" opacity="0.8"/><text x="${X(d.t)+3}" y="${PT+7}" class="sg-ax" style="fill:${d.renk||'var(--amber)'}">${esc(d.ad)}</text>`;});
  (o.hedef||[]).forEach(h=>{if(h.v==null||h.v<y0||h.v>y1)return;s+=`<line x1="${PL}" x2="${W-PR}" y1="${Y(h.v)}" y2="${Y(h.v)}" style="stroke:${h.renk||'var(--green)'}" stroke-dasharray="4 4" stroke-width="1" opacity="0.85"/><text x="${PL+2}" y="${Y(h.v)-3}" class="sg-ax" style="fill:${h.renk||'var(--green)'}">${esc(h.ad||'')}</text>`;});
  const veri=[];
  SR.forEach((x,j)=>{const sr=x.sr,P=x.P,A=x.A;const px=P.map(p=>[X(p[0]),Y(p[1])]);s+=`<g class="sg-sr" data-s="${j}" ${sr.gizli?'style="display:none"':''}>`;
    if(A){// ham değerler soluk, 7 günlük ortalama kalın eğri
      const pa=A.map(p=>[X(p[0]),Y(p[1])]);const yol=egri(pa);
      if(sr.alan!==false&&j<2)s+=`<path d="${yol}L${pa[pa.length-1][0].toFixed(1)},${H-PB}L${pa[0][0].toFixed(1)},${H-PB}Z" fill="url(#${id}-g${j})"/>`;
      if(P.length<=120)px.forEach((q,i)=>{s+=`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="1.7" style="fill:${P[i][2]||sr.renk}" opacity="0.45"/>`;});
      s+=`<path d="${yol}" fill="none" style="stroke:${sr.renk}" stroke-width="${sr.kalin||2.3}" stroke-linejoin="round" stroke-linecap="round"/>`;
      const son=pa[pa.length-1];s+=`<circle cx="${son[0].toFixed(1)}" cy="${son[1].toFixed(1)}" r="3" style="fill:${sr.renk}" stroke="var(--surface)" stroke-width="1.5"/>`;}
    else{
    if(sr.cizgi!==false&&P.length>1){const yol=P.length>12?egri(px):'M'+px.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join('L');
      if(sr.alan!==false&&!sr.kesik&&j<2&&P.length>12)s+=`<path d="${yol}L${px[px.length-1][0].toFixed(1)},${H-PB}L${px[0][0].toFixed(1)},${H-PB}Z" fill="url(#${id}-g${j})"/>`;
      s+=`<path d="${yol}" fill="none" style="stroke:${sr.renk}" stroke-width="${sr.kalin||1.8}" ${sr.kesik?'stroke-dasharray="4 3"':''} stroke-linejoin="round" stroke-linecap="round" ${sr.soluk?'opacity="0.55"':''}/>`;}
    const tekil=sr.cizgi===false||P.length<=12;
    if(sr.nokta!==false)P.forEach((p,i)=>{if(tekil||p[2])s+=`<circle cx="${px[i][0].toFixed(1)}" cy="${px[i][1].toFixed(1)}" r="${sr.r||(tekil?2.6:2)}" style="fill:${p[2]||sr.renk}"/>`;});
    const son=px[px.length-1];if(!tekil&&!sr.kesik)s+=`<circle cx="${son[0].toFixed(1)}" cy="${son[1].toFixed(1)}" r="3" style="fill:${sr.renk}" stroke="var(--surface)" stroke-width="1.5"/>`;}
    s+='</g>';
    veri.push({ad:sr.ad||'',renk:sr.renk,birim:sr.birim||bir,ara:!!sr.kesik,gizli:!!sr.gizli,trend:A?sr.trend:0,P:P.map((p,i)=>({t:p[0],v:p[1],x:px[i][0],y:A?Y(A[i][1]):px[i][1],o:A?A[i][1]:null,r:p[2]}))});});
  s+=`<g class="sg-imlec" style="display:none"><line y1="${PT}" y2="${H-PB}" class="sg-im-c"/>${veri.map(v=>`<circle r="3.6" style="fill:${v.renk}" stroke="var(--surface)" stroke-width="1.6"/>`).join('')}</g></svg>`;
  S.gr[id]={tip:'cizgi',W,PL,PR,veri,gun:o.gunluk!==false,kk:!!o.kompakt};
  const vs=grVarsayilan(S.gr[id]);
  const sec=SR.length>2;return grBaslik(id,vs[0],vs[1],o.kompakt)+s+(o.altYazi?`<div class="sg-alty">${o.altYazi}</div>`:'')+(sec?`<div class="sg-lej sg-lej-sec">${SR.map((x,j)=>x.sr.lejantYok?'':`<span class="${x.sr.gizli?'kapali':''}" onclick="SGL.serGoster('${id}',${j},this)"><i style="background:${x.sr.renk}"></i>${esc(x.sr.ad)}</span>`).join('')}${(o.lejantEk||[]).map(([r,a])=>`<span class="ek"><i style="background:${r}"></i>${esc(a)}</span>`).join('')}</div>`:lejant(o.seriler.filter(x=>x.ad&&!x.lejantYok).map(x=>[x.renk,x.ad]).concat(o.lejantEk||[]).concat(o.seriler.some(x=>x.trend)?[['var(--text3)','çizgi = 7 günlük ortalama, noktalar günlük']]:[])));
}
function grVarsayilan(G){if(G.tip==='cubuk'){const i=G.son;return grCubukYazi(G,i,true);}
  const V=G.veri.filter(v=>!v.gizli).map(v=>({v,p:v.P[v.P.length-1]}));if(!V.length)return ['',''];const t=V[0].p.t;return grCizgiYazi(G,V.map(x=>({v:x.v,p:x.v.P.filter(q=>q.t<=t).slice(-1)[0]||null})),t,true);}
function grCizgiYazi(G,V,t,ilk){const a=V[0];
  const sol=`<span class="sg-gb-t">${ilk?'Son · ':''}${G.gun?tUzun(t):tKisa(t)}</span><b style="color:${G.kk&&a.p&&a.p.r?a.p.r:'var(--text)'}">${a.p?vYaz(a.p.v,a.v.birim):'—'}</b>${a.p&&a.p.o!=null?`<span class="sg-gb-a">${a.v.trend} günlük ort. <b style="color:var(--text);margin-left:3px">${n1(a.p.o,Math.abs(a.p.o)<20?1:0)}</b></span>`:''}${a.v.ad&&V.length>1?`<span class="sg-gb-a"><i style="background:${a.v.renk}"></i>${esc(a.v.ad)}</span>`:''}`;
  const sag=V.slice(1).map(x=>`<div><i style="background:${x.v.renk}"></i>${esc(x.v.ad)} <b>${x.p?vYaz(x.p.o!=null?x.p.o:x.p.v,x.v.birim):'—'}</b>${x.p&&x.p.o!=null?' <small>ort.</small>':''}</div>`).join('');return [sol,sag];}
function grafikCubuk(o){
  const H=o.h||140,PL=4,PR=30,PT=8,PB=18,W=GW;const n=o.etiket.length;if(!n)return bosGrafik(o.bos);
  const toplamlar=o.etiket.map((_,i)=>o.yigin===false?Math.max(...o.seriler.map(s=>s.v[i]||0)):top(o.seriler.map(s=>s.v[i]||0)));
  const mx=Math.max(1,...toplamlar,...(o.hedef?[o.hedef.v*1.1]:[]))*1.08;if(!toplamlar.some(x=>x>0)&&!o.sifirGoster)return bosGrafik(o.bos);
  const bw=(W-PL-PR)/n,Y=v=>PT+(H-PT-PB)*(1-v/mx);const id=rId();
  let s=`<svg class="sg-svg" id="${id}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  tikler(0,mx,3).forEach(v=>{s+=`<line x1="${PL}" x2="${W-PR}" y1="${Y(v)}" y2="${Y(v)}" class="sg-izg"/><text x="${W-PR+4}" y="${Y(v)+3}" class="sg-ax">${n1(v,2)}</text>`;});
  s+=`<line x1="${PL}" x2="${W-PR}" y1="${H-PB}" y2="${H-PB}" class="sg-izg" stroke-dasharray="0"/>`;
  let sonDolu=n-1;for(let i=n-1;i>=0;i--){if(toplamlar[i]>0){sonDolu=i;break;}}
  const rr=Math.min(3,bw*0.25);
  o.etiket.forEach((et,i)=>{let y=H-PB;const x=PL+i*bw+bw*0.22,w=Math.max(1,bw*0.56);s+=`<g class="sg-cb" data-i="${i}">`;
    if(o.yigin===false){o.seriler.forEach((sr,j)=>{const v=sr.v[i]||0;if(!v)return;const ww=w/o.seriler.length;s+=`<rect x="${x+j*ww}" y="${Y(v)}" width="${Math.max(0.6,ww-0.6)}" height="${H-PB-Y(v)}" rx="${Math.min(rr,ww/3)}" style="fill:${sr.renk}"/>`;});}
    else{const dolu=o.seriler.map(sr=>sr.v[i]||0);const ustJ=dolu.reduce((a,v,j)=>v?j:a,-1);o.seriler.forEach((sr,j)=>{const v=sr.v[i]||0;if(!v)return;const h=(H-PT-PB)*v/mx;y-=h;s+=`<rect x="${x}" y="${y}" width="${w}" height="${h+(j===ustJ?0:0.4)}" rx="${j===ustJ?rr:0}" style="fill:${typeof sr.renk==='function'?sr.renk(v,i):sr.renk}"/>`;});}
    s+='</g>';
    const adim=Math.ceil(n/6);if(i%adim===0||i===n-1)s+=`<text x="${PL+i*bw+bw/2}" y="${H-4}" class="sg-ax" text-anchor="middle">${esc(et)}</text>`;});
  let ortL=null;if(o.ort&&n>=10){ortL=toplamlar.map((_,i)=>{const w=toplamlar.slice(Math.max(0,i-6),i+1).filter(v=>v>0);return w.length?top(w)/w.length:null;});
    const pa=ortL.map((v,i)=>v==null?null:[PL+i*bw+bw/2,Y(v)]).filter(Boolean);if(pa.length>1)s+=`<path d="${egri(pa)}" fill="none" style="stroke:${o.ortRenk||'var(--text)'}" stroke-width="2" opacity="0.85" stroke-linejoin="round" stroke-linecap="round"/>`;}
  if(o.hedef)s+=`<line x1="${PL}" x2="${W-PR}" y1="${Y(o.hedef.v)}" y2="${Y(o.hedef.v)}" style="stroke:var(--green)" stroke-dasharray="4 4" stroke-width="1" opacity="0.85"/><text x="${PL+2}" y="${Y(o.hedef.v)-3}" class="sg-ax" style="fill:var(--green)">${esc(o.hedef.ad||'hedef')}</text>`;
  s+=`<rect class="sg-im-k" x="0" y="${PT}" width="${bw}" height="${H-PT-PB}" style="display:none"/></svg>`;
  S.gr[id]={tip:'cubuk',W,PL,PR,bw,n,son:sonDolu,et:o.etiket,uzun:o.uzun||o.etiket,toplam:toplamlar,birim:o.birim||'',yigin:o.yigin!==false,
    seriler:o.seriler.map(sr=>({ad:sr.ad||'',renk:typeof sr.renk==='string'?sr.renk:null,v:sr.v})),hedef:o.hedef?o.hedef.v:null,ust:!!(o.hedef&&o.hedef.ust),ort:ortL,ana:o.ana||null,anaAd:o.anaAd||''};
  const vs=grVarsayilan(S.gr[id]);
  return grBaslik(id,vs[0],vs[1])+s+lejant(o.seriler.filter(x=>x.ad&&typeof x.renk==='string').map(x=>[x.renk,x.ad]).concat(ortL?[[o.ortRenk||'var(--text)','7 günlük ortalama']]:[]));
}
function grCubukYazi(G,i,ilk){const tek=G.seriler.length===1||!G.yigin;const T=G.yigin?G.toplam[i]:null;
  const ana=G.ana?G.ana[i]:tek&&G.seriler.length===1?G.seriler[0].v[i]:T;
  const sol=`<span class="sg-gb-t">${ilk?'Son · ':''}${esc(G.uzun[i])}</span><b>${vYaz(ana||0,G.birim,Math.abs(ana)>=100?0:1)}</b>${G.anaAd?`<span class="sg-gb-a">${G.anaAd}</span>`:''}${G.hedef&&ana!=null?(G.ust?`<span class="sg-gb-a" style="color:${ana<=G.hedef?'var(--green)':'var(--amber)'}">${ana<=G.hedef?'✓ sınır içinde':'+'+n1(ana-G.hedef,G.hedef<10?1:0)+' fazla'}</span>`:`<span class="sg-gb-a" style="color:${ana>=G.hedef?'var(--green)':'var(--text3)'}">${ana>=G.hedef?'✓ hedef':'hedefe '+n1(G.hedef-ana,G.hedef<10?1:0)}</span>`):''}`;
  const sag=(G.seriler.length>1?G.seriler.filter(sr=>sr.v[i]).map(sr=>`<div>${sr.renk?`<i style="background:${sr.renk}"></i>`:''}${esc(sr.ad)} <b>${n1(sr.v[i],sr.v[i]>=100?0:1)}</b></div>`).join(''):'')+(G.ort&&G.ort[i]!=null?`<div>7 gün ort. <b>${n1(G.ort[i],G.ort[i]>=100?0:1)}</b></div>`:'');return [sol,sag];}
// Dokunma / fare: en yakın noktaya imleç, üst şeritte değer
function grHareket(e){const sv=e.target.closest&&e.target.closest('svg.sg-svg');if(!sv)return;const G=S.gr[sv.id];if(!G||(G.tip!=='cizgi'&&G.tip!=='cubuk'))return;
  const r=sv.getBoundingClientRect();const cx=(e.touches?e.touches[0].clientX:e.clientX);const x=(cx-r.left)/r.width*G.W;const b=document.getElementById(sv.id+'-b');
  if(G.tip==='cizgi'){let enT=null,enD=1e9;G.veri.forEach(v=>!v.gizli&&v.P.forEach(p=>{const d=Math.abs(p.x-x);if(d<enD){enD=d;enT=p;}}));if(!enT)return;
    const V=G.veri.map(v=>{if(v.gizli)return {v,p:null,g:1};let q=null,qd=1e9;v.P.forEach(p=>{const d=Math.abs(p.x-enT.x);if(d<qd){qd=d;q=p;}});if(qd>Math.max(6,G.W*0.03)&&v.ara){for(let i=0;i<v.P.length-1;i++){const a=v.P[i],c=v.P[i+1];if(enT.x>=a.x&&enT.x<=c.x){const k=(enT.x-a.x)/((c.x-a.x)||1);return {v,p:{t:enT.t,v:a.v+(c.v-a.v)*k,x:enT.x,y:a.y+(c.y-a.y)*k}};}}}return {v,p:qd<=Math.max(6,G.W*0.03)?q:null};});
    const g=sv.querySelector('.sg-imlec');g.style.display='';const ln=g.querySelector('line');ln.setAttribute('x1',enT.x);ln.setAttribute('x2',enT.x);
    g.querySelectorAll('circle').forEach((c,j)=>{const p=V[j]&&V[j].p;c.style.display=p?'':'none';if(p){c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);}});
    if(b){const [sl,sg]=grCizgiYazi(G,V.filter(x=>!x.g),enT.t,false);b.children[0].innerHTML=sl;b.children[1].innerHTML=sg;}}
  else{const i=Math.max(0,Math.min(G.n-1,Math.floor((x-G.PL)/G.bw)));const k=sv.querySelector('.sg-im-k');k.style.display='';k.setAttribute('x',G.PL+i*G.bw);
    sv.classList.add('secili');sv.querySelectorAll('.sg-cb').forEach(c=>c.classList.toggle('on',+c.dataset.i===i));
    if(b){const [sl,sg]=grCubukYazi(G,i,false);b.children[0].innerHTML=sl;b.children[1].innerHTML=sg;}}}
function grBirak(e){const sv=e.target.closest&&e.target.closest('svg.sg-svg');if(!sv)return;const G=S.gr[sv.id];if(!G||(G.tip!=='cizgi'&&G.tip!=='cubuk'))return;
  const g=sv.querySelector('.sg-imlec');if(g)g.style.display='none';const k=sv.querySelector('.sg-im-k');if(k)k.style.display='none';sv.classList.remove('secili');
  sv.querySelectorAll('.sg-cb.on').forEach(c=>c.classList.remove('on'));const b=document.getElementById(sv.id+'-b');if(b){const [sl,sg]=grVarsayilan(G);b.children[0].innerHTML=sl;b.children[1].innerHTML=sg;}}
function grBagla(el){if(el.dataset.sgGr)return;el.dataset.sgGr='1';
  el.addEventListener('pointermove',grHareket);el.addEventListener('pointerdown',grHareket);
  el.addEventListener('pointerleave',grBirak,true);el.addEventListener('pointercancel',grBirak,true);
  el.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')setTimeout(()=>grBirak(e),1600);},true);}
function grafikNokta(o){ // ilişki grafiği: x↔y dağılımı + eğilim çizgisi
  const H=o.h||160,PL=4,PR=30,PT=10,PB=22,W=GW;const P=o.n.filter(p=>p[0]!=null&&p[1]!=null);if(P.length<3)return bosGrafik(o.bos||'İlişki için en az 3 ortak gün gerekiyor.');
  const [x0,x1]=yAralik(P.map(p=>p[0]),[]),[y0,y1]=yAralik(P.map(p=>p[1]),[]);const X=v=>PL+(W-PL-PR)*(v-x0)/(x1-x0),Y=v=>PT+(H-PT-PB)*(1-(v-y0)/(y1-y0));
  let s=`<svg class="sg-svg sg-nk" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  for(let i=0;i<3;i++){const v=y0+(y1-y0)*(i+0.5)/3;s+=`<line x1="${PL}" x2="${W-PR}" y1="${Y(v)}" y2="${Y(v)}" class="sg-izg"/><text x="${W-PR+4}" y="${Y(v)+3}" class="sg-ax">${n1(v)}</text>`;
    const xv=x0+(x1-x0)*(i+0.5)/3;s+=`<text x="${X(xv)}" y="${H-10}" class="sg-ax" text-anchor="middle">${n1(xv,0)}</text>`;}
  s+=`<text x="${W-PR}" y="${H-1}" class="sg-ax" text-anchor="end">${esc(o.xAd)} →</text><text x="${PL}" y="${PT-2}" class="sg-ax">↑ ${esc(o.yAd)}</text>`;
  const r=korelasyon(P);if(r){const mx=ort(P.map(p=>p[0])),my=ort(P.map(p=>p[1]));const b=top(P.map(p=>(p[0]-mx)*(p[1]-my)))/top(P.map(p=>(p[0]-mx)**2))||0;
    s+=`<line x1="${X(x0)}" y1="${Y(my+b*(x0-mx))}" x2="${X(x1)}" y2="${Y(my+b*(x1-mx))}" style="stroke:var(--mg)" stroke-dasharray="4 3" stroke-width="1.2" opacity="0.8"/>`;}
  P.forEach(p=>{s+=`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.4" style="fill:${o.renk||'var(--cy)'}" opacity="0.55" onclick="SGL.noktaGoster(this,'${esc(o.xAd)}','${esc(o.yAd)}',${p[0]},${p[1]})"/>`;});
  s+='</svg>';const rr=korelasyon(P);
  return `<div class="sg-gb"><div class="sg-gb-sol"><span class="sg-gb-t">İlişki gücü (−1…+1)</span><b>${rr==null?'—':n1(rr,2)}</b><span class="sg-gb-a">${rr==null?'':Math.abs(rr)<0.2?'belirgin ilişki yok':Math.abs(rr)<0.45?'zayıf':Math.abs(rr)<0.7?'orta':'güçlü'}</span></div><div class="sg-gb-sag" id="sg-nk-${grNo}"><div>${P.length} gün</div></div></div>`+s;
}
S.serGoster=(id,j,el)=>{const G=S.gr[id];if(!G)return;const v=G.veri[j];const acik=G.veri.filter(x=>!x.gizli).length;if(!v.gizli&&acik<=1)return;v.gizli=!v.gizli;el.classList.toggle('kapali',v.gizli);const g=document.querySelector(`#${id} .sg-sr[data-s="${j}"]`);if(g)g.style.display=v.gizli?'none':'';const b=document.getElementById(id+'-b');if(b){const [sl,sg]=grVarsayilan(G);b.children[0].innerHTML=sl;b.children[1].innerHTML=sg;}};
S.noktaGoster=(c,xa,ya,x,y)=>{const sv=c.closest('svg');sv.querySelectorAll('circle').forEach(z=>z.setAttribute('opacity',z===c?1:0.35));const b=sv.previousElementSibling&&sv.previousElementSibling.querySelector('.sg-gb-sag');if(b)b.innerHTML=`<div>${esc(xa)} <b>${n1(x)}</b></div><div>${esc(ya)} <b>${n1(y)}</b></div>`;};
function korelasyon(P){if(P.length<3)return null;const mx=ort(P.map(p=>p[0])),my=ort(P.map(p=>p[1]));const a=top(P.map(p=>(p[0]-mx)*(p[1]-my))),b=Math.sqrt(top(P.map(p=>(p[0]-mx)**2))*top(P.map(p=>(p[1]-my)**2)));return b?a/b:null;}
function halka(parca,orta,alt){const T=top(parca.map(p=>p.v));if(!T)return bosGrafik('Henüz veri yok.');const R=42,C=2*Math.PI*R;let o=0;
  let s=`<div class="sg-halka"><svg viewBox="0 0 110 110" width="118" height="118"><circle cx="55" cy="55" r="${R}" fill="none" stroke="var(--border)" stroke-width="12"/>`;
  parca.forEach(p=>{const L=C*p.v/T;s+=`<circle cx="55" cy="55" r="${R}" fill="none" stroke="${p.renk}" stroke-width="12" stroke-dasharray="${L} ${C-L}" stroke-dashoffset="${-o}" transform="rotate(-90 55 55)"/>`;o+=L;});
  s+=`<text x="55" y="54" text-anchor="middle" class="sg-halka-o">${esc(orta)}</text><text x="55" y="69" text-anchor="middle" class="sg-ax">${esc(alt||'')}</text></svg><div class="sg-halka-l">${parca.map(p=>`<div><i style="background:${p.renk}"></i>${esc(p.ad)} <b>${n1(p.v,0)} g</b> <small>%${n1(100*p.v/T,0)}</small></div>`).join('')}</div></div>`;return s;}
function isiHarita(M,satir,sutun){const mx=Math.max(1,...M.flat());let s='<div class="sg-isi">';
  s+=`<div class="sg-isi-r"><span></span>${sutun.map((c,j)=>`<b>${j%3===0?c:''}</b>`).join('')}</div>`;
  M.forEach((r,i)=>{s+=`<div class="sg-isi-r"><span>${satir[i]}</span>${r.map((v,j)=>`<i title="${satir[i]} ${sutun[j]}:00 · ${v}" style="background:${v?`rgba(232,25,122,${0.18+0.82*v/mx})`:'var(--surface2)'}"></i>`).join('')}</div>`;});return s+'</div>';}
function spark(deg,renk,hedef){const P=deg.map((v,i)=>[i,v]).filter(p=>p[1]!=null);if(P.length<2)return '<div class="sg-spark-bos"></div>';const v=P.map(p=>p[1]);let a=Math.min(...v),b=Math.max(...v);if(hedef!=null){a=Math.min(a,hedef);b=Math.max(b,hedef);}if(a===b){a-=1;b+=1;}
  const X=i=>2+94*i/(deg.length-1),Y=x=>25-21*(x-a)/(b-a);const px=P.map(p=>[X(p[0]),Y(p[1])]);const yol=egri(px);const id='sgs'+(++grNo);const son=px[px.length-1];
  return `<svg class="sg-spark" viewBox="0 0 100 28" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${renk};stop-opacity:.32"/><stop offset="1" style="stop-color:${renk};stop-opacity:0"/></linearGradient></defs>${hedef!=null?`<line x1="0" x2="100" y1="${Y(hedef)}" y2="${Y(hedef)}" style="stroke:var(--green)" stroke-dasharray="2 2" stroke-width="0.7" opacity=".8"/>`:''}<path d="${yol}L${son[0]},28L${px[0][0]},28Z" fill="url(#${id})"/><path d="${yol}" fill="none" style="stroke:${renk}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;}
function sparkCubuk(deg,renk,hedef){const mx=Math.max(1,...deg.map(x=>x||0),hedef||0)*1.05;const w=100/deg.length;return `<svg class="sg-spark" viewBox="0 0 100 28" preserveAspectRatio="none">${deg.map((v,i)=>`<rect x="${i*w+w*0.2}" y="${v?27-25*v/mx:26}" width="${w*0.6}" height="${v?25*v/mx:1}" rx="1" style="fill:${v?renk:'var(--border2)'}" opacity="${i===deg.length-1?1:0.45}"/>`).join('')}${hedef?`<line x1="0" x2="100" y1="${27-25*hedef/mx}" y2="${27-25*hedef/mx}" style="stroke:var(--green)" stroke-dasharray="2 2" stroke-width="0.7"/>`:''}</svg>`;}
function lejant(L){return L.length?`<div class="sg-lej">${L.map(([r,a])=>`<span><i style="background:${r}"></i>${esc(a)}</span>`).join('')}</div>`:'';}
function bosGrafik(m){return `<div class="sg-bos">${esc(m||'Bu aralıkta veri yok.')}</div>`;}
// Aralık: gün listesi; 90 günü aşınca haftalık kovalar
function aralikGunleri(){return gunler(S.aralik);}
function kovalar(){const G=aralikGunleri();if(S.aralik<=90)return G.map(g=>({bas:g,son:g,uz:tUzun(gTs(g)),et:S.aralik<=7?trGun(g):trK(g).replace(/\s.+/,'')+'.'+(new Date(gTs(g)).getMonth()+1)}));
  const L=[];for(let i=0;i<G.length;i+=7){const b=G[i],s=G[Math.min(G.length-1,i+6)];L.push({bas:b,son:s,et:trK(b),uz:trK(b)+' – '+trK(s)+' (gün ort.)'});}return L;}
function kovaTop(fn){return kovalar().map(k=>{let t=0;for(let g=k.bas;g<=k.son;g=gEkle(g,1))t+=fn(g)||0;return S.aralik>90?t/7:t;});}
function aralikSec(){const A=[[7,'Hafta'],[30,'Ay'],[90,'3 Ay'],[365,'Yıl']];return `<div class="sg-aralik gf-seg">${A.map(([v,a])=>`<button class="gf-seg-b${S.aralik===v?' on':''}" onclick="SGL.aralikAyarla(${v})">${a}</button>`).join('')}</div>`;}
S.aralikAyarla=v=>{S.aralik=v;ciz();};
const ARALIK_BAS=()=>gTs(gEkle(bugun(),-(S.aralik-1))),ARALIK_BIT=()=>Date.now();

// ───────────────────────────────────────── stil
function stilEkle(){if(document.getElementById('sg-stil'))return;const st=document.createElement('style');st.id='sg-stil';st.textContent=`
#page-saglik{padding:0 0 90px!important;max-width:100%;min-width:0;overflow-x:hidden}#page-saglik *{box-sizing:border-box}
.sg-ust{position:sticky;top:0;z-index:5;background:var(--bg);padding:8px 12px 6px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--border)}
.sg-sekmeler{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}.sg-sekmeler::-webkit-scrollbar{display:none}
.sg-sekmeler button{flex:0 0 auto;border:1px solid var(--border2);background:var(--surface);color:var(--text2);border-radius:999px;padding:7px 13px;font:600 12.5px var(--fu);white-space:nowrap}
.sg-sekmeler button.on{background:var(--mg);border-color:var(--mg);color:#fff}
.sg-arti{flex:0 0 auto;width:38px;height:38px;border-radius:50%;border:none;background:var(--mg);color:#fff;font-size:22px;line-height:1;box-shadow:var(--shadow-mg)}
.sg-ic{padding:12px;display:flex;flex-direction:column;gap:12px;max-width:980px;margin:0 auto}
.sg-izgara{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(min-width:760px){.sg-izgara{grid-template-columns:repeat(4,1fr)}.sg-izgara .tam{grid-column:span 2}}
.sg-izgara .tam{grid-column:1/-1}
.sg-kart{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;position:relative;cursor:pointer;min-width:0;display:flex;flex-direction:column;gap:6px}
.sg-kart:active{transform:scale(.99)}
.sg-kb{display:flex;justify-content:space-between;align-items:center;gap:6px;font:700 11.5px var(--fu);color:var(--text2);text-transform:uppercase;letter-spacing:.5px}
.sg-kb small{font-weight:500;text-transform:none;letter-spacing:0;color:var(--text3)}
.sg-buyuk{font:700 26px var(--fd);color:var(--text);line-height:1.05}.sg-buyuk small{font:500 12px var(--fu);color:var(--text3);margin-left:3px}
.sg-alt{font-size:12px;color:var(--text2);line-height:1.35}
.sg-dug{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.sg-harita{height:230px;border-radius:var(--r-md);overflow:hidden;background:var(--surface2);border:1px solid var(--border);z-index:0}.sg-harita .leaflet-control-attribution{font-size:9px;background:rgba(0,0,0,.45);color:#bbb}.sg-harita .leaflet-control-attribution a{color:#ddd}
.sg-istat{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.sg-istat div{background:var(--surface2);border-radius:10px;padding:8px}.sg-istat small{display:block;font-size:10.5px;color:var(--text3)}.sg-istat b{font:700 15px var(--fd);color:var(--text)}
.sg-acil{cursor:pointer}.sg-strava{font-size:10px;color:#FC4C02;margin-top:6px;font-weight:600}.sg-strava-a{color:#FC4C02!important;border-color:#FC4C02!important;text-decoration:none}.sg-st-alt{margin-top:10px;padding-top:8px;border-top:1px solid var(--border)}
.sg-fark{display:block;font-size:11px;font-weight:600;margin-top:2px}.sg-fark small{font-weight:500;color:var(--text3);font-size:10px}
.sg-alty{font-size:11.5px;color:var(--text2);line-height:1.45;margin-top:6px}.sg-alty b{color:var(--text)}
.sg-tk{display:grid;grid-template-columns:24px repeat(var(--sut),minmax(0,24px));gap:3px;align-items:center}.sg-tk-ay{margin-bottom:2px}.sg-tk-ay span{font-size:9px;color:var(--text3);white-space:nowrap;overflow:visible}.sg-tk-g{font-size:9px;color:var(--text3)}
.sg-tk i{aspect-ratio:1;border-radius:3px;background:var(--surface2);cursor:pointer}.sg-tk i.bos{background:none;cursor:default}.sg-tk i.bugun{outline:1.5px solid var(--text2);outline-offset:-1px}.sg-tk i.sec{outline:2px solid var(--text);outline-offset:0}
.sg-ks{display:flex;flex-direction:column;gap:9px}.sg-ks-l{display:flex;gap:14px;font-size:10.5px;color:var(--text3)}.sg-ks-l i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}
.sg-ks-s{display:grid;grid-template-columns:118px 1fr;gap:8px;align-items:center}.sg-ks-ad{font-size:12px;color:var(--text);line-height:1.25}.sg-ks-ad small{display:block;font-size:10.5px;color:var(--text3)}.sg-ks-ad small span{color:var(--border2)}
.sg-ks-c{position:relative;height:18px}.sg-ks-0{position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--border2)}.sg-ks-c i{position:absolute;top:5px;height:8px;border-radius:4px;min-width:2px}.sg-ks-c b{position:absolute;top:2px;font:700 10.5px var(--fu);white-space:nowrap}
.sg-serit{cursor:pointer}.sg-gunler button i.atk{background:var(--mg)}
.sg-ub{display:flex;flex-direction:column;gap:8px}.sg-ub-s{display:grid;grid-template-columns:96px 1fr;gap:2px 8px;align-items:center}.sg-ub-s .ad{grid-row:span 2;font-size:12px;color:var(--text)}.sg-ub-s .ad small{display:block;color:var(--text3);font-size:10.5px}
.sg-ub-s .ct{display:flex;align-items:center;gap:6px}.sg-ub-s .ct i{display:block;height:9px;border-radius:5px;background:var(--mg);min-width:2px}.sg-ub-s .ct b{font:600 11px var(--fu);white-space:nowrap}.sg-ub-s .md{font-size:11px;color:var(--text3)}.sg-ub-s .md b{color:var(--text2)}
.sg-puan-p{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px 12px;margin-top:4px}.sg-puan-p span{position:relative;display:flex;justify-content:space-between;font-size:11.5px;color:var(--text2);padding-bottom:5px}.sg-puan-p span i{position:absolute;left:0;bottom:0;height:3px;border-radius:2px}.sg-puan-p span::after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--surface2);z-index:-1;border-radius:2px}.sg-puan-p em{font-style:normal}.sg-puan-p b{color:var(--text)}
.sg-tablo{overflow-x:auto;margin-top:10px}.sg-tablo table{border-collapse:collapse;width:100%;font-size:11.5px}.sg-tablo th,.sg-tablo td{padding:5px 6px;text-align:right;border-bottom:1px solid var(--border);white-space:nowrap}.sg-tablo th{color:var(--text3);font-weight:600}.sg-tablo th:first-child,.sg-tablo td:first-child{text-align:left}
.sg-nok{display:inline-block;width:7px;height:7px;border-radius:50%;margin:0 3px 0 6px}.sg-prof{touch-action:pan-y}
.sg-dug button,.sg-btn{border:1px solid var(--border2);background:var(--surface2);color:var(--text);border-radius:999px;padding:6px 11px;font:600 12px var(--fu);cursor:pointer}
.sg-dug button.on,.sg-btn.on{background:var(--green-lt);border-color:var(--green);color:var(--green)}
.sg-dug button.kirmizi{border-color:var(--red);color:var(--red);background:var(--red-lt)}
.sg-btn.ana{background:var(--mg);border-color:var(--mg);color:#fff}
.sg-spark{width:100%;height:30px;display:block}.sg-spark-bos{height:30px}
.sg-bolum{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px}
.sg-bolum h4{margin:0 0 8px;font:700 13px var(--fu);color:var(--text);display:flex;justify-content:space-between;align-items:center;gap:8px}
.sg-bolum h4 small{font-weight:500;color:var(--text3)}
.sg-svg{width:100%;height:auto;display:block;overflow:visible;touch-action:pan-y;-webkit-user-select:none;user-select:none;cursor:crosshair}.sg-ax{font:9px var(--fu);fill:var(--text3)}
.sg-izg{stroke:var(--border2);stroke-width:.6;stroke-dasharray:2 3;opacity:.7}
.sg-im-c{stroke:var(--text3);stroke-width:1;stroke-dasharray:3 3}.sg-im-k{fill:var(--text);opacity:.05}
.sg-svg.secili .sg-cb{opacity:.35;transition:opacity .12s}.sg-svg.secili .sg-cb.on{opacity:1}
.sg-lej-sec span{cursor:pointer;padding:3px 9px;border-radius:999px;border:1px solid var(--border2);color:var(--text2)}.sg-lej-sec span.kapali{opacity:.4;border-style:dashed}.sg-lej-sec span.ek{border:none;cursor:default;padding:3px 0}
.sg-dk h2{font:700 17px var(--fu);margin:0}.sg-dk .dk-alt{font-size:12px;color:var(--text3);margin-bottom:4px}.sg-dk h3{font:700 12px var(--fu);color:var(--mg);text-transform:uppercase;letter-spacing:.5px;margin:14px 0 4px}.sg-dk ul,.sg-dk ol{margin:0;padding-left:18px;font-size:13px;line-height:1.5}.sg-dk table{width:100%;border-collapse:collapse;font-size:11.5px}.sg-dk th,.sg-dk td{text-align:left;padding:5px 4px;border-bottom:1px solid var(--border)}.sg-dk th{color:var(--text3);font-weight:600}
.sg-gb.kk{min-height:0;margin:2px 0 0}.sg-gb.kk .sg-gb-sol{flex-direction:row;align-items:baseline;gap:8px}.sg-gb.kk .sg-gb-sol b{font-size:13px;font-weight:600}
.sg-gb{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin:0 0 6px;min-height:44px}
.sg-gb-sol{display:flex;flex-direction:column;min-width:0}.sg-gb-t{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sg-gb-sol b{font:700 22px var(--fd);letter-spacing:-.5px;line-height:1.2;color:var(--text)}.sg-gb-sol b small{font:500 11px var(--fu);color:var(--text3);letter-spacing:0}
.sg-gb-a{font-size:11px;color:var(--text3);display:flex;align-items:center;gap:4px}.sg-gb-a i,.sg-gb-sag i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:3px}
.sg-gb-sag{text-align:right;font-size:11px;color:var(--text3);line-height:1.6}.sg-gb-sag b{color:var(--text);font-weight:600}.sg-gb-sag b small{font-size:10px;color:var(--text3);font-weight:500}
.sg-lej{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;font-size:10.5px;color:var(--text3)}.sg-lej i,.sg-halka-l i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:-1px}
.sg-bos{padding:22px 8px;text-align:center;color:var(--text3);font-size:12.5px}
.sg-not{font-size:11.5px;color:var(--text3);margin-top:4px;line-height:1.4}
.sg-aralik{align-self:flex-start}.sg-aralik .gf-seg-b{padding:7px 13px}
.sg-ozetler{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px}
.sg-oz{background:var(--surface2);border-radius:var(--r-sm);padding:8px 10px}.sg-oz span{display:block;font-size:10.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.4px}.sg-oz b{font:700 19px var(--fd);color:var(--text)}.sg-oz small{color:var(--text3);font-size:11px}
.sg-liste{display:flex;flex-direction:column}.sg-sat{display:flex;gap:10px;align-items:center;padding:9px 2px;border-bottom:1px solid var(--border);font-size:13px}.sg-sat:last-child{border-bottom:none}
.sg-sat .ana{flex:1;min-width:0}.sg-sat .ana small{display:block;color:var(--text3);font-size:11.5px;margin-top:2px}.sg-sat .sag{text-align:right;font:600 13px var(--fu);white-space:nowrap}
.sg-x{border:none;background:none;color:var(--text3);font-size:15px;padding:4px 6px;cursor:pointer}
.sg-halka{display:flex;gap:12px;align-items:center}.sg-halka-o{font:700 17px var(--fd);fill:var(--text)}.sg-halka-l{font-size:12px;display:flex;flex-direction:column;gap:5px;color:var(--text2)}.sg-halka-l b{color:var(--text)}
.sg-isi{display:flex;flex-direction:column;gap:2px;font-size:9px;color:var(--text3)}.sg-isi-r{display:grid;grid-template-columns:26px repeat(24,1fr);gap:2px;align-items:center}.sg-isi-r i{height:13px;border-radius:2px}.sg-isi-r b{font-weight:500;text-align:left}
.sg-gunler{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}.sg-gunler::-webkit-scrollbar{display:none}
.sg-gunler button{flex:0 0 auto;min-width:46px;border:1px solid var(--border2);background:var(--surface);color:var(--text2);border-radius:12px;padding:6px 4px;font:600 11px var(--fu);display:flex;flex-direction:column;align-items:center;gap:2px}
.sg-gunler button b{font:700 15px var(--fd);color:var(--text)}.sg-gunler button.on{border-color:var(--mg);background:var(--mg-lt)}.sg-gunler button i{width:6px;height:6px;border-radius:50%;background:transparent}.sg-gunler button i.var{background:var(--cy)}
.sg-takvim{display:grid;gap:3px;font-size:10px;color:var(--text3)}.sg-takvim .h{height:16px;border-radius:3px;background:var(--surface2)}.sg-takvim .h.ok{background:var(--green)}.sg-takvim .h.no{background:var(--red)}.sg-takvim .h.kis{background:var(--amber)}.sg-takvim .ad{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:var(--text2)}
.sg-ilac{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)}.sg-ilac:last-child{border:none}.sg-ilac .ad{flex:1;font-size:13px}.sg-ilac .ad small{display:block;color:var(--text3);font-size:11px}
.sg-tik{width:30px;height:30px;border-radius:50%;border:2px solid var(--border2);background:none;color:var(--text3);font-size:15px;flex:0 0 auto}.sg-tik.ok{border-color:var(--green);background:var(--green);color:#041}.sg-tik.no{border-color:var(--red);color:var(--red)}
.sg-chips{display:flex;flex-wrap:wrap;gap:6px}.sg-chips button{border:1px solid var(--border2);background:var(--surface2);color:var(--text2);border-radius:999px;padding:6px 11px;font:500 12.5px var(--fu)}.sg-chips button.on{border-color:var(--mg);background:var(--mg-lt);color:var(--text)}
.sg-puan{display:flex;gap:4px}.sg-puan button{flex:1;min-width:0;height:34px;border-radius:8px;border:1px solid var(--border2);background:var(--surface2);color:var(--text2);font:700 13px var(--fu)}.sg-puan button.on{color:#fff;border-color:transparent}
.sg-f{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}.sg-f>label{font:600 12.5px var(--fu);color:var(--text2)}.sg-f input,.sg-f select,.sg-f textarea{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid var(--border2);border-radius:var(--r-sm);background:var(--bg2);color:var(--text);font:14px var(--fu)}
.sg-f-ik{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.sg-f-iki{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sg-say{display:flex;align-items:center;gap:12px}.sg-say button{width:36px;height:36px;border-radius:50%;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-size:18px}.sg-say b{font:700 22px var(--fd);min-width:26px;text-align:center}
.sg-fb{font:700 12px var(--fu);color:var(--mg);text-transform:uppercase;letter-spacing:.6px;margin:14px 0 8px;border-top:1px solid var(--border);padding-top:12px}.sg-fb:first-child{border:none;padding-top:0;margin-top:0}
.sg-ek{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 7px;border-radius:999px;background:var(--surface2);color:var(--text2)}
.sg-duz{display:flex;align-items:center;gap:8px;padding:9px 4px;border-bottom:1px solid var(--border)}.sg-duz .ad{flex:1;font-size:13.5px}.sg-duz.kapali .ad{color:var(--text3);text-decoration:line-through}
.sg-duz button{border:1px solid var(--border2);background:var(--surface2);color:var(--text);border-radius:8px;width:32px;height:30px}
.sg-md{font-size:13.5px;line-height:1.55;color:var(--text)}.sg-md h1,.sg-md h2,.sg-md h3{font:700 14.5px var(--fu);margin:12px 0 6px}.sg-md ul{padding-left:18px;margin:4px 0}.sg-md p{margin:6px 0}
.sg-rozet{display:flex;flex-wrap:wrap;gap:6px}.sg-rozet span{font-size:12px;padding:5px 9px;border-radius:999px;background:var(--surface2);color:var(--text3);border:1px solid var(--border)}.sg-rozet span.ok{color:var(--text);border-color:var(--amber);background:var(--amber-lt)}
.sg-ilerleme{height:8px;border-radius:99px;background:var(--surface2);overflow:hidden}.sg-ilerleme i{display:block;height:100%;background:var(--grad-success);border-radius:99px}
.sg-kat{cursor:pointer;margin-bottom:0!important}.sg-bolum .sg-kat+*{margin-top:8px}.sg-tahlil{padding:9px 0;border-bottom:1px solid var(--border)}.sg-tahlil:last-child{border:none}.sg-tahlil .ust{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer}.sg-tahlil .ust .ad{flex:1}.sg-tahlil .ust .ad small{display:block;font-size:11px;color:var(--text3)}
`;document.head.appendChild(st);}

// ───────────────────────────────────────── çizim
const SEKMELER=[['ozet','Özet'],['aktivite','Aktivite'],['vucut','Vücut ve uyku'],['kalp','Kalp ve tansiyon'],['ruh','Ruh hali'],['ilac','İlaçlar'],['tahlil','Tahliller ve doktor'],['claude','Claude']];
function kapsayici(){return document.getElementById('page-saglik');}
async function ciz(){
  const el=kapsayici();if(!el)return;stilEkle();
  if(!S.yuklendi){el.innerHTML='<div class="sg-bos" style="padding:60px 0">Sağlık verileri yükleniyor…</div>';try{await yukle();}catch(e){el.innerHTML='<div class="sg-bos">Yüklenemedi: '+esc(e.message||e)+'</div>';return;}}
  S.gr={};const ic={ozet:ozetHtml,aktivite:aktiviteHtml,vucut:vucutHtml,kalp:kalpHtml,ruh:ruhHtml,ilac:ilacHtml,tahlil:tahlilHtml,claude:claudeHtml}[S.sekme]||ozetHtml;
  let govde='';try{govde=ic();}catch(e){console.error('sağlık çizim',e);govde='<div class="sg-bos">Bu bölüm çizilemedi: '+esc(e.message)+'</div>';}
  const kaydir=el.querySelector('.sg-sekmeler')?.scrollLeft||0;
  el.innerHTML=`<div class="sg-ust"><div class="sg-sekmeler">${SEKMELER.map(([k,a])=>`<button class="${S.sekme===k?'on':''}" onclick="SGL.git('${k}')">${a}</button>`).join('')}</div><button class="sg-arti" onclick="SGL.hizliMenu()" aria-label="Hızlı kayıt">＋</button></div><div class="sg-ic">${govde}</div>`;
  grBagla(el);if(S.sekme==='aktivite'&&S._haritaA)haritaCiz('sg-harita',S._haritaA);
  const gs=el.querySelector('#sg-gunler');if(gs){const on=gs.querySelector('.on');gs.scrollLeft=on?on.offsetLeft-gs.clientWidth+on.offsetWidth+40:gs.scrollWidth;}
  const sk=el.querySelector('.sg-sekmeler');if(sk){sk.scrollLeft=kaydir;const on=sk.querySelector('.on');if(on&&(on.offsetLeft<sk.scrollLeft||on.offsetLeft+on.offsetWidth>sk.scrollLeft+sk.clientWidth))sk.scrollLeft=on.offsetLeft-20;}
}
S.ciz=ciz;
S.git=(k,ek)=>{S.sekme=k;if(ek)Object.assign(S,ek);ciz();try{document.querySelector('.content')?.scrollTo(0,0);}catch(e){}};

// ───────────────────────────────────────── 2. tur grafikler: kıyas, takvim, şerit, puan, kalori dengesi
// Geçen haftaya göre fark rozeti. iyi: 1 = artış iyi, -1 = azalış iyi, 0 = nötr
function fark(bu,gecen,d,iyi,birim){if(bu==null||gecen==null||!isFinite(bu)||!isFinite(gecen))return '';const f=bu-gecen;const esik=d===0?0.5:Math.pow(10,-d)/2;
  if(Math.abs(f)<esik)return `<span class="sg-fark">= geçen haftayla aynı</span>`;
  const renk=!iyi?'var(--text3)':(f*iyi>0?'var(--green)':'var(--red)');return `<span class="sg-fark" style="color:${renk}">${f>0?'▲':'▼'} ${n1(Math.abs(f),d)}${birim||''} <small>geçen haftaya göre</small></span>`;}
const haftaOrt=(fn,kac)=>ort(gunler(7,gEkle(bugun(),-7*(kac||0))).map(fn));
const haftaTop=(fn,kac)=>top(gunler(7,gEkle(bugun(),-7*(kac||0))).map(fn));
function kiloAtG(g){let v=null;const km=kiloGun();Object.keys(km).sort().forEach(x=>{if(x<=g)v=km[x];});return v;}

// Takvim ısı haritası: sütun = hafta, satır = Pzt…Paz; dokununca üst şeritte o gün
function takvimIsi(o){const son=bugun();const n=Math.max(35,o.gun||S.aralik);let bas=haftaBas(gEkle(son,-(n-1)));const H=[];
  for(let h=bas;h<=son;h=gEkle(h,7))H.push(h);const D={};let mx=0;
  H.forEach(h=>{for(let i=0;i<7;i++){const g=gEkle(h,i);if(g>son)continue;const d=o.deger(g);D[g]=d;if(d&&d.v>mx)mx=d.v;}});
  const id=rId();S.gr[id]={tip:'takvim',D,et:o.et};
  let ay='<span></span>';let onceki='';H.forEach(h=>{const a=new Date(gTs(h)).toLocaleDateString('tr-TR',{month:'short'});ay+=`<span>${a!==onceki?a:''}</span>`;onceki=a;});
  let s=`<div class="sg-tk sg-tk-ay" style="--sut:${H.length}">${ay}</div><div class="sg-tk" style="--sut:${H.length}">`;
  ['Pzt','','Çar','','Cum','','Paz'].forEach((ad,i)=>{s+=`<span class="sg-tk-g">${ad}</span>`;H.forEach(h=>{const g=gEkle(h,i);if(g>son){s+='<i class="bos"></i>';return;}const d=D[g];const v=d?d.v:0;
    s+=`<i data-g="${g}" class="${g===son?'bugun':''}" style="${v?`background:${o.renk(v/(mx||1),d)}`:''}" onclick="SGL.takvimSec('${id}','${g}',this)"></i>`;});});
  s+='</div>';const sonD=D[son]||{v:0};
  return `<div class="sg-gb" id="${id}-b"><div class="sg-gb-sol"><span class="sg-gb-t">${tUzun(gTs(son))}</span><b>${o.et(sonD,son)}</b></div><div class="sg-gb-sag">${o.ozet||''}</div></div>${s}<div class="sg-lej"><span>az</span>${[0.2,0.45,0.7,1].map(x=>`<span><i style="background:${o.renk(x,{})};border-radius:2px"></i></span>`).join('')}<span>çok</span>${o.lejEk||''}</div>`;}
S.takvimSec=(id,g,el)=>{const G=S.gr[id];if(!G)return;const b=document.getElementById(id+'-b');el.parentNode.querySelectorAll('i.sec').forEach(x=>x.classList.remove('sec'));el.classList.add('sec');
  if(b)b.children[0].innerHTML=`<span class="sg-gb-t">${tUzun(gTs(g))}</span><b>${G.et(G.D[g]||{v:0},g)}</b>`;};

// Karşılaştırma çubukları (atak olan / olmayan günler)
function karsilastirma(satir,etA,etB){const R=satir.filter(r=>r.a!=null&&r.b!=null);if(!R.length)return bosGrafik('Karşılaştırma için atak olan ve olmayan günlerde veri gerekiyor.');
  // her satır: ortada 0 çizgisi; atak olan günlerde daha kötüyse sağa pembe, daha iyiyse sola yeşil (fark %, en fazla ±50)
  return `<div class="sg-ks"><div class="sg-ks-l"><span>◀ ${esc(etA)} daha iyi</span><span style="margin-left:auto">${esc(etA)} daha kötü ▶</span></div>${R.map(r=>{const fk=r.b?(r.a-r.b)/Math.abs(r.b):0;const kotu=r.kotu?fk*r.kotu>0:null;
    const w=Math.min(50,Math.abs(fk)*100);const renk=kotu==null?'var(--text3)':kotu?'var(--mg)':'var(--green)';const sag=kotu==null?fk>0:kotu;
    return `<div class="sg-ks-s"><div class="sg-ks-ad">${esc(r.ad)}<small>${n1(r.a,r.d)}${r.bir||''} <span>↔</span> ${n1(r.b,r.d)}${r.bir||''}</small></div><div class="sg-ks-c"><span class="sg-ks-0"></span><i style="${sag?'left:50%':'right:50%'};width:${w}%;background:${renk}"></i><b style="${sag?'left:calc(50% + '+w+'% + 4px)':'right:calc(50% + '+w+'% + 4px)'};color:${Math.abs(fk)>=0.15?renk:'var(--text3)'}">${Math.round(fk*100)>0?'+':''}${Math.round(fk*100)}%</b></div></div>`;}).join('')}</div>`;}

// Günün şeridi: 24 saatlik tek çizgide ataklar, kahve/öğün, ilaç, aktivite, ölçüm
function seritOlaylar(g){const E=[];const ic=z=>zGun(z)===g;const dk=z=>{const d=new Date(z);return d.getHours()*60+d.getMinutes();};
  (S.v.atak||[]).filter(a=>ic(a.zaman)).forEach(a=>E.push({s:0,b:dk(a.zaman),e:dk(a.zaman)+Math.max(10,a.sure_dk||10),renk:'var(--mg)',ad:'⚡ Atak'+(a.siddet?' · şiddet '+a.siddet:'')+(a.sure_dk?' · '+a.sure_dk+' dk':'')+(tahminiAtak(a)?' · tahmini saat':''),z:a.zaman,tur:'atak'}));
  (S.v.giris||[]).filter(x=>ic(x.zaman)&&(x.tur==='kafein'||x.tur==='ogun')).forEach(x=>E.push({s:1,b:dk(x.zaman),renk:x.tur==='kafein'?(x.ac?'var(--red)':'#A1887F'):'var(--amber)',ad:x.tur==='kafein'?'☕ '+(x.alt||'Kahve')+(x.ac?' · aç karnına':''):'🍽️ '+({kahvalti:'Kahvaltı',ogle:'Öğle',aksam:'Akşam',ara:'Ara öğün'}[x.alt]||'Öğün')+(x.miktar>1?' · '+n1(x.miktar,0)+' kcal':''),z:x.zaman,tur:x.tur,ac:x.ac}));
  (S.v.giris||[]).filter(x=>ic(x.zaman)&&x.tur==='su').forEach(x=>E.push({s:1,b:dk(x.zaman),renk:'var(--cy)',ad:'💧 Su',z:x.zaman,tur:'su',kucuk:1}));
  (S.v.alim||[]).filter(a=>a.alindi&&a.tarih===g&&a.zaman&&ic(a.zaman)).forEach(a=>{const i=(S.v.ilac||[]).find(x=>x.id===a.ilac_id);E.push({s:2,b:dk(a.zaman),renk:a.dilim==='kriz'?'var(--red)':'var(--green)',ad:'💊 '+(i?i.ad:'İlaç')+(a.secim?' ('+a.secim+')':''),z:a.zaman,tur:'ilac'});});
  aktiviteler().filter(a=>ic(a.baslangic)).forEach(a=>{const b=dk(a.baslangic);E.push({s:3,b,e:Math.min(1440,b+Math.max(10,(a.sure_sn||1800)/60)),renk:TUR_RENK[a.tur]||'var(--cy)',ad:(TUR_AD[a.tur]||a.tur)+(a.sure_sn?' · '+Math.round(a.sure_sn/60)+' dk':'')+(a.mesafe_m?' · '+n1(a.mesafe_m/1000,1)+' km':''),z:a.baslangic,tur:'aktivite'});});
  (S.v.olcum||[]).filter(o=>ic(o.zaman)&&['tansiyon','kilo'].includes(o.tur)).forEach(o=>E.push({s:4,b:dk(o.zaman),renk:'var(--purple)',ad:o.tur==='kilo'?'⚖️ '+n1(o.deger)+' kg':'🩺 '+o.deger+'/'+o.deger2+(o.deger3?' · '+o.deger3+' bpm':''),z:o.zaman,tur:o.tur}));
  return E.sort((a,b)=>a.b-b.b);}
function seritHtml(g){const E=seritOlaylar(g);const W=GW,PL=58,PR=6,PT=6,SH=24,H=PT+5*SH+16;const X=m=>PL+(W-PL-PR)*m/1440;const id=rId();
  const SAT=['⚡ Atak','☕ Kahve/öğün','💊 İlaç','🏃 Hareket','🩺 Ölçüm'];
  let s=`<svg class="sg-svg sg-serit" id="${id}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  SAT.forEach((a,i)=>{const y=PT+i*SH;s+=`<rect x="${PL}" y="${y+3}" width="${W-PL-PR}" height="${SH-6}" rx="4" style="fill:var(--surface2)" opacity="0.6"/><text x="2" y="${y+SH/2+3}" class="sg-ax" style="font-size:9.5px">${a}</text>`;});
  [0,6,12,18,24].forEach(h=>{s+=`<line x1="${X(h*60)}" x2="${X(h*60)}" y1="${PT}" y2="${PT+5*SH}" class="sg-izg"/><text x="${X(h*60)}" y="${H-3}" class="sg-ax" text-anchor="${h===0?'start':h===24?'end':'middle'}">${pad(h%24===0&&h?24:h)}:00</text>`;});
  if(g===bugun()){const d=new Date();const m=d.getHours()*60+d.getMinutes();s+=`<line x1="${X(m)}" x2="${X(m)}" y1="${PT}" y2="${PT+5*SH}" style="stroke:var(--text2)" stroke-width="1" stroke-dasharray="2 2"/>`;}
  E.forEach((e,k)=>{const y=PT+e.s*SH+SH/2;const t=`onclick="SGL.seritSec('${id}',${k})"`;
    if(e.e!=null)s+=`<rect x="${X(e.b)}" y="${y-6}" width="${Math.max(4,X(e.e)-X(e.b))}" height="12" rx="3" style="fill:${e.renk}" ${t}/>`;
    else s+=`<circle cx="${X(e.b)}" cy="${y}" r="${e.kucuk?3:5}" style="fill:${e.renk}" stroke="var(--surface)" stroke-width="1.2" ${t}/>`;});
  s+='</svg>';S.gr[id]={tip:'serit',E};
  // ataklardan önce ne vardı
  const notlar=E.filter(e=>e.tur==='atak').map(a=>{const once=t=>E.filter(e=>e.tur===t&&e.b<=a.b).slice(-1)[0];const ara=e=>{const m=a.b-e.b;return m<60?m+' dk':Math.floor(m/60)+' sa '+(m%60?m%60+' dk':'');};
    const kh=once('kafein'),og=once('ogun'),il=once('ilac'),ak=E.filter(e=>e.tur==='aktivite'&&e.b<=a.b&&a.b<=e.e+60).slice(-1)[0];
    const L=[kh?'☕ '+(kh.ac?'aç kahveden ':'kahveden ')+ara(kh)+' sonra':'☕ öncesinde kahve yok',og?'🍽️ son öğünden '+ara(og)+' sonra':'🍽️ öncesinde öğün kaydı yok',ak?'🏃 hareket sırasında/sonrasında':'',il?'💊 son ilaçtan '+ara(il)+' sonra':''].filter(Boolean);
    return `<div class="sg-sat"><div class="ana"><b style="color:var(--mg)">⚡ ${pad(Math.floor(a.b/60))}:${pad(a.b%60)}</b> ${esc(a.ad.replace('⚡ Atak','').replace(/^ · /,''))}<small>${L.map(esc).join(' · ')}</small></div></div>`;}).join('');
  const r=gunluk(g),u=uykuSaatG(g),sb=sabahG(g);
  const ust=[u!=null?'😴 '+n1(u,1)+' sa uyku':null,sb&&sb.uyku_kalite?'kalite '+sb.uyku_kalite+'/10':null,r&&r.adim?'👣 '+n1(r.adim,0):null,ckG(g)?'🧠 mod '+ckG(g).ruh+' · stres '+ckG(g).stres:null].filter(Boolean).join(' · ');
  return `<div class="sg-gb kk" id="${id}-b"><div class="sg-gb-sol"><span class="sg-gb-t">${tUzun(gTs(g))}</span><b>${E.length?E.length+' olay':'Kayıt yok'}</b></div><div class="sg-gb-sag"></div></div>${s}<div class="sg-not">${esc(ust)||'Bu gün için özet veri yok.'}</div>${notlar?`<div class="sg-liste" style="margin-top:4px">${notlar}</div>`:''}`;}
S.seritSec=(id,k)=>{const G=S.gr[id];if(!G)return;const e=G.E[k];const b=document.getElementById(id+'-b');if(b){b.children[0].innerHTML=`<span class="sg-gb-t">${saat(e.z)}</span><b>${esc(e.ad)}</b>`;}};
S.seritGun=g=>{S.sgun=g;ciz();};

// Haftalık sağlık puanı (0–100): uyku, adım, spor, ilaç, atak, su
function haftaPuan(h){const H=ayar().hedef;const son=gEkle(h,6)>bugun()?bugun():gEkle(h,6);const G=[];for(let g=h;g<=son;g=gEkle(g,1))G.push(g);const kap=x=>Math.max(0,Math.min(1,x));
  const P={};const uy=ort(G.map(uykuSaatG));if(uy!=null)P.uyku=kap(uy/H.uyku);
  const ad=ort(G.map(adimG));if(ad!=null)P.adim=kap(ad/H.adim);
  const spor=new Set(aktiviteler().filter(a=>zGun(a.baslangic)>=h&&zGun(a.baslangic)<=son&&(a.tur==='ev'||(a.sure_sn||0)>=1200)).map(a=>zGun(a.baslangic))).size;P.spor=kap(spor/(H.spor*G.length/7));
  const il=ilacUyum(G);if(il!=null)P.ilac=il;
  const at=top(G.map(g=>atakG(g).length));const kayit=G.some(g=>sabahG(g)||ckG(g)||atakG(g).length);if(kayit)P.atak=1/(1+at/G.length);
  const su=G.map(suG);if(su.some(v=>v>0))P.su=kap(ort(su)/H.su);
  const k=Object.keys(P);return {puan:k.length?Math.round(100*ort(k.map(x=>P[x]))):null,P,gun:G.length};}
const PUAN_AD={uyku:'😴 Uyku',adim:'👣 Adım',spor:'🏋️ Spor',ilac:'💊 İlaç',atak:'⚡ Ataksızlık',su:'💧 Su'};
function puanRenk(p){return p==null?'var(--text3)':p>=75?'var(--green)':p>=55?'var(--amber)':'var(--red)';}
function haftaPuanHtml(){const HB=[];let h=haftaBas(bugun());for(let i=0;i<12;i++){HB.unshift(h);h=gEkle(h,-7);}const R=HB.map(haftaPuan);const bu=R[R.length-1],once=R[R.length-2];if(bu.puan==null&&once.puan==null)return '';
  return `<div class="sg-kart tam sg-puan-k" onclick="SGL.puanAc()"><div class="sg-kb">🏅 Haftalık sağlık puanı <small>bu hafta · ${bu.gun} gün</small></div>
    <div style="display:flex;align-items:flex-end;gap:12px"><div class="sg-buyuk" style="font-size:38px;color:${puanRenk(bu.puan)}">${bu.puan??'—'}<small>/100</small></div><div style="padding-bottom:6px;flex:1">${fark(bu.puan,once.puan,0,1)}</div><div style="width:110px">${sparkCubuk(R.map(r=>r.puan||0),'var(--green)')}</div></div>
    <div class="sg-puan-p">${Object.keys(PUAN_AD).filter(k=>bu.P[k]!=null).map(k=>`<span><i style="width:${Math.round(100*bu.P[k])}%;background:${puanRenk(100*bu.P[k])}"></i><em>${PUAN_AD[k]}</em><b>${Math.round(100*bu.P[k])}</b></span>`).join('')}</div></div>`;}
S.puanAc=()=>{const HB=[];let h=haftaBas(bugun());for(let i=0;i<12;i++){HB.unshift(h);h=gEkle(h,-7);}const R=HB.map(haftaPuan);
  pencere('sg-m-puan','🏅 Haftalık sağlık puanı',`${grafikCubuk({etiket:HB.map(trK),uzun:HB.map((x,i)=>trK(x)+' haftası'+(i===HB.length-1?' (sürüyor)':'')),seriler:[{ad:'Puan',renk:v=>puanRenk(v),v:R.map(r=>r.puan||0)}],h:130})}
    <div class="sg-liste" style="margin-top:8px">${Object.keys(PUAN_AD).map(k=>`<div class="sg-sat"><div class="ana">${PUAN_AD[k]}<small>${{uyku:'ortalama uyku / '+ayar().hedef.uyku+' sa hedef',adim:'ortalama adım / '+n1(ayar().hedef.adim,0)+' hedef',spor:'spor yapılan gün / haftada '+ayar().hedef.spor,ilac:'alınan / planlanan doz',atak:'günde atak azaldıkça artar',su:'ortalama su / '+n1(ayar().hedef.su/1000,1)+' L'}[k]}</small></div>${R.slice(-4).map(r=>`<div class="sag" style="min-width:34px;color:${r.P[k]!=null?puanRenk(100*r.P[k]):'var(--text3)'}">${r.P[k]!=null?Math.round(100*r.P[k]):'—'}</div>`).join('')}</div>`).join('')}</div>
    <div class="sg-not">Sağdaki dört sütun son dört hafta (en sağdaki bu hafta). Puan, verisi olan alanların ortalamasıdır; veri girilmeyen alan puanı düşürmez.</div>`);
  setTimeout(()=>grBagla(document.getElementById('sg-m-puan')),50);};


// ── Özet: panel kartları
function ozetHtml(){
  const A=ayar();
  if(S.duzenle){const sira=A.paneller.concat(Object.keys(PANELLER).filter(p=>!A.paneller.includes(p)));
    return `<div class="sg-bolum"><h4>Ana sayfayı düzenle <button class="sg-btn ana" onclick="SGL.duzenleBitir()">Bitti</button></h4><div class="sg-not" style="margin-bottom:6px">Göz ile paneli aç/kapat, oklarla sırala.</div>${sira.map((p,i)=>{const on=A.paneller.includes(p);
      return `<div class="sg-duz ${on?'':'kapali'}"><button onclick="SGL.panelGoster('${p}')">${on?'👁':'○'}</button><span class="ad">${esc(PANELLER[p].ad)}</span>${on?`<button onclick="SGL.panelTasi('${p}',-1)">↑</button><button onclick="SGL.panelTasi('${p}',1)">↓</button>`:''}</div>`;}).join('')}</div>`;}
  const kartlar=A.paneller.map(p=>{try{return panelHtml(p);}catch(e){console.warn('panel',p,e);return '';}}).join('');
  return `<div class="sg-izgara">${haftaPuanHtml()}${kartlar}</div><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="sg-btn" onclick="SGL.duzenleAc()">✏️ Ana sayfayı düzenle</button><button class="sg-btn" onclick="SGL.hedefAc()">🎯 Hedefler</button><button class="sg-btn" onclick="SGL.hatirlatAc()">🔔 Hatırlatmalar</button></div><div class="sg-bolum"><h4>⌚ Saat <small>Health Connect</small></h4><div id="sg-hc">${hcKartHtml()}</div></div><div class="sg-bolum"><h4>🗺️ Strava <small>yürüyüş, koşu, bisiklet, trekking</small></h4><div id="sg-st">${stKartHtml()}</div></div>`;
}
S.duzenleAc=()=>{S.duzenle=true;ciz();};S.duzenleBitir=()=>{S.duzenle=false;ciz();};
S.panelGoster=async p=>{const A=ayar();let L=A.paneller.slice();if(L.includes(p))L=L.filter(x=>x!==p);else L.push(p);S.v.ayar={veri:Object.assign({},(S.v.ayar||{}).veri,{paneller:L})};ciz();try{await ayarKaydet({paneller:L});}catch(e){toast('Kaydedilemedi','red');}};
S.panelTasi=async(p,d)=>{const L=ayar().paneller.slice();const i=L.indexOf(p),j=i+d;if(i<0||j<0||j>=L.length)return;[L[i],L[j]]=[L[j],L[i]];S.v.ayar={veri:Object.assign({},(S.v.ayar||{}).veri,{paneller:L})};ciz();try{await ayarKaydet({paneller:L});}catch(e){toast('Kaydedilemedi','red');}};
function kart(p,ic,dug){const P=PANELLER[p];return `<div class="sg-kart ${P.boy}" onclick="SGL.git('${P.sekme}')"><div class="sg-kb">${esc(P.ad)}</div>${ic}${dug?`<div class="sg-dug" onclick="event.stopPropagation()">${dug}</div>`:''}</div>`;}
function panelHtml(p){
  const g=bugun(),A=ayar(),H=A.hedef,G7=gunler(7);
  switch(p){
  case 'sabah':{const s=sabahG(g);const h=new Date().getHours();
    if(s)return kart(p,`<div class="sg-alt">✓ Bugün dolduruldu · uyku ${s.uyku_kalite||'—'}/10 · uyanış ${s.uyanis||'—'}/5${s.kilo?' · '+n1(s.kilo)+' kg':''}${s.tansiyon_b?' · '+s.tansiyon_b+'/'+s.tansiyon_k:''}</div><div class="sg-alt" style="color:var(--text3)">Seri: ${formSeri()} gün</div>`,`<button onclick="SGL.sabahAc(true)">Düzenle</button>`);
    return kart(p,`<div class="sg-alt">${h<9?'09:00\'da hatırlatırım.':'Henüz doldurulmadı.'} Uyku, kahvaltı, kahve, sabah ilaçları, tartı ve tansiyon.</div>`,`<button class="on" onclick="SGL.sabahAc()">☀️ Şimdi doldur</button>`);}
  case 'ruh':{const at=atakG(g);const son=(S.v.atak||[]).slice(-1)[0];const c=ckG(g)||ckG(gEkle(g,-1));const at7=G7.map(x=>atakG(x).length);
    return kart(p,`<div style="display:flex;gap:14px;align-items:flex-end"><div><div class="sg-buyuk" style="color:${at.length?'var(--mg)':'var(--text)'}">${at.length}<small>atak bugün</small></div><div class="sg-alt">${son?'Son: '+trT(zGun(son.zaman))+' '+saat(son.zaman)+(son.siddet?' · şiddet '+son.siddet:''):'Kayıt yok'}</div>${fark(haftaTop(x=>atakG(x).length),haftaTop(x=>atakG(x).length,1),0,-1,' atak')}</div><div style="flex:1">${sparkCubuk(at7,'var(--mg)')}</div></div>
      <div class="sg-ozetler" style="grid-template-columns:repeat(4,1fr)"><div class="sg-oz"><span>Mod</span><b>${c?c.ruh:'—'}</b><small>/10</small></div><div class="sg-oz"><span>Stres</span><b>${c?c.stres:'—'}</b><small>/10</small></div><div class="sg-oz"><span>Mutluluk</span><b>${c?c.eglence:'—'}</b><small>/10</small></div><div class="sg-oz"><span>Kaygı</span><b>${c?c.kaygi:'—'}</b><small>/10</small></div></div>`,
      `<button class="kirmizi" onclick="SGL.atakAc()">⚡ Atak kaydet</button><button onclick="SGL.checkinAc()">🧠 Check-in</button>${krizIlac()?`<button onclick="SGL.krizEkle()">💊 ${esc(krizIlac().ad.split(' ')[0])} ${krizG(g).length}/${krizIlac().max_gunluk||2}</button>`:''}`);}
  case 'ilac':{const P=ilacPlan(g);const uy=ilacUyum(gunler(7,gEkle(g,-1)));
    const sat=P.map(x=>{const r=alimBul(x.ilac.id,g,x.dilim);const ok=r&&r.alindi;return `<button class="${ok?'on':r?'kirmizi':''}" onclick="SGL.ilacTik(${x.ilac.id},'${x.dilim}')">${ok?'✓':r?'✕':'○'} ${x.dilim==='sabah'?'☀️':x.dilim==='aksam'?'🌙':'🕛'} ${esc(x.ilac.ad.split(' ')[0])}${x.ilac.tur==='takviye'&&r&&r.secim?' ('+esc(r.secim)+')':''}</button>`;}).join('');
    return kart(p,`<div class="sg-alt">${P.length?P.filter(x=>{const r=alimBul(x.ilac.id,g,x.dilim);return r&&r.alindi;}).length+'/'+P.length+' alındı bugün':'İlaç listesi boş.'}${uy!=null?' · son 7 gün uyum %'+n1(uy*100,0):''} · seri ${ilacSeri()} gün</div>`,sat+(krizIlac()?`<button onclick="SGL.krizEkle()">⚠️ Kriz ${krizG(g).length}/${krizIlac().max_gunluk||2}</button>`:''));}
  case 'adim':{const a=adimG(g);const d=G7.map(adimG);const mes=gunluk(g)?.mesafe_m;
    return kart(p,`<div class="sg-buyuk">${a!=null?n1(a,0):'—'}<small>/ ${n1(H.adim,0)}</small></div><div class="sg-alt">${mes?n1(mes/1000,1)+' km · ':''}${gunluk(g)?.aktif_kcal?n1(gunluk(g).aktif_kcal,0)+' kcal':'Saatten gelecek'}</div>${fark(haftaOrt(adimG),haftaOrt(adimG,1),0,1)}${sparkCubuk(d,'var(--cy)',H.adim)}`,`<button onclick="SGL.adimAc()">＋ Adım</button>`);}
  case 'kilo':{const s=sonOlcum('kilo');const L=olcumler('kilo');const ilk=L[0];
    let hiz='';if(L.length>1){const once=L.filter(o=>new Date(o.zaman)<=new Date(Date.now()-7*864e5)).slice(-1)[0]||L[0];const gun=Math.max(1,(new Date(s.zaman)-new Date(once.zaman))/864e5);hiz=n1((s.deger-once.deger)/gun*7,2)+' kg/hafta';}
    return kart(p,`<div class="sg-buyuk">${s?n1(s.deger):'—'}<small>kg</small></div><div class="sg-alt">${s?(H.kilo?'Hedefe '+n1(s.deger-H.kilo)+' kg':'Hedef yok')+(vki(s.deger)?' · VKİ '+n1(vki(s.deger)):''):'Kilo gir'}${hiz?'<br>'+hiz:''}</div>${s?fark(Number(s.deger),kiloAtG(gEkle(g,-7)),1,-1,' kg'):''}${spark(L.slice(-12).map(o=>Number(o.deger)),'var(--mg)')}`,`<button onclick="SGL.kiloAc()">＋ Kilo</button>`);}
  case 'dis':{const L=aktiviteler().filter(a=>DIS_TURLER.includes(a.tur));const son=L[L.length-1];const hb=haftaBas(g);const km=top(L.filter(a=>zGun(a.baslangic)>=hb).map(a=>(a.mesafe_m||0)/1000));
    return kart(p,`<div class="sg-buyuk">${n1(km,1)}<small>km bu hafta</small></div><div class="sg-alt">${son?TUR_AD[son.tur]+' · '+trK(zGun(son.baslangic))+(son.mesafe_m?' · '+n1(son.mesafe_m/1000,2)+' km':''):'Strava bağlanınca otomatik gelir'}</div>`,`<button onclick="SGL.aktiviteAc()">＋ Aktivite</button>`);}
  case 'ev':{const H8=evHaftalar(1)[0];return kart(p,`<div class="sg-buyuk">${H8.gun}<small>/ ${H.spor} gün bu hafta</small></div><div class="sg-alt">Seri: ${evSeri()} hafta hedefte</div><div class="sg-ilerleme"><i style="width:${Math.min(100,100*H8.gun/H.spor)}%"></i></div>`,`<button onclick="SGL.evAc()">＋ Antrenman</button>`);}
  case 'uyku':{const u=uykuSaatG(g);const s=sabahG(g);return kart(p,`<div class="sg-buyuk">${u!=null?n1(u,1):'—'}<small>saat</small></div><div class="sg-alt">${s?'Kalite '+s.uyku_kalite+'/10 · uyanış '+s.uyanis+'/5':'Sabah formunda sorulur'}</div>${fark(haftaOrt(uykuSaatG),haftaOrt(uykuSaatG,1),1,1,' sa')}${spark(G7.map(uykuSaatG),'var(--purple)',H.uyku)}`);}
  case 'nabiz':{const r=gunluk(g);const son=olcumler('nabiz').slice(-1)[0];let v=null;for(let i=0;i<14&&v==null;i++)v=dinlenikG(gEkle(g,-i));
    return kart(p,`<div class="sg-buyuk">${v||'—'}<small>bpm dinlenik</small></div><div class="sg-alt">${son?'Son: <b style="color:'+nabizRenk(son.baglam)+'">'+n1(son.deger,0)+'</b> · '+nabizAd(son.baglam)+' · '+(zGun(son.zaman)===g?'':trT(zGun(son.zaman))+' ')+saat(son.zaman):r&&r.nabiz_min?'Bugün '+r.nabiz_min+'–'+r.nabiz_max:'Elle gir'}</div>${fark(haftaOrt(dinlenikG),haftaOrt(dinlenikG,1),0,-1)}${spark(G7.map(dinlenikG),'var(--red)')}`,`<button class="on" onclick="SGL.nabizAc()">＋ Nabız</button>`);}
  case 'tansiyon':{const o=sonOlcum('tansiyon');const L=olcumler('tansiyon').slice(-10);
    return kart(p,`<div class="sg-buyuk" style="color:${o&&(o.deger>=140||o.deger2>=90)?'var(--red)':o&&(o.deger>=130||o.deger2>=85)?'var(--amber)':'var(--text)'}">${o?o.deger+'/'+o.deger2:'—'}<small>${o&&o.deger3?o.deger3+' bpm':''}</small></div><div class="sg-alt">${o?trK(zGun(o.zaman))+' '+saat(o.zaman)+(o.baglam?' · '+o.baglam:''):'Ölçüm yok'}</div>${spark(L.map(x=>Number(x.deger)),'var(--amber)')}`,`<button onclick="SGL.tansiyonAc()">＋ Ölçüm</button>`);}
  case 'su':{const s=suG(g);return kart(p,`<div class="sg-buyuk">${n1(s/1000,1)}<small>/ ${n1(H.su/1000,1)} L</small></div><div class="sg-ilerleme"><i style="width:${Math.min(100,100*s/H.su)}%"></i></div>${fark(haftaOrt(x=>suG(x)/1000),haftaOrt(x=>suG(x)/1000,1),1,1,' L')}`,`<button class="on" onclick="SGL.suEkle(1)">＋200 ml</button><button onclick="SGL.suEkle(-1)">−</button>`);}
  case 'kafein':{const k=kafeinG(g);return kart(p,`<div class="sg-buyuk" style="color:${k.top>H.kafein?'var(--amber)':'var(--text)'}">${n1(k.top)}<small>fincan</small></div><div class="sg-alt">${k.ac?'<b style="color:var(--red)">'+k.ac+' aç karnına</b>':'Aç karnına yok'}</div>`,`<button onclick="SGL.kafeinAc()">＋ Kahve</button>`);}
  case 'sigara':{const d=sigaraGun();const s=A.sigara;if(d==null)return kart(p,'<div class="sg-alt">Bırakma tarihini gir.</div>',`<button onclick="SGL.sigaraAyarAc()">⚙️ Ayarla</button>`);const tas=d!=null?d*s.gunlukPaket*s.paketFiyat:null;
    return kart(p,`<div class="sg-buyuk" style="color:var(--green)">${d!=null?d:'—'}<small>gün</small></div><div class="sg-alt">${tas!=null?'≈ '+n1(tas,0)+' ₺ cebinde kaldı':''}<br><span style="color:var(--text3)">${sigaraKazanim(d)}</span></div>`,`<button onclick="SGL.sigaraAyarAc()">⚙️</button>`);}
  case 'tahlil':{const son=(S.v.tahlil||[]).reduce((m,t)=>t.tarih>m?t.tarih:m,'');const dis=sonTahliller().filter(t=>tahlilDurum(t)!=='normal');
    return kart(p,`<div class="sg-buyuk" style="color:${dis.length?'var(--amber)':'var(--text)'}">${dis.length}<small>dışarıda değer</small></div><div class="sg-alt">${dis.slice(0,4).map(t=>esc(t.test)+' '+DURUM_IS[tahlilDurum(t)]).join(' · ')||'—'}<br><span style="color:var(--text3)">Son tahlil ${trT(son)}</span></div>`);}
  case 'randevu':{const R=(S.v.randevu||[]).filter(r=>r.durum==='bekliyor');const y=R.filter(r=>r.tur==='randevu'&&r.tarih).sort((a,b)=>a.tarih<b.tarih?-1:1)[0];const t=R.filter(r=>r.tur==='tetkik').length;
    return kart(p,`<div class="sg-alt">${y?'<b>'+esc(y.baslik)+'</b><br>'+trT(y.tarih)+(y.tarih>=g?' · '+gFark(g,y.tarih)+' gün kaldı':''):'Yaklaşan randevu yok'}</div><div class="sg-alt" style="color:var(--text3)">${t} açık tetkik</div>`);}
  case 'yolculuk':return kart(p,yolculukHtml(true));
  case 'claude':{const c=(S.v.claude||[]).find(x=>x.tur!=='soru');const bek=(S.v.claude||[]).filter(x=>x.tur==='soru'&&x.durum==='bekliyor').length;
    return kart(p,c?`<div class="sg-alt"><b>${esc(c.baslik||'Yorum')}</b> <span class="sg-ek">${trT(zGun(c.zaman))}</span></div><div class="sg-alt">${esc((c.ozet||'').slice(0,240))}</div>`:'<div class="sg-alt">Henüz yorum yok. Projede "analiz et" dediğinde buraya yazarım.</div>',`<button onclick="SGL.sorAc()">💬 Claude'a sor</button>${bek?`<span class="sg-ek">${bek} soru bekliyor</span>`:''}`);}
  }return '';
}
function sigaraKazanim(d){if(d==null)return '';const M=[[1,'Kandaki karbonmonoksit normale döndü'],[3,'Nefes almak kolaylaşıyor'],[14,'Dolaşım düzeliyor'],[90,'Akciğer işlevi artıyor'],[270,'Öksürük ve nefes darlığı azalıyor'],[365,'Kalp hastalığı riski yarıya iniyor']];
  const son=M.filter(m=>d>=m[0]).slice(-1)[0];const sonra=M.find(m=>d<m[0]);return (son?'✓ '+son[1]:'')+(sonra?' · '+(sonra[0]-d)+' gün sonra: '+sonra[1].toLowerCase():'');}
function sonTahliller(){const m={};(S.v.tahlil||[]).forEach(t=>{if(t.deger==null&&!t.deger_metin)return;if(!m[t.test]||m[t.test].tarih<t.tarih)m[t.test]=t;});return Object.values(m);}

// ── Kilo yolculuğu, rozetler, seriler
function yolculukHtml(kisa){const A=ayar(),H=A.hedef;const L=olcumler('kilo');if(!L.length)return '<div class="sg-alt">İlk kilonu gir, yolculuk başlasın.</div>';if(!H.kilo)return '<div class="sg-alt">Hedef kilonu gir: Özet → 🎯 Hedefler.</div>';
  const bas=Math.max(...L.map(o=>Number(o.deger)).slice(0,3)),son=Number(L[L.length-1].deger);const verilen=bas-son,kalan=son-H.kilo,yuzde=Math.max(0,Math.min(100,100*verilen/(bas-H.kilo)));
  const rozet=[[verilen>=5,'−5 kg'],[verilen>=10,'−10 kg'],[verilen>=15,'−15 kg'],[verilen>=20,'−20 kg'],[son<110,'110 altı'],[son<100,'100 altı'],[vki(son)!=null&&vki(son)<35,'VKİ 35 altı'],[vki(son)!=null&&vki(son)<30,'VKİ 30 altı'],[son<=H.kilo,'🎯 Hedef'],[vki(son)!=null&&vki(son)<25,'VKİ 25 altı'],
    [(sigaraGun()||0)>=100,'🚭 100 gün'],[(sigaraGun()||0)>=180,'🚭 6 ay'],[(sigaraGun()||0)>=365,'🚭 1 yıl'],[evSeri()>=4,'🏋️ 4 hafta seri'],[formSeri()>=7,'☀️ 7 gün form'],[ilacSeri()>=14,'💊 14 gün tam']];
  return `<div style="display:flex;justify-content:space-between;align-items:baseline"><div class="sg-buyuk">−${n1(verilen)}<small>kg verildi</small></div><div class="sg-alt">${n1(kalan)} kg kaldı</div></div><div class="sg-ilerleme"><i style="width:${yuzde}%"></i></div>
    <div class="sg-alt">%${n1(yuzde,0)} yol · başlangıç ${n1(bas)} kg → hedef ${H.kilo} kg${H.kiloTarih?' ('+trT(H.kiloTarih)+')':''}</div>
    <div class="sg-alt">Seriler: ☀️ form ${formSeri()} gün · 💊 ilaç ${ilacSeri()} gün · 🏋️ ${evSeri()} hafta · 🚭 ${sigaraGun()||0} gün</div>
    <div class="sg-rozet">${rozet.filter(r=>!kisa||r[0]).slice(0,kisa?8:99).map(r=>`<span class="${r[0]?'ok':''}">${esc(r[1])}</span>`).join('')||'<span>İlk rozet −5 kg\'da</span>'}</div>`;}

// ── Aktivite sekmesi
function aktiviteHtml(){
  const H=ayar().hedef;const K=kovalar();let h=aralikSec();
  const adim=kovaTop(adimG);const dolu=adim.filter(x=>x>0);
  h+=`<div class="sg-bolum"><h4>👣 Adım <small>${dolu.length?'ort. '+n1(ort(dolu),0)+' / gün':''}</small></h4>${grafikCubuk({etiket:K.map(k=>k.et),uzun:K.map(k=>k.uz),seriler:[{ad:'Adım',renk:(v)=>v>=H.adim?'var(--green)':'var(--cy)',v:adim}],hedef:{v:H.adim,ad:n1(H.adim,0)},ort:S.aralik<=90,bos:'Adım verisi saat bağlanınca gelir; şimdilik elle girebilirsin.'})}</div>`;
  const L=aktiviteler();const ab=gEkle(bugun(),-(S.aralik-1));const LA=L.filter(a=>zGun(a.baslangic)>=ab);
  if(!(ST.durum&&ST.durum.bagli))h+=`<div class="sg-bolum"><h4>🗺️ Strava</h4><div id="sg-st">${stKartHtml()}</div></div>`;
  // haftalık km, spor türüne göre
  const hk=[];let hb=haftaBas(ab);while(hb<=bugun()){hk.push(hb);hb=gEkle(hb,7);}
  const kmSeri=DIS_TURLER.map(t=>({ad:TUR_AD[t].replace(/^\S+\s/,''),renk:TUR_RENK[t],v:hk.map(b=>top(LA.filter(a=>a.tur===t&&zGun(a.baslangic)>=b&&zGun(a.baslangic)<=gEkle(b,6)).map(a=>(a.mesafe_m||0)/1000)))})).filter(s=>s.v.some(x=>x>0));
  h+=`<div class="sg-bolum"><h4>🗺️ Haftalık km <small>spor türüne göre</small></h4>${grafikCubuk({etiket:hk.map(trK),seriler:kmSeri.length?kmSeri:[{renk:'var(--cy)',v:hk.map(()=>0)}],bos:'Bu aralıkta dış aktivite yok.'})}</div>`;
  // gün seçici + o günün aktiviteleri
  const G=gunler(21);if(!S.gun)S.gun=bugun();
  const gunAkt=L.filter(a=>zGun(a.baslangic)===S.gun);S._haritaA=gunAkt.some(a=>a.rota)?gunAkt:null;
  h+=`<div class="sg-bolum"><h4>📅 Gün gün <button class="sg-btn" onclick="SGL.aktiviteAc()">＋ Aktivite</button></h4><div class="sg-gunler" id="sg-gunler">${G.map(g=>`<button class="${S.gun===g?'on':''}" onclick="SGL.gunSec('${g}')">${trGun(g)}<b>${Number(g.slice(8))}</b><i class="${L.some(a=>zGun(a.baslangic)===g)?'var':''}"></i></button>`).join('')}</div>
    ${S._haritaA?'<div id="sg-harita" class="sg-harita" style="margin-top:8px"></div>':''}<div style="margin-top:8px">${gunAkt.length?gunAkt.map(aktiviteKart).join(''):`<div class="sg-bos">${trT(S.gun)} için aktivite yok.${adimG(S.gun)?' Adım: '+n1(adimG(S.gun),0):''}</div>`}</div>
    <div class="sg-not">${ST.durum&&ST.durum.bagli?'Aktiviteye dokun: harita, irtifa ve nabız profili.':'🗺️ Strava bağlandığında rotalar burada harita üzerinde, irtifa ve nabız profiliyle görünür.'}</div>${ST.durum&&ST.durum.bagli?`<div id="sg-st" class="sg-st-alt">${stKartHtml()}</div>`:''}</div>`;
  // tempo gelişimi
  const tempo=t=>LA.filter(a=>a.tur===t&&a.mesafe_m>500&&a.sure_sn).map(a=>[new Date(a.baslangic).getTime(),(a.hareket_sn||a.sure_sn)/60/(a.mesafe_m/1000)]);
  const ts=[{ad:'Yürüyüş (dk/km)',renk:TUR_RENK.yuruyus,n:tempo('yuruyus')},{ad:'Koşu (dk/km)',renk:TUR_RENK.kosu,n:tempo('kosu')}].filter(s=>s.n.length);
  h+=`<div class="sg-bolum"><h4>⏱️ Tempo gelişimi <small>aşağı = daha hızlı</small></h4>${ts.length?grafikCizgi({seriler:ts,bas:ARALIK_BAS(),bit:ARALIK_BIT(),birim:'dk/km'}):bosGrafik('Mesafeli yürüyüş veya koşu yok.')}</div>`;
  // rekorlar
  const rek=[];const dis=L.filter(a=>DIS_TURLER.includes(a.tur));
  DIS_TURLER.forEach(t=>{const X=dis.filter(a=>a.tur===t&&a.mesafe_m);if(!X.length)return;const enU=X.reduce((m,a)=>a.mesafe_m>m.mesafe_m?a:m);rek.push([TUR_AD[t]+' · en uzun',n1(enU.mesafe_m/1000,2)+' km',enU]);
    const hz=X.filter(a=>a.mesafe_m>=1000&&a.sure_sn);if(hz.length){const en=hz.reduce((m,a)=>a.sure_sn/a.mesafe_m<m.sure_sn/m.mesafe_m?a:m);rek.push([TUR_AD[t]+' · en hızlı tempo',n1(en.sure_sn/60/(en.mesafe_m/1000),1)+' dk/km',en]);}});
  const k5=dis.filter(a=>a.tur==='kosu'&&a.mesafe_m>=5000&&a.sure_sn);if(k5.length){const en=k5.reduce((m,a)=>a.sure_sn*5000/a.mesafe_m<m.sure_sn*5000/m.mesafe_m?a:m);rek.push(['🏃 En hızlı 5 km (tahmini)',sureYaz(en.sure_sn*5000/en.mesafe_m),en]);}
  h+=`<div class="sg-bolum"><h4>🏆 Kişisel rekorlar</h4>${rek.length?`<div class="sg-liste">${rek.map(r=>`<div class="sg-sat"><div class="ana">${esc(r[0])}<small>${trT(zGun(r[2].baslangic))}</small></div><div class="sag">${esc(r[1])}</div></div>`).join('')}</div>`:bosGrafik('Rekorlar ilk aktivitelerle oluşur.')}</div>`;
  // ev antrenmanı
  const EH=evHaftalar(10);const evL=L.filter(a=>a.tur==='ev').slice(-8).reverse();
  h+=`<div class="sg-bolum"><h4>🏋️ Ev antrenmanı <button class="sg-btn" onclick="SGL.evAc()">＋ Antrenman</button></h4>${grafikCubuk({etiket:EH.map(x=>trK(x.bas)),seriler:[{ad:'Gün',renk:(v)=>v>=H.spor?'var(--green)':'var(--purple)',v:EH.map(x=>x.gun)}],hedef:{v:H.spor,ad:H.spor+' gün'},sifirGoster:true,h:130})}
    <div class="sg-not">Seri: ${evSeri()} hafta üst üste hedefte.</div><div class="sg-liste">${evL.map(a=>`<div class="sg-sat"><div class="ana">${trT(zGun(a.baslangic))} · ${a.sure_sn?Math.round(a.sure_sn/60)+' dk':''}<small>${esc((a.hareketler||[]).map(x=>x.ad+' '+(x.set||'')+'×'+(x.tekrar||'')+(x.kg?' '+x.kg+'kg':'')).join(' · '))}</small></div><button class="sg-x" onclick="SGL.silAktivite(${a.id})">🗑</button></div>`).join('')}</div></div>`;
  // ilişki: adım ↔ mod
  const P=gunler(Math.max(30,S.aralik)).map(g=>[adimG(g),ckG(g)?.ruh??null]);
  h+=`<div class="sg-bolum"><h4>🔗 Adım ↔ mod</h4>${grafikNokta({n:P,xAd:'adım',yAd:'mod',bos:'Adım ve check-in olan en az 3 gün gerekiyor.'})}</div>`;
  return h;
}
function sureYaz(sn){sn=Math.round(sn);const s=Math.floor(sn/3600),d=Math.floor(sn%3600/60),k=sn%60;return (s?s+' sa ':'')+d+' dk'+(s?'':' '+pad(k)+' sn');}
function aktiviteKart(a){const km=a.mesafe_m?a.mesafe_m/1000:null;const tempo=km&&a.sure_sn?a.sure_sn/60/km:null;const atk=(S.v.atak||[]).filter(x=>x.aktivite_id===a.id);
  return `<div class="sg-sat"><div class="ana sg-acil" onclick="SGL.aktiviteDetay(${a.id})"><b>${TUR_AD[a.tur]||a.tur}</b>${a.rota?' <span class="sg-ek">🗺️</span>':''} ${a.ad?'· '+esc(a.ad):''} <span class="sg-ek">${saat(a.baslangic)} · ${esc(a.kaynak)}</span>
    <small>${[km?n1(km,2)+' km':'',a.sure_sn?sureYaz(a.sure_sn):'',tempo&&a.tur!=='bisiklet'?n1(tempo,1)+' dk/km':'',km&&a.sure_sn&&a.tur==='bisiklet'?n1(km/(a.sure_sn/3600),1)+' km/sa':'',a.irtifa_m?'↗ '+n1(a.irtifa_m,0)+' m':'',a.nabiz_ort?'❤️ '+a.nabiz_ort+(a.nabiz_max?'/'+a.nabiz_max:''):'',a.kcal?n1(a.kcal,0)+' kcal':''].filter(Boolean).join(' · ')}</small>
    ${(a.hareketler||[]).length?`<small>${esc(a.hareketler.map(x=>x.ad+' '+(x.set||'')+'×'+(x.tekrar||'')).join(' · '))}</small>`:''}${atk.length?`<small style="color:var(--mg)">⚡ Bu aktiviteyle eşleşen ${atk.length} atak</small>`:''}</div>${a.kaynak==='elle'?`<button class="sg-x" onclick="SGL.silAktivite(${a.id})">🗑</button>`:''}</div>`;}
S.gunSec=g=>{S.gun=g;ciz();};

// ── Vücut ve uyku
function kiloTahmin(){const H=ayar().hedef;const L=olcumler('kilo').map(o=>[new Date(o.zaman).getTime(),Number(o.deger)]);if(L.length<4||!H.kilo)return null;
  const son=L[L.length-1][0];const P=L.filter(p=>p[0]>=son-28*864e5);if(P.length<4)return null;const mx=ort(P.map(p=>p[0])),my=ort(P.map(p=>p[1]));
  const b=top(P.map(p=>(p[0]-mx)*(p[1]-my)))/top(P.map(p=>(p[0]-mx)**2));if(!isFinite(b))return null;const hafta=b*7*864e5;const simdi=my+b*(son-mx);
  if(hafta>=-0.05)return {hafta,simdi,son};const t=son+(simdi-H.kilo)/(-b);return {hafta,simdi,son,t,hedefT:H.kiloTarih?gTs(H.kiloTarih):null};}
function vucutHtml(){
  const H=ayar().hedef;let h=aralikSec();const L=olcumler('kilo');const KT=kiloTahmin();const bas=ARALIK_BAS(),bit=Math.max(ARALIK_BIT()+(S.aralik<=90?S.aralik*0.3*864e5:0),S.aralik>=365&&H.kiloTarih?gTs(H.kiloTarih):0);
  const n=L.map(o=>[new Date(o.zaman).getTime(),Number(o.deger)]).filter(p=>p[0]>=bas);
  const ilk=L[0];const ideal=ilk&&H.kilo&&H.kiloTarih?[[new Date(ilk.zaman).getTime(),Number(ilk.deger)],[gTs(H.kiloTarih),H.kilo]]:[];
  const idealN=ideal.length?[ideal[0][0]<bas?[bas,ideal[0][1]+(ideal[1][1]-ideal[0][1])*(bas-ideal[0][0])/(ideal[1][0]-ideal[0][0])]:ideal[0],[bit,ideal[0][1]+(ideal[1][1]-ideal[0][1])*(Math.min(bit,ideal[1][0])-ideal[0][0])/(ideal[1][0]-ideal[0][0])]]:[];
  const tah=KT&&KT.t?[[KT.son,KT.simdi],[Math.min(bit,KT.t),KT.simdi+KT.hafta/7/864e5*(Math.min(bit,KT.t)-KT.son)]]:[];
  const tYaz=KT?(KT.t?`Son 4 haftanın hızıyla (<b>${n1(KT.hafta,2)} kg/hafta</b>) ${H.kilo} kg'a <b>${new Date(KT.t).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'})}</b> civarı ulaşırsın${KT.hedefT?(KT.t<=KT.hedefT?` · hedef tarihten <b style="color:var(--green)">${Math.round((KT.hedefT-KT.t)/(7*864e5))} hafta önce</b> ✓`:` · hedef tarihten <b style="color:var(--amber)">${Math.round((KT.t-KT.hedefT)/(7*864e5))} hafta sonra</b>; haftada ${n1((L[L.length-1].deger-H.kilo)/Math.max(1,(KT.hedefT-Date.now())/(7*864e5)),2)} kg gerekiyor`):''}.`:`Son 4 haftada kilo ${KT.hafta>0.05?'artıyor':'yerinde sayıyor'} (${n1(KT.hafta,2)} kg/hafta).`):'';
  h+=`<div class="sg-bolum"><h4>⚖️ Kilo <button class="sg-btn" onclick="SGL.kiloAc()">＋ Kilo</button></h4>${grafikCizgi({seriler:[{ad:'Kilo',renk:'var(--mg)',n,trend:7},{ad:'İdeal yol',renk:'var(--text3)',n:idealN,kesik:true,nokta:false,kalin:1},{ad:'Bu hızla',renk:'var(--mg)',n:tah,kesik:true,nokta:false,kalin:1.4}],hedef:H.kilo?[{v:H.kilo,ad:H.kilo+' kg hedef'}]:[],yakin:S.aralik<365,bugunCizgi:true,bas,bit,birim:'kg',bos:'Kilo kaydı yok.',altYazi:tYaz})}${yolculukHtml(false)}</div>`;
  // haftalık kayıp
  const hk=[];let hb=haftaBas(gEkle(bugun(),-(Math.max(S.aralik,56)-1)));const km=kiloGun();const gk=Object.keys(km).sort();
  const kiloAt=g=>{let v=null;gk.forEach(x=>{if(x<=g)v=km[x];});return v;};
  while(hb<=bugun()){const a=kiloAt(gEkle(hb,-1)),b=kiloAt(gEkle(hb,6));hk.push({et:trK(hb),v:a!=null&&b!=null?a-b:0});hb=gEkle(hb,7);}
  h+=`<div class="sg-bolum"><h4>📉 Haftalık kayıp <small>hedef ~0,8–0,9 kg</small></h4>${grafikCubuk({etiket:hk.map(x=>x.et),seriler:[{ad:'Verilen kg',renk:(v)=>v>=0.8?'var(--green)':'var(--cy)',v:hk.map(x=>Math.max(0,x.v))}],hedef:{v:0.85,ad:'0,85'},bos:'Haftalık kayıp için en az iki hafta kilo kaydı gerekiyor.',h:130})}</div>`;
  const bel=olcumler('bel').map(o=>[new Date(o.zaman).getTime(),Number(o.deger)]);const vk=L.map(o=>[new Date(o.zaman).getTime(),vki(Number(o.deger))]).filter(p=>p[0]>=bas&&p[1]!=null);
  h+=`<div class="sg-bolum"><h4>📏 Bel ve VKİ <button class="sg-btn" onclick="SGL.kiloAc('bel')">＋ Bel</button></h4>${bel.length?grafikCizgi({seriler:[{ad:'Bel (cm)',renk:'var(--cy)',n:bel}],hedef:[{v:102,ad:'102 cm risk sınırı',renk:'var(--amber)'}],bas:Math.min(bas,bel[0][0]),bit:ARALIK_BIT(),h:130}):'<div class="sg-not">Bel ölçüsü henüz yok. Göbek hizasından, nefes verirken ölç.</div>'}
    ${grafikCizgi({seriler:[{ad:'VKİ',renk:'var(--purple)',n:vk}],bant:[18.5,25],hedef:[{v:30,ad:'30',renk:'var(--amber)'},{v:25,ad:'25'}],bas,bit:ARALIK_BIT(),h:130,bos:'VKİ için boy (🎯 Hedefler) ve kilo kaydı gerekiyor.'})}</div>`;
  // uyku
  const K=kovalar();const ud=kovalar().map(k=>{const L2=[];for(let g=k.bas;g<=k.son;g=gEkle(g,1)){const r=gunluk(g);if(r&&r.uyku_dk)L2.push(r);}return L2;});
  const evre=(alan)=>ud.map(L2=>L2.length?ort(L2.map(r=>(r[alan]||0)/60)):0);const evreVar=ud.some(L2=>L2.some(r=>r.uyku_derin_dk||r.uyku_rem_dk));
  const sure=kovaTop(uykuSaatG).map((v,i)=>S.aralik>90?v:v);
  h+=`<div class="sg-bolum"><h4>😴 Uyku süresi <small>${evreVar?'evreler saatten':'sabah formu / saat'}</small></h4>${evreVar?grafikCubuk({etiket:K.map(k=>k.et),uzun:K.map(k=>k.uz),seriler:[{ad:'Derin',renk:'#3D2AD6',v:evre('uyku_derin_dk')},{ad:'Hafif',renk:'#7C4DFF',v:evre('uyku_hafif_dk')},{ad:'REM',renk:'#00E5FF',v:evre('uyku_rem_dk')},{ad:'Uyanık',renk:'#FFAB00',v:evre('uyku_uyanik_dk')}],hedef:{v:H.uyku,ad:H.uyku+' sa'},ort:S.aralik<=90})
    :grafikCubuk({etiket:K.map(k=>k.et),uzun:K.map(k=>k.uz),seriler:[{ad:'Saat',renk:(v)=>v>=H.uyku?'var(--green)':'var(--purple)',v:sure}],hedef:{v:H.uyku,ad:H.uyku+' sa'},ort:S.aralik<=90,bos:'Uyku süresi sabah formundan veya saatten gelir.'})}</div>`;
  const kal=(S.v.sabah||[]).filter(r=>r.uyku_kalite&&gTs(r.tarih)>=bas).map(r=>[gTs(r.tarih),r.uyku_kalite]);const uy=(S.v.sabah||[]).filter(r=>r.uyanis&&gTs(r.tarih)>=bas).map(r=>[gTs(r.tarih),r.uyanis*2]);
  h+=`<div class="sg-bolum"><h4>🌙 Uyku kalitesi ve uyanış</h4>${grafikCizgi({seriler:[{ad:'Kalite (1–10)',renk:'var(--purple)',n:kal,trend:7},{ad:'Uyanış hissi (×2)',renk:'var(--cy)',n:uy,trend:7}],y:[0,10.5],bas,bit:ARALIK_BIT(),bos:'Sabah formu doldukça çizilir.'})}</div>`;
  const ol=(S.v.olcum||[]).filter(o=>['kilo','bel','yag'].includes(o.tur)).slice(-15).reverse();
  h+=`<div class="sg-bolum"><h4>📋 Son ölçümler</h4><div class="sg-liste">${ol.map(o=>`<div class="sg-sat"><div class="ana">${o.tur==='kilo'?'⚖️ Kilo':o.tur==='bel'?'📏 Bel':'Yağ oranı'}<small>${trT(zGun(o.zaman))} ${saat(o.zaman)} · ${esc(o.kaynak)}${o.baglam?' · '+esc(o.baglam):''}</small></div><div class="sag">${n1(o.deger)} ${o.tur==='kilo'?'kg':o.tur==='bel'?'cm':'%'}</div><button class="sg-x" onclick="SGL.silOlcum(${o.id})">🗑</button></div>`).join('')||bosGrafik('Ölçüm yok.')}</div></div>`;
  h+=suBolumHtml();
  return h;
}

// ── Kalp ve tansiyon
function kalpHtml(){let h=aralikSec();const bas=ARALIK_BAS(),bit=ARALIK_BIT();const T=olcumler('tansiyon').filter(o=>new Date(o.zaman).getTime()>=bas);
  const renk=o=>o.baglam==='atak'?'#FF1744':o.baglam==='aksam'?'#7C4DFF':'#FFAB00';
  const b=T.map(o=>[new Date(o.zaman).getTime(),Number(o.deger),renk(o)]),k=T.map(o=>[new Date(o.zaman).getTime(),Number(o.deger2),renk(o)]);
  const sab=T.filter(o=>o.baglam==='sabah'),aks=T.filter(o=>o.baglam==='aksam');
  h+=`<div class="sg-bolum"><h4>🩺 Tansiyon <button class="sg-btn" onclick="SGL.tansiyonAc()">＋ Ölçüm</button></h4>${grafikCizgi({seriler:[{ad:'Büyük',renk:'var(--amber)',n:b},{ad:'Küçük',renk:'var(--cy)',n:k}],bant:[60,120],hedef:[{v:130,ad:'130',renk:'var(--amber)'},{v:85,ad:'85',renk:'var(--amber)'}],bas,bit,birim:'mmHg',lejantEk:[['#FFAB00','● sabah'],['#7C4DFF','● akşam'],['#FF1744','● atak']],bos:'Tansiyon ölçümü yok.'})}
    <div class="sg-ozetler" style="margin-top:8px"><div class="sg-oz"><span>Sabah ort.</span><b>${sab.length?n1(ort(sab.map(o=>+o.deger)),0)+'/'+n1(ort(sab.map(o=>+o.deger2)),0):'—'}</b></div><div class="sg-oz"><span>Akşam ort.</span><b>${aks.length?n1(ort(aks.map(o=>+o.deger)),0)+'/'+n1(ort(aks.map(o=>+o.deger2)),0):'—'}</b></div><div class="sg-oz"><span>Ölçüm</span><b>${T.length}</b></div></div>
    <div class="sg-not">Yeşil bant normal aralık. Ölçümü 5 dk oturup dinlendikten sonra, kahve ve sigaradan 30 dk sonra yap; 2 ölçüm al.</div></div>`;
  const tumG=[...new Set([...(S.v.gunluk||[]).filter(r=>r.nabiz_dinlenik).map(r=>r.tarih),...olcumler('nabiz').filter(o=>o.baglam==='dinlenme').map(o=>zGun(o.zaman))])].sort();
  const nd=tumG.filter(g=>gTs(g)>=bas).map(g=>[gTs(g),dinlenikG(g)]);const nt=T.filter(o=>o.deger3).map(o=>[new Date(o.zaman).getTime(),Number(o.deger3),renk(o)]);
  const NM=olcumler('nabiz').filter(o=>new Date(o.zaman).getTime()>=bas&&o.baglam!=='dinlenme');const nm=NM.map(o=>[new Date(o.zaman).getTime(),Number(o.deger),nabizRenk(o.baglam)]);
  const pi=isaretIlac();const NDT=tumG.map(g=>[g,dinlenikG(g)]);
  const ndOz=NDT.length>=10?(()=>{const a=ort(NDT.slice(0,7).map(x=>x[1])),b=ort(NDT.slice(-7).map(x=>x[1]));return `İlk 7 kayıt ort. <b>${n1(a,0)}</b> → son 7 gün ort. <b>${n1(b,0)}</b> bpm <b style="color:${b<a?'var(--green)':b>a?'var(--amber)':'var(--text3)'}">(${b<=a?'':'+'}${n1(b-a,1)})</b>. Kilo verdikçe ve kondisyon arttıkça dinlenik nabız düşer; kalp sağlığının en iyi göstergelerinden biri.`;})():'Dinlenik nabzı "＋ Nabız" ile "Dinlenme" seçerek gir; eğilim için en az 10 gün gerekir.';
  h+=`<div class="sg-bolum"><h4>❤️ Nabız <button class="sg-btn" onclick="SGL.nabizAc()">＋ Nabız</button></h4>${grafikCizgi({seriler:[{ad:'Dinlenik',renk:'var(--red)',n:nd,trend:7},{ad:'Diğer anlar',renk:'var(--mg)',n:nm,cizgi:false},{ad:'Tansiyonda',renk:'var(--text3)',n:nt,cizgi:false,gizli:!nt.length}],bant:[60,100],yakin:true,dikey:pi?[{t:gTs(pi.baslangic),ad:pi.ad.split(' ')[0]+' başladı'}]:[],bas,bit,birim:'bpm',lejantEk:NABIZ_AN.slice(1).map(x=>[x[2],'● '+x[1]]),bos:'Nabzı "＋ Nabız" ile gir.',altYazi:ndOz})}
    <div class="sg-ozetler" style="margin-top:8px">${NABIZ_AN.map(([k,ad,rk])=>{const L=olcumler('nabiz').filter(o=>o.baglam===k&&new Date(o.zaman).getTime()>=bas);return `<div class="sg-oz"><span>${ad}</span><b style="color:${rk}">${L.length?n1(ort(L.map(o=>+o.deger)),0):'—'}</b><small> ${L.length?L.length+' ölçüm':''}</small></div>`;}).join('')}</div>
    <div class="sg-liste" style="margin-top:8px">${olcumler('nabiz').slice(-8).reverse().map(o=>`<div class="sg-sat"><div class="ana"><b style="color:${nabizRenk(o.baglam)}">${nabizAd(o.baglam)}</b><small>${trT(zGun(o.zaman))} ${saat(o.zaman)}${o.notu?' · '+esc(o.notu):''}${o.kaynak==='widget'?' · widget':''}</small></div><div class="sag">${n1(o.deger,0)} bpm</div><button class="sg-x" onclick="SGL.silOlcum(${o.id})">🗑</button></div>`).join('')}</div></div>`;
  const son=olcumler('tansiyon').slice(-20).reverse();
  h+=`<div class="sg-bolum"><h4>📋 Ölçümler</h4><div class="sg-liste">${son.map(o=>`<div class="sg-sat"><div class="ana">${trT(zGun(o.zaman))} ${saat(o.zaman)}<small>${esc(o.baglam||'')} ${o.notu?'· '+esc(o.notu):''}</small></div><div class="sag" style="color:${o.deger>=140||o.deger2>=90?'var(--red)':o.deger>=130||o.deger2>=85?'var(--amber)':'inherit'}">${o.deger}/${o.deger2}${o.deger3?' · '+o.deger3:''}</div><button class="sg-x" onclick="SGL.silOlcum(${o.id})">🗑</button></div>`).join('')||bosGrafik('Ölçüm yok.')}</div></div>`;
  return h;}

// ── Ruh hali ve ataklar
function ruhHtml(){let h=aralikSec();const bas=ARALIK_BAS(),bit=ARALIK_BIT();const pi=isaretIlac(),pb=pi&&pi.baslangic;const dik=pb?[{t:gTs(pb),ad:pi.ad.split(' ')[0]+' başladı'}]:[];
  const ck=(S.v.ck||[]).filter(c=>c.ruh>0&&gTs(c.tarih)>=bas);
  // günün şeridi
  const SG=gunler(21);if(!S.sgun)S.sgun=bugun();
  h+=`<div class="sg-bolum"><h4>🕒 Günün şeridi <small>atak öncesi ne vardı?</small></h4><div class="sg-gunler" id="sg-gunler">${SG.map(g=>`<button class="${S.sgun===g?'on':''}" onclick="SGL.seritGun('${g}')">${trGun(g)}<b>${Number(g.slice(8))}</b><i class="${atakG(g).length?'var atk':''}"></i></button>`).join('')}</div><div style="margin-top:8px">${seritHtml(S.sgun)}</div></div>`;
  h+=`<div class="sg-bolum"><h4>🧠 Mod · stres · mutluluk <button class="sg-btn" onclick="SGL.checkinAc()">Check-in</button></h4>${grafikCizgi({seriler:[{ad:'Mod',renk:'var(--cy)',n:ck.map(c=>[gTs(c.tarih),c.ruh]),trend:7},{ad:'Stres',renk:'var(--red)',n:ck.map(c=>[gTs(c.tarih),c.stres]),trend:7},{gizli:true,ad:'Mutluluk',renk:'var(--green)',n:ck.map(c=>[gTs(c.tarih),c.eglence]),trend:7},{gizli:true,ad:'Kaygı',renk:'var(--amber)',n:ck.map(c=>[gTs(c.tarih),c.kaygi]),trend:7}],y:[0.5,10.5],dikey:dik,bas,bit,bos:'Akşam check-in\'leri doldukça çizilir.',altYazi:'Kalın çizgi 7 günlük ortalama, noktalar günlük değer. Alttaki düğmelerle seri aç/kapat.'})}</div>`;
  const atB=haftaTop(x=>atakG(x).length),atO=haftaTop(x=>atakG(x).length,1);
  h+=`<div class="sg-bolum"><h4>⚡ Atak takvimi <button class="sg-btn" onclick="SGL.atakAc()">＋ Atak</button></h4>${takvimIsi({gun:Math.max(S.aralik,35),deger:g=>{const L=atakG(g);return L.length?{v:L.length,s:Math.max(0,...L.map(a=>a.siddet||0)),k:L.some(a=>a.kriz_ilac)}:null;},
      renk:(x,d)=>`rgba(232,25,122,${(0.22+0.78*x).toFixed(2)})`,et:(d,g)=>d.v?`${d.v} atak${d.s?' <small>en yüksek şiddet '+d.s+'</small>':''}${d.k?' <small>· kriz ilacı</small>':''}`:(g<=bugun()?'Atak yok':'—'),
      ozet:`<div>Bu hafta <b>${atB}</b></div><div>Geçen hafta <b>${atO}</b></div>`})}${pb?`<div class="sg-not">${ilacEtki()}</div>`:''}</div>`;
  const A=(S.v.atak||[]).filter(a=>new Date(a.zaman).getTime()>=bas);const AS=A.filter(a=>!tahminiAtak(a));
  const M=[0,1,2,3,4,5,6].map(()=>Array(24).fill(0));AS.forEach(a=>{const d=new Date(a.zaman);M[(d.getDay()+6)%7][d.getHours()]++;});
  h+=`<div class="sg-bolum"><h4>🕐 Saatlere göre ataklar</h4>${AS.length?isiHarita(M,['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'],[...Array(24).keys()].map(String)):bosGrafik('Atak kaydı yok.')}${A.length>AS.length?`<div class="sg-not">Geriye dönük tahmini ${A.length-AS.length} kayıt saat analizine katılmaz, sadece günlük sayılarda kullanılır.</div>`:''}</div>`;
  h+=atakAnalizHtml(A);
  // tetikleyiciler
  const say=(alan)=>{const m={};A.forEach(a=>(a[alan]||[]).forEach(t=>m[t]=(m[t]||0)+1));return Object.entries(m).sort((a,b)=>b[1]-a[1]);};
  const tet=say('tetikleyiciler'),bel=say('belirtiler');
  h+=`<div class="sg-bolum"><h4>🎯 Tetikleyiciler ve belirtiler</h4>${tet.length||bel.length?`<div class="sg-liste">${tet.slice(0,8).map(([t,n])=>`<div class="sg-sat"><div class="ana">${esc(t)}</div><div class="sag">${n}</div></div>`).join('')}</div><div class="sg-chips" style="margin-top:8px">${bel.map(([t,n])=>`<span class="sg-ek">${esc(t)} · ${n}</span>`).join(' ')}</div>`:bosGrafik('Atak kaydı yok.')}</div>`;
  // aylık özet
  const ay={};(S.v.atak||[]).forEach(a=>{const k=zGun(a.zaman).slice(0,7);(ay[k]=ay[k]||[]).push(a);});
  h+=`<div class="sg-bolum"><h4>🗓️ Aylık özet</h4><div class="sg-liste">${Object.keys(ay).sort().reverse().slice(0,8).map(k=>{const L=ay[k];return `<div class="sg-sat"><div class="ana">${new Date(k+'-01T12:00').toLocaleDateString('tr-TR',{month:'long',year:'numeric'})}<small>ort. şiddet ${n1(ort(L.map(a=>a.siddet)))} · ort. süre ${n1(ort(L.map(a=>a.sure_dk)),0)} dk · ${L.filter(a=>a.kriz_ilac).length} kez kriz ilacı</small></div><div class="sag">${L.length} atak</div></div>`;}).join('')||bosGrafik('Atak kaydı yok.')}</div></div>`;
  // ilişki: uyku+kafein ↔ atak
  const G=gunler(Math.max(30,S.aralik));
  h+=uykuErtesiHtml(G);
  h+=kafeinBolumHtml();
  h+=`<div class="sg-bolum"><h4>🔗 Aç karnına kahve ↔ atak</h4>${grafikNokta({n:G.map(g=>{const k=girisG('kafein',g);return [k.length||sabahG(g)?kafeinG(g).ac:null,k.length||sabahG(g)?atakG(g).length:null];}),xAd:'aç kahve',yAd:'atak sayısı',renk:'var(--amber)'})}</div>`;
  // liste
  const son=(S.v.atak||[]).slice(-25).reverse();
  h+=`<div class="sg-bolum"><h4>📋 Atak günlüğü</h4><div class="sg-liste">${son.map(a=>{const ak=a.aktivite_id&&(S.v.aktivite||[]).find(x=>x.id===a.aktivite_id);return `<div class="sg-sat"><div class="ana"><b>${trT(zGun(a.zaman))} ${saat(a.zaman)}</b> ${a.siddet?'<span class="sg-ek">şiddet '+a.siddet+'</span>':''} ${a.sure_dk?'<span class="sg-ek">'+a.sure_dk+' dk</span>':''}${a.kriz_ilac?' <span class="sg-ek">💊 kriz ilacı</span>':''}
    <small>${esc([(a.belirtiler||[]).join(', '),(a.tetikleyiciler||[]).length?'tetik: '+a.tetikleyiciler.join(', '):'',a.durum,a.tansiyon_b?'TA '+a.tansiyon_b+'/'+a.tansiyon_k:'',a.nabiz?'nabız '+a.nabiz:'',a.iyi_gelen?'iyi gelen: '+a.iyi_gelen:'',ak?'aktivite: '+(TUR_AD[ak.tur]||ak.tur):'',a.notu].filter(Boolean).join(' · '))}</small></div><button class="sg-x" onclick="SGL.atakAc(${a.id})">✏️</button></div>`;}).join('')||bosGrafik('Atak kaydı yok.')}</div></div>`;
  return h;}
function uykuErtesiHtml(G){const K=[['6 saatten az',0,6],['6–7 saat',6,7],['7–8 saat',7,8],['8 saat ve üstü',8,99]];
  const R=K.map(([ad,a,b])=>{const L=G.filter(g=>{const u=uykuSaatG(g);return u!=null&&u>=a&&u<b;});return {ad,n:L.length,atak:L.length?ort(L.map(g=>atakG(g).length)):null,mod:ort(L.map(g=>ckG(g)?.ruh)),stres:ort(L.map(g=>ckG(g)?.stres))};}).filter(r=>r.n);
  if(top(R.map(r=>r.n))<5)return `<div class="sg-bolum"><h4>😴 Uyku → o günün atak ve modu</h4>${bosGrafik('Uyku süresi olan en az 5 gün gerekiyor.')}</div>`;
  const mxA=Math.max(0.5,...R.map(r=>r.atak||0));
  return `<div class="sg-bolum"><h4>😴 Uyku → o günün atak ve modu <small>gece uykusuna göre</small></h4><div class="sg-ub">${R.map(r=>`<div class="sg-ub-s"><div class="ad">${r.ad}<small>${r.n} gün</small></div><div class="ct"><i style="width:${100*(r.atak||0)/mxA}%"></i><b>${n1(r.atak,1)} atak</b></div><div class="md">${r.mod!=null?'mod <b>'+n1(r.mod,1)+'</b>':''}${r.stres!=null?' · stres <b>'+n1(r.stres,1)+'</b>':''}</div></div>`).join('')}</div>
    <div class="sg-not">Her satır, o gece o kadar uyuduğun günlerin ortalaması. Az uyunan günlerde atak artıyorsa uyku önceliğin olmalı.</div></div>`;}
function ilacEtki(){const pi=isaretIlac();if(!pi)return '';const pb=pi.baslangic,ad=pi.ad.split(' ')[0];const g=bugun();const sonra=Math.min(gFark(pb,g)+1,28);if(sonra<3)return ad+' '+trT(pb)+'\'de başladı. Etkisini görmek için önce ve sonra en az 1–2 hafta kayıt gerekir.';
  const once=gunler(sonra,gEkle(pb,-1)),son=gunler(sonra,g);const o=top(once.map(x=>atakG(x).length))/sonra,s=top(son.map(x=>atakG(x).length))/sonra;
  return `${ad} öncesi ${sonra} gün: günde ${n1(o,1)} atak · sonrası ${sonra} gün: günde ${n1(s,1)} atak.`;}
function atakAnalizHtml(A){if(A.length<2)return `<div class="sg-bolum"><h4>🔍 Atak analizi</h4>${bosGrafik('Analiz için birkaç atak kaydı ve sabah formu gerekiyor.')}</div>`;
  const G=gunler(S.aralik).filter(g=>sabahG(g)||atakG(g).length);const atakli=G.filter(g=>atakG(g).length),atsiz=G.filter(g=>!atakG(g).length);
  const sat=(ad,fn,bir,d)=>{const a=ort(atakli.map(fn)),b=ort(atsiz.map(fn));return `<div class="sg-sat"><div class="ana">${ad}</div><div class="sag" style="color:var(--mg)">${n1(a,d)}${bir}</div><div class="sag" style="color:var(--text3);min-width:62px">${n1(b,d)}${bir}</div></div>`;};
  const ac=A.filter(a=>(a.tetikleyiciler||[]).some(t=>/aç|açlık/i.test(t))).length;const eff=A.filter(a=>a.aktivite_id||(a.tetikleyiciler||[]).includes('Efor')).length;
  const saatOrt=ort(A.filter(a=>!tahminiAtak(a)).map(a=>new Date(a.zaman).getHours()+new Date(a.zaman).getMinutes()/60));
  const ks=(ad,fn,bir,d,kotu,mx)=>({ad,a:ort(atakli.map(fn)),b:ort(atsiz.map(fn)),bir,d,kotu,mx});
  return `<div class="sg-bolum"><h4>🔍 Atak olan ve olmayan günler <small>${atakli.length} / ${atsiz.length} gün</small></h4>${karsilastirma([
    ks('Uyku süresi',uykuSaatG,' sa',1,-1),ks('Uyku kalitesi',g=>sabahG(g)?.uyku_kalite,'/10',1,-1,10),ks('Derin uyku',g=>gunluk(g)?.uyku_derin_dk!=null?gunluk(g).uyku_derin_dk/60:null,' sa',1,-1),
    ks('Aç karnına kahve',g=>kafeinG(g).ac,'',1,1),ks('Toplam kahve',g=>kafeinG(g).top,'',1,1),ks('Adım',adimG,'',0,-1),ks('Dinlenik nabız',dinlenikG,'',0,1),
    ks('Stres (check-in)',g=>ckG(g)?.stres,'/10',1,1,10),ks('Uyanış hissi',g=>sabahG(g)?.uyanis,'/5',1,-1,5)].filter(r=>r.a!=null&&r.b!=null),'Atak olan günler','Olmayan günler')}
    <div class="sg-not">Her satırda solda atak olan günlerin, sağda olmayan günlerin ortalaması. Çubuk farkın yüzdesi: pembe = atak olan günlerde daha kötü, yeşil = daha iyi. %15 ve üstü farklar belirgindir.</div>
    <div class="sg-not">${A.length} atak · ${ac} tanesi açlık veya aç kahveyle · ${eff} tanesi efor/aktiviteyle eşleşti · ortalama saat ${saatOrt!=null?pad(Math.floor(saatOrt))+':'+pad(Math.round(saatOrt%1*60)):'—'}. Nabız ve tansiyon ölçülen ataklarda: ${n1(ort(A.map(a=>a.tansiyon_b)),0)}/${n1(ort(A.map(a=>a.tansiyon_k)),0)}, nabız ${n1(ort(A.map(a=>a.nabiz)),0)}.</div></div>`;}

// ── İlaçlar
function ilacHtml(){const g=bugun();let h=`<div style="display:flex;justify-content:flex-end"><button class="sg-btn" onclick="SGL.hatirlatAc()">🔔 Hatırlatmalar</button></div>`;const P=ilacPlan(g);
  const grp=d=>P.filter(x=>x.dilim===d);
  const satir=x=>{const r=alimBul(x.ilac.id,g,x.dilim);return `<div class="sg-ilac"><button class="sg-tik ${r?(r.alindi?'ok':'no'):''}" onclick="SGL.ilacTik(${x.ilac.id},'${x.dilim}')">${r?(r.alindi?'✓':'✕'):''}</button><div class="ad">${esc(x.ilac.ad)}${x.ilac.doz?' <span class="sg-ek">'+esc(x.ilac.doz)+'</span>':''}<small>${r&&r.alindi?'alındı '+saat(r.zaman):''}${r&&r.secim?' · '+esc(r.secim):''}${x.ilac.notu?' · '+esc(x.ilac.notu):''}</small></div></div>`;};
  h+=`<div class="sg-bolum"><h4>💊 Bugün <small>${trT(g)}</small></h4>${['sabah','ogle','aksam'].filter(d=>grp(d).length).map(d=>`<div class="sg-fb">${d==='sabah'?'☀️ Sabah':d==='ogle'?'🕛 Öğle':'🌙 Akşam'}</div>${grp(d).map(satir).join('')}`).join('')||bosGrafik('Aktif ilaç yok.')}</div>`;
  const k=krizIlac();if(k){const bg=krizG(g);const kal=k.bitis?gFark(g,k.bitis):null;
    h+=`<div class="sg-bolum"><h4>⚠️ ${esc(k.ad)} <small>sadece büyük krizde · günde en fazla ${k.max_gunluk||2}</small></h4><div style="display:flex;align-items:center;gap:12px"><div class="sg-buyuk" style="color:${bg.length>=(k.max_gunluk||2)?'var(--red)':'var(--text)'}">${bg.length}/${k.max_gunluk||2}<small>bugün</small></div><button class="sg-btn ${bg.length>=(k.max_gunluk||2)?'':'ana'}" onclick="SGL.krizEkle()">＋ Aldım</button>${bg.length?`<button class="sg-btn" onclick="SGL.krizGeri()">↶</button>`:''}</div>
      <div class="sg-not">${kal!=null?(kal>=0?'Kullanım süresi: '+kal+' gün kaldı ('+trT(k.bitis)+')':'Doktorun verdiği süre '+trT(k.bitis)+'\'de doldu, yeniden sormadan kullanma.'):''}</div>
      <div class="sg-not">Son 7 gün: ${top(gunler(7).map(x=>krizG(x).length))} tablet · son 30 gün: ${top(gunler(30).map(x=>krizG(x).length))} tablet</div></div>`;}
  // takvim görünümü
  const G=gunler(28);const duz=(S.v.ilac||[]).filter(i=>i.aktif&&i.tur!=='gerektiginde');const sat=[];duz.forEach(i=>(i.zamanlar||[]).forEach(d=>sat.push([i,d])));
  h+=`<div class="sg-bolum"><h4>📅 Son 4 hafta <small>yeşil alındı · kırmızı atlandı · gri girilmedi</small></h4><div class="sg-takvim" style="grid-template-columns:92px repeat(${G.length},1fr)"><span></span>${G.map((g,i)=>`<span style="text-align:center">${i%7===0?Number(g.slice(8)):''}</span>`).join('')}
    ${sat.map(([i,d])=>`<span class="ad">${d==='sabah'?'☀️':d==='aksam'?'🌙':'🕛'} ${esc(i.ad.split(' ')[0])}</span>${G.map(g=>{if(i.baslangic&&i.baslangic>g)return '<span></span>';const r=alimBul(i.id,g,d);return `<span class="h ${r?(r.alindi?'ok':'no'):''}" title="${trT(g)}"></span>`;}).join('')}`).join('')}</div>
    <div class="sg-not">Son 7 gün uyum %${n1((ilacUyum(gunler(7))||0)*100,0)} · son 28 gün %${n1((ilacUyum(G)||0)*100,0)} · tam seri ${ilacSeri()} gün</div></div>`;
  // ilaç listesi
  const L=(S.v.ilac||[]);
  h+=`<div class="sg-bolum"><h4>📋 İlaç ve takviye listesi <button class="sg-btn" onclick="SGL.ilacFormAc()">＋ Ekle</button></h4><div class="sg-liste">${L.map(i=>`<div class="sg-sat" style="${i.aktif?'':'opacity:.5'}"><div class="ana"><b>${esc(i.ad)}</b> ${i.doz?'<span class="sg-ek">'+esc(i.doz)+'</span>':''}<small>${esc([i.etken,i.tur==='gerektiginde'?'gerektiğinde, günde en fazla '+(i.max_gunluk||'?'):((i.zamanlar||[]).map(z=>z==='sabah'?'sabah':z==='aksam'?'akşam':'öğle').join(' + ')),i.baslangic?'başlangıç '+trT(i.baslangic):'',i.bitis?'bitiş '+trT(i.bitis):'',i.notu].filter(Boolean).join(' · '))}</small></div><button class="sg-x" onclick="SGL.ilacFormAc(${i.id})">✏️</button></div>`).join('')||bosGrafik('Liste boş.')}</div></div>`;
  return h;}

// ── Tahliller ve doktor
function tahlilKiloTablo(){const TS=['Ürik asit','Trigliserid','HDL','ALT','HbA1c','Glukoz'].filter(t=>tahlilSeri(t).length);if(!TS.length)return '';
  const tar=[...new Set((S.v.tahlil||[]).filter(t=>TS.includes(t.test)&&t.deger!=null).map(t=>t.tarih))].sort();const bul=(t,g)=>(S.v.tahlil||[]).find(x=>x.test===t&&x.tarih===g&&x.deger!=null);
  return `<div class="sg-tablo"><table><thead><tr><th>Tarih</th><th>Kilo</th>${TS.map(t=>`<th>${esc(t)}</th>`).join('')}</tr></thead><tbody>${tar.map(g=>`<tr><td>${trT(g)}</td><td>${kiloAtG(g)!=null&&kiloAtG(g)!==undefined&&Object.keys(kiloGun()).some(x=>x<=g&&gFark(x,g)<=21)?n1(kiloAtG(g)):'—'}</td>${TS.map(t=>{const x=bul(t,g);return `<td style="color:${x?DURUM_RENK[tahlilDurum(x)]:'var(--text3)'}">${x?n1(Number(x.deger),2)+DURUM_IS[tahlilDurum(x)]:'·'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><div class="sg-not">Her tahlil gününde (±3 hafta içindeki) kilonla birlikte. Renk: yeşil normal, kırmızı yüksek, sarı düşük/sınırda.</div>`;}
function tahlilHtml(){let h=`<button class="sg-btn ana" style="align-self:stretch;padding:11px" onclick="SGL.doktorAc()">📄 Doktor özeti · göster, kopyala, yazdır</button>`;const T=S.v.tahlil||[];const testler=[...new Set(T.map(t=>t.test))];
  const sira=testler.sort((a,b)=>{const ia=ONEMLI_TEST.indexOf(a),ib=ONEMLI_TEST.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib);});
  const grup={};sira.forEach(t=>{const g=(T.find(x=>x.test===t)||{}).grup||'Diğer';(grup[g]=grup[g]||[]).push(t);});
  const onemli=sira.filter(t=>ONEMLI_TEST.includes(t));
  h+=katBolum('onemli',`⭐ Takip ettiklerimiz <small>${onemli.length} test</small>`,onemli.map(t=>tahlilSatir(t,true)).join('')||bosGrafik('Tahlil yok.'),`<button class="sg-btn" onclick="SGL.tahlilAc()">＋ Değer</button>`);
  // ilişki: kilo ↔ ürik asit / trigliserid
  const km=kiloGun();const gk=Object.keys(km).sort();const kiloAt=g=>{let v=null;gk.forEach(x=>{if(x<=g)v=km[x];});return v;};
  const ur=tahlilSeri('Ürik asit'),tg=tahlilSeri('Trigliserid');
  if(ur.length||tg.length){const bas=gTs((T[0]||{}).tarih||bugun());const kn=olcumler('kilo').map(o=>[new Date(o.zaman).getTime(),Number(o.deger)]);
    h+=katBolum('kilo','🔗 Kilo ↔ ürik asit ve trigliserid',`${grafikCizgi({seriler:[{ad:'Ürik asit',renk:'var(--amber)',n:ur.map(t=>[gTs(t.tarih),Number(t.deger)])}],bant:[3.4,7],bas,bit:Date.now(),h:120})}${grafikCizgi({seriler:[{ad:'Trigliserid',renk:'var(--red)',n:tg.map(t=>[gTs(t.tarih),Number(t.deger)])}],hedef:[{v:150,ad:'150'}],bas,bit:Date.now(),h:120})}${grafikCizgi({seriler:[{ad:'Kilo',renk:'var(--mg)',n:kn}],bas,bit:Date.now(),h:110,bos:'Kilo kaydı yok.'})}<div class="sg-not">Kilo kaybı bu değerlerin ikisini de düşürür; bir sonraki tahlilde aynı zaman çizgisinde görürüz.</div>${tahlilKiloTablo()}`);}
  Object.keys(grup).forEach(g=>{const L=grup[g].filter(t=>!onemli.includes(t));if(L.length)h+=katBolum('g:'+encodeURIComponent(g).replace(/'/g,'%27'),`${esc(g)} <small>${L.length} test</small>`,L.map(t=>tahlilSatir(t,false)).join(''));});
  // randevular ve tetkikler
  const R=S.v.randevu||[];const yap=R.filter(r=>r.durum==='bekliyor');
  const rs=r=>`<div class="sg-sat" style="${r.durum!=='bekliyor'?'opacity:.55':''}"><button class="sg-tik ${r.durum==='yapildi'?'ok':''}" onclick="SGL.randevuTik(${r.id})">${r.durum==='yapildi'?'✓':''}</button><div class="ana">${esc(r.baslik)}<small>${esc([r.brans,r.tarih?trT(r.tarih)+(r.saat?' '+String(r.saat).slice(0,5):''):'',r.yer,r.notu].filter(Boolean).join(' · '))}</small></div><button class="sg-x" onclick="SGL.randevuAc(${r.id})">✏️</button></div>`;
  h+=`<div class="sg-bolum"><h4>🩻 Randevular <button class="sg-btn" onclick="SGL.randevuAc(null,'randevu')">＋ Randevu</button></h4><div class="sg-liste">${R.filter(r=>r.tur==='randevu').sort((a,b)=>(a.durum==='bekliyor'?0:1)-(b.durum==='bekliyor'?0:1)||String(a.tarih||'9').localeCompare(String(b.tarih||'9'))).map(rs).join('')||bosGrafik('Randevu yok.')}</div></div>`;
  h+=`<div class="sg-bolum"><h4>🧾 Açık tetkikler <small>${yap.filter(r=>r.tur==='tetkik').length} bekliyor</small> <button class="sg-btn" onclick="SGL.randevuAc(null,'tetkik')">＋</button></h4><div class="sg-liste">${R.filter(r=>r.tur==='tetkik').sort((a,b)=>(a.durum==='bekliyor'?0:1)-(b.durum==='bekliyor'?0:1)||a.oncelik-b.oncelik).map(rs).join('')||bosGrafik('Tetkik yok.')}</div></div>`;
  h+=`<div class="sg-bolum"><h4>❓ Doktora sorulacaklar <span style="display:flex;gap:6px"><button class="sg-btn" onclick="SGL.sorulariKopyala()">🖨️ Yazdır</button><button class="sg-btn" onclick="SGL.randevuAc(null,'soru')">＋</button></span></h4><div class="sg-liste">${R.filter(r=>r.tur==='soru').map(rs).join('')||bosGrafik('Soru yok.')}</div></div>`;
  return h;}
function tahlilSatir(test,grafikli){const L=tahlilSeri(test);const tumu=(S.v.tahlil||[]).filter(t=>t.test===test).sort((a,b)=>a.tarih<b.tarih?-1:1);const s=tumu[tumu.length-1];if(!s)return '';const d=tahlilDurum(s);const onceki=L.length>1?L[L.length-2]:null;
  const ok=onceki&&s.deger!=null?(s.deger>onceki.deger?'↗':s.deger<onceki.deger?'↘':'→'):'';const acik=!!S.acik[test];
  const ref=s.ref_metin||(s.ref_alt!=null&&s.ref_ust!=null?s.ref_alt+'–'+s.ref_ust:s.ref_ust!=null?'<'+s.ref_ust:s.ref_alt!=null?'>'+s.ref_alt:'');
  return `<div class="sg-tahlil"><div class="ust" onclick="SGL.tahlilAcKapa('${esc(test).replace(/'/g,'&#39;')}')"><div class="ad"><b>${esc(test)}</b><small>${esc(ref)} ${esc(s.birim||'')} · ${trT(s.tarih)}${s.notu?' · '+esc(s.notu):''}</small></div><span style="color:var(--text3)">${ok}</span><b style="color:${DURUM_RENK[d]}">${s.deger!=null?n1(s.deger,2):esc(s.deger_metin)} ${DURUM_IS[d]}</b></div>
    ${acik&&L.length?grafikCizgi({kompakt:true,seriler:[{ad:'',renk:DURUM_RENK[d],n:L.map(t=>[gTs(t.tarih),Number(t.deger),DURUM_RENK[tahlilDurum(t)]])}],bant:s.ref_alt!=null||s.ref_ust!=null?[s.ref_alt!=null?Number(s.ref_alt):null,s.ref_ust!=null?Number(s.ref_ust):null]:null,hedef:s.hedef!=null?[{v:Number(s.hedef),ad:'hedef '+n1(s.hedef)}]:[],bas:gTs(L[0].tarih)-20*864e5,bit:Math.max(Date.now(),gTs(L[L.length-1].tarih)+20*864e5),h:110,birim:s.birim}):''}</div>`;}
S.tahlilAcKapa=t=>{t=t.replace(/&#39;/g,"'").replace(/&amp;/g,'&');S.acik[t]=!S.acik[t];ciz();};
S.bolumAcKapa=k=>{S.acik['b:'+k]=!S.acik['b:'+k];ciz();};
function katBolum(k,baslik,ic,sag){const a=!!S.acik['b:'+k];return `<div class="sg-bolum"><h4 class="sg-kat" onclick="SGL.bolumAcKapa('${k}')"><span>${a?'▾':'▸'} ${baslik}</span>${sag?`<span onclick="event.stopPropagation()">${sag}</span>`:''}</h4>${a?ic:''}</div>`;}

// ── Beslenme
function suBolumHtml(){const H=ayar().hedef;const K=kovalar();
  return `<div class="sg-bolum"><h4>💧 Su <button class="sg-btn" onclick="SGL.suEkle(1)">＋200 ml</button></h4>${grafikCubuk({etiket:K.map(k=>k.et),uzun:K.map(k=>k.uz),seriler:[{ad:'Litre',renk:(v)=>v>=H.su/1000?'var(--green)':'var(--cy)',v:kovaTop(suG).map(v=>v==null?v:Math.round(v/100)/10)}],hedef:{v:H.su/1000,ad:n1(H.su/1000,1)+' L'},birim:'L',bos:'Su kaydı yok.'})}<div class="sg-not">Her dokunuş 200 ml. Bugün: <b>${litre(suG(bugun()))}</b> / ${litre(H.su)}</div></div>`;}
function kafeinBolumHtml(){const H=ayar().hedef;const K=kovalar();const L=(S.v.giris||[]).filter(x=>x.tur==='kafein').slice(-10).reverse();
  return `<div class="sg-bolum"><h4>☕ Kahve <button class="sg-btn" onclick="SGL.kafeinAc()">＋ Kahve</button></h4>${grafikCubuk({etiket:K.map(k=>k.et),uzun:K.map(k=>k.uz),seriler:[{ad:'Aç karnına',renk:'var(--red)',v:kovaTop(g=>kafeinG(g).ac)},{ad:'Tok',renk:'#8D6E63',v:kovaTop(g=>kafeinG(g).top-kafeinG(g).ac)}],hedef:{v:H.kafein,ad:'en fazla '+H.kafein,ust:true},bos:'Kahve kaydı yok.'})}
    ${L.length?`<div class="sg-liste" style="margin-top:8px">${L.map(x=>`<div class="sg-sat"><div class="ana">☕ ${esc(x.alt||'Kahve')}${x.ac?' · aç':''}<small>${trT(zGun(x.zaman))} ${saat(x.zaman)}${x.notu?' · '+esc(x.notu):''}</small></div><div class="sag">${n1(x.miktar)}</div><button class="sg-x" onclick="SGL.silGiris(${x.id})">🗑</button></div>`).join('')}</div>`:''}</div>`;}

// ── Claude
const KONULAR=[['hepsi','Hepsi'],['genel','Genel'],['atak','Atak ve kaygı'],['kilo','Kilo'],['tahlil','Tahlil'],['ilac','İlaç'],['uyku','Uyku'],['aktivite','Aktivite'],['tansiyon','Tansiyon']];
function claudeHtml(){const C=S.v.claude||[];let h='';
  const sorular=C.filter(c=>c.tur==='soru');
  h+=`<div class="sg-bolum"><h4>💬 Claude'a sor</h4><div class="sg-f"><textarea id="sg-soru" rows="3" placeholder="Örn: Yeni ilaca başladıktan sonra ataklarım azaldı mı?"></textarea></div><button class="sg-btn ana" onclick="SGL.sorKaydet()">Gönder</button><div class="sg-not">Soru buraya kaydedilir. Projede "sağlık sorularıma bak" dediğinde verilerine bakıp cevabı buraya yazarım.</div>
    ${sorular.length?`<div class="sg-liste" style="margin-top:8px">${sorular.slice(0,10).map(q=>{const c=C.find(x=>x.soru_id===q.id);return `<div class="sg-sat"><div class="ana">${esc(q.metin)}<small>${trT(zGun(q.zaman))} · ${c?'<span style="color:var(--green)">cevaplandı</span>':'bekliyor'}</small>${c?`<div class="sg-md" style="margin-top:6px">${md(c.metin||c.ozet)}</div>`:''}</div>${c?'':`<button class="sg-x" onclick="SGL.silClaude(${q.id})">🗑</button>`}</div>`;}).join('')}</div>`:''}</div>`;
  const L=C.filter(c=>c.tur!=='soru'&&c.tur!=='cevap'&&(S.konu==='hepsi'||c.konu===S.konu));
  h+=`<div class="sg-bolum"><h4>✨ Claude'un yorumları <small>${C.filter(c=>c.tur!=='soru'&&c.tur!=='cevap').length} kayıt</small></h4><div class="sg-chips" style="margin-bottom:8px">${KONULAR.map(([k,a])=>`<button class="${S.konu===k?'on':''}" onclick="SGL.konuSec('${k}')">${a}</button>`).join('')}</div>
    ${L.map(c=>`<div class="sg-tahlil"><div class="ust" onclick="SGL.claudeAcKapa(${c.id})"><div class="ad"><b>${esc(c.baslik||'Yorum')}</b><small>${trT(zGun(c.zaman))} · ${esc({analiz:'Analiz',haftalik:'Haftalık rapor',aylik:'Aylık rapor',not:'Not'}[c.tur]||c.tur)}${c.konu?' · '+esc((KONULAR.find(k=>k[0]===c.konu)||[0,c.konu])[1]):''}</small></div><span>${S.acik['c'+c.id]?'▾':'▸'}</span></div>
      <div class="sg-alt" style="margin-top:4px">${esc(c.ozet||'')}</div>${S.acik['c'+c.id]&&c.metin?`<div class="sg-md" style="margin-top:8px">${md(c.metin)}</div>`:''}</div>`).join('')||bosGrafik('Bu konuda yorum yok.')}</div>`;
  return h;}
function md(t){const sat=String(t||'').split('\n');let h='',liste=false;const sat2=x=>esc(x).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`(.+?)`/g,'<code>$1</code>');
  sat.forEach(l=>{const m=l.match(/^\s*[-*]\s+(.*)/);if(m){if(!liste){h+='<ul>';liste=true;}h+='<li>'+sat2(m[1])+'</li>';return;}if(liste){h+='</ul>';liste=false;}
    const b=l.match(/^(#{1,3})\s+(.*)/);if(b)h+='<h3>'+sat2(b[2])+'</h3>';else if(l.trim())h+='<p>'+sat2(l)+'</p>';});if(liste)h+='</ul>';return h;}
S.konuSec=k=>{S.konu=k;ciz();};S.claudeAcKapa=id=>{S.acik['c'+id]=!S.acik['c'+id];ciz();};
// Doktora sorulacaklar: bekleyen maddeleri düz metin olarak panoya kopyalar (istenen yere yapıştırılır)
async function panoya(t){try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(t);return true;}}catch(e){}
  try{const ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,t.length);const ok=document.execCommand('copy');ta.remove();return ok;}catch(e){return false;}}
S.sorulariKopyala=async()=>{const R=(S.v.randevu||[]).filter(r=>r.tur==='soru');const B=R.filter(r=>r.durum==='bekliyor');const L=(B.length?B:R).slice().sort((a,b)=>(a.oncelik||2)-(b.oncelik||2)||(a.sira||0)-(b.sira||0));
  if(!L.length){toast('Listede soru yok','amber');return;}
  const t='Doktora sorulacaklar ('+trT(bugun())+')\n\n'+L.map((r,i)=>(i+1)+'. '+r.baslik+(r.brans?' ['+r.brans+']':'')+(r.notu?'\n   '+r.notu:'')).join('\n');
  if(await panoya(t)){toast(L.length+' soru kopyalandı, istediğin yere yapıştırabilirsin','green');return;}
  pencere('sg-m-kop','🖨️ Doktora sorulacaklar',`<div class="sg-not" style="margin-bottom:8px">Otomatik kopyalanamadı. Metne uzun basıp tümünü seç ve kopyala.</div><textarea readonly rows="14" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border2);border-radius:10px;background:var(--surface2);color:var(--text);font:13px var(--fu)">${esc(t)}</textarea>`,`<button class="btn btn-secondary" onclick="closeModal('sg-m-kop')">Kapat</button>`);};
S.sorAc=()=>{S.git('claude');setTimeout(()=>document.getElementById('sg-soru')?.focus(),100);};
S.sorKaydet=async()=>{const el=document.getElementById('sg-soru');const t=(el&&el.value||'').trim();if(!t){toast('Soruyu yaz','amber');return;}
  try{await ekle('claude','saglik_claude',{tur:'soru',konu:'genel',metin:t,durum:'bekliyor'});S.v.claude.sort((a,b)=>a.zaman<b.zaman?1:-1);toast('Soru kaydedildi','green');ciz();}catch(e){toast('Kaydedilemedi: '+e.message,'red');}};
S.silClaude=async id=>{try{await sil('claude','saglik_claude',id);ciz();}catch(e){toast('Silinemedi','red');}};

// ───────────────────────────────────────── pencere altyapısı
function pencere(id,baslik,govde,altH){let m=document.getElementById(id);if(!m){m=document.createElement('div');m.className='modal-ov';m.id=id;document.body.appendChild(m);}
  m.innerHTML=`<div class="modal"><div class="modal-handle"></div><div class="modal-head"><h3>${baslik}</h3><button class="modal-close" onclick="closeModal('${id}')">✕</button></div><div class="modal-body">${govde}</div>${altH?`<div class="modal-foot">${altH}</div>`:''}</div>`;openModal(id);return m;}
const kapat=id=>{try{closeModal(id);}catch(e){}};
const deg=id=>{const e=document.getElementById(id);return e?e.value:'';};
function puanHtml(on,k,adet,secili,renkFn){return `<div class="sg-puan" id="${on}-${k}">${Array.from({length:adet},(_,i)=>i+1).map(v=>`<button type="button" class="${secili===v?'on':''}" style="${secili===v?'background:'+renkFn(v):''}" data-v="${v}" onclick="SGL.puanSec('${on}','${k}',${v},${adet})">${v}</button>`).join('')}</div>`;}
const iyiRenk=(v,n)=>{const t=(v-1)/(n-1);return `rgb(${Math.round(255*(1-t))},${Math.round(70+160*t)},${Math.round(70*(1-t)+118*t)})`;};
S.P={};S.puanSec=(on,k,v,n)=>{(S.P[on]=S.P[on]||{})[k]=v;document.querySelectorAll('#'+on+'-'+k+' button').forEach(b=>{const s=Number(b.dataset.v)===v;b.classList.toggle('on',s);b.style.background=s?(on==='at'&&k==='siddet'?iyiRenk(n-v+1,n):iyiRenk(v,n)):'';});if(S._durum)S._durum();};
function chipsHtml(on,k,liste,secili){return `<div class="sg-chips" id="${on}-${k}">${liste.map(x=>`<button type="button" class="${(secili||[]).includes(x)?'on':''}" data-x="${esc(x)}" onclick="SGL.chipSec('${on}','${k}',this)">${esc(x)}</button>`).join('')}</div>`;}
S.C={};S.chipSec=(on,k,b,tek)=>{const S2=(S.C[on]=S.C[on]||{});const L=S2[k]=S2[k]||[];const x=b.dataset.x;const i=L.indexOf(x);if(i>=0)L.splice(i,1);else{if(tek)L.length=0;L.push(x);}
  document.querySelectorAll('#'+on+'-'+k+' button').forEach(y=>y.classList.toggle('on',L.includes(y.dataset.x)));if(S._durum)S._durum();};
async function kaydetVeCiz(fn,mesaj,pid){try{await fn();if(pid)kapat(pid);toast(mesaj||'Kaydedildi','green');ciz();hatirlatPlanla();try{if(typeof renderDashBugun==='function'&&document.getElementById('page-dashboard')?.classList.contains('active'))renderDashBugun();}catch(e){}}catch(e){console.error(e);toast('Kaydedilemedi: '+(e.message||e),'red');}}

// ───────────────────────────────────────── hızlı kayıt
S.hizliMenu=()=>{const L=[['⚡ Atak','SGL.atakAc()'],['☀️ Sabah formu','SGL.sabahAc(true)'],['⚖️ Kilo','SGL.kiloAc()'],['🩺 Tansiyon','SGL.tansiyonAc()'],['❤️ Nabız','SGL.nabizAc()'],['💧 +1 su','SGL.suEkle(1)'],['☕ Kahve','SGL.kafeinAc()'],['🏋️ Ev antrenmanı','SGL.evAc()'],['🗺️ Aktivite','SGL.aktiviteAc()'],['👣 Adım','SGL.adimAc()'],['📏 Bel','SGL.kiloAc(\'bel\')'],['🧪 Tahlil değeri','SGL.tahlilAc()'],['🩻 Randevu','SGL.randevuAc(null,\'randevu\')'],['💬 Claude\'a sor','SGL.sorAc()']];
  pencere('sg-m-hizli','＋ Hızlı kayıt',`<div class="sg-chips" style="gap:8px">${L.map(([a,f])=>`<button style="padding:10px 14px;font-size:14px" onclick="closeModal('sg-m-hizli');${f}">${a}</button>`).join('')}</div>`);};

// Kilo / bel
S.kiloAc=(tur)=>{tur=tur||'kilo';const s=sonOlcum(tur);pencere('sg-m-kilo',tur==='bel'?'📏 Bel ölçüsü':'⚖️ Kilo',`<div class="sg-f"><label>${tur==='bel'?'Bel (cm)':'Kilo (kg)'}</label><input id="sg-k-d" type="text" inputmode="decimal" placeholder="${s?n1(s.deger):''}" autofocus></div>
  ${tur==='kilo'?`<div class="sg-f-iki"><div class="sg-f"><label>Yağ oranı % (isteğe bağlı)</label><input id="sg-k-y" type="text" inputmode="decimal"></div><div class="sg-f"><label>Bel cm (isteğe bağlı)</label><input id="sg-k-b" type="text" inputmode="decimal"></div></div>`:''}
  <div class="sg-f"><label>Zaman</label><input id="sg-k-z" type="datetime-local" value="${dtYerel()}"></div><div class="sg-not">${tur==='kilo'?'En doğrusu sabah, tuvaletten sonra, aç karnına.':'Göbek hizasından, nefes verirken.'}</div>`,
  `<button class="btn btn-primary btn-full" onclick="SGL.kiloKaydet('${tur}')">Kaydet</button>`);};
S.kiloKaydet=async tur=>{const v=sayi(deg('sg-k-d'));if(v==null||v<=0){toast('Değer gir','amber');return;}const z=new Date(deg('sg-k-z')||Date.now()).toISOString();
  kaydetVeCiz(async()=>{await ekle('olcum','saglik_olcum',{tur,deger:v,zaman:z});const y=sayi(deg('sg-k-y')),b=sayi(deg('sg-k-b'));if(y)await ekle('olcum','saglik_olcum',{tur:'yag',deger:y,zaman:z});if(b)await ekle('olcum','saglik_olcum',{tur:'bel',deger:b,zaman:z});},'Kaydedildi','sg-m-kilo');};
S.silOlcum=async id=>{if(!confirm('Bu ölçüm silinsin mi?'))return;kaydetVeCiz(()=>sil('olcum','saglik_olcum',id),'Silindi');};

// Tansiyon
S.tansiyonAc=()=>{const h=new Date().getHours();pencere('sg-m-ta','🩺 Tansiyon',`<div class="sg-f-ik"><div class="sg-f"><label>Büyük</label><input id="sg-t-b" type="number" inputmode="numeric" placeholder="120"></div><div class="sg-f"><label>Küçük</label><input id="sg-t-k" type="number" inputmode="numeric" placeholder="80"></div><div class="sg-f"><label>Nabız</label><input id="sg-t-n" type="number" inputmode="numeric" placeholder="70"></div></div>
  <div class="sg-f"><label>Ne zaman?</label>${chipsHtml('ta','b',['sabah','aksam','atak','spor','diger'],[h<12?'sabah':h>=18?'aksam':'diger'])}</div><div class="sg-f"><label>Zaman</label><input id="sg-t-z" type="datetime-local" value="${dtYerel()}"></div><div class="sg-f"><label>Not</label><input id="sg-t-not" type="text"></div>
  <div class="sg-not">5 dk otur, sırt dayalı, kol kalp hizasında, konuşmadan ölç. 2 ölçüm alırsan ikisini de gir.</div>`,`<button class="btn btn-primary btn-full" onclick="SGL.tansiyonKaydet()">Kaydet</button>`);S.C.ta={b:[h<12?'sabah':h>=18?'aksam':'diger']};};
S.nabizAc=an=>{const h=new Date().getHours();const vs=an||'gunluk';S.C.nb={b:[vs]};
  pencere('sg-m-nb','❤️ Nabız',`<div class="sg-f"><label>Hangi an?</label><div class="sg-chips" id="nb-b">${NABIZ_AN.map(([k,ad])=>`<button type="button" class="${k===vs?'on':''}" data-x="${k}" onclick="SGL.chipSec('nb','b',this,true)">${ad}</button>`).join('')}</div></div>
  <div class="sg-f-iki"><div class="sg-f"><label>Nabız (bpm)</label><input id="sg-nb-d" type="number" inputmode="numeric" placeholder="72" style="font-size:22px;font-weight:700"></div><div class="sg-f"><label>Zaman</label><input id="sg-nb-z" type="datetime-local" value="${dtYerel()}"></div></div>
  <div class="sg-f"><label>Not</label><input id="sg-nb-n" type="text" placeholder="isteğe bağlı"></div>
  <div class="sg-not">Dinlenme: en az 5 dk oturduktan / uzandıktan sonra. "Atak anı" seçersen son 1 saatteki atak kaydına da yazılır.</div>`,`<button class="btn btn-primary btn-full" onclick="SGL.nabizKaydet()">Kaydet</button>`);setTimeout(()=>{const e=document.getElementById('sg-nb-d');if(e)e.focus();},120);};
S.nabizKaydet=()=>{const d=sayi(deg('sg-nb-d'));const b=(S.C.nb&&S.C.nb.b||[])[0];if(!d||d<30||d>230){toast('Nabzı gir (30–230)','amber');return;}if(!b){toast('Hangi an olduğunu seç','amber');return;}
  const z=new Date(deg('sg-nb-z')||Date.now());
  kaydetVeCiz(async()=>{await ekle('olcum','saglik_olcum',{tur:'nabiz',deger:d,baglam:b,zaman:z.toISOString(),notu:deg('sg-nb-n')||null});
    if(b==='atak'){const a=(S.v.atak||[]).filter(x=>!x.nabiz&&Math.abs(new Date(x.zaman)-z)<=3600e3).sort((x,y)=>new Date(y.zaman)-new Date(x.zaman))[0];if(a)await guncelle('atak','saglik_atak',a.id,{nabiz:d});}},'❤️ '+d+' bpm · '+nabizAd(b),'sg-m-nb');};
S.tansiyonKaydet=()=>{const b=sayi(deg('sg-t-b')),k=sayi(deg('sg-t-k')),n=sayi(deg('sg-t-n'));if(!b||!k){toast('Büyük ve küçük tansiyonu gir','amber');return;}
  kaydetVeCiz(()=>ekle('olcum','saglik_olcum',{tur:'tansiyon',deger:b,deger2:k,deger3:n,baglam:(S.C.ta.b||[])[0]||null,zaman:new Date(deg('sg-t-z')||Date.now()).toISOString(),notu:deg('sg-t-not')||null}),'Kaydedildi','sg-m-ta');};
S.chipTek=(on,k,b)=>S.chipSec(on,k,b,true);

// Atak
const BELIRTI=['Baş dönmesi','Boşluk hissi','Düşme hissi','Dalga hissi','Uyuşma / karıncalanma','Çarpıntı','Nefes darlığı','İç huzursuzluk','Görme değişikliği','Terleme','Göğüste sıkışma','Bulantı'];
const TETIK=['Aç karnına kahve','Açlık','Az / kötü uyku','Stres','Heyecan / sohbet','Efor','Yemek sonrası','Eğilip kalkma','Sıcak','Kalabalık','Araba','Belirsiz'];
const DURUM=['Dinlenirken','İşte','Spor / yürüyüş','Yemekte','Yatakta / uykuda','Sohbette','Araba','Diğer'];
const IYI=['Uzanmak','Nefes egzersizi','Su içmek','Bir şey yemek','Yürümek','Temiz hava','Kriz ilacı','Kendiliğinden geçti'];
S.atakAc=(id)=>{const a=id?(S.v.atak||[]).find(x=>x.id===id):null;S.P.at={siddet:a?a.siddet:null};S.C.at={bel:(a&&a.belirtiler)||[],tet:(a&&a.tetikleyiciler)||[],dur:a&&a.durum?[a.durum]:[],iyi:a&&a.iyi_gelen?a.iyi_gelen.split(', '):[]};
  const k=krizIlac();const kriz=k?krizG(bugun()).length:0;
  pencere('sg-m-atak',a?'⚡ Atak düzenle':'⚡ Atak kaydı',`<div class="sg-f"><label>Ne zaman?</label><input id="sg-a-z" type="datetime-local" value="${dtYerel(a?new Date(a.zaman):new Date())}"></div>
    <div class="sg-f"><label>Şiddet (1 hafif – 10 çok güçlü)</label>${puanHtml('at','siddet',10,a&&a.siddet,v=>iyiRenk(11-v,10))}</div>
    <div class="sg-f"><label>Süre (dakika)</label><input id="sg-a-s" type="number" inputmode="numeric" value="${a&&a.sure_dk||''}" placeholder="ör. 10"></div>
    <div class="sg-f"><label>Belirtiler</label>${chipsHtml('at','bel',BELIRTI,S.C.at.bel)}</div><div class="sg-f"><label>Olası tetikleyiciler</label>${chipsHtml('at','tet',TETIK,S.C.at.tet)}</div>
    <div class="sg-f"><label>O sırada</label><div class="sg-chips" id="at-dur">${DURUM.map(x=>`<button type="button" class="${S.C.at.dur.includes(x)?'on':''}" data-x="${esc(x)}" onclick="SGL.chipTek('at','dur',this)">${esc(x)}</button>`).join('')}</div></div>
    <div class="sg-f-ik"><div class="sg-f"><label>TA büyük</label><input id="sg-a-tb" type="number" inputmode="numeric" value="${a&&a.tansiyon_b||''}"></div><div class="sg-f"><label>TA küçük</label><input id="sg-a-tk" type="number" inputmode="numeric" value="${a&&a.tansiyon_k||''}"></div><div class="sg-f"><label>Nabız</label><input id="sg-a-n" type="number" inputmode="numeric" value="${a&&a.nabiz||''}"></div></div>
    <div class="sg-f"><label>Ne iyi geldi?</label>${chipsHtml('at','iyi',IYI,S.C.at.iyi)}</div>
    ${k&&!a?`<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:12px"><input type="checkbox" id="sg-a-kriz" ${kriz>=(k.max_gunluk||2)?'disabled':''}> ${esc(k.ad)} aldım <span class="sg-ek">bugün ${kriz}/${k.max_gunluk||2}</span></label>`:''}
    <div class="sg-f"><label>Not</label><textarea id="sg-a-not" rows="2">${esc(a&&a.notu||'')}</textarea></div><div class="sg-not">Hızlıysan sadece zamanı ve şiddeti gir, gerisini sonra düzenleyebilirsin. Aynı saatte bir aktivite varsa kendiliğinden eşleşir.</div>`,
    `${a?`<button class="btn btn-secondary" style="flex:1" onclick="SGL.atakSil(${a.id})">Sil</button>`:''}<button class="btn btn-primary" style="flex:2" onclick="SGL.atakKaydet(${a?a.id:'null'})">Kaydet</button>`);};
S.atakKaydet=async id=>{const z=new Date(deg('sg-a-z')||Date.now());const C=S.C.at||{};const krizAl=!!document.getElementById('sg-a-kriz')?.checked;
  const row={zaman:z.toISOString(),siddet:(S.P.at||{}).siddet||null,sure_dk:sayi(deg('sg-a-s')),belirtiler:C.bel||[],tetikleyiciler:C.tet||[],durum:(C.dur||[])[0]||null,
    tansiyon_b:sayi(deg('sg-a-tb')),tansiyon_k:sayi(deg('sg-a-tk')),nabiz:sayi(deg('sg-a-n')),iyi_gelen:(C.iyi||[]).join(', ')||null,notu:deg('sg-a-not')||null};
  const ak=aktiviteEsle(z);if(ak)row.aktivite_id=ak.id;
  kaydetVeCiz(async()=>{if(id)await guncelle('atak','saglik_atak',id,row);else{row.kriz_ilac=krizAl;await ekle('atak','saglik_atak',row);if(krizAl)await krizKaydet(z);}
    if(row.tansiyon_b&&row.tansiyon_k&&!id)await ekle('olcum','saglik_olcum',{tur:'tansiyon',deger:row.tansiyon_b,deger2:row.tansiyon_k,deger3:row.nabiz,baglam:'atak',zaman:row.zaman});
    S.v.atak.sort((a,b)=>a.zaman<b.zaman?-1:1);},id?'Güncellendi':'Atak kaydedildi'+(ak?' · aktiviteyle eşleşti':''),'sg-m-atak');};
S.atakSil=id=>{if(!confirm('Bu atak kaydı silinsin mi?'))return;kaydetVeCiz(()=>sil('atak','saglik_atak',id),'Silindi','sg-m-atak');};
S.checkinAc=()=>{try{if(new Date().getHours()>=20)ckModalAc();else{S.git('ruh');toast('Akşam check-in\'i 20:00\'de açılır','amber');}}catch(e){toast('Check-in açılamadı','red');}};

// İlaç işaretleme
S.ilacTik=async(ilacId,dilim,g)=>{g=g||bugun();const i=(S.v.ilac||[]).find(x=>x.id===ilacId);const r=alimBul(ilacId,g,dilim);
  if(i&&i.tur==='takviye'&&!(r&&r.alindi)){S.takviyeAc(ilacId,dilim,g);return;}
  // döngü: girilmedi → alındı → atlandı → girilmedi
  kaydetVeCiz(async()=>{if(!r)await ekle('alim','saglik_ilac_alim',{ilac_id:ilacId,tarih:g,dilim,alindi:true});
    else if(r.alindi)await guncelle('alim','saglik_ilac_alim',r.id,{alindi:false,zaman:new Date().toISOString()});else await sil('alim','saglik_ilac_alim',r.id);},r?(r.alindi?'Atlandı olarak işaretlendi':'İşaret kaldırıldı'):'✓ Alındı');};
S.takviyeAc=(ilacId,dilim,g)=>{const A=ayar();S.C.tk={s:[]};pencere('sg-m-tk','💊 Bugünkü takviye',`<div class="sg-f"><label>Ne aldın?</label>${chipsHtml('tk','s',A.takviyeler,[])}</div><div class="sg-f"><label>Başka (yaz)</label><input id="sg-tk-d" type="text" placeholder="ör. Çinko"></div>`,
  `<button class="btn btn-secondary" style="flex:1" onclick="SGL.takviyeKaydet(${ilacId},'${dilim}','${g}',false)">Bugün yok</button><button class="btn btn-primary" style="flex:2" onclick="SGL.takviyeKaydet(${ilacId},'${dilim}','${g}',true)">Kaydet</button>`);};
S.takviyeKaydet=async(ilacId,dilim,g,alindi)=>{const L=(S.C.tk.s||[]).slice();const d=deg('sg-tk-d').trim();if(d)L.push(d);if(alindi&&!L.length){toast('Takviyeyi seç ya da "Bugün yok" de','amber');return;}
  kaydetVeCiz(async()=>{await alimYaz(ilacId,g,dilim,alindi,alindi?L.join(', '):null);if(d){const A=ayar();if(!A.takviyeler.includes(d))await ayarKaydet({takviyeler:A.takviyeler.concat([d])});}},'Kaydedildi','sg-m-tk');};
async function alimYaz(ilacId,g,dilim,alindi,secim){const r=alimBul(ilacId,g,dilim);const p={alindi,secim:secim||null,zaman:new Date().toISOString()};if(r)return guncelle('alim','saglik_ilac_alim',r.id,p);return ekle('alim','saglik_ilac_alim',Object.assign({ilac_id:ilacId,tarih:g,dilim},p));}
async function krizKaydet(z){const k=krizIlac();if(!k)return;const g=zGun(z||Date.now());if(krizG(g).length>=(k.max_gunluk||2))throw new Error('Günlük sınır ('+(k.max_gunluk||2)+') doldu');await ekle('alim','saglik_ilac_alim',{ilac_id:k.id,tarih:g,dilim:'kriz',alindi:true,zaman:new Date(z||Date.now()).toISOString()});}
S.krizEkle=()=>{const k=krizIlac();if(!k)return;const n=krizG(bugun()).length,mx=k.max_gunluk||2;if(n>=mx){toast('Bugün '+mx+' tablet sınırına ulaştın. Daha fazla alma; gerekirse doktoruna danış.','red');return;}
  if(k.bitis&&k.bitis<bugun()&&!confirm('Doktorun verdiği kullanım süresi '+trT(k.bitis)+'\'de doldu. Yine de kaydedilsin mi?'))return;
  if(!confirm(k.ad+' aldığını kaydedeyim mi? (bugün '+(n+1)+'/'+mx+')'))return;kaydetVeCiz(()=>krizKaydet(),'Kaydedildi · bugün '+(n+1)+'/'+mx);};
S.krizGeri=()=>{const L=krizG(bugun());const r=L[L.length-1];if(r&&confirm('Son kriz ilacı kaydı geri alınsın mı?'))kaydetVeCiz(()=>sil('alim','saglik_ilac_alim',r.id),'Geri alındı');};
S.ilacFormAc=id=>{const i=id?(S.v.ilac||[]).find(x=>x.id===id):null;S.C.il={z:(i&&i.zamanlar)||['sabah'],t:[i?i.tur:'duzenli']};
  pencere('sg-m-ilac',i?'💊 İlacı düzenle':'💊 İlaç / takviye ekle',`<div class="sg-f"><label>Ad</label><input id="sg-i-ad" value="${esc(i&&i.ad||'')}" placeholder="ör. İlaç adı ve dozu"></div><div class="sg-f-iki"><div class="sg-f"><label>Doz</label><input id="sg-i-doz" value="${esc(i&&i.doz||'')}"></div><div class="sg-f"><label>Etken madde</label><input id="sg-i-et" value="${esc(i&&i.etken||'')}"></div></div>
    <div class="sg-f"><label>Tür</label><div class="sg-chips" id="il-t">${[['duzenli','Düzenli'],['takviye','Takviye (değişken)'],['gerektiginde','Gerektiğinde']].map(([k,a])=>`<button type="button" class="${S.C.il.t.includes(k)?'on':''}" data-x="${k}" onclick="SGL.chipTek('il','t',this)">${a}</button>`).join('')}</div></div>
    <div class="sg-f"><label>Ne zaman?</label><div class="sg-chips" id="il-z">${[['sabah','☀️ Sabah'],['ogle','🕛 Öğle'],['aksam','🌙 Akşam']].map(([k,a])=>`<button type="button" class="${S.C.il.z.includes(k)?'on':''}" data-x="${k}" onclick="SGL.chipSec('il','z',this)">${a}</button>`).join('')}</div></div>
    <div class="sg-f-iki"><div class="sg-f"><label>Başlangıç</label><input id="sg-i-b" type="date" value="${i&&i.baslangic||bugun()}"></div><div class="sg-f"><label>Bitiş (isteğe bağlı)</label><input id="sg-i-s" type="date" value="${i&&i.bitis||''}"></div></div>
    <div class="sg-f"><label>Günde en fazla (gerektiğinde ilaçlar)</label><input id="sg-i-m" type="number" value="${i&&i.max_gunluk||''}"></div><div class="sg-f"><label>Not</label><input id="sg-i-not" value="${esc(i&&i.notu||'')}"></div>
    ${i?`<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="sg-i-ak" ${i.aktif?'checked':''}> Kullanılıyor</label>`:''}<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-top:8px"><input type="checkbox" id="sg-i-is" ${i&&ayar().isaretIlac===i.id?'checked':''}> Ruh hali grafiklerinde başlangıç çizgisi olarak göster</label>`,
    `<button class="btn btn-primary btn-full" onclick="SGL.ilacKaydet(${i?i.id:'null'})">Kaydet</button>`);};
S.ilacKaydet=id=>{const ad=deg('sg-i-ad').trim();if(!ad){toast('Ad gir','amber');return;}const row={ad,doz:deg('sg-i-doz')||null,etken:deg('sg-i-et')||null,tur:(S.C.il.t||['duzenli'])[0],zamanlar:(S.C.il.t||[])[0]==='gerektiginde'?[]:(S.C.il.z||[]),baslangic:deg('sg-i-b')||null,bitis:deg('sg-i-s')||null,max_gunluk:sayi(deg('sg-i-m')),notu:deg('sg-i-not')||null};
  if(id)row.aktif=!!document.getElementById('sg-i-ak')?.checked;else row.sira=(S.v.ilac||[]).length;
  const isr=!!document.getElementById('sg-i-is')?.checked;
  kaydetVeCiz(async()=>{const x=id?await guncelle('ilac','saglik_ilac',id,row):await ekle('ilac','saglik_ilac',row);const xid=x&&x.id||id;if(isr&&ayar().isaretIlac!==xid)await ayarKaydet({isaretIlac:xid});else if(!isr&&ayar().isaretIlac===xid)await ayarKaydet({isaretIlac:null});},'Kaydedildi','sg-m-ilac');};

// Su, kafein, öğün
S.suEkle=async d=>{const g=bugun();if(d<0){const L=girisG('su',g);const r=L[L.length-1];if(!r)return;kaydetVeCiz(()=>sil('giris','saglik_giris',r.id),'Son su kaydı silindi');return;}
  kaydetVeCiz(()=>ekle('giris','saglik_giris',{tur:'su',miktar:200}),'💧 '+litre(suG(g)+200));};
S.kafeinAc=()=>{const h=new Date().getHours();const kahvalti=girisG('ogun',bugun()).some(x=>x.alt==='kahvalti')||sabahG(bugun())?.kahvalti;S.C.kf={t:['Americano'],a:[kahvalti?'Tok':'Aç karnına']};
  pencere('sg-m-kf','☕ Kafein',`<div class="sg-f"><label>Ne içtin?</label><div class="sg-chips" id="kf-t">${['Americano','Türk kahvesi','Filtre','Espresso','Latte','Neskafe','Çay','Enerji içeceği'].map(x=>`<button type="button" class="${S.C.kf.t.includes(x)?'on':''}" data-x="${x}" onclick="SGL.chipTek('kf','t',this)">${x}</button>`).join('')}</div></div>
    <div class="sg-f"><label>Mide durumu</label><div class="sg-chips" id="kf-a">${['Aç karnına','Tok'].map(x=>`<button type="button" class="${S.C.kf.a.includes(x)?'on':''}" data-x="${x}" onclick="SGL.chipTek('kf','a',this)">${x}</button>`).join('')}</div></div>
    <div class="sg-f"><label>Kaç fincan / bardak?</label><div class="sg-say"><button type="button" onclick="SGL.sayac('sg-kf-n',-1)">−</button><b id="sg-kf-n">1</b><button type="button" onclick="SGL.sayac('sg-kf-n',1)">＋</button></div></div>`,`<button class="btn btn-primary btn-full" onclick="SGL.kafeinKaydet()">Kaydet</button>`);};
S.sayac=(id,d,mn,mx)=>{const e=document.getElementById(id);if(!e)return;const v=Math.max(mn==null?0:mn,Math.min(mx==null?20:mx,(Number(e.textContent)||0)+d));e.textContent=v;if(S._durum)S._durum();};
S.kafeinKaydet=()=>{const n=Number(document.getElementById('sg-kf-n').textContent)||1;kaydetVeCiz(()=>ekle('giris','saglik_giris',{tur:'kafein',miktar:n,alt:(S.C.kf.t||[])[0]||'Kahve',ac:(S.C.kf.a||[])[0]==='Aç karnına'}),'☕ Kaydedildi','sg-m-kf');};
S.silGiris=id=>kaydetVeCiz(()=>sil('giris','saglik_giris',id),'Silindi');

// Adım (saat bağlanana kadar elle)
S.adimAc=()=>{const r=gunluk(bugun());pencere('sg-m-adim','👣 Adım',`<div class="sg-f"><label>Tarih</label><input id="sg-ad-g" type="date" value="${bugun()}"></div><div class="sg-f"><label>Adım</label><input id="sg-ad-n" type="number" inputmode="numeric" value="${r&&r.adim||''}"></div><div class="sg-f"><label>Mesafe km (isteğe bağlı)</label><input id="sg-ad-m" type="text" inputmode="decimal"></div><div class="sg-not">Saat Health Connect üzerinden bağlanınca adım kendiliğinden gelir.</div>`,`<button class="btn btn-primary btn-full" onclick="SGL.adimKaydet()">Kaydet</button>`);};
S.adimKaydet=()=>{const g=deg('sg-ad-g')||bugun(),n=sayi(deg('sg-ad-n'));if(n==null){toast('Adım gir','amber');return;}const m=sayi(deg('sg-ad-m'));const row={tarih:g,adim:Math.round(n),guncelleme:new Date().toISOString()};if(m)row.mesafe_m=m*1000;
  kaydetVeCiz(()=>upsert('gunluk','saglik_gunluk',row,'kullanici_id,tarih',x=>x.tarih),'Kaydedildi','sg-m-adim');};

// Aktivite (elle) ve ev antrenmanı
S.aktiviteAc=()=>{S.C.ak={t:['yuruyus']};pencere('sg-m-ak','🗺️ Aktivite',`<div class="sg-f"><label>Tür</label><div class="sg-chips" id="ak-t">${DIS_TURLER.concat(['diger']).map(k=>`<button type="button" class="${S.C.ak.t.includes(k)?'on':''}" data-x="${k}" onclick="SGL.chipTek('ak','t',this)">${TUR_AD[k]}</button>`).join('')}</div></div>
  <div class="sg-f"><label>Başlangıç</label><input id="sg-ak-z" type="datetime-local" value="${dtYerel(new Date(Date.now()-3600e3))}"></div><div class="sg-f-ik"><div class="sg-f"><label>Süre dk</label><input id="sg-ak-s" type="number" inputmode="numeric"></div><div class="sg-f"><label>Km</label><input id="sg-ak-m" type="text" inputmode="decimal"></div><div class="sg-f"><label>kcal</label><input id="sg-ak-k" type="number" inputmode="numeric"></div></div>
  <div class="sg-f-iki"><div class="sg-f"><label>Ort. nabız</label><input id="sg-ak-n" type="number" inputmode="numeric"></div><div class="sg-f"><label>İrtifa kazancı m</label><input id="sg-ak-i" type="number" inputmode="numeric"></div></div><div class="sg-f"><label>Not</label><input id="sg-ak-not"></div>
  <div class="sg-not">Strava bağlanınca bunlar rota ve haritayla otomatik gelir; aynı aktivite iki kez sayılmaz.</div>`,`<button class="btn btn-primary btn-full" onclick="SGL.aktiviteKaydet()">Kaydet</button>`);};
S.aktiviteKaydet=()=>{const z=new Date(deg('sg-ak-z')||Date.now());const s=sayi(deg('sg-ak-s'));const row={tur:(S.C.ak.t||['yuruyus'])[0],baslangic:z.toISOString(),sure_sn:s?Math.round(s*60):null,bitis:s?new Date(z.getTime()+s*60000).toISOString():null,mesafe_m:sayi(deg('sg-ak-m'))?sayi(deg('sg-ak-m'))*1000:null,kcal:sayi(deg('sg-ak-k')),nabiz_ort:sayi(deg('sg-ak-n')),irtifa_m:sayi(deg('sg-ak-i')),notu:deg('sg-ak-not')||null};
  kaydetVeCiz(async()=>{await ekle('aktivite','saglik_aktivite',row);S.v.aktivite.sort((a,b)=>a.baslangic<b.baslangic?-1:1);S.gun=zGun(row.baslangic);},'Kaydedildi','sg-m-ak');};
const HAREKET=['Şınav','Squat','Mekik','Plank','Lunge','Burpee','Dumbbell curl','Omuz press','Barfiks','Dips','Jumping jack','İp atlama','Bisiklet (sabit)','Esneme'];
S.evAc=()=>{const son=aktiviteler().filter(a=>a.tur==='ev').slice(-1)[0];S.ev=(son&&son.hareketler||[]).map(x=>Object.assign({},x));if(!S.ev.length)S.ev=[{ad:'Şınav',set:3,tekrar:10}];
  pencere('sg-m-ev','🏋️ Ev antrenmanı',`<div class="sg-f-iki"><div class="sg-f"><label>Başlangıç</label><input id="sg-ev-z" type="datetime-local" value="${dtYerel(new Date(Date.now()-2700e3))}"></div><div class="sg-f"><label>Süre dk</label><input id="sg-ev-s" type="number" inputmode="numeric" placeholder="45"></div></div>
    <div class="sg-f"><label>Hareketler <small>(son antrenmandan kopyalandı)</small></label><div id="sg-ev-l"></div><div class="sg-chips" style="margin-top:6px">${HAREKET.map(x=>`<button type="button" onclick="SGL.evEkle('${x}')">＋ ${x}</button>`).join('')}</div></div>
    <div class="sg-f"><label>Nasıldı? (isteğe bağlı)</label><input id="sg-ev-not" placeholder="ör. zorlandım, baş dönmesi olmadı"></div>`,`<button class="btn btn-primary btn-full" onclick="SGL.evKaydet()">Kaydet</button>`);evListe();};
function evListe(){const el=document.getElementById('sg-ev-l');if(!el)return;el.innerHTML=S.ev.map((x,i)=>`<div style="display:grid;grid-template-columns:1.6fr .7fr .8fr .7fr auto;gap:5px;margin-bottom:5px;align-items:center"><input value="${esc(x.ad)}" onchange="SGL.ev[${i}].ad=this.value" style="padding:8px"><input type="number" inputmode="numeric" value="${x.set||''}" placeholder="set" onchange="SGL.ev[${i}].set=+this.value" style="padding:8px"><input type="number" inputmode="numeric" value="${x.tekrar||''}" placeholder="tekrar" onchange="SGL.ev[${i}].tekrar=+this.value" style="padding:8px"><input type="text" inputmode="decimal" value="${x.kg||''}" placeholder="kg" onchange="SGL.ev[${i}].kg=parseFloat(this.value.replace(',','.'))||null" style="padding:8px"><button class="sg-x" onclick="SGL.ev.splice(${i},1);SGL.evListe()">✕</button></div>`).join('');
  el.querySelectorAll('input').forEach(i=>{i.style.border='1px solid var(--border2)';i.style.borderRadius='8px';i.style.background='var(--bg2)';i.style.color='var(--text)';i.style.minWidth='0';});}
S.evListe=evListe;S.evEkle=ad=>{S.ev.push({ad,set:3,tekrar:10});evListe();};
S.evKaydet=()=>{const z=new Date(deg('sg-ev-z')||Date.now());const s=sayi(deg('sg-ev-s'));const H=S.ev.filter(x=>x.ad);if(!H.length){toast('En az bir hareket ekle','amber');return;}
  kaydetVeCiz(async()=>{await ekle('aktivite','saglik_aktivite',{tur:'ev',baslangic:z.toISOString(),sure_sn:s?Math.round(s*60):null,bitis:s?new Date(z.getTime()+s*60000).toISOString():null,hareketler:H,notu:deg('sg-ev-not')||null});S.v.aktivite.sort((a,b)=>a.baslangic<b.baslangic?-1:1);},'💪 Antrenman kaydedildi · bu hafta '+(evHaftalar(1)[0].gun+1)+' gün','sg-m-ev');};
S.silAktivite=id=>{if(!confirm('Bu aktivite silinsin mi?'))return;kaydetVeCiz(()=>sil('aktivite','saglik_aktivite',id),'Silindi');};

// Tahlil değeri, randevu
S.tahlilAc=()=>pencere('sg-m-th','🧪 Tahlil değeri',`<div class="sg-f-iki"><div class="sg-f"><label>Tarih</label><input id="sg-th-t" type="date" value="${bugun()}"></div><div class="sg-f"><label>Grup</label><input id="sg-th-g" list="sg-th-gl" placeholder="Şeker, Kan yağları…"><datalist id="sg-th-gl">${[...new Set((S.v.tahlil||[]).map(t=>t.grup).filter(Boolean))].map(g=>`<option value="${esc(g)}">`).join('')}</datalist></div></div>
  <div class="sg-f"><label>Test</label><input id="sg-th-a" list="sg-th-al"><datalist id="sg-th-al">${[...new Set((S.v.tahlil||[]).map(t=>t.test))].map(g=>`<option value="${esc(g)}">`).join('')}</datalist></div><div class="sg-f-ik"><div class="sg-f"><label>Değer</label><input id="sg-th-d" type="text" inputmode="decimal"></div><div class="sg-f"><label>Ref. alt</label><input id="sg-th-ra" type="text" inputmode="decimal"></div><div class="sg-f"><label>Ref. üst</label><input id="sg-th-ru" type="text" inputmode="decimal"></div></div>
  <div class="sg-f-iki"><div class="sg-f"><label>Birim</label><input id="sg-th-b"></div><div class="sg-f"><label>Laboratuvar</label><input id="sg-th-l"></div></div><div class="sg-not">Raporu projeye gönderirsen ben de işleyebilirim.</div>`,`<button class="btn btn-primary btn-full" onclick="SGL.tahlilKaydet()">Kaydet</button>`);
S.tahlilKaydet=()=>{const test=deg('sg-th-a').trim();const t=deg('sg-th-t');if(!test||!t){toast('Test ve tarih gir','amber');return;}const once=(S.v.tahlil||[]).filter(x=>x.test===test).slice(-1)[0]||{};const v=sayi(deg('sg-th-d'));
  const row={tarih:t,test,grup:deg('sg-th-g')||once.grup||null,deger:v,deger_metin:v==null?deg('sg-th-d')||null:null,birim:deg('sg-th-b')||once.birim||null,ref_alt:sayi(deg('sg-th-ra'))??once.ref_alt??null,ref_ust:sayi(deg('sg-th-ru'))??once.ref_ust??null,ref_metin:once.ref_metin||null,lab:deg('sg-th-l')||null,kaynak:'elle'};
  kaydetVeCiz(()=>upsert('tahlil','saglik_tahlil',row,'kullanici_id,tarih,test',x=>x.tarih+'|'+x.test),'Kaydedildi','sg-m-th');};
S.randevuAc=(id,tur)=>{const r=id?(S.v.randevu||[]).find(x=>x.id===id):null;tur=r?r.tur:tur||'randevu';
  pencere('sg-m-rd',tur==='randevu'?'🩻 Randevu':tur==='tetkik'?'🧾 Tetkik':'❓ Doktora soru',`<div class="sg-f"><label>${tur==='soru'?'Soru':'Başlık'}</label><input id="sg-rd-b" value="${esc(r&&r.baslik||'')}"></div>${tur!=='soru'?`<div class="sg-f-iki"><div class="sg-f"><label>Branş</label><input id="sg-rd-br" value="${esc(r&&r.brans||'')}" placeholder="Psikiyatri, Endokrinoloji…"></div><div class="sg-f"><label>Yer</label><input id="sg-rd-y" value="${esc(r&&r.yer||'')}"></div></div>
    <div class="sg-f-iki"><div class="sg-f"><label>Tarih</label><input id="sg-rd-t" type="date" value="${r&&r.tarih||''}"></div><div class="sg-f"><label>Saat</label><input id="sg-rd-s" type="time" value="${r&&r.saat?String(r.saat).slice(0,5):''}"></div></div>`:''}<div class="sg-f"><label>Not</label><input id="sg-rd-n" value="${esc(r&&r.notu||'')}"></div>`,
    `${r?`<button class="btn btn-secondary" style="flex:1" onclick="SGL.randevuSil(${r.id})">Sil</button>`:''}<button class="btn btn-primary" style="flex:2" onclick="SGL.randevuKaydet(${r?r.id:'null'},'${tur}')">Kaydet</button>`);};
S.randevuKaydet=(id,tur)=>{const b=deg('sg-rd-b').trim();if(!b){toast('Başlık gir','amber');return;}const row={tur,baslik:b,brans:deg('sg-rd-br')||null,yer:deg('sg-rd-y')||null,tarih:deg('sg-rd-t')||null,saat:deg('sg-rd-s')||null,notu:deg('sg-rd-n')||null};
  kaydetVeCiz(()=>id?guncelle('randevu','saglik_randevu',id,row):ekle('randevu','saglik_randevu',row),'Kaydedildi','sg-m-rd');};
S.randevuTik=id=>{const r=(S.v.randevu||[]).find(x=>x.id===id);if(!r)return;kaydetVeCiz(()=>guncelle('randevu','saglik_randevu',id,{durum:r.durum==='yapildi'?'bekliyor':'yapildi'}),r.durum==='yapildi'?'Bekliyor':'✓ Yapıldı');};
S.randevuSil=id=>{if(!confirm('Silinsin mi?'))return;kaydetVeCiz(()=>sil('randevu','saglik_randevu',id),'Silindi','sg-m-rd');};
S.sigaraAyarAc=()=>{const s=ayar().sigara;pencere('sg-m-sg','🚭 Sigarasız günler',`<div class="sg-f"><label>Bırakma tarihi</label><input id="sg-sg-t" type="date" value="${s.birakis||''}"></div><div class="sg-f-iki"><div class="sg-f"><label>Paket fiyatı ₺</label><input id="sg-sg-f" type="number" value="${s.paketFiyat}"></div><div class="sg-f"><label>Günde kaç paket içiyordun?</label><input id="sg-sg-p" type="text" inputmode="decimal" value="${s.gunlukPaket}"></div></div>`,`<button class="btn btn-primary btn-full" onclick="SGL.sigaraKaydet()">Kaydet</button>`);};
S.sigaraKaydet=()=>kaydetVeCiz(()=>ayarKaydet({sigara:{birakis:deg('sg-sg-t'),paketFiyat:sayi(deg('sg-sg-f'))||0,gunlukPaket:sayi(deg('sg-sg-p'))||1}}),'Kaydedildi','sg-m-sg');

S.hedefAc=()=>{const H=ayar().hedef;const f=(id,ad,v,ek)=>`<div class="sg-f"><label>${ad}</label><input id="sg-h-${id}" ${ek||'type="text" inputmode="decimal"'} value="${v==null?'':esc(v)}"></div>`;
  pencere('sg-m-hedef','🎯 Hedefler',`<div class="sg-f-iki">${f('kilo','Hedef kilo (kg)',H.kilo)}${f('kiloTarih','Hedef tarihi',H.kiloTarih,'type="date"')}</div><div class="sg-f-iki">${f('boy','Boy (cm)',H.boy)}${f('adim','Günlük adım',H.adim)}</div><div class="sg-f-iki">${f('su','Su (ml / gün)',H.su)}${f('uyku','Uyku (saat)',H.uyku)}</div><div class="sg-f-iki">${f('spor','Haftalık spor günü',H.spor)}${f('kafein','En fazla kahve / gün',H.kafein)}</div>`,
  `<button class="btn btn-primary btn-full" onclick="SGL.hedefKaydet()">Kaydet</button>`);};
S.hedefKaydet=()=>{const h={};['kilo','boy','adim','su','spor','kafein','uyku'].forEach(k=>{const v=sayi(deg('sg-h-'+k));if(v!=null)h[k]=v;});h.kiloTarih=deg('sg-h-kiloTarih')||null;kaydetVeCiz(()=>ayarKaydet({hedef:Object.assign({},((S.v.ayar||{}).veri||{}).hedef||{},h)}),'Hedefler kaydedildi','sg-m-hedef');};

// ───────────────────────────────────────── SABAH FORMU (tek seferde; 09:00–14:00 saat başı bildirim sunucudan)
S.sabahAc=async(duzenle)=>{await yukle();const g=bugun();const s=sabahG(g);
  if(s&&!duzenle){toast('Bugünün sabah formu tamam ✓','green');return;}
  const H=ayar();const plan=ilacPlan(g).filter(x=>x.dilim==='sabah');const hcUyku=gunluk(g)?.uyku_dk;
  S.P.sb={uyku:s&&s.uyku_kalite,uyanis:s&&s.uyanis};S.C.sb={gece:s?[s.gece_atak?'Evet':'Hayır']:[],kah:s?[s.kahvalti?'Yaptım':'Henüz yapmadım']:[],tk:[]};S.sbIlac={};
  plan.forEach(x=>{const r=alimBul(x.ilac.id,g,'sabah');if(r)S.sbIlac[x.ilac.id]=r.alindi?(x.ilac.tur==='takviye'?(r.secim||'Alındı'):'ok'):'no';if(x.ilac.tur==='takviye'&&r&&r.secim)S.C.sb.tk=r.secim.split(', ');});
  const ilacH=plan.map(x=>x.ilac.tur==='takviye'?`<div class="sg-f"><label>💊 ${esc(x.ilac.ad)} <small>— bugün ne aldın?</small></label>${chipsHtml('sb','tk',H.takviyeler.concat(['Bugün yok']),S.C.sb.tk)}<input id="sg-sb-tkd" type="text" placeholder="Başka (yaz)" style="margin-top:6px"></div>`
    :`<div class="sg-ilac"><div class="ad">${esc(x.ilac.ad)}${x.ilac.doz?' <span class="sg-ek">'+esc(x.ilac.doz)+'</span>':''}</div><div class="sg-chips" id="sbi-${x.ilac.id}"><button type="button" class="${S.sbIlac[x.ilac.id]==='ok'?'on':''}" onclick="SGL.sbIlacSec(${x.ilac.id},'ok')">✓ Aldım</button><button type="button" class="${S.sbIlac[x.ilac.id]==='no'?'on':''}" onclick="SGL.sbIlacSec(${x.ilac.id},'no')">✕ Almadım</button></div></div>`).join('');
  const m=pencere('sg-m-sabah','☀️ Sabah formu · '+new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long',weekday:'long'}),`<div class="sg-not" style="margin-bottom:10px">Bir dakika sürer, tek seferde. Sadece sen görürsün.</div>
    <div class="sg-fb">😴 Dün gece</div>
    <div class="sg-f"><label>Nasıl uyudun? (1 çok kötü – 10 çok iyi)</label>${puanHtml('sb','uyku',10,S.P.sb.uyku,v=>iyiRenk(v,10))}</div>
    <div class="sg-f"><label>Kaç saat uyudun? ${hcUyku?'<small>(saatten: '+n1(hcUyku/60,1)+' sa)</small>':''}</label><input id="sg-sb-us" type="text" inputmode="decimal" value="${s&&s.uyku_saat!=null?n1(s.uyku_saat,1):hcUyku?n1(hcUyku/60,1):''}" placeholder="ör. 7,5"></div>
    <div class="sg-f"><label>Uyanınca nasıl hissettin? (1 bitkin – 5 dinç)</label>${puanHtml('sb','uyanis',5,S.P.sb.uyanis,v=>iyiRenk(v,5))}</div>
    <div class="sg-f"><label>Gece atak oldu mu?</label><div class="sg-chips" id="sb-gece">${['Hayır','Evet'].map(x=>`<button type="button" class="${S.C.sb.gece.includes(x)?'on':''}" data-x="${x}" onclick="SGL.chipTek('sb','gece',this);SGL.sbGeceGoster()">${x}</button>`).join('')}</div>
      <div id="sg-sb-ga" style="display:none;margin-top:8px" class="sg-f-iki"><div class="sg-f"><label>Saat</label><input id="sg-sb-gas" type="time" value="04:00"></div><div class="sg-f"><label>Şiddet 1–10</label><input id="sg-sb-gad" type="number" min="1" max="10" placeholder="5"></div></div></div>
    <div class="sg-fb">💊 Sabah ilaçları</div>${ilacH||'<div class="sg-not">Sabah ilacı tanımlı değil.</div>'}
    <div class="sg-fb">🍳 Kahvaltı ve kahve</div>
    <div class="sg-f"><label>Kahvaltı</label><div class="sg-chips" id="sb-kah">${['Yaptım','Henüz yapmadım','Atladım'].map(x=>`<button type="button" class="${S.C.sb.kah.includes(x)?'on':''}" data-x="${x}" onclick="SGL.chipTek('sb','kah',this)">${x}</button>`).join('')}</div><input id="sg-sb-kn" type="text" placeholder="Ne yedin? (isteğe bağlı)" value="${esc(s&&s.kahvalti_ne||'')}" style="margin-top:6px"></div>
    <div class="sg-f-iki"><div class="sg-f"><label>☕ Aç karnına kahve</label><div class="sg-say"><button type="button" onclick="SGL.sayac('sg-sb-ka',-1)">−</button><b id="sg-sb-ka">${s?s.kahve_ac||0:0}</b><button type="button" onclick="SGL.sayac('sg-sb-ka',1)">＋</button></div></div><div class="sg-f"><label>☕ Tokken kahve</label><div class="sg-say"><button type="button" onclick="SGL.sayac('sg-sb-kt',-1)">−</button><b id="sg-sb-kt">${s?s.kahve_tok||0:0}</b><button type="button" onclick="SGL.sayac('sg-sb-kt',1)">＋</button></div></div></div>
    <div class="sg-fb">⚖️ Tartı ve 🩺 tansiyon <small style="text-transform:none;color:var(--text3)">(isteğe bağlı ama çok faydalı)</small></div>
    <div class="sg-f"><label>Aç karnına kilo (kg)</label><input id="sg-sb-kg" type="text" inputmode="decimal" value="${s&&s.kilo?n1(s.kilo):''}" placeholder="${sonOlcum('kilo')?n1(sonOlcum('kilo').deger):''}"></div>
    <div class="sg-f-ik"><div class="sg-f"><label>Büyük</label><input id="sg-sb-tb" type="number" inputmode="numeric" value="${s&&s.tansiyon_b||''}"></div><div class="sg-f"><label>Küçük</label><input id="sg-sb-tk" type="number" inputmode="numeric" value="${s&&s.tansiyon_k||''}"></div><div class="sg-f"><label>Nabız</label><input id="sg-sb-tn" type="number" inputmode="numeric" value="${s&&s.nabiz||''}"></div></div>
    <div class="sg-f"><label>Not (isteğe bağlı)</label><input id="sg-sb-not" value="${esc(s&&s.notu||'')}"></div>`,
    `<button class="btn btn-secondary" style="flex:1" onclick="SGL.sabahSonra()">Sonra</button><button class="btn btn-primary" style="flex:2" id="sg-sb-kaydet" onclick="SGL.sabahKaydet()">Kaydet</button>`);
  S._durum=sabahDurum;sabahDurum();S.sbGeceGoster();};
S.sbIlacSec=(id,v)=>{S.sbIlac[id]=v;const el=document.getElementById('sbi-'+id);if(el)el.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('on',(i===0&&v==='ok')||(i===1&&v==='no')));sabahDurum();};
S.sbGeceGoster=()=>{const e=document.getElementById('sg-sb-ga');if(e)e.style.display=(S.C.sb.gece||[]).includes('Evet')?'grid':'none';};
function sabahEksik(){const L=[];const P=S.P.sb||{},C=S.C.sb||{};if(!P.uyku)L.push('uyku');if(!P.uyanis)L.push('uyanış');if(!(C.gece||[]).length)L.push('gece atak');if(!(C.kah||[]).length)L.push('kahvaltı');
  ilacPlan(bugun()).filter(x=>x.dilim==='sabah').forEach(x=>{if(x.ilac.tur==='takviye'){if(!(C.tk||[]).length&&!deg('sg-sb-tkd').trim())L.push('takviye');}else if(!S.sbIlac[x.ilac.id])L.push(x.ilac.ad.split(' ')[0]);});return L;}
function sabahDurum(){const b=document.getElementById('sg-sb-kaydet');if(!b)return;const e=sabahEksik();b.textContent=e.length?'Kaydet ('+e.length+' eksik)':'Kaydet ✓';b.style.opacity=e.length?0.6:1;}
S.sabahSonra=()=>{S.sabahSonraZaman=Date.now();S._durum=null;kapat('sg-m-sabah');};
S.sabahKaydet=async()=>{const e=sabahEksik();if(e.length){toast('Eksik: '+e.slice(0,4).join(', '),'amber');return;}
  const g=bugun(),P=S.P.sb,C=S.C.sb;const kg=sayi(deg('sg-sb-kg')),tb=sayi(deg('sg-sb-tb')),tk=sayi(deg('sg-sb-tk')),tn=sayi(deg('sg-sb-tn'));const ka=Number(document.getElementById('sg-sb-ka').textContent)||0,kt=Number(document.getElementById('sg-sb-kt').textContent)||0;
  const once=sabahG(g);const gece=(C.gece||[]).includes('Evet');const kah=(C.kah||[])[0];
  const row={tarih:g,uyku_kalite:P.uyku,uyku_saat:sayi(deg('sg-sb-us')),uyanis:P.uyanis,gece_atak:gece,kahvalti:kah==='Yaptım',kahvalti_ne:deg('sg-sb-kn')||null,kahve_ac:ka,kahve_tok:kt,kilo:kg,tansiyon_b:tb,tansiyon_k:tk,nabiz:tn,notu:deg('sg-sb-not')||null,kacirildi:false};
  const b=document.getElementById('sg-sb-kaydet');if(b){b.disabled=true;b.textContent='Kaydediliyor…';}
  try{
    await upsert('sabah','saglik_sabah',row,'kullanici_id,tarih',x=>x.tarih);
    const sabahZ=new Date();const iso=sabahZ.toISOString();
    for(const x of ilacPlan(g).filter(y=>y.dilim==='sabah')){if(x.ilac.tur==='takviye'){const L=(C.tk||[]).filter(t=>t!=='Bugün yok');const d=deg('sg-sb-tkd').trim();if(d)L.push(d);await alimYaz(x.ilac.id,g,'sabah',L.length>0,L.join(', ')||null);}
      else await alimYaz(x.ilac.id,g,'sabah',S.sbIlac[x.ilac.id]==='ok',null);}
    if(!once){ // ilk kayıtta tekil girişleri de ekle (düzenlemede çift yazma)
      if(kg)await ekle('olcum','saglik_olcum',{tur:'kilo',deger:kg,baglam:'sabah',zaman:iso,kaynak:'sabah'});
      if(tb&&tk)await ekle('olcum','saglik_olcum',{tur:'tansiyon',deger:tb,deger2:tk,deger3:tn,baglam:'sabah',zaman:iso,kaynak:'sabah'});
      if(ka)await ekle('giris','saglik_giris',{tur:'kafein',miktar:ka,alt:'Kahve',ac:true,notu:'sabah formu',kaynak:'sabah'});
      if(kt)await ekle('giris','saglik_giris',{tur:'kafein',miktar:kt,alt:'Kahve',ac:false,notu:'sabah formu',kaynak:'sabah'});
      if(kah==='Yaptım')await ekle('giris','saglik_giris',{tur:'ogun',alt:'kahvalti',miktar:0,notu:row.kahvalti_ne,kaynak:'sabah'});
      if(gece){const [hh,mm]=(deg('sg-sb-gas')||'04:00').split(':').map(Number);const z=new Date();z.setHours(hh,mm,0,0);if(z>sabahZ)z.setDate(z.getDate()-1);
        await ekle('atak','saglik_atak',{zaman:z.toISOString(),siddet:sayi(deg('sg-sb-gad')),durum:'Yatakta / uykuda',notu:'Sabah formundan (gece)'});S.v.atak.sort((a,b)=>a.zaman<b.zaman?-1:1);}
    }
    ckUykuBirlestir();S._durum=null;kapat('sg-m-sabah');toast('☀️ Sabah formu kaydedildi · seri '+formSeri()+' gün','green');
    if(ka>=1&&kah!=='Yaptım')setTimeout(()=>toast('Aç karnına kahve içtin; kahvaltıyı geciktirme.','amber'),3800);
    ciz();
  }catch(er){console.error(er);toast('Kaydedilemedi: '+(er.message||er),'red');if(b){b.disabled=false;sabahDurum();}}};
function sabahGerekli(){const h=new Date().getHours();return h>=9&&h<15&&!sabahG(bugun());}
async function sabahKontrol(){try{await yukle();if(!sabahGerekli())return;if(Date.now()-(S.sabahSonraZaman||0)<55*60000)return;if(document.getElementById('sg-m-sabah')?.classList.contains('open'))return;
  const bas=Date.now();while(document.querySelector('.modal-ov.open')&&Date.now()-bas<5*60000)await new Promise(r=>setTimeout(r,800));if(document.querySelector('.modal-ov.open')||!sabahGerekli())return;S.sabahAc();}catch(e){console.warn('sabah formu',e);}}
S.sabahKontrol=sabahKontrol;

// ───────────────────────────────────────── AKŞAM CHECK-IN'E İLAÇ ONAYI (index.html ckModalAc / ckEksik / ckKaydet çağırır)
S.aksamPlan=()=>ilacPlan(bugun()).filter(x=>x.dilim==='aksam');
S.aksamIlacHtml=()=>{const P=S.aksamPlan();if(!P.length)return '';S.akIlac={};P.forEach(x=>{const r=alimBul(x.ilac.id,bugun(),'aksam');if(r)S.akIlac[x.ilac.id]=r.alindi?'ok':'no';});
  return `<div class="ck-bolum">💊 Akşam ilaçları</div>${P.map(x=>`<div class="sg-ilac"><div class="ad">${esc(x.ilac.ad)}${x.ilac.doz?' <span class="sg-ek">'+esc(x.ilac.doz)+'</span>':''}</div><div class="sg-chips" id="aki-${x.ilac.id}"><button type="button" class="${S.akIlac[x.ilac.id]==='ok'?'on':''}" onclick="SGL.akIlacSec(${x.ilac.id},'ok')">✓ Aldım</button><button type="button" class="${S.akIlac[x.ilac.id]==='no'?'on':''}" onclick="SGL.akIlacSec(${x.ilac.id},'no')">✕ Almadım</button></div></div>`).join('')}`;};
S.akIlacSec=(id,v)=>{S.akIlac[id]=v;const el=document.getElementById('aki-'+id);if(el)el.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('on',(i===0&&v==='ok')||(i===1&&v==='no')));try{ckKaydetDurum();}catch(e){}};
S.aksamEksik=()=>S.aksamPlan().filter(x=>!(S.akIlac||{})[x.ilac.id]).map(x=>x.ilac.ad.split(' ')[0]);
S.aksamSayi=()=>S.aksamPlan().length;
S.aksamKaydet=async()=>{for(const x of S.aksamPlan()){const v=(S.akIlac||{})[x.ilac.id];if(v)await alimYaz(x.ilac.id,bugun(),'aksam',v==='ok',null);}};

// ───────────────────────────────────────── başlat
// ───────────────────────────────────────── hatırlatmalar (push_kuyruk; yalnız sahibe)
// ERP açıkken ileriye dönük bildirimler planlanır; Supabase ERP kapalıyken de gönderir (sessiz saatler sunucuda).
function hatirlatAyar(){const a=((S.v.ayar||{}).veri||{}).hatirlat||{};return Object.assign({sabahIlac:false,sabahSaat:'10:00',aksamIlac:true,aksamSaat:'21:00',yuruyus:true,yuruyusDk:20,randevu:true},a);}
function saatTs(g,hhmm){const [h,m]=String(hhmm||'00:00').split(':').map(Number);return new Date(gTs(g)+((h||0)*60+(m||0))*60000);}
function hatirlatPlan(){const H=hatirlatAyar(),L=[],simdi=Date.now();
  [bugun(),gEkle(bugun(),1)].forEach(g=>{[['sabah',H.sabahIlac,H.sabahSaat,'☀️ Sabah ilaçları'],['aksam',H.aksamIlac,H.aksamSaat,'🌙 Akşam ilaçları']].forEach(([d,acik,st,bas])=>{if(!acik)return;
    const z=saatTs(g,st);if(z.getTime()<=simdi)return;const bek=ilacPlan(g).filter(x=>x.dilim===d&&!(alimBul(x.ilac.id,g,d)||{}).alindi);if(!bek.length)return;
    L.push({anahtar:'ilac:'+g+':'+d,zaman:z.toISOString(),baslik:bas,govde:bek.length+' ilaç henüz işaretlenmedi. Dokun, alındı olarak işaretle.',url:'./?ilac='+d});});});
  if(H.yuruyus)(S.v.giris||[]).filter(r=>r.tur==='ogun'&&r.alt!=='ara').forEach(r=>{const t=new Date(r.zaman).getTime();const z=t+(H.yuruyusDk||20)*60000;if(z<=simdi||z-simdi>6*3600e3)return;
    if(aktiviteler().some(a=>{const b=new Date(a.baslangic).getTime();return b>=t&&b<=z;}))return;
    L.push({anahtar:'yuruyus:'+r.id,zaman:new Date(z).toISOString(),baslik:'🚶 Yemek sonrası yürüyüş',govde:'10–15 dakika yürümek tokluk şekerini dengeler. Hadi kısa bir tur!',url:'./?sayfa=saglik'});});
  if(H.randevu)(S.v.randevu||[]).filter(r=>r.tur==='randevu'&&r.durum==='bekliyor'&&r.tarih&&r.tarih>=bugun()&&gFark(bugun(),r.tarih)<=7).forEach(r=>{
    const ne=r.baslik+(r.saat?' · '+String(r.saat).slice(0,5):'')+(r.yer?' · '+r.yer:'');
    const z1=saatTs(gEkle(r.tarih,-1),'20:00');if(z1.getTime()>simdi)L.push({anahtar:'randevu:'+r.id+':once',zaman:z1.toISOString(),baslik:'🩺 Yarın randevun var',govde:ne+'. Sorularını Sağlık → Tahliller ve doktor bölümünden kopyalayabilirsin.',url:'./?sayfa=saglik'});
    if(r.saat){const z2=new Date(saatTs(r.tarih,String(r.saat).slice(0,5)).getTime()-2*3600e3);if(z2.getTime()>simdi)L.push({anahtar:'randevu:'+r.id+':gun',zaman:z2.toISOString(),baslik:'🩺 Bugün randevun var',govde:ne,url:'./?sayfa=saglik'});}});
  return L;}
let planZ=null,planHata=false;
function hatirlatPlanla(hemen){if(planHata)return;clearTimeout(planZ);planZ=setTimeout(async()=>{try{if(typeof sglSahibiMi==='function'&&!sglSahibiMi())return;
  await sbFetch('rpc/saglik_push_planla',{method:'POST',body:JSON.stringify({p:hatirlatPlan()})});}catch(e){console.warn('sağlık hatırlatma planı',e);if(/404|PGRST202|could not find/i.test(String(e.message||e)))planHata=true;}},hemen?200:2500);}
S.hatirlatPlanla=hatirlatPlanla;S.hatirlatPlan=hatirlatPlan;
S.hatirlatAc=()=>{const H=hatirlatAyar();const k=(id,ad,on)=>`<label style="display:flex;align-items:center;gap:8px;font-size:13.5px;margin:6px 0"><input type="checkbox" id="sg-ht-${id}" ${on?'checked':''} style="width:20px;height:20px"> ${ad}</label>`;
  pencere('sg-m-ht','🔔 Hatırlatmalar',`<div class="sg-not" style="margin-bottom:10px">Bildirimler yalnız senin telefonuna gelir. 23:00–07:00 arası susar.</div>
  <div class="sg-fb">İlaç</div>${k('aksamIlac','Akşam ilaçları işaretlenmediyse hatırlat',H.aksamIlac)}<div class="sg-f"><label>Akşam saati</label><input id="sg-ht-aksamSaat" type="time" value="${esc(H.aksamSaat)}"></div>
  ${k('sabahIlac','Sabah ilaçları için ayrıca hatırlat (sabah formu zaten soruyor)',H.sabahIlac)}<div class="sg-f"><label>Sabah saati</label><input id="sg-ht-sabahSaat" type="time" value="${esc(H.sabahSaat)}"></div>
  <div class="sg-fb">Yürüyüş</div>${k('yuruyus','Öğün girince yemek sonrası yürüyüş hatırlat',H.yuruyus)}<div class="sg-f"><label>Kaç dakika sonra</label><input id="sg-ht-yuruyusDk" type="number" inputmode="numeric" value="${H.yuruyusDk}"></div>
  <div class="sg-fb">Doktor</div>${k('randevu','Randevudan bir gün önce 20:00\'de ve 2 saat önce hatırlat',H.randevu)}`,
  `<button class="btn btn-primary btn-full" onclick="SGL.hatirlatKaydet()">Kaydet</button>`);};
S.hatirlatKaydet=()=>{const c=id=>!!document.getElementById('sg-ht-'+id)?.checked;const h={aksamIlac:c('aksamIlac'),sabahIlac:c('sabahIlac'),yuruyus:c('yuruyus'),randevu:c('randevu'),
  aksamSaat:deg('sg-ht-aksamSaat')||'21:00',sabahSaat:deg('sg-ht-sabahSaat')||'10:00',yuruyusDk:Math.max(5,Math.min(120,sayi(deg('sg-ht-yuruyusDk'))||20))};
  kaydetVeCiz(()=>ayarKaydet({hatirlat:h}),'Hatırlatmalar kaydedildi','sg-m-ht');};

// Bildirimden açılan hızlı ilaç penceresi (?ilac=sabah|aksam)
S.ilacHizli=(dilim)=>{const g=bugun();const P=ilacPlan(g).filter(x=>x.dilim===dilim);
  const satir=x=>{const r=alimBul(x.ilac.id,g,dilim);const d=r?(r.alindi?'ok':'no'):'';return `<div class="sg-ilac"><button class="sg-tik ${d}" onclick="SGL.ilacHizliTik(${x.ilac.id},'${dilim}')">${d==='ok'?'✓':d==='no'?'✕':''}</button><div class="ad">${esc(x.ilac.ad)}<small>${esc([x.ilac.doz&&!x.ilac.ad.includes(x.ilac.doz)?x.ilac.doz:'',r&&r.secim].filter(Boolean).join(' · '))}</small></div></div>`;};
  const bek=P.filter(x=>!(alimBul(x.ilac.id,g,dilim)||{}).alindi).length;
  pencere('sg-m-ih',(dilim==='sabah'?'☀️ Sabah':'🌙 Akşam')+' ilaçları',P.length?`<div class="sg-liste">${P.map(satir).join('')}</div><div class="sg-not" style="margin-top:8px">Dokununca: alındı → atlandı → boş.</div>`:bosGrafik('Bu saat için ilaç yok.'),
    `<button class="btn btn-secondary" style="flex:1" onclick="closeModal('sg-m-ih')">Kapat</button>${bek?`<button class="btn btn-primary" style="flex:2" onclick="SGL.ilacHepsi('${dilim}')">Hepsini aldım (${bek})</button>`:''}`);};
S.ilacHizliTik=async(id,dilim)=>{const i=(S.v.ilac||[]).find(x=>x.id===id);const g=bugun();const r=alimBul(id,g,dilim);
  if(i&&i.tur==='takviye'&&!(r&&r.alindi)){kapat('sg-m-ih');S.takviyeAc(id,dilim,g);return;}
  try{if(!r)await ekle('alim','saglik_ilac_alim',{ilac_id:id,tarih:g,dilim,alindi:true});else if(r.alindi)await guncelle('alim','saglik_ilac_alim',r.id,{alindi:false,zaman:new Date().toISOString()});else await sil('alim','saglik_ilac_alim',r.id);
    S.ilacHizli(dilim);ciz();hatirlatPlanla();}catch(e){toast('Kaydedilemedi: '+(e.message||e),'red');}};
S.ilacHepsi=async(dilim)=>{const g=bugun();try{for(const x of ilacPlan(g).filter(x=>x.dilim===dilim)){const r=alimBul(x.ilac.id,g,dilim);if(r&&r.alindi)continue;
    let secim=null;if(x.ilac.tur==='takviye'){const once=(S.v.alim||[]).filter(a=>a.ilac_id===x.ilac.id&&a.alindi&&a.secim).sort((a,b)=>a.tarih<b.tarih?1:-1)[0];secim=once?once.secim:null;}
    await alimYaz(x.ilac.id,g,dilim,true,secim);}
  kapat('sg-m-ih');toast('✓ '+(dilim==='sabah'?'Sabah':'Akşam')+' ilaçları alındı','green');ciz();hatirlatPlanla();}catch(e){toast('Kaydedilemedi: '+(e.message||e),'red');}};

// ───────────────────────────────────────── doktor özeti (ekranda göster, metin kopyala, yazdır/PDF)
function doktorOzet(gunSay){const G=gunler(gunSay),bas=G[0],A=ayar(),H=A.hedef;const B=[];const ic=(z)=>zGun(z)>=bas;
  const ek=(baslik,satir)=>{satir=satir.filter(Boolean);if(satir.length)B.push({baslik,satir});};
  const kL=olcumler('kilo');const kA=kL.filter(o=>ic(o.zaman));const kS=kL[kL.length-1];
  ek('Kilo',[kS&&`Güncel: ${n1(kS.deger)} kg (${trT(zGun(kS.zaman))})${H.boy?' · VKİ '+n1(vki(Number(kS.deger))):''}`,kA.length>1&&`Son ${gunSay} gün: ${n1(kA[0].deger)} → ${n1(kA[kA.length-1].deger)} kg (${n1(kA[kA.length-1].deger-kA[0].deger)} kg)`,kL.length>1&&`Takip başından beri: ${n1(kL[0].deger)} kg (${trT(zGun(kL[0].zaman))}) → ${n1(kS.deger)} kg`]);
  const T=olcumler('tansiyon').filter(o=>ic(o.zaman));const tO=L=>L.length?`${n1(ort(L.map(o=>Number(o.deger))),0)}/${n1(ort(L.map(o=>Number(o.deger2))),0)} mmHg (${L.length} ölçüm)`:null;
  const sb=T.filter(o=>o.baglam==='sabah'),ak=T.filter(o=>o.baglam==='aksam');const mx=T.slice().sort((a,b)=>b.deger-a.deger)[0];
  ek('Tansiyon ve nabız',[sb.length&&'Sabah ortalaması: '+tO(sb),ak.length&&'Akşam ortalaması: '+tO(ak),!sb.length&&!ak.length&&T.length&&'Ortalama: '+tO(T),mx&&`En yüksek: ${mx.deger}/${mx.deger2} (${trT(zGun(mx.zaman))})`,
    (()=>{const v=ort(G.map(dinlenikG).filter(Boolean));return v?'Dinlenik nabız ortalaması: '+n1(v,0)+' bpm':null;})()]);
  const At=(S.v.atak||[]).filter(a=>ic(a.zaman));const say=(k)=>{const m={};At.forEach(a=>(a[k]||[]).forEach(x=>m[x]=(m[x]||0)+1));return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([x,n])=>x+' ('+n+')').join(', ');};
  const kr=krizIlac();const krS=kr?(S.v.alim||[]).filter(a=>a.ilac_id===kr.id&&a.dilim==='kriz'&&a.alindi&&a.tarih>=bas).length:0;
  ek('Kaygı atakları',[`Son ${gunSay} günde ${At.length} atak · günde ortalama ${n1(At.length/gunSay)}`,At.length&&'Ortalama şiddet: '+n1(ort(At.map(a=>a.siddet)))+'/10 · ortalama süre: '+n1(ort(At.map(a=>a.sure_dk)),0)+' dk',
    At.length&&'Sık belirtiler: '+say('belirtiler'),At.length&&'Sık tetikleyiciler: '+say('tetikleyiciler'),kr&&`Kriz ilacı (${kr.ad}): ${krS} kez`,(()=>{const pi=isaretIlac();return pi?ilacEtki():null;})()]);
  const ck=G.map(ckG).filter(Boolean);ek('Ruh hali (akşam check-in, 1–10)',[ck.length&&`Mod ${n1(ort(ck.map(c=>c.ruh)))} · stres ${n1(ort(ck.map(c=>c.stres)))} · kaygı ${n1(ort(ck.map(c=>c.kaygi)))} (${ck.length} gün)`]);
  const sbL=G.map(sabahG).filter(Boolean);const uy=ort(G.map(uykuSaatG));ek('Uyku',[uy&&'Ortalama uyku: '+n1(uy)+' saat',sbL.length&&'Uyku kalitesi: '+n1(ort(sbL.map(s=>s.uyku_kalite)))+'/10 · uyanış hissi: '+n1(ort(sbL.map(s=>s.uyanis)))+'/5',sbL.filter(s=>s.gece_atak).length&&'Gece atak olan gün: '+sbL.filter(s=>s.gece_atak).length]);
  const kf=G.map(kafeinG);ek('Kafein ve adım',[`Kahve: günde ${n1(ort(kf.map(k=>k.top)))} fincan · aç karnına ${n1(top(kf.map(k=>k.ac)),0)} kez`,(()=>{const v=ort(G.map(adimG));return v?'Adım ortalaması: '+n1(v,0)+'/gün':null;})(),
    (()=>{const d=new Set(aktiviteler().filter(a=>ic(a.baslangic)).map(a=>zGun(a.baslangic))).size;return d?'Spor/yürüyüş yapılan gün: '+d:null;})()]);
  const Il=(S.v.ilac||[]).filter(i=>i.aktif);const uy2=ilacUyum(G.slice(0,-1));
  ek('Kullandığı ilaçlar',Il.map(i=>`${i.ad}${i.doz&&!i.ad.includes(i.doz)?' '+i.doz:''}${i.etken?' ('+i.etken+')':''} · ${i.tur==='gerektiginde'?'gerektiğinde, en fazla '+(i.max_gunluk||'?')+'/gün':i.tur==='takviye'?'takviye':(i.zamanlar||[]).map(z=>({sabah:'sabah',ogle:'öğle',aksam:'akşam'}[z]||z)).join(' + ')}${i.baslangic?' · başlangıç '+trT(i.baslangic):''}${i.bitis?' · bitiş '+trT(i.bitis):''}`).concat(uy2!=null?['Son '+gunSay+' gün ilaç uyumu: %'+n1(uy2*100,0)]:[]));
  const th=sonTahliller().filter(t=>tahlilDurum(t)!=='normal'||ONEMLI_TEST.includes(t.test)).sort((a,b)=>(ONEMLI_TEST.indexOf(a.test)+99)%99-(ONEMLI_TEST.indexOf(b.test)+99)%99);
  const tah=th.map(t=>{const d=tahlilDurum(t);const s=tahlilSeri(t.test);const on=s.length>1?s[s.length-2]:null;return {test:t.test,deger:(t.deger!=null?n1(t.deger,2):t.deger_metin)+' '+(t.birim||''),ref:t.ref_metin||(t.ref_alt!=null&&t.ref_ust!=null?t.ref_alt+'–'+t.ref_ust:t.ref_ust!=null?'<'+t.ref_ust:t.ref_alt!=null?'>'+t.ref_alt:''),tarih:trT(t.tarih),durum:d,onceki:on?n1(on.deger,2)+' ('+trT(on.tarih)+')':''};});
  const sor=(S.v.randevu||[]).filter(r=>r.tur==='soru'&&r.durum==='bekliyor').map(r=>r.baslik+(r.notu?' ('+r.notu+')':''));
  return {bas,bit:bugun(),gunSay,B,tah,sor};}
function doktorMetin(o){let t=`SAĞLIK ÖZETİ · ${trT(o.bas)} – ${trT(o.bit)} (son ${o.gunSay} gün)\n`;
  o.B.forEach(b=>{t+=`\n${b.baslik.toLocaleUpperCase('tr-TR')}\n`+b.satir.map(s=>'• '+s).join('\n')+'\n';});
  if(o.tah.length)t+='\nTAHLİLLER (son değerler)\n'+o.tah.map(x=>`• ${x.test}: ${x.deger}${x.durum!=='normal'?' '+DURUM_IS[x.durum]:''} · ref ${x.ref||'—'} · ${x.tarih}${x.onceki?' · önceki '+x.onceki:''}`).join('\n')+'\n';
  if(o.sor.length)t+='\nSORULARIM\n'+o.sor.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n';return t;}
function doktorHtml(o,baski){const DR={yuksek:'#d32f2f',dusuk:'#ef6c00',sinir:'#ef6c00',normal:'#2e7d32'};
  let h=`<div class="dk"><h2>Sağlık özeti</h2><div class="dk-alt">${trT(o.bas)} – ${trT(o.bit)} · son ${o.gunSay} gün</div>`;
  o.B.forEach(b=>{h+=`<h3>${esc(b.baslik)}</h3><ul>${b.satir.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`;});
  if(o.tah.length)h+=`<h3>Tahliller (son değerler)</h3><table><tr><th>Test</th><th>Değer</th><th>Referans</th><th>Tarih</th><th>Önceki</th></tr>${o.tah.map(x=>`<tr><td>${esc(x.test)}</td><td style="color:${DR[x.durum]};font-weight:700">${esc(x.deger)} ${DURUM_IS[x.durum]||''}</td><td>${esc(x.ref||'—')}</td><td>${x.tarih}</td><td>${esc(x.onceki)}</td></tr>`).join('')}</table>`;
  if(o.sor.length)h+=`<h3>Sorularım</h3><ol>${o.sor.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`;
  return h+'</div>';}
S.doktorGun=30;
S.doktorAc=(gun)=>{if(gun)S.doktorGun=gun;const o=doktorOzet(S.doktorGun);S.doktorSon=o;
  pencere('sg-m-dk','📄 Doktor özeti',`<div class="sg-aralik gf-seg" style="margin-bottom:10px">${[[30,'30 gün'],[90,'90 gün'],[180,'6 ay']].map(([v,a])=>`<button class="gf-seg-b${S.doktorGun===v?' on':''}" onclick="SGL.doktorAc(${v})">${a}</button>`).join('')}</div><div class="sg-dk">${doktorHtml(o)}</div>`,
  `<button class="btn btn-secondary" style="flex:1" onclick="SGL.doktorKopyala()">📋 Metni kopyala</button><button class="btn btn-primary" style="flex:1" onclick="SGL.doktorYazdir()">🖨️ Yazdır / PDF</button>`);};
S.doktorKopyala=async()=>{const t=doktorMetin(S.doktorSon||doktorOzet(S.doktorGun));if(await panoya(t)){toast('Özet kopyalandı','green');return;}
  pencere('sg-m-kop','📋 Doktor özeti',`<div class="sg-not" style="margin-bottom:8px">Otomatik kopyalanamadı. Metne uzun basıp tümünü seç ve kopyala.</div><textarea readonly rows="16" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border2);border-radius:10px;background:var(--surface2);color:var(--text);font:12.5px var(--fu)">${esc(t)}</textarea>`,`<button class="btn btn-secondary" onclick="closeModal('sg-m-kop')">Kapat</button>`);};
S.doktorYazdir=()=>{const o=S.doktorSon||doktorOzet(S.doktorGun);
  const html=`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sağlık özeti ${trT(o.bit)}</title><style>body{font:13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;max-width:760px;margin:24px auto;padding:0 18px}h2{margin:0;font-size:20px}h3{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}.dk-alt{color:#666;margin-bottom:6px}ul,ol{margin:4px 0;padding-left:20px}li{margin:2px 0}table{border-collapse:collapse;width:100%;font-size:12px}th,td{text-align:left;padding:5px 6px;border-bottom:1px solid #eee}th{background:#f5f5f5}.bar{position:sticky;top:0;background:#fff;padding:8px 0;margin-bottom:8px}@media print{.bar{display:none}body{margin:0}}</style></head><body><div class="bar"><button onclick="window.print()" style="padding:9px 18px;border:0;border-radius:8px;background:#0f172a;color:#fff;font-weight:600">🖨️ Yazdır / PDF olarak kaydet</button></div>${doktorHtml(o,true)}<script>setTimeout(function(){window.print()},500)<\/script></body></html>`;
  try{if(typeof macAktif==='function'&&macAktif()){macCagir('belge_ac',{html});return;}}catch(e){}
  if(typeof andAktif==='function'&&andAktif()){const sade=html.replace(/<div class="bar">[\s\S]*?<\/div>/,'').replace(/<script>[\s\S]*?<\/script>/,'');
    andYerel('yazdir',{html:sade,ad:'Saglik ozeti '+o.bit}).catch(e=>toast(/not implemented|unimplemented/i.test(String(e.message||e))?'Yazdırma için uygulamayı güncelle. Şimdilik "Metni kopyala"yı kullan.':'Yazdırılamadı: '+String(e.message||e).slice(0,60),'amber'));return;}
  const u=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const w=window.open(u,'_blank');if(!w)toast('Açılır pencere engellendi','amber');setTimeout(()=>URL.revokeObjectURL(u),60000);};
// ───────────────────────────────────────── Health Connect (Android uygulaması: Mi Fitness saat verisi, Foodvisor)
const HC={durum:null,calisiyor:false};
function hcVar(){return typeof andAktif==='function'&&andAktif();}
function hcSon(){try{return +localStorage.getItem('sg_hc_son')||0;}catch(e){return 0;}}
async function hcDurum(){if(!hcVar())return null;try{HC.durum=await andYerel('saglikDurum');}catch(e){HC.durum={eski:/not implemented|unimplemented|bulunamad/i.test(String(e.message||e)),hata:String(e.message||e)};}return HC.durum;}
function hcBagli(){const d=HC.durum;return !!(d&&d.sdk===2&&(d.izinler||[]).length);}
// aynı anahtar takımına sahip satırları birlikte gönder (PostgREST toplu yazımda anahtarlar ortak olmalı)
// toplu yaz; bir grup reddedilirse satır satır dene, bozuk satır tüm eşitlemeyi durdurmasın
async function topluYaz(yol,L,prefer){let n=0;const hata=[];
  for(const grp of gruplar(L)){try{await sbFetch(yol,{method:'POST',prefer,body:JSON.stringify(grp)});n+=grp.length;}
    catch(e){for(const r of grp){try{await sbFetch(yol,{method:'POST',prefer,body:JSON.stringify(r)});n++;}catch(e2){hata.push(String(e2.message||e2).slice(0,160));console.warn('HC satır',yol,r,e2);}}}}
  return {n,hata};}
function gruplar(L){const m={};L.forEach(r=>{const k=Object.keys(r).sort().join(',');(m[k]=m[k]||[]).push(r);});return Object.values(m);}
async function hcEsitle(gun,sessiz){if(HC.calisiyor||!hcVar())return;HC.calisiyor=true;S.hcMesaj='Eşitleniyor…';if(S.sekme==='ozet'||S.sekme==='aktivite')hcKartGuncelle();
  try{const r=await andYerel('saglikOku',{gun:gun||30});let nG=0,nO=0,nA=0;
    await yukle(true); // yarıda kalan önceki eşitlemenin yazdıkları tekrar yazılmasın
    // günlük toplamlar: yalnız Health Connect'te olan alanlar yazılır (elle girilenler korunur)
    const G=(r.gunluk||[]).map(x=>{const o={tarih:x.tarih,kaynak:'hc',guncelleme:new Date().toISOString()};Object.keys(x).forEach(k=>{if(k!=='tarih'&&x[k]!=null)o[k]=x[k];});['adim','kat','uyku_dk','uyku_derin_dk','uyku_rem_dk','uyku_hafif_dk','uyku_uyanik_dk','nabiz_dinlenik','nabiz_min','nabiz_max','nabiz_ort'].forEach(k=>{if(o[k]!=null)o[k]=Math.round(o[k]);});return o;}).filter(o=>Object.keys(o).length>3);
    for(const grp of gruplar(G)){await sbFetch('saglik_gunluk?on_conflict=kullanici_id,tarih',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:JSON.stringify(grp)});nG+=grp.length;}
    const varO=new Set((S.v.olcum||[]).map(o=>o.dis_id).filter(Boolean));
    const O=(r.olcum||[]).filter(o=>!varO.has(o.dis_id)).map(o=>Object.assign({kaynak:'hc'},o,o.tur==='kilo'||o.tur==='tansiyon'?{baglam:new Date(o.zaman).getHours()<12?'sabah':'aksam'}:{}));
    const yO=await topluYaz('saglik_olcum',O,'return=minimal');nO=yO.n;const atlanan=yO.hata.slice();
    const varA=new Set((S.v.aktivite||[]).filter(a=>a.kaynak==='hc').map(a=>a.dis_id));const diger=(S.v.aktivite||[]).filter(a=>a.kaynak!=='hc');
    const A=(r.aktivite||[]).filter(a=>!varA.has(a.dis_id)).map(a=>{const t=new Date(a.baslangic).getTime();
      const ikiz=diger.find(x=>Math.abs(new Date(x.baslangic).getTime()-t)<=15*60000&&(x.tur===a.tur||x.tur==='diger'||a.tur==='diger'));
      const o={kaynak:'hc',dis_id:a.dis_id,tur:a.tur,baslangic:a.baslangic,bitis:a.bitis,sure_sn:a.sure_sn,ad:a.ad||null,mesafe_m:a.mesafe_m??null,kcal:a.kcal??null,nabiz_ort:a.nabiz_ort!=null?Math.round(a.nabiz_ort):null,nabiz_max:a.nabiz_max!=null?Math.round(a.nabiz_max):null,ikiz_id:ikiz?ikiz.id:null};
      o.hiz_ort=o.mesafe_m&&o.sure_sn?Math.round(o.mesafe_m/o.sure_sn*36)/10:null;return o;});
    const yA=await topluYaz('saglik_aktivite',A,'return=minimal');nA=yA.n;atlanan.push(...yA.hata);if(atlanan.length)console.warn('HC atlanan',atlanan);
    try{localStorage.setItem('sg_hc_son',String(Date.now()));}catch(e){}
    await yukle(true);S.hcMesaj='Son eşitleme: '+saat(Date.now())+' · '+nG+' gün'+(nO?' · '+nO+' ölçüm':'')+(nA?' · '+nA+' aktivite':'')+(atlanan.length?' · '+atlanan.length+' kayıt atlandı ('+atlanan[0].slice(0,70)+')':'');
    if(!sessiz)toast('⌚ Eşitlendi: '+nG+' gün'+(nO?', '+nO+' ölçüm':'')+(nA?', '+nA+' aktivite':''),'green');ciz();hatirlatPlanla();}
  catch(e){console.warn('Health Connect',e);S.hcMesaj='Eşitlenemedi: '+String(e.message||e).slice(0,90);if(!sessiz)toast(S.hcMesaj,'red');hcKartGuncelle();}
  finally{HC.calisiyor=false;}}
S.hcEsitle=(g)=>hcEsitle(g||(hcSon()?14:60));
S.hcGecmis=()=>{if(!confirm('Saatin son 1 yıllık verisi yüklensin mi? Birkaç dakika sürebilir; bu sırada uygulamayı kapatma.'))return;toast('📥 1 yıllık veri okunuyor…','blue');hcEsitle(365);};
S.hcBagla=async()=>{if(!hcVar()){toast('Bu bağlantı Android uygulamasında çalışır','amber');return;}
  try{const d=await andYerel('saglikIzin');HC.durum=d;if(d.sdk!==2){toast(d.sdk===1?'Health Connect güncellenmeli: Play Store açıldı':'Health Connect yüklü değil: Play Store açıldı','amber');hcKartGuncelle();return;}
    if(!(d.izinler||[]).length){toast('İzin verilmedi','amber');hcKartGuncelle();return;}await hcEsitle(hcSon()?14:60);}
  catch(e){toast(/not implemented|unimplemented/i.test(String(e.message||e))?'Önce uygulamayı güncelle (Ayarlar → Uygulama güncellemesi)':'Açılamadı: '+String(e.message||e).slice(0,80),'red');}};
async function hcOtomatik(){if(!hcVar())return;await hcDurum();hcKartGuncelle();if(hcBagli()&&Date.now()-hcSon()>30*60000)hcEsitle(hcSon()?3:60,true);}
function hcKartHtml(){if(!hcVar())return `<div class="sg-alt">Mi Fitness (saat) verisi, Android uygulamasında Health Connect ile otomatik gelir.</div>`;
  const d=HC.durum;if(!d)return '<div class="sg-alt">Durum okunuyor…</div>';
  if(d.eski)return `<div class="sg-alt">Uygulamanın yeni sürümü gerekiyor. Güncelleme gelince burada "Bağlan" çıkacak.</div>`;
  if(d.sdk===0||d.sdk===1)return `<div class="sg-alt">Health Connect ${d.sdk===1?'güncellenmeli':'telefonda yok'}.</div><div class="sg-dug"><button onclick="SGL.hcBagla()">Play Store'da aç</button></div>`;
  if(!hcBagli())return `<div class="sg-alt">Mi Fitness'ta Health Connect paylaşımını aç, sonra buradan izin ver.</div><div class="sg-dug"><button class="on" onclick="SGL.hcBagla()">⌚ Bağlan</button></div>`;
  return `<div class="sg-alt">● Bağlı · ${(d.izinler||[]).length} veri türü${d.tam?'':' (bazı izinler kapalı)'}<br>${esc(S.hcMesaj||(hcSon()?'Son eşitleme: '+trT(zGun(hcSon()))+' '+saat(hcSon()):'Henüz eşitlenmedi'))}</div><div class="sg-dug"><button onclick="SGL.hcEsitle()" ${HC.calisiyor?'disabled':''}>🔄 Şimdi eşitle</button><button onclick="SGL.hcGecmis()" ${HC.calisiyor?'disabled':''}>📥 Geçmişi yükle (1 yıl)</button>${d.tam?'':'<button onclick="SGL.hcBagla()">İzinleri düzenle</button>'}</div>`;}
function hcKartGuncelle(){const el=document.getElementById('sg-hc');if(el)el.innerHTML=hcKartHtml();}
// ───────────────────────────────────────── Strava (yürüyüş, koşu, bisiklet, trekking: rota, irtifa, nabız)
// Jetonlar ve anahtarlar sunucuda (strava fonksiyonu); sayfa yalnız fonksiyonu çağırır.
const ST={durum:null,calisiyor:false,yokla:null,harita:{}};
function stSon(){try{return +localStorage.getItem('sg_st_son')||0;}catch(e){return 0;}}
async function stCagir(islem,ek){try{if(typeof jetonTaze==='function')await jetonTaze();}catch(e){}
  const r=await fetch(SB_URL+'/functions/v1/strava',{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(Object.assign({islem},ek||{}))});
  return r.json().catch(()=>({hata:'HTTP '+r.status}));}
async function stDurum(){try{ST.durum=await stCagir('durum');}catch(e){ST.durum={hata:'ag',mesaj:String(e.message||e)};}stKartGuncelle();return ST.durum;}
async function stEsitle(sessiz){if(ST.calisiyor)return;ST.calisiyor=true;S.stMesaj='Strava’dan alınıyor…';stKartGuncelle();
  try{const r=await stCagir('cek',{gun:90});
    if(r.hata){if(r.hata==='bagli_degil'&&ST.durum)ST.durum.bagli=false;throw new Error(r.mesaj||(r.hata==='bagli_degil'?'Strava bağlı değil':r.hata));}
    try{localStorage.setItem('sg_st_son',String(Date.now()));}catch(e){}
    if(ST.durum)ST.durum.son_cekim=new Date().toISOString();
    S.stMesaj='Son eşitleme: '+saat(Date.now())+(r.yeni?' · '+r.yeni+' yeni aktivite':'');
    if(!sessiz)toast('🗺️ Strava: '+(r.yeni?r.yeni+' yeni aktivite':'yeni aktivite yok'),'green');
    if(r.yeni||!sessiz){await yukle(true);ciz();}}
  catch(e){S.stMesaj='Eşitlenemedi: '+String(e.message||e).slice(0,90);if(!sessiz)toast(S.stMesaj,'red');}
  finally{ST.calisiyor=false;stKartGuncelle();}}
async function stOtomatik(){const d=await stDurum();if(d&&d.bagli&&Date.now()-stSon()>30*60000)stEsitle(true);}
S.stDurum=stDurum;S.stEsitle=()=>stEsitle(false);
S.stBagla=async()=>{toast('Strava açılıyor…','blue');let r=null;try{r=await stCagir('baslat');}catch(e){r={mesaj:String(e.message||e)};}
  if(!r||!r.url){toast('Açılamadı: '+((r&&(r.mesaj||r.hata))||'?'),'red');return;}
  const u=hcVar()&&r.mobil?r.mobil:r.url;
  if(typeof macAktif==='function'&&macAktif())macCagir('dis_ac',{url:u}).catch(()=>window.open(u,'_blank'));else window.open(u,'_blank');
  // izin verilip uygulamaya dönülünce durumu yakala
  clearInterval(ST.yokla);let n=0;
  ST.yokla=setInterval(async()=>{n++;if(n>72){clearInterval(ST.yokla);return;}if(document.hidden)return;const d=await stDurum();
    if(d&&d.bagli){clearInterval(ST.yokla);try{localStorage.setItem('sg_st_son',String(Date.now()));}catch(e){}toast('✅ Strava bağlandı'+(d.ad?': '+d.ad:''),'green');await yukle(true);ciz();}},5000);};
S.stKes=async()=>{if(!confirm('Strava bağlantısı kaldırılsın mı? Gelmiş aktiviteler silinmez.'))return;
  const r=await stCagir('kes').catch(()=>null);toast(r&&r.ok?'Strava bağlantısı kaldırıldı':'Kaldırılamadı','amber');S.stMesaj='';await stDurum();};
function stKartHtml(){const d=ST.durum;if(!d)return '<div class="sg-alt">Durum okunuyor…</div>';
  if(d.hata)return `<div class="sg-alt">Strava durumu okunamadı (${esc(d.mesaj||d.hata)}).</div><div class="sg-dug"><button onclick="SGL.stDurum()">Tekrar dene</button></div>`;
  if(!d.hazir)return '<div class="sg-alt">Strava anahtarları sunucuya eklenince burada "Bağlan" çıkacak.</div>';
  if(!d.bagli)return `<div class="sg-alt">Yürüyüş, koşu, bisiklet ve trekking; rota, irtifa ve nabızla birlikte gelir.${d.durum&&d.durum!=='bagli'?'<br>Durum: '+esc(d.durum):''}</div><div class="sg-dug"><button class="on" onclick="SGL.stBagla()">🔗 Strava'ya bağlan</button></div>`;
  const son=d.son_cekim?new Date(d.son_cekim).getTime():stSon();
  return `<div class="sg-alt">● Bağlı${d.ad?' · '+esc(d.ad):''}<br>${esc(S.stMesaj||(son?'Son eşitleme: '+trT(zGun(son))+' '+saat(son):'Henüz eşitlenmedi'))}</div><div class="sg-dug"><button onclick="SGL.stEsitle()" ${ST.calisiyor?'disabled':''}>🔄 Şimdi eşitle</button><button onclick="SGL.stKes()">Bağlantıyı kaldır</button></div><div class="sg-strava">Powered by Strava</div>`;}
function stKartGuncelle(){const el=document.getElementById('sg-st');if(el)el.innerHTML=stKartHtml();}

// ── Harita (Leaflet, gerekince yüklenir) ve rota çözümü
function polyCoz(s){const P=[];let i=0,la=0,lo=0;const oku=()=>{let b,sh=0,r=0;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5;}while(b>=32&&i<s.length);return (r&1)?~(r>>1):(r>>1);};
  while(i<s.length){la+=oku();if(i>=s.length)break;lo+=oku();P.push([la/1e5,lo/1e5]);}return P;}
let _lf=null;
function leafletYukle(){if(window.L&&window.L.map)return Promise.resolve(window.L);if(_lf)return _lf;
  _lf=new Promise((ok,no)=>{const c=document.createElement('link');c.rel='stylesheet';c.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(c);
    const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';s.onload=()=>ok(window.L);s.onerror=()=>{_lf=null;no(new Error('Harita yüklenemedi (internet?)'));};document.head.appendChild(s);});
  return _lf;}
function koyuTema(){const t=document.documentElement.getAttribute('data-tema');return t!=='acik'&&t!=='chill';}
function mesafeM(a,b){const R=6371000,r=Math.PI/180,d1=(b[0]-a[0])*r,d2=(b[1]-a[1])*r;const x=Math.sin(d1/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
async function haritaCiz(elId,A){const el=document.getElementById(elId);if(!el)return null;
  const R=A.filter(a=>a.rota).map(a=>({a,P:polyCoz(a.rota)})).filter(x=>x.P.length>1);if(!R.length){el.style.display='none';return null;}
  let Lf;try{Lf=await leafletYukle();}catch(e){el.innerHTML='<div class="sg-bos">'+esc(e.message)+'</div>';return null;}
  if(!document.body.contains(el))return null;
  if(ST.harita[elId]){try{ST.harita[elId].m.remove();}catch(e){}}
  const m=Lf.map(el,{zoomControl:false,scrollWheelZoom:false,attributionControl:true});
  Lf.tileLayer('https://{s}.basemaps.cartocdn.com/'+(koyuTema()?'dark_all':'light_all')+'/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd',attribution:'© OpenStreetMap · © CARTO'}).addTo(m);
  m.attributionControl.setPrefix(false);
  const B=Lf.latLngBounds([]);
  R.forEach(({a,P})=>{const c=TUR_RENK[a.tur]||'#00E5FF';
    Lf.polyline(P,{color:'#000',weight:7,opacity:.25}).addTo(m);
    Lf.polyline(P,{color:c,weight:4,opacity:.95}).addTo(m).on('click',()=>{if(A.length>1)S.aktiviteDetay(a.id);});
    Lf.circleMarker(P[0],{radius:5,color:'#fff',weight:2,fillColor:'#00E676',fillOpacity:1}).addTo(m);
    Lf.circleMarker(P[P.length-1],{radius:5,color:'#fff',weight:2,fillColor:'#E8197A',fillOpacity:1}).addTo(m);P.forEach(p=>B.extend(p));});
  m.fitBounds(B,{padding:[18,18]});
  // rota boyunca toplam mesafe (profil imleci için)
  const P0=R[0].P,K=[0];for(let i=1;i<P0.length;i++)K.push(K[i-1]+mesafeM(P0[i-1],P0[i]));
  const h={m,R,P0,K,imlec:null,Lf};ST.harita[elId]=h;return h;}
function haritaImlec(h,oran){if(!h)return;const top_=h.K[h.K.length-1]||1,hedef=top_*Math.max(0,Math.min(1,oran));let i=1;while(i<h.K.length-1&&h.K[i]<hedef)i++;
  const a=h.P0[i-1],b=h.P0[i],k=(hedef-h.K[i-1])/((h.K[i]-h.K[i-1])||1);const p=[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k];
  if(!h.imlec)h.imlec=h.Lf.circleMarker(p,{radius:7,color:'#fff',weight:2.5,fillColor:'#FFAB00',fillOpacity:1}).addTo(h.m);else h.imlec.setLatLng(p);}

// ── Rota profili: irtifa (alan) + nabız (çizgi), x = mesafe
function profilHtml(a){const k=a.akis||{};const n=(k.mesafe||k.zaman||[]).length;if(n<3)return '';
  const X=k.mesafe&&k.mesafe[n-1]>0?k.mesafe:k.zaman,km=X===k.mesafe;const ir=k.irtifa&&k.irtifa.some(v=>v!=null)?k.irtifa:null,nb=k.nabiz&&k.nabiz.some(v=>v!=null)?k.nabiz:null;
  if(!ir&&!nb)return '';
  const W=GW,H=140,PL=4,PR=30,PT=8,PB=18,x1=X[n-1]||1;const XP=v=>PL+(W-PL-PR)*v/x1;
  const ol=(L)=>{const f=L.filter(v=>v!=null);let a=Math.min(...f),b=Math.max(...f);if(b-a<5){a-=3;b+=3;}const p=(b-a)*0.08;return [a-p,b+p];};
  let s=`<svg class="sg-svg sg-prof" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  if(ir){const [y0,y1]=ol(ir);const Y=v=>PT+(H-PT-PB)*(1-(v-y0)/(y1-y0));const px=X.map((x,i)=>[XP(x),Y(ir[i]??y0)]);const yol='M'+px.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join('L');
    s+=`<path d="${yol}L${px[n-1][0].toFixed(1)},${H-PB}L${px[0][0].toFixed(1)},${H-PB}Z" style="fill:var(--green)" opacity="0.14"/><path d="${yol}" fill="none" style="stroke:var(--green)" stroke-width="1.5" stroke-linejoin="round"/>`;
    tikler(y0,y1,3).forEach(v=>{s+=`<line x1="${PL}" x2="${W-PR}" y1="${Y(v)}" y2="${Y(v)}" class="sg-izg"/><text x="${W-PR+4}" y="${Y(v)+3}" class="sg-ax">${n1(v,0)}m</text>`;});}
  if(nb){const [y0,y1]=ol(nb);const Y=v=>PT+(H-PT-PB)*(1-(v-y0)/(y1-y0));let yol='',ac=false;X.forEach((x,i)=>{if(nb[i]==null){ac=false;return;}yol+=(ac?'L':'M')+XP(x).toFixed(1)+','+Y(nb[i]).toFixed(1);ac=true;});
    s+=`<path d="${yol}" fill="none" style="stroke:var(--mg)" stroke-width="1.4" stroke-linejoin="round" opacity="0.9"/>`;}
  [0,x1/2,x1].forEach((v,i)=>{s+=`<text x="${XP(v)}" y="${H-4}" class="sg-ax" text-anchor="${i===0?'start':i===2?'end':'middle'}">${km?n1(v/1000,1)+' km':Math.round(v/60)+' dk'}</text>`;});
  s+=`<line class="sg-im-c sg-prof-c" y1="${PT}" y2="${H-PB}" style="display:none"/></svg>`;
  const ozet=[ir?`↗ ${n1(a.irtifa_m||0,0)} m tırmanış · ${n1(Math.min(...ir.filter(v=>v!=null)),0)}–${n1(Math.max(...ir.filter(v=>v!=null)),0)} m`:'',nb?`❤️ ort. ${a.nabiz_ort||n1(ort(nb.filter(v=>v!=null)),0)}${a.nabiz_max?' · en yüksek '+a.nabiz_max:''}`:''].filter(Boolean).join(' · ');
  return `<div class="sg-bolum" style="margin-top:10px"><h4>📈 Rota profili <small>${ir?'<i class="sg-nok" style="background:var(--green)"></i>irtifa ':''}${nb?'<i class="sg-nok" style="background:var(--mg)"></i>nabız':''}</small></h4><div class="sg-gb kk" id="sg-prof-b"><div class="sg-gb-sol">${esc(ozet)}</div><div class="sg-gb-sag"></div></div>${s}</div>`;}
function profilBagla(a,h){const sv=document.querySelector('#sg-m-det .sg-prof');if(!sv)return;const k=a.akis;const n=(k.mesafe||k.zaman).length;const X=k.mesafe&&k.mesafe[n-1]>0?k.mesafe:k.zaman,km=X===k.mesafe;const x1=X[n-1]||1;
  const W=GW,PL=4,PR=30;const c=sv.querySelector('.sg-prof-c'),b=document.getElementById('sg-prof-b');const ilk=b.children[0].innerHTML;
  const git=e=>{const r=sv.getBoundingClientRect();const cx=e.touches?e.touches[0].clientX:e.clientX;const xv=Math.max(0,Math.min(1,((cx-r.left)/r.width*W-PL)/(W-PL-PR)))*x1;
    let i=0;while(i<n-1&&X[i]<xv)i++;const px=PL+(W-PL-PR)*X[i]/x1;c.style.display='';c.setAttribute('x1',px);c.setAttribute('x2',px);
    b.children[0].innerHTML=`<b>${km?n1(X[i]/1000,2)+' km':Math.round(X[i]/60)+' dk'}</b>${k.irtifa&&k.irtifa[i]!=null?' · ↗ '+n1(k.irtifa[i],0)+' m':''}${k.nabiz&&k.nabiz[i]!=null?' · ❤️ '+Math.round(k.nabiz[i]):''}${k.zaman&&km?' · '+sureYaz(k.zaman[i]):''}`;
    haritaImlec(h,X[i]/x1);};
  const birak=()=>{c.style.display='none';b.children[0].innerHTML=ilk;if(h&&h.imlec){h.imlec.remove();h.imlec=null;}};
  sv.addEventListener('pointermove',git);sv.addEventListener('pointerdown',git);sv.addEventListener('pointerleave',birak);sv.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')setTimeout(birak,1600);});}

// ── Aktivite ayrıntısı
S.aktiviteDetay=id=>{const a=(S.v.aktivite||[]).find(x=>x.id===id);if(!a)return;
  const km=a.mesafe_m?a.mesafe_m/1000:null,hs=a.hareket_sn||a.sure_sn;const tempo=km&&hs?hs/60/km:null;const atk=(S.v.atak||[]).filter(x=>x.aktivite_id===a.id);
  const ist=[km?['Mesafe',n1(km,2)+' km']:null,a.sure_sn?['Süre',sureYaz(a.sure_sn)]:null,a.hareket_sn&&a.hareket_sn<a.sure_sn-60?['Hareket',sureYaz(a.hareket_sn)]:null,
    tempo&&a.tur!=='bisiklet'?['Tempo',n1(tempo,1)+' dk/km']:null,km&&hs&&a.tur==='bisiklet'?['Hız',n1(km/(hs/3600),1)+' km/sa']:null,a.irtifa_m?['Tırmanış',n1(a.irtifa_m,0)+' m']:null,
    a.nabiz_ort?['Nabız',a.nabiz_ort+(a.nabiz_max?' / '+a.nabiz_max:'')]:null,a.kcal?['Kalori',n1(a.kcal,0)+' kcal']:null].filter(Boolean);
  const ikiz=(S.v.aktivite||[]).filter(x=>x.ikiz_id===a.id);
  const govde=`<div class="sg-alt">${trT(zGun(a.baslangic))} · ${saat(a.baslangic)}${a.bitis?'–'+saat(a.bitis):''} · ${esc(a.kaynak==='hc'?'saat':a.kaynak)}${ikiz.length?' · saat kaydıyla birleştirildi':''}</div>
    ${a.rota?'<div id="sg-dharita" class="sg-harita" style="margin-top:8px"></div>':''}
    <div class="sg-istat">${ist.map(x=>`<div><small>${x[0]}</small><b>${x[1]}</b></div>`).join('')}</div>
    ${profilHtml(a)}
    ${(a.hareketler||[]).length?`<div class="sg-not">${esc(a.hareketler.map(x=>x.ad+' '+(x.set||'')+'×'+(x.tekrar||'')+(x.kg?' '+x.kg+'kg':'')).join(' · '))}</div>`:''}
    ${atk.length?`<div class="sg-not" style="color:var(--mg)">⚡ Bu aktiviteyle eşleşen ${atk.length} atak: ${atk.map(x=>saat(x.zaman)+(x.siddet?' (şiddet '+x.siddet+')':'')).join(', ')}</div>`:''}
    ${a.notu?`<div class="sg-not">${esc(a.notu)}</div>`:''}
    ${a.kaynak==='strava'&&a.dis_id?`<div class="sg-dug" style="margin-top:10px"><a class="sg-btn sg-strava-a" href="https://www.strava.com/activities/${encodeURIComponent(a.dis_id)}" target="_blank" rel="noopener">Strava'da görüntüle</a></div>`:''}`;
  pencere('sg-m-det',(TUR_AD[a.tur]||a.tur)+(a.ad?' · '+esc(a.ad):''),govde);
  setTimeout(async()=>{const h=a.rota?await haritaCiz('sg-dharita',[a]):null;if(h){h.m.invalidateSize();h.m.fitBounds(h.Lf.latLngBounds(h.P0),{padding:[18,18]});}if(a.akis)profilBagla(a,h);},260);};
S.baslat=async()=>{stilEkle();try{await yukle();hatirlatPlanla(true);}catch(e){console.warn('sağlık yükle',e);}
  setTimeout(()=>hcOtomatik().catch(()=>{}),2500);setTimeout(()=>stOtomatik().catch(()=>{}),4000);
  setTimeout(sabahKontrol,3500);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){setTimeout(sabahKontrol,1500);setTimeout(()=>hcOtomatik().catch(()=>{}),2500);setTimeout(()=>stOtomatik().catch(()=>{}),4000);}else if(S.yuklendi)hatirlatPlanla(true);});
  setInterval(()=>{if(document.visibilityState==='visible')sabahKontrol();},5*60*1000);
  if(document.getElementById('page-saglik')?.classList.contains('active'))ciz();};
S.yenile=async()=>{await yukle(true);ciz();};
})();
