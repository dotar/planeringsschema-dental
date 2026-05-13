// Runtime schema assertions and UI diagnostics for planning data.

class SchemaAssertionError extends Error{
	constructor(message, diagnostics){
		super(message);
		this.name='SchemaAssertionError';
		this.diagnostics=diagnostics;
	}
}

const SCHEMA_SHIFTS=['day','evening','night'];
const SCHEMA_TOP_ARRAYS=['factories','stations','persons','training','assignments'];
const SCHEMA_SHIFT_ARRAYS=['persons','training','assignments'];
let schemaDiagnosticsLastResult=null;

function schemaTypeOf(value){
	if(Array.isArray(value)) return 'array';
	if(value===null) return 'null';
	return typeof value;
}

function schemaIsEntityId(value){
	return (typeof value==='number' && Number.isFinite(value)) || (typeof value==='string' && value.trim()!=='');
}

function schemaAddIssue(issues, code, message, path, details={}){
	issues.push({code,message,path,...details});
}

function schemaEscapeHtml(value){
	return String(value).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
}

function schemaAssertArray(data, key, issues, pathPrefix='DB'){
	if(Array.isArray(data?.[key])) return true;
	schemaAddIssue(
		issues,
		'MISSING_ARRAY',
		`${pathPrefix}.${key} måste vara en array men är ${schemaTypeOf(data?.[key])}.`,
		`${pathPrefix}.${key}`,
		{expected:'array',actual:schemaTypeOf(data?.[key])}
	);
	return false;
}

function schemaCheckRequiredKeys(rows, keys, issues, pathPrefix){
	if(!Array.isArray(rows)) return;
	rows.forEach((row,index)=>{
		if(!row || typeof row!=='object' || Array.isArray(row)){
			schemaAddIssue(issues,'INVALID_ROW',`${pathPrefix}[${index}] måste vara ett objekt.`,`${pathPrefix}[${index}]`,{actual:schemaTypeOf(row)});
			return;
		}
		for(const key of keys){
			if(!(key in row)) schemaAddIssue(issues,'MISSING_KEY',`${pathPrefix}[${index}].${key} saknas.`,`${pathPrefix}[${index}].${key}`);
		}
	});
}

function schemaCheckUniqueIds(rows, label, issues, pathPrefix){
	if(!Array.isArray(rows)) return new Set();
	const ids=new Set();
	const seen=new Set();
	rows.forEach((row,index)=>{
		const id=row?.id;
		if(!schemaIsEntityId(id)){
			schemaAddIssue(issues,'INVALID_ID',`${pathPrefix}[${index}].id måste vara ett giltigt id.`,`${pathPrefix}[${index}].id`,{label});
			return;
		}
		const key=String(id);
		if(seen.has(key)) schemaAddIssue(issues,'DUPLICATE_ID',`${label} har duplicerat id "${key}".`,`${pathPrefix}[${index}].id`,{label,id});
		seen.add(key);
		ids.add(key);
	});
	return ids;
}

function schemaCheckEntityRows(data, issues, pathPrefix='DB'){
	const factoryIds=schemaCheckUniqueIds(data.factories,'factories',issues,`${pathPrefix}.factories`);
	const stationIds=schemaCheckUniqueIds(data.stations,'stations',issues,`${pathPrefix}.stations`);
	const personIds=schemaCheckUniqueIds(data.persons,'persons',issues,`${pathPrefix}.persons`);

	schemaCheckRequiredKeys(data.factories,['id','title'],issues,`${pathPrefix}.factories`);
	schemaCheckRequiredKeys(data.stations,['id','factoryId','title','defaultCapacity','operational','sort'],issues,`${pathPrefix}.stations`);
	schemaCheckRequiredKeys(data.persons,['id','name','factoryId','groupId','isNight','present'],issues,`${pathPrefix}.persons`);
	schemaCheckRequiredKeys(data.training,['personId','stationId'],issues,`${pathPrefix}.training`);
	schemaCheckRequiredKeys(data.assignments,['date','factoryId','dayType','timeSlotId','stationId','personId'],issues,`${pathPrefix}.assignments`);

	if(Array.isArray(data.stations)){
		data.stations.forEach((station,index)=>{
			if(station && schemaIsEntityId(station.factoryId) && !factoryIds.has(String(station.factoryId))){
				schemaAddIssue(issues,'UNKNOWN_FACTORY',`${pathPrefix}.stations[${index}] pekar på okänd factoryId "${station.factoryId}".`,`${pathPrefix}.stations[${index}].factoryId`,{factoryId:station.factoryId});
			}
		});
	}
	if(Array.isArray(data.persons)){
		data.persons.forEach((person,index)=>{
			if(person && schemaIsEntityId(person.factoryId) && !factoryIds.has(String(person.factoryId))){
				schemaAddIssue(issues,'UNKNOWN_FACTORY',`${pathPrefix}.persons[${index}] pekar på okänd factoryId "${person.factoryId}".`,`${pathPrefix}.persons[${index}].factoryId`,{factoryId:person.factoryId});
			}
		});
	}
	if(Array.isArray(data.training)){
		data.training.forEach((row,index)=>{
			if(row && schemaIsEntityId(row.personId) && !personIds.has(String(row.personId))){
				schemaAddIssue(issues,'UNKNOWN_PERSON',`${pathPrefix}.training[${index}] pekar på okänd personId "${row.personId}".`,`${pathPrefix}.training[${index}].personId`,{personId:row.personId});
			}
			if(row && schemaIsEntityId(row.stationId) && !stationIds.has(String(row.stationId))){
				schemaAddIssue(issues,'UNKNOWN_STATION',`${pathPrefix}.training[${index}] pekar på okänd stationId "${row.stationId}".`,`${pathPrefix}.training[${index}].stationId`,{stationId:row.stationId});
			}
		});
	}
	if(Array.isArray(data.assignments)){
		data.assignments.forEach((row,index)=>{
			if(row && schemaIsEntityId(row.personId) && !personIds.has(String(row.personId))){
				schemaAddIssue(issues,'UNKNOWN_PERSON',`${pathPrefix}.assignments[${index}] pekar på okänd personId "${row.personId}".`,`${pathPrefix}.assignments[${index}].personId`,{personId:row.personId});
			}
			if(row && schemaIsEntityId(row.stationId) && !stationIds.has(String(row.stationId))){
				schemaAddIssue(issues,'UNKNOWN_STATION',`${pathPrefix}.assignments[${index}] pekar på okänd stationId "${row.stationId}".`,`${pathPrefix}.assignments[${index}].stationId`,{stationId:row.stationId});
			}
		});
	}
}

function assertDbShape(data,{context='DB',requireShiftData=false,shift=null}={}){
	const issues=[];
	if(!data || typeof data!=='object' || Array.isArray(data)){
		schemaAddIssue(issues,'INVALID_DB','DB måste vara ett objekt.','DB',{actual:schemaTypeOf(data)});
	}else{
		for(const key of SCHEMA_TOP_ARRAYS) schemaAssertArray(data,key,issues,'DB');
		if(SCHEMA_TOP_ARRAYS.every(key=>Array.isArray(data[key]))) schemaCheckEntityRows(data,issues,'DB');

		if(requireShiftData || data.shiftData!==undefined){
			if(!data.shiftData || typeof data.shiftData!=='object' || Array.isArray(data.shiftData)){
				schemaAddIssue(issues,'INVALID_SHIFT_DATA','DB.shiftData måste vara ett objekt med day/evening/night.','DB.shiftData',{actual:schemaTypeOf(data.shiftData)});
			}else{
				const shifts=shift ? [shift] : SCHEMA_SHIFTS;
				for(const shiftKey of shifts){
					const shiftPath=`DB.shiftData.${shiftKey}`;
					const shiftData=data.shiftData[shiftKey];
					if(!shiftData || typeof shiftData!=='object' || Array.isArray(shiftData)){
						schemaAddIssue(issues,'MISSING_SHIFT',`${shiftPath} måste vara ett objekt.`,shiftPath,{shift:shiftKey,actual:schemaTypeOf(shiftData)});
						continue;
					}
					for(const key of SCHEMA_SHIFT_ARRAYS) schemaAssertArray(shiftData,key,issues,shiftPath);
					const merged={
						factories:data.factories,
						stations:data.stations,
						persons:shiftData.persons,
						training:shiftData.training,
						assignments:shiftData.assignments
					};
					if(SCHEMA_SHIFT_ARRAYS.every(key=>Array.isArray(shiftData[key])) && Array.isArray(data.factories) && Array.isArray(data.stations)){
						schemaCheckEntityRows(merged,issues,shiftPath);
					}
				}
			}
		}
	}

	const diagnostics={ok:issues.length===0,context,issues};
	if(issues.length) throw new SchemaAssertionError(`DB schema validation failed in ${context}`, diagnostics);
	return diagnostics;
}

function ensureSchemaDiagnosticsBanner(){
	if(typeof document==='undefined') return null;
	let banner=document.getElementById('schemaDiagnosticsBanner');
	if(banner) return banner;
	banner=document.createElement('div');
	banner.id='schemaDiagnosticsBanner';
	banner.className='alert alert-danger py-2 my-2 schema-diagnostics d-none';
	banner.setAttribute('role','alert');
	banner.setAttribute('aria-live','assertive');
	const app=document.getElementById('app');
	const anchor=document.getElementById('suggestionAlert') || app?.firstChild || null;
	if(app) app.insertBefore(banner, anchor);
	else document.body?.prepend(banner);
	return banner;
}

function renderSchemaDiagnostics(diagnostics){
	schemaDiagnosticsLastResult=diagnostics;
	const banner=ensureSchemaDiagnosticsBanner();
	if(!banner) return;
	const issues=diagnostics?.issues || [];
	if(!issues.length){
		banner.classList.add('d-none');
		banner.innerHTML='';
		return;
	}
	const shown=issues.slice(0,8);
	const more=issues.length-shown.length;
	banner.classList.remove('d-none');
	banner.innerHTML=`
		<div class="d-flex align-items-start gap-2">
			<i class="bi bi-exclamation-octagon-fill flex-shrink-0 mt-1" aria-hidden="true"></i>
			<div>
				<div class="fw-semibold">Datadiagnostik: planeringsdatan har fel struktur (${issues.length} fel).</div>
				<div class="small">Visningen pausas för att undvika inkonsekventa tilldelningar. Kontext: ${schemaEscapeHtml(String(diagnostics.context||'DB'))}</div>
				<ul class="small mb-0 mt-1 ps-3">${shown.map(issue=>`<li><code>${schemaEscapeHtml(issue.path||'DB')}</code>: ${schemaEscapeHtml(issue.message||issue.code)}</li>`).join('')}${more>0?`<li>… ${more} fler fel. Se konsolen för detaljer.</li>`:''}</ul>
			</div>
		</div>`;
}

function validateDbShape(data, options={}){
	try{
		const diagnostics=assertDbShape(data,options);
		renderSchemaDiagnostics(diagnostics);
		return diagnostics;
	}catch(error){
		const diagnostics=error instanceof SchemaAssertionError ? error.diagnostics : {ok:false,context:options.context||'DB',issues:[{code:'SCHEMA_EXCEPTION',path:'DB',message:error?.message||String(error)}]};
		if(typeof console!=='undefined' && typeof console.error==='function') console.error('[schema] DB schema validation failed', diagnostics, error);
		renderSchemaDiagnostics(diagnostics);
		return diagnostics;
	}
}

function hasSchemaDiagnostics(){
	return !!(schemaDiagnosticsLastResult && schemaDiagnosticsLastResult.issues && schemaDiagnosticsLastResult.issues.length);
}

if(typeof module!=='undefined'&&module.exports){
	module.exports={SchemaAssertionError,assertDbShape,validateDbShape,hasSchemaDiagnostics};
}
