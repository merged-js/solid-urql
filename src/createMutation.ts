import type { TypedDocumentNode as DocumentNode, TypedDocumentNode } from '@graphql-typed-document-node/core'
import { CombinedError } from '@urql/core'
import { Accessor, onCleanup, createResource, createSignal, untrack } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { pipe, subscribe } from 'wonka'

import { useClient } from './UrqlProvider'

interface CreateMutationOptions<Data, Variables> {
  mutation: DocumentNode | TypedDocumentNode<Data, Variables> | string
  variables?: Variables
}

export const createMutation = <Data extends object = Record<string, any>, Variables extends object = {}>(
  options: CreateMutationOptions<Data, Variables> | Accessor<CreateMutationOptions<Data, Variables>>
) => {
  const client = useClient()

  if (!client) {
    throw new Error(`Please wrap your component in a <UrqlProvider>`)
  }

  let resolveResultPromise: ((data: Data) => void) | null = null
  let rejectResultPromise: ((error: CombinedError) => void) | null = null

  const [executionOptions, setExecutionOptions] = createSignal<false | CreateMutationOptions<Data, Variables>>(false)
  const [resource] = createResource(executionOptions, opts => {
    const [state, setState] = createStore<Data>({} as any)
    let resolved = false
    return new Promise<Data>(resolve => {
      const { unsubscribe } = pipe(
        client.mutation<Data, Variables>(opts.mutation, opts.variables),
        subscribe(({ data, error }) => {
          if (error) {
            if (rejectResultPromise) {
              rejectResultPromise(error)
              rejectResultPromise = null
            }
            throw error
          }

          if (!data) {
            return
          }

          if (resolveResultPromise) {
            resolveResultPromise(data!)
            resolveResultPromise = null
          }

          if (!resolved) {
            resolved = true
            setState(data)
            resolve(state as Data)
          } else {
            setState(reconcile(data))
          }
        })
      )

      onCleanup(unsubscribe)
    })
  })

  return [
    async (variables?: Variables) => {
      const baseOptions = typeof options === 'function' ? untrack(options) : options
      const mergedOptions = {
        ...baseOptions,
        variables: {
          ...baseOptions.variables,
          ...variables,
        },
      }

      setExecutionOptions(mergedOptions as any)
      return new Promise<Data>((resolve, reject) => {
        resolveResultPromise = resolve
        rejectResultPromise = reject
      })
    },
    resource,
  ] as const
}
