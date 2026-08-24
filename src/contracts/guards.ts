export class RoloContractError extends Error {
  path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = "RoloContractError";
    this.path = path;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireContract(condition: boolean, message: string, path: string): asserts condition {
  if (!condition) throw new RoloContractError(message, path);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function isConfidence(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

export function containsUnsafeReference(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return serialized.includes("artifact://")
    || /[A-Za-z]:\\\\/.test(serialized)
    || /\/(?:home|root|etc|var|tmp|workspace|mnt|Users)\//i.test(serialized);
}
