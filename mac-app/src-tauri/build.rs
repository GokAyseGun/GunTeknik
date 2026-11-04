use std::path::PathBuf;
use std::process::Command;

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "cihaz_al", "cihaz_ayarla", "ac", "dis_ac", "belge_ac", "yazdir", "pano_gizle", "pano_veri", "geri_al",
            "kasa_acik", "kasa_degistir", "surum", "guncelle_denetle", "guncelle_kur",
        ])),
    )
    .expect("tauri build");

    // macOS: masaüstü araçlarını yenileyen küçük Swift köprüsü (WidgetCenter yalnız Swift'ten çağrılabiliyor)
    let hedef = std::env::var("TARGET").unwrap_or_default();
    if hedef.contains("apple-darwin") {
        widget_koprusu(&hedef);
    }
}

fn widget_koprusu(hedef: &str) {
    let cikti = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let kaynak = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("macos/WidgetYenile.swift");
    let mimari = if hedef.contains("aarch64") { "arm64" } else { "x86_64" };
    let sdk = komut("xcrun", &["--show-sdk-path", "--sdk", "macosx"]);
    let nesne = cikti.join("WidgetYenile.o");
    let kitaplik = cikti.join("libgt_widget.a");
    let tamam = Command::new("xcrun")
        .args(["swiftc", "-parse-as-library", "-emit-object", "-O", "-whole-module-optimization"])
        .arg("-o").arg(&nesne)
        .arg(&kaynak)
        .args(["-sdk", &sdk, "-target", &format!("{mimari}-apple-macos11.0")])
        .status()
        .expect("swiftc bulunamadı (Xcode gerekli)")
        .success();
    assert!(tamam, "WidgetYenile.swift derlenemedi");
    assert!(Command::new("ar").arg("rcs").arg(&kitaplik).arg(&nesne).status().expect("ar").success());

    // Swift çalışma kitaplıkları (Mac'te /usr/lib/swift altında hazır; bağlama için SDK ve araç zinciri yolları)
    println!("cargo:rustc-link-search=native={sdk}/usr/lib/swift");
    let swiftc = komut("xcrun", &["--find", "swiftc"]);
    if let Some(z) = PathBuf::from(swiftc).parent().and_then(|p| p.parent()) {
        let p = z.join("lib/swift/macosx");
        if p.exists() {
            println!("cargo:rustc-link-search=native={}", p.display());
        }
    }
    println!("cargo:rustc-link-search=native={}", cikti.display());
    println!("cargo:rustc-link-lib=static=gt_widget");
    println!("cargo:rustc-link-arg=-weak_framework");
    println!("cargo:rustc-link-arg=WidgetKit");
    println!("cargo:rustc-link-lib=framework=Foundation");
    println!("cargo:rerun-if-changed=macos/WidgetYenile.swift");
}

fn komut(ad: &str, arg: &[&str]) -> String {
    let o = Command::new(ad).args(arg).output().unwrap_or_else(|_| panic!("{ad} çalışmadı"));
    String::from_utf8_lossy(&o.stdout).trim().to_string()
}
