// lineLinks/{lineUserId} = { userId, displayName, linkedAt }
// ใช้ lineUserId เป็น id เอกสาร -> LINE หนึ่งบัญชีผูกได้กับบัญชีแอปเดียว (create() ซ้ำจะล้ม)
const ALREADY_EXISTS = 6;
const displayNameOf = (name) => (name || "").trim().slice(0, 50) || "ผู้ใช้ LINE";

export async function resolveLoginUser({ lineUserId, name }, { auth, db, now = new Date() }) {
    const ref = db.collection("lineLinks").doc(lineUserId);
    const snap = await ref.get();
    if (snap.exists) return snap.data().userId;

    const user = await auth.createUser({ displayName: displayNameOf(name) });
    try {
        await ref.create({ userId: user.uid, displayName: name, linkedAt: now });
        return user.uid;
    } catch (err) {
        // ไม่ว่าจะล้มเพราะอะไร บัญชีที่เพิ่งสร้างไม่มีใครใช้ -> ลบทิ้ง
        await auth.deleteUser(user.uid).catch(() => {});
        if (err.code !== ALREADY_EXISTS) throw err;
        // อีก request หนึ่ง (เช่น กดสองแท็บพร้อมกัน) ผูกไปก่อน -> ใช้บัญชีนั้น
        return (await ref.get()).data().userId;
    }
}

export async function linkLineAccount({ lineUserId, name, uid }, { db, now = new Date() }) {
    const ref = db.collection("lineLinks").doc(lineUserId);
    try {
        await ref.create({ userId: uid, displayName: name, linkedAt: now });
        return "linked";
    } catch (err) {
        if (err.code !== ALREADY_EXISTS) throw err;
        return (await ref.get()).data().userId === uid ? "linked" : "already_linked";
    }
}
