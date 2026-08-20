import type {
  BootstrapResult,
  HealthResponse,
  PipelineAssessment,
  RobotCapability,
  RobotOverview,
  StageAssessment,
} from "./types/rolo";

const DEFAULT_BASE = "/rolo-api";

export class RoloApiError extends Error {
  status: number | null;
  path: string;
  code: "HTTP" | "NETWORK" | "ABORTED" | "HEALTH";

  constructor(
    message: string,
    status: number | null,
    path = "",
    code: RoloApiError["code"] = "HTTP",
  ) {
    super(message);
    this.name = "RoloApiError";
    this.status = status;
    this.path = path;
    this.code = code;
  }
}

export class RoloContractError extends Error {
  path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = "RoloContractError";
    this.path = path;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireContract(condition: boolean, message: string, path: string): asserts condition {
  if (!condition) throw new RoloContractError(message, path);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function parseHealthResponse(value: unknown, path: string): HealthResponse {
  requireContract(isRecord(value), "health response must be an object", path);
  requireContract(["HEALTHY", "DEGRADED", "UNHEALTHY"].includes(String(value.status)), "invalid health status", path);
  requireContract(typeof value.service === "string" && typeof value.version === "string", "invalid health service identity", path);
  requireContract(Number.isInteger(value.robots) && Number(value.robots) >= 0, "invalid registered robot count", path);
  requireContract(typeof value.robot_use_backend === "string", "missing robot-use backend", path);
  requireContract(typeof value.openai_key_configured === "boolean", "invalid OpenAI key status", path);
  requireContract(isTimestamp(value.timestamp), "invalid health observation time", path);
  return value as unknown as HealthResponse;
}

function parseRobotCapabilities(value: unknown, path: string): RobotCapability[] {
  requireContract(Array.isArray(value), "robot registry must be an array", path);
  const robotIds = new Set<string>();
  for (const [index, robot] of value.entries()) {
    const itemPath = `${path}/${index}`;
    requireContract(isRecord(robot), "robot capability must be an object", itemPath);
    requireContract(typeof robot.schema_version === "string" && robot.schema_version.length > 0, "missing robot capability schema", itemPath);
    requireContract(typeof robot.robot_id === "string" && robot.robot_id.length > 0, "missing robot identity", itemPath);
    requireContract(!robotIds.has(robot.robot_id), "duplicate robot identity", itemPath);
    robotIds.add(robot.robot_id);
    requireContract(typeof robot.adapter === "string", "missing robot adapter", itemPath);
    requireContract(isRecord(robot.platform) && isRecord(robot.geometry), "invalid robot platform or geometry", itemPath);
    requireContract(isRecord(robot.sensors) && isRecord(robot.features), "invalid robot sensors or features", itemPath);
  }
  return value as RobotCapability[];
}

function parseStageAssessment(value: unknown, path: string, robotId: string): StageAssessment {
  requireContract(isRecord(value), "stage assessment must be an object", path);
  requireContract(value.schema_version === "robot-stage-assessment/v1", "unsupported stage assessment schema", path);
  requireContract(["adapt", "diagnose", "verify"].includes(String(value.stage)), "invalid pipeline stage", path);
  requireContract(value.robot_id === robotId, "stage robot identity does not match pipeline", path);
  requireContract(["NOT_STARTED", "BLOCKED", "DEGRADED", "READY", "COMPLETE"].includes(String(value.status)), "invalid stage status", path);
  requireContract(typeof value.summary === "string" && typeof value.optional === "boolean", "invalid stage summary or optional flag", path);
  requireContract(isStringArray(value.prerequisites) && isStringRecord(value.artifacts), "invalid stage prerequisites or artifacts", path);
  requireContract(isStringArray(value.blockers), "invalid stage blockers", path);
  requireContract(["adapter_agent", "diagnosis_agent", "verification_agent"].includes(String(value.agent_requirement)), "invalid stage owner", path);
  requireContract(isTimestamp(value.observed_at), "invalid stage observation time", path);
  return value as unknown as StageAssessment;
}

function parsePipelineAssessment(value: unknown, path: string, expectedRobotId?: string): PipelineAssessment {
  requireContract(isRecord(value), "pipeline assessment must be an object", path);
  requireContract(value.schema_version === "robot-three-stage-pipeline/v1", "unsupported pipeline schema", path);
  requireContract(typeof value.robot_id === "string" && value.robot_id.length > 0, "missing pipeline robot identity", path);
  requireContract(!expectedRobotId || value.robot_id === expectedRobotId, "pipeline robot identity does not match request", path);
  requireContract(Array.isArray(value.stages), "pipeline stages must be an array", path);
  const stages = value.stages.map((stage, index) => parseStageAssessment(stage, `${path}/stages/${index}`, value.robot_id as string));
  requireContract(new Set(stages.map((stage) => stage.stage)).size === stages.length, "pipeline contains duplicate stages", path);
  requireContract(isTimestamp(value.observed_at), "invalid pipeline observation time", path);
  return { ...value, stages } as unknown as PipelineAssessment;
}

function parseRobotOverview(value: unknown, path: string, expectedRobotId?: string): RobotOverview {
  requireContract(isRecord(value), "robot overview must be an object", path);
  if (value.schema_version !== "rolo-robot-overview/v1") {
    throw new RoloContractError("unsupported or missing robot overview schema", path);
  }
  requireContract(typeof value.robot_id === "string" && value.robot_id.length > 0, "missing robot overview identity", path);
  requireContract(!expectedRobotId || value.robot_id === expectedRobotId, "overview robot identity does not match request", path);
  requireContract(["READY", "ATTENTION", "DEGRADED", "NOT_READY"].includes(String(value.state)), "invalid overview state", path);
  requireContract(typeof value.summary === "string" && typeof value.next_action === "string", "invalid overview summary or action", path);
  requireContract(Array.isArray(value.blockers), "overview blockers must be an array", path);
  for (const [index, blocker] of value.blockers.entries()) {
    const blockerPath = `${path}/blockers/${index}`;
    requireContract(isRecord(blocker), "overview blocker must be an object", blockerPath);
    requireContract(blocker.schema_version === "rolo-blocker-summary/v1", "unsupported blocker schema", blockerPath);
    requireContract(typeof blocker.blocker_id === "string" && typeof blocker.stage === "string", "invalid blocker identity", blockerPath);
    requireContract(typeof blocker.message === "string" && typeof blocker.recommended_action === "string", "invalid blocker guidance", blockerPath);
    requireContract(typeof blocker.owner === "string" && isTimestamp(blocker.observed_at), "invalid blocker ownership or time", blockerPath);
    requireContract(blocker.freshness === "fresh" && blocker.source_kind === "pipeline_assessment", "invalid blocker provenance", blockerPath);
    requireContract(typeof blocker.confidence === "number" && blocker.confidence >= 0 && blocker.confidence <= 1, "invalid blocker confidence", blockerPath);
    requireContract(blocker.integrity_status === "validated" && isStringArray(blocker.evidence_refs), "invalid blocker integrity or evidence", blockerPath);
  }
  const pipeline = parsePipelineAssessment(value.pipeline, `${path}/pipeline`, value.robot_id);
  requireContract(isTimestamp(value.observed_at), "invalid overview observation time", path);
  requireContract(value.freshness === "fresh" && value.source_kind === "computed_read_model", "invalid overview provenance", path);
  requireContract(typeof value.confidence === "number" && value.confidence >= 0 && value.confidence <= 1, "invalid overview confidence", path);
  requireContract(value.integrity_status === "validated", "invalid overview integrity", path);
  return { ...value, pipeline } as unknown as RobotOverview;
}

export class RoloClient {
  baseUrl: string;

  constructor(baseUrl = import.meta.env?.VITE_ROLO_API_BASE || DEFAULT_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: { Accept: "application/json", ...options.headers },
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new RoloApiError(
        aborted ? "rolo request timed out" : "rolo is unreachable",
        null,
        path,
        aborted ? "ABORTED" : "NETWORK",
      );
    }
    if (!response.ok) {
      throw new RoloApiError(`rolo request failed: ${response.status}`, response.status, path);
    }
    try {
      return await response.json() as T;
    } catch {
      throw new RoloContractError("response is not valid JSON", path);
    }
  }

  async health(options?: RequestInit) {
    const path = "/health";
    return parseHealthResponse(await this.request<unknown>(path, options), path);
  }

  async robots(options?: RequestInit) {
    const path = "/v1/robots";
    return parseRobotCapabilities(await this.request<unknown>(path, options), path);
  }

  async pipeline(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/pipeline`;
    return parsePipelineAssessment(await this.request<unknown>(path, options), path, robotId);
  }

  async overview(robotId: string, options?: RequestInit) {
    const path = `/v1/robots/${encodeURIComponent(robotId)}/overview`;
    const payload = await this.request<unknown>(path, options);
    return parseRobotOverview(payload, path, robotId);
  }

  async bootstrap(options: RequestInit = {}, requestedRobotId?: string): Promise<BootstrapResult> {
    const health = await this.health(options);
    if (health.status === "UNHEALTHY") {
      throw new RoloApiError("rolo reports an unhealthy control plane", null, "/health", "HEALTH");
    }
    const healthIssues = health.status === "DEGRADED"
      ? ["The rolo control plane reports degraded health; live data is shown as partial."]
      : [];
    const robots = await this.robots(options);
    const robot = robots.find((item) => item.robot_id === requestedRobotId) || robots[0] || null;
    if (!robot) {
      return {
        mode: "partial",
        health,
        robots,
        robot: null,
        overview: null,
        pipeline: null,
        issues: [...healthIssues, "The control plane is reachable but no robots are registered."],
      };
    }

    try {
      const overview = await this.overview(robot.robot_id, options);
      return {
        mode: health.status === "HEALTHY" ? "live" : "partial",
        health,
        robots,
        robot,
        overview,
        pipeline: overview.pipeline,
        issues: healthIssues,
      };
    } catch (error) {
      if (!(error instanceof RoloApiError) || error.status !== 404) throw error;
      const pipeline = await this.pipeline(robot.robot_id, options);
      return {
        mode: "partial",
        health,
        robots,
        robot,
        overview: null,
        pipeline,
        issues: [...healthIssues, "The overview read model is unavailable; showing the compatible pipeline view."],
      };
    }
  }
}

export const roloClient = new RoloClient();
