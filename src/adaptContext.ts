import type {
  AdaptExecutionClass,
  AdaptMigrationStatus,
  AdaptSemanticLayer,
  CapabilitySummary,
  OperationDisposition,
  TargetOperationSlice,
} from "./types/rolo";

export interface OperationGovernanceFilters {
  query: string;
  semanticLayer: AdaptSemanticLayer | "ALL";
  executionClass: AdaptExecutionClass | "ALL";
  migrationStatus: AdaptMigrationStatus | "ALL";
}

export interface OperationGovernanceSummary {
  total: number;
  mappedFutureCapabilities: number;
  semanticLayers: Record<AdaptSemanticLayer, number>;
  executionClasses: Record<AdaptExecutionClass, number>;
  migrationStatuses: Record<AdaptMigrationStatus, number>;
}

export interface OperationGovernancePage {
  items: OperationDisposition[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
}

export interface AdaptTargetOperation {
  operation: string;
  role: "PRIMARY" | "DEPENDENCY" | "ELIGIBLE";
  governance: OperationDisposition | null;
}

export interface AdaptContextLens {
  worksetCount: number;
  executionCounts: Record<AdaptExecutionClass, number>;
  targetOperations: AdaptTargetOperation[];
  deferred: Array<{ reason: string; count: number }>;
  deferredCount: number;
  governedTargetCount: number;
}

export interface AdaptOperationContext {
  operation: string;
  inCurrentSlice: boolean;
  role: "PRIMARY" | "DEPENDENCY" | "ELIGIBLE" | null;
  executionClass: AdaptExecutionClass | null;
  governance: OperationDisposition | null;
  classificationConsistent: boolean;
}

const EXECUTION_CLASS_OPERATIONS: Array<[
  AdaptExecutionClass,
  keyof Pick<
    TargetOperationSlice,
    "agent_native_operations" | "builtin_operations" | "target_adapter_operations" | "platform_specific_operations"
  >,
]> = [
  ["AGENT_NATIVE", "agent_native_operations"],
  ["PRODUCT_BUILTIN", "builtin_operations"],
  ["TARGET_ADAPTER", "target_adapter_operations"],
  ["PLATFORM_SPECIFIC", "platform_specific_operations"],
];

function uniqueCount(values: string[]): number {
  return new Set(values).size;
}

export function buildAdaptContextLens(
  slice: TargetOperationSlice,
  governance: OperationDisposition[],
): AdaptContextLens {
  const primary = new Set(slice.primary_operations);
  const dependencies = new Set(slice.dependency_operations);
  const workset = new Set([...primary, ...dependencies]);
  const governanceByOperation = new Map(
    governance.map((item) => [item.current_operation, item]),
  );
  const targetOperations = [...new Set(slice.target_adapter_operations)]
    .sort((left, right) => left.localeCompare(right))
    .map((operation): AdaptTargetOperation => ({
      operation,
      role: primary.has(operation)
        ? "PRIMARY"
        : dependencies.has(operation)
          ? "DEPENDENCY"
          : "ELIGIBLE",
      governance: governanceByOperation.get(operation) || null,
    }));
  const deferred = Object.entries(slice.deferred_summary)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));

  return {
    worksetCount: workset.size,
    executionCounts: {
      AGENT_NATIVE: uniqueCount(slice.agent_native_operations),
      PRODUCT_BUILTIN: uniqueCount(slice.builtin_operations),
      TARGET_ADAPTER: uniqueCount(slice.target_adapter_operations),
      PLATFORM_SPECIFIC: uniqueCount(slice.platform_specific_operations),
    },
    targetOperations,
    deferred,
    deferredCount: deferred.reduce((total, item) => total + item.count, 0),
    governedTargetCount: targetOperations.filter((item) => item.governance).length,
  };
}

export function getAdaptOperationContext(
  operation: string,
  slice: TargetOperationSlice,
  governance: OperationDisposition[],
): AdaptOperationContext {
  const isPrimary = slice.primary_operations.includes(operation);
  const isDependency = slice.dependency_operations.includes(operation);
  const executionMatches = EXECUTION_CLASS_OPERATIONS
    .filter(([, key]) => slice[key].includes(operation))
    .map(([executionClass]) => executionClass);
  const executionClass = executionMatches.length === 1 ? executionMatches[0] : null;
  const disposition = governance.find((item) => item.current_operation === operation) || null;

  return {
    operation,
    inCurrentSlice: isPrimary || isDependency || executionMatches.length > 0,
    role: isPrimary ? "PRIMARY" : isDependency ? "DEPENDENCY" : executionMatches.length ? "ELIGIBLE" : null,
    executionClass,
    governance: disposition,
    classificationConsistent: executionMatches.length <= 1
      && (!executionClass || !disposition || disposition.execution_class === executionClass),
  };
}

export function filterCapabilitiesToTargetAdapter(
  capabilities: CapabilitySummary[],
  slice: TargetOperationSlice | null,
): CapabilitySummary[] {
  if (!slice) return capabilities;
  const targetOperations = new Set(slice.target_adapter_operations);
  return capabilities.filter((item) => targetOperations.has(item.operation));
}

export function filterOperationGovernance(
  items: OperationDisposition[],
  filters: OperationGovernanceFilters,
): OperationDisposition[] {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.semanticLayer !== "ALL" && item.semantic_layer !== filters.semanticLayer) return false;
    if (filters.executionClass !== "ALL" && item.execution_class !== filters.executionClass) return false;
    if (filters.migrationStatus !== "ALL" && item.migration_status !== filters.migrationStatus) return false;
    if (!query) return true;
    return [
      item.current_operation,
      item.current_layer,
      item.semantic_layer,
      item.execution_class,
      item.future_capability || "",
      item.migration_status,
      item.migration_reason,
    ].some((value) => value.toLowerCase().includes(query));
  });
}

export function summarizeOperationGovernance(
  items: OperationDisposition[],
): OperationGovernanceSummary {
  const semanticLayers: OperationGovernanceSummary["semanticLayers"] = {
    product_control: 0,
    hardware: 0,
    os: 0,
    middleware: 0,
    application: 0,
  };
  const executionClasses: OperationGovernanceSummary["executionClasses"] = {
    AGENT_NATIVE: 0,
    PRODUCT_BUILTIN: 0,
    TARGET_ADAPTER: 0,
    PLATFORM_SPECIFIC: 0,
  };
  const migrationStatuses: OperationGovernanceSummary["migrationStatuses"] = {
    PLANNED: 0,
    RETAINED: 0,
    DEFERRED: 0,
  };

  for (const item of items) {
    semanticLayers[item.semantic_layer] += 1;
    executionClasses[item.execution_class] += 1;
    migrationStatuses[item.migration_status] += 1;
  }

  return {
    total: items.length,
    mappedFutureCapabilities: items.filter((item) => item.future_capability).length,
    semanticLayers,
    executionClasses,
    migrationStatuses,
  };
}

export function paginateOperationGovernance(
  items: OperationDisposition[],
  requestedPage: number,
  pageSize = 20,
): OperationGovernancePage {
  const boundedPageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / boundedPageSize));
  const page = Math.min(pageCount, Math.max(1, Math.floor(requestedPage) || 1));
  const startIndex = (page - 1) * boundedPageSize;
  const pageItems = items.slice(startIndex, startIndex + boundedPageSize);
  return {
    items: pageItems,
    page,
    pageSize: boundedPageSize,
    total: items.length,
    pageCount,
    start: items.length ? startIndex + 1 : 0,
    end: startIndex + pageItems.length,
  };
}
