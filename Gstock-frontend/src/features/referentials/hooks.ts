import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createReferential,
  listReferential,
  updateReferential,
  type ReferentialPayload,
  type ReferentialResource,
} from '@/lib/api/referentials'
import type { Id, ListParams } from '@/types/api'

export function useReferentialList<R extends ReferentialResource>(resource: R, params: ListParams) {
  return useQuery({
    queryKey: ['referentials', resource, params],
    queryFn: () => listReferential(resource, params),
    placeholderData: keepPreviousData,
  })
}

export function useSaveReferential<R extends ReferentialResource>(resource: R, id?: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ReferentialPayload<R>) =>
      id === undefined ? createReferential(resource, payload) : updateReferential(resource, id, payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['referentials', resource] }),
  })
}
