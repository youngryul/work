/**
 * 포실이 대문 페이지
 * 비로그인 초기 화면 - 로그인 버튼을 누르면 로그인 폼으로 이동
 */
export default function LandingPage({ onLogin }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">

      {/* 배경 이미지 (TodayView 와 동일) */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/todo.png')" }}
      />

      {/* 어두운 오버레이 - 텍스트 가독성 확보 */}
      <div className="absolute inset-0 bg-black/30" />

      {/* 컨텐츠 */}
      <main className="relative z-10 flex flex-col items-center text-center px-6">

        {/* 포실이 이미지 */}
        <img
          src="/images/포실이.png"
          alt="포실이"
          className="w-48 h-48 object-contain mb-6 drop-shadow-2xl animate-bounce select-none"
        />

        {/* 타이틀 */}
        <h1 className="text-6xl font-bold text-white mb-3 drop-shadow-lg tracking-wide">
          포실이
        </h1>

        {/* 서브타이틀 */}
        <p className="text-xl text-white/80 mb-12 drop-shadow font-light">
          오늘 하루도 함께해요
        </p>

        {/* 로그인 버튼 */}
        <button
          onClick={onLogin}
          className="
            px-12 py-4 bg-green-500 text-white rounded-full
            text-lg font-semibold shadow-2xl
            hover:bg-green-600 hover:scale-105
            active:scale-95
            transition-all duration-200
          "
        >
          로그인
        </button>
      </main>

    </div>
  )
}
