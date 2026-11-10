// Touch ID ile ERP kilidi (30 dk kullanılmayınca). Touch ID yoksa / okunmazsa Mac parolasıyla açılır.
import Foundation
import LocalAuthentication

public typealias GTParmakGeri = @convention(c) (UnsafeMutableRawPointer?, Int32) -> Void

/// 2: Touch ID var · 1: yalnız Mac parolası · 0: hiçbiri
@_cdecl("gt_parmak_durum")
public func gtParmakDurum() -> Int32 {
    let c = LAContext()
    var hata: NSError?
    if c.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &hata) { return 2 }
    if c.canEvaluatePolicy(.deviceOwnerAuthentication, error: &hata) { return 1 }
    return 0
}

@_cdecl("gt_parmak_dogrula")
public func gtParmakDogrula(_ neden: UnsafePointer<CChar>, _ baglam: UnsafeMutableRawPointer?, _ geri: GTParmakGeri) {
    let c = LAContext()
    c.localizedCancelTitle = "Vazgeç"
    c.localizedFallbackTitle = "Parola gir"
    let metin = String(cString: neden)
    c.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: metin) { tamam, _ in
        geri(baglam, tamam ? 1 : 0)
    }
}
