import { useEffect, useMemo, useRef, useState } from "react";
import "./pet.css";
import {
  createTask,
  deleteTask,
  getTodayTasks,
  updateTask,
} from "./services/taskService.js";
import { supabase } from "./config/supabase.js";

const PET_GIF = {
  idle: "/potato-buddy/idle.gif",
  hover: "/potato-buddy/hover.gif",
  click: "/potato-buddy/click.gif",
  sleep: "/potato-buddy/sleep.gif",
  remind: "/potato-buddy/remind.gif",
};

async function getCurrentTauriWindow() {
  if (!window.__TAURI_INTERNALS__) {
    return null;
  }
  const [{ getCurrentWindow }, { LogicalPosition }] = await Promise.all([
    import("@tauri-apps/api/window"),
    import("@tauri-apps/api/dpi"),
  ]);
  return { appWindow: getCurrentWindow(), LogicalPosition };
}

async function openDetailWindow() {
  if (!window.__TAURI_INTERNALS__) {
    return;
  }

  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const label = "posily-detail-window";
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return;
  }

  const detailUrl = `${window.location.origin}?tauriMode=pet&detail=1`;
  new WebviewWindow(label, {
    title: "포실이 상세",
    url: detailUrl,
    width: 420,
    height: 620,
    resizable: true,
    transparent: false,
    alwaysOnTop: true,
    center: true,
  });
}

async function openLoginWindow() {
  try {
    if (window.__TAURI_INTERNALS__) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_login_window");
      return;
    }
    window.location.href = `${window.location.origin}/?forceLogin=1`;
  } catch (error) {
    console.error("로그인 창 열기 실패:", error);
    window.location.href = `${window.location.origin}/?forceLogin=1`;
  }
}

function PetApp() {
  const isDetailMode = useMemo(
    () => new URLSearchParams(window.location.search).get("detail") === "1",
    []
  );

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
  const [petState, setPetState] = useState("idle");
  const [isPetImageOk, setIsPetImageOk] = useState(true);
  const [todoInput, setTodoInput] = useState("");
  const [todos, setTodos] = useState([]);
  const [isLoadingTodos, setIsLoadingTodos] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const clickTimerRef = useRef(null);
  const dragInfoRef = useRef({
    active: false,
    moved: false,
    startCursorX: 0,
    startCursorY: 0,
    startWindowX: 0,
    startWindowY: 0,
  });

  const remainingCount = useMemo(
    () => todos.filter((todo) => !todo.done).length,
    [todos]
  );
  const hasReminder = remainingCount > 0;
  const petImageSrc = useMemo(() => {
    if (hasReminder && !isPanelOpen) {
      return PET_GIF.remind;
    }
    if (petState === "hover") {
      return PET_GIF.hover;
    }
    if (petState === "click") {
      return PET_GIF.click;
    }
    if (petState === "sleep") {
      return PET_GIF.sleep;
    }
    return PET_GIF.idle;
  }, [hasReminder, isPanelOpen, petState]);

  const loadTodayTodos = async () => {
    setIsLoadingTodos(true);
    try {
      const todayTasks = await getTodayTasks();
      const mapped = (todayTasks || []).map((task) => ({
        id: task.id,
        text: task.title || "",
        done: !!task.completed,
      }));
      setTodos(mapped);
    } catch (error) {
      console.error("펫 오늘 할일 조회 실패:", error);
      setTodos([]);
    } finally {
      setIsLoadingTodos(false);
    }
  };

  const refreshAuthStatus = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(!!data.session?.user);
    } catch (_) {
      setIsAuthenticated(false);
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    refreshAuthStatus();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
      setIsAuthLoading(false);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadTodayTodos();
    } else {
      setTodos([]);
      setIsLoadingTodos(false);
    }
  }, [isAuthenticated]);

  const addTodo = async () => {
    const normalized = todoInput.trim();
    if (!normalized) {
      return;
    }
    try {
      const created = await createTask(normalized, null, true);
      if (created) {
        setTodos((prev) => [
          ...prev,
          { id: created.id, text: created.title || normalized, done: !!created.completed },
        ]);
      }
      setTodoInput("");
    } catch (error) {
      console.error("펫 오늘 할일 추가 실패:", error);
    }
  };

  const toggleTodo = async (id) => {
    const target = todos.find((todo) => todo.id === id);
    if (!target) {
      return;
    }
    const nextDone = !target.done;
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, done: nextDone } : todo))
    );
    try {
      await updateTask(id, { completed: nextDone });
    } catch (error) {
      console.error("펫 오늘 할일 완료 상태 변경 실패:", error);
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, done: target.done } : todo))
      );
    }
  };

  const removeTodo = async (id) => {
    const backup = todos;
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
    try {
      await deleteTask(id);
    } catch (error) {
      console.error("펫 오늘 할일 삭제 실패:", error);
      setTodos(backup);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      addTodo();
    }
  };

  useEffect(() => {
    if (isPanelOpen) {
      setPetState("idle");
      return;
    }
    const timer = setTimeout(() => {
      setPetState("sleep");
    }, 20000);
    return () => clearTimeout(timer);
  }, [isPanelOpen, todos.length]);

  const handleSingleClick = () => {
    if (dragInfoRef.current.moved) {
      return;
    }

    setIsPanelOpen((prevPanelOpen) => {
      const nextPanelOpen = !prevPanelOpen;
      // 패널을 열면 말풍선(텍스트)은 숨기고, 닫으면 다시 말풍선만 표시
      setIsBubbleOpen(!nextPanelOpen);
      return nextPanelOpen;
    });
    setPetState("click");
    window.setTimeout(() => setPetState("idle"), 280);
  };

  const handleClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    clickTimerRef.current = window.setTimeout(() => {
      handleSingleClick();
      clickTimerRef.current = null;
    }, 220);
  };

  const handleDoubleClick = async () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    await openDetailWindow();
  };

  const onPointerDown = async (event) => {
    if (isDetailMode || event.button !== 0) {
      return;
    }
    dragInfoRef.current = {
      active: true,
      moved: false,
      startCursorX: event.screenX,
      startCursorY: event.screenY,
      startWindowX: 0,
      startWindowY: 0,
    };

    const tauriWindow = await getCurrentTauriWindow();
    if (!tauriWindow) {
      return;
    }
    // Tauri 표준 드래그 (Windows에서도 가장 확실)
    try {
      await tauriWindow.appWindow.startDragging();
    } catch (_) {
      // ignore
    }
  };

  const onPointerMove = async (event) => {
    if (isDetailMode || !dragInfoRef.current.active) {
      return;
    }
    const diffX = event.screenX - dragInfoRef.current.startCursorX;
    const diffY = event.screenY - dragInfoRef.current.startCursorY;
    if (Math.abs(diffX) > 3 || Math.abs(diffY) > 3) {
      dragInfoRef.current.moved = true;
    }
  };

  const onPointerUp = async () => {
    if (isDetailMode || !dragInfoRef.current.active) {
      return;
    }

    dragInfoRef.current.active = false;
  };

  if (isDetailMode) {
    return (
      <div className="detail-root">
        <header className="detail-header">
          <strong>포실이 할 일 목록</strong>
          <span>{remainingCount}개 남음</span>
        </header>
        <div className="todo-input-row">
          <input
            value={todoInput}
            onChange={(event) => setTodoInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="할 일을 입력해요"
          />
          <button onClick={addTodo}>추가</button>
        </div>
        <ul className="todo-list detail-list">
          {todos.map((todo) => (
            <li key={todo.id} className={todo.done ? "done" : ""}>
              <label>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleTodo(todo.id)}
                />
                <span>{todo.text}</span>
              </label>
              <button onClick={() => removeTodo(todo.id)}>x</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (isAuthLoading) {
    return (
      <div className="pet-root auth-only-view">
        <div className="auth-gate-card no-drag">로그인 상태 확인 중...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="pet-root auth-only-view">
        <div className="auth-gate-card no-drag">
          <div className="auth-gate-title">포실이를 보려면 로그인 필요</div>
          <button className="pet-login-btn no-drag" onClick={openLoginWindow}>
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pet-root" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <div className="pet-shell">
        {isBubbleOpen && (
          <div className="speech-bubble no-drag">
            {remainingCount > 0
              ? `할 일 ${remainingCount}개가 남아있어요!`
              : "오늘 할 일을 추가해볼까요?"}
          </div>
        )}
        {isPanelOpen && (
          <div className="todo-panel no-drag">
            <div className="todo-header">
              <strong>오늘 할 일</strong>
              <span>{remainingCount}개 남음</span>
            </div>

            <div className="todo-input-row">
              <input
                value={todoInput}
                onChange={(event) => setTodoInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="할 일을 입력해요"
              />
              <button onClick={addTodo}>추가</button>
            </div>

            <ul className="todo-list">
              {isLoadingTodos && <li>불러오는 중...</li>}
              {todos.map((todo) => (
                <li key={todo.id} className={todo.done ? "done" : ""}>
                  <label>
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => toggleTodo(todo.id)}
                    />
                    <span>{todo.text}</span>
                  </label>
                  <button onClick={() => removeTodo(todo.id)}>x</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          className="pet-avatar"
          data-tauri-drag-region
          onPointerDown={onPointerDown}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseEnter={() => setPetState("hover")}
          onMouseLeave={() => setPetState(isPanelOpen ? "idle" : "sleep")}
          aria-label="할 일 패널 열기"
        >
          <img
            src={encodeURI(petImageSrc)}
            alt="포실이"
            className="pet-face"
            onLoad={() => setIsPetImageOk(true)}
            onError={(event) => {
              setIsPetImageOk(false);
            }}
          />
          {!isPetImageOk && <span className="pet-fallback">🐶</span>}
          {hasReminder && <span className="pet-badge">{remainingCount}</span>}
        </button>
      </div>

    </div>
  );
}

export default PetApp;
