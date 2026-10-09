import fs from "node:fs";
const doc=JSON.parse(fs.readFileSync(new URL("../docs/openapi.json",import.meta.url),"utf8"));
doc.info.version="2.0.0";doc.info.description="Gestão multiacademia, alunos independentes, mensalidades, Pix Asaas e presença exclusivamente por dispositivos autorizados.";
const schema=doc.components.schemas;
const ref=n=>({$ref:"#/components/schemas/"+n});const str={type:"string"};const id={type:"string",format:"uuid"};const bool={type:"boolean"};const cents={type:"integer",format:"int64",minimum:1,maximum:100000000};const ids={type:"array",items:id};
const obj=(properties,required=[])=>({type:"object",properties,required});
schema.Billing=obj({enabled:bool,amount_cents:cents,due_day:{type:"integer",minimum:1,maximum:31},first_month:{type:"string",pattern:"^\\d{4}-\\d{2}$"},payer_name:str,payer_document:{type:"string",description:"CPF ou CNPJ válido, somente números."}},["enabled","amount_cents","due_day","first_month","payer_name","payer_document"]);
schema.StudentInput=obj({name:str,email:str,phone:str,status:{type:"string",enum:["active","inactive"]},belt:str,plan_id:{type:"string",description:"UUID de plano desta academia ou string vazia."},modality_ids:ids,billing:{...ref("Billing"),nullable:true}},["name","status","modality_ids"]);
schema.Student={allOf:[ref("StudentInput"),obj({id,academy_id:id,user_id:{type:"string",description:"Vazio até o aluno aceitar o convite."},student_code:str})]};
schema.Catalog=obj({id,name:str,active:bool,amount_cents:cents,modality_ids:ids});
schema.ModalityInput=obj({name:str,active:bool},["name","active"]);
schema.PlanInput=obj({name:str,active:bool,amount_cents:cents,modality_ids:ids},["name","active","amount_cents","modality_ids"]);
schema.Invoice=obj({id,student_id:id,student_name:str,competence:str,due_date:{type:"string",format:"date"},amount_cents:cents,status:{type:"string",enum:["open","overdue","paid","cancelled"]},paid_at:{type:"string",format:"date-time",nullable:true}});
schema.Pix=obj({status:{type:"string",enum:["waiting","paid"]},payload:str,expires_at:{type:"string",format:"date-time"},environment:{type:"string",enum:["sandbox","production"]}});
schema.Invitation=obj({token:{type:"string",description:"Segredo retornado uma única vez. Nunca incluir em logs."},expires_in_days:{type:"integer",enum:[7]}});
schema.Integration=obj({connected:bool,provider:{type:"string",enum:["asaas"]},environment:{type:"string",enum:["sandbox","production","disabled"]}});
for(const n of ["Student","Invoice","Attendance"]){schema[n+"Page"]=obj({items:{type:"array",items:ref(n)},total:{type:"integer"},page:{type:"integer"},page_size:{type:"integer"}});}
schema.ClassInput.properties.modality_id=id;schema.ClassInput.properties.clear_teacher=bool;
schema.ClassInput.required=(schema.ClassInput.required??[]).filter(x=>x!=="teacher_membership_id");schema.ClassInput.properties.teacher_membership_id={type:"string",description:"Opcional. UUID de professor ativo da academia. clear_teacher remove uma atribuição anterior."};
schema.Class.properties.modality_id=id;schema.Class.properties.modality_name=str;
schema.Dashboard.properties.received_month_cents={type:"integer",format:"int64"};schema.Dashboard.properties.open_cents={type:"integer",format:"int64"};
const query=(name,type="string")=>({name,in:"query",schema:{type}});
const pages=[query("page","integer"),query("page_size","integer")];
const errors=Object.fromEntries([400,401,403,404,409,410,422,429,500,503].map(code=>[code,{description:"Erro: consulte error.code e error.message",content:{"application/json":{schema:ref("Error")}}}]));
function route(path,method,summary,result,input,parameters=[],description=""){
 const paths=[...path.matchAll(/\{([^}]+)\}/g)].map(m=>({name:m[1],in:"path",required:true,schema:m[1]==="token"?str:id}));
 const operation={summary,description,parameters:[...paths,...parameters],responses:{"200":{description:"Sucesso",content:{"application/json":{schema:ref(result)}}},...errors}};
 if(input)operation.requestBody={required:true,content:{"application/json":{schema:ref(input)}}};doc.paths[path]??={};doc.paths[path][method]=operation;return operation;
}
const base="/v1/academies/{academy_id}";
route(base+"/students","get","Consultar alunos","StudentPage",null,[...pages,query("search"),query("status"),query("modality_id")],"Somente gestor. Filtros e paginação limitados à academia.");
route(base+"/students","post","Cadastrar aluno sem conta de login","Student","StudentInput");
route(base+"/students/{student_id}","get","Consultar cadastro","Student");
route(base+"/students/{student_id}","patch","Editar cadastro completo","Student","StudentInput",[],"Enviar o formulário completo. Valores emitidos não mudam. Inativar interrompe geração e check-ins, preservando débitos.");
const invitation=route(base+"/students/{student_id}/invitations","post","Gerar convite individual","Invitation");invitation.responses["201"]=invitation.responses["200"];delete invitation.responses["200"];
schema.OK=obj({ok:bool});
route(base+"/students/{student_id}/invitations","delete","Revogar convites pendentes","OK");
route("/v1/invitations/{token}/accept","post","Aceitar convite com conta pessoal autenticada","Student",null,[],"Expira após sete dias, pode ser revogado e só pode ser utilizado uma vez. Repetição retorna 410.");
route(base+"/me/student","get","Consultar seu próprio cadastro de aluno","Student",null,[],"Permite consultar cadastro inativo, sem acesso administrativo.");
for(const kind of ["modalities","plans"]){
 const n=kind==="plans"?"PlanInput":"ModalityInput";
 schema.CatalogList={type:"array",items:ref("Catalog")};
 route(base+"/"+kind,"get","Listar "+kind,"CatalogList");
 route(base+"/"+kind,"post","Cadastrar "+kind,"Catalog",n);
 route(base+"/"+kind+"/{item_id}","patch","Editar "+kind,"Catalog",n);
}
for(const own of [false,true])route(base+(own?"/me/invoices":"/invoices"),"get",own?"Consultar suas mensalidades":"Consultar financeiro","InvoicePage",null,[...pages,query("month"),query("status"),...(!own?[query("student_id")]:[])],"Valores em centavos. Competência YYYY-MM. Em aberto exclui vencidas. Alunos só consultam suas cobranças, inclusive após inativação.");
route(base+"/invoices/{invoice_id}","get","Abrir mensalidade","Invoice");
route(base+"/invoices/{invoice_id}/pix","post","Emitir ou recuperar Pix Asaas","Pix",null,[],"Gestor ou titular. Recupera emissão incerta por externalReference antes de repetir. Só confirma com consulta ao Asaas. 503 pode indicar emissão em conferência. Credenciais ficam no servidor.");
route(base+"/invoices/{invoice_id}/cancel","patch","Cancelar mensalidade e Pix pendente","OK",null,[],"Somente gestor. Pagamento confirmado impede cancelamento. Emissão incerta bloqueia cancelamento até conferir o provedor.");
route(base+"/payment-integration","get","Consultar estado da integração Asaas","Integration");
route(base+"/attendances","get","Histórico de presenças da academia","AttendancePage",null,[...pages,query("month"),query("student_id"),query("class_id")]);
const ownHistory=route(base+"/me/attendances","get","Histórico pessoal de presenças","AttendancePage",null,[...pages,query("month"),query("class_id")],"Usar page=1 para formato paginado. Sem filtros/page mantém array legado. Cadastro inativo conserva histórico.");
ownHistory.responses["200"].content["application/json"].schema={oneOf:[ref("AttendancePage"),{type:"array",items:ref("Attendance")}]};
const checkin=doc.paths[base+"/sessions/{session_id}/check-ins"].post;checkin.description="Exclusivo de tablet autorizado da mesma academia. Uma identificação: qr_token ou student_code. membership_id legado não é aceito. Idempotency-Key UUID obrigatório; mesma chave/dados diferentes retorna 409. Resposta repetida conserva a presença já registrada.";
if(schema.CheckinInput?.properties){
 delete schema.CheckinInput.properties.membership_id;
 schema.CheckinInput.oneOf=[{required:["qr_token"]},{required:["student_code"]}];
 schema.CheckinInput.description="Exatamente uma identificação: qr_token ou student_code. Apenas dispositivos autorizados podem enviar check-in.";
}
schema.Webhook=obj({id:str,event:str,payment:obj({id:str,externalReference:str})},["id","event","payment"]);
const hook=route("/v1/webhooks/asaas/{connection_id}/pix","post","Receber aviso Asaas e consultar pagamento","OK","Webhook",[{name:"asaas-access-token",in:"header",required:true,schema:str}],"Verifica token da conexão e consulta o pagamento na conta Asaas da academia. Não confia no valor/status do aviso. Campos adicionais aceitos; notificações repetidas são idempotentes. Cobranças não pertencentes ao Tatame são ignoradas.");
hook.security=[];
for(const [path,ops] of Object.entries(doc.paths))if(path.includes("membership-requests"))for(const op of Object.values(ops)){op.deprecated=true;op.description="Compatibilidade com versão anterior. Novos vínculos são feitos por convite individual.";}
const raw=JSON.stringify(doc,null,2)+"\n";fs.writeFileSync(new URL("../docs/openapi.json",import.meta.url),raw);fs.writeFileSync(new URL("../backend/internal/httpapi/openapi.json",import.meta.url),raw);
