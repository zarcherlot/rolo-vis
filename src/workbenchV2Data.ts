export const DEMO_ROBOT = {
  robot_id: "AMR-07",
  model: "Nav2 · ROS 2 Humble",
  adapter: "native Probe · read-only",
  environment: "Ubuntu 22.04 · ROS 2 Humble",
  status: "online" as const,
  observed_at: "2026-08-20T10:24:31Z",
  discovery_id: "probe-20260820-102431",
};

export const DEMO_TOPOLOGY = {
  observed_at: "2026-08-20T10:24:31Z",
  nodes: [
    { id: "lidar", label: "LiDAR", subtitle: "Ouster OS1-64", layer: "Hardware", status: "observed", icon: "sensor", evidence: 6 },
    { id: "imu", label: "IMU", subtitle: "VectorNav VN-300", layer: "Hardware", status: "observed", icon: "pulse", evidence: 4 },
    { id: "encoders", label: "Wheel Encoders", subtitle: "x2", layer: "Hardware", status: "observed", icon: "target", evidence: 3 },
    { id: "camera", label: "Camera", subtitle: "Intel RealSense D455", layer: "Hardware", status: "unobserved", icon: "camera", evidence: 2 },
    { id: "battery", label: "Battery", subtitle: "48V · 30Ah", layer: "Hardware", status: "observed", icon: "storage", evidence: 5 },
    { id: "jetson", label: "Jetson Orin NX", subtitle: "Ubuntu 22.04", layer: "Linux", status: "observed", icon: "cpu", evidence: 9 },
    { id: "network", label: "Network", subtitle: "eth0 · 1 Gbps", layer: "Linux", status: "observed", icon: "network", evidence: 4 },
    { id: "timesync", label: "Time Sync", subtitle: "chrony", layer: "Linux", status: "observed", icon: "clock", evidence: 5 },
    { id: "storage", label: "Storage", subtitle: "NVMe 512GB", layer: "Linux", status: "observed", icon: "storage", evidence: 3 },
    { id: "agentd", label: "robot-agentd", subtitle: "Lifecycle", layer: "ROS / Middleware", status: "observed", icon: "cube", evidence: 11 },
    { id: "scan", label: "/scan", subtitle: "sensor_msgs/LaserScan", layer: "ROS / Middleware", status: "observed", icon: "radio", evidence: 8 },
    { id: "localization", label: "Localization", subtitle: "robot_localization", layer: "ROS / Middleware", status: "partial", icon: "crosshair", evidence: 12, confidence: 0.78 },
    { id: "tftree", label: "TF Tree", subtitle: "tf2", layer: "ROS / Middleware", status: "observed", icon: "tree", evidence: 7 },
    { id: "mapserver", label: "Map Server", subtitle: "nav2_map_server", layer: "ROS / Middleware", status: "observed", icon: "cube", evidence: 6 },
    { id: "navigation", label: "Navigation", subtitle: "nav2_bringup", layer: "Application", status: "partial", icon: "route", evidence: 8 },
    { id: "controller", label: "nav2_controller", subtitle: "DWB", layer: "Application", status: "failed", icon: "crosshair", evidence: 7 },
    { id: "behavior", label: "Behavior Server", subtitle: "nav2_behavior_tree", layer: "Application", status: "unobserved", icon: "nodes", evidence: 2 },
    { id: "mission", label: "Mission Executor", subtitle: "robot_mission", layer: "Application", status: "unobserved", icon: "nodes", evidence: 3 },
    { id: "safety", label: "Safety Monitor", subtitle: "safety_monitor", layer: "Application", status: "observed", icon: "shield", evidence: 10 },
  ],
  edges: [["lidar", "jetson", "observed"], ["imu", "jetson", "observed"], ["encoders", "network", "observed"], ["camera", "storage", "declared"], ["battery", "agentd", "observed"], ["jetson", "agentd", "observed"], ["network", "scan", "observed"], ["timesync", "localization", "observed"], ["storage", "tftree", "declared"], ["agentd", "navigation", "declared"], ["scan", "localization", "observed"], ["tftree", "localization", "observed"], ["localization", "controller", "observed"], ["navigation", "controller", "observed"], ["localization", "behavior", "declared"], ["mapserver", "mission", "declared"], ["tftree", "safety", "declared"]].map(([source, target, state], index) => ({ id: `edge-${index}`, source, target, state, className: `edge-${state}` })),
} as const;

export const DEMO_CAPABILITIES = [
  { operation: "host.status.read", layer: "Linux", title: "Read host status", description: "Bounded CPU, memory and runtime facts", availability: "VERIFIED", risk: "R0" },
  { operation: "ros.graph.inspect", layer: "Middleware", title: "Inspect ROS graph", description: "Read observed nodes, topics and actions", availability: "VERIFIED", risk: "R0" },
  { operation: "ros.tf.tree", layer: "Middleware", title: "Read TF frame tree", description: "Return a bounded frame graph", availability: "AVAILABLE", risk: "R0" },
  { operation: "hw.sensor.read", layer: "Hardware", title: "Read sensor metadata", description: "Discover bounded sensor identity", availability: "UNKNOWN", risk: "R1" },
  { operation: "app.navigation.goal.send", layer: "Application", title: "Send navigation goal", description: "Not exposed in read-only session", availability: "UNAVAILABLE", risk: "R2" },
] as const;

export const DEMO_MHS = [
  { device_id: "lidar-0", device_class: "sensor", model: "Ouster OS1-64", discovery: "DISCOVERED", registration: "REGISTERED", tool_state: "VERIFIED", callable: true, manifest_sha256: "demo-manifest-lidar", driver_sha256: "demo-driver-lidar" },
  { device_id: "imu-0", device_class: "sensor", model: "VectorNav VN-300", discovery: "DISCOVERED", registration: "REGISTERED", tool_state: "VERIFIED", callable: true, manifest_sha256: "demo-manifest-imu", driver_sha256: "demo-driver-imu" },
  { device_id: "camera-0", device_class: "sensor", model: "Intel RealSense D455", discovery: "DISCOVERED", registration: "PENDING", tool_state: "DISCOVERED_UNVERIFIED", callable: false, manifest_sha256: "demo-manifest-camera", driver_sha256: "demo-driver-camera" },
  { device_id: "base-controller", device_class: "controller", model: "ros2_control", discovery: "DISCOVERED", registration: "REGISTERED", tool_state: "UNAVAILABLE", callable: false, manifest_sha256: "demo-manifest-base", driver_sha256: "demo-driver-base" },
  { device_id: "camera-legacy", device_class: "sensor", model: "RealSense D435", discovery: "DISCOVERED", registration: "STALE", tool_state: "STALE", callable: false, manifest_sha256: "demo-manifest-stale", driver_sha256: "demo-driver-stale" },
] as const;

export const DEMO_EVIDENCE = [
  { id: "ev_graph", title: "ROS graph observation", summary: "17 nodes, 30 topics and 12 actions observed in a bounded Probe.", source: "target evidence", kind: "Observed fact", integrity: "verified", time: "10:24:31", ref: "artifact:target-evidence-current" },
  { id: "ev_localization", title: "Localization route is partial", summary: "Provider and runtime were observed; semantic stability remains partial.", source: "discovery Probe", kind: "Limitation", integrity: "validated", time: "10:24:31", ref: "artifact:discovery-summary" },
  { id: "ev_readonly", title: "Read-only boundary held", summary: "No motion, executor or mutation command was invoked.", source: "session audit", kind: "Boundary", integrity: "verified", time: "10:24:31", ref: "artifact:session-audit" },
  { id: "ev_surface", title: "Tool Surface digest", summary: "Target-bound descriptors were published with a session digest.", source: "native tool session", kind: "Contract", integrity: "verified", time: "10:24:31", ref: "artifact:tool-surface" },
] as const;
