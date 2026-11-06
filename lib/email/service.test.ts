import { describe, expect, it, vi } from "vitest";
import { getEmailConfiguration } from "./config";
import { EmailUnavailableError, sendAccountLink, type EmailProvider } from "./service";

describe("email boundary", () => {
  it("keeps delivery disabled unless explicitly enabled and fully configured", () => {
    const enabledEnvironment = {
      EMAIL_FEATURE_ENABLED: "true",
      EMAIL_PROVIDER: "unselected-provider",
      EMAIL_API_KEY: "test-secret",
      EMAIL_FROM_ADDRESS: "no-reply@example.test",
    };

    expect(getEmailConfiguration(enabledEnvironment).enabled).toBe(false);
    expect(getEmailConfiguration(enabledEnvironment, "another-provider").enabled).toBe(false);
    expect(getEmailConfiguration({ ...enabledEnvironment, EMAIL_FEATURE_ENABLED: "false" }, "unselected-provider").enabled).toBe(false);
    expect(getEmailConfiguration({ ...enabledEnvironment, EMAIL_API_KEY: "" }, "unselected-provider").enabled).toBe(false);
    expect(getEmailConfiguration(enabledEnvironment, "unselected-provider").enabled).toBe(true);
  });

  it("provides configurable, conservative link and resend limits", () => {
    const defaults = getEmailConfiguration({}).limits;
    expect(defaults).toEqual({
      verificationLinkLifetimeSeconds: 86400,
      passwordResetLinkLifetimeSeconds: 3600,
      resendCooldownSeconds: 60,
      perEmailHourlyLimit: 3,
      perIpHourlyLimit: 10,
      perIpDailyLimit: 30,
    });
    expect(getEmailConfiguration({}).singleUseLinkTokens).toBe(true);
    expect(getEmailConfiguration({
      EMAIL_VERIFICATION_TTL_SECONDS: "43200",
      EMAIL_PASSWORD_RESET_TTL_SECONDS: "1800",
      EMAIL_PER_IP_DAILY_LIMIT: "invalid",
    }).limits).toMatchObject({
      verificationLinkLifetimeSeconds: 43200,
      passwordResetLinkLifetimeSeconds: 1800,
      perIpDailyLimit: 30,
    });
  });

  it("sends only HTTPS (or local development) links and escapes HTML", async () => {
    const send = vi.fn<EmailProvider["send"]>().mockResolvedValue(undefined);
    const provider = { send };

    await sendAccountLink(provider, {
      to: "reader@example.test",
      purpose: "email-verification",
      link: "https://blog.example.test/verify?token=a%26b",
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].purpose).toBe("email-verification");
    expect(send.mock.calls[0][0].html).toContain("https://blog.example.test/verify?token=a%26b");
    await expect(sendAccountLink(provider, {
      to: "reader@example.test",
      purpose: "password-reset",
      link: "javascript:alert(1)",
    })).rejects.toThrow("HTTPS");
    expect(send).toHaveBeenCalledOnce();
  });

  it("maps provider failures to a generic error without exposing provider details", async () => {
    const provider = {
      send: vi.fn<EmailProvider["send"]>().mockRejectedValue(new Error("API key secret-provider-response")),
    };

    let failure: unknown;
    try {
      await sendAccountLink(provider, {
        to: "reader@example.test",
        purpose: "password-reset",
        link: "https://blog.example.test/reset?token=opaque-test-token",
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(EmailUnavailableError);
    expect(JSON.stringify(failure)).not.toContain("secret-provider-response");
    expect((failure as Error).message).toBe("邮件服务暂时不可用，请稍后重试。");
  });
});
