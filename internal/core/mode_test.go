package core

import (
	"reflect"
	"strings"
	"testing"
)

func TestParseModeRequest(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name        string
		args        []string
		want        ModeRequest
		wantErr     bool
		errorSubstr string
	}{
		{
			name: "default cli preserves args",
			args: []string{"search", "parser"},
			want: ModeRequest{
				Mode: ModeCLI,
				Args: []string{"search", "parser"},
			},
		},
		{
			name: "explicit cli mode equals form",
			args: []string{"--mode=cli", "version"},
			want: ModeRequest{
				Mode: ModeCLI,
				Args: []string{"version"},
			},
		},
		{
			name: "server mode with global flag",
			args: []string{"--mode", "server", "-g"},
			want: ModeRequest{
				Mode:   ModeServer,
				Args:   []string{},
				Global: true,
			},
		},
		{
			name: "desktop mode with mode equals and global",
			args: []string{"-g", "--mode=desktop"},
			want: ModeRequest{
				Mode:   ModeDesktop,
				Args:   []string{},
				Global: true,
			},
		},
		{
			name:        "unknown mode rejected",
			args:        []string{"--mode", "api"},
			wantErr:     true,
			errorSubstr: "unknown --mode",
		},
		{
			name:        "missing mode value rejected",
			args:        []string{"--mode"},
			wantErr:     true,
			errorSubstr: "--mode requires one of",
		},
		{
			name:        "server mode rejects extra args",
			args:        []string{"--mode", "server", "search"},
			wantErr:     true,
			errorSubstr: "does not accept extra arguments",
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			got, err := ParseModeRequest(testCase.args)
			if testCase.wantErr {
				if err == nil {
					t.Fatalf("ParseModeRequest(%v) error = nil, want error", testCase.args)
				}
				if testCase.errorSubstr != "" && !strings.Contains(err.Error(), testCase.errorSubstr) {
					t.Fatalf("ParseModeRequest(%v) error = %q, want substring %q", testCase.args, err.Error(), testCase.errorSubstr)
				}
				return
			}

			if err != nil {
				t.Fatalf("ParseModeRequest(%v) error = %v, want nil", testCase.args, err)
			}

			if !reflect.DeepEqual(got, testCase.want) {
				t.Fatalf("ParseModeRequest(%v) = %#v, want %#v", testCase.args, got, testCase.want)
			}
		})
	}
}
