import type {
  CreateParams,
  DataProvider,
  DeleteManyParams,
  DeleteParams,
  GetListParams,
  GetManyParams,
  GetManyReferenceParams,
  GetOneParams,
  Identifier,
  RaRecord,
  UpdateManyParams,
  UpdateParams,
} from 'react-admin';
import type { DashboardStats, ListResponse } from '@tsyvinda/shared-types';
import { apiClient, toHttpError } from '../services/apiClient';

export interface AdminDataProvider extends DataProvider {
  getDashboard(): Promise<DashboardStats>;
}

async function call<T>(request: () => Promise<{ data: T }>): Promise<T> {
  try {
    const { data } = await request();
    return data;
  } catch (error) {
    throw toHttpError(error);
  }
}

/** What RA's FileInput/ImageInput puts in the form for a newly picked file. */
interface PickedFile {
  rawFile: File;
}

const isPickedFile = (value: unknown): value is PickedFile =>
  typeof value === 'object' && value !== null && (value as PickedFile).rawFile instanceof File;

/**
 * JSON unless the payload carries a picked file; then multipart (what the API's FileInterceptor
 * routes read). null/undefined fields are left out, other values sent as strings.
 */
export function toRequestBody(data: Record<string, unknown>): Record<string, unknown> | FormData {
  if (!Object.values(data).some(isPickedFile)) return data;

  const form = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    if (isPickedFile(value)) form.append(key, value.rawFile);
    else form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  return form;
}

// Filters travel as plain query params next to the paging/sort ones.
function listParams(params: {
  pagination?: { page: number; perPage: number };
  sort?: { field: string; order: string };
  filter?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...params.filter,
    ...(params.pagination && {
      page: params.pagination.page,
      perPage: params.pagination.perPage,
    }),
    ...(params.sort?.field && { sort: params.sort.field, order: params.sort.order }),
  };
}

// Generic REST provider for the `/<resource>[/:id]` contract; resources need no provider code.
// Cast once at the end: RA's methods are generic over the record type, the wire data is not.
export const dataProvider = {
  async getList(resource: string, params: GetListParams) {
    const data = await call(() =>
      apiClient.get<ListResponse<RaRecord>>(`/${resource}`, { params: listParams(params) }),
    );
    return { data: data.items, total: data.total };
  },

  async getOne(resource: string, params: GetOneParams) {
    const data = await call(() => apiClient.get<RaRecord>(`/${resource}/${params.id}`));
    return { data };
  },

  async getMany(resource: string, params: GetManyParams) {
    const records = await Promise.all(
      params.ids.map((id: Identifier) => call(() => apiClient.get<RaRecord>(`/${resource}/${id}`))),
    );
    return { data: records };
  },

  async getManyReference(resource: string, params: GetManyReferenceParams) {
    const data = await call(() =>
      apiClient.get<ListResponse<RaRecord>>(`/${resource}`, {
        params: listParams({ ...params, filter: { ...params.filter, [params.target]: params.id } }),
      }),
    );
    return { data: data.items, total: data.total };
  },

  async create(resource: string, params: CreateParams) {
    const data = await call(() =>
      apiClient.post<RaRecord>(`/${resource}`, toRequestBody(params.data)),
    );
    return { data };
  },

  async update(resource: string, params: UpdateParams) {
    const data = await call(() =>
      apiClient.patch<RaRecord>(`/${resource}/${params.id}`, toRequestBody(params.data)),
    );
    return { data };
  },

  async updateMany(resource: string, params: UpdateManyParams) {
    await Promise.all(
      params.ids.map((id: Identifier) =>
        call(() => apiClient.patch(`/${resource}/${id}`, params.data)),
      ),
    );
    return { data: params.ids };
  },

  async delete(resource: string, params: DeleteParams) {
    await call(() => apiClient.delete(`/${resource}/${params.id}`));
    return { data: params.previousData ?? { id: params.id } };
  },

  async deleteMany(resource: string, params: DeleteManyParams) {
    await Promise.all(
      params.ids.map((id: Identifier) => call(() => apiClient.delete(`/${resource}/${id}`))),
    );
    return { data: params.ids };
  },

  getDashboard() {
    return call(() => apiClient.get<DashboardStats>('/dashboard'));
  },
} as AdminDataProvider;
