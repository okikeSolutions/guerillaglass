use protocol_rust::{decode_request_line, encode_response_line, success, EngineMethod};
use serde_json::json;
use std::fs;
use std::path::PathBuf;

fn fixture_path(name: &str) -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.pop();
    path.pop();
    path.push("packages");
    path.push("engine");
    path.push("fixtures");
    path.push(name);
    path
}

#[test]
fn parses_engine_capabilities_fixture() {
    let fixture = fs::read_to_string(fixture_path("engine-capabilities.request.json"))
        .expect("read engine-capabilities fixture");
    let request = decode_request_line(&fixture).expect("decode fixture");

    assert_eq!(
        request.method_kind(),
        Some(EngineMethod::EngineCapabilities)
    );
    assert!(request.params.is_object());
}

#[test]
fn parses_project_save_fixture() {
    let fixture = fs::read_to_string(fixture_path("project-save.request.json"))
        .expect("read project-save fixture");
    let request = decode_request_line(&fixture).expect("decode fixture");

    assert_eq!(request.method_kind(), Some(EngineMethod::ProjectSave));
    assert_eq!(
        request.params["projectPath"].as_str(),
        Some("/tmp/fixture.gglassproj")
    );
}

#[test]
fn encodes_project_recents_response_fixture_shape() {
    let line = encode_response_line(&success(
        "2",
        json!({
            "items": [{
                "projectPath": "/tmp/fixture.gglassproj",
                "displayName": "fixture",
                "lastOpenedAt": "2026-02-19T10:00:00.000Z"
            }]
        }),
    ))
    .expect("encode response");
    let fixture = fs::read_to_string(fixture_path("project-recents.response.json"))
        .expect("read project-recents response fixture");
    let actual: serde_json::Value = serde_json::from_str(&line).expect("actual json");
    let expected: serde_json::Value = serde_json::from_str(&fixture).expect("fixture json");
    assert_eq!(actual, expected);
}

#[test]
fn parses_project_recents_request() {
    let fixture = fs::read_to_string(fixture_path("project-recents.request.json"))
        .expect("read project-recents fixture");
    let request = decode_request_line(&fixture).expect("decode recents request");

    assert_eq!(request.method_kind(), Some(EngineMethod::ProjectRecents));
    assert_eq!(request.params["limit"].as_u64(), Some(5));
}
