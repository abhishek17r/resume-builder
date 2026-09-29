import { useMemo } from 'react'
import { useStore } from '../store'
import { vaultTags } from './sync'

// The vault's tags (full definitions) and a lookup by id.
export function useVaultTags() {
  const tags = useStore(s => s.vault.tags)
  return useMemo(() => {
    const list = vaultTags({ tags })
    return { tags: list, byId: Object.fromEntries(list.map(t => [t.id, t])) }
  }, [tags])
}
