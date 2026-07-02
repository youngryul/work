import SwiftUI

struct HabitTrackerFormView: View {
    let year: Int
    let month: Int
    let onSave: () async -> Void
    let onCancel: () -> Void

    @State private var title = ""
    @State private var selectedColor = HabitTrackerColorOption.pink
    @State private var isSaving = false
    @State private var errorMessage = ""

    var body: some View {
        NavigationView {
            Form {
                Section("습관") {
                    TextField("예: 운동 매일 가기", text: $title)
                }

                Section("색상") {
                    LazyVGrid(
                        columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4),
                        spacing: 12
                    ) {
                        ForEach(HabitTrackerColorOption.allCases) { option in
                            Button {
                                selectedColor = option
                            } label: {
                                Circle()
                                    .fill(option.color)
                                    .frame(width: 36, height: 36)
                                    .overlay(
                                        Circle()
                                            .stroke(
                                                selectedColor == option ? Color.primary : Color.clear,
                                                lineWidth: 2
                                            )
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section {
                    Text("\(year)년 \(month)월 트래커로 추가됩니다.")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("습관 추가")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") {
                        Task { await save() }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
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
        }
    }

    private func save() async {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else { return }

        isSaving = true
        errorMessage = ""

        do {
            _ = try await SupabaseService.shared.createHabitTracker(
                year: year,
                month: month,
                title: trimmedTitle,
                color: selectedColor.rawValue
            )
            await onSave()
        } catch {
            errorMessage = error.localizedDescription
        }

        isSaving = false
    }
}
