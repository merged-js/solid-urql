import { Client } from '@urql/core'
import { ParentComponent, createContext, useContext } from 'solid-js'

const Context = createContext<Client | null>(null)

interface UrqlProviderProps {
  client: Client
}

export const UrqlProvider: ParentComponent<UrqlProviderProps> = props => (
  <Context.Provider value={props.client}>{props.children}</Context.Provider>
)

export const useClient = () => useContext(Context)
