const toSnakeCase = (str) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');

const safeStorage = {
  getItem: (key) => { try { return window.localStorage.getItem(key); } catch { return null; } },
  setItem: (key, value) => { try { window.localStorage.setItem(key, value); } catch {} },
  removeItem: (key) => { try { window.localStorage.removeItem(key); } catch {} },
};

const getAppParamValue = (paramName, options = {}) => {
  const storageKey = `ai_safeguard_${toSnakeCase(paramName)}`;
  const url = new URL(window.location.href);
  const urlValue = url.searchParams.get(paramName);
  if (urlValue !== null) {
    safeStorage.setItem(storageKey, urlValue);
    return urlValue;
  }
  return safeStorage.getItem(storageKey) || options.defaultValue || '';
};

export const appParams = {
  appId: getAppParamValue('app_id', { defaultValue: import.meta.env.VITE_APP_ID || 'local' }),
  token: getAppParamValue('access_token'),
  functionsVersion: getAppParamValue('functions_version', { defaultValue: import.meta.env.VITE_FUNCTIONS_VERSION || '' }),
  appBaseUrl: getAppParamValue('app_base_url', { defaultValue: import.meta.env.VITE_APP_BASE_URL || '' }),
};
