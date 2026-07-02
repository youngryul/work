import ViewPageTitle from '../ViewPageTitle.jsx'

export default function FarmFieldView() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 font-sans">
      <ViewPageTitle icon="🌾" title="농장">
        <p className="text-lg text-gray-600">
          2단계부터 열린 밭이에요. 포실이와 함께 작물을 키워봐요!
        </p>
      </ViewPageTitle>

      <section className="rounded-3xl border-2 border-orange-200 bg-gradient-to-b from-orange-100 via-amber-50 to-rose-50 p-4 sm:p-5 shadow-lg">
        <img
          src="/images/밭.png"
          alt="포실이 농장 밭"
          className="w-full rounded-2xl border border-orange-100 shadow-md object-cover"
        />
      </section>
    </div>
  )
}
