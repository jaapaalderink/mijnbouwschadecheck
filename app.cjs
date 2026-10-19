// CommonJS entry point for CloudLinux/Passenger (mijn.host).
// Register the TypeScript runtime before importing the application.
const path = require("node:path");
process.chdir(__dirname);
require("tsx/cjs");
require(path.join(__dirname, "server", "index.ts"));
