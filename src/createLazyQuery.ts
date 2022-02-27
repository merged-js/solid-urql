import { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { CombinedError } from '@urql/core'
import { DocumentNode } from 'graphql'
import { createResource, createSignal, onCleanup, untrack } from 'solid-js'
import type { Accessor } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { pipe, subscribe } from 'wonka'

import { useClient } from './UrqlProvider'

interface CreateQueryOptions<Data, Variables> {
  query: DocumentNode | TypedDocumentNode<Data, Variables> | string
  variables?: Variables
  pause?: boolean
}

export const createLazyQuery = <Data extends object = Record<string, any>, Variables extends object = {}>(
  options: CreateQueryOptions<Data, Variables> | Accessor<CreateQueryOptions<Data, Variables>>
) => {
  const client = useClient()

  if (!client) {
    throw new Error(`Please wrap your component in a <UrqlProvider>`)
  }

  let resolveResultPromise: ((data: Data) => void) | null = null
  let rejectResultPromise: ((error: CombinedError) => void) | null = null
  const [executionOptions, setExecutionOptions] = createSignal<false | CreateQueryOptions<Data, Variables>>(false)
  const [resource] = createResource<Data, CreateQueryOptions<Data, Variables>>(executionOptions, opts => {
    const query = client.query<Data, Variables>(opts.query, opts.variables)
    const [state, setState] = createStore<Data>({} as any)

    let resolved = false
    return new Promise(resolve => {
      const { unsubscribe } = pipe(
        query,
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

          if (!resolved) {
            resolved = true
            if (resolveResultPromise) {
              resolveResultPromise(data)
              resolveResultPromise = null
            }
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
      let nextOptions = typeof options === 'function' ? untrack(options) : options
      if (variables) {
        nextOptions = {
          ...nextOptions,
          variables: {
            ...nextOptions.variables,
            ...variables,
          },
        }
      }
      setExecutionOptions(nextOptions)
      return new Promise<Data>((resolve, reject) => {
        resolveResultPromise = resolve
        rejectResultPromise = reject
      })
    },
    resource,
  ] as const
}
