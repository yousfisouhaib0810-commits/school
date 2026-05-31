const PLACEHOLDER_EMAIL_DOMAINS = new Set(["example.com", "example.net", "example.org", "your-domain.com"]);

export function isConfiguredValue(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return !normalized.includes("placeholder") && !normalized.includes("replace-with");
}

export function getEmailDomain(emailFrom: string): string | null {
  const emailAddress = emailFrom.includes("<") && emailFrom.includes(">")
    ? emailFrom.slice(emailFrom.indexOf("<") + 1, emailFrom.indexOf(">"))
    : emailFrom;
  const [, domain] = emailAddress.trim().split("@");
  return domain?.toLowerCase() ?? null;
}

export function isUsableEmailSender(emailFrom: string | undefined): emailFrom is string {
  if (!isConfiguredValue(emailFrom)) {
    return false;
  }

  const domain = getEmailDomain(emailFrom);
  return Boolean(domain && !PLACEHOLDER_EMAIL_DOMAINS.has(domain));
}
