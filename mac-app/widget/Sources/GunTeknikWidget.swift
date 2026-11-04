// Gün Teknik — macOS masaüstü / Bildirim Merkezi araçları (WidgetKit)
// · "Gün Teknik" aracı: küçük / orta / büyük / çok büyük — Android widget'ının karşılığı
//   (arama ekle · arama bugün · geri al / randevu ekle · ajanda bugün · 10 gün / evrak bugün · 5 · 15 gün / kasa · göster)
// · "GTCOIN" aracı: küçük — 1 GTC fiyatı ve 24 saatlik değişim
// Veri: Gün Teknik uygulaması ~/Library/Application Support/com.gunteknik.mac/widget.json dosyasını yazar
// (cihaz anahtarı + widget_veri). Veri 8 dakikadan eskiyse araç kendisi de sunucudan tazeler.
import AppIntents
import Foundation
import SwiftUI
import WidgetKit

// MARK: - Sunucu

enum Sunucu {
    static let url = "https://zfflnrerdevnflchscqe.supabase.co"
    static let anahtar = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZmxucmVyZGV2bmZsY2hzY3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MzQ3MjUsImV4cCI6MjA5NjQxMDcyNX0.uby8MidaKpnsceel5E_zTJm3LTYwoMrbKUryr5ZszcI"

    static func rpc(_ fonksiyon: String, _ govde: [String: Any]) async -> Any? {
        guard let u = URL(string: "\(url)/rest/v1/rpc/\(fonksiyon)") else { return nil }
        var r = URLRequest(url: u)
        r.httpMethod = "POST"
        r.timeoutInterval = 15
        r.setValue(anahtar, forHTTPHeaderField: "apikey")
        r.setValue("Bearer \(anahtar)", forHTTPHeaderField: "Authorization")
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.httpBody = try? JSONSerialization.data(withJSONObject: govde)
        guard let sonuc = try? await URLSession.shared.data(for: r),
              let h = sonuc.1 as? HTTPURLResponse, (200..<300).contains(h.statusCode) else { return nil }
        let veri = sonuc.0
        if veri.isEmpty { return NSNull() }
        return try? JSONSerialization.jsonObject(with: veri, options: [.fragmentsAllowed])
    }

    static func widgetVeri(_ token: String) async -> [String: Any]? {
        await rpc("widget_veri", ["p_token": token]) as? [String: Any]
    }
}

// MARK: - Depo (uygulamanın yazdığı dosya + aracın kendi önbelleği)

enum Depo {
    static let ayarlar = UserDefaults.standard

    /// Korumalı alanda NSHomeDirectory() aracın kendi klasörünü verir; gerçek ev klasörü:
    static var gercekEv: String {
        if let pw = getpwuid(getuid()), let d = pw.pointee.pw_dir { return String(cString: d) }
        return NSHomeDirectory()
    }

    static func dosya() -> (token: String?, veri: [String: Any]?) {
        let yollar = [
            gercekEv + "/Library/Application Support/com.gunteknik.mac/widget.json",
            NSHomeDirectory() + "/widget.json",
        ]
        for y in yollar {
            if let d = FileManager.default.contents(atPath: y),
               let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                return (j["token"] as? String, j["veri"] as? [String: Any])
            }
        }
        return (nil, nil)
    }

    static func onbellek() -> [String: Any]? {
        guard let d = ayarlar.data(forKey: "veri") else { return nil }
        return try? JSONSerialization.jsonObject(with: d) as? [String: Any]
    }

    static func onbellekYaz(_ v: [String: Any]) {
        if let d = try? JSONSerialization.data(withJSONObject: v) { ayarlar.set(d, forKey: "veri") }
    }

    /// "2026-11-04T08:42:00.123456+00:00" → Date
    static func zaman(_ v: [String: Any]?) -> Date {
        guard let s = v?["zaman"] as? String, s.count >= 19 else { return .distantPast }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        guard var d = f.date(from: String(s.prefix(19))) else { return .distantPast }
        let son = s.suffix(6)
        if son.count == 6, let isaret = son.first, isaret == "+" || isaret == "-" {
            let p = son.dropFirst().split(separator: ":").compactMap { Int($0) }
            if p.count == 2 {
                let sn = Double(p[0] * 3600 + p[1] * 60)
                d = d.addingTimeInterval(isaret == "+" ? -sn : sn)
            }
        }
        return d
    }

    static func durum() -> (String?, [String: Any]?) {
        let (t, dv) = dosya()
        let ov = onbellek()
        return (t, zaman(ov) > zaman(dv) ? ov : dv)
    }

    static func taze() async -> Ozet {
        var (t, v) = durum()
        if let t, Date().timeIntervalSince(zaman(v)) > 8 * 60, let yeni = await Sunucu.widgetVeri(t) {
            onbellekYaz(yeni)
            v = yeni
        }
        return Ozet(token: t, v: v)
    }
}

// MARK: - Özet (pano.html ile aynı hesap)

struct AjandaSatir: Hashable {
    let fark: Int
    let g: String
    let saat: String
    let baslik: String
    let kisi: String
}

struct EvrakSatir: Hashable {
    let fark: Int
    let g: String
    let ad: String
    let tutar: Double
}

struct Ozet {
    var giris = false
    var veriVar = false
    var arama: Int?
    var sonAramaId: Int?
    var sonAramaAd: String?
    var aj1: Int?, aj10: Int?, ev1: Int?, ev5: Int?, ev15: Int?, gec: Int?
    var kasa: Double?
    var gtFiyat: Double = 0
    var gtOnce: Double = 0
    var zaman: Date = .distantPast
    var ajanda: [AjandaSatir] = []
    var evrak: [EvrakSatir] = []

    static func bugun() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "Europe/Istanbul")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    static func gunNo(_ s: String) -> Int? {
        let p = s.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        var c = DateComponents()
        c.year = p[0]; c.month = p[1]; c.day = p[2]
        var takvim = Calendar(identifier: .gregorian)
        takvim.timeZone = TimeZone(identifier: "UTC")!
        guard let d = takvim.date(from: c) else { return nil }
        return Int((d.timeIntervalSince1970 / 86400).rounded())
    }

    static func sayi(_ x: Any?) -> Double? { (x as? NSNumber)?.doubleValue ?? (x as? String).flatMap { Double($0) } }

    init() {}

    init(token: String?, v: [String: Any]?) {
        giris = token != nil
        guard let v else { return }
        veriVar = true
        zaman = Depo.zaman(v)
        let bg = Ozet.bugun()
        let bn = Ozet.gunNo(bg) ?? 0
        func fark(_ g: String) -> Int { (Ozet.gunNo(g) ?? (bn + 999)) - bn }

        let a = v["arama"] as? [String: Any]
        arama = (v["bugun"] as? String)?.prefix(10) == Substring(bg) ? Int(Ozet.sayi(a?["toplam"]) ?? 0) : 0
        if let son = (a?["son"] as? [[String: Any]])?.first {
            sonAramaId = Ozet.sayi(son["id"]).map { Int($0) }
            sonAramaAd = son["ad"] as? String
        }
        if let gt = v["gt"] as? [String: Any] {
            gtFiyat = Ozet.sayi(gt["fiyat"]) ?? 0
            gtOnce = Ozet.sayi(gt["once"]) ?? 0
        }
        guard let snap = v["snap"] as? [String: Any] else { return }
        var a1 = 0, a10 = 0, e1 = 0, e5 = 0, e15 = 0, gc = 0
        var aj: [AjandaSatir] = []
        for x in (snap["aj"] as? [[String: Any]]) ?? [] {
            let g = x["g"] as? String ?? ""
            let f = fark(g)
            if f == 0 { a1 += 1 }
            if f >= 0 && f <= 9 {
                a10 += 1
                aj.append(AjandaSatir(fark: f, g: g, saat: x["s"] as? String ?? "", baslik: x["b"] as? String ?? "İş", kisi: x["k"] as? String ?? ""))
            }
        }
        var ev: [EvrakSatir] = []
        for x in (snap["od"] as? [[String: Any]]) ?? [] {
            let tur = x["tur"] as? String ?? ""
            guard tur == "evrak" || tur == "kredi" else { continue }
            let g = x["g"] as? String ?? ""
            let f = fark(g)
            if f < 0 { gc += 1 } else if f == 0 { e1 += 1 }
            if f >= 0 && f <= 4 { e5 += 1 }
            if f >= 0 && f <= 14 { e15 += 1 }
            if f <= 14 { ev.append(EvrakSatir(fark: f, g: g, ad: x["ad"] as? String ?? "Evrak", tutar: Ozet.sayi(x["t"]) ?? 0)) }
        }
        aj1 = a1; aj10 = a10; ev1 = e1; ev5 = e5; ev15 = e15; gec = gc
        ajanda = aj.sorted { ($0.g, $0.saat.isEmpty ? "99" : $0.saat) < ($1.g, $1.saat.isEmpty ? "99" : $1.saat) }
        evrak = ev.sorted { $0.g < $1.g }
        if let k = snap["kasa"] as? [String: Any] { kasa = Ozet.sayi(k["top"]) }
    }

    static var ornek: Ozet {
        var o = Ozet()
        o.giris = true; o.veriVar = true
        o.arama = 7; o.aj1 = 3; o.aj10 = 9; o.ev1 = 1; o.ev5 = 2; o.ev15 = 4; o.gec = 0
        o.kasa = 17413; o.gtFiyat = 972.4; o.gtOnce = 965.1; o.zaman = Date()
        o.ajanda = [AjandaSatir(fark: 0, g: "", saat: "10:30", baslik: "Klima bakımı", kisi: "Dalyan")]
        return o
    }
}

// MARK: - Zaman çizelgesi

struct Giris: TimelineEntry {
    let date: Date
    let o: Ozet
    let kasaAcik: Bool
    let geriOnay: Bool
}

enum Durumlar {
    static var kasaAcik: Bool { Depo.ayarlar.bool(forKey: "kasa_acik") }
    static var geriOnayZamani: Double { Depo.ayarlar.double(forKey: "geri_onay") }
    static func geriOnayda(_ simdi: Date = Date()) -> Bool {
        let t = geriOnayZamani
        return t > 0 && simdi.timeIntervalSince1970 - t < 6
    }
}

struct Saglayici: TimelineProvider {
    func placeholder(in context: Context) -> Giris {
        Giris(date: Date(), o: .ornek, kasaAcik: false, geriOnay: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (Giris) -> Void) {
        if context.isPreview {
            let (t, v) = Depo.durum()
            let o = Ozet(token: t, v: v)
            completion(Giris(date: Date(), o: o.veriVar ? o : .ornek, kasaAcik: false, geriOnay: false))
            return
        }
        Task {
            let o = await Depo.taze()
            completion(Giris(date: Date(), o: o, kasaAcik: Durumlar.kasaAcik, geriOnay: Durumlar.geriOnayda()))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Giris>) -> Void) {
        Task {
            let o = await Depo.taze()
            let simdi = Date()
            var liste = [Giris(date: simdi, o: o, kasaAcik: Durumlar.kasaAcik, geriOnay: Durumlar.geriOnayda(simdi))]
            if Durumlar.geriOnayda(simdi) {
                // "Emin misin?" 6 saniye sonra kendiliğinden kalkar
                liste.append(Giris(date: Date(timeIntervalSince1970: Durumlar.geriOnayZamani + 6.5), o: o, kasaAcik: Durumlar.kasaAcik, geriOnay: false))
            }
            completion(Timeline(entries: liste, policy: .after(simdi.addingTimeInterval(10 * 60))))
        }
    }
}

// MARK: - Dokunmatik eylemler (macOS 14)

struct KasaDegistir: AppIntent {
    static let title: LocalizedStringResource = "Kasayı göster / gizle"
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        Depo.ayarlar.set(!Depo.ayarlar.bool(forKey: "kasa_acik"), forKey: "kasa_acik")
        return .result()
    }
}

struct GeriAl: AppIntent {
    static let title: LocalizedStringResource = "Son arama kaydını geri al"
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        let simdi = Date()
        if !Durumlar.geriOnayda(simdi) {
            // ilk dokunuş: onay iste
            Depo.ayarlar.set(simdi.timeIntervalSince1970, forKey: "geri_onay")
            return .result()
        }
        Depo.ayarlar.set(0.0, forKey: "geri_onay")
        let (t, v) = Depo.durum()
        let o = Ozet(token: t, v: v)
        if let t, let id = o.sonAramaId {
            _ = await Sunucu.rpc("arama_sil", ["p_token": t, "p_id": id])
            if let yeni = await Sunucu.widgetVeri(t) { Depo.onbellekYaz(yeni) }
        }
        return .result()
    }
}

// MARK: - Görünüm yardımcıları

extension Color {
    static let zemin = Color(red: 0.08, green: 0.08, blue: 0.08)
    static let kutu = Color.white.opacity(0.07)
    static let cizgi = Color.white.opacity(0.12)
    static let metin = Color(white: 0.94)
    static let metin2 = Color(white: 0.69)
    static let metin3 = Color(white: 0.5)
    static let hardal = Color(red: 0.851, green: 0.643, blue: 0.255)
    static let yesil = Color(red: 0.0, green: 0.902, blue: 0.463)
    static let kirmizi = Color(red: 1.0, green: 0.322, blue: 0.322)
    static let amber = Color(red: 1.0, green: 0.671, blue: 0.0)
    static let mg = Color(red: 0.91, green: 0.098, blue: 0.478)
    static let cyanR = Color(red: 0.0, green: 0.898, blue: 1.0)
    static let altin = Color(red: 0.961, green: 0.773, blue: 0.259)
}

func baglanti(_ yol: String) -> URL {
    var c = URLComponents()
    c.scheme = "gunteknik"
    c.host = "ac"
    c.queryItems = [URLQueryItem(name: "yol", value: yol)]
    return c.url ?? URL(string: "gunteknik://ac")!
}

func tl(_ v: Double) -> String {
    let f = NumberFormatter()
    f.locale = Locale(identifier: "tr_TR")
    f.numberStyle = .decimal
    f.maximumFractionDigits = 0
    return (f.string(from: NSNumber(value: abs(v).rounded())) ?? "0") + " ₺"
}

func fiyat2(_ v: Double) -> String {
    let f = NumberFormatter()
    f.locale = Locale(identifier: "tr_TR")
    f.numberStyle = .decimal
    f.minimumFractionDigits = 2
    f.maximumFractionDigits = 2
    return f.string(from: NSNumber(value: v)) ?? "0"
}

func sy(_ x: Int?) -> String { x.map { String($0) } ?? "—" }

func degisim(_ o: Ozet) -> (String, Color) {
    guard o.gtOnce > 0 else { return ("", .metin3) }
    let y = (o.gtFiyat / o.gtOnce - 1) * 100
    let m = String(format: "%.2f", abs(y)).replacingOccurrences(of: ".", with: ",")
    return y >= 0 ? ("▲ +%\(m)", .yesil) : ("▼ −%\(m)", .kirmizi)
}

func kasaMetni(_ e: Giris) -> (String, Color) {
    guard let k = e.o.kasa else { return ("—", .metin3) }
    if !e.kasaAcik { return ("••••• ₺", .yesil) }
    return ((k < 0 ? "−" : "") + tl(k), k < 0 ? .kirmizi : .yesil)
}

func gunEtiket(_ fark: Int, _ g: String) -> String {
    switch fark {
    case ..<0: return "Gecikti"
    case 0: return "Bugün"
    case 1: return "Yarın"
    default:
        let p = g.prefix(10).split(separator: "-")
        return p.count == 3 ? "\(p[2]).\(p[1])" : g
    }
}

struct Kutu<Icerik: View>: View {
    var dolgu: Color = .kutu
    var kenar: Color = .cizgi
    @ViewBuilder var icerik: () -> Icerik

    var body: some View {
        icerik()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 3)
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(dolgu))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(kenar, lineWidth: 1))
            .contentShape(Rectangle())
    }
}

/// Sayı + etiket kutusu
struct Sayi: View {
    let deger: String
    let etiket: String
    let renk: Color
    var uyari = false
    var boyut: CGFloat = 20

    var body: some View {
        Kutu(dolgu: uyari ? Color.kirmizi.opacity(0.12) : .kutu, kenar: uyari ? .kirmizi : .cizgi) {
            VStack(spacing: 1) {
                Text(deger)
                    .font(.system(size: boyut, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(renk)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                Text(etiket)
                    .font(.system(size: 9.5))
                    .foregroundColor(.metin2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
    }
}

/// Simge + yazı kutusu (Arama ekle, Randevu ekle, Geri al, Göster)
struct Eylem: View {
    let simge: String
    let yazi: String
    var renk: Color? = nil
    var uyari = false

    var body: some View {
        Kutu(dolgu: uyari ? Color.kirmizi.opacity(0.14) : (renk?.opacity(0.16) ?? .kutu),
             kenar: uyari ? .kirmizi : (renk ?? .cizgi)) {
            VStack(spacing: 2) {
                Text(simge).font(.system(size: 16))
                Text(yazi)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.metin)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
    }
}

struct GTSatir: View {
    let o: Ozet

    var body: some View {
        let dg = degisim(o)
        HStack(spacing: 7) {
            Text("₲")
                .font(.system(size: 11, weight: .black))
                .foregroundColor(.black)
                .frame(width: 18, height: 18)
                .background(Circle().fill(LinearGradient(colors: [.altin, Color(red: 0.78, green: 0.56, blue: 0.1)], startPoint: .topLeading, endPoint: .bottomTrailing)))
            Text("1 GTC = ").font(.system(size: 11)).foregroundColor(.metin2)
                + Text("\(fiyat2(o.gtFiyat)) ₺").font(.system(size: 11, weight: .bold)).foregroundColor(.altin)
            Spacer(minLength: 4)
            Text(dg.0).font(.system(size: 11, weight: .bold)).monospacedDigit().foregroundColor(dg.1)
            Text("24s").font(.system(size: 9)).foregroundColor(.metin3)
        }
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, minHeight: 28)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.kutu))
    }
}

struct Baslik: View {
    let e: Giris

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("⚡ Gün Teknik").font(.system(size: 13, weight: .bold)).foregroundColor(.metin)
            Spacer()
            Text(e.date.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "tr_TR"))))
                .font(.system(size: 10.5))
                .foregroundColor(.metin3)
        }
    }
}

struct GirisYok: View {
    var body: some View {
        VStack(spacing: 6) {
            Text("⚡").font(.system(size: 22))
            Text("Gün Teknik'i açıp ERP'ye giriş yap")
                .font(.system(size: 11))
                .foregroundColor(.metin2)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Izgara parçaları (Android widget sırası)

struct AramaEkle: View {
    var body: some View { Link(destination: baglanti("./?arama=bugun")) { Eylem(simge: "📞", yazi: "Arama ekle", renk: .hardal) } }
}

struct RandevuEkle: View {
    var body: some View { Link(destination: baglanti("./?randevu=yeni")) { Eylem(simge: "📅", yazi: "Randevu ekle", renk: .yesil) } }
}

struct AramaBugun: View {
    let o: Ozet
    var body: some View { Link(destination: baglanti("./?sayfa=reklam")) { Sayi(deger: sy(o.arama), etiket: "Arama · bugün", renk: .cyanR) } }
}

struct GeriAlDugme: View {
    let e: Giris
    var body: some View {
        Button(intent: GeriAl()) {
            Eylem(simge: "↶", yazi: e.geriOnay ? "Emin misin?" : "Geri al", uyari: e.geriOnay)
        }
        .buttonStyle(.plain)
    }
}

struct AjandaKutu: View {
    let deger: Int?
    let etiket: String
    var body: some View { Link(destination: baglanti("./?sayfa=takvim")) { Sayi(deger: sy(deger), etiket: etiket, renk: .amber) } }
}

struct EvrakBugun: View {
    let o: Ozet
    var body: some View {
        let gec = o.gec ?? 0
        let deger = o.ev1.map { $0 + gec }
        Link(destination: baglanti("./?sayfa=evrak")) {
            Sayi(deger: sy(deger), etiket: gec > 0 ? "Evrak · \(gec) gecikmiş" : "Evrak · bugün", renk: gec > 0 ? .kirmizi : .mg, uyari: gec > 0)
        }
    }
}

struct EvrakKutu: View {
    let deger: Int?
    let etiket: String
    var body: some View { Link(destination: baglanti("./?sayfa=evrak")) { Sayi(deger: sy(deger), etiket: etiket, renk: .mg) } }
}

struct KasaKutu: View {
    let e: Giris
    var body: some View {
        let km = kasaMetni(e)
        Link(destination: baglanti("./")) {
            Kutu {
                HStack(spacing: 8) {
                    Text("💰 Kasa").font(.system(size: 10.5)).foregroundColor(.metin2)
                    Text(km.0)
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(km.1)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                }
            }
        }
    }
}

struct KasaGoster: View {
    let e: Giris
    var body: some View {
        Button(intent: KasaDegistir()) {
            Eylem(simge: e.kasaAcik ? "🙈" : "👁", yazi: e.kasaAcik ? "Gizle" : "Göster")
        }
        .buttonStyle(.plain)
    }
}

/// Büyük araç: Android'deki 4×3 düzen
struct Izgara: View {
    let e: Giris
    var body: some View {
        let o = e.o
        VStack(spacing: 6) {
            HStack(spacing: 6) { AramaEkle(); AramaBugun(o: o); GeriAlDugme(e: e) }
            HStack(spacing: 6) { RandevuEkle(); AjandaKutu(deger: o.aj1, etiket: "Ajanda · bugün"); AjandaKutu(deger: o.aj10, etiket: "Ajanda · 10 gün") }
            HStack(spacing: 6) { EvrakBugun(o: o); EvrakKutu(deger: o.ev5, etiket: "Evrak · 5 gün"); EvrakKutu(deger: o.ev15, etiket: "Evrak · 15 gün") }
            GeometryReader { g in
                HStack(spacing: 6) {
                    KasaKutu(e: e).frame(width: (g.size.width - 12) / 3 * 2 + 6)
                    KasaGoster(e: e)
                }
            }
        }
    }
}

// MARK: - Boyutlara göre görünümler

struct Kucuk: View {
    let e: Giris
    var body: some View {
        let o = e.o
        let gec = o.gec ?? 0
        VStack(alignment: .leading, spacing: 5) {
            Text("⚡ Gün Teknik").font(.system(size: 12, weight: .bold)).foregroundColor(.metin)
            if !o.giris {
                GirisYok()
            } else {
                Spacer(minLength: 0)
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text(sy(o.arama))
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.cyanR)
                    Text("arama\nbugün").font(.system(size: 10)).foregroundColor(.metin2).lineSpacing(-2)
                }
                satir("📅", "\(sy(o.aj1)) bugün · \(sy(o.aj10)) on gün", .amber)
                satir("📄", gec > 0 ? "\(gec) gecikmiş · \(sy(o.ev5)) yakın" : "\(sy(o.ev1)) bugün · \(sy(o.ev5)) beş gün", gec > 0 ? .kirmizi : .mg)
                if o.gtFiyat > 0 {
                    let dg = degisim(o)
                    HStack(spacing: 4) {
                        Text("₲ \(fiyat2(o.gtFiyat))").font(.system(size: 10.5, weight: .bold)).foregroundColor(.altin)
                        Text(dg.0).font(.system(size: 10)).foregroundColor(dg.1)
                    }
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(13)
        .widgetURL(baglanti("./"))
    }

    func satir(_ simge: String, _ yazi: String, _ renk: Color) -> some View {
        HStack(spacing: 5) {
            Text(simge).font(.system(size: 10))
            Text(yazi).font(.system(size: 11, weight: .semibold)).foregroundColor(renk).lineLimit(1).minimumScaleFactor(0.7)
        }
    }
}

struct Orta: View {
    let e: Giris
    var body: some View {
        let o = e.o
        Group {
            if !o.giris {
                GirisYok()
            } else {
                VStack(spacing: 6) {
                    HStack(spacing: 6) {
                        AramaEkle()
                        AramaBugun(o: o)
                        AjandaKutu(deger: o.aj1, etiket: "Ajanda · bugün")
                        EvrakBugun(o: o)
                    }
                    HStack(spacing: 6) {
                        RandevuEkle()
                        AjandaKutu(deger: o.aj10, etiket: "Ajanda · 10 gün")
                        EvrakKutu(deger: o.ev5, etiket: "Evrak · 5 gün")
                        Button(intent: KasaDegistir()) {
                            let km = kasaMetni(e)
                            Sayi(deger: km.0, etiket: e.kasaAcik ? "Kasa · gizle" : "Kasa · göster", renk: km.1, boyut: 15)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(10)
    }
}

struct Buyuk: View {
    let e: Giris
    var body: some View {
        VStack(spacing: 7) {
            Baslik(e: e)
            if !e.o.giris {
                GirisYok()
            } else {
                Izgara(e: e)
                if e.o.gtFiyat > 0 { Link(destination: baglanti("./?sayfa=bet")) { GTSatir(o: e.o) } }
            }
        }
        .padding(11)
    }
}

struct CokBuyuk: View {
    let e: Giris
    var body: some View {
        VStack(spacing: 7) {
            Baslik(e: e)
            if !e.o.giris {
                GirisYok()
            } else {
                HStack(spacing: 10) {
                    VStack(spacing: 7) {
                        Izgara(e: e)
                        if e.o.gtFiyat > 0 { Link(destination: baglanti("./?sayfa=bet")) { GTSatir(o: e.o) } }
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Liste(baslik: "📅 Ajanda · 10 gün", yol: "./?sayfa=takvim", bos: "Yaklaşan randevu yok", bosMu: e.o.ajanda.isEmpty) {
                            ForEach(Array(e.o.ajanda.prefix(6)), id: \.self) { a in
                                SatirG(sol: gunEtiket(a.fark, a.g) + (a.saat.isEmpty ? "" : " " + a.saat),
                                       orta: a.baslik + (a.kisi.isEmpty ? "" : " · " + a.kisi),
                                       sag: "", solRenk: a.fark == 0 ? .amber : .metin2)
                            }
                        }
                        Liste(baslik: "📄 Evrak · 15 gün", yol: "./?sayfa=evrak", bos: "Yaklaşan ödeme yok", bosMu: e.o.evrak.isEmpty) {
                            ForEach(Array(e.o.evrak.prefix(6)), id: \.self) { x in
                                SatirG(sol: gunEtiket(x.fark, x.g), orta: x.ad, sag: x.tutar > 0 ? tl(x.tutar) : "",
                                       solRenk: x.fark < 0 ? .kirmizi : (x.fark == 0 ? .mg : .metin2))
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }
        }
        .padding(11)
    }
}

struct Liste<Satirlar: View>: View {
    let baslik: String
    let yol: String
    let bos: String
    let bosMu: Bool
    @ViewBuilder var satirlar: () -> Satirlar

    var body: some View {
        Link(destination: baglanti(yol)) {
            VStack(alignment: .leading, spacing: 4) {
                Text(baslik).font(.system(size: 11.5, weight: .bold)).foregroundColor(.metin)
                if bosMu {
                    Text(bos).font(.system(size: 10.5)).foregroundColor(.metin3)
                } else {
                    satirlar()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(9)
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.kutu))
        }
    }
}

struct SatirG: View {
    let sol: String
    let orta: String
    let sag: String
    var solRenk: Color = .metin2

    var body: some View {
        HStack(spacing: 6) {
            Text(sol).font(.system(size: 10, weight: .semibold)).monospacedDigit().foregroundColor(solRenk).frame(width: 74, alignment: .leading)
            Text(orta).font(.system(size: 10.5)).foregroundColor(.metin).lineLimit(1)
            Spacer(minLength: 2)
            if !sag.isEmpty { Text(sag).font(.system(size: 10, weight: .semibold)).monospacedDigit().foregroundColor(.metin2) }
        }
    }
}

struct PanoGorunum: View {
    @Environment(\.widgetFamily) var aile
    let e: Giris

    var body: some View {
        Group {
            switch aile {
            case .systemSmall: Kucuk(e: e)
            case .systemMedium: Orta(e: e)
            case .systemExtraLarge: CokBuyuk(e: e)
            default: Buyuk(e: e)
            }
        }
        .environment(\.colorScheme, .dark)
        .containerBackground(for: .widget) { Color.zemin }
    }
}

struct GTCGorunum: View {
    let e: Giris

    var body: some View {
        let o = e.o
        let dg = degisim(o)
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                Text("₲")
                    .font(.system(size: 12, weight: .black))
                    .foregroundColor(.black)
                    .frame(width: 20, height: 20)
                    .background(Circle().fill(LinearGradient(colors: [.altin, Color(red: 0.78, green: 0.56, blue: 0.1)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                Text("GTCOIN").font(.system(size: 12, weight: .bold)).foregroundColor(.metin)
            }
            Spacer(minLength: 0)
            Text("1 GTC").font(.system(size: 10.5)).foregroundColor(.metin2)
            Text(o.gtFiyat > 0 ? "\(fiyat2(o.gtFiyat)) ₺" : "—")
                .font(.system(size: 25, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundColor(.altin)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            HStack(spacing: 4) {
                Text(dg.0).font(.system(size: 12, weight: .bold)).monospacedDigit().foregroundColor(dg.1)
                Text("24 saat").font(.system(size: 9.5)).foregroundColor(.metin3)
            }
            Spacer(minLength: 0)
            Text(o.zaman == .distantPast ? "" : "↻ " + o.zaman.formatted(date: .omitted, time: .shortened))
                .font(.system(size: 9)).foregroundColor(.metin3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(13)
        .widgetURL(baglanti("./?sayfa=bet"))
        .environment(\.colorScheme, .dark)
        .containerBackground(for: .widget) { Color.zemin }
    }
}

// MARK: - Araçlar

struct PanoWidget: Widget {
    let kind = "GunTeknikPano"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Saglayici()) { e in PanoGorunum(e: e) }
            .configurationDisplayName("Gün Teknik")
            .description("Arama, randevu, ajanda, evrak ve kasa — telefondaki widget'ın aynısı.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
            .contentMarginsDisabled()
    }
}

struct GTCWidget: Widget {
    let kind = "GunTeknikGTC"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Saglayici()) { e in GTCGorunum(e: e) }
            .configurationDisplayName("GTCOIN")
            .description("1 GTC fiyatı ve 24 saatlik değişim.")
            .supportedFamilies([.systemSmall])
            .contentMarginsDisabled()
    }
}

@main
struct GunTeknikAraclari: WidgetBundle {
    var body: some Widget {
        PanoWidget()
        GTCWidget()
    }
}
