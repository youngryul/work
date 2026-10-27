import SwiftUI
import PencilKit

/// 노트 한 페이지를 그리는 캔버스 (PencilKit + 속지 배경 + 사진 레이어)
/// - 필기 좌표는 페이지 기준 pt이고, 확대·축소는 PKCanvasView 자체 줌을 쓴다.
/// - 사진 편집 중에는 필기를 막고 사진을 끌어서 옮기거나 두 손가락으로 크기를 바꾼다.
struct NotebookCanvasView: UIViewRepresentable {
    let pageId: String
    /// 같은 페이지라도 필기를 다시 불러와야 할 때 올린다
    let revision: Int
    let pageSize: CGSize
    let background: UIImage?
    let drawing: PKDrawing
    let photos: [NotebookPageImage]
    let photoImages: [String: UIImage]
    let isPhotoEditing: Bool
    var onDrawingChanged: (PKDrawing) -> Void
    var onPhotosChanged: ([NotebookPageImage]) -> Void
    var onDeletePhoto: (NotebookPageImage) -> Void

    func makeUIView(context: Context) -> NotebookCanvasContainer {
        let container = NotebookCanvasContainer()
        container.canvas.delegate = context.coordinator
        container.photoLayer.onFrameChanged = { id, frame in
            context.coordinator.photoFrameChanged(id: id, frame: frame)
        }
        container.photoLayer.onDeleteRequested = { id in
            context.coordinator.photoDeleteRequested(id: id)
        }
        return container
    }

    func updateUIView(_ container: NotebookCanvasContainer, context: Context) {
        let coordinator = context.coordinator
        coordinator.parent = self

        let pageChanged = coordinator.loadedPageId != pageId || coordinator.loadedRevision != revision
        if pageChanged {
            coordinator.loadedPageId = pageId
            coordinator.loadedRevision = revision
            coordinator.isApplyingDrawing = true
            container.canvas.drawing = drawing
            coordinator.isApplyingDrawing = false
        }
        container.configure(pageSize: pageSize, background: background, resetZoom: pageChanged)
        container.photoLayer.update(photos: photos, images: photoImages, isEditing: isPhotoEditing)
        container.setPhotoEditing(isPhotoEditing)
    }

    static func dismantleUIView(_ container: NotebookCanvasContainer, coordinator: Coordinator) {
        container.hideToolPicker()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        var parent: NotebookCanvasView
        var loadedPageId: String?
        var loadedRevision = -1
        /// 코드로 drawing을 바꿀 때는 변경 알림을 무시한다
        var isApplyingDrawing = false

        init(parent: NotebookCanvasView) {
            self.parent = parent
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            // 페이지를 불러올 때 넣은 drawing이 그대로 돌아오는 알림은 변경이 아니다
            guard !isApplyingDrawing, canvasView.drawing != parent.drawing else { return }
            parent.onDrawingChanged(canvasView.drawing)
        }

        func scrollViewDidZoom(_ scrollView: UIScrollView) {
            (scrollView.superview as? NotebookCanvasContainer)?.updateForZoom()
        }

        func photoFrameChanged(id: String, frame: CGRect) {
            var photos = parent.photos
            guard let index = photos.firstIndex(where: { $0.id == id }) else { return }
            photos[index].frame = frame
            parent.onPhotosChanged(photos)
        }

        func photoDeleteRequested(id: String) {
            guard let photo = parent.photos.first(where: { $0.id == id }) else { return }
            parent.onDeletePhoto(photo)
        }
    }
}

/// PKCanvasView와 배경·사진 레이어를 묶는 컨테이너
final class NotebookCanvasContainer: UIView {
    let canvas = PKCanvasView()
    /// 속지 또는 PDF 페이지 (필기 아래)
    private let backgroundView = UIImageView()
    /// 붙인 사진 (평소에는 필기 아래, 사진 편집 중에는 맨 위)
    let photoLayer = NotebookPhotoLayerView()
    private let toolPicker = PKToolPicker()

    private var pageSize = NotebookPageLayout.defaultSize
    private var lastFitWidth: CGFloat = 0
    private var isPhotoEditing = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = UIColor.systemGray5

        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        // 시스템 도구 막대의 '손가락으로 그리기' 설정을 따른다 (아이폰은 손가락 필기 가능)
        canvas.drawingPolicy = .default
        canvas.alwaysBounceVertical = true
        canvas.contentInsetAdjustmentBehavior = .never
        // 다크 모드에서도 잉크 색이 뒤집히지 않도록 고정
        canvas.overrideUserInterfaceStyle = .light
        canvas.tool = PKInkingTool(.pen, color: .black, width: 3)
        addSubview(canvas)

        for layerView in [backgroundView, photoLayer] as [UIView] {
            layerView.layer.anchorPoint = .zero
            layerView.isUserInteractionEnabled = false
        }
        canvas.insertSubview(backgroundView, at: 0)
        canvas.insertSubview(photoLayer, aboveSubview: backgroundView)

        toolPicker.addObserver(canvas)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil else { return }
        toolPicker.setVisible(true, forFirstResponder: canvas)
        canvas.becomeFirstResponder()
    }

    func hideToolPicker() {
        toolPicker.setVisible(false, forFirstResponder: canvas)
        canvas.resignFirstResponder()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        canvas.frame = bounds
        // 회전 등으로 폭이 바뀌면 다시 폭에 맞춘다
        if abs(bounds.width - lastFitWidth) > 0.5 {
            applyFitZoom()
        }
    }

    func configure(pageSize: CGSize, background: UIImage?, resetZoom: Bool) {
        let sizeChanged = self.pageSize != pageSize
        self.pageSize = pageSize
        backgroundView.image = background
        backgroundView.bounds = CGRect(origin: .zero, size: pageSize)
        photoLayer.bounds = CGRect(origin: .zero, size: pageSize)
        if resetZoom || sizeChanged {
            applyFitZoom()
            canvas.setContentOffset(CGPoint(x: -canvas.contentInset.left, y: 0), animated: false)
        } else {
            updateForZoom()
        }
    }

    /// 페이지 폭을 화면 폭에 맞춘 배율을 기본으로 하고, 4배까지 확대
    private func applyFitZoom() {
        guard bounds.width > 0 else { return }
        lastFitWidth = bounds.width
        let fit = bounds.width / pageSize.width
        canvas.minimumZoomScale = fit * 0.5
        canvas.maximumZoomScale = fit * 4
        canvas.zoomScale = fit
        updateForZoom()
    }

    /// 줌이 바뀌면 콘텐츠 크기와 배경·사진 레이어 배율을 맞춘다
    func updateForZoom() {
        let zoom = canvas.zoomScale
        canvas.contentSize = CGSize(width: pageSize.width * zoom, height: pageSize.height * zoom)
        let transform = CGAffineTransform(scaleX: zoom, y: zoom)
        for layerView in [backgroundView, photoLayer] as [UIView] {
            layerView.transform = transform
            layerView.layer.position = .zero
        }
        // 축소해서 페이지가 화면보다 좁으면 가운데 정렬
        let horizontalInset = max(0, (canvas.bounds.width - canvas.contentSize.width) / 2)
        canvas.contentInset = UIEdgeInsets(top: 0, left: horizontalInset, bottom: 0, right: horizontalInset)
    }

    func setPhotoEditing(_ editing: Bool) {
        guard editing != isPhotoEditing else { return }
        isPhotoEditing = editing
        canvas.drawingGestureRecognizer.isEnabled = !editing
        // 사진을 끌 때 페이지가 같이 스크롤되지 않도록 사진 편집 중에는 스크롤·줌을 막는다
        canvas.isScrollEnabled = !editing
        canvas.pinchGestureRecognizer?.isEnabled = !editing
        photoLayer.isUserInteractionEnabled = editing
        if editing {
            canvas.bringSubviewToFront(photoLayer)
        } else {
            canvas.insertSubview(photoLayer, aboveSubview: backgroundView)
        }
    }
}

/// 붙인 사진 레이어 (좌표는 페이지 기준 pt)
final class NotebookPhotoLayerView: UIView {
    var onFrameChanged: ((String, CGRect) -> Void)?
    var onDeleteRequested: ((String) -> Void)?

    private var photoViews: [String: NotebookPhotoView] = [:]
    /// 사진 최소 폭
    private static let minimumWidth: CGFloat = 60

    func update(photos: [NotebookPageImage], images: [String: UIImage], isEditing: Bool) {
        let ids = Set(photos.map(\.id))
        for (id, view) in photoViews where !ids.contains(id) {
            view.removeFromSuperview()
            photoViews[id] = nil
        }
        for photo in photos {
            let view = photoViews[photo.id] ?? makePhotoView(id: photo.id)
            // 제스처 중에는 SwiftUI 쪽 값으로 덮어쓰지 않는다
            if !view.isInteracting {
                view.frame = photo.frame
            }
            view.image = images[photo.path]
            view.backgroundColor = view.image == nil ? UIColor.systemGray4 : .clear
            view.layer.borderWidth = isEditing ? 2 : 0
        }
    }

    private func makePhotoView(id: String) -> NotebookPhotoView {
        let view = NotebookPhotoView()
        view.photoId = id
        view.contentMode = .scaleAspectFill
        view.clipsToBounds = true
        view.isUserInteractionEnabled = true
        view.layer.borderColor = UIColor.systemGreen.cgColor

        view.addGestureRecognizer(UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:))))
        view.addGestureRecognizer(UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:))))
        view.addGestureRecognizer(UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:))))

        addSubview(view)
        photoViews[id] = view
        return view
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        guard let view = gesture.view as? NotebookPhotoView else { return }
        let translation = gesture.translation(in: self)
        view.center = CGPoint(x: view.center.x + translation.x, y: view.center.y + translation.y)
        gesture.setTranslation(.zero, in: self)
        trackInteraction(of: view, state: gesture.state)
    }

    @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
        guard let view = gesture.view as? NotebookPhotoView else { return }
        let center = view.center
        let width = max(Self.minimumWidth, view.bounds.width * gesture.scale)
        let height = width * view.bounds.height / max(view.bounds.width, 1)
        view.bounds = CGRect(x: 0, y: 0, width: width, height: height)
        view.center = center
        gesture.scale = 1
        trackInteraction(of: view, state: gesture.state)
    }

    @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began, let view = gesture.view as? NotebookPhotoView else { return }
        onDeleteRequested?(view.photoId)
    }

    private func trackInteraction(of view: NotebookPhotoView, state: UIGestureRecognizer.State) {
        switch state {
        case .began, .changed:
            view.isInteracting = true
        case .ended, .cancelled, .failed:
            view.isInteracting = false
            onFrameChanged?(view.photoId, view.frame)
        default:
            break
        }
    }
}

final class NotebookPhotoView: UIImageView {
    var photoId = ""
    var isInteracting = false
}
