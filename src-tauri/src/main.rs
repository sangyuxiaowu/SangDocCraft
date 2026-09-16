// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageBinary {
    bytes: Vec<u8>,
    content_type: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeDocumentFile {
    path: String,
    bytes: Vec<u8>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveDocumentRequest {
    path: Option<String>,
    suggested_name: String,
    bytes: Vec<u8>,
}

fn read_document_file(path: std::path::PathBuf) -> Result<NativeDocumentFile, String> {
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
    Ok(NativeDocumentFile {
        path: path.to_string_lossy().into_owned(),
        bytes,
    })
}

#[tauri::command]
async fn open_sdc_document() -> Result<Option<NativeDocumentFile>, String> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("SangDocCraft 文档", &["sdc"])
        .pick_file()
        .await;
    file.map(|handle| read_document_file(handle.path().to_path_buf())).transpose()
}

#[tauri::command]
async fn save_sdc_document(request: SaveDocumentRequest) -> Result<Option<String>, String> {
    let path = if let Some(path) = request.path {
        std::path::PathBuf::from(path)
    } else {
        let Some(handle) = rfd::AsyncFileDialog::new()
            .add_filter("SangDocCraft 文档", &["sdc"])
            .set_file_name(&request.suggested_name)
            .save_file()
            .await else { return Ok(None); };
        handle.path().to_path_buf()
    };
    std::fs::write(&path, request.bytes).map_err(|error| error.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn take_startup_document() -> Result<Option<NativeDocumentFile>, String> {
    let path = std::env::args_os().skip(1).map(std::path::PathBuf::from).find(|path| {
        path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("sdc")) && path.is_file()
    });
    path.map(read_document_file).transpose()
}

fn resolve_local_image_path(source: &str) -> Result<std::path::PathBuf, String> {
    let direct_path = std::path::PathBuf::from(source);
    if direct_path.exists() {
        return Ok(direct_path);
    }

    let project_relative_path = source.trim_start_matches("../").trim_start_matches("./");
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    for directory in current_dir.ancestors() {
        let candidate = directory.join(project_relative_path);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!("Image file not found: {source}"))
}

#[tauri::command]
fn resolve_image_path(source: String) -> Result<String, String> {
    if source.starts_with("http://") || source.starts_with("https://") || source.starts_with("data:") || source.starts_with("blob:") {
        return Ok(source);
    }

    let path = if source.starts_with("file://") {
        url::Url::parse(&source)
            .map_err(|error| error.to_string())?
            .to_file_path()
            .map_err(|_| "Invalid local image path".to_string())?
    } else {
        resolve_local_image_path(&source)?
    };
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn read_image_binary(source: String) -> Result<ImageBinary, String> {
    if source.starts_with("http://") || source.starts_with("https://") {
        let response = reqwest::get(&source).await.map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned);
        let bytes = response.bytes().await.map_err(|error| error.to_string())?.to_vec();
        return Ok(ImageBinary { bytes, content_type });
    }

    let path = if source.starts_with("file://") {
        url::Url::parse(&source)
            .map_err(|error| error.to_string())?
            .to_file_path()
            .map_err(|_| "Invalid local image path".to_string())?
    } else {
        resolve_local_image_path(&source)?
    };
    let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
    Ok(ImageBinary { bytes, content_type: None })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            open_sdc_document,
            read_image_binary,
            resolve_image_path,
            save_sdc_document,
            take_startup_document,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
