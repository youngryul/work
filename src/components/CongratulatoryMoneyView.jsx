import { useState } from 'react'
import CongratulatoryMoneyRecordTab from './congratulatory/CongratulatoryMoneyRecordTab.jsx'
import WeddingInvitationTab from './congratulatory/WeddingInvitationTab.jsx'
import MoneyRecipientTab from './congratulatory/MoneyRecipientTab.jsx'

/**
 * 경조사 기록 메인 뷰 컴포넌트
 * 탭 형식으로 축의금/부조금 기록, 청첩장 인원, 축의금 받은 기록을 관리
 */
export default function CongratulatoryMoneyView() {
  const [activeTab, setActiveTab] = useState('records') // 'records' | 'invitations' | 'recipients'

  return (
      <div className="max-w-6xl mx-auto h-full flex flex-col">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-4xl font-handwriting text-gray-800 mb-2">경조사 기록</h1>
          <p className="text-lg text-gray-600 font-sans">축의금, 부조금 기록과 청첩장 인원을 관리하세요</p>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
          <button
              onClick={() => setActiveTab('records')}
              className={`px-6 py-3 font-semibold transition-colors ${
                  activeTab === 'records'
                      ? 'border-b-2 border-pink-500 text-pink-600'
                      : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            축의금/부조금 기록
          </button>
          <button
              onClick={() => setActiveTab('invitations')}
              className={`px-6 py-3 font-semibold transition-colors ${
                  activeTab === 'invitations'
                      ? 'border-b-2 border-pink-500 text-pink-600'
                      : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            청첩장 인원
          </button>
          <button
              onClick={() => setActiveTab('recipients')}
              className={`px-6 py-3 font-semibold transition-colors ${
                  activeTab === 'recipients'
                      ? 'border-b-2 border-pink-500 text-pink-600'
                      : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            축의금 받은 기록
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'records' && <CongratulatoryMoneyRecordTab />}
          {activeTab === 'invitations' && <WeddingInvitationTab />}
          {activeTab === 'recipients' && <MoneyRecipientTab />}
        </div>
      </div>
  )
}
