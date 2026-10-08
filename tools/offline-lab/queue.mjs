// Educational prototype only. The production app remains online.
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
export class OfflineQueue {
 constructor(filename=':memory:'){
  this.db=new DatabaseSync(filename);
  this.db.exec("CREATE TABLE IF NOT EXISTS queue(id TEXT PRIMARY KEY, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', result TEXT)");
 }
 cache(academyId,kind,items,refreshedAt=new Date().toISOString()){
  if(!['sessions','students'].includes(kind))throw new Error('Unknown cache kind');
  this.db.exec('CREATE TABLE IF NOT EXISTS cache(academy_id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,refreshed_at TEXT NOT NULL,PRIMARY KEY(academy_id,kind))');
  this.db.prepare('INSERT INTO cache VALUES(?,?,?,?) ON CONFLICT(academy_id,kind) DO UPDATE SET payload=excluded.payload,refreshed_at=excluded.refreshed_at').run(academyId,kind,JSON.stringify(items),refreshedAt);
 }
 snapshot(academyId,kind){
  this.db.exec('CREATE TABLE IF NOT EXISTS cache(academy_id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,refreshed_at TEXT NOT NULL,PRIMARY KEY(academy_id,kind))');
  const row=this.db.prepare('SELECT payload,refreshed_at FROM cache WHERE academy_id=? AND kind=?').get(academyId,kind);
  return row?{items:JSON.parse(row.payload),refreshedAt:row.refreshed_at}:null;
 }

 enqueue(payload){
  const id=randomUUID();
  this.db.prepare('INSERT INTO queue(id,payload) VALUES(?,?)').run(id,JSON.stringify(payload));
  return id;
 }
 rows(){return this.db.prepare('SELECT * FROM queue ORDER BY rowid').all().map(row=>({...row,payload:JSON.parse(row.payload),result:row.result?JSON.parse(row.result):null}));}
 async sync(send){
  for(const event of this.rows().filter(row=>row.state==='pending')){
   try{
    const result=await send(event.id,event.payload);
    this.db.prepare('UPDATE queue SET state=?,result=? WHERE id=?').run(result.accepted?'confirmed':'rejected',JSON.stringify(result),event.id);
   }catch{/* Connection failures keep the same durable event ID for the next retry. */}
  }
 }
 close(){this.db.close();}
}
export class TeachingServer {
 events=new Map();attendances=new Map();open=true;studentActive=true;deviceActive=true;
 async send(id,payload){
  if(!this.deviceActive)return {accepted:false,reason:'device_revoked'};
  if(this.events.has(id))return this.events.get(id);
  if(!this.open)return {accepted:false,reason:'class_cancelled'};
  if(!this.studentActive)return {accepted:false,reason:'membership_blocked'};
  const key=payload.academyId+':'+payload.sessionId+':'+payload.studentId;
  const attendanceId=this.attendances.get(key)||randomUUID();
  this.attendances.set(key,attendanceId);
  const result={accepted:true,attendanceId};
  this.events.set(id,result);return result;
 }
}
