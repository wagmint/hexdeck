use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Serialize, Deserialize, Clone)]
struct WidgetPosition {
    x: f64,
    y: f64,
}

#[derive(Serialize, Deserialize, Clone)]
struct WidgetSettings {
    show_widget: bool,
}

fn position_file() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".hexdeck").join("widget-position.json"))
}

fn settings_file() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".hexdeck").join("menubar-settings.json"))
}

fn load_widget_visibility() -> bool {
    let Some(path) = settings_file() else {
        return true;
    };
    let Ok(data) = fs::read_to_string(path) else {
        return true;
    };
    let Ok(settings) = serde_json::from_str::<WidgetSettings>(&data) else {
        return true;
    };
    settings.show_widget
}

fn save_widget_visibility(show_widget: bool) -> Result<(), String> {
    let path = settings_file().ok_or("Cannot resolve home directory")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(&WidgetSettings { show_widget }).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn apply_widget_visibility(app: &tauri::AppHandle, show_widget: bool) {
    if let Some(widget) = app.get_webview_window("widget") {
        if show_widget {
            let _ = widget.show();
            let _ = widget.set_focus();
        } else {
            let _ = widget.hide();
        }
    }
}

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
fn save_widget_position(x: f64, y: f64) -> Result<(), String> {
    let path = position_file().ok_or("Cannot resolve home directory")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(&WidgetPosition { x, y }).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_widget_position() -> Option<WidgetPosition> {
    let path = position_file()?;
    let data = fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn toggle_main_window_from_tray(
    app: &tauri::AppHandle,
    tray: &tauri::tray::TrayIcon,
    tray_click_guard: &AtomicBool,
) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            tray_click_guard.store(true, Ordering::SeqCst);
            position_window_at_tray(&window, tray);
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn toggle_main_window_from_shortcut(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_main_window_from_shortcut(app);
                    }
                })
                .build(),
        )
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
            let show_widget_flag: &'static AtomicBool =
                Box::leak(Box::new(AtomicBool::new(load_widget_visibility())));

            // Build right-click context menu
            let show_widget_item = CheckMenuItem::with_id(
                app,
                "toggle_widget",
                "Show Floating Widget",
                true,
                show_widget_flag.load(Ordering::SeqCst),
                None::<&str>,
            )?;
            let shortcut_hint = MenuItem::with_id(
                app,
                "shortcut_hint",
                "Toggle Popup  (Cmd+Ctrl+H)",
                false,
                None::<&str>,
            )?;
            let open_dashboard = MenuItem::with_id(app, "open_dashboard", "Open Dashboard", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_widget_item, &shortcut_hint, &open_dashboard, &quit])?;

            let guard_for_tray = tray_click_guard;
            let toggle_widget_menu_item = show_widget_item.clone();
            let widget_flag_for_menu = show_widget_flag;
            let _tray = tauri::tray::TrayIconBuilder::with_id("main-tray")
                .icon(grey_icon)
                .icon_as_template(false)
                .tooltip("Hexdeck")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        toggle_main_window_from_tray(&app, tray, guard_for_tray);
                    }
                })
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "toggle_widget" => {
                            let next = !widget_flag_for_menu.load(Ordering::SeqCst);
                            widget_flag_for_menu.store(next, Ordering::SeqCst);
                            let _ = toggle_widget_menu_item.set_checked(next);
                            let _ = save_widget_visibility(next);
                            apply_widget_visibility(app, next);
                        }
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

            // Global shortcut: Cmd+Ctrl+H (short, still uncommon).
            let shortcut = Shortcut::new(
                Some(Modifiers::SUPER | Modifiers::CONTROL),
                Code::KeyH,
            );
            app.global_shortcut().register(shortcut)?;

            // Auto-hide main window on focus loss
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

            // Show/hide widget based on persisted setting.
            // When shown, briefly focus to activate macOS mouse tracking.
            apply_widget_visibility(&app.handle().clone(), show_widget_flag.load(Ordering::SeqCst));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_tray_icon,
            save_widget_position,
            load_widget_position,
            quit_app
        ])
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
