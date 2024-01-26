<script lang="ts">
    import type { ReferencePanel_LocationConnection } from "./ReferencePanel.gql"
    import Scroller from '$lib/Scroller.svelte'
    import { displayRepoName, toPrettyBlobURL, toRepoURL } from "$lib/shared"
    import ReferencePanelCodeExcerpt from "./ReferencePanelCodeExcerpt.svelte"

    type Range = NonNullable<ReferencePanel_LocationConnection['nodes'][0]['range']>

    export let connection: ReferencePanel_LocationConnection

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

    $: locations = dedupeLocations(connection.nodes)
</script>

<Scroller margin={600}>
    <ul>
        {#each locations as location (location.canonicalURL)}
            <li>
                <span class="code"><ReferencePanelCodeExcerpt {location} /></span>
                <a href={getLocationHref(location)} class="location">
                        <span class="file">{location.resource.name}</span><!--
-->{#if location.range}
                        <span class="range">:{location.range.start.line + 1}:{location.range.start.character + 1}</span>
                    {/if}
                </a>
                <span class="repo">
                    <a href={toRepoURL({repoName: location.resource.repository.name, revision: location.resource.commit.oid})}>{displayRepoName(location.resource.repository.name)}</a></span>
            </li>
        {/each}
    </ul>
</Scroller>

<style lang="scss">
    ul {
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: auto auto auto auto;
        grid-column-gap: 1rem;
    }

    li {
        display: grid;
        grid-column: span 4;
        grid-template-columns: subgrid;
    }

    li + li {
        border-top: 1px solid var(--border-color);
    }

    .code {
        min-width: 0;
    }

    .location {
        display: grid;
        grid-column: span 2;
        grid-template-columns: subgrid;
        grid-column-gap: 0;
    }

    .location, .repo {
        color: var(--text-muted);
    }

    .repo {
        padding-right: 1rem;
    }

    .file {
        text-align: right;
    }

    .range {
        color: var(--oc-red-7);
        text-align: left;
    }

    a {
        color: inherit
    }

</style>
