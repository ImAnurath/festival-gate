import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdminMock, collectMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  collectMock: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/applications", () => ({ collectAtDoorAndCheckIn: collectMock }));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/admin/scan/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAdminMock.mockReset().mockResolvedValue("admin-1");
  collectMock.mockReset().mockResolvedValue({
    result: "valid",
    holderName: "Ali Veli",
    code: "KF-AAAAA",
    checkedInAt: new Date("2026-09-01T18:00:00.000Z"),
  });
});

describe("POST /admin/scan/collect", () => {
  it("collects + checks in and returns the result", async () => {
    const res = await POST(req({ token: "tok-1", applicationId: "app-1" }));
    expect(res.status).toBe(200);
    expect(collectMock).toHaveBeenCalledWith("app-1", "tok-1");
    const json = await res.json();
    expect(json.result).toBe("valid");
  });

  it("returns 401 and does not collect when not an admin", async () => {
    requireAdminMock.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await POST(req({ token: "tok-1", applicationId: "app-1" }));
    expect(res.status).toBe(401);
    expect(collectMock).not.toHaveBeenCalled();
  });

  it("treats a missing token or applicationId as invalid without collecting", async () => {
    const res = await POST(req({ token: "tok-1" }));
    expect(collectMock).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.result).toBe("invalid");
  });
});
