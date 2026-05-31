import { afterEach, describe, expect, it, vi } from "vitest";
import { createFlowImageUploader } from "./imageUploader";

interface MockXHR {
	addEventListener: ReturnType<typeof vi.fn>;
	open: ReturnType<typeof vi.fn>;
	send: ReturnType<typeof vi.fn>;
	simulateLoad(): void;
	simulateError(): void;
	simulateProgress(loaded: number, total: number, lengthComputable: boolean): void;
}

function createMockXHR(status: number, responseText: string): MockXHR {
	const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
	const uploadListeners: Record<string, Array<(...args: unknown[]) => void>> = {};

	const addEventListener = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
		if (!listeners[event]) listeners[event] = [];
		listeners[event].push(handler);
	});

	const uploadAddEventListener = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
		if (!uploadListeners[event]) uploadListeners[event] = [];
		uploadListeners[event].push(handler);
	});

	const xhr = {
		status,
		responseText,
		upload: {
			addEventListener: uploadAddEventListener,
		},
		addEventListener,
		open: vi.fn(),
		send: vi.fn(),
		simulateLoad() {
			(listeners["load"] ?? []).forEach((handler) => handler());
		},
		simulateError() {
			(listeners["error"] ?? []).forEach((handler) => handler());
		},
		simulateProgress(loaded: number, total: number, lengthComputable: boolean) {
			const event = new ProgressEvent("progress", { loaded, total, lengthComputable });
			(uploadListeners["progress"] ?? []).forEach((handler) => handler(event));
		},
	};

	return xhr;
}

describe("createFlowImageUploader", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("POSTs to /api/files and resolves with the returned URL on success", async () => {
		const xhr = createMockXHR(201, JSON.stringify({ url: "/api/files?path=data/uploads/photo.png" }));

		const XHRConstructor = vi.fn(() => xhr) as unknown as typeof XMLHttpRequest;
		vi.stubGlobal("XMLHttpRequest", XHRConstructor);

		const uploader = createFlowImageUploader(() => undefined);
		const file = new File(["image-bytes"], "photo.png", { type: "image/png" });
		const onProgress = vi.fn();

		const promise = uploader({ file, onProgress });
		xhr.simulateLoad();

		const url = await promise;

		expect(url).toBe("/api/files?path=data/uploads/photo.png");
		expect(xhr.open).toHaveBeenCalledWith("POST", "/api/files", true);

		// Verify send was called with a FormData containing the file.
		const formDataArg = xhr.send.mock.calls[0]?.[0] as FormData;
		expect(formDataArg).toBeInstanceOf(FormData);
		expect(formDataArg.get("file")).toBe(file);
	});

	it("includes documentPath query parameter when provided", async () => {
		const xhr = createMockXHR(201, JSON.stringify({ url: "/api/files?path=data/content/design/photo.png" }));

		const XHRConstructor = vi.fn(() => xhr) as unknown as typeof XMLHttpRequest;
		vi.stubGlobal("XMLHttpRequest", XHRConstructor);

		const uploader = createFlowImageUploader(() => "data/content/design/note.md");
		const file = new File(["image-bytes"], "photo.png", { type: "image/png" });
		const onProgress = vi.fn();

		const promise = uploader({ file, onProgress });
		xhr.simulateLoad();
		await promise;

		expect(xhr.open).toHaveBeenCalledWith(
			"POST",
			"/api/files?documentPath=" + encodeURIComponent("data/content/design/note.md"),
			true,
		);
	});

	it("rejects when the server returns a non-201 status", async () => {
		const xhr = createMockXHR(400, JSON.stringify({ error: "no file was provided" }));

		const XHRConstructor = vi.fn(() => xhr) as unknown as typeof XMLHttpRequest;
		vi.stubGlobal("XMLHttpRequest", XHRConstructor);

		const uploader = createFlowImageUploader(() => undefined);
		const file = new File(["content"], "doc.txt", { type: "text/plain" });
		const onProgress = vi.fn();

		const promise = uploader({ file, onProgress });
		xhr.simulateLoad();

		await expect(promise).rejects.toThrow("no file was provided");
	});

	it("rejects when the response status is not 201 and the body is not JSON", async () => {
		const xhr = createMockXHR(500, "Internal Server Error");

		const XHRConstructor = vi.fn(() => xhr) as unknown as typeof XMLHttpRequest;
		vi.stubGlobal("XMLHttpRequest", XHRConstructor);

		const uploader = createFlowImageUploader(() => undefined);
		const file = new File(["content"], "doc.txt", { type: "text/plain" });
		const onProgress = vi.fn();

		const promise = uploader({ file, onProgress });
		xhr.simulateLoad();

		await expect(promise).rejects.toThrow("Upload failed with status 500");
	});

	it("rejects when the 201 response is not valid JSON", async () => {
		const xhr = createMockXHR(201, "not-json");

		const XHRConstructor = vi.fn(() => xhr) as unknown as typeof XMLHttpRequest;
		vi.stubGlobal("XMLHttpRequest", XHRConstructor);

		const uploader = createFlowImageUploader(() => undefined);
		const file = new File(["content"], "doc.txt", { type: "text/plain" });
		const onProgress = vi.fn();

		const promise = uploader({ file, onProgress });
		xhr.simulateLoad();

		await expect(promise).rejects.toThrow("Failed to parse response");
	});

	it("rejects on network error", async () => {
		const xhr = createMockXHR(0, "");

		const XHRConstructor = vi.fn(() => xhr) as unknown as typeof XMLHttpRequest;
		vi.stubGlobal("XMLHttpRequest", XHRConstructor);

		const uploader = createFlowImageUploader(() => undefined);
		const file = new File(["content"], "doc.txt", { type: "text/plain" });
		const onProgress = vi.fn();

		const promise = uploader({ file, onProgress });
		xhr.simulateError();

		await expect(promise).rejects.toThrow("Upload failed");
	});

	it("calls onProgress with uploaded bytes when progress is computable", async () => {
		const xhr = createMockXHR(201, JSON.stringify({ url: "/api/files?path=data/uploads/photo.png" }));

		const XHRConstructor = vi.fn(() => xhr) as unknown as typeof XMLHttpRequest;
		vi.stubGlobal("XMLHttpRequest", XHRConstructor);

		const uploader = createFlowImageUploader(() => undefined);
		const file = new File(["image-bytes"], "photo.png", { type: "image/png" });
		const onProgress = vi.fn();

		const promise = uploader({ file, onProgress });
		xhr.simulateProgress(512, 2048, true);
		xhr.simulateLoad();
		await promise;

		expect(onProgress).toHaveBeenCalledWith({ loaded: 512, total: 2048 });
	});

	it("does not call onProgress when the progress event is not computable", async () => {
		const xhr = createMockXHR(201, JSON.stringify({ url: "/api/files?path=data/uploads/photo.png" }));

		const XHRConstructor = vi.fn(() => xhr) as unknown as typeof XMLHttpRequest;
		vi.stubGlobal("XMLHttpRequest", XHRConstructor);

		const uploader = createFlowImageUploader(() => undefined);
		const file = new File(["image-bytes"], "photo.png", { type: "image/png" });
		const onProgress = vi.fn();

		const promise = uploader({ file, onProgress });
		xhr.simulateProgress(0, 0, false);
		xhr.simulateLoad();
		await promise;

		expect(onProgress).not.toHaveBeenCalled();
	});
});
