import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import AnnouncementManagement from './AnnouncementManagement.jsx'
import UserStatistics from './UserStatistics.jsx'
import DataStatistics from './DataStatistics.jsx'
import UserRoleManagement from './UserRoleManagement.jsx'

/**
 * 관리자 대시보드 컴포넌트 (admin 역할만 접근 가능)
 */
export default function AdminDashboard() {
  const { user, loading: authLoading, isAdmin: isAdminUser } = useAuth()
  const [activeTab, setActiveTab] = useState('announcements') // 'announcements' | 'users' | 'data' | 'roles'

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-2xl text-gray-500 font-sans">로딩 중...</div>
        </div>
      </div>
    )
  }

  if (!user || !isAdminUser) {
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
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors font-sans ${
              activeTab === 'roles'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            권한 관리
          </button>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'announcements' && <AnnouncementManagement />}
      {activeTab === 'users' && <UserStatistics />}
      {activeTab === 'data' && <DataStatistics />}
      {activeTab === 'roles' && <UserRoleManagement />}
    </div>
  )
}
