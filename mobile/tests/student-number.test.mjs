import test from "node:test";
import assert from "node:assert/strict";
import { studentNumberDigits, validStudentNumber } from "../src/types/student-number.ts";
test("number validation preserves five digits including leading zeros",()=>{
 for(const v of ["00000","00007","48271","99999"]) assert.equal(validStudentNumber(v),true);
 for(const v of ["","1234","123456","12345678","12a45","１２３４５","12345\n"," 12345"]) assert.equal(validStudentNumber(v),false);
 assert.equal(studentNumberDigits("0 00-07"),"00007");
 assert.equal(studentNumberDigits("abc12"),"12");
 assert.equal(studentNumberDigits("123456"),"12345");
});
