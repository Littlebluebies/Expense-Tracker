import { render, waitFor } from "@testing-library/react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../firebase/config";
import LineCallback from "./LineCallback";

const mockNavigate = jest.fn();
const mockAuthState = { user: null, refresh: jest.fn() };

// virtual: Jest 27 ของ CRA หา react-router-dom v7 (ใช้ "exports") ไม่เจอ
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("firebase/auth", () => ({ signInWithCustomToken: jest.fn() }));
jest.mock("../firebase/config", () => ({ auth: { currentUser: null } }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuthState }));

const NOW = Date.now();
const arrive = (hash) => window.history.replaceState(null, "", `/auth/line${hash}`);
const storeNonce = (cn, exp = NOW + 60000) => localStorage.setItem("line_cn", JSON.stringify({ cn, exp }));

beforeEach(() => {
    localStorage.clear();
    auth.currentUser = null;
    mockNavigate.mockReset();
    mockAuthState.user = null;
    mockAuthState.refresh = jest.fn(async () => {});
    signInWithCustomToken.mockReset();
    signInWithCustomToken.mockResolvedValue({});
});

test("a token link opened in a browser that did not start the login is refused", async () => {
    storeNonce("mine-0123456789abcdef");
    arrive("#token=evil&returnTo=%2Fdashboard&cn=theirs-0123456789abcd");
    render(<LineCallback />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/?line_error=failed", { replace: true }));
    expect(signInWithCustomToken).not.toHaveBeenCalled();
    expect(localStorage.getItem("line_cn")).toBeNull();
    expect(window.location.hash).toBe("");
});

test("a refused link while someone is signed in goes back to Settings", async () => {
    auth.currentUser = { uid: "u1" };
    arrive("#token=t&returnTo=%2Fsettings");
    render(<LineCallback />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/settings?line_error=failed", { replace: true }));
    expect(signInWithCustomToken).not.toHaveBeenCalled();
});

test("a matching nonce signs in, refreshes the auth context, then goes to returnTo", async () => {
    const order = [];
    signInWithCustomToken.mockImplementation(async () => order.push("signIn"));
    mockAuthState.refresh = jest.fn(async () => order.push("refresh"));
    mockAuthState.user = { uid: "u1" };
    storeNonce("mine-0123456789abcdef");
    arrive("#token=tok&returnTo=%2Fsettings&cn=mine-0123456789abcdef");
    render(<LineCallback />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/settings", { replace: true }));
    expect(signInWithCustomToken).toHaveBeenCalledWith(auth, "tok");
    expect(order).toEqual(["signIn", "refresh"]);
    expect(localStorage.getItem("line_cn")).toBeNull();
});
