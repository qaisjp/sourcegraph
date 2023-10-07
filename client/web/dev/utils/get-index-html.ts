import { readFileSync, writeFileSync } from 'fs'
import path from 'path'

import type { WebpackPluginFunction } from 'webpack'

import type { SourcegraphContext } from '../../src/jscontext'
import { WEB_BUILD_MANIFEST_FILENAME } from '../esbuild/manifestPlugin'

import { createJsContext, ENVIRONMENT_CONFIG, HTTPS_WEB_SERVER_URL, STATIC_INDEX_PATH } from '.'

const { NODE_ENV, STATIC_ASSETS_PATH } = ENVIRONMENT_CONFIG

const WEB_BUILD_MANIFEST_PATH = path.resolve(STATIC_ASSETS_PATH, WEB_BUILD_MANIFEST_FILENAME)
export const HTML_INDEX_PATH = path.resolve(STATIC_ASSETS_PATH, 'index.html')

export const getWebBuildManifest = (): WebBuildManifest =>
    JSON.parse(readFileSync(WEB_BUILD_MANIFEST_PATH, 'utf-8')) as WebBuildManifest

export interface WebBuildManifest {
    /** Main JS bundle */
    'main.js': string
    /** Main CSS bundle, only used in production mode */
    'main.css': string
    /** Embed entry bundle */
    'embed.js'?: string
    /** If script files should be treated as JS modules. Required for esbuild bundle. */
    isModule?: boolean
    /** The node env value `production | development` */
    environment?: 'development' | 'production'
}

interface GetHTMLPageOptions {
    manifestFile: WebBuildManifest
    /**
     * Used to inject dummy `window.context` in integration tests.
     */
    jsContext?: SourcegraphContext
    /**
     * Used to inject `window.context` received from the API proxy.
     */
    jsContextScript?: string
}

/**
 * Returns an HTML page similar to `cmd/frontend/internal/app/ui/app.html` but when running
 * without the `frontend` service.
 *
 * Note: This page should be kept as close as possible to `app.html` to avoid any inconsistencies
 * between our development server and the actual production server.
 */
export function getIndexHTML(options: GetHTMLPageOptions): string {
    const { manifestFile, jsContext, jsContextScript } = options

    const { 'main.js': mainBundle, 'main.css': mainBundleCSS, isModule } = manifestFile

    return `
<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Sourcegraph</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, viewport-fit=cover" />
        <meta name="referrer" content="origin-when-cross-origin"/>
        <meta name="color-scheme" content="light dark"/>
        ${mainBundleCSS ? `<link rel="stylesheet" href="${mainBundleCSS}">` : ''}
        ${
            ENVIRONMENT_CONFIG.SOURCEGRAPHDOTCOM_MODE
                ? '<script src="https://js.sentry-cdn.com/ae2f74442b154faf90b5ff0f7cd1c618.min.js" crossorigin="anonymous"></script>'
                : ''
        }
    </head>
    <body>
        <div id="root"></div>
        <script>
            // Optional value useful for checking if index.html is created by HtmlWebpackPlugin with the right NODE_ENV.
            window.webpackBuildEnvironment = '${NODE_ENV}'

            ${
                jsContextScript ||
                `
                // Required mock of the JS context object.
                window.context = ${JSON.stringify(
                    jsContext ?? createJsContext({ sourcegraphBaseUrl: `${HTTPS_WEB_SERVER_URL}` })
                )}
            `
            }
        </script>

        <script src="${mainBundle}" ${isModule ? 'type="module"' : ''}></script>
    </body>
</html>
`
}

export const writeIndexHTMLPlugin: WebpackPluginFunction = compiler => {
    compiler.hooks.done.tap('WriteIndexHTMLPlugin', () => {
        writeFileSync(STATIC_INDEX_PATH, getIndexHTML({ manifestFile: getWebBuildManifest() }), 'utf-8')
    })
}
