import { useEffect, useState } from 'react'

import { useAuth } from '../../contexts/AuthContext.jsx'

import { getGachaGradeMeta } from '../../constants/gachaGrades.js'

import { getMyGachaCollection, getMyGachaPullCount } from '../../services/gachaService.js'

import ViewPageTitle from '../ViewPageTitle.jsx'



/**

 * 마이페이지 — 뽑은 포실이 컬렉션

 */

export default function MyPageView() {

  const { user } = useAuth()

  const [collection, setCollection] = useState([])

  const [totalPulls, setTotalPulls] = useState(0)

  const [loading, setLoading] = useState(true)



  const load = async () => {

    setLoading(true)

    try {

      const [items, count] = await Promise.all([

        getMyGachaCollection(),

        getMyGachaPullCount(),

      ])

      setCollection(items)

      setTotalPulls(count)

    } catch {

      setCollection([])

      setTotalPulls(0)

    } finally {

      setLoading(false)

    }

  }



  useEffect(() => {

    load()

  }, [])



  return (

    <div className="max-w-4xl mx-auto p-6 font-sans">

      <ViewPageTitle icon="👤" title="마이페이지">

        <p className="text-xl text-gray-600">

          {user?.email ? `${user.email}님의 ` : ''}포실이 컬렉션

        </p>

      </ViewPageTitle>



      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">

        <div className="rounded-xl border-2 border-green-200 bg-white/80 p-4 text-center shadow-sm">

          <p className="text-sm text-gray-500">보유 종류</p>

          <p className="text-3xl font-bold text-green-600">{collection.length}</p>

        </div>

        <div className="rounded-xl border-2 border-pink-200 bg-white/80 p-4 text-center shadow-sm">

          <p className="text-sm text-gray-500">총 뽑기</p>

          <p className="text-3xl font-bold text-pink-600">{totalPulls}</p>

        </div>

        <div className="rounded-xl border-2 border-amber-200 bg-white/80 p-4 text-center shadow-sm col-span-2 sm:col-span-1">

          <p className="text-sm text-gray-500">레전드</p>

          <p className="text-3xl font-bold text-amber-600">

            {collection.filter((c) => c.grade === 'legendary').length}

          </p>

        </div>

      </div>



      {loading ? (

        <div className="text-center py-16 text-gray-500">로딩 중...</div>

      ) : collection.length === 0 ? (

        <div className="text-center py-16 rounded-2xl border-2 border-dashed border-gray-200 bg-white/50">

          <p className="text-4xl mb-3">🎰</p>

          <p className="text-lg text-gray-600 font-medium">아직 뽑은 포실이가 없어요</p>

          <p className="text-sm text-gray-400 mt-2">뽑기 가챠 메뉴에서 첫 포실이를 만나보세요!</p>

        </div>

      ) : (

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">

          {collection.map((item) => {

            const gradeMeta = getGachaGradeMeta(item.grade)

            return (

              <div

                key={item.characterId}

                className={`relative rounded-2xl border-2 bg-white p-3 shadow-md hover:shadow-lg transition-shadow ${gradeMeta.colorClass.split(' ').find((c) => c.startsWith('border-')) || 'border-gray-200'}`}

              >

                {item.count > 1 && (

                  <span className="absolute top-2 right-2 z-10 min-w-[1.5rem] px-1.5 py-0.5 rounded-full bg-gray-800 text-white text-xs font-bold text-center">

                    ×{item.count}

                  </span>

                )}

                <div className="aspect-square rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden mb-2">

                  <img

                    src={item.imageUrl}

                    alt={item.name}

                    className="w-full h-full object-contain p-1"

                  />

                </div>

                <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>

                <span

                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${gradeMeta.colorClass}`}

                >

                  {gradeMeta.label}

                </span>

              </div>

            )

          })}

        </div>

      )}

    </div>

  )

}


