import SwiftUI

/// 시간표 화면과 같은 키 — 학기 선택을 두 화면이 공유한다 (웹과 동일)
private let graduateNotesSemesterKey = "graduate-timetable-semester"

/// 웹 GraduateNotesView와 대응 — 학기/과목 선택 후 예습·강의·복습 기록을 관리
struct GraduateNotesView: View {
    @State private var selectedSemesterId: String = {
        let saved = UserDefaults.standard.string(forKey: graduateNotesSemesterKey) ?? ""
        return graduateSemesters.contains(where: { $0.id == saved }) ? saved : graduateSemesters.first?.id ?? ""
    }()
    @State private var selectedSubject: String?
    @State private var notes: [GraduateNoteItem] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var openNote: GraduateNoteItem?
    @State private var creatingCategory: GraduateNoteCategory?
    @State private var noteToDelete: GraduateNoteItem?

    private var semester: GraduateSemester? {
        graduateSemesters.first { $0.id == selectedSemesterId } ?? graduateSemesters.first
    }

    /// 학기의 과목명 (요일·교시 순서, 중복 제거)
    private var subjects: [String] {
        guard let semester else { return [] }
        var names: [String] = []
        for day in semester.days {
            for period in semester.periods {
                if let name = day.classes[period.id]?.name, !names.contains(name) {
                    names.append(name)
                }
            }
        }
        return names
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 8) {
                    Text("📝")
                        .font(.title2)
                    Text("대학원 기록")
                        .font(.title2.bold())
                }
                .padding(.top, 4)

                semesterPicker
                subjectChips

                if selectedSubject == nil {
                    Text("과목을 선택하세요.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                } else if isLoading && notes.isEmpty {
                    ProgressView("불러오는 중...")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                } else {
                    ForEach(GraduateNoteCategory.allCases) { category in
                        categorySection(category)
                    }
                }
            }
            .padding(16)
        }
        .background(Color(UIColor.systemGroupedBackground).ignoresSafeArea())
        .refreshable { await loadNotes() }
        .onAppear {
            if selectedSubject == nil { selectedSubject = subjects.first }
        }
        .task(id: "\(selectedSemesterId)|\(selectedSubject ?? "")") {
            await loadNotes()
        }
        .sheet(item: $openNote) { note in
            GraduateNoteEditorView(
                note: note,
                onSaved: { applySaved($0) },
                onDeleted: { applyDeleted(id: $0) }
            )
        }
        .confirmationDialog(
            "이 기록을 삭제할까요?",
            isPresented: Binding(
                get: { noteToDelete != nil },
                set: { if !$0 { noteToDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("삭제", role: .destructive) {
                if let target = noteToDelete {
                    Task { await delete(target) }
                }
            }
            Button("취소", role: .cancel) {}
        }
        .alert("오류", isPresented: Binding(
            get: { !errorMessage.isEmpty },
            set: { if !$0 { errorMessage = "" } }
        )) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
    }

    // MARK: - 학기 / 과목 선택

    private var semesterPicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("학기")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            if graduateSemesters.count > 1 {
                Picker("학기", selection: $selectedSemesterId) {
                    ForEach(graduateSemesters) { semester in
                        Text(semester.label).tag(semester.id)
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: selectedSemesterId) { _, newId in
                    UserDefaults.standard.set(newId, forKey: graduateNotesSemesterKey)
                    notes = []
                    selectedSubject = subjects.first
                }
            } else if let semester {
                Text(semester.label)
                    .font(.body.weight(.medium))
            }
        }
    }

    private var subjectChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(subjects, id: \.self) { name in
                    let isSelected = selectedSubject == name
                    Button {
                        if !isSelected {
                            notes = []
                            selectedSubject = name
                        }
                    } label: {
                        Text(name)
                            .font(.subheadline.weight(isSelected ? .semibold : .regular))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .foregroundStyle(isSelected ? Color.white : Color.primary)
                            .background(isSelected ? Color.green : Color(UIColor.systemBackground))
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(Color.green.opacity(isSelected ? 0 : 0.3), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - 카테고리 섹션

    private func categorySection(_ category: GraduateNoteCategory) -> some View {
        let items = notes.filter { $0.category == category.rawValue }

        return VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text("\(category.icon) \(category.label)")
                    .font(.headline)
                Spacer()
                Text("\(items.count)")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.green.opacity(0.15))
                    .foregroundStyle(.green)
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.green.opacity(0.06))

            Divider().overlay(Color.green.opacity(0.2))

            if items.isEmpty {
                Text("기록이 없습니다.")
                    .font(.subheadline)
                    .foregroundStyle(Color(UIColor.tertiaryLabel))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            } else {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, note in
                    if index > 0 {
                        Divider().padding(.leading, 16)
                    }
                    Button {
                        openNote = note
                    } label: {
                        noteRow(note)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button(role: .destructive) {
                            noteToDelete = note
                        } label: {
                            Label("삭제", systemImage: "trash")
                        }
                    }
                }
            }

            Divider().overlay(Color.green.opacity(0.15))

            Button {
                Task { await create(category) }
            } label: {
                Label(
                    creatingCategory == category ? "생성 중..." : "새 기록",
                    systemImage: "plus"
                )
                .font(.subheadline.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
            .tint(.green)
            .disabled(creatingCategory != nil)
        }
        .background(Color(UIColor.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.green.opacity(0.2), lineWidth: 2)
        )
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    private func noteRow(_ note: GraduateNoteItem) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                Text(note.title.isEmpty ? "제목 없음" : note.title)
                    .font(.body)
                    .foregroundStyle(note.title.isEmpty ? Color.secondary : Color.primary)
                    .lineLimit(1)
                Text(note.displayDate)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    // MARK: - 데이터

    @MainActor
    private func loadNotes() async {
        guard let subject = selectedSubject else { return }
        let semesterId = selectedSemesterId
        isLoading = true
        defer { isLoading = false }
        do {
            let fetched = try await SupabaseService.shared.fetchGraduateNotes(
                semesterId: semesterId,
                subjectName: subject
            )
            // 응답이 오는 사이 다른 과목으로 바뀌었으면 버린다
            guard semesterId == selectedSemesterId, subject == selectedSubject else { return }
            notes = fetched
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    @MainActor
    private func create(_ category: GraduateNoteCategory) async {
        guard let subject = selectedSubject, creatingCategory == nil else { return }
        creatingCategory = category
        defer { creatingCategory = nil }
        do {
            let note = try await SupabaseService.shared.createGraduateNote(
                semesterId: selectedSemesterId,
                subjectName: subject,
                category: category.rawValue,
                noteDate: GraduateNoteDate.string(from: Date())
            )
            notes = sorted(notes + [note])
            openNote = note
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    @MainActor
    private func delete(_ note: GraduateNoteItem) async {
        do {
            try await SupabaseService.shared.deleteGraduateNote(id: note.id)
            applyDeleted(id: note.id)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    /// 에디터에서 저장된 제목·날짜를 목록에 반영
    private func applySaved(_ saved: GraduateNoteItem) {
        guard let index = notes.firstIndex(where: { $0.id == saved.id }) else { return }
        notes[index].title = saved.title
        notes[index].noteDate = saved.noteDate
        notes = sorted(notes)
    }

    private func applyDeleted(id: String) {
        notes.removeAll { $0.id == id }
    }

    /// 날짜 최신순, 같은 날짜는 생성 최신순 (서버 정렬과 동일)
    private func sorted(_ items: [GraduateNoteItem]) -> [GraduateNoteItem] {
        items.sorted {
            if $0.noteDate != $1.noteDate { return $0.noteDate > $1.noteDate }
            return ($0.createdAt ?? "") > ($1.createdAt ?? "")
        }
    }
}
