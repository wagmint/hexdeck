use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    Manager,
};
use std::sync::atomic::{AtomicBool, Ordering};

#[tauri::command]
fn update_tray_icon(app: tauri::AppHandle, color: String) -> Result<(), String> {
    let icon_bytes: &[u8] = match color.as_str() {
        "green" => include_bytes!("../icons/icon-green.png"),
        "blue" => include_bytes!("../icons/icon-blue.png"),
        "yellow" => include_bytes!("../icons/icon-yellow.png"),
        "red" => include_bytes!("../icons/icon-red.png"),
        _ => include_bytes!("../icons/icon-grey.png"),
    };

    let image = Image::from_bytes(icon_bytes).map_err(|e| e.to_string())?;

    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_icon(Some(image)).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Hide from dock on macOS
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            // Create tray icon
            let grey_icon = Image::from_bytes(include_bytes!("../icons/icon-grey.png"))
                .expect("Failed to load tray icon");

            // Shared flag to suppress focus-loss hide right after tray click
            let tray_click_guard: &'static AtomicBool =
                Box::leak(Box::new(AtomicBool::new(false)));

            // Build right-click context menu
            let open_dashboard = MenuItem::with_id(app, "open_dashboard", "Open Dashboard", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_dashboard, &quit])?;

            let guard_for_tray = tray_click_guard;
            let _tray = tauri::tray::TrayIconBuilder::with_id("main-tray")
                .icon(grey_icon)
                .icon_as_template(false)
                .tooltip("Hexdeck")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                guard_for_tray.store(true, Ordering::SeqCst);
                                position_window_at_tray(&window, tray);
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "open_dashboard" => {
                            let _ = std::process::Command::new("open")
                                .arg("http://localhost:3002")
                                .spawn();
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Auto-hide on focus loss
            let guard_for_window = tray_click_guard;
            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(focused) = event {
                        if *focused {
                            // Window just received focus — clear the guard
                            guard_for_window.store(false, Ordering::SeqCst);
                        } else {
                            // Window lost focus — hide unless we just opened via tray click
                            if guard_for_window.swap(false, Ordering::SeqCst) {
                                return; // suppress this one focus-loss
                            }
                            let _ = w.hide();
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![update_tray_icon, quit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn position_window_at_tray(
    window: &tauri::WebviewWindow,
    tray: &tauri::tray::TrayIcon,
) {
    let Some(tray_rect) = tray.rect().ok().flatten() else {
        return;
    };

    // Extract physical coordinates from the Position/Size enums
    let (tray_x, tray_y) = match tray_rect.position {
        tauri::Position::Physical(p) => (p.x as f64, p.y as f64),
        tauri::Position::Logical(p) => (p.x, p.y),
    };
    let (tray_w, tray_h) = match tray_rect.size {
        tauri::Size::Physical(s) => (s.width as f64, s.height as f64),
        tauri::Size::Logical(s) => (s.width, s.height),
    };

    let Ok(window_size) = window.outer_size() else {
        return;
    };
    let window_width = window_size.width as f64;

    // Center window horizontally under the tray icon
    let x = tray_x + (tray_w / 2.0) - (window_width / 2.0);
    let y = tray_y + tray_h + 4.0;

    let _ = window.set_position(tauri::Position::Physical(
        tauri::PhysicalPosition {
            x: x as i32,
            y: y as i32,
        },
    ));
}
