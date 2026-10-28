import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/runtime-config", () => ({ apiUrl: "/api" }));
import { changePassword } from "@/domain/auth/api";
afterEach(() => vi.unstubAllGlobals());
describe("password API", () => {
  it("sends credentials with the authenticated token and accepts an empty 204", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      changePassword("token", "old-password", "new-password"),
    ).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/api/me/password",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
        body: JSON.stringify({
          current_password: "old-password",
          new_password: "new-password",
        }),
      }),
    );
  });
  it("displays the API explanation for a rejected current password", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              message: "Senha atual incorreta ou conta inativa.",
            }),
            { status: 400 },
          ),
        ),
    );
    await expect(
      changePassword("token", "wrong", "new-password"),
    ).rejects.toThrow("Senha atual incorreta ou conta inativa.");
  });
});
