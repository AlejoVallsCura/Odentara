const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

let loaded = false;

function loadEnv() {
  if (loaded) {
    return;
  }

  const projectRoot = path.resolve(__dirname, "..", "..");
  const localEnvPath = path.join(projectRoot, ".env.local");
  const defaultEnvPath = path.join(projectRoot, ".env");

  if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath });
  }

  if (fs.existsSync(defaultEnvPath)) {
    dotenv.config({ path: defaultEnvPath, override: false });
  }

  loaded = true;
}

module.exports = {
  loadEnv,
};
