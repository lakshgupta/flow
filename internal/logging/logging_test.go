package logging

import (
	"errors"
	"log"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSetupCreatesFileAndLogs(t *testing.T) {
	dir := t.TempDir()

	closer, err := Setup(dir)
	if err != nil {
		t.Fatalf("setup logging: %v", err)
	}
	defer closer()

	log.Print("hello from flow")

	day := time.Now().Format("20060102")
	path := filepath.Join(dir, "flow-"+day+".log")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read log file: %v", err)
	}

	if !strings.Contains(string(data), "log session started") {
		t.Errorf("expected session header in %s, got: %s", path, data)
	}
	if !strings.Contains(string(data), "hello from flow") {
		t.Errorf("expected log line in %s, got: %s", path, data)
	}
}

func TestDailyFileWriterRollsOverOnDateChange(t *testing.T) {
	dir := t.TempDir()
	writer := newDailyFileWriter(dir)

	current := time.Date(2026, 8, 20, 23, 59, 0, 0, time.Local)
	writer.nowFunc = func() time.Time { return current }
	t.Cleanup(func() { _ = writer.Close() })

	if _, err := writer.Write([]byte("day one\n")); err != nil {
		t.Fatalf("write day one: %v", err)
	}

	current = current.Add(2 * time.Hour) // Cross midnight.
	if _, err := writer.Write([]byte("day two\n")); err != nil {
		t.Fatalf("write day two: %v", err)
	}

	dayOne := filepath.Join(dir, "flow-20260820.log")
	dayTwo := filepath.Join(dir, "flow-20260821.log")

	first, err := os.ReadFile(dayOne)
	if err != nil {
		t.Fatalf("read day one log: %v", err)
	}
	second, err := os.ReadFile(dayTwo)
	if err != nil {
		t.Fatalf("read day two log: %v", err)
	}

	if !strings.Contains(string(first), "day one") || strings.Contains(string(first), "day two") {
		t.Errorf("day one file should contain only the first write, got: %s", first)
	}
	if !strings.Contains(string(second), "day two") || strings.Contains(string(second), "day one") {
		t.Errorf("day two file should contain only the rollover write, got: %s", second)
	}
}

func TestPruneDeletesOnlyOldLogFiles(t *testing.T) {
	dir := t.TempDir()

	oldLog := filepath.Join(dir, "flow-20260101.log")
	recentLog := filepath.Join(dir, "flow-recent.log")
	otherOld := filepath.Join(dir, "not-a-log.txt")

	for _, path := range []string{oldLog, recentLog, otherOld} {
		if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
	}

	cutoff := time.Now().Add(-RetentionWindow)
	past := cutoff.Add(-time.Hour)
	if err := os.Chtimes(oldLog, past, past); err != nil {
		t.Fatalf("set old mtime: %v", err)
	}
	if err := os.Chtimes(otherOld, past, past); err != nil {
		t.Fatalf("set old mtime: %v", err)
	}

	if err := Prune(dir, cutoff); err != nil {
		t.Fatalf("prune: %v", err)
	}

	if _, err := os.Stat(oldLog); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("expected old .log to be deleted, stat error: %v", err)
	}
	if _, err := os.Stat(recentLog); err != nil {
		t.Errorf("expected recent .log to survive: %v", err)
	}
	if _, err := os.Stat(otherOld); err != nil {
		t.Errorf("expected non-.log file to survive: %v", err)
	}
}

func TestPruneMissingDirectoryIsNoop(t *testing.T) {
	if err := Prune(filepath.Join(t.TempDir(), "missing"), time.Now()); err != nil {
		t.Errorf("prune on missing dir should not fail: %v", err)
	}
}
