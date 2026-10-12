import SwiftUI

/// 디데이 관리 화면 (더보기 > 디데이)
/// - 여기서 달력으로 날짜를 골라 만든 디데이를 위젯 편집 화면에서 선택해 표시한다.
struct DDayManagerView: View {
    @State private var events: [DDayEvent] = []
    @State private var editingEvent: DDayEvent?

    var body: some View {
        // 더보기 상단 커스텀 바(safeAreaInset)와 내비게이션 바 툴바가 겹쳐 + 버튼이 가려지므로
        // NavigationStack/툴바 대신 목록 상단 헤더에 제목과 추가 버튼을 둔다.
        List {
            Section {
                HStack(spacing: 8) {
                    Text("디데이")
                        .font(.title2.bold())
                    Spacer()
                    Button {
                        editingEvent = DDayEvent(title: "", date: Date())
                    } label: {
                        Label("추가", systemImage: "plus.circle.fill")
                            .font(.headline)
                    }
                    .buttonStyle(.borderless)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
            }

            if events.isEmpty {
                Section {
                    VStack(spacing: 8) {
                        Text("아직 디데이가 없어요")
                            .font(.headline)
                        Text("추가 버튼으로 디데이를 추가해보세요")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                }
            } else {
                Section {
                    ForEach(events) { event in
                        Button {
                            editingEvent = event
                        } label: {
                            DDayRow(event: event)
                        }
                        .buttonStyle(.plain)
                    }
                    .onDelete(perform: deleteEvents)
                }
            }

            Section {
                Text("홈 화면이나 잠금화면에 '디데이' 위젯을 추가한 뒤, 위젯을 길게 눌러 '위젯 편집'에서 표시할 디데이를 고르세요.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .sheet(item: $editingEvent) { event in
            DDayEditSheet(
                event: event,
                isNew: !events.contains { $0.id == event.id },
                onSave: { saved in
                    DDayStore.upsert(saved)
                    reload()
                },
                onDelete: { deleted in
                    DDayStore.delete(id: deleted.id)
                    reload()
                }
            )
        }
        .onAppear(perform: reload)
    }

    private func reload() {
        events = DDayStore.loadAll().sorted { $0.dateString < $1.dateString }
    }

    private func deleteEvents(at offsets: IndexSet) {
        for index in offsets {
            DDayStore.delete(id: events[index].id)
        }
        reload()
    }
}

/// 디데이 목록 한 줄
private struct DDayRow: View {
    let event: DDayEvent

    var body: some View {
        let info = DDayInfo(event: event, from: Date())
        HStack(spacing: 12) {
            Circle()
                .fill(event.accentColor)
                .frame(width: 10, height: 10)
            VStack(alignment: .leading, spacing: 2) {
                Text(event.displayTitle)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(info.dateText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(info.label)
                .font(.system(.title3, design: .rounded).weight(.heavy))
                .foregroundStyle(event.accentColor)
        }
        .contentShape(Rectangle())
    }
}

/// 디데이 추가/수정 시트 (달력으로 날짜 선택)
private struct DDayEditSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var draft: DDayEvent
    let isNew: Bool
    let onSave: (DDayEvent) -> Void
    let onDelete: (DDayEvent) -> Void

    init(event: DDayEvent, isNew: Bool, onSave: @escaping (DDayEvent) -> Void, onDelete: @escaping (DDayEvent) -> Void) {
        _draft = State(initialValue: event)
        self.isNew = isNew
        self.onSave = onSave
        self.onDelete = onDelete
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("이름") {
                    TextField("예: 여행 가는 날", text: $draft.title)
                }

                Section {
                    DatePicker("날짜", selection: $draft.date, displayedComponents: .date)
                        .datePickerStyle(.graphical)
                        .environment(\.locale, Locale(identifier: "ko_KR"))
                    Text(DDayInfo(event: draft, from: Date()).caption)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(draft.accentColor)
                } header: {
                    Text("날짜")
                }

                Section {
                    Toggle("시작일을 1일로 세기", isOn: $draft.countStartAsDayOne)
                } footer: {
                    Text("기념일처럼 지정한 날을 1일째로 셉니다. (예: 사귄 날 = D+1)")
                }

                Section("색상") {
                    Picker("색상", selection: $draft.accent) {
                        ForEach(DDayAccent.allCases) { accent in
                            Text(accent.label).tag(accent.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if !isNew {
                    Section {
                        Button("디데이 삭제", role: .destructive) {
                            onDelete(draft)
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(isNew ? "디데이 추가" : "디데이 수정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") {
                        onSave(draft)
                        dismiss()
                    }
                }
            }
        }
    }
}
