export type RoloAuthMode = "none" | "bearer" | "session";

export type RoloAuthConfig = {
  /** A short-lived token held by the caller. It is never persisted by rolo-vis. */
  mode: "bearer";
  token: string;
} | {
  /** Browser-managed same-origin HttpOnly session. */
  mode: "session";
  credentials?: RequestCredentials;
} | {
  mode: "none";
};

export interface RoloAuthTransport {
  readonly mode: RoloAuthMode;
  apply(options: RequestInit): RequestInit;
}

function assertBearerToken(token: string): void {
  if (!token || /[\u0000-\u001f\u007f]/.test(token)) {
    throw new Error("rolo bearer token must be a non-empty in-memory value");
  }
}

/**
 * Create the one auth adapter used by the API client and live gates.
 * The adapter deliberately has no storage, URL, logging, or bundle integration.
 */
export function createRoloAuthTransport(config: RoloAuthConfig = { mode: "none" }): RoloAuthTransport {
  if (config.mode === "bearer") assertBearerToken(config.token);

  return {
    mode: config.mode,
    apply(options: RequestInit = {}) {
      const headers = new Headers(options.headers);
      if (config.mode === "bearer") headers.set("Authorization", `Bearer ${config.token}`);
      const next: RequestInit = { ...options, headers };
      if (config.mode === "session") next.credentials = config.credentials ?? "include";
      return next;
    },
  };
}
