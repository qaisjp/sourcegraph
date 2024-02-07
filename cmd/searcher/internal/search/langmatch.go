package search

import (
	"slices"

	"github.com/go-enry/go-enry/v2"
	"github.com/grafana/regexp"

	"github.com/sourcegraph/sourcegraph/cmd/searcher/protocol"
	"github.com/sourcegraph/sourcegraph/internal/search/query"
)

type langMatcher interface {
	CouldMatchPath(path string) bool
	Matches(path string, content []byte) bool
}

type allLangMatcher struct{}

func (am *allLangMatcher) CouldMatchPath(_ string) bool {
	return true
}

func (am *allLangMatcher) Matches(_ string, _ []byte) bool {
	return true
}

type enryLangMatcher struct {
	IncludeLangs []string
	ExcludeLangs []string
	IncludePaths []*regexp.Regexp
}

func (em *enryLangMatcher) CouldMatchPath(path string) bool {
	for _, include := range em.IncludePaths {
		if include.MatchString(path) {
			return true
		}
	}
	return false
}

// TODO(jtibs): fix this
func (em *enryLangMatcher) String() string {
	return "langMatcher"
}

func (em *enryLangMatcher) Matches(name string, buf []byte) bool {
	lang := enry.GetLanguage(name, buf)
	if !slices.Contains(em.IncludeLangs, lang) {
		return false
	}
	if slices.Contains(em.ExcludeLangs, lang) {
		return false
	}
	return true
}

func toLangMatcher(p *protocol.PatternInfo) (langMatcher, error) {
	if len(p.IncludeLangs)+len(p.ExcludeLangs) == 0 {
		return &allLangMatcher{}, nil
	}

	var includePaths []*regexp.Regexp
	for _, lang := range p.IncludeLangs {
		pattern, err := regexp.Compile(query.LangToFileRegexp(lang))
		if err != nil {
			return nil, err
		}
		includePaths = append(includePaths, pattern)
	}

	return &enryLangMatcher{
		IncludeLangs: p.IncludeLangs,
		ExcludeLangs: p.ExcludeLangs,
		IncludePaths: includePaths,
	}, nil
}
