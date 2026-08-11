import { useCallback, useEffect, useState } from 'react'
import { LEDGER_TABS } from '../../constants/ledger.js'
import { bootstrapLedger } from '../../services/ledgerService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import LedgerTransactionModal from './LedgerTransactionModal.jsx'
import LedgerHomeTab from './LedgerHomeTab.jsx'
import LedgerHistoryTab from './LedgerHistoryTab.jsx'
import LedgerAnalysisTab from './LedgerAnalysisTab.jsx'
import LedgerAssetsTab from './LedgerAssetsTab.jsx'
import LedgerInvestmentTab from './LedgerInvestmentTab.jsx'

/**
 * 가계부 메인 뷰 — 상단 탭, 각 화면에서 추가
 */
export default function LedgerView() {
  const [activeTab, setActiveTab] = useState('home')
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)

  const loadBootstrap = useCallback(async () => {
    try {
      setLoading(true)
      const data = await bootstrapLedger()
      setCategories(data.categories)
      setAccounts(data.accounts)
    } catch (error) {
      showToast(error.message || '가계부 데이터를 불러오지 못했어요.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBootstrap()
  }, [loadBootstrap])

  const handleRefresh = async () => {
    setRefreshKey((k) => k + 1)
    try {
      const data = await bootstrapLedger()
      setCategories(data.categories)
      setAccounts(data.accounts)
    } catch (error) {
      showToast(error.message || '데이터를 새로고침하지 못했어요.', TOAST_TYPES.ERROR)
    }
  }

  const openAddModal = (type = null) => {
    setEditingTransaction(null)
    setModalType(type)
    setModalOpen(true)
  }

  const openEditModal = (transaction) => {
    setEditingTransaction(transaction)
    setModalType(transaction.type)
    setModalOpen(true)
  }

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col relative overflow-x-hidden w-full">
      <div className="mb-4 px-1 shrink-0">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-1">가계부</h1>
        <p className="text-base text-gray-600 font-sans">
          소비를 기록하고, 이전 기간과 비교해 보세요
        </p>
      </div>

      <nav className="mb-4 px-1 shrink-0 w-full overflow-x-hidden">
        <div className="flex w-full gap-1 bg-white rounded-xl border border-gray-200 shadow-sm p-1">
          {LEDGER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-0 py-2.5 px-1 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-x-hidden rounded-2xl bg-white/80 backdrop-blur-sm border border-white/60 shadow-sm px-4 py-5 sm:px-6">
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0">
          {loading && categories.length === 0 ? (
            <p className="text-gray-500 py-10 text-center">불러오는 중…</p>
          ) : (
            <>
              {activeTab === 'home' && (
                <LedgerHomeTab refreshKey={refreshKey} />
              )}
              {activeTab === 'history' && (
                <LedgerHistoryTab
                  refreshKey={refreshKey}
                  categories={categories}
                  accounts={accounts}
                  onAddTransaction={() => openAddModal()}
                  onEditTransaction={openEditModal}
                  onChanged={handleRefresh}
                />
              )}
              {activeTab === 'assets' && (
                <LedgerAssetsTab
                  refreshKey={refreshKey}
                  onChanged={handleRefresh}
                />
              )}
              {activeTab === 'investment' && (
                <LedgerInvestmentTab
                  refreshKey={refreshKey}
                  onChanged={handleRefresh}
                />
              )}
              {activeTab === 'analysis' && (
                <LedgerAnalysisTab refreshKey={refreshKey} />
              )}
            </>
          )}
        </div>
      </div>

      <LedgerTransactionModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingTransaction(null)
        }}
        onSaved={handleRefresh}
        categories={categories}
        accounts={accounts}
        initialType={modalType}
        editingTransaction={editingTransaction}
      />
    </div>
  )
}
