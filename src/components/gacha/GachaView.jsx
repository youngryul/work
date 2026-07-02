import { useEffect, useState } from 'react'

import { getGachaGradeMeta, GACHA_CAPSULE_IMAGES } from '../../constants/gachaGrades.js'

import { getActiveGachaCharacters } from '../../services/gachaCharacterService.js'

import { drawGacha } from '../../services/gachaService.js'

import { showToast, TOAST_TYPES } from '../Toast.jsx'

import ViewPageTitle from '../ViewPageTitle.jsx'



const PHASE = {

  IDLE: 'idle',

  SHAKING: 'shaking',

  REVEAL: 'reveal',

}



/**

 * 캡슐 가챠 뽑기 화면

 */

export default function GachaView() {

  const [poolSize, setPoolSize] = useState(0)

  const [phase, setPhase] = useState(PHASE.IDLE)

  const [result, setResult] = useState(null)

  const [isDrawing, setIsDrawing] = useState(false)



  useEffect(() => {

    getActiveGachaCharacters()

      .then((chars) => setPoolSize(chars.length))

      .catch(() => setPoolSize(0))

  }, [result])



  const handleDraw = async () => {

    if (isDrawing || poolSize === 0) return



    setIsDrawing(true)

    setResult(null)

    setPhase(PHASE.SHAKING)



    try {

      const drawn = await drawGacha()

      await new Promise((r) => setTimeout(r, 1200))

      setResult(drawn)

      setPhase(PHASE.REVEAL)

    } catch (error) {

      setPhase(PHASE.IDLE)

      showToast(error?.message || '뽑기에 실패했습니다.', TOAST_TYPES.ERROR)

    } finally {

      setIsDrawing(false)

    }

  }



  const handleCloseReveal = () => {

    setPhase(PHASE.IDLE)

    setResult(null)

  }



  const gradeMeta = result ? getGachaGradeMeta(result.grade) : null



  return (

    <div className="max-w-2xl mx-auto p-6 font-sans">

      <ViewPageTitle icon="🎰" title="뽑기 가챠">

        <p className="text-xl text-gray-600">

          캡슐을 돌려 랜덤 포실이를 만나보세요!

        </p>

      </ViewPageTitle>



      <div className="mt-8 flex flex-col items-center">

        {/* 캡슐 머신 */}

        <div

          className={`relative w-full max-w-sm rounded-3xl border-4 border-pink-300 bg-gradient-to-b from-pink-100 via-rose-50 to-amber-50 p-6 shadow-xl ${

            phase === PHASE.SHAKING ? 'animate-gacha-shake' : ''

          }`}

        >

          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-pink-400 px-4 py-1 text-sm font-bold text-white shadow">

            CAPSULE

          </div>



          {/* 캡슐 디스플레이 */}

          <div className="mt-4 rounded-2xl border-2 border-white/80 bg-white/60 p-4 min-h-[200px] flex items-center justify-center overflow-hidden">

            {phase === PHASE.REVEAL && result ? (

              <div className="text-center animate-gacha-pop">

                <div

                  className={`inline-block rounded-2xl border-4 p-2 bg-white shadow-lg ring-4 ${gradeMeta.ringClass}`}

                >

                  <img

                    src={result.imageUrl}

                    alt={result.name}

                    className="w-40 h-40 object-contain rounded-xl"

                  />

                </div>

                <p className="mt-3 text-xl font-bold text-gray-800">{result.name}</p>

                <span

                  className={`inline-block mt-1 px-3 py-0.5 rounded-full text-sm font-semibold border ${gradeMeta.colorClass}`}

                >

                  {gradeMeta.label}

                </span>

              </div>

            ) : (
              <div className="flex gap-3 justify-center items-end">
                {GACHA_CAPSULE_IMAGES.map((src, i) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    aria-hidden
                    className={`w-16 h-20 sm:w-20 sm:h-24 object-contain drop-shadow-md ${
                      phase === PHASE.SHAKING ? 'animate-gacha-capsule' : ''
                    }`}
                    style={{ animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </div>
            )}

          </div>



          {/* 출구 */}

          <div className="mx-auto mt-4 w-24 h-8 rounded-b-2xl bg-gray-300 border-2 border-gray-400 shadow-inner" />

        </div>



        <p className="mt-4 text-sm text-gray-500">

          뽑기 가능 포실이: <strong className="text-gray-700">{poolSize}종</strong>

        </p>



        {poolSize === 0 && (

          <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">

            아직 등록된 포실이가 없습니다. 관리자가 캐릭터를 등록하면 뽑을 수 있어요.

          </p>

        )}



        <button

          type="button"

          onClick={handleDraw}

          disabled={isDrawing || poolSize === 0}

          className="mt-6 px-10 py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-lg font-bold shadow-lg hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"

        >

          {isDrawing ? '뽑는 중...' : '🎱 캡슐 뽑기'}

        </button>



        {phase === PHASE.REVEAL && result && (

          <button

            type="button"

            onClick={handleCloseReveal}

            className="mt-3 text-sm text-gray-500 underline hover:text-gray-700"

          >

            다시 뽑기

          </button>

        )}

      </div>



      <style>{`

        @keyframes gacha-shake {

          0%, 100% { transform: rotate(0deg); }

          20% { transform: rotate(-2deg) translateX(-2px); }

          40% { transform: rotate(2deg) translateX(2px); }

          60% { transform: rotate(-1deg); }

          80% { transform: rotate(1deg); }

        }

        @keyframes gacha-capsule {

          0%, 100% { transform: translateY(0); }

          50% { transform: translateY(-6px); }

        }

        @keyframes gacha-pop {

          0% { transform: scale(0.5); opacity: 0; }

          70% { transform: scale(1.05); }

          100% { transform: scale(1); opacity: 1; }

        }

        .animate-gacha-shake { animation: gacha-shake 0.5s ease-in-out infinite; }

        .animate-gacha-capsule { animation: gacha-capsule 0.4s ease-in-out infinite; }

        .animate-gacha-pop { animation: gacha-pop 0.5s ease-out forwards; }

      `}</style>

    </div>

  )

}


