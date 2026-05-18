package desktop

import "testing"

func TestLinuxWindowIconEmbedded(t *testing.T) {
	if len(linuxWindowIcon()) == 0 {
		t.Fatal("linuxWindowIcon() returned empty bytes")
	}

	iconBytes := linuxWindowIcon()
	if len(iconBytes) < 8 {
		t.Fatalf("linuxWindowIcon() length = %d, want at least 8 bytes", len(iconBytes))
	}

	// PNG signature: 89 50 4E 47 0D 0A 1A 0A.
	expected := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
	for index, value := range expected {
		if iconBytes[index] != value {
			t.Fatalf("linux icon png signature mismatch at byte %d: got 0x%x want 0x%x", index, iconBytes[index], value)
		}
	}
}
