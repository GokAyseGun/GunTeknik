/* Gün Teknik Android köprüsü — her sayfa yüklenişinde MainActivity tarafından eklenir. */
(function () {
  if (window.__gtKopru) return;
  window.__gtKopru = true;

  var C = window.Capacitor;
  if (!C || typeof C.nativePromise !== 'function') return;

  // ERP'nin Android uygulaması içinde çalıştığını anlaması için işaret.
  window.GT_ANDROID = { surumKodu: __SURUM_KODU__ };
  try { document.documentElement.setAttribute('data-android', '1'); } catch (e) {}
  try { window.dispatchEvent(new Event('gt-android-hazir')); } catch (e) {}

  // WebView blob/data indirmelerini desteklemez: dosyayı yerel tarafa verip
  // İndirilenler/GunTeknik'e kaydettiriyoruz.
  var asilIptal = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function (u) {
    setTimeout(function () { try { asilIptal(u); } catch (e) {} }, 60000);
  };

  function yerelMi(a) {
    var h = (a && a.href) || '';
    return a.hasAttribute('download') && (h.indexOf('blob:') === 0 || h.indexOf('data:') === 0);
  }

  function kaydet(url, ad) {
    return fetch(url)
      .then(function (r) { return r.blob(); })
      .then(function (b) {
        return new Promise(function (ok, hata) {
          var fr = new FileReader();
          fr.onload = function () {
            var s = String(fr.result);
            ok({ veri: s.slice(s.indexOf(',') + 1), ad: ad || 'dosya', tur: b.type || 'application/octet-stream' });
          };
          fr.onerror = hata;
          fr.readAsDataURL(b);
        });
      })
      .then(function (o) { return C.nativePromise('GTYerel', 'dosyaKaydet', o); })
      .catch(function (e) { alert('Dosya kaydedilemedi: ' + ((e && e.message) || e)); });
  }

  var asilTik = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (yerelMi(this)) { kaydet(this.href, this.getAttribute('download')); return; }
    return asilTik.apply(this, arguments);
  };

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a && yerelMi(a)) {
      e.preventDefault();
      e.stopPropagation();
      kaydet(a.href, a.getAttribute('download'));
    }
  }, true);
})();
