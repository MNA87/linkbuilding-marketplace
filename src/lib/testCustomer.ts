// A single shared fake customer every admin-created test order hangs off
// of (see src/app/admin/orders/test/actions.ts) — its email is how
// Admin -> Orders recognizes and labels these orders as TEST, so it lives
// in its own plain module: the action file is "use server" and can only
// export async functions, not a plain constant.
export const TEST_CUSTOMER_EMAIL = "testklant@nugevonden.nl";
