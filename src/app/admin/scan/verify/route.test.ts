import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdminMock, scanMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  scanMock: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/tickets", () => ({ scanTicket: scanMock }));

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
  scanMock.mockReset().mockResolvedValue({
    result: "valid",
    holderName: "Ayşe Yılmaz",
    code: "KF-7Q4X2",
    checkedInAt: new Date("2026-09-01T18:00:00.000Z"),
  });
});

describe("POST /admin/scan/verify", () => {
  it("scans a valid token and returns the result", async () => {
    const res = await POST(req({ token: "tok-123" }));
    expect(res.status).toBe(200);
    expect(scanMock).toHaveBeenCalledWith("tok-123");
    const json = await res.json();
    expect(json.result).toBe("valid");
    expect(json.holderName).toBe("Ayşe Yılmaz");
  });

  it("returns 401 and does not scan when not an admin", async () => {
    requireAdminMock.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await POST(req({ token: "tok-123" }));
    expect(res.status).toBe(401);
    expect(scanMock).not.toHaveBeenCalled();
  });

  it("treats an empty/whitespace token as invalid without hitting the DB", async () => {
    const res = await POST(req({ token: "   " }));
    expect(scanMock).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.result).toBe("invalid");
  });

  it("passes an unpaid result straight through", async () => {
    scanMock.mockResolvedValue({
      result: "unpaid",
      holderName: "Ali Veli",
      code: "KF-AAAAA",
      quantity: 3,
      amount: 1500,
      applicationId: "app-1",
    });
    const res = await POST(req({ token: "tok-123" }));
    const json = await res.json();
    expect(json.result).toBe("unpaid");
    expect(json.amount).toBe(1500);
    expect(json.applicationId).toBe("app-1");
  });
});
