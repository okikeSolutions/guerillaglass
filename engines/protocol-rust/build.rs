use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("manifest dir"));
    let rpcs_path = manifest_dir.join("../../packages/engine/src/protocol/rpc/group.ts");
    println!("cargo:rerun-if-changed={}", rpcs_path.display());

    let rpcs_source = fs::read_to_string(&rpcs_path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", rpcs_path.display()));

    let entries = parse_rpcs(&rpcs_source);
    if entries.is_empty() {
        panic!("no engine RPCs were discovered in {}", rpcs_path.display());
    }

    let generated = render_methods_module(&entries);
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("out dir"));
    fs::write(out_dir.join("engine_methods_generated.rs"), generated)
        .expect("failed to write generated methods module");
}

fn parse_rpcs(source: &str) -> Vec<(String, String)> {
    let mut entries = Vec::new();
    let mut pending_variant: Option<String> = None;

    for line in source.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("export class ") {
            let Some((variant, after_variant)) = rest
                .split_once(" extends rpc(")
                .or_else(|| rest.split_once(" extends streamRpc("))
            else {
                continue;
            };
            pending_variant = Some(variant.trim().to_string());
            if let Some(method_name) = first_quoted_string(after_variant) {
                entries.push((
                    pending_variant.take().expect("pending variant"),
                    method_name,
                ));
            }
            continue;
        }

        if let Some(variant) = pending_variant.take() {
            if let Some(method_name) = first_quoted_string(trimmed) {
                entries.push((variant, method_name));
            } else {
                pending_variant = Some(variant);
            }
        }
    }

    entries
}

fn first_quoted_string(source: &str) -> Option<String> {
    let mut quote_parts = source.split('"');
    let _before = quote_parts.next();
    quote_parts.next().map(str::to_string)
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
