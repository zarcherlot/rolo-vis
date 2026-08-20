const DEFAULT_BASE = "/rolo-api";

export class RoloApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "RoloApiError";
    this.status = status;
  }
}

export class RoloClient {
  constructor(baseUrl = import.meta.env?.VITE_ROLO_API_BASE || DEFAULT_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Accept: "application/json", ...options.headers },
      signal: options.signal,
      ...options,
    });
    if (!response.ok) {
      throw new RoloApiError(`rolo request failed: ${response.status}`, response.status);
    }
    return response.json();
  }

  health(options) {
    return this.request("/health", options);
  }

  robots(options) {
    return this.request("/v1/robots", options);
  }

  pipeline(robotId, options) {
    return this.request(`/v1/robots/${encodeURIComponent(robotId)}/pipeline`, options);
  }

  async bootstrap(options = {}) {
    const health = await this.health(options);
    const robots = await this.robots(options);
    const robot = robots[0];
    const pipeline = robot ? await this.pipeline(robot.robot_id, options) : null;
    return { health, robots, pipeline };
  }
}

export const roloClient = new RoloClient();
