// Fiş görseli: panoya kopyala (WhatsApp'ta ⌘V ile yapıştırılır) ve İndirilenler'e kaydet.
import AppKit
import Foundation

private func gtAnaIste(_ is_: () -> Int32) -> Int32 {
    if Thread.isMainThread { return is_() }
    return DispatchQueue.main.sync { is_() }
}

/// 1: kopyalandı · 0: hata
@_cdecl("gt_pano_png")
public func gtPanoPng(_ b64: UnsafePointer<CChar>) -> Int32 {
    guard let veri = Data(base64Encoded: String(cString: b64), options: .ignoreUnknownCharacters), !veri.isEmpty else { return 0 }
    return gtAnaIste {
        let pb = NSPasteboard.general
        pb.clearContents()
        let oge = NSPasteboardItem()
        var tamam = oge.setData(veri, forType: .png)
        if let tiff = NSImage(data: veri)?.tiffRepresentation {
            tamam = oge.setData(tiff, forType: .tiff) || tamam
        }
        return (tamam && pb.writeObjects([oge])) ? 1 : 0
    }
}

/// İndirilenler klasörüne yazar ve Finder'da gösterir. 1: tamam · 0: hata
@_cdecl("gt_png_kaydet")
public func gtPngKaydet(_ b64: UnsafePointer<CChar>, _ ad: UnsafePointer<CChar>) -> Int32 {
    guard let veri = Data(base64Encoded: String(cString: b64), options: .ignoreUnknownCharacters), !veri.isEmpty else { return 0 }
    guard let klasor = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first else { return 0 }
    var dosya = String(cString: ad).replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
    if dosya.isEmpty { dosya = "fis.png" }
    let url = klasor.appendingPathComponent(dosya)
    do { try veri.write(to: url) } catch { return 0 }
    _ = gtAnaIste {
        NSWorkspace.shared.activateFileViewerSelecting([url])
        return 1
    }
    return 1
}
