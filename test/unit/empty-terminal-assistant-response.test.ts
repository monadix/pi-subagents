import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Message } from "@earendil-works/pi-ai";
import { hasEmptyTerminalAssistantResponse } from "../../src/shared/utils.ts";

function assistant(content: unknown[], overrides: Record<string, unknown> = {}): Message {
	return {
		role: "assistant",
		content,
		stopReason: "stop",
		usage: { output: 41 },
		...overrides,
	} as unknown as Message;
}

const emptyText = { type: "text", text: "" };
const thinking = { type: "thinking", thinking: "Waiting" };

describe("hasEmptyTerminalAssistantResponse", () => {
	for (const content of [
		[emptyText],
		[{ type: "thinking", thinking: "" }, emptyText],
		[{ type: "thinking", thinking: "" }, thinking, { type: "thinking", thinking: "" }, emptyText],
		[emptyText, thinking, emptyText],
	]) {
		it(`recognizes empty final text with content ${JSON.stringify(content)}`, () => {
			assert.equal(hasEmptyTerminalAssistantResponse([assistant(content)]), true);
		});
	}

	for (const [name, content, overrides] of [
		["thinking only", [thinking], {}],
		["whitespace text", [thinking, { type: "text", text: " \n\t" }], {}],
		["useful text", [thinking, emptyText, { type: "text", text: "Done" }], {}],
		["tool call", [thinking, emptyText, { type: "toolCall", id: "read-1", name: "read", arguments: {} }], {}],
		["unknown block", [emptyText, { type: "unknown" }], {}],
		["explicit error", [thinking, emptyText], { errorMessage: "provider failed" }],
		["aborted", [thinking, emptyText], { stopReason: "aborted" }],
		["length limit", [thinking, emptyText], { stopReason: "length" }],
		["error stop", [thinking, emptyText], { stopReason: "error" }],
		["tool use", [thinking, emptyText], { stopReason: "toolUse" }],
	] as const) {
		it(`does not expand recognition to ${name}`, () => {
			assert.equal(hasEmptyTerminalAssistantResponse([assistant([...content], overrides)]), false);
		});
	}

	it("requires the empty text stop to be the final conversation message", () => {
		const toolResult = { role: "toolResult", content: [emptyText] } as unknown as Message;
		assert.equal(hasEmptyTerminalAssistantResponse([assistant([thinking, emptyText]), toolResult]), false);
	});

	it("preserves zero-content recognition independently of stop reason and message position", () => {
		const empty = assistant([], { stopReason: "aborted", usage: { output: 0 } });
		assert.equal(hasEmptyTerminalAssistantResponse([empty]), true);
		assert.equal(hasEmptyTerminalAssistantResponse([empty, { role: "user", content: "Continue" } as Message]), true);
		assert.equal(hasEmptyTerminalAssistantResponse([assistant([])]), false);
		assert.equal(hasEmptyTerminalAssistantResponse([]), false);
	});
});
