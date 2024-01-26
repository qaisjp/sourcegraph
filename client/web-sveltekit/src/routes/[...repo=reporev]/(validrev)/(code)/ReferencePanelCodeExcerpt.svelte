<script lang="ts" context="module">
    // Mulltiple locations will point to the same file, we only need to compute the
    // lines once.
    const lineCache = new Map<string, readonly string[]>()

    function getLines(location: ReferencePanelCodeExcerpt_Location): readonly string[] {
        const { resource } = location
        const key = `${resource.repository.id}:${resource.commit.oid}:${resource.path}`
        if (lineCache.has(key)) {
            return lineCache.get(key)!
        }
        const lines = resource.content.split(/\r?\n/)
        lineCache.set(key, lines)
        return lines
    }
</script>

<script lang="ts">
    import { observeIntersection } from "$lib/intersection-observer"

    import CodeExcerpt from "$lib/search/CodeExcerpt.svelte"
    import { fetchFileRangeMatches } from "$lib/search/api/highlighting"
import type { ReferencePanelCodeExcerpt_Location } from "./ReferencePanelCodeExcerpt.gql"

    export let location: ReferencePanelCodeExcerpt_Location

    let visible = false
    $: plaintextLines = location.range ? getLines(location).slice(location.range.start.line, location.range.end.line + 1) : []
    $: matches = location.range ? [{startLine: location.range.start.line, endLine: location.range.end.line, startCharacter: location.range.start.character, endCharacter: location.range.end.character}] : []

    let highlightedLines: Promise<string[]> | undefined

    $: if (location.range && visible) {
        highlightedLines = fetchFileRangeMatches({
            result: {
                repository: location.resource.repository.name,
                commit: location.resource.commit.oid,
                path: location.resource.path,
            },
            ranges: [{startLine: location.range.start.line, endLine: location.range.end.line + 1}],
        }).then(lines => lines[0])
    }
</script>

{#if location.range}
    <div use:observeIntersection on:intersecting={event => visible = event.detail}>
        {#await highlightedLines}
            <CodeExcerpt startLine={location.range.start.line} {plaintextLines} {matches}/>
        {:then highlightedHTMLRows}
            <CodeExcerpt startLine={location.range.start.line} {plaintextLines} {highlightedHTMLRows} {matches}/>
        {/await}
    </div>
{:else}
    <pre>(no content information)</pre>
{/if}

<style lang="scss">
</style>
