import type { AdminPage, AdminPageDraftUpdate } from '@tsyvinda/shared-types';

/** Form values → `PATCH /admin/pages/:key` (the draft, its languages and the version read). */
export function toPageDraftPayload(values: AdminPage): AdminPageDraftUpdate {
  return { version: values.version, draft: values.draft, enabledLocales: values.enabledLocales };
}
