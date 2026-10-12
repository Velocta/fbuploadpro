// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    println!("FBUploadPro Desktop Shell (Tauri v2)");
}
