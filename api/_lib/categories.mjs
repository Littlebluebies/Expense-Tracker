// หมวดหมู่ฝั่ง server (ต้องตรงกับ src/constants/categories.js — มีเทสต์คุม)
// short = ชื่อบนปุ่มใน LINE (quick reply ยาวได้ไม่เกิน 20 ตัวอักษร)
export const CATEGORIES = [
    { key: "food", label: "อาหาร/เครื่องดื่ม", short: "อาหาร/เครื่องดื่ม", type: "expense" },
    { key: "travel", label: "เดินทาง", short: "เดินทาง", type: "expense" },
    { key: "shopping", label: "ช้อปปิ้ง", short: "ช้อปปิ้ง", type: "expense" },
    { key: "bills", label: "ค่าน้ำ/ไฟ/เน็ต/โทรศัพท์", short: "น้ำ/ไฟ/เน็ต/โทร", type: "expense" },
    { key: "housing", label: "ค่าที่พัก", short: "ค่าที่พัก", type: "expense" },
    { key: "health", label: "สุขภาพ", short: "สุขภาพ", type: "expense" },
    { key: "entertainment", label: "บันเทิง", short: "บันเทิง", type: "expense" },
    { key: "education", label: "การศึกษา", short: "การศึกษา", type: "expense" },
    { key: "other", label: "อื่นๆ", short: "อื่นๆ", type: "expense" },
    { key: "salary", label: "เงินเดือน", short: "เงินเดือน", type: "income" },
    { key: "bonus", label: "โบนัส", short: "โบนัส", type: "income" },
    { key: "freelance", label: "งานเสริม", short: "งานเสริม", type: "income" },
    { key: "income", label: "รายรับอื่นๆ", short: "รายรับอื่นๆ", type: "income" },
];

export const EXPENSE = CATEGORIES.filter((c) => c.type === "expense");
export const INCOME = CATEGORIES.filter((c) => c.type === "income");

export const categoryOf = (key) => CATEGORIES.find((c) => c.key === key) || null;
export const isCategory = (key) => categoryOf(key) !== null;
export const typeOf = (key) => categoryOf(key)?.type ?? "expense";
