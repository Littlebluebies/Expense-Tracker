import { createStartHandler } from "../../_lib/authRoutes.mjs";
import { config } from "../../_lib/config.mjs";
import { adminAuth } from "../../_lib/firebaseAdmin.mjs";

export async function POST(request) {
    const handle = createStartHandler({
        auth: adminAuth(),
        cookieSecret: config.cookieSecret(),
        channelId: config.lineLoginChannelId(),
    });
    return handle(request);
}
