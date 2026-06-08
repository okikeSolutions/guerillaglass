use crate::{handle_request, EngineRuntimeConfig, State, MAX_SOCKET_FRAME_BYTES};
use protocol_rust::{
    chunk, decode_request_line, encode_response_line, failure, EngineResponse, JsonRpcId,
    ProtocolErrorCode,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{self, BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::Duration;

fn interrupt_request_id(value: &Value) -> Option<String> {
    if value.get("type")?.as_str()? != "interrupt" {
        return None;
    }
    let request_id = value.get("id")?;
    request_id
        .as_str()
        .map(ToOwned::to_owned)
        .or_else(|| request_id.as_i64().map(|id| id.to_string()))
}

fn has_expected_socket_auth_token(value: &Value) -> bool {
    let Ok(expected_token) = std::env::var("GG_ENGINE_RPC_AUTH_TOKEN") else {
        return false;
    };
    !expected_token.is_empty()
        && value.get("authToken").and_then(Value::as_str) == Some(expected_token.as_str())
}

fn write_socket_response(stream: &Arc<Mutex<TcpStream>>, response: EngineResponse) {
    if let (Ok(mut stream), Ok(line)) = (stream.lock(), encode_response_line(&response)) {
        let _ = stream.write_all(line.as_bytes());
        let _ = stream.write_all(b"\n");
        let _ = stream.flush();
    }
}

fn write_socket_json(stream: &Arc<Mutex<TcpStream>>, value: Value) -> io::Result<()> {
    let mut stream = stream
        .lock()
        .map_err(|_| io::Error::other("socket stream lock poisoned"))?;
    stream.write_all(value.to_string().as_bytes())?;
    stream.write_all(b"\n")?;
    stream.flush()
}

struct SocketStreamControl {
    cancelled: AtomicBool,
}

impl SocketStreamControl {
    fn new() -> Self {
        Self {
            cancelled: AtomicBool::new(false),
        }
    }

    fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }
}

fn start_socket_stream(
    method: &str,
    id: JsonRpcId,
    state: Arc<Mutex<State>>,
    stream: Arc<Mutex<TcpStream>>,
    control: Arc<SocketStreamControl>,
) {
    let method = method.to_owned();
    thread::spawn(move || {
        while !control.cancelled.load(Ordering::Relaxed) {
            let value = match state.lock() {
                Ok(state) if method == "capture.statusStream" => state.capture_status(),
                Ok(_) => json!(null),
                Err(_) => break,
            };
            if write_socket_json(
                &stream,
                serde_json::to_value(chunk(id.clone(), vec![value])).unwrap_or(json!({
                    "type": "chunk",
                    "id": id,
                    "values": []
                })),
            )
            .is_err()
            {
                control.cancel();
                break;
            }
            thread::sleep(Duration::from_millis(250));
        }
    });
}

fn handle_socket_line(
    config: &EngineRuntimeConfig,
    state: &Arc<Mutex<State>>,
    writer: &Arc<Mutex<TcpStream>>,
    active_streams: &mut HashMap<String, Arc<SocketStreamControl>>,
    trimmed: &str,
) {
    if trimmed.is_empty() {
        return;
    }

    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        if value.get("type").and_then(Value::as_str) == Some("ping") {
            let _ = write_socket_json(writer, json!({ "type": "pong" }));
            return;
        }
        if let Some(request_id) = interrupt_request_id(&value) {
            if let Some(control) = active_streams.remove(&request_id) {
                control.cancel();
            }
            return;
        }
        if !has_expected_socket_auth_token(&value) {
            write_socket_response(
                writer,
                failure(
                    "unknown",
                    ProtocolErrorCode::PermissionDenied,
                    "Missing or invalid engine socket auth token",
                ),
            );
            return;
        }
    }

    let request = match decode_request_line(trimmed) {
        Ok(value) => value,
        Err(_) => {
            write_socket_response(
                writer,
                failure(
                    "unknown",
                    ProtocolErrorCode::InvalidRequest,
                    "Invalid JSON request",
                ),
            );
            return;
        }
    };

    if request.method == "capture.statusStream" || request.method == "capture.previewFrameStream" {
        let request_id = match &request.id {
            JsonRpcId::String(value) => value.clone(),
            JsonRpcId::Number(value) => value.to_string(),
        };
        if let Some(control) = active_streams.remove(&request_id) {
            control.cancel();
        }
        let control = Arc::new(SocketStreamControl::new());
        active_streams.insert(request_id, Arc::clone(&control));
        start_socket_stream(
            &request.method,
            request.id.clone(),
            Arc::clone(state),
            Arc::clone(writer),
            control,
        );
        return;
    }

    let response = match state.lock() {
        Ok(mut state) => handle_request(config.platform, &mut state, &request),
        Err(_) => failure(
            &request.id,
            ProtocolErrorCode::RuntimeError,
            "Engine state lock poisoned",
        ),
    };
    write_socket_response(writer, response);
}

pub(crate) fn read_bounded_line<R: BufRead>(
    reader: &mut R,
    max_bytes: usize,
) -> io::Result<Option<String>> {
    let mut frame = Vec::new();
    loop {
        let available = reader.fill_buf()?;
        if available.is_empty() {
            if frame.is_empty() {
                return Ok(None);
            }
            break;
        }

        let newline_index = available.iter().position(|byte| *byte == b'\n');
        let bytes_to_copy = newline_index.map_or(available.len(), |index| index + 1);
        if frame.len().saturating_add(bytes_to_copy) > max_bytes {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "socket frame exceeded maximum size",
            ));
        }

        frame.extend_from_slice(&available[..bytes_to_copy]);
        reader.consume(bytes_to_copy);
        if newline_index.is_some() {
            break;
        }
    }

    if frame.ends_with(b"\n") {
        frame.pop();
    }
    if frame.ends_with(b"\r") {
        frame.pop();
    }
    let line = String::from_utf8(frame).map_err(|error| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("socket frame is not valid UTF-8: {error}"),
        )
    })?;
    Ok(Some(line))
}

fn run_socket_engine(config: EngineRuntimeConfig) -> io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let address = listener.local_addr()?;
    println!(
        "{}",
        json!({
            "type": "guerillaglass.engine.ready",
            "host": "127.0.0.1",
            "port": address.port()
        })
    );
    let (stream, _) = listener.accept()?;
    let reader = BufReader::new(stream.try_clone()?);
    let writer = Arc::new(Mutex::new(stream));
    let state = Arc::new(Mutex::new(State::new(config.recents_index_path.clone())));
    let mut active_streams: HashMap<String, Arc<SocketStreamControl>> = HashMap::new();

    let mut reader = reader;
    while let Some(line) = read_bounded_line(&mut reader, MAX_SOCKET_FRAME_BYTES)? {
        handle_socket_line(&config, &state, &writer, &mut active_streams, line.trim());
    }
    for control in active_streams.values() {
        control.cancel();
    }
    Ok(())
}

/// Runs the native foundation request loop until the socket transport is closed.
pub(crate) fn run_engine(config: EngineRuntimeConfig) {
    if let Err(error) = run_socket_engine(config) {
        eprintln!("engine socket transport failed: {error}");
    }
}
