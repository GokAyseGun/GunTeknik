fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "cihaz_al", "cihaz_ayarla", "ac", "dis_ac", "belge_ac", "yazdir", "pano_gizle", "pano_veri", "geri_al",
            "kasa_acik", "kasa_degistir", "surum", "guncelle_denetle", "guncelle_kur",
        ])),
    )
    .expect("tauri build");
}
