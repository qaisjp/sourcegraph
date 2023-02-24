import { FC, useCallback, useEffect } from 'react'

import { Observable } from 'rxjs'

import { FilteredConnection, FilteredConnectionQueryArguments } from '../../components/FilteredConnection'
import { PageTitle } from '../../components/PageTitle'
import { GitRefConnectionFields, GitRefFields, GitRefType } from '../../graphql-operations'
import { eventLogger } from '../../tracking/eventLogger'
import { GitReferenceNode, queryGitReferences } from '../GitReference'

import { RepositoryBranchesAreaPageProps } from './RepositoryBranchesArea'

interface Props extends RepositoryBranchesAreaPageProps {}

/** A page that shows all of a repository's branches. */
export const RepositoryBranchesAllPage: FC<Props> = props => {
    const { repo } = props

    useEffect(() => {
        eventLogger.logViewEvent('RepositoryBranchesAll')
    }, [])

    const queryBranches = useCallback(
        (args: FilteredConnectionQueryArguments): Observable<GitRefConnectionFields> =>
            queryGitReferences({ ...args, repo: repo.id, type: GitRefType.GIT_BRANCH }),
        [repo.id]
    )

    return (
        <div>
            <PageTitle title="All branches" />
            <FilteredConnection<GitRefFields>
                inputClassName="w-100"
                listClassName="list-group list-group-flush"
                noun="branch"
                pluralNoun="branches"
                queryConnection={queryBranches}
                nodeComponent={GitReferenceNode}
                ariaLabelFunction={(branchDisplayName: string) =>
                    `View this repository using ${branchDisplayName} as the selected revision`
                }
                defaultFirst={20}
                autoFocus={true}
            />
        </div>
    )
}
