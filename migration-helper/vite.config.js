import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { analyzeFolderPath } from "./local-analyzer.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function pickFolderPath() {
  if (process.platform !== "win32") {
    throw new Error("Browse folder is currently available only on Windows dev runs.");
  }

  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Select a project folder to analyze'",
    "$dialog.ShowNewFolderButton = $false",
    "$result = $dialog.ShowDialog()",
    "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }"
  ].join("; ");

  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
    windowsHide: false
  });

  const selectedPath = String(stdout || "").trim();
  if (!selectedPath) {
    throw new Error("Folder selection was cancelled.");
  }
  return selectedPath;
}

function localQuickAnalysisPlugin() {
  return {
    name: "local-quick-analysis",
    configureServer(server) {
      server.middlewares.use("/api/pick-folder", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        try {
          const folderPath = await pickFolderPath();
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ path: folderPath }));
        } catch (error) {
          const message = error?.message || "Folder selection failed.";
          res.statusCode = message.includes("cancelled") ? 400 : 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: message }));
        }
      });

      server.middlewares.use("/api/quick-analysis", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        try {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          const folderPath = String(body.path || "").trim();
          if (!folderPath) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Folder path is required." }));
            return;
          }

          const report = await analyzeFolderPath(folderPath);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(report));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error?.message || "Quick analysis failed." }));
        }
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), localQuickAnalysisPlugin()]
});
