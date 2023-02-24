import { ALL_LANGUAGES, languageCompletion, POPULAR_LANGUAGES } from './languageFilter'
import { createLiteral, Literal } from './token'

const create = (value: string): Literal => createLiteral(value, { start: 0, end: 0 })

describe('languageCompletion', () => {
    test('suggest popular languages', () => {
        expect(languageCompletion(undefined)).toStrictEqual(POPULAR_LANGUAGES)
        expect(languageCompletion(create(''))).toStrictEqual(POPULAR_LANGUAGES)
    })

    test('suggest all languages', () => {
        expect(languageCompletion(create('c'))).toStrictEqual(ALL_LANGUAGES)
    })
})
