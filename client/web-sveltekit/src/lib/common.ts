// We want to limit the number of imported modules as much as possible
/* eslint-disable no-restricted-imports */
export { asError, createAggregateError } from '@sourcegraph/common/src/errors/errors'
export type { ErrorLike } from '@sourcegraph/common/src/errors/types'
export { isErrorLike } from '@sourcegraph/common/src/errors/utils'
export { highlightNodeMultiline } from '@sourcegraph/common/src/util/highlightNode'
export { logger } from '@sourcegraph/common/src/util/logger'
export { renderMarkdown } from '@sourcegraph/common/src/util/markdown/markdown'
export { memoizeObservable, resetAllMemoizationCaches } from '@sourcegraph/common/src/util/rxjs/memoizeObservable'
export { numberWithCommas, pluralize } from '@sourcegraph/common/src/util/strings'
export { encodeURIPathComponent } from '@sourcegraph/common/src/util/url'
