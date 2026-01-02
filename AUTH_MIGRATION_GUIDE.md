# 로그인 기능 추가 마이그레이션 가이드

기존 데이터에 `user_id`가 없는 상황에서 로그인 기능을 추가하는 방법을 안내합니다.

## 📋 개요

현재 데이터베이스의 대부분 테이블에 `user_id` 컬럼이 없습니다. 로그인 기능을 추가하려면:
1. 모든 테이블에 `user_id` 컬럼 추가
2. 기존 데이터에 `user_id` 할당
3. Row Level Security (RLS) 정책 설정
4. 프론트엔드에 인증 기능 추가

## 🚀 마이그레이션 단계

### 1단계: 데이터 백업

**중요**: 마이그레이션 전에 반드시 데이터베이스를 백업하세요.

```sql
-- Supabase 대시보드 > Database > Backups에서 백업 생성
-- 또는 pg_dump를 사용하여 로컬 백업
```

### 2단계: 마이그레이션 스크립트 실행

1. Supabase 대시보드 > SQL Editor로 이동
2. `supabase-auth-migration.sql` 파일의 내용을 복사하여 실행
3. 스크립트는 다음을 수행합니다:
   - 모든 테이블에 `user_id` 컬럼 추가
   - 외래 키 제약 조건 추가
   - 인덱스 생성
   - RLS 정책 설정
   - 기존 데이터 할당 함수 생성

### 3단계: 기존 데이터 할당

마이그레이션 스크립트 실행 후, 기존 데이터를 첫 번째 로그인한 사용자에게 할당해야 합니다.

#### 방법 1: 첫 번째 사용자에게 자동 할당 (권장)

프론트엔드에서 첫 로그인 시 자동으로 실행되도록 구현:

```javascript
// src/services/authService.js
import { supabase } from '../config/supabase.js'

export async function migrateExistingData() {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 기존 데이터가 있는지 확인
  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('id')
    .is('user_id', null)
    .limit(1)

  if (existingTasks && existingTasks.length > 0) {
    // 기존 데이터를 현재 사용자에게 할당
    const { error } = await supabase.rpc('assign_existing_data_to_user', {
      target_user_id: user.id
    })

    if (error) {
      console.error('데이터 마이그레이션 오류:', error)
      throw error
    }

    return { migrated: true }
  }

  return { migrated: false }
}
```

#### 방법 2: 수동 할당 (관리자)

Supabase SQL Editor에서 직접 실행:

```sql
-- 특정 사용자 ID로 기존 데이터 할당
SELECT assign_existing_data_to_user('사용자-UUID-여기');

-- 또는 현재 로그인한 사용자에게 할당
SELECT assign_existing_data_to_user(auth.uid());
```

### 4단계: user_id를 NOT NULL로 변경 (선택사항)

기존 데이터 마이그레이션이 완료된 후, `user_id`를 필수 필드로 만들 수 있습니다:

```sql
-- 각 테이블마다 실행
ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE work_reports ALTER COLUMN user_id SET NOT NULL;
-- ... (나머지 테이블도 동일하게)
```

**주의**: 이 단계는 모든 기존 데이터가 할당된 후에만 실행하세요.

## 🔐 프론트엔드 인증 구현

### 1. 인증 서비스 생성

`src/services/authService.js` 파일 생성:

```javascript
import { supabase } from '../config/supabase.js'
import { migrateExistingData } from './authService.js'

/**
 * 이메일/비밀번호로 회원가입
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  
  if (error) throw error
  
  // 첫 번째 사용자인 경우 기존 데이터 마이그레이션
  if (data.user) {
    try {
      await migrateExistingData()
    } catch (migrationError) {
      console.warn('데이터 마이그레이션 실패:', migrationError)
    }
  }
  
  return data
}

/**
 * 이메일/비밀번호로 로그인
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  
  // 첫 로그인 시 기존 데이터 마이그레이션 시도
  try {
    await migrateExistingData()
  } catch (migrationError) {
    console.warn('데이터 마이그레이션 실패:', migrationError)
  }
  
  return data
}

/**
 * 로그아웃
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * 현재 사용자 정보 가져오기
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

/**
 * 인증 상태 변경 감지
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
```

### 2. 인증 컨텍스트 생성

`src/contexts/AuthContext.jsx` 파일 생성:

```javascript
import { createContext, useContext, useState, useEffect } from 'react'
import { getCurrentUser, onAuthStateChange, signIn, signUp, signOut } from '../services/authService.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 초기 사용자 로드
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))

    // 인증 상태 변경 감지
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### 3. 로그인 컴포넌트 생성

`src/components/LoginForm.jsx` 파일 생성:

```javascript
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function LoginForm() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        await signUp(email, password)
        alert('회원가입이 완료되었습니다. 이메일을 확인하세요.')
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center">
          {isSignUp ? '회원가입' : '로그인'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
          </button>
        </form>
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-sm text-indigo-600 hover:text-indigo-500"
        >
          {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
        </button>
      </div>
    </div>
  )
}
```

### 4. App.jsx에 인증 통합

```javascript
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import LoginForm from './components/LoginForm.jsx'
// ... 기존 imports

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>로딩 중...</div>
  }

  if (!user) {
    return <LoginForm />
  }

  // 기존 앱 내용
  return (
    // ... 기존 JSX
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
```

## 📝 서비스 레이어 수정

모든 서비스 함수에서 `user_id`를 자동으로 포함하도록 수정:

```javascript
// 예시: src/services/taskService.js
import { supabase } from '../config/supabase.js'

export async function createTask(taskData) {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      ...taskData,
      user_id: user.id, // 자동으로 user_id 추가
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getTasks() {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // RLS 정책에 의해 자동으로 현재 사용자의 데이터만 조회됨
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('createdAt', { ascending: false })

  if (error) throw error
  return data || []
}
```

## ⚠️ 주의사항

1. **백업 필수**: 마이그레이션 전 반드시 데이터베이스를 백업하세요.
2. **단계별 실행**: 마이그레이션 스크립트를 단계별로 실행하고 각 단계를 확인하세요.
3. **테스트 환경**: 가능하면 먼저 테스트 환경에서 마이그레이션을 테스트하세요.
4. **RLS 정책**: RLS가 활성화되면 인증되지 않은 사용자는 데이터에 접근할 수 없습니다.
5. **기존 데이터**: `bucketlists` 테이블의 기존 `user_id` 값도 확인하고 필요시 업데이트하세요.

## 🔍 마이그레이션 확인

마이그레이션이 성공적으로 완료되었는지 확인:

```sql
-- user_id가 NULL인 데이터 확인
SELECT 'tasks' as table_name, COUNT(*) as null_count 
FROM tasks WHERE user_id IS NULL
UNION ALL
SELECT 'work_reports', COUNT(*) FROM work_reports WHERE user_id IS NULL
UNION ALL
SELECT 'diaries', COUNT(*) FROM diaries WHERE user_id IS NULL;
-- ... (나머지 테이블도 확인)

-- 모든 테이블의 user_id가 할당되었는지 확인
-- 결과가 모두 0이어야 합니다.
```

## 📚 참고 자료

- [Supabase Auth 문서](https://supabase.com/docs/guides/auth)
- [Row Level Security 가이드](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase 마이그레이션 가이드](https://supabase.com/docs/guides/database/migrations)

