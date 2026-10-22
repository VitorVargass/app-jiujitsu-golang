import {writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const string={type:'string'},uuid={type:'string',format:'uuid'},role={type:'string',enum:['student','teacher','admin']};
const object=properties=>({type:'object',properties});
const input=(properties,required=[])=>({...object(properties),required,additionalProperties:false});
const schemas={
 Health:object({status:{type:'string',enum:['ok']},service:{type:'string',enum:['tatame-api']}}),
 Error:object({error:object({code:string,message:string})}),
 User:object({id:uuid,name:string,email:string}),
 Login:object({token:string,user:{$ref:'#/components/schemas/User'}}),
 RegisterInput:input({name:string,email:{type:'string',format:'email'},password:{type:'string',minLength:8,description:'Até 72 bytes UTF-8.'}},['name','email','password']),
 LoginInput:input({email:string,password:string},['email','password']),
 AcademyInput:input({name:string,timezone:{type:'string',default:'America/Sao_Paulo'}},['name']),
 Academy:object({id:uuid,name:string,code:string,timezone:string,membership_id:uuid,roles:{type:'array',items:role},status:{type:'string',enum:['active','blocked']},belt:string}),
 MembershipRequestInput:input({academy_code:string,role:{type:'string',enum:['student','teacher']}},['academy_code','role']),
 MembershipRequest:object({id:uuid,academy_id:uuid,academy_name:string,name:string,role,status:{type:'string',enum:['pending','approved','rejected']}}),
 MembershipDecision:input({status:{type:'string',enum:['approved','rejected']}},['status']),
 MembershipUpdate:input({status:{type:'string',enum:['active','blocked']},roles:{type:'array',minItems:1,items:role},belt:string}),
 Membership:object({id:uuid,academy_id:uuid,user_id:uuid,name:string,status:string,belt:string,roles:{type:'array',items:role}}),
 ClassInput:input({name:string,teacher_membership_id:uuid,active:{type:'boolean'}}),
 Class:object({id:uuid,name:string,teacher_membership_id:uuid,teacher_name:string,active:{type:'boolean'}}),
 ScheduleInput:input({weekday:{type:'integer',minimum:0,maximum:6},start_time:{type:'string',pattern:'^([01][0-9]|2[0-3]):[0-5][0-9]$'},duration_minutes:{type:'integer',minimum:15,maximum:240}},['weekday','start_time','duration_minutes']),
 Schedule:object({id:uuid,class_id:uuid,weekday:{type:'integer'},start_time:string,duration_minutes:{type:'integer'}}),
 OpenInput:input({schedule_id:uuid,date:{type:'string',format:'date',description:'Hoje no fuso da academia.'}},['schedule_id']),
 SessionUpdate:input({status:{type:'string',enum:['closed','cancelled']}},['status']),
 Session:object({id:uuid,class_id:uuid,class_name:string,teacher_membership_id:uuid,teacher_name:string,starts_at:{type:'string',format:'date-time'},status:{type:'string',enum:['open','closed','cancelled']},attendance_count:{type:'integer'}}),
 CheckinInput:{...input({qr_token:string,student_code:{type:'string',pattern:'^[0-9]{5}$'},membership_id:uuid}),oneOf:[{required:['qr_token']},{required:['student_code']},{required:['membership_id']}],description:'Exatamente uma identificação. membership_id apenas para professor ou gestor.'},
 CheckinResult:object({id:uuid,membership_id:uuid,student_name:string,belt:string,checked_in_at:{type:'string',format:'date-time'},duplicate:{type:'boolean'}}),
 Attendance:object({id:uuid,session_id:uuid,class_name:string,student_name:string,belt:string,checked_in_at:{type:'string',format:'date-time'}}),
 Credential:object({student_code:string,qr_token:string,student_name:string,belt:string}),
 DeviceInput:input({name:{type:'string',minLength:2,maxLength:80}},['name']),
 Device:object({id:uuid,name:string,active:{type:'boolean'}}),
 DeviceCredential:object({id:uuid,token:string,academy_id:uuid,name:string}),
 Dashboard:object({scope:role,presences_today:{type:'integer'},presences_month:{type:'integer'},active_students:{type:'integer'},week:{type:'array',items:object({date:{type:'string',format:'date'},count:{type:'integer'}})}}),
 OK:object({ok:{type:'boolean'}})
};
const spec={openapi:'3.0.3',info:{title:'Tatame API',version:'1.0.0',description:'MVP online com isolamento por academia e check-in idempotente.'},servers:[{url:'http://localhost:8080'}],security:[{bearerAuth:[]}],components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',description:'Token opaco de usuário ou tablet; não é JWT.'}},schemas},paths:{}};
function add(method,path,summary,response,body,options={}){
 const parameters=[...path.matchAll(/\{([^}]+)\}/g)].map(m=>({name:m[1],in:'path',required:true,schema:uuid})).concat(options.params||[]);
 const ref={$ref:'#/components/schemas/'+response};
 const op={summary,parameters,responses:{[options.status||200]:{description:'Sucesso',content:{'application/json':{schema:options.list?{type:'array',items:ref}:ref}}}}};
 for(const [code,message] of [[400,'JSON inválido'],[401,'Credencial inválida ou revogada'],[403,'Sem permissão'],[404,'Recurso não encontrado nesta academia'],[409,'Conflito de estado ou idempotência'],[422,'Dados inválidos'],[429,'Muitas tentativas'],[500,'Erro interno']])op.responses[code]={description:message,content:{'application/json':{schema:{$ref:'#/components/schemas/Error'}}}};
 if(body)op.requestBody={required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/'+body}}}};
 if(options.public)op.security=[];
 spec.paths[path]??={};spec.paths[path][method]=op;
}
const b='/v1/academies/{academy_id}';
add('post','/v1/auth/register','Criar conta','Login','RegisterInput',{public:true,status:201});
add('post','/v1/auth/login','Entrar','Login','LoginInput',{public:true});
add('post','/v1/auth/logout','Revogar sessão atual','OK');
add('get','/v1/me','Perfil pessoal','User');
add('post','/v1/academies','Criar academia e vínculo de gestor','Academy','AcademyInput',{status:201});
add('get','/v1/me/academies','Academias do usuário','Academy',null,{list:true});
add('post','/v1/membership-requests','Solicitar vínculo de aluno ou professor','MembershipRequest','MembershipRequestInput',{status:201});
add('get','/v1/me/membership-requests','Minhas solicitações','MembershipRequest',null,{list:true});
add('get',b+'/membership-requests','Solicitações para análise pelo gestor','MembershipRequest',null,{list:true});
add('patch',b+'/membership-requests/{request_id}','Aprovar ou recusar','OK','MembershipDecision');
add('get',b+'/members','Alunos e equipe; gestor ou professor','Membership',null,{list:true});
add('patch',b+'/members/{membership_id}','Alterar vínculo; mantém último gestor ativo','OK','MembershipUpdate');
add('get',b+'/classes','Listar turmas','Class',null,{list:true});
add('post',b+'/classes','Criar turma','Class','ClassInput');
add('patch',b+'/classes/{class_id}','Editar turma','Class','ClassInput');
add('get',b+'/classes/{class_id}/schedules','Horários recorrentes','Schedule',null,{list:true});
add('post',b+'/classes/{class_id}/schedules','Adicionar horário','Schedule','ScheduleInput',{status:201});
add('get',b+'/sessions','Aulas; tablet vê somente abertas','Session',null,{list:true,params:[{name:'date',in:'query',schema:{type:'string',format:'date'}}]});
add('post',b+'/classes/{class_id}/sessions','Abrir aula de hoje sem duplicar','Session','OpenInput');
add('patch',b+'/sessions/{session_id}','Encerrar ou cancelar','OK','SessionUpdate');
add('post',b+'/sessions/{session_id}/check-ins','Confirmar presença em transação','CheckinResult','CheckinInput',{params:[{name:'Idempotency-Key',in:'header',required:true,schema:uuid}]});
add('get',b+'/sessions/{session_id}/attendances','Lista para professor responsável ou gestor','Attendance',null,{list:true});
add('get',b+'/me/attendances','Histórico do aluno; últimos 200','Attendance',null,{list:true});
add('get',b+'/me/student-credential','QR e código do aluno ativo','Credential');
add('post',b+'/devices','Autorizar tablet; revoga sessão pessoal usada','DeviceCredential','DeviceInput',{status:201});
add('get',b+'/devices','Listar tablets','Device',null,{list:true});
add('delete',b+'/devices/{device_id}','Desautorizar tablet','OK');
add('get',b+'/dashboard','Resumo limitado ao papel autorizado','Dashboard',null,{params:[{name:'role',in:'query',schema:role}]});
add('get','/healthz','Verificar API e PostgreSQL','Health',null,{public:true});
const output=JSON.stringify(spec,null,2)+'\n';
writeFileSync(resolve(root,'backend/internal/httpapi/openapi.json'),output);
writeFileSync(resolve(root,'docs/openapi.json'),output);
console.log('OpenAPI: '+Object.keys(spec.paths).length+' caminhos documentados.');
