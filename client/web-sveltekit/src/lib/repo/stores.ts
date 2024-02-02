import { memoize } from 'lodash'
import { writable, derived,  type Readable, type Writable } from 'svelte/store'

import { createEmptySingleSelectTreeState, type TreeState } from '$lib/TreeView'
import { getContext, setContext } from 'svelte'

export const sidebarOpen = writable(true)

/**
 * Persistent, global state for the file sidebar. By keeping the state in memory we can
 * properly restore the UI when the user closes/opens the sidebar or navigates up the repo.
 */
export const getSidebarFileTreeStateForRepo = memoize(
    (_repoName: string): Writable<TreeState> => writable<TreeState>(createEmptySingleSelectTreeState()),
    repoName => repoName
)

const BOTTOM_PANEL_KEY = {}

export enum BottomPanelTab {
    // TODO(fkling): The tab component needs to be updated to support explicit tab keys
    History = 0,
    References = 1,
}

interface BottomPanelStore extends Readable<{open: boolean, selectedTab: BottomPanelTab}> {
    setOpen: (open: boolean, tab?: BottomPanelTab) => void
    setSelectedTab: (tab: BottomPanelTab) => void
}

/**
 * Conextual store for controlling the state of the bottom panel. This function
 * creates the store and stores it in the component's context.
 */
export function createBottomPanelStore(): BottomPanelStore {
    const {subscribe, update} = writable<{open: boolean, selectedTab: BottomPanelTab}>({open: false, selectedTab: BottomPanelTab.History})
    const store = {
        subscribe,
        setOpen(open: boolean, selectedTab?: BottomPanelTab) {
            update(state => ({...state, open, selectedTab: selectedTab ?? state.selectedTab}))
        },
        setSelectedTab(selectedTab: BottomPanelTab) {
            update(state => ({...state, selectedTab}))
        },
    }
    setContext<BottomPanelStore>(BOTTOM_PANEL_KEY, store)
    return store
}

export function getBottomPanelStore(): BottomPanelStore {
    return getContext<BottomPanelStore>(BOTTOM_PANEL_KEY)
}

const REFERENCE_STORE_KEY = {}

export interface Reference {
    symbolName: string
    repoName: string
    commitID: string
    filePath: string
    line: number
    character: number
}

interface ReferenceStore extends Readable<{references: Reference[]}> {
    current: Readable<Reference|undefined>
    select: (index: number) => void
    push: (reference: Reference) => void
}

export function createReferenceStore(): ReferenceStore {
    const { subscribe, update } = writable<{references: Reference[]}>({
        references: [],
    })

    const store = {
        subscribe,
        current: derived({subscribe}, $store => $store.references[$store.references.length - 1]),
        select(index: number) {
            update(state => ({
                ...state,
                references: state.references.slice(0, index + 1),
            }))
        },
        push(reference: Reference) {
            update(state => ({
                ...state,
                references: [...state.references, reference],
            }))
        }
    }

    setContext<ReferenceStore>(REFERENCE_STORE_KEY, store)
    return store
}

export function getReferenceStore(): ReferenceStore {
    return getContext<ReferenceStore>(REFERENCE_STORE_KEY)
}
