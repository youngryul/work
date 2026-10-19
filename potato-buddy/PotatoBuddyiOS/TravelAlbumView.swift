import SwiftUI

/// 여행 앨범 화면 상단 여백 상수 (여행 일정 화면과 동일)
private enum TravelAlbumLayout {
    static let topBarSpacing: CGFloat = 12
    static let contentTopSpacing: CGFloat = 8
    /// 앨범당 최대 사진 수 (웹 TRAVEL_ALBUM_MAX_PHOTOS)
    static let maxPhotos = 12
}

/// 여행 앨범 목록 (보기 전용 — 앨범 만들기·사진 올리기는 웹에서)
struct TravelAlbumView: View {
    @State private var albums: [TravelAlbum] = []
    @State private var photosByKey: [String: [TravelAlbumPhoto]] = [:]
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var selectedAlbum: TravelAlbum?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && albums.isEmpty {
                    ProgressView("불러오는 중...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if albums.isEmpty {
                    VStack(spacing: 12) {
                        Text("📸")
                            .font(.system(size: 56))
                        Text("아직 앨범이 없어요")
                            .font(.title3)
                            .foregroundColor(.secondary)
                        Text("앨범 만들기와 사진 올리기는 웹에서 할 수 있어요")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            ForEach(albums) { album in
                                Button {
                                    selectedAlbum = album
                                } label: {
                                    TravelAlbumCard(album: album, photos: photos(for: album))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(16)
                    }
                    .background(Color(.systemGroupedBackground))
                }
            }
            .padding(.top, TravelAlbumLayout.contentTopSpacing)
            .navigationTitle("여행 앨범")
            .navigationBarTitleDisplayMode(.large)
            .refreshable { await loadAlbums() }
            .navigationDestination(item: $selectedAlbum) { album in
                TravelAlbumDetailView(album: album, photos: photos(for: album))
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
        // 더 보기 탭에서 열릴 때 상단 바에 타이틀이 붙어 보이는 문제를 막기 위한 여백
        .padding(.top, TravelAlbumLayout.topBarSpacing)
        .task { await loadAlbums() }
    }

    /// 앨범 사진 (예전 일정 연동 사진은 trip_id로 묶여 있을 수 있음)
    private func photos(for album: TravelAlbum) -> [TravelAlbumPhoto] {
        if let list = photosByKey[album.id], !list.isEmpty { return list }
        if let tripId = album.tripId, let list = photosByKey[tripId] { return list }
        return []
    }

    private func loadAlbums() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let albumList = SupabaseService.shared.fetchTravelAlbums()
            async let photoList = SupabaseService.shared.fetchTravelAlbumPhotos()
            // 기간이 비어 있는 일정 연동 앨범은 출국·귀국일로 채움 (실패해도 목록은 보여줌)
            async let tripList = (try? SupabaseService.shared.fetchAbroadTrips()) ?? []

            let (fetchedAlbums, fetchedPhotos, trips) = try await (albumList, photoList, tripList)

            var grouped: [String: [TravelAlbumPhoto]] = [:]
            for photo in fetchedPhotos {
                guard let key = photo.albumId ?? photo.tripId else { continue }
                grouped[key, default: []].append(photo)
            }

            albums = fetchedAlbums.map { album in
                guard album.startDate == nil || album.endDate == nil,
                      let trip = trips.first(where: { $0.id == album.tripId }) else { return album }
                var filled = album
                filled.startDate = album.startDate ?? String(trip.departureAt.prefix(10))
                filled.endDate = album.endDate ?? String(trip.returnAt.prefix(10))
                return filled
            }
            photosByKey = grouped
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }
}

/// 앨범 목록 카드 (표지 + 기간 + 사진 수)
private struct TravelAlbumCard: View {
    let album: TravelAlbum
    let photos: [TravelAlbumPhoto]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                Color(.secondarySystemBackground)
                if let cover = photos.first {
                    TravelAlbumRemoteImage(urlString: cover.imageUrl)
                } else {
                    Text("아직 사진이 없어요")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                if !album.periodLabel.isEmpty, !photos.isEmpty {
                    LinearGradient(colors: [.black.opacity(0.65), .clear], startPoint: .bottom, endPoint: .top)
                        .frame(height: 64)
                        .frame(maxHeight: .infinity, alignment: .bottom)
                    Text(album.periodLabel)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.white)
                        .padding(12)
                }
            }
            .aspectRatio(4 / 3, contentMode: .fit)
            .clipped()

            VStack(alignment: .leading, spacing: 4) {
                Text((album.countryName ?? "여행 앨범") + (album.tripId != nil ? " · 일정 연동" : ""))
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.pink)
                Text(album.title)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .lineLimit(1)
                Text("\(photos.count)/\(TravelAlbumLayout.maxPhotos)장")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.06), radius: 6, y: 2)
    }
}

/// 앨범 상세: 폴라로이드 그리드 + 공유 버튼
struct TravelAlbumDetailView: View {
    let album: TravelAlbum
    let photos: [TravelAlbumPhoto]

    @State private var showShare = false
    @State private var viewerIndex: Int?

    private static let rotations: [Double] = [-4, 2, -2, 3, -3, 1, 4, -1]
    private let columns = [GridItem(.flexible(), spacing: 18), GridItem(.flexible(), spacing: 18)]

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text(album.title)
                    .font(.sketchbook(30))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.red.opacity(0.75), .orange, .green, .blue.opacity(0.75), .purple.opacity(0.75)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .multilineTextAlignment(.center)
                if !album.periodLabel.isEmpty {
                    Text(album.periodLabel)
                        .font(.sketchbook(16))
                        .foregroundColor(Color(red: 0x57 / 255, green: 0x53 / 255, blue: 0x4e / 255))
                }
            }
            .padding(.top, 16)
            .padding(.horizontal, 16)

            if photos.isEmpty {
                VStack(spacing: 8) {
                    Text("아직 사진이 없어요")
                        .foregroundColor(.secondary)
                    Text("사진은 웹에서 올릴 수 있어요")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 60)
            } else {
                LazyVGrid(columns: columns, spacing: 26) {
                    ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                        Button {
                            viewerIndex = index
                        } label: {
                            PolaroidCard(photo: photo)
                                .rotationEffect(.degrees(Self.rotations[index % Self.rotations.count]))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 22)
                .padding(.vertical, 24)
            }
        }
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0xfa / 255, green: 0xf7 / 255, blue: 0xf2 / 255),
                    Color(red: 0xee / 255, green: 0xf2 / 255, blue: 0xea / 255),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        )
        .navigationTitle(album.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showShare = true
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .disabled(photos.isEmpty)
            }
        }
        .sheet(isPresented: $showShare) {
            TravelAlbumShareView(album: album, photos: photos)
        }
        .fullScreenCover(item: Binding(
            get: { viewerIndex.map { TravelAlbumViewerSelection(index: $0) } },
            set: { viewerIndex = $0?.index }
        )) { selection in
            TravelAlbumPhotoViewer(photos: photos, startIndex: selection.index)
        }
    }
}

private struct TravelAlbumViewerSelection: Identifiable {
    let index: Int
    var id: Int { index }
}

/// 폴라로이드 카드 (사진 + 마스킹 테이프 + 한줄 캡션)
private struct PolaroidCard: View {
    let photo: TravelAlbumPhoto

    var body: some View {
        VStack(spacing: 0) {
            Color(.secondarySystemBackground)
                .aspectRatio(1, contentMode: .fit)
                .overlay { TravelAlbumRemoteImage(urlString: photo.imageUrl) }
                .clipped()
            Text(photo.trimmedCaption.isEmpty ? " " : photo.trimmedCaption)
                .font(.sketchbook(15))
                .foregroundColor(Color(red: 0x44 / 255, green: 0x40 / 255, blue: 0x3c / 255))
                .lineLimit(1)
                .padding(.top, 8)
                .padding(.bottom, 4)
        }
        .padding([.top, .horizontal], 8)
        .padding(.bottom, 6)
        .background(Color.white)
        .shadow(color: .black.opacity(0.16), radius: 8, y: 4)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.white.opacity(0.75))
                .overlay(Rectangle().stroke(Color(red: 0xd6 / 255, green: 0xd3 / 255, blue: 0xd1 / 255), lineWidth: 1))
                .frame(width: 44, height: 14)
                .rotationEffect(.degrees(-2))
                .offset(y: -7)
        }
    }
}

/// 원격 사진 (축소본, 메모리 캐시)
struct TravelAlbumRemoteImage: View {
    let urlString: String
    var contentMode: ContentMode = .fill

    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task(id: urlString) {
            image = await TravelAlbumImageLoader.shared.thumbnail(for: urlString)
        }
    }
}

/// 사진 한 장씩 크게 보기 + 사진별 저장·공유
private struct TravelAlbumPhotoViewer: View {
    let photos: [TravelAlbumPhoto]
    let startIndex: Int

    init(photos: [TravelAlbumPhoto], startIndex: Int) {
        self.photos = photos
        self.startIndex = startIndex
        _currentIndex = State(initialValue: startIndex)
    }

    @Environment(\.dismiss) private var dismiss
    @State private var currentIndex: Int
    @State private var shareImage: TravelAlbumShareItem?
    @State private var isWorking = false
    @State private var message = ""

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            TabView(selection: $currentIndex) {
                ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                    VStack(spacing: 16) {
                        TravelAlbumRemoteImage(urlString: photo.imageUrl, contentMode: .fit)
                        if !photo.trimmedCaption.isEmpty {
                            Text(photo.trimmedCaption)
                                .font(.sketchbook(20))
                                .foregroundColor(.white)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 24)
                        }
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: photos.count > 1 ? .automatic : .never))

            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.title3.weight(.semibold))
                        .foregroundColor(.white)
                        .padding(10)
                }
                Spacer()
                Text("\(currentIndex + 1) / \(photos.count)")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.8))
                Spacer()
                Menu {
                    Button { Task { await saveCurrent() } } label: {
                        Label("이미지 저장", systemImage: "square.and.arrow.down")
                    }
                    Button { Task { await instagramCurrent() } } label: {
                        Label("인스타그램에 올리기", systemImage: "camera")
                    }
                    Button { Task { await shareCurrent() } } label: {
                        Label("공유하기", systemImage: "square.and.arrow.up")
                    }
                } label: {
                    Image(systemName: isWorking ? "hourglass" : "ellipsis.circle")
                        .font(.title3.weight(.semibold))
                        .foregroundColor(.white)
                        .padding(10)
                }
                .disabled(isWorking)
            }
            .padding(.horizontal, 8)

            if !message.isEmpty {
                Text(message)
                    .font(.footnote)
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.black.opacity(0.6), in: Capsule())
                    .frame(maxHeight: .infinity, alignment: .bottom)
                    .padding(.bottom, 48)
            }
        }
        .sheet(item: $shareImage) { item in
            ActivityShareSheet(items: [item.image])
        }
    }

    /// 현재 사진 원본
    private func loadCurrentImage() async -> UIImage? {
        guard photos.indices.contains(currentIndex) else { return nil }
        return await TravelAlbumImageLoader.shared.fullImage(for: photos[currentIndex].imageUrl)
    }

    private func saveCurrent() async {
        isWorking = true
        defer { isWorking = false }
        guard let image = await loadCurrentImage() else {
            showMessage("사진을 불러오지 못했어요.")
            return
        }
        do {
            try await TravelAlbumPhotoExporter.saveToPhotos(image)
            showMessage("사진 앱에 저장했어요.")
        } catch {
            showMessage(error.localizedDescription)
        }
    }

    private func instagramCurrent() async {
        isWorking = true
        defer { isWorking = false }
        guard let image = await loadCurrentImage() else {
            showMessage("사진을 불러오지 못했어요.")
            return
        }
        do {
            let opened = try await TravelAlbumPhotoExporter.shareToInstagram(image)
            // 인스타그램이 없으면 공유 시트로 대체
            if !opened { shareImage = TravelAlbumShareItem(image: image) }
        } catch {
            showMessage(error.localizedDescription)
        }
    }

    private func shareCurrent() async {
        isWorking = true
        defer { isWorking = false }
        guard let image = await loadCurrentImage() else {
            showMessage("사진을 불러오지 못했어요.")
            return
        }
        shareImage = TravelAlbumShareItem(image: image)
    }

    private func showMessage(_ text: String) {
        message = text
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            if message == text { message = "" }
        }
    }
}

/// 공유 시트에 넘길 이미지
struct TravelAlbumShareItem: Identifiable {
    let id = UUID()
    let image: UIImage
}
