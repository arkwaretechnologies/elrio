/**
 * Outbound email (EOD reports, etc.) is off until you configure delivery
 * (e.g. Firebase Trigger Email) and set NEXT_PUBLIC_EMAIL_OUTBOUND_ENABLED=true.
 */
export function isEmailOutboundEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EMAIL_OUTBOUND_ENABLED === 'true';
}
