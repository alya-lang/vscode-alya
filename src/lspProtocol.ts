/**
 * Alya LSP protocol contract (alya-lang/alya#192). No `vscode` import:
 * pure logic, safe to unit-test in isolation.
 *
 * Must match `ALYA_LSP_PROTOCOL_VERSION` in the compiler
 * (`Src/alya/src/tools/lsp/protocol.rs`). Bump together with it;
 * additive server changes do not bump.
 */
export const ALYA_LSP_PROTOCOL_VERSION = 1;

export type ProtocolCheck = { ok: true } | { ok: false; reason: string };

/**
 * Reads the server-advertised protocol version from an `initialize`
 * result. Unknown shapes (pre-contract servers) fail loud, never
 * silent: a skew that slips through surfaces as broken completions
 * and hover, not as an error.
 */
export function checkProtocolVersion(initializeResult: unknown): ProtocolCheck {
  if (typeof initializeResult !== "object" || initializeResult === null) {
    return { ok: false, reason: "missing initialize result" };
  }
  const record = initializeResult as Record<string, unknown>;
  const advertised = record["alyaProtocolVersion"];
  if (typeof advertised !== "number") {
    return {
      ok: false,
      reason: "server did not advertise alyaProtocolVersion (stale binary?)",
    };
  }
  if (advertised !== ALYA_LSP_PROTOCOL_VERSION) {
    return {
      ok: false,
      reason: `protocol mismatch: server=${advertised}, extension=${ALYA_LSP_PROTOCOL_VERSION}`,
    };
  }
  return { ok: true };
}

/** Best-effort `serverInfo.version` for error text; `"unknown"` when absent. */
export function serverVersionOf(initializeResult: unknown): string {
  if (typeof initializeResult !== "object" || initializeResult === null) {
    return "unknown";
  }
  const record = initializeResult as Record<string, unknown>;
  const info = record["serverInfo"];
  if (typeof info !== "object" || info === null) {
    return "unknown";
  }
  const version = (info as Record<string, unknown>)["version"];
  return typeof version === "string" ? version : "unknown";
}
