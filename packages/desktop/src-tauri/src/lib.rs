// 花钥桌面端 Tauri 入口
use tauri::Manager;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            // 根据系统主题选择图标（启动时检测一次）
            let is_dark = window.theme().map(|t| t == tauri::Theme::Dark).unwrap_or(false);
            let icon_bytes: &[u8] = if is_dark {
                include_bytes!("../icons/icon_dark.png")
            } else {
                include_bytes!("../icons/icon_light.png")
            };
            if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                let _ = window.set_icon(icon);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
