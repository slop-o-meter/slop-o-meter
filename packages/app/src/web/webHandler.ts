import { handle } from "hono/aws-lambda";
import app from "./web.js";

export const handler = handle(app);
