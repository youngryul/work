import { useEffect, useRef, useState } from 'react'
import { AI_FOUR_CUT_SCENE_COUNT } from '../constants/diaryModes.js'
import { composeFourCutStrip } from '../utils/fourCutComposer.js'
import { downloadImageBlob } from '../utils/imageBitmap.js'
import { shareFourCutImageBlob } from '../utils/instagramStoryShare.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

const POSILI_PLACEHOLDER = `/images/${encodeURIComponent('포실이.png')}`
const SLOT_COUNT = AI_FOUR_CUT_SCENE_COUNT
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const PRINT_MS = 1400
const VIEWPORT_H = 340

/**
 * 포토부스 스트립 인화 모달
 * — 생성되는 컷으로 자동 포커스·스크롤, 드래그로 전체 확인
 */
export default function FourCutDispenserModal({
  isOpen,
  sceneUrls = [],
  fourCutUrl = null,
  isGenerating = false,
  progress = null,
  dateLabel = '',
  onClose,
}) {
  const [stripOut, setStripOut] = useState(false)
  const [readyMap, setReadyMap] = useState({})
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [focusIndex, setFocusIndex] = useState(-1)
  const [framedPreviewUrl, setFramedPreviewUrl] = useState(null)
  const [showFramed, setShowFramed] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const framedBlobRef = useRef(null)
  const framedPreviewUrlRef = useRef(null)
  const printStartedRef = useRef(false)
  const timersRef = useRef([])
  const stripRef = useRef(null)
  const viewportRef = useRef(null)
  const cellRefs = useRef([])
  const prevReadyCountRef = useRef(0)
  const userDraggingRef = useRef(false)
  const [stripHeight, setStripHeight] = useState(VIEWPORT_H)
  const dragRef = useRef({
    active: false,
    startY: 0,
    originDragY: 0,
    pointerId: null,
  })

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const clearFramedPreview = () => {
    if (framedPreviewUrlRef.current) {
      URL.revokeObjectURL(framedPreviewUrlRef.current)
      framedPreviewUrlRef.current = null
    }
    setFramedPreviewUrl(null)
    framedBlobRef.current = null
    setShowFramed(false)
  }

  const resetVisual = () => {
    clearTimers()
    printStartedRef.current = false
    prevReadyCountRef.current = 0
    userDraggingRef.current = false
    setStripOut(false)
    setReadyMap({})
    setDragY(0)
    setIsDragging(false)
    setFocusIndex(-1)
    setIsComposing(false)
    clearFramedPreview()
    dragRef.current = { active: false, startY: 0, originDragY: 0, pointerId: null }
  }

  const getComposeUrls = () => sceneUrls.filter(Boolean).slice(0, SLOT_COUNT)

  const ensureFramedBlob = async () => {
    if (framedBlobRef.current) return framedBlobRef.current
    const urls = getComposeUrls()
    if (urls.length > 0) {
      const blob = await composeFourCutStrip(urls, { dateLabel })
      framedBlobRef.current = blob
      const preview = URL.createObjectURL(blob)
      if (framedPreviewUrlRef.current) URL.revokeObjectURL(framedPreviewUrlRef.current)
      framedPreviewUrlRef.current = preview
      setFramedPreviewUrl(preview)
      return blob
    }
    if (fourCutUrl) {
      const res = await fetch(fourCutUrl)
      if (!res.ok) throw new Error('이미지를 불러올 수 없습니다.')
      const blob = await res.blob()
      framedBlobRef.current = blob
      framedPreviewUrlRef.current = null
      setFramedPreviewUrl(fourCutUrl)
      return blob
    }
    throw new Error('공유할 이미지가 없습니다.')
  }

  const startPrint = () => {
    if (printStartedRef.current) return
    printStartedRef.current = true
    setStripOut(false)
    setDragY(0)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setStripOut(true))
    })
  }

  const measureStrip = () => {
    if (!stripRef.current) return
    const h = stripRef.current.scrollHeight
    if (h > 0) setStripHeight(h)
  }

  const viewportH = Math.min(Math.max(stripHeight, 120), VIEWPORT_H)
  const isFramedView = showFramed && Boolean(framedPreviewUrl)
  const activeViewportH = isFramedView
    ? Math.min(Math.max(stripHeight, 160), 440)
    : viewportH
  const minDragY = Math.min(0, activeViewportH - stripHeight)
  const canDrag = (isFramedView || stripOut) && stripHeight > activeViewportH + 4

  const clampDrag = (value) => Math.max(minDragY, Math.min(0, value))

  /** 특정 컷이 뷰포트 중앙에 오도록 부드럽게 스크롤 */
  const focusCell = (index) => {
    if (isFramedView) return
    const cell = cellRefs.current[index]
    if (!cell) return
    const cellTop = cell.offsetTop
    const cellH = cell.offsetHeight || 0
    const centered = -(cellTop - (activeViewportH - cellH) / 2)
    setFocusIndex(index)
    setDragY(clampDrag(centered))
  }

  useEffect(() => {
    if (!isOpen) return undefined
    const { body, documentElement } = document
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverscroll = documentElement.style.overscrollBehavior
    const scrollY = window.scrollY
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    documentElement.style.overscrollBehavior = 'none'
    return () => {
      body.style.overflow = prevBodyOverflow
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      documentElement.style.overscrollBehavior = prevHtmlOverscroll
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      resetVisual()
      return
    }
    startPrint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setReadyMap((prev) => {
      const next = { ...prev }
      let changed = false
      sceneUrls.forEach((url, index) => {
        if (url && next[index] !== url) {
          next[index] = url
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [isOpen, sceneUrls])

  useEffect(() => {
    if (!isOpen) return
    measureStrip()
    const t = setTimeout(measureStrip, PRINT_MS + 50)
    timersRef.current.push(t)
  }, [isOpen, readyMap, stripOut])

  useEffect(() => {
    if (isFramedView) {
      setDragY((prev) => clampDrag(prev))
      return
    }
    if (focusIndex >= 0 && !userDraggingRef.current && !isDragging) {
      focusCell(focusIndex)
    } else {
      setDragY((prev) => clampDrag(prev))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripHeight, activeViewportH, isFramedView])

  useEffect(() => {
    const el = viewportRef.current
    if (!el || !isOpen) return undefined

    const onWheel = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!canDrag) return
      userDraggingRef.current = true
      setDragY((prev) => clampDrag(prev - e.deltaY))
    }

    const onTouchMove = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchmove', onTouchMove)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, canDrag, minDragY])

  // 새 컷이 채워지면 그 컷으로 포커스하며 내려감
  useEffect(() => {
    if (!isOpen || !stripOut || isFramedView) return
    const count = Object.keys(readyMap).filter((k) => readyMap[k]).length
    if (count <= prevReadyCountRef.current) {
      prevReadyCountRef.current = count
      return
    }
    prevReadyCountRef.current = count
    if (userDraggingRef.current) return

    const latestIndex = Math.max(
      ...Object.keys(readyMap)
        .filter((k) => readyMap[k])
        .map(Number),
      -1,
    )
    if (latestIndex < 0) return

    const t = setTimeout(() => {
      measureStrip()
      focusCell(latestIndex)
    }, 100)
    timersRef.current.push(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyMap, stripOut, isOpen, isFramedView])

  const sceneKey = sceneUrls.filter(Boolean).join('|')

  // 생성 완료 후 프레임 합성 미리보기
  useEffect(() => {
    if (!isOpen || isGenerating) return undefined
    const urls = sceneUrls.filter(Boolean).slice(0, SLOT_COUNT)
    if (urls.length === 0 && !fourCutUrl) return undefined
    if (framedBlobRef.current && framedPreviewUrl) {
      setShowFramed(true)
      return undefined
    }

    let cancelled = false
    ;(async () => {
      try {
        if (urls.length > 0) {
          const blob = await composeFourCutStrip(urls, { dateLabel })
          if (cancelled) return
          framedBlobRef.current = blob
          const preview = URL.createObjectURL(blob)
          if (framedPreviewUrlRef.current) URL.revokeObjectURL(framedPreviewUrlRef.current)
          framedPreviewUrlRef.current = preview
          setFramedPreviewUrl(preview)
        } else {
          framedBlobRef.current = null
          framedPreviewUrlRef.current = null
          setFramedPreviewUrl(fourCutUrl)
        }
        if (cancelled) return
        setShowFramed(true)
        setDragY(0)
        requestAnimationFrame(measureStrip)
      } catch (error) {
        console.error('프레임 합성 실패:', error)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isGenerating, sceneKey, fourCutUrl, dateLabel])

  const handlePointerDown = (e) => {
    e.stopPropagation()
    if (!canDrag) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    userDraggingRef.current = true
    dragRef.current = {
      active: true,
      startY: e.clientY,
      originDragY: dragY,
      pointerId: e.pointerId,
    }
    setIsDragging(true)
  }

  const handlePointerMove = (e) => {
    e.stopPropagation()
    if (!dragRef.current.active) return
    e.preventDefault()
    const delta = e.clientY - dragRef.current.startY
    setDragY(clampDrag(dragRef.current.originDragY + delta))
  }

  const endDrag = (e) => {
    e?.stopPropagation?.()
    if (!dragRef.current.active) return
    if (e?.currentTarget?.hasPointerCapture?.(dragRef.current.pointerId)) {
      e.currentTarget.releasePointerCapture(dragRef.current.pointerId)
    }
    dragRef.current.active = false
    setIsDragging(false)
    const t = setTimeout(() => {
      userDraggingRef.current = false
    }, isGenerating ? 1200 : 0)
    timersRef.current.push(t)
  }

  const handleReplay = () => {
    clearFramedPreview()
    clearTimers()
    printStartedRef.current = false
    prevReadyCountRef.current = 0
    userDraggingRef.current = false
    setStripOut(false)
    setReadyMap({})
    setDragY(0)
    setIsDragging(false)
    setFocusIndex(-1)
    const t = setTimeout(() => {
      startPrint()
      sceneUrls.forEach((url, index) => {
        if (!url) return
        const delay = 500 + index * 380
        const tCell = setTimeout(() => {
          setReadyMap((prev) => ({ ...prev, [index]: url }))
        }, delay)
        timersRef.current.push(tCell)
      })
      const revealFramed = setTimeout(async () => {
        try {
          const blob = await ensureFramedBlob()
          void blob
          setShowFramed(true)
          setDragY(0)
          requestAnimationFrame(measureStrip)
        } catch {
          /* ignore */
        }
      }, 500 + SLOT_COUNT * 380 + 600)
      timersRef.current.push(revealFramed)
    }, 40)
    timersRef.current.push(t)
  }

  const handleDownload = async () => {
    if (isComposing) return
    setIsComposing(true)
    try {
      const blob = await ensureFramedBlob()
      setShowFramed(true)
      downloadImageBlob(blob, `posily-fourcut-${dateLabel || 'photo'}.png`)
      showToast('포실이네컷 이미지를 저장했어요.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error(error)
      showToast(error?.message || '이미지 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsComposing(false)
    }
  }

  const handleShare = async () => {
    if (isComposing) return
    setIsComposing(true)
    try {
      const blob = await ensureFramedBlob()
      setShowFramed(true)
      const method = await shareFourCutImageBlob(blob, { dateString: dateLabel })
      if (method === 'share') {
        showToast(
          '공유 메뉴에서 인스타그램을 선택해 주세요.',
          TOAST_TYPES.SUCCESS,
        )
      } else {
        showToast(
          '이미지가 저장되었습니다. 인스타그램 앱에서 스토리·피드에 올려 주세요.',
          TOAST_TYPES.SUCCESS,
        )
      }
    } catch (error) {
      if (error?.name === 'AbortError') return
      console.error(error)
      showToast(error?.message || '공유에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsComposing(false)
    }
  }

  const canShare = !isGenerating && (Boolean(sceneKey) || Boolean(fourCutUrl))

  if (!isOpen) return null

  const canClose = !isGenerating
  const phaseLabel = progress?.phase === 'planning'
    ? '일기 요약 중...'
    : progress
      ? `사진 인화 중 (${Math.min(progress.done, progress.total)}/${progress.total})`
      : '사진 인화 중...'

  const printOffset = (!isFramedView && !stripOut) ? -(stripHeight + 16) : 0
  const translateY = printOffset + dragY

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="닫기"
        onClick={canClose ? onClose : undefined}
      />

      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-[#f5f0e8] shadow-2xl"
        style={{ overscrollBehavior: 'none', touchAction: 'none' }}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={!canClose}
          aria-label="닫기"
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-stone-500 transition-colors hover:bg-stone-200/80 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ×
        </button>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5 pt-6">
          <p
            className="shrink-0 text-center text-3xl text-stone-800"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
          >
            today Mood
          </p>
          <p className="mt-2 shrink-0 text-center text-[11px] font-semibold tracking-[0.12em] text-stone-700">
            GET YOUR RECEIPTS IN HERE
          </p>
          {dateLabel ? (
            <p className="mt-1 shrink-0 text-center text-xs text-stone-500">{dateLabel}</p>
          ) : null}

          {isGenerating && (
            <p className="mt-3 shrink-0 text-center text-sm font-medium text-amber-900 font-sans">
              {phaseLabel}
            </p>
          )}
          {!isGenerating && isFramedView && (
            <p className="mt-3 shrink-0 text-center text-sm font-medium text-sky-800 font-sans">
              포실이네컷 완성!
            </p>
          )}

          <div className="relative z-20 mx-auto mt-4 w-[72%] max-w-[210px] shrink-0">
            <div className="h-4 rounded-md bg-gradient-to-b from-stone-200 to-stone-400 shadow-md ring-1 ring-stone-500/30" />
            <div className="absolute left-2 right-2 top-1/2 h-[2.5px] -translate-y-1/2 rounded-full bg-stone-800/80" />
          </div>

          <div
            ref={viewportRef}
            className={`relative z-10 mx-auto w-[72%] max-w-[210px] shrink-0 overflow-hidden select-none ${
              canDrag ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
            }`}
            style={{ height: activeViewportH, touchAction: 'none', overscrollBehavior: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div
              className="will-change-transform"
              style={{
                transform: `translate3d(0, ${translateY}px, 0)`,
                transition: isDragging || (!stripOut && !isFramedView)
                  ? (stripOut || isFramedView ? 'none' : `transform ${PRINT_MS}ms ${EASE}`)
                  : `transform 560ms ${EASE}`,
              }}
            >
              {isFramedView ? (
                <div ref={stripRef}>
                  <img
                    src={framedPreviewUrl}
                    alt="포실이네컷"
                    className="mx-auto block h-auto w-full object-contain pointer-events-none animate-[fourcut-fade_480ms_ease-out_forwards]"
                    draggable={false}
                    onLoad={measureStrip}
                  />
                </div>
              ) : (
                <div ref={stripRef} className="flex flex-col gap-2">
                  {Array.from({ length: SLOT_COUNT }, (_, index) => {
                    const readyUrl = readyMap[index]
                    const isFocused = focusIndex === index
                    return (
                      <div
                        key={`cell-${index}`}
                        ref={(el) => { cellRefs.current[index] = el }}
                        className={`relative w-full transition-transform duration-500 ease-out ${
                          isFocused ? 'z-10 scale-[1.05]' : 'scale-100'
                        }`}
                      >
                        {!readyUrl && (
                          <img
                            src={POSILI_PLACEHOLDER}
                            alt="포실이"
                            className={`mx-auto block h-auto w-[55%] object-contain pointer-events-none ${
                              isGenerating ? 'animate-pulse opacity-70' : 'opacity-40'
                            }`}
                            draggable={false}
                            onLoad={measureStrip}
                          />
                        )}
                        {readyUrl && (
                          <img
                            src={readyUrl}
                            alt={`장면 ${index + 1}`}
                            className={`mx-auto block h-auto w-full object-contain pointer-events-none rounded-sm animate-[fourcut-fade_480ms_ease-out_forwards] ${
                              isFocused ? 'ring-2 ring-amber-400/90 shadow-md' : ''
                            }`}
                            draggable={false}
                            onLoad={() => {
                              measureStrip()
                              if (!userDraggingRef.current) {
                                requestAnimationFrame(() => focusCell(index))
                              }
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {canDrag && (
            <p className="mt-2 shrink-0 text-center text-[11px] text-stone-500 font-sans">
              위아래로 드래그해서 전체를 볼 수 있어요
            </p>
          )}

          <div className="mt-5 flex shrink-0 flex-wrap justify-center gap-2">
            {!isGenerating && (sceneUrls.length > 0 || fourCutUrl) && (
              <button
                type="button"
                onClick={handleReplay}
                className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
              >
                다시보기
              </button>
            )}
            {canShare && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={isComposing}
                className="rounded-lg border border-stone-400 bg-white/90 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-white disabled:opacity-50"
              >
                {isComposing ? '준비 중...' : '이미지 저장'}
              </button>
            )}
            {canShare && (
              <button
                type="button"
                onClick={handleShare}
                disabled={isComposing}
                className="rounded-lg bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {isComposing ? '준비 중...' : '인스타 공유'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fourcut-fade {
          0% { opacity: 0; transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}