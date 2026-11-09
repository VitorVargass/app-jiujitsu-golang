import fs from "node:fs";

const ref = (name) => ({ $ref: "#/components/schemas/" + name });
const str = { type: "string" }, uuid = { type: "string", format: "uuid" };
const obj = (properties) => ({ type: "object", properties, additionalProperties: false });
const list = (schema) => ({ type: "array", items: schema });
const page = (schema) => obj({ items: list(schema), total: { type: "integer" }, page: { type: "integer" }, page_size: { type: "integer" } });
function update(doc) {
const schema = doc.components.schemas;
schema.Teacher = obj({ id: uuid, user_id: uuid, name: str, email: str, status: {type:"string",enum:["active","blocked"]}, is_owner:{type:"boolean",enum:[false]},can_remove:{type:"boolean"} });
schema.TeacherInput = obj({name:{type:"string",minLength:2,maxLength:100},email:{type:"string",format:"email"},password:{type:"string",description:"Nova conta: 8 a 72 bytes. Não enviar para conta existente."},link_existing:{type:"boolean",description:"Confirma vínculo de conta existente, preservando senha e nome."}});
schema.AcademicRank = obj({modality_id:uuid,belt:str,degrees:{type:"integer",minimum:0,maximum:4}});
schema.AcademicStudent = obj({id:uuid,name:str,email:str,phone:str,alternate_phone:str,birth_date:str,started_on:str,status:str,archived_at:{type:"string",format:"date-time",nullable:true},student_code:str,belt:str,modality_ids:list(uuid),modality_details:list(ref("AcademicRank"))});
schema.AcademicModality = obj({id:uuid,name:str,active:{type:"boolean"},belt_options:list(ref("BeltOption"))});
const base="/v1/academies/{academy}";
function add(method,path,summary,response,body,query=[]) {
 const parameters=[...path.matchAll(/\{([^}]+)\}/g)].map(([,name])=>({name,in:"path",required:true,schema:uuid})).concat(query.map(name=>({name,in:"query",schema:["page","page_size"].includes(name)?{type:"integer",minimum:1}:str})));
 const op={summary,parameters,responses:{200:{description:"Sucesso",content:{"application/json":{schema:response}}}}};
 for(const [code,description] of [[401,"Credencial inválida"],[403,"Vínculo inativo ou sem permissão"],[404,"Recurso não encontrado nesta academia"],[409,"Estado incompatível ou vínculo duplicado"],[422,"Dados inválidos"],[402,"Assinatura da academia pendente"]]) op.responses[code]={description,content:{"application/json":{schema:ref("Error")}}};
 if(body)op.requestBody={required:true,content:{"application/json":{schema:body}}};
 (doc.paths[path]??={})[method]=op;
 return op;
}
add("get",base+"/teachers","Gestores: listar professores da academia",list(ref("Teacher")));
const create=add("post",base+"/teachers","Gestores: criar conta ou vincular professor existente",ref("Teacher"),ref("TeacherInput"));create.responses[201]=create.responses[200];delete create.responses[200];
add("delete",base+"/teachers/{member}","Gestores: remover somente o papel de professor; preservar conta e demais papéis",ref("OK"));
add("get",base+"/academic/students","Gestores e professores: alunos sem dados financeiros ou de pagadores",page(ref("AcademicStudent")),null,["search","status","modality_id","page","page_size"]);
add("get",base+"/academic/students/{student}","Gestores e professores: ficha acadêmica, inclusive arquivados",ref("AcademicStudent"));
add("get",base+"/academic/modalities","Gestores e professores: modalidades e faixas sem preços",list(ref("AcademicModality")));
const graduationBody=obj({belt:str,degrees:{type:"integer",minimum:0,maximum:4}});
add("patch",base+"/academic/students/{student}/graduations/{modality}","Gestores e professores: alterar graduação com autoria; resposta sempre acadêmica",ref("AcademicStudent"),graduationBody);
const legacy=doc.paths[base+"/students/{student}/graduations/{modality}"]?.patch;
if(legacy){legacy.description="Gestores e professores ativos. Para professor sem papel admin, retorna AcademicStudent sem valores; para gestor mantém Student. A rota /academic sempre usa a projeção acadêmica.";legacy.responses[200].content["application/json"].schema={anyOf:[ref("Student"),ref("AcademicStudent")]};}
for(const suffix of ["/students/{student}/progress","/attendances","/attendance-options","/sessions/{session}/attendances"]){for(const operation of Object.values(doc.paths[base+suffix]??{})){if(operation&&typeof operation==="object"&&"responses" in operation)operation.description=(operation.description??"").split(" Gestores e professores ativos têm acesso acadêmico em toda a academia.")[0]+" Gestores e professores ativos têm acesso acadêmico em toda a academia. Lançamentos mantêm validações de data, situação do aluno e idempotência.";}}
return doc;
}
for (const location of ["../docs/openapi.json","../backend/internal/httpapi/openapi.json"]) {
 const path = new URL(location,import.meta.url);
 fs.writeFileSync(path,JSON.stringify(update(JSON.parse(fs.readFileSync(path,"utf8"))),null,2)+"\n");
}
