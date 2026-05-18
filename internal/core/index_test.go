package core

import (
	"strings"
	"testing"
)

func TestRebuildIndexValidatesInputPaths(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name      string
		request   RebuildIndexRequest
		errorText string
	}{
		{
			name:      "missing index path",
			request:   RebuildIndexRequest{FlowPath: "/tmp/workspace/.flow"},
			errorText: "index path must not be empty",
		},
		{
			name:      "missing flow path",
			request:   RebuildIndexRequest{IndexPath: "/tmp/workspace/.flow/config/flow.index"},
			errorText: "flow path must not be empty",
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			err := RebuildIndex(testCase.request)
			if err == nil {
				t.Fatalf("RebuildIndex(%+v) error = nil, want error", testCase.request)
			}
			if !strings.Contains(err.Error(), testCase.errorText) {
				t.Fatalf("RebuildIndex(%+v) error = %q, want substring %q", testCase.request, err.Error(), testCase.errorText)
			}
		})
	}
}
