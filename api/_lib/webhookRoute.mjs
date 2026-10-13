import { replyMessage, verifySignature } from "./lineApi.mjs";
import { handleEvent } from "./bot.mjs";
import { MSG, textMessage } from "./messages.mjs";

// POST /api/line/webhook
export function createWebhookHandler({ channelSecret, accessToken, store, limits, fetchImpl = fetch, clock = () => new Date() }) {
    return async (request) => {
        // ต้องตรวจลายเซ็นกับ byte ดิบ ก่อนแปลงเป็น JSON
        const raw = Buffer.from(await request.arrayBuffer());
        if (!verifySignature(raw, request.headers.get("x-line-signature"), channelSecret)) {
            return new Response("invalid signature", { status: 401 });
        }
        let body;
        try {
            body = JSON.parse(raw.toString("utf8"));
        } catch {
            return new Response("bad request", { status: 400 });
        }

        const webUrl = new URL(request.url).origin;
        for (const event of body.events || []) {
            try {
                const messages = await handleEvent(event, { store, now: clock(), limits, webUrl });
                await replyMessage(event.replyToken, messages, accessToken, fetchImpl);
            } catch (err) {
                // ไม่ใส่ข้อความของผู้ใช้หรือ token ลง log
                console.error("LINE event failed:", err?.message);
                if (event.replyToken) {
                    await replyMessage(event.replyToken, [textMessage(MSG.systemError)], accessToken, fetchImpl).catch(() => {});
                }
            }
        }
        // ตอบ 200 เสมอเมื่อลายเซ็นถูก ไม่งั้น LINE จะถือว่า webhook พัง
        return new Response("ok");
    };
}
