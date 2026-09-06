// Prints the calendar publisher identity keypair.
//
// This key signs the calendar events. Clients pin the matching pubkey and
// ignore calendars from anyone else — without that, anybody could publish an
// event claiming to be the liturgical calendar and clients would have no way
// to tell which one is real.
//
// Separate from the Palavra key on purpose: two unrelated feeds, either one
// rotatable without disturbing the other.
//
// Generate once and keep it: rotating it orphans every calendar month already
// on the relays, and every client would need the new pubkey.

import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';

const secretKey = generateSecretKey();

console.log('Keep the nsec secret. Give the pubkey to the app.\n');
console.log(`AGENDA_NSEC=${nip19.nsecEncode(secretKey)}`);
console.log(`VITE_AGENDA_PUBLISHER_PUBKEY=${getPublicKey(secretKey)}`);
