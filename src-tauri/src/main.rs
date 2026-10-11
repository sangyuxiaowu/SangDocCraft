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
async fn open_sdc_document_by_path(path: String) -> Result<Option<NativeDocumentFile>, String> {
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.is_file() {
        return Ok(None);
    }
    read_document_file(path_buf).map(Some)
}

#[tauri::command]
async fn save_sdc_document(request: SaveDocumentRequest) -> Result<Option<String>, DocumentSaveError> {
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
    std::fs::write(&path, request.bytes).map_err(|error| document_save_error(&path, error))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentSaveError {
    code: &'static str,
    message: String,
    path: String,
}

fn document_save_error(path: &std::path::Path, error: std::io::Error) -> DocumentSaveError {
    let read_only = std::fs::metadata(path)
        .map(|metadata| metadata.is_file() && metadata.permissions().readonly())
        .unwrap_or(false);
    let code = if cfg!(windows) && matches!(error.raw_os_error(), Some(32) | Some(33)) {
        "file_in_use"
    } else if error.kind() == std::io::ErrorKind::PermissionDenied && read_only {
        "read_only"
    } else if error.kind() == std::io::ErrorKind::PermissionDenied {
        "permission_denied"
    } else {
        "io_error"
    };
    DocumentSaveError {
        code,
        message: error.to_string(),
        path: path.to_string_lossy().into_owned(),
    }
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

#[tauri::command]
fn set_window_title(window: tauri::Window, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            open_sdc_document,
            open_sdc_document_by_path,
            read_image_binary,
            resolve_image_path,
            save_sdc_document,
            set_window_title,
            take_startup_document,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_read_only_save_failure_without_changing_permissions() {
        let path = std::env::temp_dir().join(format!("sangdoccraft-readonly-{}.sdc", std::process::id()));
        std::fs::write(&path, b"original").unwrap();
        let permissions = std::fs::metadata(&path).unwrap().permissions();
        let mut read_only = permissions.clone();
        read_only.set_readonly(true);
        std::fs::set_permissions(&path, read_only).unwrap();
        let error = document_save_error(&path, std::io::Error::from(std::io::ErrorKind::PermissionDenied));
        assert_eq!(error.code, "read_only");
        assert!(std::fs::metadata(&path).unwrap().permissions().readonly());
        assert_eq!(std::fs::read(&path).unwrap(), b"original");
        std::fs::set_permissions(&path, permissions).unwrap();
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn preserves_unknown_errors() {
        let error = document_save_error(std::path::Path::new("missing.sdc"), std::io::Error::from(std::io::ErrorKind::NotFound));
        assert_eq!(error.code, "io_error");
        assert!(!error.message.is_empty());
    }
}
