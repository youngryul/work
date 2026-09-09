import SwiftUI
import UIKit

/// `UIActivityViewController`를 SwiftUI `.sheet`에서 쓰기 위한 얇은 래퍼.
struct ActivityShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
