use protocol_rust::{decode_request_line, EngineMethod};
use std::fs;
use std::path::PathBuf;

fn fixture_path(name: &str) -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.pop();
    path.pop();
    path.push("packages");
    path.push("engine-protocol");
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
fn parses_project_recents_request() {
    let fixture = fs::read_to_string(fixture_path("project-recents.request.json"))
        .expect("read project-recents fixture");
    let request = decode_request_line(&fixture).expect("decode recents request");

    assert_eq!(request.method_kind(), Some(EngineMethod::ProjectRecents));
    assert_eq!(request.params["limit"].as_u64(), Some(5));
}
