// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageBinary {
    bytes: Vec<u8>,
    content_type: Option<String>,
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
        .invoke_handler(tauri::generate_handler![read_image_binary, resolve_image_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
