import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdminMock, checkInMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  checkInMock: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/tickets", () => ({ checkInTicket: checkInMock }));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/admin/scan/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAdminMock.mockReset().mockResolvedValue("admin-1");
  checkInMock.mockReset().mockResolvedValue({
    result: "valid",
    holderName: "Ayşe Yılmaz",
    code: "KF-7Q4X2",
    checkedInAt: new Date("2026-09-01T18:00:00.000Z"),
  });
});

describe("POST /admin/scan/verify", () => {
  it("checks in a valid token and returns the result", async () => {
    const res = await POST(req({ token: "tok-123" }));
    expect(res.status).toBe(200);
    expect(checkInMock).toHaveBeenCalledWith("tok-123");
    const json = await res.json();
    expect(json.result).toBe("valid");
    expect(json.holderName).toBe("Ayşe Yılmaz");
  });

  it("returns 401 and does not check in when not an admin", async () => {
    requireAdminMock.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await POST(req({ token: "tok-123" }));
    expect(res.status).toBe(401);
    expect(checkInMock).not.toHaveBeenCalled();
  });

  it("treats an empty/whitespace token as invalid without hitting the DB", async () => {
    const res = await POST(req({ token: "   " }));
    expect(checkInMock).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.result).toBe("invalid");
  });
});
