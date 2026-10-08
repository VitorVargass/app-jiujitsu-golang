import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OfflineQueue,TeachingServer} from './queue.mjs';
const payload={academyId:'academy-A',sessionId:'class-today',studentId:'student-1'};
test('A response lost after the server commits is retried with the durable event ID',async()=>{
 const q=new OfflineQueue(),server=new TeachingServer();
 const id=q.enqueue(payload);
 await q.sync(async(id,payload)=>{await server.send(id,payload);throw new Error('Response lost');});
 assert.equal(q.rows()[0].state,'pending');
 await q.sync((id,payload)=>server.send(id,payload));
 assert.equal(q.rows()[0].id,id);assert.equal(q.rows()[0].state,'confirmed');assert.equal(server.attendances.size,1);
 q.close();
});
test('Two tablets converge to one attendance',async()=>{
 const a=new OfflineQueue(),b=new OfflineQueue(),server=new TeachingServer();
 a.enqueue(payload);b.enqueue(payload);
 await Promise.all([a.sync((id,p)=>server.send(id,p)),b.sync((id,p)=>server.send(id,p))]);
 assert.equal(a.rows()[0].result.attendanceId,b.rows()[0].result.attendanceId);assert.equal(server.attendances.size,1);
 a.close();b.close();
});
for(const [flag,reason] of [['open','class_cancelled'],['studentActive','membership_blocked'],['deviceActive','device_revoked']]){
 test(reason+' remains visible for review',async()=>{
  const q=new OfflineQueue(),server=new TeachingServer();q.enqueue(payload);server[flag]=false;
  await q.sync((id,p)=>server.send(id,p));assert.equal(q.rows()[0].state,'rejected');assert.equal(q.rows()[0].result.reason,reason);q.close();
 });
}
test('Pending events survive restarting the tablet process',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tatame-offline-'));const path=join(dir,'queue.sqlite');
 let q=new OfflineQueue(path);const id=q.enqueue(payload);q.close();q=new OfflineQueue(path);
 assert.equal(q.rows()[0].id,id);assert.equal(q.rows()[0].state,'pending');q.close();
 rmSync(path);rmdirSync(dir);
});

test('Cached sessions and students remain scoped to their academy and survive restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tatame-cache-'));const path=join(dir,'queue.sqlite');
 let q=new OfflineQueue(path);q.cache('gym-a','sessions',[{id:'session-a',status:'open'}],'2026-10-03T00:00:00Z');q.cache('gym-a','students',[{id:'student-a'}]);q.close();
 q=new OfflineQueue(path);assert.equal(q.snapshot('gym-a','sessions').items[0].id,'session-a');assert.equal(q.snapshot('gym-a','students').items[0].id,'student-a');assert.equal(q.snapshot('gym-b','students'),null);assert.equal(q.snapshot('gym-a','sessions').refreshedAt,'2026-10-03T00:00:00Z');
 const id=q.enqueue({academyId:'gym-a',sessionId:'session-a',studentId:'student-a'});assert.equal(q.rows().find(x=>x.id===id).state,'pending');q.close();rmSync(path);rmdirSync(dir);
});
