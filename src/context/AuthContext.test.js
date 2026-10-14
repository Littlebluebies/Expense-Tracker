import { act, render, screen } from "@testing-library/react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/config";
import { AuthProvider, useAuth } from "./AuthContext";

jest.mock("../firebase/config", () => ({ auth: { currentUser: null } }));
jest.mock("firebase/auth", () => ({ onAuthStateChanged: jest.fn(), signOut: jest.fn() }));

let emit; // callback ที่ AuthProvider ส่งให้ onAuthStateChanged
let ctx; // ค่าล่าสุดจาก useAuth()

function Probe() {
    ctx = useAuth();
    return <span data-testid="user">{ctx.user ? ctx.user.name : "none"}</span>;
}

const makeUser = (name, lastSignInTime) => ({
    uid: "u1",
    name,
    metadata: { lastSignInTime },
    reload: jest.fn(async () => {}),
});
const session = () => JSON.parse(localStorage.getItem("session"));

beforeEach(() => {
    localStorage.clear();
    auth.currentUser = null;
    onAuthStateChanged.mockImplementation((_auth, cb) => {
        emit = cb;
        return () => {};
    });
});

test("refresh picks up a new user object with the same uid (Firebase does not notify listeners)", async () => {
    render(
        <AuthProvider>
            <Probe />
        </AuthProvider>
    );
    const first = makeUser("A", "Tue, 13 Oct 2026 05:00:00 GMT");
    auth.currentUser = first;
    act(() => emit(first));
    expect(screen.getByTestId("user")).toHaveTextContent("A");
    expect(session().signIn).toBe("Tue, 13 Oct 2026 05:00:00 GMT");

    // signInWithCustomToken ด้วย uid เดิม -> Firebase สร้าง object ใหม่แต่ไม่เรียก onAuthStateChanged
    const again = makeUser("A2", "Wed, 14 Oct 2026 05:00:00 GMT");
    auth.currentUser = again;
    await act(async () => {
        await ctx.refresh();
    });

    expect(screen.getByTestId("user")).toHaveTextContent("A2");
    expect(ctx.user).toBe(again);
    expect(again.reload).toHaveBeenCalled();
    expect(session().signIn).toBe("Wed, 14 Oct 2026 05:00:00 GMT");
    expect(ctx).toEqual(expect.objectContaining({ loading: false, expired: false }));
});

test("refresh still re-renders when the user object is unchanged (updateProfile / reload)", async () => {
    render(
        <AuthProvider>
            <Probe />
        </AuthProvider>
    );
    const u = makeUser("A", "T1");
    auth.currentUser = u;
    act(() => emit(u));
    u.name = "Renamed";
    await act(async () => {
        await ctx.refresh();
    });
    expect(screen.getByTestId("user")).toHaveTextContent("Renamed");
});
