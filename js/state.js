// Shared application state, settings/session constants, parsing helpers, and data access helpers.

const DayType={Day:'Day',EveningMonThu:'EveningMonThu',EveningFri:'EveningFri',Night:'Night',OvertimeDay:'OvertimeDay'};
const INACTIVITY_RESET_KEY='planning.inactivityResetMinutes';
const VIEWER_SHIFT_LEAD_KEY='planning.viewerShiftLeadMinutes';
const VIEWER_EDIT_KEY='planning.viewerCanEditAssignments';
const VIEWER_WARNINGS_KEY='planning.viewerShowWarnings';
const COORD_AUTO_LOGOUT_KEY='planning.coordAutoLogoutMinutes';
const INACTIVITY_ACTIVITY_EVENTS=['pointerdown','keydown','touchstart'];
let mode='viewer',currentFactoryId=1,currentDate=new Date(),dayChoice='today',currentDayType=DayType.EveningMonThu,currentShift='evening',draggingPersonId=null,inactivityResetMinutes=0,inactivityTimerId=null,viewerNoticeTimerId=null,viewerShiftLeadMinutes=0,viewerShiftSyncIntervalId=null,viewerCanEditAssignments=false,viewerShowWarnings=true,viewerActivityTrackingBound=false,coordAutoLogoutMinutes=0,coordAutoLogoutTimerId=null,coordActivityTrackingBound=false;
let summaryData=null,activeSummaryFilter='all';
let lastAutoGenerateContext=null;
let assignmentHistoryUndoStack=[];
let assignmentHistoryRedoStack=[];
let assignmentHistoryBatch=null;
let assignmentHistoryIsReplaying=false;
let summaryWarningRefitRafId=0;
let summaryWarningRefitUntil=0;

function parseFactoryId(v){
	const s=String(v ?? '');
	return /^\d+$/.test(s) ? parseInt(s,10) : s;
}

function parseEntityId(v){
	const s=String(v ?? '');
	return /^\d+$/.test(s) ? parseInt(s,10) : s;
}

function escapeDataId(id){
	return CSS.escape(String(id));
}

function setButtonGroupValue(group, value){
	if(!group) return;
	group.querySelectorAll('[data-value]').forEach(btn=>{
		const active=btn.dataset.value===String(value);
		btn.classList.toggle('active', active);
		btn.setAttribute('aria-pressed', active ? 'true' : 'false');
	});
}

function detectCurrentShift(date=new Date()){
	const mins=(date.getHours()*60)+date.getMinutes();
	if(mins>=6*60+55 && mins<14*60+52) return 'day';
	if(mins>=14*60+52 || mins<31) return 'evening';
	return 'night';
}

function syncShiftUi(){
	setButtonGroupValue(document.getElementById('shiftSel'), currentShift);
	const settingsShiftSel=document.getElementById('settingsShiftSel');
	if(settingsShiftSel) settingsShiftSel.value=currentShift;
}

function shiftLabel(shift){
	switch(shift){
		case 'day': return 'dag';
		case 'evening': return 'kväll';
		case 'night': return 'natt';
		default: return String(shift||'');
	}
}

function capitalizeFirst(s){
	const str=String(s||'').trim();
	if(!str) return '';
	return str.charAt(0).toUpperCase()+str.slice(1);
}

function getCurrentFactoryTitle(){
	return DB.factories.find(f=>String(f.id)===String(currentFactoryId))?.title || String(currentFactoryId);
}

function getInactivityResetMinutes(){
	const raw=localStorage.getItem(INACTIVITY_RESET_KEY);
	const parsed=Number.parseInt(raw ?? '0',10);
	return Number.isFinite(parsed) && parsed>0 ? parsed : 0;
}

function getViewerShiftLeadMinutes(){
	const raw=localStorage.getItem(VIEWER_SHIFT_LEAD_KEY);
	const parsed=Number.parseInt(raw ?? '0',10);
	return Number.isFinite(parsed) && parsed>=0 ? parsed : 0;
}

function getViewerEditSetting(){
	const fromSettings=DB?.appSettings?.ViewerCanEditAssignments;
	if(typeof fromSettings==='boolean') return fromSettings;
	return localStorage.getItem(VIEWER_EDIT_KEY)==='1';
}

function getViewerWarningsSetting(){
	const fromSettings=DB?.appSettings?.ViewerShowWarnings;
	if(typeof fromSettings==='boolean') return fromSettings;
	const raw=localStorage.getItem(VIEWER_WARNINGS_KEY);
	return raw===null ? true : raw==='1';
}

function getCoordAutoLogoutMinutes(){
	const fromSettings=DB?.appSettings?.CoordAutoLogoutMinutes;
	const raw=(fromSettings ?? localStorage.getItem(COORD_AUTO_LOGOUT_KEY) ?? '0');
	const parsed=Number.parseInt(raw,10);
	return Number.isFinite(parsed) && parsed>=0 ? parsed : 0;
}

function syncInactivitySettingInput(){
	const input=document.getElementById('idleResetMinutes');
	if(input) input.value=String(inactivityResetMinutes);
}

function syncViewerShiftLeadSettingInput(){
	const input=document.getElementById('viewerShiftLeadMinutes');
	if(input) input.value=String(viewerShiftLeadMinutes);
}

function syncViewerEditSettingInput(){
	const input=document.getElementById('viewerCanEditAssignments');
	if(input) input.checked=!!viewerCanEditAssignments;
}

function syncViewerWarningsSettingInput(){
	const input=document.getElementById('viewerShowWarnings');
	if(input) input.checked=!!viewerShowWarnings;
}

function syncCoordAutoLogoutInput(){
	const input=document.getElementById('coordAutoLogoutMinutes');
	if(input) input.value=String(coordAutoLogoutMinutes);
}

function applyViewerEditSetting(enabled,{persist=true}={}){
	viewerCanEditAssignments=!!enabled;
	if(!DB.appSettings) DB.appSettings={};
	if(persist){
		DB.appSettings.ViewerCanEditAssignments=viewerCanEditAssignments;
		localStorage.setItem(VIEWER_EDIT_KEY, viewerCanEditAssignments ? '1' : '0');
	}
	syncViewerEditSettingInput();
	refreshPersonPillVariants({animate:true});
}

function shouldValidateBoardForMode(){
	return mode==='edit' || (mode==='viewer' && viewerShowWarnings);
}

function shouldShowCompatibilityWarnings(){
	return mode==='edit';
}

function applyViewerWarningsSetting(enabled,{persist=true,rerender=true}={}){
	viewerShowWarnings=!!enabled;
	if(!DB.appSettings) DB.appSettings={};
	if(persist){
		DB.appSettings.ViewerShowWarnings=viewerShowWarnings;
		localStorage.setItem(VIEWER_WARNINGS_KEY, viewerShowWarnings ? '1' : '0');
	}
	syncViewerWarningsSettingInput();
	if(rerender) rebuildAll();
}

function applyCoordAutoLogoutSetting(value,{persist=true}={}){
	const minutes=Math.max(0, Number.parseInt(value ?? '0',10) || 0);
	coordAutoLogoutMinutes=minutes;
	if(!DB.appSettings) DB.appSettings={};
	if(persist){
		DB.appSettings.CoordAutoLogoutMinutes=minutes;
		localStorage.setItem(COORD_AUTO_LOGOUT_KEY, String(minutes));
	}
	syncCoordAutoLogoutInput();
	scheduleCoordinatorAutoLogout();
}

function getPersonPillDisplayVariant(){
	return (mode==='edit' || (mode==='viewer' && viewerCanEditAssignments)) ? 'removable' : 'compact';
}

function canModifyAssignments(){
	return getPersonPillDisplayVariant()==='removable';
}

function formatHeaderDateContext(date, shift, dayType){
	const weekday=['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'][date.getDay()];
	const dd=date.getDate();
	const mm=date.getMonth()+1;
	let out=`${weekday} ${shiftLabel(shift)} ${dd}/${mm}`;
	if(dayType===DayType.OvertimeDay) out += ' ÖVERTID';
	return out;
}

function updateHeaderContext(){
	const text=formatHeaderDateContext(currentDate,currentShift,currentDayType);
	const el=document.getElementById('headerContext');
	if(el){
		const strong=el.querySelector('strong');
		if(strong) strong.textContent=text;
	}
	const printEl=document.getElementById('printHeaderContext');
	if(printEl) printEl.textContent=text;
}

function cloneDeep(v){
	return JSON.parse(JSON.stringify(v));
}

function buildShiftSpecificTimeSlots(baseTimeSlots, shift){
	const slots=cloneDeep(baseTimeSlots||[]);
	if(shift!=='evening') return slots;
	const eveningOvertime=[["15:00","16:00","Work"],["16:00","17:00","Work"],["17:00","17:45","Break"],["17:45","19:00","Work"],["19:00","20:30","Work"],["20:30","20:55","Break"],["20:55","22:30","Work"],["22:30","22:45","Break"],["22:45","00:00","Work"]];
	const byFactory=new Map();
	for(const slot of slots){
		if(slot.dayType!==DayType.OvertimeDay) continue;
		const arr=byFactory.get(slot.factoryId)||[];
		arr.push(slot);
		byFactory.set(slot.factoryId,arr);
	}
	for(const arr of byFactory.values()){
		arr.sort((a,b)=>a.sort-b.sort);
		const factoryId=arr[0]?.factoryId;
		const prefix=`${factoryId}-${DayType.OvertimeDay}-`;
		for(let i=0;i<eveningOvertime.length;i++){
			const cur=arr[i];
			if(cur){
				cur.start=eveningOvertime[i][0];
				cur.end=eveningOvertime[i][1];
				cur.type=eveningOvertime[i][2];
				cur.sort=i+1;
			}else{
				slots.push({id:`${prefix}${i+1}`,factoryId,dayType:DayType.OvertimeDay,start:eveningOvertime[i][0],end:eveningOvertime[i][1],type:eveningOvertime[i][2],sort:i+1});
			}
		}
		for(let i=arr.length-1;i>=eveningOvertime.length;i--){
			const idx=slots.indexOf(arr[i]);
			if(idx>=0) slots.splice(idx,1);
		}
	}
	return slots;
}

function initShiftData(){
	const initialDiagnostics=validateDbShape(DB,{context:'initShiftData: before setup'});
	if(!initialDiagnostics.ok) return false;

	if(!DB.shiftData){
		const base={
			persons:cloneDeep(DB.persons||[]),
			groups:cloneDeep(DB.groups||[]),
			timeSlots:cloneDeep(DB.timeSlots||[]),
			compatibility:cloneDeep(DB.compatibility||[]),
			training:cloneDeep(DB.training||[]),
			assignments:cloneDeep(DB.assignments||[]),
			groupDisplayOrder:cloneDeep(DB.groupDisplayOrder||{})
		};
		DB.shiftData={day:cloneDeep(base),evening:cloneDeep(base),night:cloneDeep(base)};
	}

	const fallbackTimeSlots=cloneDeep(DB.timeSlots||[]);
	for(const shift of ['day','evening','night']){
		if(!DB.shiftData[shift]) DB.shiftData[shift]={};
		if(!Array.isArray(DB.shiftData[shift].timeSlots) || DB.shiftData[shift].timeSlots.length===0){
			DB.shiftData[shift].timeSlots=buildShiftSpecificTimeSlots(fallbackTimeSlots, shift);
		}
	}

	const diagnostics=validateDbShape(DB,{context:'initShiftData: after setup',requireShiftData:true});
	if(!diagnostics.ok) return false;
	return setShift('evening',{updateUrl:false});
}

function getActiveShiftData(){
	return DB.shiftData[currentShift];
}

function setShift(shift,{updateUrl=true}={}){
	const nextShift=(shift==='day'||shift==='evening'||shift==='night')?shift:'evening';
	const diagnostics=validateDbShape(DB,{context:`setShift: ${nextShift}`,requireShiftData:true,shift:nextShift});
	if(!diagnostics.ok) return false;
	currentShift=nextShift;
	const data=getActiveShiftData();
	if(!data){
		renderSchemaDiagnostics({ok:false,context:`setShift: ${nextShift}`,issues:[{code:'MISSING_SHIFT',path:`DB.shiftData.${nextShift}`,message:`Saknar dataset för skiftet ${nextShift}.`}]});
		return false;
	}
	DB.persons=data.persons;
	DB.groups=data.groups;
	DB.timeSlots=data.timeSlots;
	DB.compatibility=data.compatibility;
	DB.training=data.training;
	DB.assignments=data.assignments;
	DB.groupDisplayOrder=data.groupDisplayOrder;
	if(updateUrl){
		const nextQs = new URLSearchParams(window.location.search);
		nextQs.set('shift', currentShift);
		nextQs.set('factory', String(currentFactoryId));
		const nextUrl = `${window.location.pathname}?${nextQs.toString()}${window.location.hash || ''}`;
		window.history.replaceState(null, '', nextUrl);
	}
	return true;
}

function getShiftPersonsFor(shift, factoryId=currentFactoryId){
	const rows = DB.shiftData?.[shift]?.persons || [];
	return rows.filter(p=>p.factoryId===factoryId);
}

function getPlanningPersons(factoryId=currentFactoryId){
	if(currentDayType!==DayType.OvertimeDay || !DB.shiftData){
		return DB.persons.filter(p=>p.factoryId===factoryId);
	}
	const byId = new Map();
	for(const shift of ['day','evening','night']){
		for(const p of getShiftPersonsFor(shift, factoryId)){
			if(!byId.has(p.id)) byId.set(p.id,p);
		}
	}
	return [...byId.values()];
}

function getPlanningPersonById(personId, factoryId=currentFactoryId){
	return getPlanningPersons(factoryId).find(p=>p.id===personId) || DB.persons.find(p=>p.id===personId) || (DB.shiftData ? ['day','evening','night'].flatMap(k=>DB.shiftData[k]?.persons||[]).find(p=>p.id===personId) : null);
}

function isPersonTrainedForStation(personId, stationId){
	if(!DB.shiftData){
		return DB.training.some(t=>t.personId===personId && t.stationId===stationId);
	}
	if(currentDayType===DayType.OvertimeDay){
		for(const shift of ['day','evening','night']){
			if((DB.shiftData[shift]?.training||[]).some(t=>t.personId===personId && t.stationId===stationId)) return true;
		}
		return false;
	}
	if(DB.training.some(t=>t.personId===personId && t.stationId===stationId)) return true;
	if(currentShift==='evening' && (DB.shiftData.night?.persons||[]).some(p=>p.id===personId)){
		return (DB.shiftData.night?.training||[]).some(t=>t.personId===personId && t.stationId===stationId);
	}
	return false;
}

function isLastEveningWorkSlot(slot){
	if(currentShift!=='evening') return false;
	const workSlots=DB.timeSlots
		.filter(ts=>ts.factoryId===currentFactoryId && ts.dayType===currentDayType && ts.type==='Work')
		.sort((a,b)=>a.sort-b.sort);
	return workSlots.length>0 && workSlots[workSlots.length-1].id===slot.id;
}

function getEveningSupplementalPersons(slot){
	if(!isLastEveningWorkSlot(slot)) return [];
	return getShiftPersonsFor('night', currentFactoryId);
}


function getSelectedDateStr(){return document.getElementById('dateInput').value;}
function groupTitle(groupId){return(DB.groups.find(g=>g.id===groupId)||{}).title||'Resurs';}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
function cellDiv(cls){const d=document.createElement('div');d.className=cls;return d;}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}}
let _idCounter=0;
let _lastIdTs=0;
function newId(){
	const existing=new Set([
		...DB.persons.map(x=>String(x.id)),
		...DB.groups.map(x=>String(x.id)),
		...DB.stations.map(x=>String(x.id)),
		...DB.timeSlots.map(x=>String(x.id))
	]);

	if(typeof crypto!=='undefined' && typeof crypto.randomUUID==='function'){
		for(let i=0;i<5;i++){
			const candidate=crypto.randomUUID();
			if(!existing.has(candidate)) return candidate;
		}
	}

	const now=Date.now();
	if(now===_lastIdTs) _idCounter+=1;
	else{
		_lastIdTs=now;
		_idCounter=0;
	}
	let candidate=`id-${now.toString(36)}-${_idCounter.toString(36)}-${Math.random().toString(36).slice(2,8)}`;
	while(existing.has(candidate)){
		_idCounter+=1;
		candidate=`id-${now.toString(36)}-${_idCounter.toString(36)}-${Math.random().toString(36).slice(2,8)}`;
	}
	return candidate;
}
function groupBy(arr,key){const m={};for(const it of arr){const k=it[key];if(!m[k])m[k]=[];m[k].push(it);}return m;}
function groupArray(arr,keyFn){const m=new Map();for(const it of arr){const k=keyFn(it);const s=m.get(k)||[];s.push(it);m.set(k,s);}return m;}
function timeLess(hm,hm2){return hm.localeCompare(hm2)<0;}
function getWeekdayCode(d){return['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];}
function getNightCutoffFor(factoryId,date){const day=getWeekdayCode(date);const row=DB.weekdaySettings.find(r=>r.factoryId===factoryId&&r.day===day);return row?row.nightEarliest:'21:45';}
function contrastColor(hex){hex=hex.replace('#','');if(hex.length===3){hex=hex.split('').map(x=>x+x).join('');}const r=parseInt(hex.substr(0,2),16),g=parseInt(hex.substr(2,2),16),b=parseInt(hex.substr(4,2),16);const yiq=((r*299)+(g*587)+(b*114))/1000;return yiq>=128?'#000':'#fff';}
function normalizeHexColor(hex, fallback='#cccccc'){
	hex = String(hex || fallback).replace('#','').trim();
	if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
	if(!/^[0-9a-f]{6}$/i.test(hex)) hex = fallback.replace('#','');
	return `#${hex.toLowerCase()}`;
}

function mixHexColor(hex, targetHex, t){
	hex = normalizeHexColor(hex).slice(1);
	targetHex = normalizeHexColor(targetHex).slice(1);
	t = Math.max(0, Math.min(1, Number(t) || 0));
	const src = [0, 2, 4].map(i=>parseInt(hex.slice(i, i + 2), 16));
	const target = [0, 2, 4].map(i=>parseInt(targetHex.slice(i, i + 2), 16));
	return `rgb(${src.map((channel, i)=>Math.round(channel + (target[i] - channel) * t)).join(' ')})`;
}

function contrastColorForRgb(rgb){
	const channels = String(rgb).match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
	if(!channels || channels.length < 3) return contrastColor(rgb);
	const [r, g, b] = channels;
	const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
	return yiq >= 128 ? '#000' : '#fff';
}

function getEffectiveBootstrapTheme(){
	const theme = document.documentElement.getAttribute('data-bs-theme') || 'auto';
	if(theme === 'auto'){
		return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	return theme;
}

function lightenToWhite(hex, t){
	// t in [0..1] — 0 = unchanged, 1 = white
	hex = (hex||'#cccccc').replace('#','').trim();
	if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
	const n = parseInt(hex, 16);
	let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
	r = Math.round(r + (255 - r) * t);
	g = Math.round(g + (255 - g) * t);
	b = Math.round(b + (255 - b) * t);
	return `rgb(${r} ${g} ${b})`;
}

function getPersonPillPalette(groupColor){
	const color = normalizeHexColor(groupColor);
	if(getEffectiveBootstrapTheme() === 'dark'){
		const background = mixHexColor(color, '#000000', 0.54);
		return {
			background,
			border: mixHexColor(color, '#000000', 0.38),
			foreground: contrastColorForRgb(background)
		};
	}
	const background = lightenToWhite(color, 0.86);
	return {
		background,
		border: lightenToWhite(color, 0.70),
		foreground: contrastColorForRgb(background)
	};
}

function getGroupHeaderPalette(groupColor){
	const color = normalizeHexColor(groupColor);
	const background = getEffectiveBootstrapTheme() === 'dark'
		? mixHexColor(color, '#000000', 0.30)
		: color;
	return {
		background,
		foreground: contrastColorForRgb(background)
	};
}

async function sha256(message){const msgUint8=new TextEncoder().encode(message);const hashBuffer=await crypto.subtle.digest('SHA-256',msgUint8);const hashArray=Array.from(new Uint8Array(hashBuffer));return hashArray.map(b=>b.toString(16).padStart(2,'0')).join('');}
function normalize24(val){
	val=(val||'').replace(/[^0-9]/g,'');
	if(val.length<=2){val=val.padStart(2,'0')+':00';}
	else if(val.length===3){val='0'+val[0]+':'+val.slice(1);}
	else{val=val.slice(0,4);val=val.slice(0,2)+':'+val.slice(2);}
	const [hh,mm]=val.split(':').map(x=>parseInt(x,10));
	const HH=Math.min(23,Math.max(0,hh));
	const MM=Math.min(59,Math.max(0,mm));
	return String(HH).padStart(2,'0')+':'+String(MM).padStart(2,'0');
}
