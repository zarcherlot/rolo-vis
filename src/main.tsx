import React from "react";
import { createRoot } from "react-dom/client";
import { WorkbenchV2 } from "./WorkbenchV2";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root mount point");
createRoot(root).render(<WorkbenchV2 />);
