// Prints the publisher identity keypair.
//
// This key signs the daily puzzle events. Clients pin the matching pubkey and
// ignore puzzles from anyone else — without that, anybody could publish an
// event claiming to be the day's puzzle and clients would have no way to tell
// which one is real. It is the only secret in the whole system.
//
// Generate once and keep it: rotating it orphans every puzzle already on the
// relays, including the archive, and every client would need the new pubkey.

import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';

const secretKey = generateSecretKey();

console.log('Keep the nsec secret. Give the pubkey to the app.\n');
console.log(`PALAVRA_NSEC=${nip19.nsecEncode(secretKey)}`);
console.log(`VITE_PALAVRA_PUBLISHER_PUBKEY=${getPublicKey(secretKey)}`);
