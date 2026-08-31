/** Build an in-memory auth config for a live gate. Never prints or persists the token. */
export function liveAuthConfig() {
  const token = process.env.ROLO_API_TOKEN;
  return token ? { mode: "bearer", token } : { mode: "none" };
}
