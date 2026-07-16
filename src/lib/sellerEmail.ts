// A seller's login email is derived from their name, consistently, in both the
// create-seller API and the login page — so no email needs to be stored/exposed.
export function sellerEmail(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') + '@sellers.local'
}
