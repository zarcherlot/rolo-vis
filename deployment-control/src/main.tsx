import React from "react";
import { createRoot } from "react-dom/client";
import { DeploymentControlApp } from "./DeploymentControlApp";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root mount point");
createRoot(root).render(<DeploymentControlApp />);
