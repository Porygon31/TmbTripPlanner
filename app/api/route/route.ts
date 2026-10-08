import { handleORS } from "@/lib/tmb/server";
export const POST = (request: Request) => handleORS(request, "route");
