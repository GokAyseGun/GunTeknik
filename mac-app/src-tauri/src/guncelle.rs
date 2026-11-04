//! Kendi kendine güncelleme: GitHub'daki en yeni "mac-vN" sürümüne bakar, .app'i indirip yerine koyar ve yeniden açar.
//! (Android'deki ⬆️ Güncelleme gibi; Apple geliştirici hesabı gerekmez.)
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

const DEPO: &str = "GokAyseGun/GunTeknik";
const VARLIK: &str = "GunTeknik-Mac.app.tar.gz";

#[derive(Clone, Serialize, Default)]
pub struct Surum {
    pub var: bool,
    pub etiket: String,
    pub no: u64,
    pub url: String,
    pub ozet: Option<String>,
    pub notlar: String,
}

/// "1.0.42" → 42
pub fn yapi_no(surum: &str) -> u64 {
    surum.rsplit('.').next().and_then(|s| s.parse().ok()).unwrap_or(0)
}

pub async fn denetle(simdiki: &str) -> Result<Surum, String> {
    let r = crate::sunucu::istemci()
        .get(format!("https://api.github.com/repos/{DEPO}/releases?per_page=20"))
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !r.status().is_success() {
        return Err(format!("GitHub {}", r.status().as_u16()));
    }
    let liste: Value = r.json().await.map_err(|e| e.to_string())?;
    let bizim = yapi_no(simdiki);
    let mut en: Option<Surum> = None;
    for s in liste.as_array().cloned().unwrap_or_default() {
        if s.get("draft").and_then(|d| d.as_bool()).unwrap_or(false) {
            continue;
        }
        let etiket = s.get("tag_name").and_then(|t| t.as_str()).unwrap_or("");
        let Some(no) = etiket.strip_prefix("mac-v").and_then(|n| n.parse::<u64>().ok()) else { continue };
        if en.as_ref().map(|e| no <= e.no).unwrap_or(false) {
            continue;
        }
        let varlik = s
            .get("assets")
            .and_then(|a| a.as_array())
            .and_then(|a| a.iter().find(|x| x.get("name").and_then(|n| n.as_str()) == Some(VARLIK)).cloned());
        let Some(v) = varlik else { continue };
        en = Some(Surum {
            var: no > bizim,
            etiket: etiket.to_string(),
            no,
            url: v.get("browser_download_url").and_then(|u| u.as_str()).unwrap_or("").to_string(),
            ozet: v.get("digest").and_then(|d| d.as_str()).and_then(|d| d.strip_prefix("sha256:")).map(String::from),
            notlar: s.get("body").and_then(|b| b.as_str()).unwrap_or("").chars().take(300).collect(),
        });
    }
    Ok(en.unwrap_or_default())
}

/// Çalışan uygulamanın .app klasörü (…/Gün Teknik.app)
fn paket_yolu() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let p = exe.parent()?.parent()?.parent()?.to_path_buf(); // MacOS → Contents → X.app
    if p.extension().map(|e| e == "app").unwrap_or(false) { Some(p) } else { None }
}

/// İndir, doğrula, aç; yeni .app'i eskisinin yerine koyup yeniden başlatacak betiği çalıştır.
pub async fn kur(s: &Surum) -> Result<(), String> {
    let hedef = paket_yolu().ok_or("Uygulama bir .app paketinden çalışmıyor")?;
    let gecici = std::env::temp_dir().join(format!("gunteknik-guncelle-{}", s.no));
    let _ = std::fs::remove_dir_all(&gecici);
    std::fs::create_dir_all(&gecici).map_err(|e| e.to_string())?;
    let veri = crate::sunucu::istemci()
        .get(&s.url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    if let Some(ozet) = &s.ozet {
        let h = hex::encode(Sha256::digest(&veri));
        if !h.eq_ignore_ascii_case(ozet) {
            return Err("İndirilen dosya doğrulanamadı".into());
        }
    }
    let gz = flate2::read::GzDecoder::new(&veri[..]);
    tar::Archive::new(gz).unpack(&gecici).map_err(|e| e.to_string())?;
    let yeni = std::fs::read_dir(&gecici)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .find(|p| p.extension().map(|x| x == "app").unwrap_or(false))
        .ok_or("Paket içinde .app bulunamadı")?;
    betik_calistir(&yeni, &hedef)
}

fn betik_calistir(yeni: &Path, hedef: &Path) -> Result<(), String> {
    let betik = std::env::temp_dir().join("gunteknik-guncelle.sh");
    let h = hedef.to_string_lossy();
    let y = yeni.to_string_lossy();
    let icerik = format!(
        "#!/bin/sh\nsleep 1.5\nrm -rf \"{h}.eski\"\nmv \"{h}\" \"{h}.eski\" && mv \"{y}\" \"{h}\" && rm -rf \"{h}.eski\"\nxattr -cr \"{h}\" 2>/dev/null\nopen \"{h}\"\n"
    );
    std::fs::write(&betik, icerik).map_err(|e| e.to_string())?;
    std::process::Command::new("/bin/sh")
        .arg(&betik)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
