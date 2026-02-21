use native_foundation::{run_engine, EngineRuntimeConfig};
use std::env;
use std::path::PathBuf;

fn default_recents_index_path() -> PathBuf {
    if let Some(app_data) = env::var_os("APPDATA") {
        return PathBuf::from(app_data)
            .join("guerillaglass")
            .join("Library")
            .join("library.native.json");
    }
    if let Some(user_profile) = env::var_os("USERPROFILE") {
        return PathBuf::from(user_profile)
            .join("AppData")
            .join("Roaming")
            .join("guerillaglass")
            .join("Library")
            .join("library.native.json");
    }
    PathBuf::from("guerillaglass-library.native.json")
}

fn main() {
    run_engine(EngineRuntimeConfig {
        platform: "windows",
        recents_index_path: default_recents_index_path(),
    });
}
