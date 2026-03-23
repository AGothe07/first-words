const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "src", "config", "dashboardBlueprint.ts");
const targetDir = path.join(root, "mobile", "src", "config");
const target = path.join(targetDir, "dashboardBlueprint.ts");

if (!fs.existsSync(source)) {
  console.error("[sync-dashboard-blueprint] Source file not found:", source);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
const content = fs.readFileSync(source, "utf8");
const banner = "// Generated from src/config/dashboardBlueprint.ts. Do not edit manually.\n";
fs.writeFileSync(target, banner + content, "utf8");

console.log("[sync-dashboard-blueprint] Synced to mobile/src/config/dashboardBlueprint.ts");
