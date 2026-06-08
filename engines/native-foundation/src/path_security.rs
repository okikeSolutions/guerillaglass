use std::fs::{self, OpenOptions};
use std::io::{self, Write};
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Component, Path, PathBuf};

fn symlink_error(path: &Path) -> io::Error {
    io::Error::new(
        io::ErrorKind::PermissionDenied,
        format!("symlink path component is not allowed: {}", path.display()),
    )
}

fn reject_if_symlink(path: &Path) -> io::Result<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(symlink_error(path)),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

fn reject_symlink_components(path: &Path) -> io::Result<()> {
    let mut current = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => current.push(prefix.as_os_str()),
            Component::RootDir => current.push(component.as_os_str()),
            Component::CurDir => continue,
            Component::ParentDir | Component::Normal(_) => current.push(component.as_os_str()),
        }
        if current.as_os_str().is_empty() {
            continue;
        }
        reject_if_symlink(&current)?;
    }
    Ok(())
}

pub(crate) fn reject_final_symlink(path: &Path) -> io::Result<()> {
    reject_symlink_components(path)
}

pub(crate) fn create_directory_all_no_symlink(path: &Path) -> io::Result<()> {
    reject_symlink_components(path)?;
    fs::create_dir_all(path)?;
    reject_symlink_components(path)
}

pub(crate) fn write_file_no_symlink(path: &Path, contents: &[u8]) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        create_directory_all_no_symlink(parent)?;
    }

    if let Some(parent) = path.parent() {
        reject_symlink_components(parent)?;
    }
    reject_symlink_components(path)?;
    if let Ok(metadata) = fs::symlink_metadata(path) {
        if metadata.file_type().is_symlink() {
            return Err(symlink_error(path));
        }
        if !metadata.is_file() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("output path is not a regular file: {}", path.display()),
            ));
        }
        fs::remove_file(path)?;
    }

    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        options.custom_flags(libc::O_NOFOLLOW);
    }
    let mut file = options.open(path)?;
    file.write_all(contents)?;
    file.sync_all()?;
    Ok(())
}

#[cfg(all(test, unix))]
mod tests {
    use super::write_file_no_symlink;
    use std::fs;
    use std::os::unix::fs::symlink;

    #[test]
    fn write_file_rejects_ancestor_symlink() {
        let root = std::env::temp_dir()
            .canonicalize()
            .unwrap_or_else(|_| std::env::temp_dir())
            .join(format!("gglass-path-security-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("real/sub")).expect("create real directory");
        symlink(root.join("real"), root.join("link")).expect("create ancestor symlink");

        let result = write_file_no_symlink(&root.join("link/sub/out.mov"), b"blocked");
        assert!(result.is_err());
        let message = result.unwrap_err().to_string();
        assert!(message.contains("symlink"), "unexpected error: {message}");
        assert!(!root.join("real/sub/out.mov").exists());

        let _ = fs::remove_dir_all(&root);
    }
}
