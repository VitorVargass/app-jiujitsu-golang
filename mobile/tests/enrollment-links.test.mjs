import test from "node:test";
import assert from "node:assert/strict";
import {safeNext} from "../src/services/safe-next.ts";
test("matrícula volta ao link depois do login sem aceitar redirecionamento externo",()=>{
 const token="a".repeat(64);assert.equal(safeNext("/enroll/"+token),"/enroll/"+token);
 for(const path of ["https://evil.example/enroll/"+token,"//evil.example","/enroll/short","/enroll/"+token+"?next=https://evil.example","/enroll/"+token+"/../admin"]){assert.equal(safeNext(path),"/entry");}
});
