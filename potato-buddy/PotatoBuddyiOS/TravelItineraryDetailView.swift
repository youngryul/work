import SwiftUI

struct TravelItineraryDetailView: View {
    let trip: AbroadTrip

    @State private var selectedDate: String = ""
    @State private var dateKeys: [String] = []
    @State private var items: [AbroadItineraryItem] = []
    @State private var expandedId: String?
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showItemForm = false
    @State private var editingItem: AbroadItineraryItem?
    @State private var localTimeLabel = ""
    @State private var localDateLabel = ""

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 0) {
            header
            dayPicker
            content
        }
        .navigationTitle(trip.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    editingItem = nil
                    showItemForm = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundColor(.cyan)
                }
            }
        }
        .sheet(isPresented: $showItemForm) {
            TravelItineraryItemFormView(
                trip: trip,
                selectedDate: selectedDate.isEmpty ? dateKeys.first ?? "" : selectedDate,
                editingItem: editingItem
            ) {
                showItemForm = false
                editingItem = nil
                Task { await loadItems() }
            }
        }
        .alert("오류", isPresented: Binding(
            get: { !errorMessage.isEmpty },
            set: { _ in errorMessage = "" }
        )) {
            Button("확인") { errorMessage = "" }
        } message: {
            Text(errorMessage)
        }
        .onAppear {
            dateKeys = TravelItineraryTime.dateKeys(from: trip.departureAt, to: trip.returnAt)
            selectedDate = dateKeys.first ?? ""
            updateLocalClock()
            Task { await loadItems() }
        }
        .onChange(of: selectedDate) { _, _ in
            expandedId = nil
            Task { await loadItems() }
        }
        .onReceive(timer) { _ in
            updateLocalClock()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(trip.countryName) · \(trip.timeZoneIdentifier)")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.cyan)
                    Text(TravelItineraryTime.formatDateTime(trip.departureAt))
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("~ \(TravelItineraryTime.formatDateTime(trip.returnAt))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(localDateLabel)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(localTimeLabel)
                        .font(.title2)
                        .fontWeight(.bold)
                        .monospacedDigit()
                        .foregroundColor(.cyan)
                }
            }
        }
        .padding()
        .background(
            LinearGradient(colors: [Color.cyan.opacity(0.12), Color.indigo.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing)
        )
    }

    private var dayPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(dateKeys.enumerated()), id: \.element) { index, key in
                    let selected = key == selectedDate
                    Button {
                        selectedDate = key
                    } label: {
                        VStack(spacing: 2) {
                            Text("Day \(index + 1)")
                                .font(.caption)
                                .fontWeight(.semibold)
                            Text(shortDate(key))
                                .font(.caption2)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(selected ? Color.cyan : Color(.secondarySystemGroupedBackground))
                        .foregroundColor(selected ? .white : .primary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView("불러오는 중...")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if items.isEmpty {
            VStack(spacing: 12) {
                Text("이 날짜에 등록된 일정이 없습니다")
                    .foregroundColor(.secondary)
                Button("첫 일정 추가") {
                    editingItem = nil
                    showItemForm = true
                }
                .buttonStyle(.borderedProminent)
                .tint(.cyan)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            List {
                Section("SCHEDULE") {
                    ForEach(items) { item in
                        scheduleRow(item)
                    }
                }
            }
            .listStyle(.insetGrouped)
        }
    }

    private func scheduleRow(_ item: AbroadItineraryItem) -> some View {
        let expanded = expandedId == item.id
        return VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation {
                    expandedId = expanded ? nil : item.id
                }
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    Text(item.startLabel)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .monospacedDigit()
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .overlay(
                            Capsule().stroke(Color.gray.opacity(0.4), lineWidth: 1)
                        )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title)
                            .font(.body)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)
                        Text("\(item.startLabel) – \(item.endLabel)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .buttonStyle(.plain)

            if expanded {
                VStack(alignment: .leading, spacing: 8) {
                    Text("MEMO")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.orange)
                    Text((item.memo?.isEmpty == false) ? item.memo! : "등록된 상세 메모가 없습니다.")
                        .font(.subheadline)
                        .foregroundColor(item.memo?.isEmpty == false ? .primary : .secondary)
                    Button("수정하기") {
                        editingItem = item
                        showItemForm = true
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.cyan)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.orange.opacity(0.2), lineWidth: 1)
                )
            }
        }
        .padding(.vertical, 4)
    }

    private func loadItems() async {
        guard !selectedDate.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await SupabaseService.shared.fetchAbroadItineraryItems(
                tripId: trip.id,
                itemDate: selectedDate
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func updateLocalClock() {
        let tz = TimeZone(identifier: trip.timeZoneIdentifier) ?? .gmt
        var calendar = Calendar.current
        calendar.timeZone = tz
        let now = Date()

        let dateFormatter = DateFormatter()
        dateFormatter.locale = Locale(identifier: "ko_KR")
        dateFormatter.timeZone = tz
        dateFormatter.dateFormat = "M월 d일 (E)"
        localDateLabel = dateFormatter.string(from: now)

        let timeFormatter = DateFormatter()
        timeFormatter.locale = Locale(identifier: "ko_KR")
        timeFormatter.timeZone = tz
        timeFormatter.dateFormat = "HH:mm"
        localTimeLabel = timeFormatter.string(from: now)
    }

    private func shortDate(_ key: String) -> String {
        let parts = key.split(separator: "-")
        guard parts.count == 3 else { return key }
        return "\(Int(parts[1]) ?? 0)/\(Int(parts[2]) ?? 0)"
    }
}
