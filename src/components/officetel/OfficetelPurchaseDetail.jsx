import { useState } from 'react'
import OfficetelPurchaseCostTab from './OfficetelPurchaseCostTab.jsx'
import OfficetelTenantTab from './OfficetelTenantTab.jsx'

/**
 * 오피스텔 매물 상세 - 탭으로 매매 비용 / 임차인 관리 전환
 * @param {{ purchase: Object, onTotalsChange?: () => void }} props
 */
export default function OfficetelPurchaseDetail({ purchase, onTotalsChange }) {
  const [activeTab, setActiveTab] = useState('cost') // 'cost' | 'tenant'

  return (
    <div>
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('cost')}
          className={`px-4 py-2 text-sm font-medium font-sans transition-colors ${
            activeTab === 'cost'
              ? 'border-b-2 border-amber-500 text-amber-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          매매 비용
        </button>
        <button
          onClick={() => setActiveTab('tenant')}
          className={`px-4 py-2 text-sm font-medium font-sans transition-colors ${
            activeTab === 'tenant'
              ? 'border-b-2 border-amber-500 text-amber-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          임차인 관리
        </button>
      </div>

      {activeTab === 'cost' && <OfficetelPurchaseCostTab purchase={purchase} onTotalsChange={onTotalsChange} />}
      {activeTab === 'tenant' && <OfficetelTenantTab purchaseId={purchase.id} />}
    </div>
  )
}
