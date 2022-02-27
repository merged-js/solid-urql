import { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { DocumentNode } from 'graphql'
import { createResource, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { pipe, subscribe } from 'wonka'

import { useClient } from './UrqlProvider'

interface CreateQueryOptions<Data, Variables> {
  query: DocumentNode | TypedDocumentNode<Data, Variables> | string
  variables?: Variables
  pause?: boolean
}

export const createQuery = <Data extends object = Record<string, any>, Variables extends object = {}>(
  options: CreateQueryOptions<Data, Variables> | Accessor<CreateQueryOptions<Data, Variables>>
) => {
  const client = useClient()

  if (!client) {
    throw new Error(`Please wrap your component in a <UrqlProvider>`)
  }

  const optionsAccessor = () => {
    if (typeof options !== 'function') {
      if (options.pause) {
        console.warn(
          'you passed options.skip to createQuery, but the options are not an acccessor.\nThis query will never execute!\n\nReplace your options with a function.'
        )
      }

      return options
    }
    const opts = typeof options === 'function' ? options() : options
    if (opts.pause) {
      return false
    }
    return opts
  }

  const [resource] = createResource<Data, CreateQueryOptions<Data, Variables>>(optionsAccessor, opts => {
    const query = client.query<Data, Variables>(opts.query, opts.variables)
    const [state, setState] = createStore<Data>({} as any)

    let resolved = false
    return new Promise(resolve => {
      const { unsubscribe } = pipe(
        query,
        subscribe(({ data }) => {
          if (!data) {
            return
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

  return resource
}
