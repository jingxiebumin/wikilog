import { config } from "dotenv";
import { initializeAdminAccount } from "../lib/auth/admin-bootstrap";

config({ path: ".env.local" });
config({ path: ".env" });

const email = process.env.ADMIN_EMAIL;
const displayName = process.env.ADMIN_DISPLAY_NAME;
const password = process.env.ADMIN_PASSWORD;
if (!email || !displayName || !password) {
  throw new Error("ADMIN_EMAIL, ADMIN_DISPLAY_NAME and ADMIN_PASSWORD are required for the one-time admin bootstrap.");
}

const user = await initializeAdminAccount({ email, displayName, password });
process.stdout.write(`Initialized administrator ${user.email}.\n`);
