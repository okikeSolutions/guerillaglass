use std::time::Instant;

/// Monotonic capture clock used by native runtime state.
#[derive(Debug)]
pub struct CaptureClock {
    started_at: Instant,
}

impl Default for CaptureClock {
    fn default() -> Self {
        Self {
            started_at: Instant::now(),
        }
    }
}

impl CaptureClock {
    /// Returns elapsed seconds since the clock was created.
    pub fn now_seconds(&self) -> f64 {
        self.started_at.elapsed().as_secs_f64()
    }
}

/// Running duration accumulator for start/stop style recording sessions.
#[derive(Debug, Default)]
pub struct RunningDuration {
    accumulated_seconds: f64,
    started_at_seconds: Option<f64>,
}

impl RunningDuration {
    /// Starts accumulation using the provided clock if not already running.
    pub fn start(&mut self, clock: &CaptureClock) {
        if self.started_at_seconds.is_none() {
            self.started_at_seconds = Some(clock.now_seconds());
        }
    }

    /// Stops accumulation and stores elapsed time since the last start.
    pub fn stop(&mut self, clock: &CaptureClock) {
        if let Some(started_at_seconds) = self.started_at_seconds.take() {
            self.accumulated_seconds += (clock.now_seconds() - started_at_seconds).max(0.0);
        }
    }

    /// Returns total elapsed duration including the in-flight segment when running.
    pub fn current(&self, clock: &CaptureClock) -> f64 {
        match self.started_at_seconds {
            Some(started_at_seconds) => {
                self.accumulated_seconds + (clock.now_seconds() - started_at_seconds).max(0.0)
            }
            None => self.accumulated_seconds,
        }
    }

    /// Returns whether the duration accumulator is currently running.
    pub fn is_running(&self) -> bool {
        self.started_at_seconds.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::{CaptureClock, RunningDuration};

    #[test]
    fn running_duration_tracks_elapsed_time() {
        let clock = CaptureClock::default();
        let mut duration = RunningDuration::default();
        duration.start(&clock);
        std::thread::sleep(std::time::Duration::from_millis(5));
        duration.stop(&clock);
        assert!(duration.current(&clock) > 0.0);
    }
}
