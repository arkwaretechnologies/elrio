/** Main mark in `public/` — sidebar, login, favicon, PWA. */
export const APP_LOGO_PATH = "/El Rio Logo.png" as const;

/** Use in `href`, `metadata.icons`, and `manifest` `src` (spaces encoded). */
export const APP_LOGO_URL_ENCODED = encodeURI(APP_LOGO_PATH);
