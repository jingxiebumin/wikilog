import "server-only";

export type EmailPurpose = "email-verification" | "password-reset";

export type EmailLimits = {
  verificationLinkLifetimeSeconds: number;
  passwordResetLinkLifetimeSeconds: number;
  resendCooldownSeconds: number;
  perEmailHourlyLimit: number;
  perIpHourlyLimit: number;
  perIpDailyLimit: number;
};

export type EmailConfiguration = {
  enabled: boolean;
  provider?: string;
  apiKey?: string;
  fromAddress?: string;
  singleUseLinkTokens: true;
  limits: EmailLimits;
};

export type EmailEnvironment = Record<string, string | undefined>;

const defaults: EmailLimits = {
  verificationLinkLifetimeSeconds: 24 * 60 * 60,
  passwordResetLinkLifetimeSeconds: 60 * 60,
  resendCooldownSeconds: 60,
  perEmailHourlyLimit: 3,
  perIpHourlyLimit: 10,
  perIpDailyLimit: 30,
};

const readPositiveInteger = (value: string | undefined, fallback: number) => {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function getEmailConfiguration(
  environment: EmailEnvironment = process.env,
  availableProvider?: string,
): EmailConfiguration {
  const provider = environment.EMAIL_PROVIDER?.trim() || undefined;
  const apiKey = environment.EMAIL_API_KEY?.trim() || undefined;
  const fromAddress = environment.EMAIL_FROM_ADDRESS?.trim() || undefined;
  const limits: EmailLimits = {
    verificationLinkLifetimeSeconds: readPositiveInteger(
      environment.EMAIL_VERIFICATION_TTL_SECONDS,
      defaults.verificationLinkLifetimeSeconds,
    ),
    passwordResetLinkLifetimeSeconds: readPositiveInteger(
      environment.EMAIL_PASSWORD_RESET_TTL_SECONDS,
      defaults.passwordResetLinkLifetimeSeconds,
    ),
    resendCooldownSeconds: readPositiveInteger(environment.EMAIL_RESEND_COOLDOWN_SECONDS, defaults.resendCooldownSeconds),
    perEmailHourlyLimit: readPositiveInteger(environment.EMAIL_PER_ADDRESS_HOURLY_LIMIT, defaults.perEmailHourlyLimit),
    perIpHourlyLimit: readPositiveInteger(environment.EMAIL_PER_IP_HOURLY_LIMIT, defaults.perIpHourlyLimit),
    perIpDailyLimit: readPositiveInteger(environment.EMAIL_PER_IP_DAILY_LIMIT, defaults.perIpDailyLimit),
  };

  return {
    enabled: environment.EMAIL_FEATURE_ENABLED === "true"
      && provider === availableProvider
      && Boolean(provider && apiKey && fromAddress),
    provider,
    apiKey,
    fromAddress,
    singleUseLinkTokens: true,
    limits,
  };
}
