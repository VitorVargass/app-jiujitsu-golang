import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNext } from '../src/services/safe-next.ts';
const path='/pay/3942db9f-21b3-4d04-a526-3988c3247631/3942db9f-21b3-4d04-a526-3988c3247632';
test('payment return survives login without allowing external redirects',()=>{
 const value=path+'?order_nsu=123&transaction_nsu=txn&slug=invoice';assert.equal(safeNext(value),value);
 for(const bad of ['https://evil.example','//evil.example',path+'?next=https://evil.example',path+'?slug='+('a'.repeat(201)),path+'#evil'])assert.equal(safeNext(bad),'/entry');
});
test('ordinary invitations and payment routes remain valid',()=>{assert.equal(safeNext(path),path);const invite='/invite/'+'a'.repeat(64);assert.equal(safeNext(invite),invite);assert.equal(safeNext(),'/entry');});
