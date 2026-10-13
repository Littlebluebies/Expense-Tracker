// ข้อมูลที่ฝังในปุ่ม (postback.data) — LINE จำกัดไม่เกิน 300 ตัวอักษร
export const MAX_POSTBACK = 300;

export function encodePostback(fields) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) params.set(key, String(value));
    }
    const data = params.toString();
    if (data.length > MAX_POSTBACK) throw new Error(`postback data too long (${data.length})`);
    return data;
}

export const decodePostback = (data) => Object.fromEntries(new URLSearchParams(data || ""));
