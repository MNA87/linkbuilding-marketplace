// A customer made from a mail order (Binnengekomen) can't log in until they
// accept the invitation (Admin → Klanten → Uitnodigen). Until then they hear
// nothing from the platform: no automatic mails, nothing that points to it;
// they only get the mails you send them yourself.
export function knowsPlatform(customer: { emailVerifiedAt: Date | null }): boolean {
  return customer.emailVerifiedAt !== null;
}
