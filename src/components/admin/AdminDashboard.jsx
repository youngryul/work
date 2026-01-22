import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { isAdmin } from '../../services/adminService.js'
import AnnouncementManagement from './AnnouncementManagement.jsx'
import UserStatistics from './UserStatistics.jsx'
import DataStatistics from './DataStatistics.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 관리자 대시보드 컴포넌트
 */
export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth()
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [activeTab, setActiveTab] = useState('announcements') // 'announcements' | 'users' | 'data'

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdminUser(false)
        setCheckingAdmin(false)
        return
      }

      try {
        const admin = await isAdmin(user.id)
        setIsAdminUser(admin)
        if (!admin) {
          showToast('관리자 권한이 필요합니다.', TOAST_TYPES.ERROR)
        }
      } catch (error) {
        console.error('관리자 권한 확인 실패:', error)
        setIsAdminUser(false)
        showToast('관리자 권한 확인에 실패했습니다.', TOAST_TYPES.ERROR)
      } finally {
        setCheckingAdmin(false)
      }
    }

    if (!authLoading) {
      checkAdminStatus()
    }
  }, [user, authLoading])

  if (authLoading || checkingAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-2xl text-gray-500 font-sans">로딩 중...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
          <p className="text-base text-red-800 font-sans">로그인이 필요합니다.</p>
        </div>
      </div>
    )
  }

  if (!isAdminUser) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
          <p className="text-base text-red-800 font-sans">관리자 권한이 필요합니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-800 font-sans">🔐 관리자 대시보드</h1>
        <p className="text-base text-gray-600 font-sans mb-4">
          공지사항, 사용자, 데이터 통계를 관리할 수 있습니다.
        </p>

        {/* 탭 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors font-sans ${
              activeTab === 'announcements'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            공지사항 관리
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors font-sans ${
              activeTab === 'users'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            사용자 통계
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors font-sans ${
              activeTab === 'data'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            데이터 통계
          </button>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'announcements' && <AnnouncementManagement />}
      {activeTab === 'users' && <UserStatistics />}
      {activeTab === 'data' && <DataStatistics />}
    </div>
  )
}
