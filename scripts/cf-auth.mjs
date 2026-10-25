// Local convenience only. Never persists or displays Cloudflare credentials.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
const args = process.argv.slice(2);
let token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  try {
    const text = await readFile(
      `${homedir()}/.config/.wrangler/config/default.toml`,
      "utf8",
    );
    token = text.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  } catch {}
}
const p = spawn("node", ["node_modules/cf/bin/cf", ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...(token ? { CLOUDFLARE_API_TOKEN: token } : {}),
    CLOUDFLARE_ACCOUNT_ID: "05838fc24a89cefaf6081066cca13544",
  },
});
p.on("exit", (code) => process.exit(code ?? 1));
