// Package index owns the derived .flow/config/flow.index database and search plus graph projections.
package index

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

// openIndexDB opens a SQLite database at path with a 5-second busy_timeout.
//
// The timeout ensures that concurrent reads and writes from parallel HTTP
// requests (for example /api/workspace synchronising GUI settings while
// /api/graphs reads graph nodes via a Promise.all on startup) wait for any
// in-progress write lock to be released instead of immediately failing with
// SQLITE_BUSY. Without this, handleGraphTree silently drops the error and
// returns an empty content tree.
//
// The file: URI prefix is required to pass _pragma query parameters;
// modernc.org/sqlite v1.46+ handles busy_timeout first in its pragma ordering.
func openIndexDB(path string) (*sql.DB, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	return db, nil
}
