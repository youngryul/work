import AppIntents
import WidgetKit

struct CompleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "할일 완료"
    static var description = IntentDescription("오늘 할일을 완료로 표시합니다.")

    @Parameter(title: "Task ID")
    var taskId: String

    init() {}
    init(taskId: String) { self.taskId = taskId }

    func perform() async throws -> some IntentResult {
        try await SupabaseService.shared.completeTask(id: taskId)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}