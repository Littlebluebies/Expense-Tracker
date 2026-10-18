// ค่าลับและค่าตั้งต้นทั้งหมดมาจาก environment variables (Vercel และ .env.local)

const need = (name) => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing environment variable ${name}`);
    return value;
};

const intOr = (value, fallback) => {
    const n = Number.parseInt(value ?? "", 10);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
};

// เกณฑ์จำกัดการใช้บอท (ปรับรายคนได้ที่ lineUsage/{uid} ใน Firebase Console)
export const readLimits = (env = process.env) => ({
    perMinute: intOr(env.LINE_LIMIT_PER_MINUTE, 20),
    perDay: intOr(env.LINE_LIMIT_PER_DAY, 300),
});

export const config = {
    lineLoginChannelId: () => need("LINE_LOGIN_CHANNEL_ID"),
    lineLoginChannelSecret: () => need("LINE_LOGIN_CHANNEL_SECRET"),
    lineChannelSecret: () => need("LINE_CHANNEL_SECRET"),
    lineAccessToken: () => need("LINE_CHANNEL_ACCESS_TOKEN"),
    cookieSecret: () => need("AUTH_COOKIE_SECRET"),
    serviceAccount: () => JSON.parse(need("FIREBASE_SERVICE_ACCOUNT")),
    limits: () => readLimits(),
};
