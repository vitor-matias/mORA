import { describe, expect, it } from 'vitest';
import { unannouncedBadges } from './badgeAlerts';
import type { EarnedBadge } from './badges';
import { badgeAnnouncementKey, sanitizeAnnouncedBadges } from '@/store/palavra';

// What decides whether someone is told they won something. Both failure modes
// are silent in the app — announcing the same badge on every launch, or never
// announcing a real one — so the rule is worth pinning down here.

const PUBKEY = 'a'.repeat(64);
const OTHER_PUBKEY = 'b'.repeat(64);
const PUBLISHER = 'c'.repeat(64);

function badge(dTag: string): EarnedBadge {
    return {
        coord: `30009:${PUBLISHER}:${dTag}`,
        awardId: '1'.repeat(64),
        name: dTag,
        awardedAt: 1_700_000_000,
    };
}

describe('unannouncedBadges', () => {
    it('treats an unknown badge as new', () => {
        expect(unannouncedBadges([badge('july')], {}, PUBKEY)).toEqual([badge('july')]);
    });

    it('drops one already announced to this identity', () => {
        const announced = { [badgeAnnouncementKey(PUBKEY, badge('july').coord)]: true } as const;
        expect(unannouncedBadges([badge('july')], announced, PUBKEY)).toEqual([]);
    });

    it('keeps a badge announced only to a different identity on this device', () => {
        // Two accounts sharing a browser are each told about their own; the
        // second signing in must not inherit the first one's silence.
        const announced = { [badgeAnnouncementKey(OTHER_PUBKEY, badge('july').coord)]: true } as const;
        expect(unannouncedBadges([badge('july')], announced, PUBKEY)).toEqual([badge('july')]);
    });

    it('announces only the new one when older badges are already known', () => {
        const announced = { [badgeAnnouncementKey(PUBKEY, badge('june').coord)]: true } as const;
        expect(unannouncedBadges([badge('june'), badge('july')], announced, PUBKEY))
            .toEqual([badge('july')]);
    });
});

describe('sanitizeAnnouncedBadges', () => {
    it('keeps a well-formed entry', () => {
        const key = badgeAnnouncementKey(PUBKEY, badge('july').coord);
        expect(sanitizeAnnouncedBadges({ [key]: true })).toEqual({ [key]: true });
    });

    it('drops anything but a literal true', () => {
        // A truthy string off a corrupted write would silence a real award
        // for good, which nothing downstream could notice.
        const key = badgeAnnouncementKey(PUBKEY, badge('july').coord);
        expect(sanitizeAnnouncedBadges({ [key]: 'yes' })).toEqual({});
    });

    it('drops keys that do not name a pubkey and a coordinate', () => {
        expect(sanitizeAnnouncedBadges({
            'not-a-pubkey:30009:x:july': true,
            [`${PUBKEY}:`]: true,
            [PUBKEY]: true,
        })).toEqual({});
    });

    it('survives junk in place of the map', () => {
        expect(sanitizeAnnouncedBadges(null)).toEqual({});
        expect(sanitizeAnnouncedBadges('nope')).toEqual({});
    });
});
