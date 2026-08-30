/**
 * Application Version Configuration
 * Dynamically resolves the version string across local development, GitHub CI/CD deployments, and production builds.
 */

declare const __APP_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;
declare const __GIT_COMMIT__: string | undefined;

export const getAppVersion = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_VERSION) {
    return import.meta.env.VITE_APP_VERSION;
  }
  if (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) {
    return __APP_VERSION__;
  }
  return '26.0.0';
};

export const APP_VERSION = getAppVersion();
export const APP_BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();
export const APP_GIT_COMMIT = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : '';
