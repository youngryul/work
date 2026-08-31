import SwiftUI

/// 여행 일정 화면 상단 여백 상수
private enum TravelItineraryLayout {
    /// 상단 바와 "여행 일정" 타이틀 사이 여백
    static let topBarSpacing: CGFloat = 12
    /// 내비게이션 바와 일정 목록·빈 상태 사이 여백
    static let contentTopSpacing: CGFloat = 8
}

struct TravelItineraryView: View {
    @State private var trips: [AbroadTrip] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showCreate = false
    @State private var selectedTrip: AbroadTrip?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && trips.isEmpty {
                    ProgressView("불러오는 중...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if trips.isEmpty {
                    VStack(spacing: 16) {
                        Text("✈️")
                            .font(.system(size: 56))
                        Text("등록된 해외 여행이 없어요")
                            .font(.title3)
                            .foregroundColor(.secondary)
                        Button("첫 여행 등록하기") {
                            showCreate = true
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.cyan)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(trips) { trip in
                            Button {
                                selectedTrip = trip
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(trip.countryName)
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.cyan)
                                    Text(trip.title)
                                        .font(.headline)
                                        .foregroundColor(.primary)
                                    Text("\(TravelItineraryTime.formatDateTime(trip.departureAt)) ~ \(TravelItineraryTime.formatDateTime(trip.returnAt))")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                .padding(.vertical, 4)
                            }
                        }
                        .onDelete { indexSet in
                            Task { await deleteTrips(at: indexSet) }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .padding(.top, TravelItineraryLayout.contentTopSpacing)
            .navigationTitle("여행 일정")
            .navigationBarTitleDisplayMode(.large)
            .navigationBarBackButtonHidden(true)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showCreate = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.cyan)
                    }
                }
            }
            .refreshable { await loadTrips() }
            .sheet(isPresented: $showCreate) {
                TravelItineraryCreateView { trip in
                    showCreate = false
                    selectedTrip = trip
                    Task { await loadTrips() }
                }
            }
            .navigationDestination(item: $selectedTrip) { trip in
                TravelItineraryDetailView(trip: trip)
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
        .padding(.top, TravelItineraryLayout.topBarSpacing)
        .task { await loadTrips() }
    }

    private func loadTrips() async {
        isLoading = true
        defer { isLoading = false }
        do {
            trips = try await SupabaseService.shared.fetchAbroadTrips()
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    private func deleteTrips(at indexSet: IndexSet) async {
        let targets = indexSet.map { trips[$0] }
        do {
            for trip in targets {
                try await SupabaseService.shared.deleteAbroadTrip(id: trip.id)
            }
            trips.remove(atOffsets: indexSet)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }
}
