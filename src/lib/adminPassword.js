export const ADMIN_PASSWORD_KEY = "safeguard_admin_password";

export function getAdminPassword() {
  return localStorage.getItem(ADMIN_PASSWORD_KEY) || "";
}

export function setAdminPassword(value) {
  localStorage.setItem(ADMIN_PASSWORD_KEY, value);
}

export function hasAdminPassword() {
  return Boolean(getAdminPassword());
}
