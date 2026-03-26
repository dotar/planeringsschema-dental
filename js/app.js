const DayType={Day:'Day',EveningMonThu:'EveningMonThu',EveningFri:'EveningFri',Night:'Night',OvertimeDay:'OvertimeDay'};
let mode='viewer',currentFactoryId=1,currentDate=new Date(),dayChoice='today',currentDayType=DayType.EveningMonThu,currentShift='evening',draggingPersonId=null,inactivityResetMinutes=0,inactivityTimerId=null,viewerNoticeTimerId=null,viewerShiftLeadMinutes=0,viewerShiftSyncIntervalId=null,viewerCanEditAssignments=false,viewerActivityTrackingBound=false,coordAutoLogoutMinutes=0,coordAutoLogoutTimerId=null,coordActivityTrackingBound=false;
let summaryData=null,activeSummaryFilter='all';
let summaryInfoPopover=null,summaryInfoBound=false,summaryInfoHideTimerId=null;

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

const INACTIVITY_RESET_KEY='planning.inactivityResetMinutes';
const VIEWER_SHIFT_LEAD_KEY='planning.viewerShiftLeadMinutes';
const VIEWER_EDIT_KEY='planning.viewerCanEditAssignments';
const COORD_AUTO_LOGOUT_KEY='planning.coordAutoLogoutMinutes';
const INACTIVITY_ACTIVITY_EVENTS=['pointerdown','keydown','touchstart'];

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
}

function logoutCoordinator({reason='' }={}){
	sessionStorage.removeItem('planning.coord');
	applyMode('viewer');
	renderSettings();
	rebuildAll();
	if(reason) showToast('info','Utloggad',reason);
}

function scheduleCoordinatorAutoLogout(){
	if(coordAutoLogoutTimerId){
		clearTimeout(coordAutoLogoutTimerId);
		coordAutoLogoutTimerId=null;
	}
	if(mode!=='edit' || coordAutoLogoutMinutes<=0 || sessionStorage.getItem('planning.coord')!=='ok') return;
	coordAutoLogoutTimerId=window.setTimeout(()=>{
		logoutCoordinator({reason:`Koordinatorläget loggades ut efter ${coordAutoLogoutMinutes} minuters inaktivitet.`});
	}, coordAutoLogoutMinutes*60*1000);
}

function recordCoordinatorActivity(){
	scheduleCoordinatorAutoLogout();
}

function bindCoordinatorActivityListeners(enabled){
	if(enabled && !coordActivityTrackingBound){
		INACTIVITY_ACTIVITY_EVENTS.forEach(evt=>document.addEventListener(evt, recordCoordinatorActivity, {passive:true}));
		coordActivityTrackingBound=true;
		return;
	}
	if(!enabled && coordActivityTrackingBound){
		INACTIVITY_ACTIVITY_EVENTS.forEach(evt=>document.removeEventListener(evt, recordCoordinatorActivity, {passive:true}));
		coordActivityTrackingBound=false;
	}
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

function canModifyAssignments(){
	return mode==='edit' || viewerCanEditAssignments;
}

function bindViewerActivityListeners(enabled){
	if(enabled && !viewerActivityTrackingBound){
		INACTIVITY_ACTIVITY_EVENTS.forEach(evt=>document.addEventListener(evt, recordActivity, {passive:true}));
		viewerActivityTrackingBound=true;
		return;
	}
	if(!enabled && viewerActivityTrackingBound){
		INACTIVITY_ACTIVITY_EVENTS.forEach(evt=>document.removeEventListener(evt, recordActivity, {passive:true}));
		viewerActivityTrackingBound=false;
	}
}

function applyMode(nextMode,{updateUrl=true}={}){
	mode=nextMode==='edit' ? 'edit' : 'viewer';
	document.documentElement.dataset.mode = mode;
	document.body.classList.toggle('viewer',mode!=='edit');
	const badge=document.getElementById('modeBadge');
	if(badge){
		badge.textContent=mode==='edit'?'COORDINATOR':'VIEWER';
		badge.classList.toggle('text-bg-success', mode==='edit');
		badge.classList.toggle('text-bg-secondary', mode!=='edit');
		badge.title=mode==='edit'?'Klicka för att logga ut':'Klicka för att logga in som koordinator';
	}
	bindViewerActivityListeners(mode==='viewer');
	bindCoordinatorActivityListeners(mode==='edit');
	scheduleInactivityReset();
	scheduleViewerShiftSync();
	scheduleCoordinatorAutoLogout();
	if(updateUrl){
		const nextQs = new URLSearchParams(window.location.search);
		nextQs.set('mode', mode==='edit'?'edit':'viewer');
		nextQs.set('factory', String(currentFactoryId));
		nextQs.set('shift', currentShift);
		const nextUrl = `${window.location.pathname}?${nextQs.toString()}${window.location.hash || ''}`;
		window.history.replaceState(null, '', nextUrl);
	}
}

function dismissNativeTitleTooltip(el){
	if(!el) return;
	const ttl=el.getAttribute('title');
	if(ttl==null) return;
	el.removeAttribute('title');
	window.setTimeout(()=>{
		if(document.contains(el)) el.setAttribute('title', ttl);
	}, 80);
}

function formatInactivityNoticeText(){
	const unit=inactivityResetMinutes===1 ? 'minuts' : 'minuters';
	return `Vy återställd efter ${inactivityResetMinutes} ${unit} inaktivitet`;
}

function showViewerNotice(message,{iconClass='bi-clock-history'}={}){
	const notice=document.getElementById('viewerUpdateNotice');
	if(!notice) return;
	const iconEl=notice.querySelector('.notice-icon');
	const textEl=notice.querySelector('.notice-text');
	if(iconEl){
		iconEl.className=`bi ${iconClass} me-1 notice-icon`;
	}
	if(textEl) textEl.textContent=message;
	if(viewerNoticeTimerId){
		clearTimeout(viewerNoticeTimerId);
		viewerNoticeTimerId=null;
	}
	notice.classList.remove('d-none','show');
	void notice.offsetWidth;
	notice.classList.add('show');
	viewerNoticeTimerId=window.setTimeout(()=>{
		notice.classList.remove('show');
		viewerNoticeTimerId=window.setTimeout(()=>{
			notice.classList.add('d-none');
			viewerNoticeTimerId=null;
		}, 220);
	}, 2800);
}

function resetToTodayIfNeeded(){
	if(dayChoice==='today') return;
	dayChoice='today';
	showViewerNotice(formatInactivityNoticeText(),{iconClass:'bi-clock-history'});
	setDateToOffset(0);
	setShift(detectCurrentShift(),{updateUrl:true});
	syncShiftUi();
	toggleDayButtons();
	suggestAndApplyTemplates();
	renderSettings();
	rebuildAll();
}

function scheduleInactivityReset(){
	if(inactivityTimerId){
		clearTimeout(inactivityTimerId);
		inactivityTimerId=null;
	}
	if(mode!=='viewer' || inactivityResetMinutes<=0) return;
	inactivityTimerId=window.setTimeout(()=>{
		resetToTodayIfNeeded();
		scheduleInactivityReset();
	}, inactivityResetMinutes*60*1000);
}

function recordActivity(){
	scheduleInactivityReset();
}

function applyInactivityResetSetting(value,{persist=true}={}){
	const minutes=Math.max(0, Number.parseInt(value ?? '0',10) || 0);
	inactivityResetMinutes=minutes;
	if(persist) localStorage.setItem(INACTIVITY_RESET_KEY, String(minutes));
	syncInactivitySettingInput();
	scheduleInactivityReset();
}

function getDetectedViewerShift(){
	const now=new Date(Date.now()+(viewerShiftLeadMinutes*60*1000));
	return detectCurrentShift(now);
}

function syncViewerShiftIfNeeded(){
	if(mode!=='viewer' || dayChoice!=='today') return;
	const nextShift=getDetectedViewerShift();
	if(nextShift===currentShift) return;
	const prevShift=currentShift;
	setShift(nextShift,{updateUrl:true});
	syncShiftUi();
	suggestAndApplyTemplates();
	renderSettings();
	rebuildAll();
	const minsLabel=viewerShiftLeadMinutes===1 ? '1 minut' : `${viewerShiftLeadMinutes} minuter`;
	const timingText=viewerShiftLeadMinutes===0 ? 'vid skiftstart' : `${minsLabel} före skiftstart`;
	showViewerNotice(`Visningen bytte från ${shiftLabel(prevShift)} till ${shiftLabel(nextShift)} (${timingText}).`,{iconClass:'bi-arrow-repeat'});
}

function scheduleViewerShiftSync(){
	if(viewerShiftSyncIntervalId){
		clearInterval(viewerShiftSyncIntervalId);
		viewerShiftSyncIntervalId=null;
	}
	if(mode!=='viewer') return;
	syncViewerShiftIfNeeded();
	viewerShiftSyncIntervalId=window.setInterval(syncViewerShiftIfNeeded, 30*1000);
}

function applyViewerShiftLeadSetting(value,{persist=true}={}){
	const minutes=Math.max(0, Number.parseInt(value ?? '0',10) || 0);
	viewerShiftLeadMinutes=minutes;
	if(persist) localStorage.setItem(VIEWER_SHIFT_LEAD_KEY, String(minutes));
	syncViewerShiftLeadSettingInput();
	syncViewerShiftIfNeeded();
	scheduleViewerShiftSync();
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
	const el=document.getElementById('headerContext');
	if(!el) return;
	const strong=el.querySelector('strong');
	if(strong) strong.textContent=formatHeaderDateContext(currentDate,currentShift,currentDayType);
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

	setShift('evening',{updateUrl:false});
}

function getActiveShiftData(){
	return DB.shiftData[currentShift];
}

function setShift(shift,{updateUrl=true}={}){
	currentShift=(shift==='day'||shift==='evening'||shift==='night')?shift:'evening';
	const data=getActiveShiftData();
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

let _pickerOpenCell=null;

// ---- Cell warning animation state (must be declared before init()) ----
// Detect support once
const HAS_CROSSFADE = CSS && CSS.supports && CSS.supports('background-image', 'cross-fade(var(--img-warn); var(--img-invalid); 50%)');

let _inValidation = false;
let _pendingCellStates = new Map();

function _isAnimIn(cell, kind){ return cell.dataset[`anim${kind}`]==='in'; }
function _setAnimIn(cell, kind, on){ if(on){ cell.dataset[`anim${kind}`]='in'; } else { delete cell.dataset[`anim${kind}`]; } }


// map (warn, invalid) -> state tag
function _stateTag(warn, invalid){
	if(warn && invalid) return 'both';
	if(warn) return 'warn';
	if(invalid) return 'invalid';
	return 'none';
}

/* Cross-fade exactly between prevTag and nextTag using CSS cross-fade().
   Sequence:
   1) Overlay FROM=prev; TO=next; MIX=0%.
   2) Force paint, then clear base classes (so overlay fully owns visuals).
   3) Animate MIX → 100%.
   4) On transition end: remove overlay and set base to nextTag. */
function _xfadeCF(cell, prevTag, nextTag){
	if(prevTag === nextTag){
		_setBase(cell, nextTag === 'warn' || nextTag === 'both', nextTag === 'invalid' || nextTag === 'both');
		return;
	}
	const fx = _ensureFx(cell);

	// Set images
	fx.style.setProperty('--from', _imgVar(prevTag));
	fx.style.setProperty('--to', _imgVar(nextTag));
	// Start at 0%
	fx.style.setProperty('--mix', '0%');

	// Ensure the overlay is painted BEFORE we clear base
	void fx.offsetWidth;

	// Clear base while animating to avoid double tint
	_setBase(cell, false, false);

	// Animate to 100%
	const onDone = () => {
		fx.removeEventListener('transitionend', onDone);
		// Remove overlay and lock in final base
		fx.style.removeProperty('--from');
		fx.style.removeProperty('--to');
		fx.style.removeProperty('--mix');
		_setBase(cell, nextTag === 'warn' || nextTag === 'both', nextTag === 'invalid' || nextTag === 'both');
	};
	fx.addEventListener('transitionend', onDone);

	// Kick the transition
	requestAnimationFrame(() => {
		fx.style.setProperty('--mix', '100%');
	});
}

/* Fallback (if cross-fade unsupported): simple overlay opacity crossfade between two layers */
function _xfadeFallback(cell, prevTag, nextTag){
	// previous layer
	const prev = document.createElement('div');
	prev.className = 'cell-fx';
	prev.style.backgroundImage = getComputedStyle(document.documentElement).getPropertyValue(_imgVar(prevTag).slice(4,-1).trim());
	prev.style.setProperty('--mix', '100%'); // static
	// next layer
	const next = document.createElement('div');
	next.className = 'cell-fx';
	next.style.backgroundImage = getComputedStyle(document.documentElement).getPropertyValue(_imgVar(nextTag).slice(4,-1).trim());
	next.style.opacity = '0';

	// mount both
	cell.appendChild(prev);
	cell.appendChild(next);

	// clear base
	_setBase(cell, false, false);

	// animate next in, prev out
	let left = 2;
	const done = () => { if(--left === 0){ prev.remove(); next.remove(); _setBase(cell, nextTag==='warn'||nextTag==='both', nextTag==='invalid'||nextTag==='both'); } };
	next.addEventListener('transitionend', done, { once:true });
	prev.addEventListener('transitionend', done, { once:true });

	requestAnimationFrame(() => {
		next.style.opacity = '1';
		prev.style.opacity = '0';
	});
}

// ensure a single child effect layer (created on demand)
function _ensureFx(cell){
	let fx = cell.querySelector(':scope > .cell-fx');
	if(!fx){
		fx = document.createElement('div');
		fx.className = 'cell-fx';
		cell.appendChild(fx);
	}
	return fx;
}

function _imgVar(tag){
	if(tag === 'warn') return 'var(--img-warn)';
	if(tag === 'invalid') return 'var(--img-invalid)';
	if(tag === 'both') return 'var(--img-both)';
	return 'var(--img-none)';
}


// Map boolean state -> overlay class
function _stateClass(warn, invalid){
	if(warn && invalid) return 'both';
	if(warn) return 'warn';
	if(invalid) return 'invalid';
	return 'none';
}

// Ensure overlay element (ephemeral per animation)
function _makeFx(cell, kind){ // kind: 'fx-tint warn' | 'fx-tint invalid' | 'fx-lines both|warnonly|invalidonly'
	// remove any stale layers from previous animations
	cell.querySelectorAll(':scope > .fx-tint, :scope > .fx-lines').forEach(n=>n.remove());
	if(!kind) return null;
	const el=document.createElement('div');
	el.className=kind;
	cell.appendChild(el);
	return el;
}

// fade the lines ON (to reach “both”) while keeping the current solid tint visible
function _linesIn(cell, onDone){
	const fx=_ensureFx(cell, 'fx-lines both');
	fx.classList.add('fx-in');
	fx.addEventListener('animationend', () => { fx.remove(); if(onDone) onDone(); }, { once:true });
}

// fade the lines OFF (leaving a solid tint visible underneath)
function _linesOut(cell, onDone){
	const fx=_ensureFx(cell, 'fx-lines both');
	// start visible to represent current “both” lines
	fx.style.opacity='1';
	fx.classList.add('fx-out');
	fx.addEventListener('animationend', () => { fx.remove(); if(onDone) onDone(); }, { once:true });
}

// optional: only when transitioning to/from NONE (so solid tint itself fades)
function _tintIn(cell, kind, onDone){
	const fx=_ensureFx(cell, 'fx-tint '+kind);
	fx.classList.add('fx-in');
	fx.addEventListener('animationend', () => { fx.remove(); if(onDone) onDone(); }, { once:true });
}
function _tintOut(cell, kind, onDone){
	const fx=_ensureFx(cell, 'fx-tint '+kind);
	fx.style.opacity='1';
	fx.classList.add('fx-out');
	fx.addEventListener('animationend', () => { fx.remove(); if(onDone) onDone(); }, { once:true });
}

// apply base bg classes (your CSS owns the final look)
function _setBase(cell, warn, invalid){
	cell.classList.toggle('warn', !!warn);
	cell.classList.toggle('invalid', !!invalid);
}

// Transitions WITHOUT double-tint and WITHOUT opposite-angle overlays
function _transitionCell(cell, prevWarn, prevInvalid, nextWarn, nextInvalid){
	const prev=_stateTag(prevWarn, prevInvalid);
	const next=_stateTag(nextWarn, nextInvalid);
	if(prev===next){ _setBase(cell, nextWarn, nextInvalid); return; }

	// none -> warn/invalid : fade the tint in, then lock base
	if(prev==='none' && (next==='warn' || next==='invalid')){
		const fx=_makeFx(cell, 'fx-tint ' + next);
		fx.classList.add('fx-in');
		fx.addEventListener('animationend', ()=>{
			fx.remove();
			_setBase(cell, next==='warn', next==='invalid');
		}, {once:true});
		return;
	}

	// warn/invalid -> none : fade the current tint out
	if((prev==='warn' || prev==='invalid') && next==='none'){
		const fx=_makeFx(cell, 'fx-tint ' + prev);
		fx.style.opacity='1';
		fx.classList.add('fx-out');
		_setBase(cell, false, false);
		fx.addEventListener('animationend', ()=>fx.remove(), {once:true});
		return;
	}

	// none -> both : fade the final stripes in, then set base to both
	if(prev==='none' && next==='both'){
		const fx=_makeFx(cell, 'fx-lines both');
		fx.classList.add('fx-in');
		fx.addEventListener('animationend', ()=>{
			fx.remove();
			_setBase(cell, true, true);
		}, {once:true});
		return;
	}

	// warn -> both : keep WARN solid; fade IN INVALID stripes only; then lock base to both
	if(prev==='warn' && next==='both'){
		const fx=_makeFx(cell, 'fx-lines invalidonly');
		fx.classList.add('fx-in');
		fx.addEventListener('animationend', ()=>{
			fx.remove();
			_setBase(cell, true, true);
		}, {once:true});
		return;
	}
	// invalid -> both : keep INVALID solid; fade IN WARN stripes only; then lock base to both
	if(prev==='invalid' && next==='both'){
		const fx=_makeFx(cell, 'fx-lines warnonly');
		fx.classList.add('fx-in');
		fx.addEventListener('animationend', ()=>{
			fx.remove();
			_setBase(cell, true, true);
		}, {once:true});
		return;
	}

	// both -> warn : switch base to WARN solid; fade OUT INVALID stripes only
	if(prev==='both' && next==='warn'){
		_setBase(cell, true, false);
		const fx=_makeFx(cell, 'fx-lines invalidonly');
		fx.style.opacity='1';
		fx.classList.add('fx-out');
		fx.addEventListener('animationend', ()=>fx.remove(), {once:true});
		return;
	}
	// both -> invalid : switch base to INVALID solid; fade OUT WARN stripes only
	if(prev==='both' && next==='invalid'){
		_setBase(cell, false, true);
		const fx=_makeFx(cell, 'fx-lines warnonly');
		fx.style.opacity='1';
		fx.classList.add('fx-out');
		fx.addEventListener('animationend', ()=>fx.remove(), {once:true});
		return;
	}

	// warn <-> invalid : pass through a brief “both” using only the NEW color stripes
	if(prev==='warn' && next==='invalid'){
		// show INVALID stripes over WARN, then swap base to INVALID and fade OUT WARN stripes
		const fxIn=_makeFx(cell, 'fx-lines invalidonly');
		fxIn.classList.add('fx-in');
		fxIn.addEventListener('animationend', ()=>{
			fxIn.remove();
			_setBase(cell, false, true);
			const fxOut=_makeFx(cell, 'fx-lines warnonly');
			fxOut.style.opacity='1';
			fxOut.classList.add('fx-out');
			fxOut.addEventListener('animationend', ()=>fxOut.remove(), {once:true});
		}, {once:true});
		return;
	}
	if(prev==='invalid' && next==='warn'){
		const fxIn=_makeFx(cell, 'fx-lines warnonly');
		fxIn.classList.add('fx-in');
		fxIn.addEventListener('animationend', ()=>{
			fxIn.remove();
			_setBase(cell, true, false);
			const fxOut=_makeFx(cell, 'fx-lines invalidonly');
			fxOut.style.opacity='1';
			fxOut.classList.add('fx-out');
			fxOut.addEventListener('animationend', ()=>fxOut.remove(), {once:true});
		}, {once:true});
		return;
	}

	// Fallback
	_setBase(cell, nextWarn, nextInvalid);
}



function getCellFx(cell){
	let fx=cell.querySelector(':scope > .cell-fx');
	if(!fx){
		fx=document.createElement('div');
		fx.className='cell-fx';
		cell.appendChild(fx);
	}
	return fx;
}
function playFadeIn(cell, tintClass, onDone){
	const fx=getCellFx(cell);
	fx.className='cell-fx ' + tintClass + ' fx-in';
	fx.addEventListener('animationend', function h(){
		fx.removeEventListener('animationend', h);
		fx.className='cell-fx';	// clear
		if(onDone) onDone();
	});
}
function playFadeOut(cell, tintClass, onDone){
	const fx=getCellFx(cell);
	fx.className='cell-fx ' + tintClass + ' fx-out';
	fx.addEventListener('animationend', function h(){
		fx.removeEventListener('animationend', h);
		fx.className='cell-fx';	// clear
		if(onDone) onDone();
	});
}

function closeAnyPicker(){
	document.querySelectorAll('.picker-overlay').forEach(el=>el.remove());
	document.querySelectorAll('.cell.picker-target').forEach(el=>{
		el.classList.remove('picker-target');
		el.removeAttribute('data-picker-open');
	});
	_pickerOpenCell=null;
	document.removeEventListener('keydown', _onPickerKeydown, true);
}

function _onPickerKeydown(e){
	if(e.key==='Escape') closeAnyPicker();
}

function killPillTooltip(el){
	if(!el) return;
	const tip=bootstrap.Tooltip.getInstance(el);
	if(tip){
		try{ tip.hide(); }catch(_){}
		tip.dispose();
	}
	el.removeAttribute('data-bs-toggle');
	el.removeAttribute('data-bs-title');
	el.removeAttribute('aria-describedby');
}

function sortPeopleForRender(arr){
	return arr.slice().sort((a,b)=>{
		const sa=(typeof a.sort==='number')?a.sort:9999;
		const sb=(typeof b.sort==='number')?b.sort:9999;
		return (sa-sb)||a.name.localeCompare(b.name);
	});
}

function disposeCellTooltip(cell){
	const tip=bootstrap.Tooltip.getInstance(cell);
	if(tip){ try{tip.hide();}catch(_){}
		tip.dispose();
	}
	cell.removeAttribute('data-bs-toggle');
	cell.removeAttribute('data-bs-title');
	cell.removeAttribute('title');
	cell.removeAttribute('data-bs-original-title');
}


function movePersonToGroupAtIndex(personId, srcGroupId, tgtGroupId, insertIndex){
	const p=DB.persons.find(x=>x.id===personId);
	if(!p) return;

	// source group: remove and reindex
	const src=sortPeopleForRender(DB.persons.filter(x=>x.factoryId===currentFactoryId && x.groupId===srcGroupId));
	const srcIdx=src.findIndex(x=>x.id===personId);
	if(srcIdx>=0) src.splice(srcIdx,1);
	src.forEach((x,i)=>{ x.sort=i+1; });

	// target group: insert at exact index and reindex
	const tgt=sortPeopleForRender(DB.persons.filter(x=>x.factoryId===currentFactoryId && x.groupId===tgtGroupId));
	if(insertIndex<0) insertIndex=0;
	if(insertIndex>tgt.length) insertIndex=tgt.length;

	p.groupId=tgtGroupId;
	tgt.splice(insertIndex,0,p);
	tgt.forEach((x,i)=>{ x.sort=i+1; });

	// UI refresh
	renderPersonGroups();
	rebuildAll();

	// Toast
	const srcName=DB.groups.find(g=>g.id===srcGroupId)?.title||String(srcGroupId);
	const tgtName=DB.groups.find(g=>g.id===tgtGroupId)?.title||String(tgtGroupId);
	if(typeof showToast==='function'){
		showToast('info','Flyttad', `<b>${p.name}</b> flyttades från grupp <b>${srcName}</b> till grupp <b>${tgtName}</b>`);
	}
}



function getAvoidConsecutiveSetting(){
	const el=document.getElementById('avoidConsecutive');
	if(el) return !!el.checked;
	const saved=localStorage.getItem('planning.avoidConsecutive');
	return (saved===null)?true:(saved==='1'||saved==='true');
}

function _appendCellTooltip(cell, msg){
	const list = cell.dataset.warnList ? JSON.parse(cell.dataset.warnList) : [];
	if(!list.includes(msg)) list.push(msg);
	cell.dataset.warnList = JSON.stringify(list);

	const content = list.join('\n'); // line breaks; CSS makes them visible
	cell.setAttribute('data-bs-toggle', 'tooltip');
	cell.setAttribute('data-bs-title', content);

	const tip = bootstrap.Tooltip.getOrCreateInstance(cell, {
		container: 'body',
		boundary: 'viewport'
	});
	tip.setContent({ '.tooltip-inner': content });
}


// mirror "operational" everywhere (DB + all UIs)
function setStationOperational(stationId, on){
	const s=DB.stations.find(x=>x.id===stationId&&x.factoryId===currentFactoryId);
	if(!s) return;
	s.operational=!!on;

	// reflect in any checkbox that represents this station (randomizer or settings)
	document.querySelectorAll(`[data-role="station-op"][data-station-id="${escapeDataId(stationId)}"]`)
		.forEach(el=>{ el.checked=!!on; el.indeterminate=false; });

	// update tri-state header in randomizer if open
	if(s.groupId){
		const box=document.querySelector(`.rand-station-group[data-gid="${escapeDataId(s.groupId)}"]`);
		if(box){
			const gChk=box.querySelector(`#${CSS.escape(`rsg${s.groupId}`)}`);
			const child=[...box.querySelectorAll('.form-check-input[data-kind="station"]')];
			const total=child.length;
			const onCount=child.filter(c=>c.checked).length;
			gChk.indeterminate=onCount>0&&onCount<total;
			gChk.checked=onCount===total;
		}
	}
}

// one listener for both places
document.addEventListener('change',e=>{
	const t=e.target;
	if(t.matches('[data-role="station-op"]')){
		const id=parseEntityId(t.dataset.stationId);
		setStationOperational(id, t.checked);
	}
});

// NEW: place exactly one person into a single cell (or none). Returns personId or null.
function placeOneRandom(station, slot, opts={}){
	const dateStr=getSelectedDateStr();
	const avoidConsecutive = (opts.avoidConsecutive!==false);
	const candidateGroups = opts.candidateGroupIds || null;
	const takenThisSlot = opts.takenThisSlot || new Set();

	// base pool: present, in selected groups, trained/allowed for this station+slot
	let candidates = getPlanningPersons(currentFactoryId).filter(p =>
		p.factoryId===currentFactoryId &&
		p.present &&
		(!candidateGroups || candidateGroups.has(p.groupId)) &&
		isPersonAllowedFor(p, station, slot)
	);

	// exclude already assigned somewhere in this slot
	candidates = candidates.filter(p => !takenThisSlot.has(p.id));

	// optional: avoid consecutive on same station
	if(avoidConsecutive){
		const workSlots = DB.timeSlots
			.filter(ts => ts.factoryId===currentFactoryId && ts.dayType===currentDayType && ts.type==='Work')
			.sort((a, b)=>a.sort-b.sort);
		const idx = workSlots.findIndex(x => x.id===slot.id);
		const prevSlot = idx>0 ? workSlots[idx-1] : null;
		if(prevSlot){
			const prevAss = DB.assignments
				.filter(a => a.date===dateStr && a.dayType===currentDayType && a.stationId===station.id && a.timeSlotId===prevSlot.id)
				.map(a => a.personId);
			if(prevAss.length) candidates = candidates.filter(c => !prevAss.includes(c.id));
		}
	}

	// avoid incompatible pairs inside this cell
	const existingHere = DB.assignments
		.filter(a => a.date===dateStr && a.dayType===currentDayType && a.stationId===station.id && a.timeSlotId===slot.id)
		.map(a => a.personId);
	candidates = candidates.filter(c => !existingHere.some(e => isIncompatible(e, c.id)));

	if(!candidates.length) return null;

	shuffle(candidates);
	const chosen = candidates[0];

	// place
	const cell = findCell(station.id, slot.id);
	placePerson(cell, station, slot, chosen.id);
	return chosen.id;
}

// NEW: round-robin fill over stations for one slot
function roundRobinFill(stations, slot, opts = {}){
	const dateStr = getSelectedDateStr();

	const takenThisSlot = new Set(
		DB.assignments
			.filter(a => a.date===dateStr && a.dayType===currentDayType && a.timeSlotId===slot.id)
			.map(a => a.personId)
	);

	const remaining = new Map();
	stations.forEach(s => {
		const cap = s.defaultCapacity || 1;
		const have = DB.assignments
			.filter(a => a.date===dateStr && a.dayType===currentDayType && a.stationId===s.id && a.timeSlotId===slot.id)
			.length;
		const rem = Math.max(0, cap - have);
		if(rem > 0) remaining.set(s.id, rem);
	});
	if(!remaining.size) return;

	let allCandidates = getPlanningPersons(currentFactoryId).filter(p =>
		p.factoryId===currentFactoryId &&
		p.present &&
		(!opts.candidateGroupIds || opts.candidateGroupIds.has(p.groupId))
	);
	shuffle(allCandidates);

	const specialists = [];
	const generalists = [];
	for(const p of allCandidates){
		const elig = eligibleStationsFor(p, stations, slot, opts, takenThisSlot, remaining);
		if(elig.length === 1){
			specialists.push({ p, s: elig[0] });
		}else if(elig.length > 1){
			generalists.push(p);
		}
	}

	// 1) place specialists first
	for(const {p, s} of specialists){
		if(!canPlace(p, s, slot, opts, takenThisSlot, remaining)) continue;
		const cell = findCell(s.id, slot.id);
		placePerson(cell, s, slot, p.id);
		remaining.set(s.id, (remaining.get(s.id) || 0) - 1);
		takenThisSlot.add(p.id);
	}

	// 2) round-robin generalists
	let progressed = true;
	while(progressed){
		progressed = false;
		for(const s of stations){
			const rem = remaining.get(s.id) || 0;
			if(rem <= 0) continue;

			const candidates = generalists.filter(p => canPlace(p, s, slot, opts, takenThisSlot, remaining));
			if(!candidates.length) continue;
			shuffle(candidates);
			const chosen = candidates[0];

			const cell = findCell(s.id, slot.id);
			placePerson(cell, s, slot, chosen.id);
			remaining.set(s.id, rem - 1);
			takenThisSlot.add(chosen.id);
			progressed = true;
		}
	}
}




// Can this person be placed in this station for this slot, given current state?
function canPlace(person, station, slot, opts = {}, takenThisSlot, remaining){
	const dateStr = getSelectedDateStr();
	if(takenThisSlot.has(person.id)) return false;
	if((remaining.get(station.id) || 0) <= 0) return false;
	if(!isPersonAllowedFor(person, station, slot)) return false;

	if(opts.avoidConsecutive !== false){
		const workSlots = DB.timeSlots
			.filter(ts => ts.factoryId===currentFactoryId && ts.dayType===currentDayType && ts.type==='Work')
			.sort((a, b) => a.sort - b.sort);
		const idx = workSlots.findIndex(x => x.id === slot.id);
		const prev = idx > 0 ? workSlots[idx-1] : null;
		if(prev){
			const prevAss = DB.assignments
				.filter(a => a.date===dateStr && a.dayType===currentDayType && a.stationId===station.id && a.timeSlotId===prev.id)
				.map(a => a.personId);
			if(prevAss.includes(person.id)) return false;
		}
	}

	const existingHere = DB.assignments
		.filter(a => a.date===dateStr && a.dayType===currentDayType && a.stationId===station.id && a.timeSlotId===slot.id)
		.map(a => a.personId);
	if(existingHere.some(e => isIncompatible(e, person.id))) return false;

	return true;
}

// Which of these stations are valid for this person right now?
function eligibleStationsFor(person, stations, slot, opts = {}, takenThisSlot, remaining){
	const out = [];
	for(const s of stations){
		if(canPlace(person, s, slot, opts, takenThisSlot, remaining)) out.push(s);
	}
	return out;
}




buildDefaultSlots();
function buildDefaultSlots(){const defs=[];const add=(factoryId,dayType,arr)=>{arr.forEach((s,i)=>defs.push({id:`${factoryId}-${dayType}-${i+1}`,factoryId,dayType,start:s[0],end:s[1],type:s[2],sort:i+1}));};const work='Work',br='Break';const dayMonFri=[["06:55","07:55",work],["07:55","08:55",work],["08:55","09:15",br],["09:15","10:30",work],["10:30","11:35",work],["11:35","12:10",br],["12:10","13:45",work],["13:45","14:00",br],["14:00","14:57",work]];const eveMonThu=[["14:52","16:00",work],["16:00","17:10",work],["17:10","17:45",br],["17:45","19:00",work],["19:00","20:30",work],["20:30","20:55",br],["20:55","22:30",work],["22:30","22:45",br],["22:45","00:31",work]];const eveFri=[["14:52","16:00",work],["16:00","17:00",work],["17:00","17:25",br],["17:25","18:00",work],["18:00","19:00",work]];const overtime=[["07:00","08:00",work],["08:00","09:00",work],["09:00","09:25",br],["09:25","11:30",work],["11:30","12:05",br],["12:05","13:45",work],["13:45","14:00",br],["14:00","15:00",work]];const night=[["00:31","01:00",work],["01:00","01:35",br],["01:35","03:00",work],["03:00","03:25",br],["03:25","05:00",work],["05:00","05:15",br],["05:15","07:00",work]];for(const f of DB.factories.map(f=>f.id)){add(f,DayType.Day,dayMonFri);add(f,DayType.EveningMonThu,eveMonThu);add(f,DayType.EveningFri,eveFri);add(f,DayType.OvertimeDay,overtime);add(f,DayType.Night,night);}DB.timeSlots=defs;}

(function init(){
	const qs=new URLSearchParams(location.search);
	mode=qs.get('mode')==='edit'?'edit':'viewer';
	currentFactoryId=parseFactoryId(qs.get('factory')||'1');
	applyViewerEditSetting(getViewerEditSetting(),{persist:false});
	applyCoordAutoLogoutSetting(getCoordAutoLogoutMinutes(),{persist:false});
	applyMode(mode,{updateUrl:false});
	if(mode==='edit'){
		showCoordLogin({
			onSuccess:()=>{
				applyMode('edit');
				renderSettings();
				rebuildAll();
			}
		});
	}

	const facSel=document.getElementById('factorySel');
	const settingsFacSel=document.getElementById('settingsFactorySel');
	const shiftSel=document.getElementById('shiftSel');
	const settingsShiftSel=document.getElementById('settingsShiftSel');

	initShiftData();
	setShift(qs.get('shift')||'evening',{updateUrl:false});

	function populateFactoryButtons(group){
		if(!group) return;
		group.innerHTML='';
		DB.factories.forEach(f=>{
			const btn=document.createElement('button');
			btn.type='button';
			btn.className='btn btn-outline-secondary';
			btn.dataset.value=String(f.id);
			btn.textContent=f.title;
			group.appendChild(btn);
		});
	}

	function populateFactorySelect(sel){
		if(!sel) return;
		sel.innerHTML='';
		DB.factories.forEach(f=>{
			const opt=document.createElement('option');
			opt.value=f.id;
			opt.textContent=f.title;
			sel.appendChild(opt);
		});
	}
	populateFactoryButtons(facSel);
	populateFactorySelect(settingsFacSel);

	function setButtonGroupValue(group, value){
		if(!group) return;
		group.querySelectorAll('[data-value]').forEach(btn=>{
			const active=btn.dataset.value===String(value);
			btn.classList.toggle('active', active);
			btn.setAttribute('aria-pressed', active ? 'true' : 'false');
		});
	}

	function syncShiftSelectors(){
		syncShiftUi();
	}

	function applyFactoryChange(v,{rerenderSettings=false,updateUrl=true}={}){
		currentFactoryId=parseFactoryId(v);
		const value=String(currentFactoryId);
		setButtonGroupValue(facSel, value);
		if(settingsFacSel) settingsFacSel.value=value;

		if(updateUrl){
			const nextQs = new URLSearchParams(window.location.search);
			nextQs.set('factory', value);
			nextQs.set('shift', currentShift);
			const nextUrl = `${window.location.pathname}?${nextQs.toString()}${window.location.hash || ''}`;
			window.history.replaceState(null, '', nextUrl);
		}

		if(rerenderSettings) renderSettings();
		rebuildAll();
	}

	function applyShiftChange(v,{rerenderSettings=false,updateUrl=true}={}){
		setShift(v,{updateUrl});
		syncShiftSelectors();
		suggestAndApplyTemplates();
		if(rerenderSettings) renderSettings();
		rebuildAll();
	}

	if(facSel){
		setButtonGroupValue(facSel, currentFactoryId);
		facSel.addEventListener('click',e=>{
			const btn=e.target.closest('[data-value]');
			if(!btn || !facSel.contains(btn)) return;
			applyFactoryChange(btn.dataset.value,{rerenderSettings:true});
		});
	}
	if(settingsFacSel){
		settingsFacSel.value=String(currentFactoryId);
		settingsFacSel.addEventListener('change',()=>applyFactoryChange(settingsFacSel.value,{rerenderSettings:true}));
	}

	syncShiftSelectors();
	if(shiftSel){
		shiftSel.addEventListener('click',e=>{
			const btn=e.target.closest('[data-value]');
			if(!btn || !shiftSel.contains(btn)) return;
			applyShiftChange(btn.dataset.value,{rerenderSettings:true});
		});
	}
	if(settingsShiftSel){
		settingsShiftSel.addEventListener('change',()=>applyShiftChange(settingsShiftSel.value,{rerenderSettings:true}));
	}

	const todayStr=(new Date()).toISOString().slice(0,10);
	document.getElementById('dateInput').value=todayStr;
	currentDate=new Date(todayStr+'T00:00:00');
	document.getElementById('dateInput').addEventListener('change',e=>{currentDate=new Date(e.target.value+'T00:00:00');syncDayChoiceFromDate();syncViewerShiftIfNeeded();toggleDayButtons();suggestAndApplyTemplates();rebuildAll();});
	document.getElementById('btnToday').addEventListener('click',()=>{dayChoice='today';setDateToOffset(0);syncViewerShiftIfNeeded();toggleDayButtons();suggestAndApplyTemplates();rebuildAll();});
	document.getElementById('btnTomorrow').addEventListener('click',()=>{dayChoice='tomorrow';setDateToOffset(1);toggleDayButtons();suggestAndApplyTemplates();rebuildAll();});
	const templateSel=document.getElementById('templateSel');
	templateSel.classList.add('d-none');
	templateSel.addEventListener('change',e=>{currentDayType=e.target.value;rebuildAll();});
	document.getElementById('randomizeBtn').addEventListener('click',openRandomizer);
	document.getElementById('runRandomizeBtn').addEventListener('click',runRandomizer);
	document.getElementById('saveBtn').addEventListener('click',saveAll);
	applyInactivityResetSetting(getInactivityResetMinutes(),{persist:false});
	applyViewerShiftLeadSetting(getViewerShiftLeadMinutes(),{persist:false});
	renderSettings();
	document.getElementById('idleResetMinutes')?.addEventListener('change',e=>applyInactivityResetSetting(e.target.value));
	document.getElementById('viewerShiftLeadMinutes')?.addEventListener('change',e=>applyViewerShiftLeadSetting(e.target.value));
	document.getElementById('viewerCanEditAssignments')?.addEventListener('change',e=>applyViewerEditSetting(e.target.checked));
	document.getElementById('coordAutoLogoutMinutes')?.addEventListener('change',e=>applyCoordAutoLogoutSetting(e.target.value));
	const modeBadge=document.getElementById('modeBadge');
	modeBadge?.addEventListener('click',()=>{
		dismissNativeTitleTooltip(modeBadge);
		modeBadge.blur();
		if(mode==='edit'){
			logoutCoordinator({reason:'Du har loggat ut från koordinatorläget.'});
			return;
		}
		showCoordLogin({
			onSuccess:()=>{
				applyMode('edit');
				showToast('info','Koordinatorläge aktivt','Du är nu inloggad som koordinator.');
				renderSettings();
				rebuildAll();
			}
		});
	});
	modeBadge?.addEventListener('keydown',e=>{
		if(e.key==='Enter' || e.key===' '){
			e.preventDefault();
			modeBadge.click();
		}
	});
	setupSummaryInfoPopover();
	syncDayChoiceFromDate();
	toggleDayButtons();
	suggestAndApplyTemplates();
	updateHeaderContext();
	rebuildAll();
	window.addEventListener('resize',fitToViewport);
	document.addEventListener('mousedown',ev=>{const ov=document.querySelector('.picker-overlay');if(ov&&!ov.contains(ev.target))closeAnyPicker();});
})();

(function initTheme(){const saved=localStorage.getItem('planning.theme');if(saved){document.documentElement.setAttribute('data-bs-theme',saved);}document.getElementById('themeBtn').addEventListener('click',()=>{const cur=document.documentElement.getAttribute('data-bs-theme')||'auto';const nxt=cur==='light'?'dark':'light';document.documentElement.setAttribute('data-bs-theme',nxt);localStorage.setItem('planning.theme',nxt);rebuildAll();});})();

function setDateToOffset(days){const base=new Date();base.setDate(base.getDate()+days);const s=base.toISOString().slice(0,10);document.getElementById('dateInput').value=s;currentDate=new Date(s+'T00:00:00');}
function syncDayChoiceFromDate(){const start=(d)=>new Date(d.getFullYear(),d.getMonth(),d.getDate());const today=start(new Date());const sel=start(currentDate);const diff=Math.round((sel-today)/86400000);dayChoice=(diff===0)?'today':((diff===1)?'tomorrow':'custom');}
function toggleDayButtons(){document.getElementById('btnToday').classList.toggle('active',dayChoice==='today');document.getElementById('btnTomorrow').classList.toggle('active',dayChoice==='tomorrow');}
function suggestTemplatesFor(date){const wd=date.getDay();const isFri=wd===5;const isWeekend=wd===0||wd===6;const isWeekday=wd>=1&&wd<=5;return{day:isWeekday?DayType.Day:DayType.OvertimeDay,evening:isWeekend?DayType.OvertimeDay:(isFri?DayType.EveningFri:DayType.EveningMonThu),night:DayType.Night};}
function suggestAndApplyTemplates(){const sug=suggestTemplatesFor(currentDate);if(currentShift==='day'){fillTemplateOptions([sug.day]);currentDayType=sug.day;document.getElementById('templateSel').value=currentDayType;updateHeaderContext();return;}if(currentShift==='night'){fillTemplateOptions([DayType.Night]);currentDayType=DayType.Night;document.getElementById('templateSel').value=currentDayType;updateHeaderContext();return;}fillTemplateOptions([sug.evening]);currentDayType=sug.evening;document.getElementById('templateSel').value=currentDayType;updateHeaderContext();}
function fillTemplateOptions(dayTypes){const sel=document.getElementById('templateSel');sel.innerHTML='';dayTypes.forEach(dt=>{const opt=document.createElement('option');opt.value=dt;opt.textContent=labelFor(dt);sel.appendChild(opt);});}
function labelFor(dt){switch(dt){case DayType.Day:return'Dag mån–fre';case DayType.EveningMonThu:return'Kväll mån–tors';case DayType.EveningFri:return'Kväll fredag';case DayType.OvertimeDay:return'Overtime (lör/sön)';case DayType.Night:return'Natt';default:return dt;}}
function formatDate(d){return d.toISOString().slice(0,10);} 

function getNormalizedGroupOrder(factoryId){
	const groupIds = DB.groups.filter(g=>g.factoryId===factoryId).map(g=>g.id);
	const groupIdSet = new Set(groupIds);
	const hasResursStation = DB.stations.some(s=>s.factoryId===factoryId && s.isResurs);
	const rawOrder = Array.isArray(DB.groupDisplayOrder[factoryId]) ? DB.groupDisplayOrder[factoryId] : [];

	const order = [];
	const seen = new Set();
	for(const tok of rawOrder){
		if(tok === 'resurs'){
			if(hasResursStation && !seen.has('resurs')){
				order.push('resurs');
				seen.add('resurs');
			}
			continue;
		}
		if(groupIdSet.has(tok) && !seen.has(tok)){
			order.push(tok);
			seen.add(tok);
		}
	}

	for(const id of groupIds){
		if(!seen.has(id)){
			order.push(id);
			seen.add(id);
		}
	}

	if(hasResursStation && !seen.has('resurs')) order.push('resurs');
	DB.groupDisplayOrder[factoryId] = order;
	return order;
}

function orderedColumns(){const order=getNormalizedGroupOrder(currentFactoryId);const resurs=DB.stations.find(s=>s.factoryId===currentFactoryId&&s.isResurs);const grouped=groupBy(DB.stations.filter(s=>s.factoryId===currentFactoryId&&!s.isResurs),'groupId');return {order,resurs,grouped};}

function rebuildAll(){
	buildGrid();
	setupTooltips();
	fitToViewport();
	renderSummaryPanel();
	window.addEventListener('resize', fitToViewport);
}

function clearSummaryHighlights(){
	document.querySelectorAll('.cell.summary-highlight').forEach(c=>c.classList.remove('summary-highlight'));
}

function hideSummaryInfoPopover(){
	if(summaryInfoHideTimerId){
		clearTimeout(summaryInfoHideTimerId);
		summaryInfoHideTimerId=null;
	}
	if(!summaryInfoPopover) return;
	summaryInfoPopover.hide();
}

function scheduleSummaryInfoHide(delay=120){
	if(summaryInfoHideTimerId){
		clearTimeout(summaryInfoHideTimerId);
		summaryInfoHideTimerId=null;
	}
	summaryInfoHideTimerId=window.setTimeout(()=>{
		summaryInfoHideTimerId=null;
		summaryInfoPopover?.hide();
	}, delay);
}

function bindSummaryPopoverHoverHandlers(){
	const pop=document.querySelector('.popover');
	if(!pop || pop.dataset.summaryHoverBound==='1') return;
	pop.dataset.summaryHoverBound='1';
	pop.addEventListener('mouseenter',()=>{
		if(summaryInfoHideTimerId){
			clearTimeout(summaryInfoHideTimerId);
			summaryInfoHideTimerId=null;
		}
	});
	pop.addEventListener('mouseleave',()=>scheduleSummaryInfoHide(80));
}

function setupSummaryInfoPopover(){
	if(summaryInfoBound) return;
	const btn=document.getElementById('summaryInfoBtn');
	if(!btn || !window.bootstrap?.Popover) return;
	const content=[
		'<div class="small">',
		'<div><strong>Alla:</strong> unika celler med minst en varning.</div>',
		'<div><strong>Kapacitet:</strong> celler där tilldelade ≠ kapacitet.</div>',
		'<div><strong>Utbildning:</strong> celler med tilldelad person utan utbildning.</div>',
		'<div><strong>Kompatibilitet:</strong> byt plats på en av dessa personer.</div>',
		'</div>'
	].join('');
	summaryInfoPopover=bootstrap.Popover.getOrCreateInstance(btn,{
		trigger:'manual',
		container:'body',
		html:true,
		placement:'bottom',
		content
	});
	btn.addEventListener('mouseenter',()=>{
		if(summaryInfoHideTimerId){
			clearTimeout(summaryInfoHideTimerId);
			summaryInfoHideTimerId=null;
		}
		summaryInfoPopover?.show();
		bindSummaryPopoverHoverHandlers();
	});
	btn.addEventListener('mouseleave',()=>scheduleSummaryInfoHide(120));
	summaryInfoBound=true;
}

function computeSummaryMetrics(){
	const dateStr=getSelectedDateStr();
	const slots=DB.timeSlots
		.filter(ts=>ts.factoryId===currentFactoryId&&ts.dayType===currentDayType)
		.sort((a,b)=>a.sort-b.sort);
	const stationById=new Map(DB.stations.filter(s=>s.factoryId===currentFactoryId).map(s=>[String(s.id),s]));
	const rows=DB.assignments.filter(a=>a.date===dateStr&&a.factoryId===currentFactoryId&&a.dayType===currentDayType);
	const byCell=new Map();
	rows.forEach(a=>{
		const key=`${a.stationId}:${a.timeSlotId}`;
		const arr=byCell.get(key)||[];
		arr.push(a.personId);
		byCell.set(key,arr);
	});
	const details=[];
	let totals={required:0,assigned:0,capacityCells:0,trainingCells:0,compatibilityCells:0,affectedCells:0};
	for(const slot of slots){
		for(const station of stationById.values()){
			const required=slot.type==='Work' ? (station.defaultCapacity||1) : 0;
			const people=(byCell.get(`${station.id}:${slot.id}`)||[]);
			const assigned=people.length;
			const untrainedAssigned=people.filter(pid=>!isPersonTrainedForStation(pid, station.id)).length;
			let conflicts=0;
			for(let i=0;i<people.length;i++){
				for(let j=i+1;j<people.length;j++){
					if(isIncompatible(people[i], people[j])) conflicts++;
				}
			}
			const capacityIssue=assigned!==required;
			const trainingIssue=assigned>0 && untrainedAssigned>0;
			const compatibilityIssue=conflicts>0;
			const hasIssue=capacityIssue||trainingIssue||compatibilityIssue;
			const row={slotId:String(slot.id),slotLabel:`${slot.start}–${slot.end}`,stationId:String(station.id),stationTitle:station.title,required,assigned,untrainedAssigned,compatibilityConflicts:conflicts,capacityIssue,trainingIssue,compatibilityIssue,hasIssue};
			details.push(row);
			if(!hasIssue) continue;
			totals.affectedCells++;
			if(capacityIssue) totals.capacityCells++;
			if(trainingIssue) totals.trainingCells++;
			if(compatibilityIssue) totals.compatibilityCells++;
		}
	}
	totals.required=details.reduce((s,x)=>s+x.required,0);
	totals.assigned=details.reduce((s,x)=>s+x.assigned,0);
	return {details,totals};
}

function getSummaryMatches(metric){
	if(!summaryData) return [];
	return summaryData.details.filter(r=>{
		if(metric==='capacity') return r.capacityIssue;
		if(metric==='training') return r.trainingIssue;
		if(metric==='compatibility') return r.compatibilityIssue;
		return r.hasIssue;
	});
}

function applySummaryFilter(metric='all'){
	activeSummaryFilter=metric;
	clearSummaryHighlights();
	const rows=getSummaryMatches(metric);
	rows.forEach(r=>{
		const cell=findCell(parseEntityId(r.stationId), r.slotId);
		if(cell) cell.classList.add('summary-highlight');
	});
	document.querySelectorAll('#summaryFilterBar .summary-filter-btn').forEach(btn=>{
		const active=btn.dataset.metric===metric;
		btn.classList.toggle('active', active);
	});
}

function renderSummaryPanel(){
	const warnBox=document.getElementById('summaryWarning');
	const warnText=document.getElementById('summaryWarningText');
	if(!warnBox) return;
	if(mode!=='edit'){
		warnBox.classList.add('d-none');
		clearSummaryHighlights();
		hideSummaryInfoPopover();
		return;
	}
	summaryData=computeSummaryMetrics();
	const filterBar=document.getElementById('summaryFilterBar');
	const totals=summaryData.totals;
	if(totals.affectedCells===0){
		warnBox.classList.add('d-none');
		clearSummaryHighlights();
		hideSummaryInfoPopover();
		return;
	}
	warnBox.classList.remove('d-none');
	if(warnText){
		const unit=totals.affectedCells===1?'varning':'varningar';
		warnText.textContent=`${totals.affectedCells} ${unit} i planeringen - Kapacitet ${totals.assigned}/${totals.required} tilldelade.`;
	}
	const btns=[{metric:'all',label:`Alla (${totals.affectedCells})`,cls:'btn-outline-secondary'}];
	if(totals.capacityCells>0) btns.push({metric:'capacity',label:`Kapacitet (${totals.capacityCells})`,cls:'btn-outline-danger'});
	if(totals.trainingCells>0) btns.push({metric:'training',label:`Utbildning (${totals.trainingCells})`,cls:'btn-outline-warning'});
	if(totals.compatibilityCells>0) btns.push({metric:'compatibility',label:`Kompatibilitet (${totals.compatibilityCells})`,cls:'btn-outline-info'});
	filterBar.innerHTML=btns.map(x=>`<button type="button" class="btn btn-sm ${x.cls} summary-filter-btn" data-metric="${x.metric}">${x.label}</button>`).join('');
	filterBar.querySelectorAll('.summary-filter-btn').forEach(btn=>{
		btn.addEventListener('click',()=>applySummaryFilter(btn.dataset.metric));
	});
	if(activeSummaryFilter!=='all' && !btns.some(b=>b.metric===activeSummaryFilter)) activeSummaryFilter='all';
	applySummaryFilter(activeSummaryFilter);
}

function buildGrid(){
	const scaler=document.getElementById('gridScaler');
	scaler.innerHTML='';
	document.getElementById('warnAlert').classList.add('d-none');
	const groups=DB.groups.filter(g=>g.factoryId===currentFactoryId);
	const {order,resurs,grouped}=orderedColumns();
	const slots=DB.timeSlots.filter(ts=>ts.factoryId===currentFactoryId&&ts.dayType===currentDayType).sort((a,b)=>a.sort-b.sort);
	let cols=['var(--time-col-w)'];
	order.forEach(tok=>{
		if(tok==='resurs'){
			if(resurs)cols.push('var(--grid-min-col)');
		}else{
			const sts=(grouped[tok]||[]).sort((a,b)=>a.sort-b.sort);
			for(const s of sts)cols.push('var(--grid-min-col)');
		}
	});
	const grid=document.createElement('div');
	grid.className='schedule-grid';
	grid.style.gridTemplateColumns=cols.join(' ');
	// 2 header rows + one row per slot. The LAST slot gets +var(--row-extra)
	const slotRows=slots.map((_,i)=>
		i===slots.length-1
			? 'minmax(0, calc(var(--row-h) + var(--row-extra)))'
			: 'minmax(0, var(--row-h))'
	).join(' ');
	grid.style.gridTemplateRows=`var(--hdr-group-h) var(--hdr-station-h) ${slotRows}`;




	// Row 1: group headers (no header for resurs)
	const timeHead=cellDiv('group-header header-row');
	timeHead.dataset.role = 'time-header';
	timeHead.textContent='Tid';
	grid.appendChild(timeHead);
	for(const tok of order){
		if(tok==='resurs'){
			if(resurs){
				const sp=cellDiv('group-header header-row');
				sp.classList.add('resurs-col');
				sp.textContent='';
				grid.appendChild(sp);
			}
			continue;
		}
		const g=groups.find(x=>x.id===tok);
		const sts=(grouped[g.id]||[]).sort((a,b)=>a.sort-b.sort);
		if(sts.length===0)continue;
		const gh = cellDiv('group-header header-row');
		gh.style.background = g.color;
		gh.style.color = contrastColor(g.color);
		gh.style.gridColumn = `span ${sts.length}`;
		gh.innerHTML = `
			<span class="gh-title">${escapeHtml(g.title)} grupp</span>
			<span class="gh-coord">Samordnare: ${escapeHtml(g.coordinator||'')}</span>
		`;
		grid.appendChild(gh);

	}
	// Row 2: station headers (resurs + stations)
	const timeHead2=cellDiv('station-header');
	timeHead2.textContent='';
	grid.appendChild(timeHead2);
	for(const tok of order){
		if(tok==='resurs'){
			if(resurs){
				const sh=cellDiv('station-header');
				sh.classList.add('resurs-col');
				sh.textContent=resurs.title;
				grid.appendChild(sh);
			}
			continue;
		}
		const sts=(grouped[tok]||[]).sort((a,b)=>a.sort-b.sort);
		for(const s of sts){
			const sh=cellDiv('station-header');
			sh.textContent=s.title;
			grid.appendChild(sh);
		}
	}
	// Rows: time slots
	for(let si=0; si<slots.length; si++){
		const slot=slots[si];
		const isLast = si===slots.length-1;
		const timeCell = cellDiv('cell time-cell');
		timeCell.classList.toggle('break', slot.type === 'Break');
		if(isLast) timeCell.classList.add('last-row');
		timeCell.dataset.slotId=slot.id;
		timeCell.innerHTML =
			`<div class="slot-time">${slot.start}<br>—<br>${slot.end}</div>` +
			`<div class="slot-kind">${slot.type === 'Break' ? 'Rast' : 'Arbete'}</div>`;
		grid.appendChild(timeCell);

		const addStationCell = (station) => {
			const c = cellDiv('cell');
			if(station.isResurs) c.classList.add('resurs-col');
			c.classList.toggle('break', slot.type === 'Break');
			if(isLast) c.classList.add('last-row');
			c.dataset.stationId = station.id;
			c.dataset.slotId = slot.id;

			// people list
			const list = document.createElement('div');
			list.className = 'person-list';
			list.dataset.role = 'person-list';
			c.appendChild(list);

			// footer bar (left: capacity) — no + button anymore
			const footer=document.createElement('div');
			footer.className='d-flex justify-content-end';
			footer.style.position='absolute';
			footer.style.left='0';
			footer.style.right='0';
			footer.style.bottom='0';
			footer.style.height='28px';
			footer.style.padding='0 .35rem';

			const cap=document.createElement('div');
			cap.className='cell-cap';
			cap.textContent=`max ${station.defaultCapacity}`;
			cap.style.position='static';

			footer.appendChild(cap);
			c.appendChild(footer);

			// Open picker on cell click (ignore pill clicks and active drag)
			c.addEventListener('click', ev=>{
				if(draggingPersonId) return;
				if(ev.target.closest('.person-pill')) return;	// don't open when clicking a pill
				if(!canModifyAssignments()){
					showToast('info','Viewer-läge','Redigering i viewer-läge är avstängd i Inställningar → Allmänt.');
					return;
				}
				openAssignDropdownOverlay(c, station, slot);
			});


			// DnD handling
			c.addEventListener('dragover', ev => {
				ev.preventDefault();
				ev.dataTransfer.dropEffect = 'move';
				c.classList.remove('drop-ok', 'drop-bad', 'drop-training');

				const pid = draggingPersonId;
				if(pid){
					const person = DB.persons.find(p => p.id === pid);

					// 1) Strict check (training required)
					const strictOk = isPersonAllowedFor(person, station, slot, { ignoreConflictForPersonId: pid });

					if(strictOk){
						c.classList.add('drop-ok');			// trained + allowed
					}else{
						// 2) With training override (manual-only)
						const overrideOk = isPersonAllowedFor(person, station, slot, { ignoreConflictForPersonId: pid, ignoreTraining: true });
						c.classList.add(overrideOk ? 'drop-training' : 'drop-bad');
					}
				}else{
					c.classList.add('drop-ok');
				}
			});

			c.addEventListener('dragleave', () => c.classList.remove('drop-ok', 'drop-bad', 'drop-training'));
			
			c.addEventListener('dragend', () => c.classList.remove('drop-ok', 'drop-bad', 'drop-training'));


			c.addEventListener('drop', ev => onDropPerson(ev, c, station, slot));

			grid.appendChild(c);
		};

		for(const tok of order){
			if(tok==='resurs'){
				if(resurs)addStationCell(resurs);
			}else{
				const sts=(grouped[tok]||[]).sort((a,b)=>a.sort-b.sort);
				for(const s of sts)addStationCell(s);
			}
		}
	}
	scaler.appendChild(grid);
	requestAnimationFrame(fitToViewport);
	renderAssignments();
	if(mode==='edit') validateBoard();


}

function renderAssignments(){const dateStr=getSelectedDateStr();const all=DB.assignments.filter(a=>a.date===dateStr&&a.factoryId===currentFactoryId&&a.dayType===currentDayType);for(const a of all){const cell=findCell(a.stationId,a.timeSlotId);if(cell)addPersonPill(cell,a.personId);} }
function findCell(stationId,slotId){return document.querySelector(`.cell[data-station-id="${escapeDataId(stationId)}"][data-slot-id="${CSS.escape(String(slotId))}"]`);} 

function openAssignDropdown(cell,station,slot){
  return openAssignDropdownOverlay(cell,station,slot);
}

function openAssignDropdownOverlay(cell, station, slot){
	if(!canModifyAssignments()) return;
	// Toggle: close if this cell is already open
	if(_pickerOpenCell===cell || cell.dataset.pickerOpen==='1'){
		closeAnyPicker();
		return;
	}

	// Switch: close previous, then open for this cell
	closeAnyPicker();

	// Full-screen click-capture
	const overlay=document.createElement('div');
	overlay.className='picker-overlay d-flex align-items-start justify-content-start p-2';
	overlay.style.position='fixed';
	overlay.style.inset='0';
	overlay.style.background='transparent';
	overlay.addEventListener('click', ev=>{
		if(ev.target===overlay) closeAnyPicker(); // click outside closes
	});

	// The picker "card"
	const card=document.createElement('div');
	card.className='picker-card p-2';
	card.style.position='absolute';
	card.style.overflow='auto';
	card.style.maxWidth='90vw';
	card.style.maxHeight='90vh';

	// Build the select
	const sel=document.createElement('select');
	sel.className='form-select person-picker';
	sel.size=20;

	// strike-through: already assigned in same date+slot
	const dateStr=getSelectedDateStr();
	const assignedInSlot=new Set(
		DB.assignments
			.filter(a=>a.date===dateStr && a.timeSlotId===slot.id && a.dayType===currentDayType)
			.map(a=>a.personId)
	);

	// grouped options by team
	const planningPeople = getPlanningPersons(currentFactoryId);
	const supplemental = getEveningSupplementalPersons(slot);
	const supplementalIds = new Set(supplemental.map(p=>p.id));
	const pickerPeople = currentShift==='evening' ? [...planningPeople, ...supplemental.filter(sp=>!planningPeople.some(p=>p.id===sp.id))] : planningPeople;
	const groups=DB.groups.filter(g=>g.factoryId===currentFactoryId);
	const groupsMap=new Map(groups.map(g=>[g.id,g]));
	for(const person of pickerPeople){
		if(!groupsMap.has(person.groupId)) groupsMap.set(person.groupId,{id:person.groupId,title:'Övrigt (andra skiftet)'});
	}
	for(const g of groupsMap.values()){
		const og=document.createElement('optgroup');
		og.label=g.title;
		for(const p of pickerPeople.filter(x => x.groupId===g.id)){
			const trained = isPersonTrainedForStation(p.id, station.id);

			// Allow selection when other rules pass, but ignore training here
			const okManual = isPersonAllowedFor(p, station, slot, {
				ignoreConflictForPersonId: p.id,
				ignoreTraining: true
			});

			const opt = document.createElement('option');
			opt.value = p.id;
			opt.textContent = p.name + ((currentShift==='night' || supplementalIds.has(p.id)) ? '🌙' : '');
			opt.disabled = !okManual;

			// Visuals: grey out if not trained (still selectable)
			if(!trained) opt.classList.add('not-trained');

			// Strike-through if already assigned in this slot (moving them is allowed)
			if(assignedInSlot.has(p.id)) opt.classList.add('is-assigned');

			og.appendChild(opt);
		}

		sel.appendChild(og);
	}

	card.appendChild(sel);
	overlay.appendChild(card);
	document.body.appendChild(overlay);
	//setTimeout(()=> sel.focus({preventScroll:true}), 0);

	// highlight target cell and mark as open
	cell.classList.add('picker-target');
	cell.dataset.pickerOpen='1';
	_pickerOpenCell=cell;

	// Position near the clicked cell, keep on screen
	function position(){
		const margin=8;
		const r=cell.getBoundingClientRect();
		let top=r.top;
		let left=r.right+margin;

		const vw=document.documentElement.clientWidth||window.innerWidth;
		const vh=document.documentElement.clientHeight||window.innerHeight;
		const ch=card.offsetHeight;
		const cw=card.offsetWidth;

		// prefer right; if no space, try left
		if(left+cw>vw-margin){
			left=r.left - margin - cw;
			if(left<margin) left=Math.max(margin, vw-cw-margin);
		}
		// clamp vertically
		if(top+ch>vh-margin) top=Math.max(margin, vh-ch-margin);

		card.style.left=left+'px';
		card.style.top=top+'px';
	}
	position();
	window.addEventListener('resize', position);

	// SINGLE-CLICK ASSIGN: change fires immediately on sized selects
	sel.addEventListener('change', ()=>{
		const opt=sel.options[sel.selectedIndex];
		if(opt && !opt.disabled){
			const pid=parseEntityId(opt.value);
			if(pid) movePersonTo(cell, station, slot, pid);
			cleanup();
		}
	});

	// outside click closes (mousedown so it beats focus changes)
	setTimeout(()=>{
		const onDocDown=ev=>{
			if(!overlay.contains(ev.target)){
				document.removeEventListener('mousedown', onDocDown);
				cleanup();
			}
		};
		document.addEventListener('mousedown', onDocDown);
	},0);

	// global Esc also closes
	document.addEventListener('keydown', _onPickerKeydown, true);

	function cleanup(){
		window.removeEventListener('resize', position);
		document.removeEventListener('keydown', _onPickerKeydown, true);
		cell.classList.remove('picker-target');
		cell.removeAttribute('data-picker-open');
		_pickerOpenCell=null;
		overlay.remove();
	}
}









function isPersonAllowedFor(person, station, slot, opts = {}){
	if(!person || !person.present) return false;

	// Night cutoff (evening context): night staff may not work before cutoff
	if(currentShift==='night' && currentDayType!==DayType.OvertimeDay && currentDayType!==DayType.Night && person.isNight){
		const cutoff=getNightCutoffFor(currentFactoryId, currentDate);
		if(timeLess(slot.start, cutoff)) return false;
	}

	// Training requirement (can be ignored for manual placement/picker)
	const ignoreTraining = !!opts.ignoreTraining;
	if(!station.isResurs && !ignoreTraining){
		const trained = isPersonTrainedForStation(person.id, station.id);
		if(!trained) return false;
	}

	const dateStr = getSelectedDateStr();

	// Prevent double-booking in the same slot (unless explicitly ignored for the same person)
	if(!opts.ignoreConflictForPersonId){
		if(DB.assignments.some(a =>
			a.date===dateStr &&
			a.timeSlotId===slot.id &&
			a.personId===person.id &&
			a.dayType===currentDayType
		)) return false;
	}

	// Night template: also ensure not double-booked across Night specifically
	if(currentDayType===DayType.Night){
		if(DB.assignments.some(a =>
			a.date===dateStr &&
			a.timeSlotId===slot.id &&
			a.personId===person.id &&
			a.dayType===DayType.Night
		)) return false;
	}

	return true;
}


function movePersonTo(cell, station, slot, personId){
	if(!canModifyAssignments()) return;
	const dateStr = getSelectedDateStr();
	const person = getPlanningPersonById(personId);
	if(!person) return;

	// 1) Strict check (training required)
	const strictOk = isPersonAllowedFor(person, station, slot, { ignoreConflictForPersonId: personId });

	// 2) If strict fails, allow ONLY by ignoring training (keeps night cutoff & other rules)
	const overrideOk = !strictOk && isPersonAllowedFor(person, station, slot, {
		ignoreConflictForPersonId: personId,
		ignoreTraining: true
	});

	// Block if neither strict nor override is ok (e.g., night cutoff, double-book, etc.)
	if(!strictOk && !overrideOk){
		const reasons = explainNotAllowed(person, station, slot, { ignoreConflictForPersonId: personId });
		showToast('danger', 'Ej tillåten placering', reasons.join(' '));
		cell.classList.add('drop-bad');
		setTimeout(() => cell.classList.remove('drop-bad'), 300);
		return;
	}

	// Move semantics: remove existing assignment/pill for this person in this slot
	DB.assignments = DB.assignments.filter(a =>
		!(a.date===dateStr && a.personId===personId && a.timeSlotId===slot.id && a.dayType===currentDayType)
	);
	document.querySelectorAll(
		`.cell[data-slot-id="${CSS.escape(String(slot.id))}"] .person-pill[data-person-id="${escapeDataId(personId)}"]`
	).forEach(el => { if(typeof killPillTooltip==='function') killPillTooltip(el); el.remove(); });

	// Enable per-move warning toasts
	_toastContextActive = true;
	_lastMovedPersonId = personId;

	placePerson(cell, station, slot, personId);

	// If we used the training override, inform user (pill already gets orange border)
	if(overrideOk){
		const stTitle = DB.stations.find(s => s.id === station.id)?.title || 'station';
		showToast('warning', 'Under utbildning', `Personen saknar utbildning för ${stTitle}. Placeringen tillåts men markeras.`);
	}

	_toastContextActive = false;
	_lastMovedPersonId = null;
}



function placePerson(cell,station,slot,personId){addPersonPill(cell,personId);const dateStr=getSelectedDateStr();DB.assignments.push({date:dateStr,factoryId:currentFactoryId,dayType:currentDayType,timeSlotId:slot.id,groupId:station.groupId||null,stationId:station.id,personId});if(mode==='edit')validateBoard();}

function addPersonPill(cell, personId){
	const p = getPlanningPersonById(personId) || { id:personId, name:`Person ${personId}`, groupId:null };
	const pill = document.createElement('span');
	pill.className = 'person-pill';
	pill.draggable = canModifyAssignments();
	pill.dataset.personId = personId;

	// Soft background derived from group's color
	const g = DB.groups.find(x=>x.id===p.groupId);
	if(g && g.color){
		const bg = lightenToWhite(g.color, 0.86);
		const bd = lightenToWhite(g.color, 0.70);
		pill.style.background = bg;
		pill.style.borderColor = bd;
	}

	// If placed at a station where p is NOT trained, mark + tooltip
	const stationId = parseEntityId(cell.dataset.stationId);
	const trainedHere = isPersonTrainedForStation(personId, stationId);
	if(!trainedHere){

		pill.classList.add('under-training');
		const tipText = 'Ej utbildad/under utbildning';
		pill.setAttribute('data-bs-toggle', 'tooltip');
		pill.setAttribute('data-bs-title', tipText);
		const tip = bootstrap.Tooltip.getOrCreateInstance(pill, {
			container: 'body',
			boundary: 'viewport'
		});
		tip.setContent({ '.tooltip-inner': tipText });
	}

	pill.innerHTML = `<i class="bi bi-person"></i> ${escapeHtml(p.name)} <i class="bi bi-x ms-1" role="button"></i>`;
	pill.querySelector('.bi-x').addEventListener('click', ev=>{
		ev.stopPropagation();
		if(!canModifyAssignments()) return;
		removePersonPill(cell, personId);
	});

	pill.addEventListener('dragstart', onDragStart);
	pill.addEventListener('dragend', onDragEnd);

	cell.querySelector('[data-role="person-list"]').appendChild(pill);

}



function removePersonPill(cell,personId){
	const pill=cell.querySelector(`.person-pill[data-person-id="${escapeDataId(personId)}"]`);
	if(pill) killPillTooltip(pill);
	const dateStr=getSelectedDateStr();
	const slotId=cell.dataset.slotId;
	const stationId=parseEntityId(cell.dataset.stationId);
	DB.assignments=DB.assignments.filter(a=>!(a.date===dateStr&&a.timeSlotId===slotId&&a.stationId===stationId&&a.personId===personId&&a.dayType===currentDayType));
	cell.querySelector(`[data-person-id="${escapeDataId(personId)}"]`)?.remove();
	if(mode==='edit')validateBoard();
}

function onDragStart(ev){
	if(!canModifyAssignments()){
		ev.preventDefault();
		return;
	}
	const pill=ev.target.closest('.person-pill');
	if(pill) killPillTooltip(pill);
	draggingPersonId=parseEntityId(ev.target.dataset.personId);
	ev.dataTransfer.setData('text/plain',ev.target.dataset.personId);
	ev.dataTransfer.effectAllowed='move';
}

function onDragEnd(){
	draggingPersonId=null;
	document.querySelectorAll('.drop-ok, .drop-bad, .drop-training')
		.forEach(cell => cell.classList.remove('drop-ok', 'drop-bad', 'drop-training'));
}

function onDropPerson(ev,cell,station,slot){ev.preventDefault();ev.stopPropagation();cell.classList.remove('drop-ok','drop-bad','drop-training');const personId=parseEntityId(ev.dataTransfer.getData('text/plain'));movePersonTo(cell,station,slot,personId);draggingPersonId=null;}

function validateBoard(){
	const _prevCellStates=beginCellValidation();

	const dateStr = getSelectedDateStr();
	const rows = DB.assignments.filter(a => a.date === dateStr && a.factoryId === currentFactoryId && a.dayType === currentDayType);

	// 1) Same person booked twice in the same slot (any stations)
	const bySlot = groupArray(rows, a => a.timeSlotId);
	for (const [slotId, arr] of bySlot.entries()) {
		const seen=new Map();
		for(const a of arr){
			if(seen.has(a.personId)){
				markCellInvalid(a.stationId,slotId,'Samma person dubbelbokad i samma tid.', 'Dubbelbokad');
				markCellInvalid(seen.get(a.personId).stationId,slotId,'Samma person dubbelbokad i samma tid.', 'Dubbelbokad');
			}else{
				seen.set(a.personId,a);
			}
		}
		// 2) Pair rule: avoid certain pairs on the SAME station & slot
		const byStation = groupArray(arr, x => x.stationId);
		for (const [stationId, list] of byStation.entries()) {
			for (let i = 0; i < list.length; i++) {
				for (let j = i + 1; j < list.length; j++) {
					if (isIncompatible(list[i].personId, list[j].personId)) {
						markCellWarn(stationId, slotId, 'Byt plats på en av dessa personer.', 'Tips');
					}
				}
			}
		}
	}

	// 3) Consecutive work-slot marker (always warn, never block here)
	const workSlots = DB.timeSlots
		.filter(ts => ts.factoryId===currentFactoryId && ts.dayType===currentDayType && ts.type==='Work')
		.sort((a, b) => a.sort - b.sort);
	const workSlotOrder = new Map(workSlots.map((s, i) => [String(s.id), i]));

	const byPersonStation = groupArray(
		rows.filter(a => workSlotOrder.has(String(a.timeSlotId))),
		a => a.personId + '@' + a.stationId
	);

	for(const [, items] of byPersonStation.entries()){
		items.sort((a, b) => workSlotOrder.get(String(a.timeSlotId)) - workSlotOrder.get(String(b.timeSlotId)));
		for(let i=1; i<items.length; i++){
			const cur = items[i], prev = items[i-1];
			if(workSlotOrder.get(String(cur.timeSlotId)) === workSlotOrder.get(String(prev.timeSlotId)) + 1){
				// color + tooltip (warning), regardless of toggle
				markCellInvalid(cur.stationId, cur.timeSlotId, 'Samma person två pass i rad på denna station.', 'Dubbelpass');
			}
		}
	}



	// 4) Capacity
	document.querySelectorAll('.cell[data-station-id]').forEach(c=>{
		const station=DB.stations.find(s=>String(s.id)===String(parseEntityId(c.dataset.stationId)));
		const count=c.querySelectorAll('.person-pill').length;
		if(count>(station.defaultCapacity||1)) markCellInvalid(station.id,c.dataset.slotId,'Över kapacitet.', 'Kapacitet');
	});

	// 5) Night cutoff (only for evening context)
	if(currentDayType!==DayType.OvertimeDay&&currentDayType!==DayType.Night){
		const cutoff=getNightCutoffFor(currentFactoryId,currentDate);
		document.querySelectorAll('.cell[data-station-id]').forEach(c=>{
			const slot=DB.timeSlots.find(ts=>String(ts.id)===c.dataset.slotId);
			if(timeLess(slot.start,cutoff)){
				c.querySelectorAll('.person-pill').forEach(pp=>{
					const p=getPlanningPersonById(parseEntityId(pp.dataset.personId));
					if(p && currentShift==='night' && p.isNight) markCellInvalid(parseEntityId(c.dataset.stationId),c.dataset.slotId,'Nattpersonal får ej bokas före cutoff.', 'Ej tillåten tid');
				});
			}
		});
	}
	applyCellValidationDiff(_prevCellStates);
	renderSummaryPanel();

}


function cellKey(stationId, slotId){ return `${stationId}:${slotId}` }

function getCellByKey(key){
	const [sid,slot]=key.split(':')
	return findCell(parseEntityId(sid), slot)
}

function beginCellValidation(){
	_pendingCellStates.clear();
	_inValidation = true;

	const prev = new Map();
	document.querySelectorAll('.cell').forEach(c=>{
		const sid = parseEntityId(c.dataset.stationId);
		const slot = c.dataset.slotId || c.getAttribute('data-slot-id');
		if(!sid || !slot) return;
		const key = `${sid}:${slot}`;
		prev.set(key, {
			warn: c.classList.contains('warn'),
			invalid: c.classList.contains('invalid'),
			tip: (c.getAttribute('data-bs-original-title') || c.getAttribute('data-bs-title') || c.getAttribute('title') || '').trim()
		});
	});
	return prev;
}


function queueCellWarn(stationId, slotId, msg){
	const key=cellKey(stationId, slotId)
	const s=_pendingCellStates.get(key)||{warn:false, invalid:false, msgs:[]}
	s.warn=true
	if(msg && !s.msgs.includes(msg)) s.msgs.push(msg)
	_pendingCellStates.set(key,s)
}

function queueCellInvalid(stationId, slotId, msg){
	const key=cellKey(stationId, slotId)
	const s=_pendingCellStates.get(key)||{warn:false, invalid:false, msgs:[]}
	s.invalid=true
	if(msg && !s.msgs.includes(msg)) s.msgs.push(msg)
	_pendingCellStates.set(key,s)
}

function setCellTooltipContent(cell, text){
	const cur=(cell.getAttribute('data-bs-original-title')||cell.getAttribute('data-bs-title')||cell.getAttribute('title')||'').trim()
	if((text||'').trim()===cur) return
	if(!text){
		disposeCellTooltip(cell)
		return
	}
	cell.setAttribute('data-bs-toggle','tooltip')
	cell.setAttribute('data-bs-title', text)
	const tip=bootstrap.Tooltip.getOrCreateInstance(cell,{container:'body', boundary:'viewport'})
	if(tip && tip.setContent) tip.setContent({'.tooltip-inner': text})
}

function applyCellValidationDiff(prev){
	_inValidation=false

	// union of keys (prev + next)
	const allKeys=new Set([...prev.keys(), ..._pendingCellStates.keys()])
	allKeys.forEach(key=>{
		const cell=getCellByKey(key)
		if(!cell) return

		const p = prev.get(key) || { warn:false, invalid:false, tip:'' };
		const n = _pendingCellStates.get(key) || { warn:false, invalid:false, msgs:[] };

		const prevTag = _stateTag(p.warn, p.invalid);
		const nextTag = _stateTag(n.warn, n.invalid);

		if(HAS_CROSSFADE){
			_xfadeCF(cell, prevTag, nextTag);
		}else{
			_xfadeFallback(cell, prevTag, nextTag);
		}

		// tooltip update stays as you have it
		setCellTooltipContent(cell, (n.msgs || []).join('\n'));



	})
}


function markCellWarn(stationId, slotId, msg){
	if(_inValidation){ queueCellWarn(stationId, slotId, msg); return; }
	const cell = findCell(parseEntityId(stationId), slotId);
	if(!cell) return;
	_appendCellTooltip(cell, msg);
	const prevTag = _stateTag(cell.classList.contains('warn'), cell.classList.contains('invalid'));
	if(HAS_CROSSFADE) _xfadeCF(cell, prevTag, 'warn'); else _xfadeFallback(cell, prevTag, 'warn');
}
function markCellInvalid(stationId, slotId, msg){
	if(_inValidation){ queueCellInvalid(stationId, slotId, msg); return; }
	const cell = findCell(parseEntityId(stationId), slotId);
	if(!cell) return;
	_appendCellTooltip(cell, msg);
	const prevTag = _stateTag(cell.classList.contains('warn'), cell.classList.contains('invalid'));
	if(HAS_CROSSFADE) _xfadeCF(cell, prevTag, 'invalid'); else _xfadeFallback(cell, prevTag, 'invalid');
}








function isIncompatible(a,b){return DB.compatibility.some(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));}

function setupTooltips(){[...document.querySelectorAll('[title]')].forEach(el=>{new bootstrap.Tooltip(el,{trigger:'hover',placement:'auto'});});}

function openRandomizer(){
	const m=new bootstrap.Modal('#randomizeModal');

	// ----- restore avoidConsecutive from storage (default: true) -----
	const acSaved=localStorage.getItem('planning.avoidConsecutive');
	const ac=(acSaved===null)?true:(acSaved==='1'||acSaved==='true');
	document.getElementById('avoidConsecutive').checked=ac;

	// ----- Groups (now: defines PEOPLE POOL) -----
	const wrapG=document.getElementById('randGroups');
	wrapG.innerHTML='';
	const {order}=orderedColumns();
	order.filter(tok=>tok!=='resurs').forEach(id=>{
		const g=DB.groups.find(x=>x.id===id);
		if(!g)return;
		const div=document.createElement('div');
		div.className='form-check';
		div.innerHTML=`
			<input class="form-check-input" type="checkbox" value="${g.id}" id="rg${g.id}" checked>
			<label class="form-check-label" for="rg${g.id}">${escapeHtml(g.title)}</label>
		`;
		wrapG.appendChild(div);
	});

	// ----- Stations (with GROUP-LEVEL toggle at the group name) -----
	const wrapS=document.getElementById('randStations');
	wrapS.innerHTML='';

	const {grouped}=orderedColumns();
	order.forEach(tok=>{
		if(tok==='resurs')return; // still not listed; we fill it last automatically
		const g=DB.groups.find(x=>x.id===tok);
		if(!g)return;
		const stations=(grouped[g.id]||[]).sort((a,b)=>a.sort-b.sort);
		if(stations.length===0)return;

		// group container
		const box=document.createElement('div');
		box.className='col-12';
		box.innerHTML=`
			<div class="rand-station-group" data-gid="${g.id}">
				<div class="rand-group-header">
					<input class="form-check-input me-1" type="checkbox" id="rsg${g.id}">
					<label class="form-check-label" for="rsg${g.id}">${escapeHtml(g.title)}</label>
				</div>
				<div class="row row-cols-2 g-2" data-role="stations"></div>
			</div>
		`;
		wrapS.appendChild(box);

		// stations
		const list=box.querySelector('[data-role="stations"]');
		stations.forEach(s=>{
			const col=document.createElement('div');
			col.className='col';
			col.innerHTML=`
				<div class="form-check">
					<input class="form-check-input" data-kind="station" data-role="station-op"
						data-station-id="${s.id}" type="checkbox"
						value="${s.id}" id="rs${s.id}" ${s.operational?'checked':''}>
					<label class="form-check-label" for="rs${s.id}">${escapeHtml(s.title)}</label>
				</div>
			`;

			list.appendChild(col);
		});

		// group checkbox controls all children; set tri-state on change
		const gChk=box.querySelector(`#rsg${g.id}`);
		const childChecks=[...box.querySelectorAll('.form-check-input[data-kind="station"]')];

		function syncGroupState(){
			const total=childChecks.length;
			const on=childChecks.filter(c=>c.checked).length;
			gChk.indeterminate=on>0&&on<total;
			gChk.checked=on===total;
		}
		gChk.addEventListener('change',()=>{
			const on=gChk.checked;
			const childs=[...box.querySelectorAll('.form-check-input[data-kind="station"]')];
			childs.forEach(c=>{
				const sid=parseEntityId(c.dataset.stationId);
				setStationOperational(sid, on); // updates DB + both UIs
			});
		});

		childChecks.forEach(c=>c.addEventListener('change',syncGroupState));
		// initial
		syncGroupState();
	});

	m.show();
}



function runRandomizer(){
	// groups -> PEOPLE POOL
	const selectedGroupIds = new Set(
		[...document.querySelectorAll('#randGroups input:checked')].map(i => parseEntityId(i.value))
	);

	// stations to fill
	const selectedStationIds = new Set(
		[...document.querySelectorAll('#randStations input[id^="rs"]:checked')].map(i => parseEntityId(i.value))
	);

	// avoid consecutive toggle (persist)
	const avoidConsecutive = document.getElementById('avoidConsecutive').checked;
	localStorage.setItem('planning.avoidConsecutive', avoidConsecutive ? '1' : '0');

	// ordered work slots
	const slots = DB.timeSlots
		.filter(ts => ts.factoryId===currentFactoryId && ts.dayType===currentDayType && ts.type==='Work')
		.sort((a, b)=>a.sort-b.sort);

	// chosen stations: non-Resurs first; Resurs auto last
	const chosen = DB.stations.filter(s => s.factoryId===currentFactoryId && selectedStationIds.has(s.id));
	const nonRes = chosen.filter(s => !s.isResurs);
	const res = DB.stations.find(s => s.factoryId===currentFactoryId && s.isResurs && s.operational);

	// per slot: round-robin across non-Resurs
	for(const sl of slots){
		roundRobinFill(nonRes, sl, {candidateGroupIds:selectedGroupIds, avoidConsecutive});
	}
	// then Resurs (if present)
	if(res){
		for(const sl of slots){
			roundRobinFill([res], sl, {candidateGroupIds:selectedGroupIds, avoidConsecutive});
		}
	}

	bootstrap.Modal.getInstance(document.getElementById('randomizeModal')).hide();
	rebuildAll();
}


function fillCellByRandom(station,slot,opts={}){
	const dateStr=getSelectedDateStr();
	const cell=findCell(station.id,slot.id);
	const currentCount=cell.querySelectorAll('.person-pill').length;
	const capacity=station.defaultCapacity||1;
	if(currentCount>=capacity) return 0;

	const candidateGroups=opts.candidateGroupIds||null;
	const avoidConsecutive=(opts.avoidConsecutive!==false); // default true

	// base candidates: present, allowed, and (if set) in included groups
	let candidates=getPlanningPersons(currentFactoryId).filter(p=>
		p.factoryId===currentFactoryId &&
		p.present &&
		(!candidateGroups || candidateGroups.has(p.groupId)) &&
		isPersonAllowedFor(p,station,slot)
	);

	// optional back-to-back filter on same station
	if(avoidConsecutive){
		const workSlots=DB.timeSlots
			.filter(ts=>ts.factoryId===currentFactoryId&&ts.dayType===currentDayType&&ts.type==='Work')
			.sort((a,b)=>a.sort-b.sort);
		const slotIndex=workSlots.findIndex(x=>x.id===slot.id);
		const prevSlot=slotIndex>0?workSlots[slotIndex-1]:null;
		if(prevSlot){
			const prevAss=DB.assignments
				.filter(a=>a.date===dateStr&&a.stationId===station.id&&a.timeSlotId===prevSlot.id&&a.dayType===currentDayType)
				.map(a=>a.personId);
			candidates=candidates.filter(c=>!prevAss.includes(c.id));
		}
	}

	shuffle(candidates);

	let placed=0;
	for(const cand of candidates){
		// still avoid incompatible pairs inside the same cell
		const existing=DB.assignments
			.filter(a=>a.date===dateStr&&a.stationId===station.id&&a.timeSlotId===slot.id&&a.dayType===currentDayType)
			.map(a=>a.personId);
		if(existing.some(e=>isIncompatible(e,cand.id))) continue;

		placePerson(cell,station,slot,cand.id);
		placed++;
		if(cell.querySelectorAll('.person-pill').length>=capacity) break;
	}
	return (currentCount+placed<capacity) ? (capacity-(currentCount+placed)) : 0;
}


async function saveAll(){
	console.log('Saving assignments (mock):',DB.assignments.filter(a=>a.date===getSelectedDateStr()&&a.factoryId===currentFactoryId&&a.dayType===currentDayType));
}

function renderSettings(){syncInactivitySettingInput();syncViewerShiftLeadSettingInput();syncViewerEditSettingInput();syncCoordAutoLogoutInput();renderPersonGroups();renderGroupTable();renderStationsByGroup();renderSlotEditor();renderConstraintTable();}

function renderPersonGroups(){
	const wrap = document.getElementById('personGroupsWrap');
	wrap.innerHTML = '';
	const order = getNormalizedGroupOrder(currentFactoryId);
	const groupsOrdered = order.filter(tok=>tok!=='resurs').map(id=>DB.groups.find(x=>x.id===id));

	for(const g of groupsOrdered){
		const card = document.createElement('div');
		card.className = 'card shadow-sm';

		card.innerHTML = `
			<div class="card-header d-flex justify-content-between align-items-center"
				 style="background:${g.color}; color:${contrastColor(g.color)}">
				<strong>${escapeHtml(g.title)}</strong>
				<button class="btn btn-sm btn-light" data-action="add" data-group="${g.id}">
					<i class="bi bi-plus"></i> Lägg till person
				</button>
			</div>
			<div class="card-body p-0">
				<table class="table table-sm align-middle mb-0">
					<thead>
						<tr>
							<th style="width:2.5%"></th>
							<th style="width:22%">Namn</th>
							<th style="width:18%">Grupp</th>
							<th style="width:12%"><span class="d-inline-flex align-items-center gap-1">Närvarande <button type="button" class="settings-info-btn small fw-semibold" data-bs-toggle="tooltip" data-bs-placement="top" title="Avmarkera om personen är frånvarande. Frånvarande personer kan inte tilldelas i planeringen."><i class="bi bi-info-circle-fill" aria-hidden="true"></i><span class="visually-hidden">Info om Närvarande</span></button></span></th>
							<th style="width:12%"><span class="d-inline-flex align-items-center gap-1">Utbildning <button type="button" class="settings-info-btn small fw-semibold" data-bs-toggle="tooltip" data-bs-placement="top" title="Öppnar personens utbildningar per station. Saknad utbildning ger utbildningsvarning i planeringen."><i class="bi bi-info-circle-fill" aria-hidden="true"></i><span class="visually-hidden">Info om Utbildning</span></button></span></th>
							<th style="width:10%"></th>
						</tr>
					</thead>
					<tbody id="pg-${g.id}" class="person-drop-target"></tbody>
				</table>
			</div>
		`;
		wrap.appendChild(card);

		const tb = card.querySelector('tbody');

		// keep stable visual order via p.sort, fallback by name
		const people = DB.persons
			.filter(p=>p.factoryId===currentFactoryId && p.groupId===g.id)
			.slice()
			.sort((a,b)=>{
				const sa=(typeof a.sort==='number')?a.sort:9999;
				const sb=(typeof b.sort==='number')?b.sort:9999;
				return (sa-sb) || a.name.localeCompare(b.name);
			});

		for(const p of people){
			const tr = document.createElement('tr');
			tr.draggable = true;
			tr.dataset.id = p.id;

			// row HTML: make first cell use the tighter grip col
			tr.innerHTML=`
				<td class="text-muted grip-col"><i class="bi bi-grip-vertical drag-handle"></i></td>
				<td><input class="form-control form-control-sm" value="${escapeHtml(p.name)}" data-bind="name" data-id="${p.id}"></td>
				<td>${groupSelect(p.groupId, p.id)}</td>
				<td><input type="checkbox" ${p.present?'checked':''} data-bind="present" data-id="${p.id}"></td>
				<td><button class="btn btn-sm btn-outline-secondary" data-action="training" data-id="${p.id}"><i class="bi bi-1-circle"></i></button></td>
				<td><button class="btn btn-sm btn-outline-danger" data-action="del" data-id="${p.id}"><i class="bi bi-trash"></i></button></td>
			`;

			tr.draggable=true;
			tr.addEventListener('dragstart', ()=>{
				draggingPersonRowId=p.id;
				dragSourceGroupId=p.groupId;
			});
			tr.addEventListener('dragend', ()=>{
				draggingPersonRowId=null;
				dragSourceGroupId=null;
			});


			tb.appendChild(tr);
		}

		// reorder inside the same group
		enableRowDrag(tb, (orderIds)=>{
			orderIds.forEach((id, idx)=>{
				const person = DB.persons.find(x=>String(x.id)===String(id));
				if(person && person.groupId===g.id) person.sort = idx+1;
			});
			renderPersonGroups(); rebuildAll();
		});

		// allow moving INTO this group's list
		enablePersonCrossDrop(tb, g.id);
	}

	// bindings
	wrap.querySelectorAll('input[data-bind], select[data-bind]').forEach(el=>{
		el.addEventListener('change', ()=>{
			const id = parseEntityId(el.dataset.id);
			const p = DB.persons.find(x=>x.id===id);
			if(!p) return;
			if(el.dataset.bind==='name') p.name = el.value.trim();
			if(el.dataset.bind==='present') p.present = el.checked;
			if(el.dataset.bind==='groupId'){
				const newG = parseEntityId(el.value);
				if(p.groupId!==newG){
					p.groupId = newG;
					const maxSort = Math.max(0, ...DB.persons
						.filter(x=>x.factoryId===currentFactoryId && x.groupId===newG && typeof x.sort==='number')
						.map(x=>x.sort||0));
					p.sort = maxSort + 1;
					renderPersonGroups(); rebuildAll();
				}
			}
		});
	});
	wrap.querySelectorAll('button[data-action="training"]').forEach(b=>
		b.addEventListener('click',()=>editTraining(parseEntityId(b.dataset.id)))
	);
	wrap.querySelectorAll('button[data-action="del"]').forEach(b=>
		b.addEventListener('click',()=>{
			const id = parseEntityId(b.dataset.id);
			DB.persons = DB.persons.filter(p=>p.id!==id);
			renderPersonGroups(); rebuildAll();
		})
	);
	wrap.querySelectorAll('button[data-action="add"]').forEach(b=>
		b.addEventListener('click',()=>{
			const gid = parseEntityId(b.dataset.group);
			const id  = newId();
			const maxSort = Math.max(0, ...DB.persons
				.filter(x=>x.factoryId===currentFactoryId && x.groupId===gid && typeof x.sort==='number')
				.map(x=>x.sort||0));
			DB.persons.push({ id, name:'Ny', factoryId:currentFactoryId, groupId:gid, isNight:(currentShift==='night'), present:true, sort:maxSort+1 });
			renderPersonGroups();
			const inp = document.querySelector(`input[data-bind="name"][data-id="${escapeDataId(id)}"]`);
			if(inp){ inp.focus(); inp.select(); }
		})
	);
}


function groupSelect(val,bindId){
	const order=getNormalizedGroupOrder(currentFactoryId);
	const opts=order.filter(tok=>tok!=='resurs').map(id=>DB.groups.find(x=>x.id===id)).map(g=>`<option value="${g.id}" ${g.id===val?'selected':''}>${escapeHtml(g.title)}</option>`).join('');
	return `<select class="form-select form-select-sm" data-bind="groupId" data-id="${bindId}">${opts}</select>`;
}

function renderGroupTable(){
	const tb=document.getElementById('groupTable');
	tb.innerHTML='';
	const order=getNormalizedGroupOrder(currentFactoryId);
	for(const tok of order){
		if(tok==='resurs'){
			const tr=document.createElement('tr');tr.draggable=true;tr.dataset.key='resurs';
			tr.innerHTML=`<td class="text-muted"><i class="bi bi-grip-vertical drag-handle"></i></td><td><span class="badge text-bg-info">Resurs</span></td><td class="text-muted">—</td><td class="text-muted">—</td><td></td>`;
			tb.appendChild(tr);continue;
		}
		const g=DB.groups.find(x=>x.id===tok);
		const tr=document.createElement('tr');tr.draggable=true;tr.dataset.key=String(g.id);
		tr.innerHTML=`<td class="text-muted"><i class="bi bi-grip-vertical drag-handle"></i></td><td><input class="form-control form-control-sm" value="${escapeHtml(g.title)}" data-bind="title" data-id="${g.id}"></td><td><input type="color" class="form-control form-control-color" value="${g.color}" data-bind="color" data-id="${g.id}"></td><td><input class="form-control form-control-sm" value="${escapeHtml(g.coordinator||'')}" data-bind="coord" data-id="${g.id}"></td><td><button class="btn btn-sm btn-outline-danger" data-id="${g.id}"><i class="bi bi-trash"></i></button></td>`;
		tb.appendChild(tr);
	}
	enableRowDragKeys(tb,(orderKeys)=>{
		DB.groupDisplayOrder[currentFactoryId]=orderKeys.map(k=>k==='resurs'?'resurs':parseEntityId(k));
		renderGroupTable();renderStationsByGroup();rebuildAll();
	});
	tb.querySelectorAll('input[data-bind]').forEach(el=>{
		el.addEventListener('change',()=>{
			const id=parseEntityId(el.dataset.id);
			const g=DB.groups.find(x=>x.id===id);
			if(el.dataset.bind==='title') g.title=el.value.trim();
			if(el.dataset.bind==='color') g.color=el.value;
			if(el.dataset.bind==='coord') g.coordinator=el.value.trim();
			rebuildAll();
		});
	});
	document.getElementById('addGroupBtn').onclick=()=>{
		const id=newId();
		DB.groups.push({id,factoryId:currentFactoryId,title:'Ny grupp',color:'#dddddd',coordinator:''});
		const cur=DB.groupDisplayOrder[currentFactoryId]||[];
		DB.groupDisplayOrder[currentFactoryId]=[...cur,id];
		renderGroupTable();renderStationsByGroup();rebuildAll();
		const inp=document.querySelector(`input[data-bind="title"][data-id="${escapeDataId(id)}"]`);
		if(inp){inp.focus();inp.select();}
	};
	tb.querySelectorAll('button.btn-outline-danger').forEach(b => b.addEventListener('click', async () => {
		const id = parseEntityId(b.dataset.id);
		const g = DB.groups.find(x => x.id === id);

		// what will be removed
		const stationsIn = DB.stations.filter(s => s.factoryId === currentFactoryId && !s.isResurs && s.groupId === id);
		const personsIn  = DB.persons.filter(p => p.factoryId === currentFactoryId && p.groupId === id);

		const ok = await showConfirm({
			title: 'Ta bort grupp',
			message: `Ta bort gruppen “${g ? g.title : ''}”?`,
			sub: `<b class="text-danger">${stationsIn.length} stationer</b> och <b class="text-danger">${personsIn.length} personer</b> i gruppen tas också bort, inklusive deras planeringar och utbildningskopplingar.`,
			okText: 'Ta bort grupp',
			okClass: 'btn-danger'
		});
		if(!ok) return;

		// collect ids for cleanup
		const stationIds = new Set(stationsIn.map(s => s.id));
		const personIds  = new Set(personsIn.map(p => p.id));

		// remove assignments & training that reference them
		DB.assignments = DB.assignments.filter(a => !(stationIds.has(a.stationId) || personIds.has(a.personId)));
		DB.training    = DB.training.filter(t => !(stationIds.has(t.stationId) || personIds.has(t.personId)));

		// remove stations & persons
		DB.stations = DB.stations.filter(s => !stationIds.has(s.id));
		DB.persons  = DB.persons.filter(p => !personIds.has(p.id));

		// finally remove the group and from the display order
		DB.groups = DB.groups.filter(gr => gr.id !== id);
		DB.groupDisplayOrder[currentFactoryId] =
			(DB.groupDisplayOrder[currentFactoryId] || []).filter(tok => tok === 'resurs' || tok !== id);

		// refresh all affected UIs (this also fixes the stale "Personal" card)
		renderGroupTable();
		renderStationsByGroup();
		renderPersonGroups();
		rebuildAll();
	}));


}

function renderStationsByGroup(){
	const wrap = document.getElementById('stationsByGroup');
	wrap.innerHTML = '';
	const { order } = orderedColumns();
	for (const tok of order) {
		const isRes = (tok === 'resurs');
		const g = DB.groups.find(x => x.id === tok);
		const title = isRes ? '(Resurs/utan grupp)' : (g || {}).title;
		const stations = DB.stations.filter(s => s.factoryId === currentFactoryId && ((isRes && s.isResurs) || (!isRes && s.groupId === tok))).sort((a, b) => a.sort - b.sort);
		const card = document.createElement('div');
		card.className = 'card';
		const headerStyle = !isRes && g ? `style="background:${g.color};color:${contrastColor(g.color)}"` : '';
		card.innerHTML = `<div class="card-header d-flex justify-content-between align-items-center" ${headerStyle}>
			<div><strong>${escapeHtml(title)}</strong></div>
			<button class="btn btn-sm btn-light" data-action="addStation" data-group="${isRes ? '' : tok}"><i class="bi bi-plus"></i> Lägg till station</button>
		</div>
		<div class="card-body p-0"><table class="table table-sm align-middle mb-0">
			<thead><tr><th style="width:32px"></th><th>Namn</th><th>Kapacitet</th><th><span class="d-inline-flex align-items-center gap-1">Operativ <button type="button" class="settings-info-btn small fw-semibold" data-bs-toggle="tooltip" data-bs-placement="top" title="Aktivera för att visa stationen i planeringen. Inställningen delas mellan Dag/Natt."><i class="bi bi-info-circle-fill" aria-hidden="true"></i><span class="visually-hidden">Info om Operativ</span></button></span></th><th></th></tr></thead>
			<tbody></tbody></table></div>`;
		const tb=card.querySelector('tbody');
		stations.forEach(s=>{
			const tr=document.createElement('tr');tr.draggable=true;tr.dataset.id=s.id;
			tr.innerHTML = `
				<td class="text-muted"><i class="bi bi-grip-vertical drag-handle"></i></td>
				<td><input class="form-control form-control-sm" value="${escapeHtml(s.title)}" data-bind="title" data-id="${s.id}"></td>
				<td style="width:110px"><input type="number" min="0" class="form-control form-control-sm" value="${s.defaultCapacity||1}" data-bind="defcap" data-id="${s.id}"></td>
				<td>
					<input type="checkbox"
						${s.operational?'checked':''}
						data-bind="op"
						data-role="station-op"
						data-station-id="${s.id}"
						data-id="${s.id}">
				</td>
				<td><button class="btn btn-sm btn-outline-danger" data-id="${s.id}"><i class="bi bi-trash"></i></button></td>
			`;

			tb.appendChild(tr);
		});
		wrap.appendChild(card);
		enableRowDrag(tb, (order)=>{
			order.forEach((id, idx)=>{
				const s=DB.stations.find(x=>String(x.id)===String(id));	// <- compare as strings
				s.sort=idx+1;
			});
			renderStationsByGroup();
			rebuildAll();
		});

		tb.querySelectorAll('input[data-bind]').forEach(el=>{
			el.addEventListener('change',()=>{
				const id=parseEntityId(el.dataset.id);
				const s=DB.stations.find(x=>x.id===id);
				if(el.dataset.bind==='title') s.title=el.value.trim();
				if(el.dataset.bind==='defcap') s.defaultCapacity=parseInt(el.value,10)||1;
				if(el.dataset.bind==='op') s.operational=el.checked; return;
				if(el.dataset.bind==='resurs') s.isResurs=el.checked;
				rebuildAll();
			});
		});
		card.querySelector('[data-action="addStation"]').addEventListener('click',()=>{
			const id=newId();
			DB.stations.push({id,factoryId:currentFactoryId,groupId:isRes?null:tok,title:'Ny station',defaultCapacity:1,operational:true,sort:99,isResurs:isRes});
			renderStationsByGroup();rebuildAll();
			const inp=document.querySelector(`input[data-bind="title"][data-id="${escapeDataId(id)}"]`);
			if(inp){inp.focus();inp.select();}
		});
		card.querySelectorAll('button.btn-outline-danger').forEach(b=>b.addEventListener('click',async()=>{
			const id=parseEntityId(b.dataset.id);
			const s=DB.stations.find(x=>x.id===id);
			const ok=await showConfirm({
				title:'Ta bort station',
				message:`Ta bort stationen “${s ? s.title : ''}”?`,
				sub: `Planeringar för stationen tas också bort.`,
				okText:'Ta bort station',
				okClass:'btn-danger'
			});
			if(!ok) return;
			DB.stations=DB.stations.filter(s=>s.id!==id);
			renderStationsByGroup(); rebuildAll();
		}));

	}
}

function renderSlotEditor(){
	const wrap=document.getElementById('slotEditor');
	wrap.innerHTML='';
	const dayTypes=currentShift==='day'?[DayType.Day,DayType.OvertimeDay]:(currentShift==='evening'?[DayType.EveningMonThu,DayType.EveningFri,DayType.OvertimeDay]:[DayType.Night,DayType.OvertimeDay]);
	dayTypes.forEach(dt=>{
		const div=document.createElement('div');
		div.className='mb-3';
		div.innerHTML=`<h6 class="mt-3">${labelFor(dt)}</h6>`;
		const tbl=document.createElement('table');
		tbl.className='table table-sm align-middle';
		tbl.innerHTML='<thead><tr><th style="width:32px"></th><th>Start (HH:MM)</th><th>Slut (HH:MM)</th><th>Typ</th><th></th></tr></thead><tbody></tbody>';
		const body=tbl.querySelector('tbody');
		for(const s of DB.timeSlots.filter(x=>x.factoryId===currentFactoryId&&x.dayType===dt).sort((a,b)=>a.sort-b.sort)){
			const tr=document.createElement('tr');tr.draggable=true;tr.dataset.id=s.id;
			tr.innerHTML=`<td class="text-muted"><i class="bi bi-grip-vertical drag-handle"></i></td><td><input type="text" inputmode="numeric" pattern="^\\d{2}:\\d{2}$" placeholder="hh:mm" class="form-control form-control-sm t24" value="${s.start}" data-bind="start" data-id="${s.id}"></td><td><input type="text" inputmode="numeric" pattern="^\\d{2}:\\d{2}$" placeholder="hh:mm" class="form-control form-control-sm t24" value="${s.end}" data-bind="end" data-id="${s.id}"></td><td><select data-bind="type" data-id="${s.id}" class="form-select form-select-sm"><option value="Work" ${s.type==='Work'?'selected':''}>Arbete</option><option value="Break" ${s.type==='Break'?'selected':''}>Rast</option></select></td><td><button class="btn btn-sm btn-outline-danger" data-id="${s.id}"><i class="bi bi-trash"></i></button></td>`;
			body.appendChild(tr);
		}
		div.appendChild(tbl);
		enableRowDrag(body, (order)=>{
			order.forEach((id, idx)=>{
				const s=DB.timeSlots.find(x=>String(x.id)===String(id));	// <- compare as strings
				s.sort=idx+1;
			});
			renderSlotEditor();
			rebuildAll();
		});

		const addBtn=document.createElement('button');
		addBtn.className='btn btn-sm btn-outline-primary';
		addBtn.innerHTML='<i class="bi bi-plus"></i> Lägg till rad';
		addBtn.addEventListener('click',()=>{
			const id=`${currentFactoryId}-${dt}-${Date.now()}`;
			DB.timeSlots.push({id,factoryId:currentFactoryId,dayType:dt,start:'00:00',end:'',type:'Work',sort:99});
			renderSlotEditor();rebuildAll();
			const inp=document.querySelector(`input[data-bind="start"][data-id="${escapeDataId(id)}"]`);
			if(inp){inp.focus();inp.select();}
		});
		wrap.appendChild(div);
		wrap.appendChild(addBtn);
	});
	wrap.querySelectorAll('input[data-bind], select[data-bind]').forEach(el=>{
		el.addEventListener('change',()=>{
			const s=DB.timeSlots.find(x=>String(x.id)===el.dataset.id);
			if(el.classList.contains('t24')){
				const v=normalize24(el.value);
				el.value=v;
				if(el.dataset.bind==='start') s.start=v;
				if(el.dataset.bind==='end') s.end=v;
			}else{
				if(el.dataset.bind==='type') s.type=el.value;
			}
			rebuildAll();
		});
	});
	wrap.querySelectorAll('button.btn-outline-danger').forEach(b=>b.addEventListener('click',async()=>{
		const id=b.dataset.id;
		const s=DB.timeSlots.find(x=>String(x.id)===String(id));
		const ok=await showConfirm({
			title:'Ta bort tidsintervall',
			message:`Ta bort raden ${s ? (s.start||'')+'–'+(s.end||'') : ''}?`,
			sub: `Planeringar för tidsintervallen tas också bort.`,
			okText:'Ta bort rad',
			okClass:'btn-danger'
		});
		if(!ok) return;
		DB.timeSlots=DB.timeSlots.filter(s=>String(s.id)!==id);
		renderSlotEditor(); rebuildAll();
	}));

}

function renderConstraintTable(){
	const tb=document.getElementById('constraintTable');
	tb.innerHTML='';
	DB.compatibility.forEach((c, idx)=>{
		const tr=document.createElement('tr');
		tr.dataset.index=String(idx);
		tr.innerHTML=`<td>${personSelect(c.a,`a-${idx}`,{excludeId:c.b})}</td><td>${personSelect(c.b,`b-${idx}`,{excludeId:c.a})}</td><td><button class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button></td>`;
		tb.appendChild(tr);
	});
	document.getElementById('addConstraintBtn').onclick=()=>{
		DB.compatibility.push({a:null,b:null});
		renderConstraintTable();
		if(mode==='edit') validateBoard();
	};
	tb.querySelectorAll('select').forEach(sel=>sel.addEventListener('change',()=>{
		const row=sel.closest('tr');
		const index=Number.parseInt(row?.dataset.index ?? '-1',10);
		if(index<0 || !DB.compatibility[index]) return;
		const s=row.querySelectorAll('select');
		DB.compatibility[index]={
			a:s[0].value ? parseEntityId(s[0].value) : null,
			b:s[1].value ? parseEntityId(s[1].value) : null
		};
		renderConstraintTable();
		if(mode==='edit') validateBoard();
	}));
	tb.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',async()=>{
		const tr=btn.closest('tr');
		const i=[...tb.children].indexOf(tr);
		const ok=await showConfirm({
			title:'Ta bort regel',
			message:'Ta bort denna samarbetsregel?',
			okText:'Ta bort regel',
			okClass:'btn-danger'
		});
		if(!ok) return;

		DB.compatibility.splice(i,1);
		renderConstraintTable();
		validateBoard();	// <- clears old warns/invalids and re-marks what still applies

		if(typeof showToast==='function'){ showToast('info','Regel borttagen','Färgvarningar uppdaterade.'); }
	}));


}

function personSelect(val,id,{excludeId=null}={}){
	const opts=['<option value="">- Välj person -</option>'].concat(
		DB.persons
			.filter(p=>p.factoryId===currentFactoryId)
			.filter(p=>excludeId==null || p.id!==excludeId || p.id===val)
			.map(p=>`<option value="${p.id}" ${p.id===val?'selected':''}>${escapeHtml(p.name)}</option>`)
	).join('');
	return `<select class="form-select form-select-sm" data-id="${id}">${opts}</select>`;
}

function editTraining(personId){
	const person = DB.persons.find(p => p.id === personId);
	const stations = DB.stations.filter(s => s.factoryId === currentFactoryId);
	const html = stations.map(s => {
		const has = DB.training.some(t => t.personId===personId && t.stationId===s.id);
		return `<div class="form-check">
			<input class="form-check-input" type="checkbox" id="t${s.id}" ${has?'checked':''} data-station-id="${s.id}">
			<label class="form-check-label" for="t${s.id}">${escapeHtml(s.title)}</label>
		</div>`;
	}).join('');

	// Build training modal
	const dlg=document.createElement('div');dlg.className='modal fade training-modal';
	dlg.innerHTML = `
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">Utbildning – ${escapeHtml(person.name)}</h5>
					<button class="btn-close" data-bs-dismiss="modal"></button>
				</div>
				<div class="modal-body">${html}</div>
				<div class="modal-footer">
					<button class="btn btn-secondary" data-bs-dismiss="modal">Stäng</button>
					<button class="btn btn-primary">Spara</button>
				</div>
			</div>
		</div>`;
	document.body.appendChild(dlg);

	// Find any currently open modal (e.g., #settingsModal) and dim it while training modal is open
	const parent = [...document.querySelectorAll('.modal.show')].find(m => m !== dlg) || null;
	if(parent) parent.classList.add('underlay');

	// Make the training modal hard-stacked: no backdrop click / no Esc
	const m = new bootstrap.Modal(dlg, { backdrop: 'static', keyboard: false });
	m.show();

	// Save handler
	dlg.querySelector('.btn-primary').addEventListener('click', () => {
		DB.training = DB.training.filter(t => t.personId !== personId);
		dlg.querySelectorAll('input[type="checkbox"]').forEach(ch => {
			if(ch.checked) DB.training.push({ personId, stationId: parseEntityId(ch.dataset.stationId) });
		});
		m.hide();
		dlg.addEventListener('hidden.bs.modal', () => dlg.remove());
		rebuildAll();
	});

	// Cleanup: restore parent modal visuals
	dlg.addEventListener('hidden.bs.modal', () => {
		if(parent) parent.classList.remove('underlay');
		dlg.remove();
	});
}


function showCoordLogin({onSuccess}={}){
	const saved=sessionStorage.getItem('planning.coord');
	if(saved==='ok'){
		if(typeof onSuccess==='function') onSuccess();
		return;
	}

	const el=document.getElementById('coordModal');
	const pwdEl=document.getElementById('coordPwd');
	const fbEl=document.getElementById('coordPwdFeedback');
	const btn=document.getElementById('coordLoginBtn');

	// Hard-lock the modal (no backdrop/Esc close)
	const m=new bootstrap.Modal(el,{backdrop:'static',keyboard:false});

	// Prevent close unless logged in (bind once per open by replacing previous handler)
	if(el._coordHideHandler){
		el.removeEventListener('hide.bs.modal', el._coordHideHandler);
	}
	el._coordHideHandler=(ev)=>{
		if(sessionStorage.getItem('planning.coord')!=='ok'){
			ev.preventDefault();
			if(typeof showToast==='function'){
				showToast('info','Inloggning krävs','Du måste logga in för att fortsätta.');
			}
		}
	};
	el.addEventListener('hide.bs.modal', el._coordHideHandler);

	// Clear invalid state when typing
	pwdEl.oninput=()=>{
		pwdEl.classList.remove('is-invalid');
	};

	// Focus when shown
	if(el._coordShownHandler){
		el.removeEventListener('shown.bs.modal', el._coordShownHandler);
	}
	el._coordShownHandler=()=>pwdEl.focus();
	el.addEventListener('shown.bs.modal', el._coordShownHandler);

	// Pretty error feedback
	function showPrettyError(msg){
		pwdEl.classList.add('is-invalid');
		if(fbEl) fbEl.textContent=msg||'Fel lösenord';
		const dlg=el.querySelector('.modal-dialog');
		if(dlg){
			dlg.classList.remove('shake'); // restart animation if repeated
			// force reflow
			void dlg.offsetWidth;
			dlg.classList.add('shake');
			dlg.addEventListener('animationend', ()=>dlg.classList.remove('shake'), {once:true});
		}
		if(typeof showToast==='function'){
			showToast('danger','Fel lösenord','Försök igen.');
		}
		pwdEl.select();
	}

	// Submit handler (button + Enter)
	async function doLogin(){
		if(btn.disabled) return;
		btn.disabled=true;
		const pwd=pwdEl.value;
		try{
			const ok=await verifyPassword(pwd);
			if(ok){
				sessionStorage.setItem('planning.coord','ok');
				m.hide();
				if(typeof onSuccess==='function') onSuccess();
			}else{
				showPrettyError('Fel lösenord');
			}
		}finally{
			btn.disabled=false;
		}
	}

	btn.onclick=doLogin;
	pwdEl.onkeydown=(e)=>{
		if(e.key==='Enter'){
			e.preventDefault();
			doLogin();
		}
	};

	m.show();
}


async function verifyPassword(pwd){
	const hash=await sha256(pwd);
	const stored=DB.appSettings.CoordinatorPasswordHash||hash;
	DB.appSettings.CoordinatorPasswordHash=stored;
	return hash===stored;
}

// Async confirm modal that dims/blur any open modal behind it
function showConfirm(opts={}){
	return new Promise(resolve=>{
		const modalEl=document.getElementById('confirmModal');
		modalEl.querySelector('[data-role="ttl"]').textContent=opts.title||'Bekräfta';
		modalEl.querySelector('[data-role="msg"]').textContent=opts.message||'Är du säker?';
		modalEl.querySelector('[data-role="sub"]').innerHTML=opts.sub||'';
		const okBtn=document.getElementById('confirmOkBtn');
		okBtn.textContent=opts.okText||'Ta bort';
		okBtn.className='btn ' + (opts.okClass||'btn-danger');

		// Dim/blur any already open modal(s)
		const underlays=[...document.querySelectorAll('.modal.show')].filter(m=>m!==modalEl);
		underlays.forEach(m=>m.classList.add('underlay'));

		const m=new bootstrap.Modal(modalEl,{backdrop:'static',keyboard:true});
		let confirmed=false;

		function onOk(){
			confirmed=true;
			m.hide(); // don't dispose here; wait for 'hidden'
		}
		function onKey(ev){
			if(ev.key==='Enter'){
				ev.preventDefault();
				onOk();
			}
		}
		function onHidden(){
			underlays.forEach(u=>u.classList.remove('underlay'));
			okBtn.removeEventListener('click',onOk);
			modalEl.removeEventListener('keydown',onKey);
			modalEl.removeEventListener('hidden.bs.modal',onHidden);
			m.dispose(); // safe now
			resolve(confirmed);
		}

		okBtn.addEventListener('click',onOk);
		modalEl.addEventListener('keydown',onKey);
		modalEl.addEventListener('hidden.bs.modal',onHidden,{once:true});

		m.show();
		setTimeout(()=>okBtn.focus(),120);
	});
}




function fitToViewport(){
	const scroller=document.getElementById('gridScroller');
	const scaler=document.getElementById('gridScaler');
	if(!scaler.firstChild) return;

	// measure grid width unscaled
	const grid=scaler.firstChild;
	scaler.style.transform='scale(1)';

	// exact width fit
	const needW=grid.scrollWidth||1;
	const availW=scroller.clientWidth||1;
	const scale=availW/needW;
	const inv=1/Math.max(scale,0.0001);

	// keep fonts/icons visually constant
	document.documentElement.style.setProperty('--font-comp',String(inv));
	document.documentElement.style.setProperty('--time-col-w',(65*inv)+'px');
	document.documentElement.style.setProperty('--hdr-group-h',(26*inv)+'px');
	document.documentElement.style.setProperty('--hdr-station-h',(34*inv)+'px');

	// exact row math: split the visible height across all rendered slots
	const slotCount=DB.timeSlots.filter(ts=>ts.factoryId===currentFactoryId&&ts.dayType===currentDayType).length||1;
	const headersVisible=26+34;		// px on screen

	const usableVisible=Math.max(0, scroller.clientHeight-(headersVisible));
	const rowVisible=usableVisible/slotCount;	// fractional px on screen

	document.documentElement.style.setProperty('--row-h', (rowVisible*inv)+'px');
	document.documentElement.style.setProperty('--row-extra', '0px');


	// apply transform
	scaler.style.transform=`scale(${scale})`;
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

// --- Personal tab cross-group DnD ---
let draggingPersonRowId = null;
let dragSourceGroupId=null;


function enablePersonCrossDrop(tbody, targetGroupId){
	let insertRow=null;

	function clearInsert(){
		if(insertRow){ insertRow.classList.remove('person-insert-before'); insertRow=null; }
	}

	tbody.addEventListener('dragover', ev=>{
		if(draggingPersonRowId==null) return;
		ev.preventDefault();

		// cross-group?
		const cross=(dragSourceGroupId!=null && targetGroupId!==dragSourceGroupId);

		// Show only the insertion line (no blue group outline)
		if(cross){
			const tr=ev.target.closest('tr');
			if(tr && tr.parentElement===tbody){
				if(insertRow && insertRow!==tr) insertRow.classList.remove('person-insert-before');
				insertRow=tr;
				insertRow.classList.add('person-insert-before');
			}else{
				if(insertRow) insertRow.classList.remove('person-insert-before');
				insertRow=null; // drop → end of list
			}
		}else{
			clearInsert(); // same-group: your row-reorder handles visuals
		}
	});

	tbody.addEventListener('dragleave', clearInsert);

	tbody.addEventListener('drop', ev=>{
		if(draggingPersonRowId==null) return;
		ev.preventDefault();

		const cross=(dragSourceGroupId!=null && targetGroupId!==dragSourceGroupId);

		let targetIndex;
		if(insertRow){
			targetIndex=[...tbody.querySelectorAll('tr')].indexOf(insertRow);
		}else{
			targetIndex=tbody.querySelectorAll('tr').length;
		}

		clearInsert();

		if(!cross) return; // same-group handled elsewhere
		movePersonToGroupAtIndex(draggingPersonRowId, dragSourceGroupId, targetGroupId, targetIndex);
	});
}




function enableRowDrag(tbody, onReorder){
	let dragId=null;
	tbody.querySelectorAll('tr').forEach(tr=>{
		tr.addEventListener('dragstart',ev=>{
			dragId=String(tr.dataset.id);	// <- keep full id
			ev.dataTransfer.effectAllowed='move';
			try{ ev.dataTransfer.setData('text/plain',''); }catch(e){}
		});
		tr.addEventListener('dragover',ev=>{
			ev.preventDefault();
			tr.classList.add('drag-over');
		});
		tr.addEventListener('dragleave',()=>{
			tr.classList.remove('drag-over');
		});
		tr.addEventListener('drop',ev=>{
			ev.preventDefault();
			tbody.querySelectorAll('tr').forEach(x=>x.classList.remove('drag-over'));

			const rows=[...tbody.querySelectorAll('tr')];
			const from=rows.findIndex(r=>String(r.dataset.id)===dragId);
			const to=rows.indexOf(tr);
			if(from===-1||to===-1||from===to) return;

			tbody.insertBefore(rows[from], (from<to)? tr.nextSibling : tr);

			const order=[...tbody.querySelectorAll('tr')].map(r=>String(r.dataset.id));
			onReorder(order);
		});
	});
}

function enableRowDragKeys(tbody,onReorder){
	let dragKey=null;
	tbody.querySelectorAll('tr').forEach(tr=>{
		tr.addEventListener('dragstart',ev=>{dragKey=tr.dataset.key;ev.dataTransfer.effectAllowed='move';});
		tr.addEventListener('dragover',ev=>{ev.preventDefault();tr.classList.add('drag-over');});
		tr.addEventListener('dragleave',()=>tr.classList.remove('drag-over'));
		tr.addEventListener('drop',ev=>{
			ev.preventDefault();
			tbody.querySelectorAll('tr').forEach(x=>x.classList.remove('drag-over'));
			const rows=[...tbody.querySelectorAll('tr')];
			const from=rows.findIndex(r=>r.dataset.key===dragKey);
			const to=rows.indexOf(tr);
			if(from===-1||to===-1||from===to) return;
			tbody.insertBefore(rows[from],(from<to)?tr.nextSibling:tr);
			const order=[...tbody.querySelectorAll('tr')].map(r=>r.dataset.key);
			onReorder(order);
		});
	});
}
function showWarn(msg){
	const a=document.getElementById('warnAlert');
	a.textContent=msg;
	a.classList.remove('d-none');
	setTimeout(()=>a.classList.add('d-none'),4000);
}

// Toasts
function showToast(kind, title, msg, opts={}){
	const area=document.getElementById('toastArea');
	if(!area) return;
	const icon = (kind==='danger') ? 'exclamation-octagon' : (kind==='warning' ? 'exclamation-triangle' : 'info-circle');

	const el=document.createElement('div');
	el.className=`toast app-toast toast-${kind}`;
	el.setAttribute('role','alert');
	el.setAttribute('aria-live','assertive');
	el.setAttribute('aria-atomic','true');
	el.innerHTML=
		`<div class="toast-header">
			<i class="bi bi-${icon} me-2"></i>
			<strong class="me-auto">${escapeHtml(title)}</strong>
			<button type="button" class="btn-close ms-2 mb-1" data-bs-dismiss="toast" aria-label="Close"></button>
		</div>
		<div class="toast-body">${msg}</div>`;
	area.appendChild(el);

	const t=new bootstrap.Toast(el,{delay:opts.delay??4500,autohide:true,animation:true});
	el.addEventListener('hidden.bs.toast',()=>el.remove());
	t.show();
}

// Explain *why* a placement is blocked (mirror of isPersonAllowedFor)
function explainNotAllowed(person, station, slot, opts={}){
	const reasons=[];
	if(!person){ reasons.push('Personen finns inte i aktivt personalurval.'); return reasons; }
	if(!person.present) reasons.push('Personen är frånvarande.');
	if(currentShift==='night' && currentDayType!==DayType.OvertimeDay && currentDayType!==DayType.Night && person.isNight){
		const cutoff=getNightCutoffFor(currentFactoryId,currentDate);
		if(timeLess(slot.start,cutoff)) reasons.push('Nattpersonal före arbetsstart.');
	}
	if(!station.isResurs){
		const trained=isPersonTrainedForStation(person.id, station.id);
		if(!trained) reasons.push('Ej utbildad för stationen.');
	}
	const dateStr=getSelectedDateStr();
	if(!opts.ignoreConflictForPersonId){
		if(DB.assignments.some(a=>a.date===dateStr && a.timeSlotId===slot.id && a.personId===person.id && a.dayType===currentDayType))
			reasons.push('Redan bokad denna tid.');
	}
	if(currentDayType===DayType.Night){
		if(DB.assignments.some(a=>a.date===dateStr && a.timeSlotId===slot.id && a.personId===person.id && a.dayType===DayType.Night))
			reasons.push('Redan bokad i nattpasset.');
	}
	return reasons;
}

// Context so we toast only for the *latest* move warnings
let _toastContextActive=false;
let _lastMovedPersonId=null;



// one-time, global delegated tooltips
new bootstrap.Tooltip(document.body, {
	selector: '[data-bs-toggle="tooltip"]',
	container: 'body',
	boundary: 'viewport'
});
