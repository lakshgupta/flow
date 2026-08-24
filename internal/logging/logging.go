// Package logging provides application-level file logging with daily
// rollover and age-based pruning.
//
// Logs are written under <workspace>/.flow/logs/flow-YYYYMMDD.log. The writer
// rolls over to a new file when the local date changes, and Setup prunes any
// *.log file in the directory whose modification time is older than the
// retention window (15 days).
package logging

import (
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// RetentionWindow is how long log files are kept before deletion.
const RetentionWindow = 15 * 24 * time.Hour

// dailyFileWriter appends to flow-YYYYMMDD.log and opens a new file when the
// local date changes between writes. Writes are serialized by mutex so the
// server's concurrent handlers never interleave partial lines.
type dailyFileWriter struct {
	dir     string
	mu      sync.Mutex
	day     string
	file    *os.File
	nowFunc func() time.Time
}

func newDailyFileWriter(dir string) *dailyFileWriter {
	return &dailyFileWriter{dir: dir, nowFunc: time.Now}
}

func (w *dailyFileWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if err := w.rollIfNeeded(); err != nil {
		return 0, err
	}
	return w.file.Write(p)
}

// rollIfNeeded opens today's log file when none is open yet or when the date
// has changed since the last write (rollover).
func (w *dailyFileWriter) rollIfNeeded() error {
	now := w.nowFunc()
	day := now.Format("20060102")
	if w.file != nil && w.day == day {
		return nil
	}

	if w.file != nil {
		_ = w.file.Close()
		w.file = nil
	}

	if err := os.MkdirAll(w.dir, 0o755); err != nil {
		return fmt.Errorf("create logs directory: %w", err)
	}

	path := filepath.Join(w.dir, "flow-"+day+".log")
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return fmt.Errorf("open log file: %w", err)
	}

	timestamp := now.Format("2006-01-02T15:04:05Z07:00")
	if _, err := fmt.Fprintf(file, "%s log session started\n", timestamp); err != nil {
		_ = file.Close()
		return fmt.Errorf("write log header: %w", err)
	}

	w.file = file
	w.day = day
	return nil
}

func (w *dailyFileWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file == nil {
		return nil
	}
	err := w.file.Close()
	w.file = nil
	return err
}

// Prune removes every *.log file in dir whose modification time is older than
// cutoff. A missing directory is not an error.
func Prune(dir string, cutoff time.Time) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("read logs directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".log") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue // File vanished mid-prune; skip it.
		}

		if info.ModTime().Before(cutoff) {
			_ = os.Remove(filepath.Join(dir, entry.Name()))
		}
	}

	return nil
}

// Setup wires application logging to daily-rotated files under dir and prunes
// logs older than RetentionWindow. The returned closer releases the log file;
// callers that exit via os.Exit should call it on shutdown paths where
// practical. Standard-library log output is mirrored to stderr so foreground
// runs stay visible while background runs keep their file trail.
func Setup(dir string) (func(), error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create logs directory: %w", err)
	}

	if err := Prune(dir, time.Now().Add(-RetentionWindow)); err != nil {
		return nil, fmt.Errorf("prune old logs: %w", err)
	}

	writer := newDailyFileWriter(dir)
	log.SetOutput(io.MultiWriter(writer, os.Stderr))
	log.SetFlags(log.LstdFlags | log.LUTC)

	closer := func() {
		_ = writer.Close()
		log.SetOutput(os.Stderr)
	}

	log.Printf("logging initialized at %s", dir)
	return closer, nil
}
