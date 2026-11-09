//! Gün Teknik ERP — Mac uygulaması
//! · Ana pencere: ERP (gokaysegun.github.io/GunTeknik) — kapatınca gizlenir, uygulama menü çubuğunda çalışmaya devam eder
//! · Menü çubuğu panosu: Android widget'ının karşılığı (arama · ajanda · evrak · kasa · GTCOIN)
//! · Bildirimler: sunucunun gönderdiği bütün bildirimler (Android/tarayıcıya gidenlerin aynısı) 20 sn'de bir çekilir, Mac bildirimi olarak gösterilir
//! · Kısayollar: ⌥⌘A arama ekle · ⌥⌘R randevu ekle · ⌥⌘G pano
//! · Kendi kendine güncelleme (GitHub "mac-vN" sürümleri), Mac açılınca başlama
//! · Masaüstü araçları (WidgetKit, mac-app/widget): uygulama widget.json yazar, araçlar onu okur; dokununca gunteknik://ac?yol=… ile buraya döner
mod guncelle;
mod sunucu;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
#[allow(unused_imports)]
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_positioner::{Position, WindowExt};

const ERP: &str = "https://gokaysegun.github.io/GunTeknik/";
/// Google, uygulama içi tarayıcılarda girişi engelleyebiliyor; Safari kimliğiyle açılır.
const SAFARI_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
static PENCERE_NO: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

#[derive(Default, Serialize, Deserialize, Clone)]
struct Ayar {
    token: Option<String>,
    son_bildirim: Option<String>,
    kasa_acik: bool,
    kurulum_tamam: bool,
    /// en son çalınan randevu alarmının zamanı (ms) — aynı alarm iki kez çalmasın
    #[serde(default)]
    son_alarm: i64,
}

#[derive(Default)]
struct Durum {
    ayar: Mutex<Ayar>,
    veri: Mutex<Value>,
    bekleyen: Mutex<Option<(String, Instant)>>,
    guncelleme: Mutex<Option<guncelle::Surum>>,
    widget_imza: Mutex<Option<String>>,
}

// ---------------------------------------------------------------- ayar dosyası
fn ayar_yolu(app: &AppHandle) -> Option<std::path::PathBuf> {
    let d = app.path().app_config_dir().ok()?;
    let _ = std::fs::create_dir_all(&d);
    Some(d.join("ayar.json"))
}
fn ayar_oku(app: &AppHandle) -> Ayar {
    ayar_yolu(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}
fn ayar_yaz(app: &AppHandle) {
    let a = app.state::<Durum>().ayar.lock().unwrap().clone();
    if let (Some(p), Ok(s)) = (ayar_yolu(app), serde_json::to_string_pretty(&a)) {
        let _ = std::fs::write(p, s);
    }
}
fn token(app: &AppHandle) -> Option<String> {
    app.state::<Durum>().ayar.lock().unwrap().token.clone()
}
fn surum_metni(app: &AppHandle) -> String {
    app.package_info().version.to_string()
}

// ---------------------------------------------------------------- pencereler
fn init_betik(app: &AppHandle) -> String {
    let s = surum_metni(app);
    format!(
        r#"window.GT_MAC={{surum:"{s}"}};
(function(){{
  var inv=function(c,a){{try{{return window.__TAURI_INTERNALS__.invoke(c,a||{{}});}}catch(e){{return Promise.reject(e);}}}};
  // dış bağlantılar (WhatsApp, harita, tel:, başka siteler) varsayılan tarayıcıda / uygulamada açılır
  document.addEventListener('click',function(e){{
    var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;
    var h=a.getAttribute('href')||'';if(!h||h.charAt(0)==='#'||/^javascript:/i.test(h))return;
    var dis=/^(tel:|mailto:|sms:|whatsapp:)/i.test(h)||a.target==='_blank'||(/^https?:/i.test(a.href)&&a.host!==location.host);
    if(dis){{e.preventDefault();inv('dis_ac',{{url:a.href}});}}
  }},true);
  // window.open: blob (yazdırılacak belgeler) → Mac'te varsayılan tarayıcıda açılır; diğerleri dışarıda
  var _o=window.open;
  window.open=function(u,n,f){{
    try{{
      if(u&&/^blob:/i.test(u)){{fetch(u).then(function(r){{return r.text();}}).then(function(t){{inv('belge_ac',{{html:t}});}});return null;}}
      // Google girişi (Takvim / Rehber eşitleme): uygulama içinde küçük pencerede açılır, sonuç ERP'ye döner
      if(u&&/^https:\/\/accounts\.google\.com\//i.test(new URL(u,location.href).href))return _o.apply(window,arguments);
      if(u&&!/^about:/i.test(u)){{inv('dis_ac',{{url:new URL(u,location.href).href}});return null;}}
    }}catch(e){{}}
    return _o.apply(window,arguments);
  }};
  window.print=function(){{inv('yazdir');}};
}})();"#
    )
}

fn erp_adresi(yol: Option<&str>) -> String {
    match yol {
        Some(y) if !y.is_empty() && y != "./" => format!("{ERP}{}", y.trim_start_matches("./")),
        _ => ERP.to_string(),
    }
}

/// ERP penceresini göster; `yol` verilirse ("./?sayfa=takvim", "./?arama=bugun", "./?randevu=yeni") o yere götür.
fn erp_ac(app: &AppHandle, yol: Option<String>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        if let Some(y) = yol {
            let js = format!(
                "try{{if(typeof bildirimUrlIsle==='function')bildirimUrlIsle({0});else location.href={1};}}catch(e){{location.href={1};}}",
                serde_json::to_string(&y).unwrap_or_default(),
                serde_json::to_string(&erp_adresi(Some(&y))).unwrap_or_default()
            );
            let _ = w.eval(&js);
        }
        return;
    }
    let adres = erp_adresi(yol.as_deref());
    let Ok(url) = adres.parse() else { return };
    let w = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("Gün Teknik")
        .inner_size(1320.0, 860.0)
        .min_inner_size(820.0, 560.0)
        .user_agent(SAFARI_UA)
        .initialization_script(&init_betik(app))
        .on_new_window({
            let app = app.clone();
            move |url, ozellik| {
                // yalnız Google giriş penceresi uygulama içinde açılır (window.opener bağlantısıyla, izin sonucu ERP'ye geri döner)
                if url.host_str() != Some("accounts.google.com") {
                    let _ = app.opener().open_url(url.to_string(), None::<&str>);
                    return tauri::webview::NewWindowResponse::Deny;
                }
                let n = PENCERE_NO.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                let w = WebviewWindowBuilder::new(&app, format!("google-{n}"), WebviewUrl::External("about:blank".parse().unwrap()))
                    .window_features(ozellik)
                    .title("Google ile giriş")
                    .inner_size(520.0, 680.0)
                    .user_agent(SAFARI_UA)
                    .build();
                match w {
                    Ok(window) => tauri::webview::NewWindowResponse::Create { window },
                    Err(_) => tauri::webview::NewWindowResponse::Deny,
                }
            }
        })
        .build();
    if let Ok(w) = w {
        let _ = w.set_focus();
        let a = app.clone();
        w.on_window_event(move |e| match e {
            // kapat düğmesi pencereyi gizler; uygulama menü çubuğunda çalışmaya devam eder (⌘Q kapatır)
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                if let Some(w) = a.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            // bildirime tıklayıp uygulamaya gelindiyse o bildirimin sayfasına git
            WindowEvent::Focused(true) => {
                let b = a.state::<Durum>().bekleyen.lock().unwrap().take();
                if let Some((yol, t)) = b {
                    if t.elapsed() < Duration::from_secs(600) {
                        erp_ac(&a, Some(yol));
                    }
                }
            }
            _ => {}
        });
    }
}

fn pano(app: &AppHandle) -> Option<WebviewWindow> {
    if let Some(w) = app.get_webview_window("pano") {
        return Some(w);
    }
    let w = WebviewWindowBuilder::new(app, "pano", WebviewUrl::App("pano.html".into()))
        .title("Gün Teknik")
        .inner_size(352.0, 468.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .ok()?;
    let a = app.clone();
    w.on_window_event(move |e| {
        if let WindowEvent::Focused(false) = e {
            if let Some(w) = a.get_webview_window("pano") {
                let _ = w.hide();
            }
        }
    });
    Some(w)
}

fn pano_degistir(app: &AppHandle) {
    let Some(w) = pano(app) else { return };
    if w.is_visible().unwrap_or(false) {
        let _ = w.hide();
        return;
    }
    let _ = w.move_window(Position::TrayCenter).or_else(|_| w.move_window(Position::TopRight));
    let _ = w.show();
    let _ = w.set_focus();
    let _ = w.emit("pano-acildi", ());
    let a = app.clone();
    tauri::async_runtime::spawn(async move { veri_tazele(&a).await });
}

// ---------------------------------------------------------------- veri (pano, menü çubuğu yazısı, Dock rozeti)
fn sayilar(v: &Value) -> (i64, i64) {
    // (bugünkü arama, bugün ödenecek + gecikmiş evrak)
    let bg = v.get("bugun").and_then(|b| b.as_str()).unwrap_or("").to_string();
    let arama = if bg.is_empty() { 0 } else { v.pointer("/arama/toplam").and_then(|x| x.as_i64()).unwrap_or(0) };
    let mut ev = 0;
    if let Some(od) = v.pointer("/snap/od").and_then(|x| x.as_array()) {
        for o in od {
            let t = o.get("tur").and_then(|x| x.as_str()).unwrap_or("");
            if t != "evrak" && t != "kredi" {
                continue;
            }
            let g = o.get("g").and_then(|x| x.as_str()).unwrap_or("");
            if !g.is_empty() && g <= bg.as_str() {
                ev += 1;
            }
        }
    }
    (arama, ev)
}

async fn veri_tazele(app: &AppHandle) {
    let Some(t) = token(app) else { return };
    match sunucu::widget_veri(&t).await {
        Ok(v) => {
            let (arama, ev) = sayilar(&v);
            *app.state::<Durum>().veri.lock().unwrap() = v.clone();
            widget_yaz(app, &t, &v);
            if let Some(tr) = app.tray_by_id("ana") {
                let _ = tr.set_title(Some(if arama > 0 { format!("{arama}") } else { String::new() }));
                let _ = tr.set_tooltip(Some(format!("Gün Teknik · bugün {arama} arama{}", if ev > 0 { format!(" · {ev} evrak") } else { String::new() })));
            }
            if let Some(w) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                let _ = w.set_badge_label(if ev > 0 { Some(ev.to_string()) } else { None });
                #[cfg(not(target_os = "macos"))]
                let _ = w.set_badge_count(if ev > 0 { Some(ev) } else { None });
            }
            let _ = app.emit_to("pano", "veri", v);
        }
        Err(e) => {
            let _ = app.emit_to("pano", "veri-hata", e);
        }
    }
}

// ---------------------------------------------------------------- masaüstü araçları (WidgetKit)
#[cfg(target_os = "macos")]
extern "C" {
    fn gt_widget_yenile();
}

fn widget_yenile() {
    #[cfg(target_os = "macos")]
    unsafe {
        gt_widget_yenile()
    }
}

/// Araçların okuduğu dosya: ~/Library/Application Support/com.gunteknik.mac/widget.json
/// (araç korumalı alanda çalışır; bu klasörü okuma izni kendi yetkilerinde tanımlı)
fn widget_yaz(app: &AppHandle, t: &str, v: &Value) {
    let Ok(d) = app.path().app_config_dir() else { return };
    let _ = std::fs::create_dir_all(&d);
    let p = d.join("widget.json");
    let gecici = d.join("widget.json.tmp");
    let govde = json!({ "token": t, "veri": v }).to_string();
    if std::fs::write(&gecici, govde).is_err() || std::fs::rename(&gecici, &p).is_err() {
        return;
    }
    // yalnız arama / evrak / ajanda / kasa değişince araçlara haber ver (macOS yenileme hakkını idareli kullan)
    let imza = json!([v.get("bugun"), v.get("arama"), v.get("snap_zaman")]).to_string();
    let d = app.state::<Durum>();
    let mut s = d.widget_imza.lock().unwrap();
    if s.as_deref() != Some(imza.as_str()) {
        *s = Some(imza);
        widget_yenile();
    }
}

/// gunteknik://ac?yol=./?arama=bugun · gunteknik://pano
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn baglanti_ac(app: &AppHandle, u: &tauri::Url) {
    if u.scheme() != "gunteknik" {
        return;
    }
    match u.host_str().unwrap_or("ac") {
        "pano" => pano_degistir(app),
        _ => {
            if let Some(w) = app.get_webview_window("pano") {
                let _ = w.hide();
            }
            let yol = u.query_pairs().find(|(k, _)| k == "yol").map(|(_, v)| v.to_string());
            erp_ac(app, yol.filter(|y| y.starts_with("./")));
        }
    }
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn kabuk(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// Uygulama paketindeki aracı macOS'a tanıt (ilk açılışta ve güncellemeden sonra)
fn widget_tanit() {
    #[cfg(target_os = "macos")]
    if let Some(c) = std::env::current_exe().ok().and_then(|e| e.parent()?.parent().map(|p| p.to_path_buf())) {
        let ap = c.join("PlugIns/GunTeknikWidget.appex");
        if let (true, Some(app_yolu)) = (ap.exists(), c.parent()) {
            // güncelleme .app'i yerine koyunca LaunchServices yeni paketi görmeyebiliyor ("not found in LS database"):
            // paketi yeniden kaydet, eski (geçici klasördeki) kayıtları sil, aracı etkinleştir
            let betik = format!(
                r#"LS=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
A={a}
/usr/bin/pluginkit -mAvvv -D -i com.gunteknik.mac.widget 2>/dev/null | sed -n 's/^[[:space:]]*Path = //p' | while IFS= read -r p; do
  case "$p" in "$A"/*) ;; *) /usr/bin/pluginkit -r "$p" 2>/dev/null; $LS -u "$(dirname "$(dirname "$(dirname "$p")")")" 2>/dev/null;; esac
done
$LS -f -R -trusted "$A"
/usr/bin/pluginkit -a "$A/Contents/PlugIns/GunTeknikWidget.appex"
/usr/bin/pluginkit -e use -i com.gunteknik.mac.widget
"#,
                a = kabuk(&app_yolu.to_string_lossy())
            );
            let _ = std::process::Command::new("/bin/sh").arg("-c").arg(betik).spawn();
        }
    }
}

// ---------------------------------------------------------------- bildirimler
async fn bildirim_turu(app: &AppHandle) {
    let Some(t) = token(app) else { return };
    let son = app.state::<Durum>().ayar.lock().unwrap().son_bildirim.clone();
    let Ok(r) = sunucu::bildirim_al(&t, son.as_deref()).await else { return };
    let simdi = r.get("simdi").and_then(|x| x.as_str()).map(String::from);
    let liste = r.get("liste").and_then(|x| x.as_array()).cloned().unwrap_or_default();
    let mut en_son = son.clone().or(simdi.clone());
    if son.is_none() {
        // ilk çalışma: geçmişi gösterme, şimdiden başla
        app.state::<Durum>().ayar.lock().unwrap().son_bildirim = en_son;
        ayar_yaz(app);
        return;
    }
    let goster = |baslik: &str, govde: &str| {
        let _ = app.notification().builder().title(baslik).body(govde).show();
    };
    if liste.len() > 3 {
        let govde: Vec<String> = liste.iter().map(|x| x.get("baslik").and_then(|b| b.as_str()).unwrap_or("").to_string()).collect();
        goster(&format!("Gün Teknik · {} bildirim", liste.len()), &govde.join("\n"));
    } else {
        for x in &liste {
            goster(x.get("baslik").and_then(|b| b.as_str()).unwrap_or("Gün Teknik"), x.get("govde").and_then(|b| b.as_str()).unwrap_or(""));
        }
    }
    for x in &liste {
        if let Some(g) = x.get("gonderildi").and_then(|g| g.as_str()) {
            if en_son.as_deref().map(|e| g > e).unwrap_or(true) {
                en_son = Some(g.to_string());
            }
        }
    }
    if let Some(son_x) = liste.last() {
        let url = son_x.get("url").and_then(|u| u.as_str()).unwrap_or("./").to_string();
        *app.state::<Durum>().bekleyen.lock().unwrap() = Some((url, Instant::now()));
        let a = app.clone();
        tauri::async_runtime::spawn(async move { veri_tazele(&a).await });
    }
    app.state::<Durum>().ayar.lock().unwrap().son_bildirim = en_son;
    ayar_yaz(app);
}

// ---------------------------------------------------------------- randevu alarmları
/// ERP'nin widget görüntüsündeki snap.al listesi (telefonda gerçek alarm kurulan liste): vakti gelen her biri için
/// sesli bildirim + Dock simgesi zıplar. Saatli randevu: hatırlatma kadar önce + randevu anında.
fn alarm_bak(app: &AppHandle) {
    let simdi = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let al = {
        let d = app.state::<Durum>();
        let v = d.veri.lock().unwrap();
        v.get("snap").and_then(|s| s.get("al")).and_then(|a| a.as_array()).cloned().unwrap_or_default()
    };
    let son = app.state::<Durum>().ayar.lock().unwrap().son_alarm;
    let alt_sinir = son.max(simdi - 10 * 60_000);
    let mut caldi = son;
    let mut liste: Vec<&Value> = al
        .iter()
        .filter(|x| {
            let z = x.get("z").and_then(|z| z.as_i64()).unwrap_or(0);
            z > alt_sinir && z <= simdi
        })
        .collect();
    liste.sort_by_key(|x| x.get("z").and_then(|z| z.as_i64()).unwrap_or(0));
    for x in liste {
        let s = |k: &str| x.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();
        let z = x.get("z").and_then(|z| z.as_i64()).unwrap_or(0);
        let h = x.get("h").and_then(|h| h.as_i64()).unwrap_or(0);
        let ust = match s("tur").as_str() {
            "once" => format!("⏰ {} sonra", sure_yaz(h)),
            "gun" => "📅 Bugün".to_string(),
            _ => "🔔 Randevu saati".to_string(),
        };
        let mut govde = Vec::new();
        if !s("s").is_empty() {
            govde.push(format!("🕐 {}", s("s")));
        }
        if !s("k").is_empty() {
            govde.push(format!("👤 {}{}", s("k"), if s("tel").is_empty() { String::new() } else { format!(" · {}", s("tel")) }));
        }
        if !s("ad").is_empty() {
            govde.push(format!("📍 {}", s("ad")));
        }
        let _ = app
            .notification()
            .builder()
            .title(format!("{ust} · {}", s("b")))
            .body(govde.join("  "))
            .sound("Glass")
            .show();
        caldi = caldi.max(z);
    }
    if caldi > son {
        app.state::<Durum>().ayar.lock().unwrap().son_alarm = caldi;
        ayar_yaz(app);
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.request_user_attention(Some(tauri::UserAttentionType::Critical));
        }
        *app.state::<Durum>().bekleyen.lock().unwrap() = Some(("./?sayfa=takvim".into(), Instant::now()));
    }
}

fn sure_yaz(dk: i64) -> String {
    if dk <= 0 {
        "şimdi".into()
    } else if dk % 1440 == 0 {
        format!("{} gün", dk / 1440)
    } else if dk >= 60 && dk % 60 == 0 {
        format!("{} saat", dk / 60)
    } else if dk > 60 {
        format!("{} sa {} dk", dk / 60, dk % 60)
    } else {
        format!("{dk} dk")
    }
}

// ---------------------------------------------------------------- güncelleme
async fn guncelleme_bak(app: &AppHandle, sessiz: bool) -> Result<guncelle::Surum, String> {
    let s = guncelle::denetle(&surum_metni(app)).await?;
    let onceki = app.state::<Durum>().guncelleme.lock().unwrap().clone();
    *app.state::<Durum>().guncelleme.lock().unwrap() = if s.var { Some(s.clone()) } else { None };
    if s.var {
        menu_kur(app);
        if !sessiz || onceki.map(|o| o.no != s.no).unwrap_or(true) {
            let _ = app.notification().builder()
                .title("⬆️ Gün Teknik güncellemesi hazır")
                .body(&format!("Sürüm 1.0.{} · menü çubuğundaki simgeden ya da Ayarlar'dan kur", s.no))
                .show();
        }
    }
    Ok(s)
}

async fn guncelleme_kur_ic(app: &AppHandle) -> Result<(), String> {
    let s = match app.state::<Durum>().guncelleme.lock().unwrap().clone() {
        Some(s) => s,
        None => return Err("Kurulacak güncelleme yok".into()),
    };
    guncelle::kur(&s).await?;
    app.exit(0);
    Ok(())
}

// ---------------------------------------------------------------- menü çubuğu
fn menu_kur(app: &AppHandle) {
    let Some(tr) = app.tray_by_id("ana") else { return };
    let g = app.state::<Durum>().guncelleme.lock().unwrap().clone();
    let oto = app.autolaunch().is_enabled().unwrap_or(false);
    let m = (|| -> tauri::Result<Menu<tauri::Wry>> {
        let ac = MenuItem::with_id(app, "ac", "Gün Teknik'i aç", true, None::<&str>)?;
        let pano = MenuItem::with_id(app, "pano", "Panoyu göster   ⌥⌘G", true, None::<&str>)?;
        let arama = MenuItem::with_id(app, "arama", "📞 Arama ekle   ⌥⌘A", true, None::<&str>)?;
        let randevu = MenuItem::with_id(app, "randevu", "📅 Randevu ekle   ⌥⌘R", true, None::<&str>)?;
        let gunc = match &g {
            Some(s) => MenuItem::with_id(app, "kur", format!("⬆️ Güncellemeyi kur (1.0.{})", s.no), true, None::<&str>)?,
            None => MenuItem::with_id(app, "denetle", "Güncellemeleri denetle", true, None::<&str>)?,
        };
        let surum = MenuItem::with_id(app, "surum", format!("Sürüm {}", surum_metni(app)), false, None::<&str>)?;
        let basla = CheckMenuItem::with_id(app, "otobasla", "Mac açılınca başlat", true, oto, None::<&str>)?;
        let cik = MenuItem::with_id(app, "cik", "Çıkış", true, Some("CmdOrCtrl+Q"))?;
        let ay1 = PredefinedMenuItem::separator(app)?;
        let ay2 = PredefinedMenuItem::separator(app)?;
        let ay3 = PredefinedMenuItem::separator(app)?;
        Menu::with_items(app, &[&ac, &pano, &ay1, &arama, &randevu, &ay2, &gunc, &basla, &surum, &ay3, &cik])
    })();
    if let Ok(m) = m {
        let _ = tr.set_menu(Some(m));
    }
}

fn menu_olay(app: &AppHandle, id: &str) {
    match id {
        "ac" => erp_ac(app, None),
        "pano" => pano_degistir(app),
        "arama" => erp_ac(app, Some("./?arama=bugun".into())),
        "randevu" => erp_ac(app, Some("./?randevu=yeni".into())),
        "denetle" => {
            let a = app.clone();
            tauri::async_runtime::spawn(async move {
                match guncelleme_bak(&a, false).await {
                    Ok(s) if !s.var => {
                        let _ = a.notification().builder().title("Gün Teknik güncel").body(&format!("Sürüm {}", surum_metni(&a))).show();
                    }
                    Err(e) => {
                        let _ = a.notification().builder().title("Güncelleme denetlenemedi").body(&e).show();
                    }
                    _ => {}
                }
            });
        }
        "kur" => {
            let a = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = guncelleme_kur_ic(&a).await {
                    let _ = a.notification().builder().title("Güncelleme kurulamadı").body(&e).show();
                }
            });
        }
        "otobasla" => {
            let al = app.autolaunch();
            if al.is_enabled().unwrap_or(false) { let _ = al.disable(); } else { let _ = al.enable(); }
            menu_kur(app);
        }
        "cik" => app.exit(0),
        _ => {}
    }
}

// ---------------------------------------------------------------- komutlar (ERP penceresi ve pano)
#[tauri::command]
fn cihaz_al(app: AppHandle) -> Option<String> {
    token(&app)
}

#[tauri::command]
fn cihaz_ayarla(app: AppHandle, token: String) {
    {
        let d = app.state::<Durum>();
        let mut a = d.ayar.lock().unwrap();
        if a.token.as_deref() == Some(token.as_str()) {
            return;
        }
        a.token = Some(token);
    }
    ayar_yaz(&app);
    let a = app.clone();
    tauri::async_runtime::spawn(async move {
        veri_tazele(&a).await;
        bildirim_turu(&a).await;
    });
}

#[tauri::command]
fn ac(app: AppHandle, url: Option<String>) {
    if let Some(w) = app.get_webview_window("pano") {
        let _ = w.hide();
    }
    erp_ac(&app, url);
}

#[tauri::command]
fn dis_ac(app: AppHandle, url: String) -> Result<(), String> {
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn belge_ac(app: AppHandle, html: String) -> Result<(), String> {
    let d = std::env::temp_dir().join("gunteknik-belgeler");
    let _ = std::fs::create_dir_all(&d);
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|x| x.as_millis()).unwrap_or(0);
    let p = d.join(format!("belge-{ts}.html"));
    std::fs::write(&p, html).map_err(|e| e.to_string())?;
    app.opener().open_path(p.to_string_lossy().to_string(), None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn yazdir(app: AppHandle) -> Result<(), String> {
    match app.get_webview_window("main") {
        Some(w) => w.print().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

#[tauri::command]
fn pano_gizle(app: AppHandle) {
    if let Some(w) = app.get_webview_window("pano") {
        let _ = w.hide();
    }
}

#[tauri::command]
async fn pano_veri(app: AppHandle, yenile: bool) -> Result<Value, String> {
    if yenile {
        veri_tazele(&app).await;
    }
    let v = app.state::<Durum>().veri.lock().unwrap().clone();
    Ok(json!({ "veri": v, "giris": token(&app).is_some(), "kasa_acik": app.state::<Durum>().ayar.lock().unwrap().kasa_acik }))
}

#[tauri::command]
async fn geri_al(app: AppHandle, id: i64) -> Result<Value, String> {
    let t = token(&app).ok_or("Önce Gün Teknik'i açıp ERP'ye giriş yap")?;
    let r = sunucu::arama_sil(&t, id).await?;
    veri_tazele(&app).await;
    Ok(r)
}

#[tauri::command]
fn kasa_acik(app: AppHandle) -> bool {
    app.state::<Durum>().ayar.lock().unwrap().kasa_acik
}

#[tauri::command]
fn kasa_degistir(app: AppHandle) -> bool {
    let v = {
        let d = app.state::<Durum>();
        let mut a = d.ayar.lock().unwrap();
        a.kasa_acik = !a.kasa_acik;
        a.kasa_acik
    };
    ayar_yaz(&app);
    v
}

#[tauri::command]
fn surum(app: AppHandle) -> String {
    surum_metni(&app)
}

#[tauri::command]
async fn guncelle_denetle(app: AppHandle) -> Result<guncelle::Surum, String> {
    guncelleme_bak(&app, true).await
}

#[tauri::command]
async fn guncelle_kur(app: AppHandle) -> Result<(), String> {
    if app.state::<Durum>().guncelleme.lock().unwrap().is_none() {
        guncelleme_bak(&app, true).await?;
    }
    guncelleme_kur_ic(&app).await
}

// ---------------------------------------------------------------- başlangıç
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| erp_ac(app, None)))
        .plugin(tauri_plugin_notification::init())
        .plugin({
            let b = tauri_plugin_autostart::Builder::new().app_name("Gün Teknik");
            #[cfg(target_os = "macos")]
            let b = b.macos_launcher(MacosLauncher::LaunchAgent);
            b.build()
        })
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, kisa, olay| {
                    if olay.state() != ShortcutState::Pressed {
                        return;
                    }
                    let k = kisa.into_string().to_lowercase();
                    if k.ends_with("keya") {
                        erp_ac(app, Some("./?arama=bugun".into()));
                    } else if k.ends_with("keyr") {
                        erp_ac(app, Some("./?randevu=yeni".into()));
                    } else if k.ends_with("keyg") {
                        pano_degistir(app);
                    }
                })
                .build(),
        )
        .manage(Durum::default())
        .invoke_handler(tauri::generate_handler![
            cihaz_al, cihaz_ayarla, ac, dis_ac, belge_ac, yazdir, pano_gizle, pano_veri, geri_al,
            kasa_acik, kasa_degistir, surum, guncelle_denetle, guncelle_kur
        ])
        .setup(|app| {
            let h = app.handle().clone();
            *app.state::<Durum>().ayar.lock().unwrap() = ayar_oku(&h);

            // ilk kurulum: Mac açılınca başlasın
            let ilk = !app.state::<Durum>().ayar.lock().unwrap().kurulum_tamam;
            if ilk {
                let _ = h.autolaunch().enable();
                app.state::<Durum>().ayar.lock().unwrap().kurulum_tamam = true;
                ayar_yaz(&h);
            } else if h.autolaunch().is_enabled().unwrap_or(false) {
                // uygulamanın yeri / adı değiştiyse (GunTeknik.app) Mac açılış kaydını yeni yola göre yenile
                let _ = h.autolaunch().disable();
                let _ = h.autolaunch().enable();
            }

            // menü çubuğu simgesi: sol tık pano, sağ tık menü
            let simge = app.default_window_icon().cloned();
            let mut tb = TrayIconBuilder::with_id("ana")
                .tooltip("Gün Teknik")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, e| menu_olay(app, e.id().as_ref()))
                .on_tray_icon_event(|tray, e| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &e);
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                        pano_degistir(tray.app_handle());
                    }
                });
            if let Some(s) = simge {
                tb = tb.icon(s);
            }
            tb.build(app)?;
            menu_kur(&h);

            let _ = h.global_shortcut().register("Alt+Super+KeyA");
            let _ = h.global_shortcut().register("Alt+Super+KeyR");
            let _ = h.global_shortcut().register("Alt+Super+KeyG");

            pano(&h);
            erp_ac(&h, None);
            widget_tanit();
            widget_yenile();

            // döngüler: bildirim 20 sn, randevu alarmı 15 sn, pano verisi 3 dk, güncelleme 6 saat
            let a = h.clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    bildirim_turu(&a).await;
                    tokio::time::sleep(Duration::from_secs(20)).await;
                }
            });
            let a = h.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(25)).await;
                loop {
                    alarm_bak(&a);
                    tokio::time::sleep(Duration::from_secs(15)).await;
                }
            });
            let a = h.clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    veri_tazele(&a).await;
                    tokio::time::sleep(Duration::from_secs(180)).await;
                }
            });
            let a = h.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(60)).await;
                loop {
                    let _ = guncelleme_bak(&a, true).await;
                    tokio::time::sleep(Duration::from_secs(6 * 3600)).await;
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Gün Teknik başlatılamadı");

    app.run(|_app, _e| {
        #[cfg(target_os = "macos")]
        match _e {
            // Dock simgesine tıklanınca ERP penceresi
            tauri::RunEvent::Reopen { .. } => erp_ac(_app, None),
            // masaüstü aracına dokunuldu (gunteknik://…)
            tauri::RunEvent::Opened { urls } => {
                for u in &urls {
                    baglanti_ac(_app, u);
                }
            }
            _ => {}
        }
    });
}
