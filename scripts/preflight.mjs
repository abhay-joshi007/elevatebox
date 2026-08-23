import fs from "node:fs";
import { config, ensureDirectories, validateConfiguration } from "../src/config.js";

ensureDirectories();
const missing = validateConfiguration();

console.log("ElevateBox live-call preflight");
console.log(`Target phone: ${config.targetPhoneNumber}`);
console.log(`Public base URL: ${config.appBaseUrl}`);
console.log(`Resume present: ${fs.existsSync(`${config.assetsDir}/resume.pdf`) ? "yes" : "no"}`);

if (missing.length) {
  console.error("\nNot ready. Missing or invalid configuration:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exitCode = 1;
  process.exit();
}

console.log("\nReady for live deployment and call testing.");
