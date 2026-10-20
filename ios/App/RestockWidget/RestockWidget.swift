import WidgetKit
import SwiftUI

// MARK: - Snapshot written by the app (WidgetBridgePlugin)
struct Snap: Codable {
    struct Need: Codable { let n: String; let next: String? }
    struct Soon: Codable { let n: String; let next: String; let lead: Int }
    var need: [Need] = []
    var soon: [Soon] = []
    var dark: Bool? = nil
    static func load() -> Snap? {
        guard let s = UserDefaults(suiteName: "group.com.pocketappstudio.restock")?.string(forKey: "snapshot"),
              let d = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(Snap.self, from: d)
    }
    static let sample = Snap(need: [.init(n: "Milk", next: nil), .init(n: "Eggs", next: nil), .init(n: "Bananas", next: nil), .init(n: "Coffee", next: nil)],
                             soon: [.init(n: "Bread", next: Day.ymd(Day.add(Date(), 3)), lead: 1), .init(n: "Yogurt", next: Day.ymd(Day.add(Date(), 5)), lead: 2),
                                    .init(n: "Paper towels", next: Day.ymd(Day.add(Date(), 9)), lead: 3)])
}

enum Day {
    static let cal = Calendar.current
    static func start(_ d: Date) -> Date { cal.startOfDay(for: d) }
    static func add(_ d: Date, _ n: Int) -> Date { cal.date(byAdding: .day, value: n, to: start(d))! }
    static func ymd(_ d: Date) -> String { let c = cal.dateComponents([.year, .month, .day], from: d); return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!) }
    static func parse(_ s: String) -> Date? {
        let p = s.split(separator: "-").compactMap { Int($0) }; guard p.count == 3 else { return nil }
        return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
    }
    static func between(_ a: Date, _ b: Date) -> Int { cal.dateComponents([.day], from: start(a), to: start(b)).day ?? 0 }
}

// What the glance shows on a given day: items that have crossed their lead window move into "need".
struct Glance {
    struct Row: Hashable { let name: String; let days: Int? }
    let date: Date
    let need: [Row]
    let soon: [Row]
    init(_ s: Snap, on day: Date) {
        date = day
        var need = s.need.map { n in Row(name: n.n, days: n.next.flatMap(Day.parse).map { Day.between(day, $0) }) }
        var soon: [Row] = []
        for x in s.soon {
            guard let next = Day.parse(x.next) else { continue }
            let d = Day.between(day, next)
            if d <= x.lead { need.insert(Row(name: x.n, days: d), at: 0) } else { soon.append(Row(name: x.n, days: d)) }
        }
        self.need = need
        self.soon = soon.sorted { ($0.days ?? 0) < ($1.days ?? 0) }
    }
}

struct Entry: TimelineEntry { let date: Date; let g: Glance; let empty: Bool }

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), g: Glance(.sample, on: Date()), empty: false) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        let s = Snap.load(); let use = (context.isPreview || s == nil) ? Snap.sample : s!
        completion(Entry(date: Date(), g: Glance(use, on: Date()), empty: false))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let s = Snap.load()
        let now = Date()
        // One entry now, then one at each midnight for two weeks so "due in N days" stays right while the app is closed.
        var entries = [Entry(date: now, g: Glance(s ?? Snap(), on: now), empty: s == nil)]
        for i in 1...14 { let d = Day.add(now, i); entries.append(Entry(date: d, g: Glance(s ?? Snap(), on: d), empty: s == nil)) }
        completion(Timeline(entries: entries, policy: .after(Day.add(now, 14))))
    }
}

// MARK: - Palette (matches app; AAA contrast on both themes)
struct Pal {
    let bg, surface, text, muted, accent, onAccent: Color
    static func of(_ s: ColorScheme) -> Pal {
        s == .dark
        ? Pal(bg: Color(hex: 0x11140F), surface: Color(hex: 0x1B201A), text: Color(hex: 0xF5F2E9), muted: Color(hex: 0xCFCABB), accent: Color(hex: 0x8EE6AE), onAccent: Color(hex: 0x07150C))
        : Pal(bg: Color(hex: 0xFAF7F0), surface: Color(hex: 0xFFFFFF), text: Color(hex: 0x17140F), muted: Color(hex: 0x4B4437), accent: Color(hex: 0x0A5B38), onAccent: Color(hex: 0xFFFFFF))
    }
}
extension Color { init(hex: UInt32) { self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255) } }

func dayWord(_ d: Int) -> String { d <= 0 ? "today" : d == 1 ? "1 day" : "\(d) days" }
let monthFmt: DateFormatter = { let f = DateFormatter(); f.setLocalizedDateFormatFromTemplate("MMM"); return f }()
let weekdayFmt: DateFormatter = { let f = DateFormatter(); f.setLocalizedDateFormatFromTemplate("EEEE"); return f }()

// MARK: - Views
struct DateTile: View {
    let date: Date; let p: Pal; var big: CGFloat = 40
    var body: some View {
        VStack(spacing: 0) {
            Text(monthFmt.string(from: date).uppercased()).font(.system(size: 13, weight: .heavy)).tracking(1)
                .foregroundStyle(p.onAccent).frame(maxWidth: .infinity).padding(.vertical, 3).background(p.accent)
            Text("\(Calendar.current.component(.day, from: date))").font(.system(size: big, weight: .bold, design: .rounded))
                .foregroundStyle(p.text).minimumScaleFactor(0.6).lineLimit(1)
        }
        .background(p.surface).clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

struct CountBlock: View {
    let n: Int; let p: Pal; var size: CGFloat = 54
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("TO BUY").font(.system(size: 13, weight: .heavy)).tracking(1).foregroundStyle(p.muted)
            Text("\(n)").font(.system(size: size, weight: .bold, design: .rounded)).foregroundStyle(n > 0 ? p.accent : p.text)
                .minimumScaleFactor(0.5).lineLimit(1).contentTransition(.numericText())
            Text(n == 0 ? "all stocked" : n == 1 ? "item" : "items").font(.system(size: 15, weight: .semibold)).foregroundStyle(p.muted)
        }
        .accessibilityElement(children: .combine)
    }
}

struct NeedRow: View {
    let r: Glance.Row; let p: Pal
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "circle").font(.system(size: 13, weight: .bold)).foregroundStyle(p.text)
            Text(r.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(p.text).lineLimit(1)
            Spacer(minLength: 2)
            if let d = r.days { Text(d <= 0 ? "today" : dayWord(d)).font(.system(size: 13, weight: .bold)).foregroundStyle(p.muted) }
        }
    }
}

struct SoonRow: View {
    let r: Glance.Row; let p: Pal
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "arrow.clockwise").font(.system(size: 12, weight: .bold)).foregroundStyle(p.muted)
            Text(r.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(p.text).lineLimit(1)
            Spacer(minLength: 2)
            Text(dayWord(r.days ?? 0)).font(.system(size: 15, weight: .heavy, design: .rounded)).foregroundStyle(p.text)
        }
    }
}

struct Header: View {
    let t: String; let p: Pal
    var body: some View { Text(t.uppercased()).font(.system(size: 12, weight: .heavy)).tracking(1).foregroundStyle(p.muted) }
}

struct GlanceView: View {
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var scheme
    let e: Entry
    var body: some View {
        let p = Pal.of(scheme), g = e.g
        Group {
            switch family {
            case .accessoryCircular:
                ZStack { AccessoryWidgetBackground()
                    VStack(spacing: -2) { Image(systemName: "cart").font(.system(size: 11, weight: .bold)); Text("\(g.need.count)").font(.system(size: 24, weight: .bold, design: .rounded)) } }
                .accessibilityLabel("\(g.need.count) to buy")
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(g.need.count) to buy").font(.headline)
                    if let s = g.soon.first { Text("\(s.name) · \(dayWord(s.days ?? 0))").font(.body).lineLimit(1) }
                    else if let n = g.need.first { Text(n.name).font(.body).lineLimit(1) }
                }.frame(maxWidth: .infinity, alignment: .leading)
            case .accessoryInline:
                Text("\(g.need.count) to buy")
            case .systemSmall:
                VStack(alignment: .leading, spacing: 6) {
                    DateTile(date: g.date, p: p, big: 24).frame(width: 56)
                    CountBlock(n: g.need.count, p: p, size: 40)
                }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            case .systemMedium:
                HStack(alignment: .top, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) { DateTile(date: g.date, p: p, big: 28).frame(width: 60); CountBlock(n: g.need.count, p: p, size: 40) }
                        .frame(width: 92, alignment: .leading)
                    VStack(alignment: .leading, spacing: 4) {
                        Header(t: "Need now", p: p)
                        if g.need.isEmpty { Text("Nothing needed").font(.system(size: 16, weight: .semibold)).foregroundStyle(p.text) }
                        ForEach(g.need.prefix(3), id: \.self) { NeedRow(r: $0, p: p) }
                        Spacer(minLength: 0)
                        if let s = g.soon.first { Header(t: "Coming due", p: p); SoonRow(r: s, p: p) }
                    }
                }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            default:
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top, spacing: 14) {
                        DateTile(date: g.date, p: p, big: 34).frame(width: 70)
                        CountBlock(n: g.need.count, p: p, size: 50)
                        Spacer()
                        Text(weekdayFmt.string(from: g.date)).font(.system(size: 16, weight: .bold)).foregroundStyle(p.muted)
                    }
                    Header(t: "Need now", p: p)
                    if g.need.isEmpty { Text("Nothing needed").font(.system(size: 16, weight: .semibold)).foregroundStyle(p.text) }
                    ForEach(g.need.prefix(g.soon.isEmpty ? 8 : 5), id: \.self) { NeedRow(r: $0, p: p) }
                    if !g.soon.isEmpty {
                        Header(t: "Coming due", p: p).padding(.top, 2)
                        ForEach(g.soon.prefix(g.need.count > 4 ? 2 : 4), id: \.self) { SoonRow(r: $0, p: p) }
                    }
                    Spacer(minLength: 0)
                }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .widgetURL(URL(string: "restock://home"))
        .containerBackground(for: .widget) { Pal.of(scheme).bg }
    }
}

@main
struct RestockWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "RestockGlance", provider: Provider()) { GlanceView(e: $0) }
            .configurationDisplayName("Restock")
            .description("")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
