<script lang="ts" context="module">
    interface RepoCapture {
        bottomPanelOpen: boolean
        bottomPanelSelectedTab: number
        historyPanel: HistoryCapture
    }
</script>
<script lang="ts">
    import { onMount, tick } from 'svelte'

    import { afterNavigate, disableScrollHandling, goto } from '$app/navigation'
    import { page } from '$app/stores'
    import LoadingSpinner from '$lib/LoadingSpinner.svelte'
    import { fetchSidebarFileTree, FileTreeProvider, type FileTreeLoader } from '$lib/repo/api/tree'
    import HistoryPanel, { type Capture as HistoryCapture } from '$lib/repo/HistoryPanel.svelte'
    import SidebarToggleButton from '$lib/repo/SidebarToggleButton.svelte'
    import { sidebarOpen } from '$lib/repo/stores'
    import Separator, { getSeparatorPosition } from '$lib/Separator.svelte'
    import { scrollAll } from '$lib/stores'

    import type { LayoutData, Snapshot } from './$types'
    import FileTree from './FileTree.svelte'
    import type { Scalars } from '$lib/graphql-operations'
    import type { GitHistory_HistoryConnection, RepoPage_ReferenceLocationConnection } from './layout.gql'
    import Tabs from '$lib/Tabs.svelte'
    import TabPanel from '$lib/TabPanel.svelte'
    import ReferencePanel from './ReferencePanel.svelte'
    import {createBottomPanelStore, createReferenceStore} from '$lib/repo/stores'

    export let data: LayoutData

    export const snapshot: Snapshot<RepoCapture> = {
        capture() {
            return {
                bottomPanelOpen: $bottomPanelStore.open,
                bottomPanelSelectedTab: $bottomPanelStore.selectedTab,
                historyPanel: historyPanel?.capture(),
            }
        },
        async restore(data) {
            console.log('restore', data)
            bottomPanelStore.setOpen(data.bottomPanelOpen, data.bottomPanelSelectedTab)
            // Wait until DOM was updated to possibly show the history panel
            await tick()
            if (data.historyPanel) {
                historyPanel?.restore(data.historyPanel)
            }
        },
    }

    const fileTreeLoader: FileTreeLoader = args =>
        fetchSidebarFileTree(args).then(
            ({ root, values }) =>
                new FileTreeProvider({
                    root,
                    values,
                    loader: fileTreeLoader,
                    ...args,
                })
        )

    async function updateFileTreeProvider(repoID: Scalars['ID']['input'], commitID: string, parentPath: string) {
        const result = await data.fileTree
        if (!result) {
            treeProvider = null
            return
        }
        const { root, values } = result

        // Do nothing if update was called with new arguments in the meantime
        if (
            repoID !== data.resolvedRevision.repo.id ||
            commitID !== data.resolvedRevision.commitID ||
            parentPath !== data.parentPath
        ) {
            return
        }
        treeProvider = new FileTreeProvider({
            root,
            values,
            repoID,
            commitID,
            loader: fileTreeLoader,
        })
    }

    function fetchCommitHistory(afterCursor: string | null) {
        // Only fetch more commits if there are more commits and if we are not already
        // fetching more commits.
        if ($commitHistoryQuery && !$commitHistoryQuery.loading && commitHistory?.pageInfo?.hasNextPage) {
            data.commitHistoryQuery.fetchMore({
                variables: {
                    afterCursor: afterCursor,
                },
            })
        }
    }

    async function selectTab(event: { detail: number | null }) {
        if (event.detail === null) {
            const url = new URL($page.url)
            url.searchParams.delete('rev')
            await goto(url, { replaceState: true, keepFocus: true, noScroll: true })
            bottomPanelStore.setOpen(false)
        } else {
            bottomPanelStore.setOpen(true, event.detail)
        }

    }

    const sidebarSize = getSeparatorPosition('repo-sidebar', 0.2)
    const bottomPanelStore = createBottomPanelStore()
    const referenceStore = createReferenceStore()
    let treeProvider: FileTreeProvider | null = null
    let historyPanel: HistoryPanel
    let commitHistory: GitHistory_HistoryConnection | null
    let references: RepoPage_ReferenceLocationConnection | null

    $: ({ revision, parentPath, resolvedRevision } = data)
    // Only update the file tree provider (which causes the tree to rerender) when repo, revision/commit or file path
    // update
    $: updateFileTreeProvider(resolvedRevision.repo.id, resolvedRevision.commitID, parentPath)
    $: commitHistoryQuery = data.commitHistoryQuery
    $: if (commitHistoryQuery) {
        // Reset commit history when the query observable changes. Without
        // this we are showing the commit history of the previously selected
        // file/folder until the new commit history is loaded.
        commitHistory = null
    }
    $: commitHistory = $commitHistoryQuery?.data.node?.__typename === 'Repository'
            ? $commitHistoryQuery.data.node.commit?.ancestors ?? null
            : null
    $: sidebarWidth = `max(200px, ${$sidebarSize * 100}%)`

    // The currently active reference
    $: activeReference = referenceStore.current
    // The observable query to fetch references (due to infinite scrolling)
    $: referenceQuery = $activeReference ? data.getReferencesQuery({
        repoName: $activeReference.repoName,
        commitID: $activeReference.commitID,
        filePath: $activeReference.filePath,
        character: $activeReference.character,
        line: $activeReference.line,
    }) : null
    $: if (referenceQuery) {
        // Reset commit history when the query observable changes. Without
        // this we are showing the commit history of the previously selected
        // file/folder until the new commit history is loaded.
        references = null
    }
    $: references = $referenceQuery?.data?.repository?.commit?.blob?.lsif?.references ?? null
    $: referencesLoading = referenceQuery && !references || $referenceQuery?.loading || false

    onMount(() => {
        // We want the whole page to be scrollable and hide page and repo navigation
        scrollAll.set(true)
        return () => scrollAll.set(false)
    })

    afterNavigate(() => {
        // Prevents SvelteKit from resetting the scroll position to the top
        disableScrollHandling()
    })
</script>

<section>
    <div class="sidebar" class:open={$sidebarOpen} style:min-width={sidebarWidth} style:max-width={sidebarWidth}>
        <h3>
            <SidebarToggleButton />&nbsp; Files
        </h3>
        {#if treeProvider}
            <FileTree revision={revision ?? ''} {treeProvider} selectedPath={$page.params.path ?? ''} />
        {:else}
            <LoadingSpinner center={false} />
        {/if}
    </div>
    {#if $sidebarOpen}
        <Separator currentPosition={sidebarSize} />
    {/if}
    <div class="main">
        <slot />
        <div class="bottom-panel" class:open={$bottomPanelStore.open}>
            <Tabs selected={$bottomPanelStore.open ? $bottomPanelStore.selectedTab : null} toggable on:select={selectTab}>
                <TabPanel title="History">
                    {#key $page.params.path}
                        <HistoryPanel
                            bind:this={historyPanel}
                            history={commitHistory}
                            loading={$commitHistoryQuery?.loading ?? true}
                            fetchMore={fetchCommitHistory}
                            enableInlineDiffs={$page.route.id?.includes('/blob/') ?? false}
                        />
                    {/key}
                </TabPanel>
                <TabPanel title="References">
                    <ReferencePanel
                        connection={references}
                        symbolBreadcrumbs={$referenceStore.references}
                        loading={referencesLoading}
                        on:selectSymbol={event => {
                            const index = $referenceStore.references.findIndex(
                                breadcrumb => breadcrumb.symbolName === event.detail
                            )
                            if (index !== -1) {
                                referenceStore.select(index)
                            }
                        }}
                        on:more={() => {
                            if ($referenceQuery && !$referenceQuery.loading && references?.pageInfo?.hasNextPage) {
                                referenceQuery?.fetchMore({
                                    variables: {
                                        after: references.pageInfo.endCursor,
                                    },
                                })
                            }
                        }}
                    />
                </TabPanel>
            </Tabs>
        </div>
    </div>
</section>

<style lang="scss">
    section {
        display: flex;
        flex: 1;
        flex-shrink: 0;
        background-color: var(--code-bg);
        min-height: 100vh;
    }

    .sidebar {
        &.open {
            display: flex;
            flex-direction: column;
        }
        display: none;
        overflow: hidden;
        background-color: var(--body-bg);
        padding: 0.5rem;
        padding-bottom: 0;
        position: sticky;
        top: 0px;
        max-height: 100vh;
    }

    .main {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    h3 {
        display: flex;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .bottom-panel {
        position: sticky;
        bottom: 0px;
        background-color: var(--code-bg);
        --align-tabs: flex-start;
        border-top: 1px solid var(--border-color);
        max-height: 50vh;
        overflow: hidden;

        :global(.tabs) {
            height: 100%;
            max-height: 100%;
            overflow: hidden;
        }

        :global(.tabs-header) {
            border-bottom: 1px solid var(--border-color);
        }

        &.open {
            height: 30vh;
        }
    }
</style>
