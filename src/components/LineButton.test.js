import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { startLine } from "../firebase/lineAuth";
import LineButton from "./LineButton";

jest.mock("../firebase/lineAuth", () => ({ startLine: jest.fn() }));

beforeEach(() => {
    startLine.mockReset();
    startLine.mockResolvedValue(undefined);
});

test("runs prepare before starting LINE", async () => {
    const order = [];
    const prepare = jest.fn(async () => order.push("prepare"));
    startLine.mockImplementation(async () => order.push("start"));
    render(<LineButton mode="link" prepare={prepare}>เชื่อมบัญชี LINE</LineButton>);
    fireEvent.click(screen.getByRole("button", { name: "เชื่อมบัญชี LINE" }));
    await waitFor(() => expect(order).toEqual(["prepare", "start"]));
    expect(startLine).toHaveBeenCalledWith({ mode: "link", returnTo: undefined });
});

test("a Firebase auth error from prepare is shown as its own message and LINE is not started", async () => {
    const onError = jest.fn();
    const prepare = () => Promise.reject(Object.assign(new Error("x"), { code: "auth/invalid-credential" }));
    render(<LineButton mode="link" prepare={prepare} onError={onError} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("อีเมลหรือรหัสผ่านไม่ถูกต้อง"));
    expect(startLine).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeEnabled();
});

test("other failures keep the generic LINE failure message", async () => {
    const onError = jest.fn();
    startLine.mockRejectedValue(new Error("line-start-500"));
    render(<LineButton onError={onError} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง"));
});

test("can be disabled by the parent", () => {
    render(<LineButton disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
});
