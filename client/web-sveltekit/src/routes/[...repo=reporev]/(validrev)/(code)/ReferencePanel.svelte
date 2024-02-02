<script lang="ts">
    import type { ReferencePanel_LocationConnection } from "./ReferencePanel.gql"
    import Scroller from '$lib/Scroller.svelte'
    import { displayRepoName, toPrettyBlobURL, toRepoURL } from "$lib/shared"
    import ReferencePanelCodeExcerpt from "./ReferencePanelCodeExcerpt.svelte"
    import Tooltip from "$lib/Tooltip.svelte"
    import { createEventDispatcher } from "svelte"
    import { Button } from "$lib/wildcard"
    import type { Reference } from "$lib/repo/stores"
    import LoadingSpinner from "$lib/LoadingSpinner.svelte"

    type Range = NonNullable<ReferencePanel_LocationConnection['nodes'][0]['range']>

    export let symbolBreadcrumbs: Reference[]
    export let connection: ReferencePanel_LocationConnection|null
    export let loading: boolean

    const dispatch = createEventDispatcher<{ selectSymbol: string }>()

    function dedupeLocations(locations: ReferencePanel_LocationConnection['nodes']): ReferencePanel_LocationConnection['nodes'] {
        const seen = new Set<string>()
        return locations.filter(location => {
            const key = location.canonicalURL
            if (seen.has(key)) {
                return false
            }
            seen.add(key)
            return true
        })
    }

    function incrementLine(range: Range): Range  {
        return {
            start: {
                ...range.start,
                line: range.start.line + 1,
            },
            end: {
                ...range.end,
                line: range.end.line + 1,
            },
        }
    }

    function getLocationHref(location: ReferencePanel_LocationConnection['nodes'][0]) {
        return toPrettyBlobURL({
            repoName: location.resource.repository.name,
            revision: location.resource.commit.oid,
            commitID: location.resource.commit.oid,
            range: location.range ? incrementLine(location.range) : undefined,
            filePath: location.resource.path,
        })
    }

    $: locations = connection ? dedupeLocations(connection.nodes) : []
</script>

<div class="root">
    <div class="breadcrumbs">
        {#each symbolBreadcrumbs as breadcrumb}
            <span><Button variant="link" on:click={() => dispatch('selectSymbol', breadcrumb.symbolName)}>{breadcrumb.symbolName}</Button></span>
        {/each}
    </div>
    <div class="content">
        {#if loading}
            <LoadingSpinner center/>
        {:else if !connection}
            <p>Hover over a symbol and click "Find references" to see references to the symbol.</p>
        {:else}
            <Scroller margin={600} on:more>
                <ul>
                    {#each locations as location (location.canonicalURL)}
                        <li>
                            <a href={getLocationHref(location)} class="location">
                                <span class="code-file">
                                    <span class="code">
                                        <ReferencePanelCodeExcerpt {location} />
                                    </span>
                                    <span class="file">
                                        <Tooltip tooltip={location.resource.path}>
                                            <span>{location.resource.name}</span>
                                        </Tooltip>
                                    </span>
                                </span>
                                {#if location.range}
                                    <span class="range">:{location.range.start.line + 1}:{location.range.start.character + 1}</span>
                                {/if}
                                <span class="repo">{displayRepoName(location.resource.repository.name)}</span>
                            </a>
                        </li>
                    {/each}
                </ul>
            </Scroller>
        {/if}
    </div>
</div>

<style lang="scss">
    .root {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .content {
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    .breadcrumbs {
        border-bottom: 1px solid var(--border-color);

        span + span:before {
            content: '›',
        }

        span:last-child :global(button) {
            font-weight: bold;
        }
    }

    ul {
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: auto auto auto;
    }

    li {
        display: grid;
        grid-column: span 3;
        grid-template-columns: subgrid;
    }

    li + li {
        border-top: 1px solid var(--border-color);
    }

    a {
        display: grid;
        grid-column: span 3;
        grid-template-columns: subgrid;
        color: inherit;
        align-items: center;
        padding: 0.125rem 0;
        &:hover {
            text-decoration: none;
            background-color: var(--color-bg-2);
        }
    }

    .location, .repo {
        color: var(--text-muted);
    }

    .code-file {
        display: flex;
        align-items: center;
        min-width: 0;
        gap: 0.5rem;
    }

    .code {
        flex: 1;
        text-overflow: ellipsis;
        overflow: hidden;
    }

    .repo {
        padding: 0 1rem;
    }

    .file {
        text-align: right;
    }

    .range {
        color: var(--oc-red-7);
        text-align: left;
    }
</style>
