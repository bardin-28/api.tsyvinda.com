/** Paged list contract of every admin resource endpoint: `GET /admin/<resource>`. */
export interface ListResponse<T> {
  items: T[];
  total: number;
}

export type SortOrder = 'ASC' | 'DESC';
