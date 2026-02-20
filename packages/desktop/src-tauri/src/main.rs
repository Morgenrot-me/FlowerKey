// 花钥桌面端 Tauri 主程序
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    flowerkey_desktop_lib::run();
}
