import api from './axios';

/**
 * Cliente CRUD genérico para los recursos REST del backend.
 * El backend actualiza con PATCH (no PUT): `update` envía solo los campos modificados.
 */
export interface CrudApi<TEntity, TCreate, TUpdate> {
  list: () => Promise<TEntity[]>;
  get: (id: number) => Promise<TEntity>;
  create: (payload: TCreate) => Promise<TEntity>;
  update: (id: number, payload: TUpdate) => Promise<TEntity>;
  remove: (id: number) => Promise<void>;
}

/** @param resource Ruta relativa a /api, por ejemplo `/users`. */
export function createCrudApi<TEntity, TCreate, TUpdate = Partial<TCreate>>(
  resource: string,
): CrudApi<TEntity, TCreate, TUpdate> {
  return {
    list: async () => (await api.get<TEntity[]>(resource)).data,
    get: async (id) => (await api.get<TEntity>(`${resource}/${id}`)).data,
    create: async (payload) => (await api.post<TEntity>(resource, payload)).data,
    update: async (id, payload) =>
      (await api.patch<TEntity>(`${resource}/${id}`, payload)).data,
    remove: async (id) => {
      await api.delete(`${resource}/${id}`);
    },
  };
}
