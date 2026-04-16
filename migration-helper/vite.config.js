import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { analyzeFolderPath, analyzeFolderPathDeep } from "./local-analyzer.mjs";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function resolveFolderPath(body) {
  return String(body.path || body.folderPath || body.repoPath || "").trim();
}

function localQuickAnalysisPlugin() {
  return {
    name: "local-quick-analysis",
    configureServer(server) {
      const handleQuickAnalysis = async (req, res) => {
        try {
          const body = await readJsonBody(req);
          const folderPath = resolveFolderPath(body);
          if (!folderPath) {
            sendJson(res, 400, { error: "Folder path is required." });
            return;
          }

          const report = await analyzeFolderPath(folderPath, body);
          sendJson(res, 200, report);
        } catch (error) {
          sendJson(res, 500, { error: error?.message || "Quick analysis failed." });
        }
      };

      const handleDeepAnalysis = async (req, res) => {
        try {
          const body = await readJsonBody(req);
          const folderPath = resolveFolderPath(body);
          if (!folderPath) {
            sendJson(res, 400, { error: "Folder path is required." });
            return;
          }

          const report = await analyzeFolderPathDeep(folderPath, body);
          sendJson(res, 200, report);
        } catch (error) {
          sendJson(res, 500, { error: error?.message || "Deep analysis failed." });
        }
      };

      const analysisRoutes = new Set([
        "/api/quick-analysis",
        "/api/analyze/quick"
      ]);

      const deepRoutes = new Set([
        "/api/deep-analysis",
        "/api/analyze/deep"
      ]);

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        if (analysisRoutes.has(req.url)) {
          await handleQuickAnalysis(req, res);
          return;
        }

        if (deepRoutes.has(req.url)) {
          await handleDeepAnalysis(req, res);
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), localQuickAnalysisPlugin()]
});
