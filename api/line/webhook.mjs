import { createWebhookHandler } from "../_lib/webhookRoute.mjs";
import { createFirestoreStore } from "../_lib/store.mjs";
import { adminDb } from "../_lib/firebaseAdmin.mjs";
import { config } from "../_lib/config.mjs";

export async function POST(request) {
    const handle = createWebhookHandler({
        channelSecret: config.lineChannelSecret(),
        accessToken: config.lineAccessToken(),
        store: createFirestoreStore(adminDb()),
        limits: config.limits(),
    });
    return handle(request);
}
