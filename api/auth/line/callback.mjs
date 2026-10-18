import { createCallbackHandler } from "../../_lib/authRoutes.mjs";
import { config } from "../../_lib/config.mjs";
import { adminAuth, adminDb } from "../../_lib/firebaseAdmin.mjs";

export async function GET(request) {
    const handle = createCallbackHandler({
        auth: adminAuth(),
        db: adminDb(),
        cookieSecret: config.cookieSecret(),
        channelId: config.lineLoginChannelId(),
        channelSecret: config.lineLoginChannelSecret(),
    });
    return handle(request);
}
