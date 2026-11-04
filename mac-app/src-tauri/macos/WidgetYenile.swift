// Uygulama yeni veri yazınca masaüstü araçlarına "yenile" der (WidgetKit yalnız Swift'ten çağrılabiliyor).
import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

@_cdecl("gt_widget_yenile")
public func gtWidgetYenile() {
    #if canImport(WidgetKit)
    if #available(macOS 11.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
    }
    #endif
}
