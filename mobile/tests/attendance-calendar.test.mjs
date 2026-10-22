import test from "node:test";
import assert from "node:assert/strict";
import { attendanceDay, calendarWeeks, groupAttendanceDays, loadAttendanceMonth } from "../src/features/students/attendance-calendar.ts";

test("calendar aligns Sunday, leap days and six-week months",()=>{
 const leap=calendarWeeks("2024-02").flat();
 assert.equal(leap.filter(Boolean).length,29);
 assert.equal(leap[4],"2024-02-01");
 assert.equal(leap[32],"2024-02-29");
 assert.equal(calendarWeeks("2026-08").length,6);
 assert.deepEqual(calendarWeeks("2026-11")[0],["2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-05","2026-11-06","2026-11-07"]);
 assert.equal(calendarWeeks("2027-01").flat().filter(Boolean).at(-1),"2027-01-31");
});
test("training day follows academy timezone and class date, including retrospective entries",()=>{
 const retrospective={id:"retro",starts_at:"2026-10-11T01:00:00Z",checked_in_at:"2026-10-22T15:00:00Z"};
 assert.equal(attendanceDay(retrospective,"America/Sao_Paulo"),"2026-10-10");
 assert.equal(attendanceDay({id:"legacy",checked_in_at:"2026-11-01T01:00:00Z"},"America/Sao_Paulo"),"2026-10-31");
 const groups=groupAttendanceDays([retrospective,{...retrospective,id:"second-class"}],"America/Sao_Paulo");
 assert.equal(groups.size,1);
 assert.equal(groups.get("2026-10-10").length,2);
});
test("calendar loads more than 100 attendances and never presents a partial month as complete",async()=>{
 const pages=[];
 const rows=Array.from({length:205},(_,i)=>({id:String(i)}));
 const items=await loadAttendanceMonth(async page=>{
  pages.push(page);return {page,page_size:100,total:205,items:rows.slice((page-1)*100,page*100)};
 });
 assert.equal(items.length,205);assert.deepEqual(pages,[1,2,3]);
 await assert.rejects(()=>loadAttendanceMonth(async page=>{
  if(page===2)throw new Error("offline");
  return {page,page_size:100,total:205,items:rows.slice(0,100)};
 }),/offline/);
 assert.deepEqual(await loadAttendanceMonth(async()=>({page:1,page_size:100,total:0,items:[]})),[]);
});
