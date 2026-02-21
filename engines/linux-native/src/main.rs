use native_foundation::{run_engine, EngineRuntimeConfig};
use std::env;
use std::path::PathBuf;

fn default_recents_index_path() -> PathBuf {
    if let Some(data_home) = env::var_os("XDG_DATA_HOME") {
        return PathBuf::from(data_home)
            .join("guerillaglass")
            .join("Library")
            .join("library.native.json");
    }
    if let Some(home) = env::var_os("HOME") {
        return PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("guerillaglass")
            .join("Library")
            .join("library.native.json");
    }
    PathBuf::from("guerillaglass-library.native.json")
}

fn main() {
    run_engine(EngineRuntimeConfig {
        platform: "linux",
        recents_index_path: default_recents_index_path(),
    });
}
