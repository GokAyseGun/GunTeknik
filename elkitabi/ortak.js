/* ============================================================
   GÜN TEKNİK · EL KİTABI — ORTAK YARDIMCILAR
   Tema (ERP ile aynı anahtar: gt_tema), sayı biçimi, kopyala/paylaş, toast
   ============================================================ */
(function(){
  'use strict';
  const EK = window.EK = window.EK || {};

  /* ── Güvenli depolama ── */
  EK.oku = function(k, vars){ try{ const v = localStorage.getItem(k); return v == null ? vars : JSON.parse(v); }catch(e){ return vars; } };
  EK.yaz = function(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };

  /* ── Tema: ERP Ayarlar → Tema ile ortak (koyu / acik / sistem) ── */
  EK.temaAl = function(){ try{ return localStorage.getItem('gt_tema') || 'koyu'; }catch(e){ return 'koyu'; } };
  EK.temaUygula = function(t){
    const r = document.documentElement;
    let acik = t === 'acik';
    if(t === 'sistem') acik = !(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    if(acik) r.setAttribute('data-tema','acik'); else r.removeAttribute('data-tema');
    const b = document.getElementById('ek-tema-btn'); if(b) b.textContent = acik ? '🌙' : '☀️';
    const m = document.querySelector('meta[name=theme-color]'); if(m) m.setAttribute('content', acik ? '#f0f0f8' : '#060606');
  };
  EK.temaDegistir = function(){
    const acik = document.documentElement.getAttribute('data-tema') === 'acik';
    const yeni = acik ? 'koyu' : 'acik';
    try{ localStorage.setItem('gt_tema', yeni); localStorage.setItem('gun_tema', yeni); }catch(e){}
    EK.temaUygula(yeni);
  };
  EK.temaUygula(EK.temaAl());
  try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{ if(EK.temaAl()==='sistem') EK.temaUygula('sistem'); }); }catch(e){}
  window.addEventListener('storage', e => { if(e.key === 'gt_tema') EK.temaUygula(EK.temaAl()); });

  /* ── Sayı okuma: "2,5" ve "2.5" ikisi de kabul; "1.500,25" de çalışır ── */
  EK.sayiOku = function(s){
    if(s == null) return NaN;
    if(typeof s === 'number') return s;
    s = String(s).trim().replace(/\s/g,'');
    if(!s) return NaN;
    if(s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g,'').replace(',', '.');
    else s = s.replace(',', '.');
    if(!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    return parseFloat(s);
  };

  /* ── Sayı yazma (Türkçe): 1.500,25 ── */
  EK.tr = function(n, ondalik){
    if(n == null || !isFinite(n)) return '—';
    if(ondalik == null){
      const a = Math.abs(n);
      ondalik = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 2 : a >= 0.1 ? 3 : 4;
    }
    return n.toLocaleString('tr-TR', {minimumFractionDigits:0, maximumFractionDigits:ondalik});
  };
  /* Sabit ondalık (ör. para) */
  EK.trS = function(n, ondalik){
    if(n == null || !isFinite(n)) return '—';
    return n.toLocaleString('tr-TR', {minimumFractionDigits:ondalik, maximumFractionDigits:ondalik});
  };
  EK.tl = function(n){ return EK.trS(n, n >= 1000 ? 0 : 2) + ' ₺'; };

  /* ── SI ön ekli gösterim: 0,000022 F → 22 µF ── */
  EK.si = function(n, birim, ondalik){
    if(n == null || !isFinite(n)) return '—';
    if(n === 0) return '0 ' + birim;
    const on = [[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p']];
    const a = Math.abs(n);
    for(const [k,p] of on){ if(a >= k*0.9999){ return EK.tr(n/k, ondalik) + ' ' + p + birim; } }
    return EK.tr(n/1e-12, ondalik) + ' p' + birim;
  };

  /* ── Toast ── */
  let toastZ;
  EK.toast = function(m){
    let t = document.getElementById('ek-toast');
    if(!t){ t = document.createElement('div'); t.id = 'ek-toast'; document.body.appendChild(t); }
    t.textContent = m; t.classList.add('goster');
    clearTimeout(toastZ); toastZ = setTimeout(()=>t.classList.remove('goster'), 2200);
  };

  /* ── Kopyala / paylaş ── */
  EK.kopyala = function(metin){
    const bitti = () => EK.toast('📋 Panoya kopyalandı');
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(metin).then(bitti).catch(()=>eski());
    } else eski();
    function eski(){
      const ta = document.createElement('textarea'); ta.value = metin; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); bitti(); }catch(e){ EK.toast('Kopyalanamadı'); }
      ta.remove();
    }
  };
  EK.whatsapp = function(metin){ window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank'); };
  EK.paylas = function(baslik, metin){
    if(navigator.share){ navigator.share({title:baslik, text:metin}).catch(()=>{}); }
    else EK.kopyala(metin);
  };

  /* ── HTML kaçış ── */
  EK.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); };

  /* ── Modal ── */
  EK.modalAc = function(baslik, govdeHtml){
    let ov = document.getElementById('ek-modal-ov');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'ek-modal-ov'; ov.className = 'ek-modal-ov';
      ov.innerHTML = '<div class="ek-modal" role="dialog" aria-modal="true"><div class="ek-modal-bas"><h3 id="ek-modal-baslik"></h3><button class="ek-ikon-btn" onclick="EK.modalKapat()" aria-label="Kapat">✕</button></div><div class="ek-modal-govde" id="ek-modal-govde"></div></div>';
      ov.addEventListener('click', e => { if(e.target === ov) EK.modalKapat(); });
      document.body.appendChild(ov);
    }
    document.getElementById('ek-modal-baslik').textContent = baslik;
    document.getElementById('ek-modal-govde').innerHTML = govdeHtml;
    ov.classList.add('acik');
  };
  EK.modalKapat = function(){ const ov = document.getElementById('ek-modal-ov'); if(ov) ov.classList.remove('acik'); };
  document.addEventListener('keydown', e => { if(e.key === 'Escape') EK.modalKapat(); });

  /* ── Favoriler (t: h hesap, s şema, t teori) ── */
  EK.favListe = function(){ return EK.oku('ekh_fav', []); };
  EK.favMi = function(t, id){ return EK.favListe().some(f => f.t === t && f.id === id); };
  EK.favDegis = function(t, id){
    let L = EK.favListe(); const var_ = L.some(f => f.t === t && f.id === id);
    L = var_ ? L.filter(f => !(f.t === t && f.id === id)) : [{t, id}].concat(L);
    EK.yaz('ekh_fav', L.slice(0, 60));
    document.querySelectorAll('[data-fav="' + t + ':' + id + '"]').forEach(b => { b.classList.toggle('aktif', !var_); b.textContent = var_ ? '☆' : '★'; b.title = var_ ? 'Favorilere ekle' : 'Favorilerden çıkar'; });
    EK.toast(var_ ? '☆ Favorilerden çıkarıldı' : '★ Favorilere eklendi · El Kitabı ana sayfasında');
    if(typeof EK.favDegisti === 'function') EK.favDegisti();
    return !var_;
  };
  EK.favBtn = function(t, id, etiket){
    const f = EK.favMi(t, id);
    return `<${etiket || 'button'} class="ek-fav-btn${f ? ' aktif' : ''}" data-fav="${t}:${id}" role="button" title="${f ? 'Favorilerden çıkar' : 'Favorilere ekle'}" aria-label="Favori" onclick="event.preventDefault();event.stopPropagation();EK.favDegis('${t}','${id}')">${f ? '★' : '☆'}</${etiket || 'button'}>`;
  };
  /* ── Son bakılanlar (ana sayfa için) ── */
  EK.sonEkle = function(t, id){
    const L = EK.oku('ekh_son_liste', []).filter(x => !(x.t === t && x.id === id));
    L.unshift({t, id, z:Date.now()}); EK.yaz('ekh_son_liste', L.slice(0, 24));
  };

  /* ── Çevrimdışı çalışma: ERP ile aynı service worker (kapsam: uygulamanın kökü) ── */
  try{ if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('../sw.js', {scope:'../'}).catch(()=>{}); }catch(e){}

  /* ── Alt menü ── */
  EK.navCiz = function(aktif){
    const n = document.getElementById('ek-nav'); if(!n) return;
    const L = [['erp','🏠','ERP','../index.html'],['index','📗','El Kitabı','index.html'],['hesap','🔢','Hesap','hesap.html'],['semalar','📐','Şemalar','semalar.html'],['teori','📘','Teori','teori.html']];
    n.innerHTML = L.map(([k,i,a,h]) => `<a href="${h}" class="${k===aktif?'aktif':''}"><span>${i}</span><span>${a}</span></a>`).join('');
  };
})();
