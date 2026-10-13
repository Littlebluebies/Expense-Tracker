// หมวดหมู่รายจ่าย/รายรับ (key ที่เก็บใน Firestore -> ชื่อที่แสดง)
// ไอคอนของแต่ละหมวดอยู่ที่ components/CategoryIcon.js
export const EXPENSE_CATEGORIES = [
    { key: "food", label: "อาหาร/เครื่องดื่ม" },
    { key: "travel", label: "เดินทาง" },
    { key: "shopping", label: "ช้อปปิ้ง" },
    { key: "bills", label: "ค่าน้ำ/ไฟ/เน็ต/โทรศัพท์" },
    { key: "housing", label: "ค่าที่พัก" },
    { key: "health", label: "สุขภาพ" },
    { key: "entertainment", label: "บันเทิง" },
    { key: "education", label: "การศึกษา" },
    { key: "other", label: "อื่นๆ" },
];

export const INCOME_CATEGORIES = [
    { key: "salary", label: "เงินเดือน" },
    { key: "bonus", label: "โบนัส" },
    { key: "freelance", label: "งานเสริม" },
    { key: "income", label: "รายรับอื่นๆ" }, // ข้อมูลเก่าใช้ "income"
];

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const getCategory = (key) => ALL.find((c) => c.key === key) || { key, label: key };
