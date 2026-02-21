use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("manifest dir"));
    let methods_path = manifest_dir.join("../../packages/engine-protocol/src/methods.ts");
    println!("cargo:rerun-if-changed={}", methods_path.display());

    let methods_source = fs::read_to_string(&methods_path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", methods_path.display()));

    let entries = parse_methods(&methods_source);
    if entries.is_empty() {
        panic!(
            "no engine methods were discovered in {}",
            methods_path.display()
        );
    }

    let generated = render_methods_module(&entries);
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("out dir"));
    fs::write(out_dir.join("engine_methods_generated.rs"), generated)
        .expect("failed to write generated methods module");
}

fn parse_methods(source: &str) -> Vec<(String, String)> {
    let mut entries = Vec::new();
    let mut in_map = false;

    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("export const engineMethods") {
            in_map = true;
            continue;
        }
        if !in_map {
            continue;
        }
        if trimmed.starts_with("} as const") {
            break;
        }
        if trimmed.is_empty() || trimmed.starts_with("//") {
            continue;
        }

        let Some((variant_part, value_part)) = trimmed.split_once(':') else {
            continue;
        };

        let variant = variant_part.trim().trim_end_matches(',');
        if variant.is_empty() {
            continue;
        }

        let mut quote_parts = value_part.split('"');
        let _before = quote_parts.next();
        let Some(method_name) = quote_parts.next() else {
            continue;
        };

        entries.push((variant.to_string(), method_name.to_string()));
    }

    entries
}

fn render_methods_module(entries: &[(String, String)]) -> String {
    let enum_variants = entries
        .iter()
        .map(|(variant, _)| format!("    {variant},"))
        .collect::<Vec<_>>()
        .join("\n");

    let as_str_arms = entries
        .iter()
        .map(|(variant, method)| format!("            Self::{variant} => \"{method}\","))
        .collect::<Vec<_>>()
        .join("\n");

    let try_from_arms = entries
        .iter()
        .map(|(variant, method)| format!("            \"{method}\" => Ok(Self::{variant}),"))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        "#[derive(Debug, Clone, Copy, PartialEq, Eq)]\n\
pub enum EngineMethod {{\n\
{enum_variants}\n\
}}\n\n\
impl EngineMethod {{\n\
    pub const fn as_str(self) -> &'static str {{\n\
        match self {{\n\
{as_str_arms}\n\
        }}\n\
    }}\n\
}}\n\n\
impl TryFrom<&str> for EngineMethod {{\n\
    type Error = ();\n\n\
    fn try_from(value: &str) -> Result<Self, Self::Error> {{\n\
        match value {{\n\
{try_from_arms}\n\
            _ => Err(()),\n\
        }}\n\
    }}\n\
}}\n"
    )
}
