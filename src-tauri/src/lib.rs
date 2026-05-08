use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn open_login_window(app: tauri::AppHandle) -> Result<(), String> {
  let label = "posily-login-window";

  if let Some(window) = app.get_webview_window(label) {
    window
      .show()
      .map_err(|e| format!("show failed: {e}"))?;
    window
      .set_focus()
      .map_err(|e| format!("focus failed: {e}"))?;
    return Ok(());
  }

  WebviewWindowBuilder::new(
    &app,
    label,
    WebviewUrl::App("/?forceLogin=1".into()),
  )
  .title("포실이 로그인")
  .inner_size(1200.0, 820.0)
  .resizable(true)
  .center()
  .build()
  .map_err(|e| format!("window build failed: {e}"))?;

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![open_login_window])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
