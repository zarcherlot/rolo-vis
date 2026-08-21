export interface ContractSchemaField {
  path: string;
  depth: number;
  type: string;
  required: boolean;
  unit: string | null;
  description: string | null;
  constraints: string[];
}

export interface ContractSchemaProjection {
  rootType: string;
  fields: ContractSchemaField[];
  allowsAdditionalProperties: boolean | null;
  truncated: boolean;
}

const MAX_FIELDS = 100;
const MAX_DEPTH = 4;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function schemaType(schema: Record<string, unknown>): string {
  const type = schema.type;
  if (Array.isArray(type)) return type.filter((item) => typeof item === "string").join(" | ") || "unknown";
  if (typeof type === "string") {
    if (type === "array") {
      const items = record(schema.items);
      return items ? `array<${schemaType(items)}>` : "array";
    }
    return type;
  }
  return Array.isArray(schema.enum) ? "enum" : "unknown";
}

function constraintText(schema: Record<string, unknown>): string[] {
  const constraints: string[] = [];
  if (Array.isArray(schema.enum)) constraints.push(`enum: ${schema.enum.map(String).join(", ")}`);
  if (typeof schema.minimum === "number") constraints.push(`min: ${schema.minimum}`);
  if (typeof schema.maximum === "number") constraints.push(`max: ${schema.maximum}`);
  if (typeof schema.minLength === "number") constraints.push(`min length: ${schema.minLength}`);
  if (typeof schema.maxLength === "number") constraints.push(`max length: ${schema.maxLength}`);
  if (typeof schema.pattern === "string") constraints.push(`pattern: ${schema.pattern}`);
  if (typeof schema.format === "string") constraints.push(`format: ${schema.format}`);
  return constraints;
}

export function projectContractSchema(
  schema: Record<string, unknown>,
  semanticUnits: Record<string, string> = {},
): ContractSchemaProjection {
  const fields: ContractSchemaField[] = [];
  let truncated = false;

  const visit = (current: Record<string, unknown>, parentPath: string, depth: number) => {
    const properties = record(current.properties);
    if (!properties) return;
    const required = new Set(Array.isArray(current.required) ? current.required.filter((item): item is string => typeof item === "string") : []);
    for (const [name, value] of Object.entries(properties)) {
      if (fields.length >= MAX_FIELDS || depth > MAX_DEPTH) {
        truncated = true;
        return;
      }
      const fieldSchema = record(value) || {};
      const path = parentPath ? `${parentPath}.${name}` : name;
      fields.push({
        path,
        depth,
        type: schemaType(fieldSchema),
        required: required.has(name),
        unit: semanticUnits[path] || semanticUnits[name] || null,
        description: typeof fieldSchema.description === "string" ? fieldSchema.description : null,
        constraints: constraintText(fieldSchema),
      });
      visit(fieldSchema, path, depth + 1);
      const items = record(fieldSchema.items);
      if (items) visit(items, `${path}[]`, depth + 1);
    }
  };

  visit(schema, "", 0);
  return {
    rootType: schemaType(schema),
    fields,
    allowsAdditionalProperties: typeof schema.additionalProperties === "boolean" ? schema.additionalProperties : null,
    truncated,
  };
}
