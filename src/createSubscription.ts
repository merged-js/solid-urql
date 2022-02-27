import type { TypedDocumentNode as DocumentNode, TypedDocumentNode } from '@graphql-typed-document-node/core'
import type { Accessor } from 'solid-js'
import { createResource, onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { pipe, subscribe } from 'wonka'

import { useClient } from './UrqlProvider'

interface CreateSubscriptionOptions<Data, Variables> {
  subscription: DocumentNode | TypedDocumentNode<Data, Variables> | string
  variables?: Variables
}

export const createSubscription = <Data extends object = Record<string, any>, Variables extends object = {}>(
  options: CreateSubscriptionOptions<Data, Variables> | Accessor<CreateSubscriptionOptions<Data, Variables>>
) => {
  const client = useClient()

  if (!client) {
    throw new Error(`Please wrap your component in a <UrqlProvider>`)
  }

  const [resource] = createResource<Data, CreateSubscriptionOptions<Data, Variables>>(options, opts => {
    const [state, setState] = createStore<Data>({} as any)

    let resolved = false
    return new Promise(resolve => {
      const { unsubscribe } = pipe(
        client.subscription<Data, Variables>(opts.subscription, opts.variables),
        subscribe(({ data, error }) => {
          if (error) {
            throw error
          }

          if (!data) {
            return
          }
          if (!resolved) {
            resolved = true
            setState(data)
            resolve(state as Data)
          } else {
            setState(reconcile(data!))
          }
        })
      )

      onCleanup(unsubscribe)
    })
  })

  return resource
}
