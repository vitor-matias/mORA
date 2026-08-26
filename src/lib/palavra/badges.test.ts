import { describe, expect, it } from 'vitest';
import { profileBadgeRefs, profileBadgeTags, type ProfileBadgeRef } from './badges';

// NIP-58 stores a profile's badges as *consecutive pairs* of `a` and `e` tags
// rather than as a structure, so the pairing is positional and easy to get
// subtly wrong. It is worth testing on its own because this list is a single
// replaceable event holding every badge a person displays: a misread here is
// republished, and republishing it wrong takes badges off their profile.

const COORD_A = `30009:${'a'.repeat(64)}:mora-palavra-2026-07-1`;
const COORD_B = `30009:${'a'.repeat(64)}:mora-palavra-2026-06-2`;
const AWARD_A = '1'.repeat(64);
const AWARD_B = '2'.repeat(64);

describe('profileBadgeRefs', () => {
    it('reads a pair', () => {
        expect(profileBadgeRefs([['d', 'profile_badges'], ['a', COORD_A], ['e', AWARD_A]]))
            .toEqual([{ coord: COORD_A, awardId: AWARD_A }]);
    });

    it('reads several pairs in order', () => {
        const refs = profileBadgeRefs([
            ['d', 'profile_badges'],
            ['a', COORD_A], ['e', AWARD_A],
            ['a', COORD_B], ['e', AWARD_B],
        ]);
        expect(refs).toEqual([
            { coord: COORD_A, awardId: AWARD_A },
            { coord: COORD_B, awardId: AWARD_B },
        ]);
    });

    it('has nothing to read in an empty list', () => {
        expect(profileBadgeRefs([['d', 'profile_badges']])).toEqual([]);
    });

    // An `a` with no `e` after it is a claim with no receipt. Guessing a
    // partner from further down the list would attach one badge's award to
    // another badge's coordinate, and that pairing would then be republished.
    it('drops an a with no e after it', () => {
        expect(profileBadgeRefs([['a', COORD_A]])).toEqual([]);
        expect(profileBadgeRefs([['a', COORD_A], ['a', COORD_B], ['e', AWARD_B]]))
            .toEqual([{ coord: COORD_B, awardId: AWARD_B }]);
    });

    it('drops an e that follows nothing', () => {
        expect(profileBadgeRefs([['e', AWARD_A]])).toEqual([]);
    });

    it('ignores unrelated tags between pairs', () => {
        const refs = profileBadgeRefs([
            ['a', COORD_A], ['e', AWARD_A],
            ['t', 'something'],
            ['a', COORD_B], ['e', AWARD_B],
        ]);
        expect(refs).toHaveLength(2);
    });

    // A pair split by another tag is not a pair: `e` has to follow its `a`
    // immediately, so this is a malformed entry rather than a loose one.
    it('does not pair across an intervening tag', () => {
        expect(profileBadgeRefs([['a', COORD_A], ['t', 'x'], ['e', AWARD_A]])).toEqual([]);
    });

    it('drops a tag with no value', () => {
        expect(profileBadgeRefs([['a'], ['e', AWARD_A]])).toEqual([]);
        expect(profileBadgeRefs([['a', COORD_A], ['e']])).toEqual([]);
    });
});

describe('profileBadgeTags', () => {
    it('always names the list NIP-58 expects', () => {
        expect(profileBadgeTags([])).toEqual([['d', 'profile_badges']]);
    });

    it('writes each ref as an a followed by its e', () => {
        expect(profileBadgeTags([{ coord: COORD_A, awardId: AWARD_A }])).toEqual([
            ['d', 'profile_badges'],
            ['a', COORD_A],
            ['e', AWARD_A],
        ]);
    });

    // The property that matters: what is written can be read back unchanged.
    // These two run in opposite directions on the same event, and a profile
    // survives a publish only if they agree.
    it('round-trips through the reader', () => {
        const refs: ProfileBadgeRef[] = [
            { coord: COORD_A, awardId: AWARD_A },
            { coord: COORD_B, awardId: AWARD_B },
        ];
        expect(profileBadgeRefs(profileBadgeTags(refs))).toEqual(refs);
    });

    it('round-trips an empty list', () => {
        expect(profileBadgeRefs(profileBadgeTags([]))).toEqual([]);
    });
});
