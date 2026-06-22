import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdminMock, gateStatsMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  gateStatsMock: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/stats", () => ({ gateStats: gateStatsMock }));

import { GET } from "./route";

const SAMPLE = {
  checkedIn: 3,
  paidTickets: 10,
  remaining: 7,
  outstandingDoorPasses: 2,
  doorCollections: { count: 1, amount: 500 },
};

beforeEach(() => {
  requireAdminMock.mockReset().mockResolvedValue("admin-1");
  gateStatsMock.mockReset().mockResolvedValue(SAMPLE);
});

describe("GET /admin/m/api/stats", () => {
  it("returns the stats JSON for an admin", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(gateStatsMock).toHaveBeenCalledOnce();
    expect(await res.json()).toEqual(SAMPLE);
  });

  it("returns 401 and does not compute stats when not an admin", async () => {
    requireAdminMock.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(gateStatsMock).not.toHaveBeenCalled();
  });
});
