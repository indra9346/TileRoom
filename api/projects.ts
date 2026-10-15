import { createDispatcher } from "../server/lib/dispatch.js";
import projects from "./_routes/projects.js";
import projectRooms from "./_routes/projectRooms.js";
import designTemplates from "./_routes/designTemplates.js";

// GET|POST /api/projects, GET /api/projects/:id/rooms and /api/templates (see vercel.json rewrites).
export default createDispatcher({ list: projects, rooms: projectRooms, templates: designTemplates }, "list");
