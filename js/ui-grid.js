// Schedule grid rendering, interactions, summary panels, and person pills.

const _pillVariantTransitionState = new WeakMap();
const _pillMarqueeState = new WeakMap();
let _toastContextActive=false;
let _lastMovedPersonId=null;

function getCssDurationMs(varName, fallbackMs){
	const raw=getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
	if(!raw) return fallbackMs;
	const value=Number.parseFloat(raw);
	if(!Number.isFinite(value)) return fallbackMs;
	if(raw.endsWith('ms')) return value;
	if(raw.endsWith('s')) return value*1000;
	return fallbackMs;
}

function completePersonPillVariantTransition(pill){
	if(!pill) return;
	const state=_pillVariantTransitionState.get(pill);
	if(state){
		pill.removeEventListener('transitionend', state.onTransitionEnd);
		if(state.timerId) window.clearTimeout(state.timerId);
		_pillVariantTransitionState.delete(pill);
	}
	pill.classList.remove('is-variant-transitioning');
	fitPersonPillLabel(pill);
}

function applyPersonPillDisplayVariant(pill,{variant=getPersonPillDisplayVariant(), animate=false}={}){
	if(!pill) return;
	const prevVariant=pill.dataset.pillVariant;
	pill.dataset.pillVariant=variant;
	pill.draggable=variant==='removable';
	const removeEl=pill.querySelector('.pill-remove');
	if(removeEl){
		const removable=variant==='removable';
		removeEl.setAttribute('aria-hidden', removable ? 'false' : 'true');
	}
	const shouldAnimate=animate && !!prevVariant && prevVariant!==variant;
	if(shouldAnimate){
		const priorState=_pillVariantTransitionState.get(pill);
		if(priorState){
			pill.removeEventListener('transitionend', priorState.onTransitionEnd);
			if(priorState.timerId) window.clearTimeout(priorState.timerId);
		}
		pill.classList.add('is-variant-transitioning');
		const onTransitionEnd=(ev)=>{
			if(!ev || !ev.target) return;
			if(ev.target!==pill && !ev.target.closest('.pill-remove, .pill-icon')) return;
			completePersonPillVariantTransition(pill);
		};
		pill.addEventListener('transitionend', onTransitionEnd);
		const transitionMs=getCssDurationMs('--mode-transition-fast-ms', 220);
		const timerId=window.setTimeout(()=>completePersonPillVariantTransition(pill), transitionMs+60);
		_pillVariantTransitionState.set(pill,{onTransitionEnd,timerId});
	}
	fitPersonPillLabel(pill);
}

function refreshPersonPillVariants({scope=document, animate=true}={}){
	const variant=canModifyAssignments() ? 'removable' : 'compact';
	scope.querySelectorAll('.person-pill').forEach(pill=>{
		applyPersonPillDisplayVariant(pill,{variant, animate});
	});
}

function refreshPersonPillDisplayVariants(scope=document){
	refreshPersonPillVariants({scope, animate:false});
}

let _pickerOpenCell=null;

function _isAnimIn(cell, kind){ return cell.dataset[`anim${kind}`]==='in'; }
function _setAnimIn(cell, kind, on){ if(on){ cell.dataset[`anim${kind}`]='in'; } else { delete cell.dataset[`anim${kind}`]; } }

function _stateTag(warn, invalid){
	if(warn && invalid) return 'both';
	if(warn) return 'warn';
	if(invalid) return 'invalid';
	return 'none';
}

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

function _stateClass(warn, invalid){
	if(warn && invalid) return 'both';
	if(warn) return 'warn';
	if(invalid) return 'invalid';
	return 'none';
}

function _makeFx(cell, kind){ // kind: 'fx-tint warn' | 'fx-tint invalid' | 'fx-lines both|warnonly|invalidonly'
	// remove any stale layers from previous animations
	cell.querySelectorAll(':scope > .fx-tint, :scope > .fx-lines').forEach(n=>n.remove());
	if(!kind) return null;
	const el=document.createElement('div');
	el.className=kind;
	cell.appendChild(el);
	return el;
}

function _linesIn(cell, onDone){
	const fx=_ensureFx(cell, 'fx-lines both');
	fx.classList.add('fx-in');
	fx.addEventListener('animationend', () => { fx.remove(); if(onDone) onDone(); }, { once:true });
}

function _linesOut(cell, onDone){
	const fx=_ensureFx(cell, 'fx-lines both');
	// start visible to represent current “both” lines
	fx.style.opacity='1';
	fx.classList.add('fx-out');
	fx.addEventListener('animationend', () => { fx.remove(); if(onDone) onDone(); }, { once:true });
}

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

function _setBase(cell, warn, invalid){
	cell.classList.toggle('warn', !!warn);
	cell.classList.toggle('invalid', !!invalid);
}

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

function applyHoverHighlightForCell(cell){
	if(!cell || !document.contains(cell)) return;
	const stationId=cell.dataset.stationId;
	const slotId=cell.dataset.slotId;
	if(!stationId || !slotId) return;
	const grid=cell.closest('.schedule-grid');
	if(!grid) return;
	cell.classList.add('cell-hovered');
	grid.querySelector(`.time-cell[data-slot-id="${CSS.escape(String(slotId))}"]`)?.classList.add('cell-hover-time');
	grid.querySelector(`.station-header[data-station-id="${escapeDataId(stationId)}"]`)?.classList.add('station-hover');
}

function closeAnyPicker({preserveHoverCell=null}={}){
	document.querySelectorAll('.picker-overlay').forEach(el=>el.remove());
	document.querySelectorAll('.cell.picker-target').forEach(el=>{
		el.classList.remove('picker-target');
		el.removeAttribute('data-picker-open');
	});
	document.querySelectorAll('.cell-hovered, .cell-hover-time, .station-hover').forEach(el=>{
		el.classList.remove('cell-hovered','cell-hover-time','station-hover');
	});
	_pickerOpenCell=null;
	document.removeEventListener('keydown', _onPickerKeydown, true);
	if(preserveHoverCell) applyHoverHighlightForCell(preserveHoverCell);
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
		showToast(
			'info',
			'Flyttad',
			`<b>${escapeHtml(p.name)}</b> flyttades från grupp <b>${escapeHtml(srcName)}</b> till grupp <b>${escapeHtml(tgtName)}</b>`,
			{html:true}
		);
	}
}

function getNormalizedGroupOrder(factoryId){
	const groupIds = DB.groups.filter(g=>g.factoryId===factoryId).map(g=>g.id);
	const groupIdSet = new Set(groupIds);
	const hasResursStation = DB.stations.some(s=>s.factoryId===factoryId && isLegacyResursStation(s));
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

function isResursGroup(group){return !!(group && group.isResursGroup);}
function isResursGroupId(groupId){return isResursGroup(DB.groups.find(g=>g.id===groupId));}
function isLegacyResursStation(station){return !!(station && station.isResurs && (station.groupId===undefined || station.groupId===null));}
function isResursOrderToken(tok){return tok==='resurs' || isResursGroupId(tok);}
function getResursStationForToken(factoryId, tok){
	if(tok==='resurs') return DB.stations.find(s=>s.factoryId===factoryId && isLegacyResursStation(s));
	if(isResursGroupId(tok)) return DB.stations.find(s=>s.factoryId===factoryId && s.isResurs && s.groupId===tok);
	return null;
}
function getResursStations(factoryId=currentFactoryId){
	return getNormalizedGroupOrder(factoryId)
		.filter(tok=>isResursOrderToken(tok))
		.map(tok=>getResursStationForToken(factoryId,tok))
		.filter(Boolean);
}
function isNormalGroupStation(station){return !!(station && !isLegacyResursStation(station) && !isResursGroupId(station.groupId));}
function orderedColumns(){const order=getNormalizedGroupOrder(currentFactoryId);const resurs=DB.stations.find(s=>s.factoryId===currentFactoryId&&isLegacyResursStation(s));const grouped=groupBy(DB.stations.filter(s=>s.factoryId===currentFactoryId&&isNormalGroupStation(s)),'groupId');return {order,resurs,grouped};}

function rebuildAll(){
	return runMeasured('rebuildAll', ()=>{
		buildGrid();
		setupTooltips();
		fitToViewport();
		renderSummaryPanel();
		renderDerivedReport();
		window.addEventListener('resize', fitToViewport);
	});
}

function clearSummaryHighlights(){
	document.querySelectorAll('.cell.summary-highlight').forEach(c=>c.classList.remove('summary-highlight'));
}

function hideSummaryInfoTooltip(){
	const btn=document.getElementById('summaryInfoBtn');
	if(!btn) return;
	bootstrap.Tooltip.getInstance(btn)?.hide();
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
	let totals={required:0,assigned:0,capacityCells:0,trainingCells:0,compatibilityCells:0,absentCells:0,absentAssignments:0,affectedCells:0};
	for(const slot of slots){
		for(const station of stationById.values()){
			const required=slot.type==='Work' ? (station.defaultCapacity||1) : 0;
			const people=(byCell.get(`${station.id}:${slot.id}`)||[]);
			const assigned=people.length;
			const untrainedAssigned=people.filter(pid=>!isPersonTrainedForStation(pid, station.id)).length;
			const absentAssigned=people.filter(pid=>{
				const person=getPlanningPersonById(pid, currentFactoryId);
				return !!person && !person.present;
			}).length;
			let conflicts=0;
			for(let i=0;i<people.length;i++){
				for(let j=i+1;j<people.length;j++){
					if(isIncompatible(people[i], people[j])) conflicts++;
				}
			}
			const capacityIssue=assigned!==required;
			const trainingIssue=assigned>0 && untrainedAssigned>0;
			const compatibilityIssue=conflicts>0;
			const absentIssue=absentAssigned>0;
			const hasIssue=capacityIssue||trainingIssue||compatibilityIssue||absentIssue;
			const row={slotId:String(slot.id),slotLabel:`${slot.start}–${slot.end}`,stationId:String(station.id),stationTitle:station.title,required,assigned,untrainedAssigned,absentAssigned,compatibilityConflicts:conflicts,capacityIssue,trainingIssue,compatibilityIssue,absentIssue,hasIssue};
			details.push(row);
			if(!hasIssue) continue;
			totals.affectedCells++;
			if(capacityIssue) totals.capacityCells++;
			if(trainingIssue) totals.trainingCells++;
			if(compatibilityIssue) totals.compatibilityCells++;
			if(absentIssue) totals.absentCells++;
			if(absentAssigned>0) totals.absentAssignments+=absentAssigned;
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
		if(metric==='presence') return r.absentIssue;
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

function scheduleSummaryWarningRefit(durationMs=320){
	const now=performance.now();
	summaryWarningRefitUntil=Math.max(summaryWarningRefitUntil, now+durationMs);
	if(summaryWarningRefitRafId) return;
	const tick=(ts)=>{
		fitToViewport();
		if(ts<summaryWarningRefitUntil){
			summaryWarningRefitRafId=requestAnimationFrame(tick);
			return;
		}
		summaryWarningRefitRafId=0;
		summaryWarningRefitUntil=0;
	};
	summaryWarningRefitRafId=requestAnimationFrame(tick);
}

function renderSummaryPanel(){
	return runMeasured('renderSummaryPanel', ()=>{
	const warnBox=document.getElementById('summaryWarning');
	const warnText=document.getElementById('summaryWarningText');
	if(!warnBox) return;
	const shouldHideForMode=mode!=='edit';
	const wasCollapsed=warnBox.classList.contains('is-collapsed');
	if(shouldHideForMode){
		warnBox.classList.toggle('is-collapsed', true);
		if(!wasCollapsed) scheduleSummaryWarningRefit();
		clearSummaryHighlights();
		hideSummaryInfoTooltip();
		return;
	}
	summaryData=computeSummaryMetrics();
	const filterBar=document.getElementById('summaryFilterBar');
	const totals=summaryData.totals;
	const shouldHide=totals.affectedCells===0;
	warnBox.classList.toggle('is-collapsed', shouldHide);
	const isCollapsed=warnBox.classList.contains('is-collapsed');
	if(wasCollapsed!==isCollapsed) scheduleSummaryWarningRefit();
	if(shouldHide){
		clearSummaryHighlights();
		hideSummaryInfoTooltip();
		return;
	}
	const hasPresenceErrors=totals.absentAssignments>0;
	warnBox.classList.toggle('alert-danger', hasPresenceErrors);
	warnBox.classList.toggle('alert-warning', !hasPresenceErrors);
	if(warnText){
		const unit=totals.affectedCells===1?'varning':'varningar';
		const baseText=`${totals.affectedCells} ${unit} i planeringen - Kapacitet ${totals.assigned}/${totals.required} tilldelade.`;
		if(hasPresenceErrors){
			const errUnit=totals.absentAssignments===1 ? 'frånvarande person är placerad' : 'frånvarande personer är placerade';
			warnText.textContent=`Fel: ${totals.absentAssignments} ${errUnit}. ${baseText}`;
		}else{
			warnText.textContent=baseText;
		}
	}
	const btns=[{metric:'all',label:`Alla (${totals.affectedCells})`,cls:'btn-outline-secondary'}];
	if(totals.capacityCells>0) btns.push({metric:'capacity',label:`Kapacitet (${totals.capacityCells})`,cls:'btn-outline-danger'});
	if(totals.trainingCells>0) btns.push({metric:'training',label:`Utbildning (${totals.trainingCells})`,cls:'btn-outline-warning'});
	if(totals.compatibilityCells>0) btns.push({metric:'compatibility',label:`Kompatibilitet (${totals.compatibilityCells})`,cls:'btn-outline-info'});
	if(totals.absentCells>0) btns.push({metric:'presence',label:`Frånvarande (${totals.absentCells})`,cls:'btn-outline-danger'});
	filterBar.innerHTML=btns.map(x=>`<button type="button" class="btn btn-sm ${x.cls} summary-filter-btn" data-metric="${x.metric}">${x.label}</button>`).join('');
	filterBar.querySelectorAll('.summary-filter-btn').forEach(btn=>{
		btn.addEventListener('click',()=>applySummaryFilter(btn.dataset.metric));
	});
	if(activeSummaryFilter!=='all' && !btns.some(b=>b.metric===activeSummaryFilter)) activeSummaryFilter='all';
	applySummaryFilter(activeSummaryFilter);
	});
}

function computeDerivedReportMetrics(){
	const dateStr=getSelectedDateStr();
	const slots=DB.timeSlots
		.filter(ts=>ts.factoryId===currentFactoryId&&ts.dayType===currentDayType&&ts.type==='Work')
		.sort((a,b)=>a.sort-b.sort);
	const stations=DB.stations.filter(s=>s.factoryId===currentFactoryId&&s.operational!==false);
	const groupsById=new Map(DB.groups.filter(g=>g.factoryId===currentFactoryId).map(g=>[String(g.id),g]));
	const totalWorkSlots=slots.length;
	const assignments=DB.assignments.filter(a=>a.date===dateStr&&a.factoryId===currentFactoryId&&a.dayType===currentDayType);
	const stationById=new Map(stations.map(s=>[String(s.id),s]));
	const slotById=new Map(slots.map(s=>[String(s.id),s]));
	const trainingSet=new Set((DB.training||[]).map(t=>`${t.personId}:${t.stationId}`));

	const byStationSlot=new Map();
	for(const row of assignments){
		if(!stationById.has(String(row.stationId))) continue;
		const key=`${row.stationId}:${row.timeSlotId}`;
		const arr=byStationSlot.get(key)||[];
		arr.push(row.personId);
		byStationSlot.set(key,arr);
	}

	const stationStats=[];
	let totalRequired=0;
	let totalAssigned=0;
	let untrainedAssignments=0;
	let understaffedCellCount=0;
	for(const station of stations){
		let stationRequired=0;
		let stationAssigned=0;
		let stationUntrained=0;
		let understaffedSlots=0;
		for(const slot of slots){
			const required=Math.max(0, Number(station.defaultCapacity||0));
			const people=byStationSlot.get(`${station.id}:${slot.id}`)||[];
			const assigned=people.length;
			const untrained=people.filter(pid=>!trainingSet.has(`${pid}:${station.id}`)).length;
			stationRequired+=required;
			stationAssigned+=assigned;
			stationUntrained+=untrained;
			if(assigned<required){
				understaffedSlots++;
				understaffedCellCount++;
			}
		}
		totalRequired+=stationRequired;
		totalAssigned+=stationAssigned;
		untrainedAssignments+=stationUntrained;
		if(stationRequired>0 || stationAssigned>0){
			stationStats.push({
				stationId:String(station.id),
				stationTitle:station.title,
				groupTitle:groupsById.get(String(station.groupId))?.title || 'Övrigt',
				required:stationRequired,
				assigned:stationAssigned,
				untrained:stationUntrained,
				understaffedSlots,
				totalWorkSlots,
				coveragePct:stationRequired>0 ? (stationAssigned/stationRequired)*100 : 0
			});
		}
	}

	let conflictCount=0;
	const conflictDetails=[];

	for(const slot of slots){
		for(const station of stations){
			const people=(byStationSlot.get(`${station.id}:${slot.id}`)||[]);
			for(let i=0;i<people.length;i++){
				for(let j=i+1;j<people.length;j++){
					if(!isIncompatible(people[i], people[j])) continue;
					const personA=getPlanningPersonById(people[i], currentFactoryId)?.name || `Person ${people[i]}`;
					const personB=getPlanningPersonById(people[j], currentFactoryId)?.name || `Person ${people[j]}`;
					conflictCount++;
					conflictDetails.push({
						type:'Samarbetsregel',
						slotLabel:`${slot.start}–${slot.end}`,
						stationTitle:station.title,
						detail:`${personA} + ${personB}`
					});
				}
			}
		}
	}

	const byPersonStation=new Map();
	const assignmentsByPerson=new Map();
	for(const row of assignments){
		if(!slotById.has(String(row.timeSlotId))) continue;
		assignmentsByPerson.set(String(row.personId),(assignmentsByPerson.get(String(row.personId))||0)+1);
		const key=`${row.personId}:${row.stationId}`;
		const arr=byPersonStation.get(key)||[];
		arr.push(row);
		byPersonStation.set(key,arr);
	}
	const consecutiveByPerson=new Map();
	for(const rows of byPersonStation.values()){
		rows.sort((a,b)=>(slotById.get(String(a.timeSlotId))?.sort||0)-(slotById.get(String(b.timeSlotId))?.sort||0));
		for(let i=1;i<rows.length;i++){
			const prev=slotById.get(String(rows[i-1].timeSlotId));
			const cur=slotById.get(String(rows[i].timeSlotId));
			if(!prev || !cur || cur.sort!==prev.sort+1) continue;
			const personName=getPlanningPersonById(rows[i].personId, currentFactoryId)?.name || `Person ${rows[i].personId}`;
			const stationTitle=stationById.get(String(rows[i].stationId))?.title || String(rows[i].stationId);
			const personKey=String(rows[i].personId);
			consecutiveByPerson.set(personKey,(consecutiveByPerson.get(personKey)||0)+1);
			conflictCount++;
			conflictDetails.push({
				type:'Samma station i rad',
				slotLabel:`${prev.start}–${prev.end} → ${cur.start}–${cur.end}`,
				stationTitle,
				detail:personName
			});
		}
	}

	const coveragePct=totalRequired>0 ? (totalAssigned/totalRequired)*100 : 0;
	const understaffedStations=stationStats.filter(s=>s.understaffedSlots>0).length;
	const workloadStats=getPlanningPersons(currentFactoryId)
		.filter(p=>p.factoryId===currentFactoryId && p.present)
		.map(person=>{
			const personId=String(person.id);
			const assignedCount=assignmentsByPerson.get(personId)||0;
			const consecutiveCount=consecutiveByPerson.get(personId)||0;
			const groupTitle=groupsById.get(String(person.groupId))?.title || 'Övrigt';
			return {
				personId,
				personName:person.name,
				groupTitle,
				assignedCount,
				consecutiveCount,
				totalWorkSlots
			};
		});
	const assignmentCounts=workloadStats.map(p=>p.assignedCount);
	const maxAssignments=assignmentCounts.length>0 ? Math.max(...assignmentCounts) : 0;
	const minAssignments=assignmentCounts.length>0 ? Math.min(...assignmentCounts) : 0;
	const loadSpread=maxAssignments-minAssignments;
	const meanAssignments=assignmentCounts.length>0 ? assignmentCounts.reduce((sum,val)=>sum+val,0)/assignmentCounts.length : 0;
	const variance=assignmentCounts.length>0 ? assignmentCounts.reduce((sum,val)=>sum+Math.pow(val-meanAssignments,2),0)/assignmentCounts.length : 0;
	const stdDev=Math.sqrt(variance);
	const topLoaded=workloadStats
		.filter(p=>p.assignedCount>0)
		.sort((a,b)=>b.assignedCount-a.assignedCount||a.personName.localeCompare(b.personName,'sv'))
		.slice(0,3);
	const lowLoaded=workloadStats
		.slice()
		.sort((a,b)=>a.assignedCount-b.assignedCount||a.personName.localeCompare(b.personName,'sv'))
		.slice(0,3);
	workloadStats.sort((a,b)=>b.assignedCount-a.assignedCount||b.consecutiveCount-a.consecutiveCount||a.personName.localeCompare(b.personName,'sv'));
	stationStats.sort((a,b)=>a.coveragePct-b.coveragePct||a.stationTitle.localeCompare(b.stationTitle,'sv'));
	conflictDetails.sort((a,b)=>a.type.localeCompare(b.type,'sv')||a.stationTitle.localeCompare(b.stationTitle,'sv'));

	return {
		context:{dateStr,factoryId:currentFactoryId,dayType:currentDayType},
		totals:{coveragePct,totalRequired,totalAssigned,untrainedAssignments,understaffedStations,understaffedCellCount,conflictCount,loadSpread,stdDev},
		stationStats,
		conflictDetails,
		workload:{workloadStats,topLoaded,lowLoaded,maxAssignments,minAssignments,meanAssignments,totalWorkSlots}
	};
}

function renderDerivedReport(){
	return runMeasured('renderDerivedReport', ()=>{
	const coverageEl=document.getElementById('reportCoveragePct');
	if(!coverageEl) return;
	const report=computeDerivedReportMetrics();
	const totals=report.totals;
	const fmtPct=(n)=>`${Math.round((Number(n)||0)*10)/10}%`;
	const imbalanceThreshold=Math.max(1, report.workload.meanAssignments*0.5);
	coverageEl.textContent=fmtPct(totals.coveragePct);
	document.getElementById('reportCoverageSub').textContent=`${totals.totalAssigned}/${totals.totalRequired} tilldelade`;
	document.getElementById('reportUntrainedCount').textContent=String(totals.untrainedAssignments);
	document.getElementById('reportUnderstaffedCount').textContent=String(totals.understaffedStations);
	document.getElementById('reportConflictCount').textContent=String(totals.conflictCount);
	document.getElementById('reportLoadSpread').textContent=String(totals.loadSpread||0);
	document.getElementById('reportLoadStdDev').textContent=(Number(totals.stdDev||0)).toLocaleString('sv-SE',{minimumFractionDigits:2,maximumFractionDigits:2});
	const renderLoadBadges=(rows,emptyText)=>rows.length>0
		? rows.map(p=>`<span class="badge rounded-pill text-bg-light report-load-badge">${escapeHtml(p.personName)} <span class="text-muted">${p.assignedCount}/${report.workload.totalWorkSlots}</span></span>`).join(' ')
		: escapeHtml(emptyText);
	document.getElementById('reportTopLoaded').innerHTML=renderLoadBadges(report.workload.topLoaded,'Inga tilldelningar');
	document.getElementById('reportLowLoaded').innerHTML=renderLoadBadges(report.workload.lowLoaded,'Ingen närvarande personal');
	document.getElementById('reportContextText').textContent=`Datum ${report.context.dateStr} · ${getCurrentFactoryTitle()} · ${labelFor(report.context.dayType)}`;

	const stationBody=document.getElementById('reportStationRows');
	if(stationBody){
		if(report.stationStats.length===0){
			stationBody.innerHTML='<tr><td colspan="7" class="text-muted small">Ingen stationdata för aktuell vy.</td></tr>';
		}else{
			stationBody.innerHTML=report.stationStats.map(s=>`<tr class="${s.understaffedSlots>0?'report-row-warning':''}"><td class="text-muted small">${escapeHtml(s.groupTitle)}</td><td>${escapeHtml(s.stationTitle)}</td><td class="text-end">${fmtPct(s.coveragePct)}</td><td class="text-end">${s.assigned}/${s.required}</td><td class="text-end">${s.untrained}</td><td class="text-end">${s.understaffedSlots}/${s.totalWorkSlots}</td><td class="text-end">${s.understaffedSlots>0?'<span class="badge text-bg-warning">Åtgärda</span>':'<span class="badge text-bg-success">OK</span>'}</td></tr>`).join('');
		}
	}

	const conflictBody=document.getElementById('reportConflictRows');
	if(conflictBody){
		if(report.conflictDetails.length===0){
			conflictBody.innerHTML='<tr><td colspan="4" class="text-muted small">Inga konflikter hittades.</td></tr>';
		}else{
			conflictBody.innerHTML=report.conflictDetails.map(c=>`<tr><td>${escapeHtml(c.type)}</td><td>${escapeHtml(c.slotLabel)}</td><td>${escapeHtml(c.stationTitle)}</td><td>${escapeHtml(c.detail)}</td></tr>`).join('');
		}
	}
	const workloadBody=document.getElementById('reportWorkloadRows');
	if(workloadBody){
		if(report.workload.workloadStats.length===0){
			workloadBody.innerHTML='<tr><td colspan="7" class="text-muted small">Ingen närvarande personal i aktuell fabrik.</td></tr>';
		}else{
			const assignedTotal=Math.max(1, report.workload.workloadStats.reduce((sum,p)=>sum+p.assignedCount,0));
			workloadBody.innerHTML=report.workload.workloadStats.map(p=>{
				const share=((p.assignedCount/assignedTotal)*100);
				const deviation=p.assignedCount-report.workload.meanAssignments;
				let status='<span class="badge text-bg-success">Balanserad</span>';
				let rowClass='';
				if(p.assignedCount<report.workload.totalWorkSlots){
					status='<span class="badge text-bg-info">Låg belastning</span>';
					rowClass=p.assignedCount===0?'report-row-muted':'report-row-low';
				}else if(p.assignedCount>report.workload.totalWorkSlots){
					status='<span class="badge text-bg-primary">Hög belastning</span>';
					rowClass='report-row-high';
				}else if(p.consecutiveCount>0){
					status='<span class="badge text-bg-warning">Observera</span>';
					rowClass='report-row-warning';
				}
				const deviationText=deviation===0 ? '±0' : `${deviation>0?'+':''}${(Math.round(deviation*10)/10).toLocaleString('sv-SE')}`;
				return `<tr class="${rowClass}"><td class="text-muted small">${escapeHtml(p.groupTitle)}</td><td>${escapeHtml(p.personName)}</td><td class="text-end">${p.assignedCount}/${p.totalWorkSlots}</td><td class="text-end">${fmtPct(share)}</td><td class="text-end">${deviationText}</td><td class="text-end">${p.consecutiveCount}</td><td>${status}</td></tr>`;
			}).join('');
		}
	}
	const balanceMeta=document.getElementById('reportBalanceMeta');
	if(balanceMeta){
		balanceMeta.innerHTML=`<div>Min tilldelning: <strong>${report.workload.minAssignments}/${report.workload.totalWorkSlots}</strong></div><div>Max tilldelning: <strong>${report.workload.maxAssignments}/${report.workload.totalWorkSlots}</strong></div><div>Genomsnitt: <strong>${report.workload.meanAssignments.toLocaleString('sv-SE',{minimumFractionDigits:1,maximumFractionDigits:1})}</strong></div><div>Standardavvikelse: <strong>${report.totals.stdDev.toLocaleString('sv-SE',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div><div>Spridning: <strong>${report.totals.loadSpread}</strong></div><div class="text-muted mt-2">Låg belastning markeras när en närvarande person inte är tilldelad alla arbetspass. Hög belastning markeras om personen har fler tilldelningar än antal arbetspass.</div>`;
	}
	});
}

function buildGrid(){
	const scaler=document.getElementById('gridScaler');
	scaler.innerHTML='';
	document.getElementById('warnAlert').classList.add('d-none');
	const groups=DB.groups.filter(g=>g.factoryId===currentFactoryId);
	const {order,resurs,grouped}=orderedColumns();
	const slots=DB.timeSlots.filter(ts=>ts.factoryId===currentFactoryId&&ts.dayType===currentDayType).sort((a,b)=>a.sort-b.sort);
	const autoGenerateUnassignedBySlot=getAutoGenerateUnassignedBySlot();
	let cols=['var(--time-col-w)'];
	order.forEach(tok=>{
		if(isResursOrderToken(tok)){
			if(getResursStationForToken(currentFactoryId,tok))cols.push('var(--grid-min-col)');
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
		if(isResursOrderToken(tok)){
			if(getResursStationForToken(currentFactoryId,tok)){
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
		if(isResursOrderToken(tok)){
			const resursStation=getResursStationForToken(currentFactoryId,tok);
			if(resursStation){
				const sh=cellDiv('station-header');
				sh.classList.add('resurs-col');
				sh.dataset.stationId=resursStation.id;
				sh.textContent=resursStation.title;
				grid.appendChild(sh);
			}
			continue;
		}
		const sts=(grouped[tok]||[]).sort((a,b)=>a.sort-b.sort);
		for(const s of sts){
			const sh=cellDiv('station-header');
			if(s.isResurs) sh.classList.add('resurs-col');
			sh.dataset.stationId=s.id;
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
		const missingNames=autoGenerateUnassignedBySlot?.get(String(slot.id))||[];
		if(missingNames.length>0){
			const indicator=document.createElement('span');
			indicator.className='slot-unassigned-indicator';
			indicator.setAttribute('data-bs-toggle','tooltip');
			indicator.setAttribute('data-bs-title', formatUnassignedTooltipText(missingNames));
			indicator.setAttribute('data-bs-html','false');
			indicator.innerHTML='<i class="bi bi-person-exclamation" aria-hidden="true"></i><span class="visually-hidden">Ej tilldelade personer</span>';
			timeCell.appendChild(indicator);
		}
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
			if(isResursOrderToken(tok)){
				const resursStation=getResursStationForToken(currentFactoryId,tok);
				if(resursStation)addStationCell(resursStation);
			}else{
				const sts=(grouped[tok]||[]).sort((a,b)=>a.sort-b.sort);
				for(const s of sts)addStationCell(s);
			}
		}
	}
	scaler.appendChild(grid);
	bindGridHoverHighlights(grid);
	requestAnimationFrame(fitToViewport);
	renderAssignments();
	refreshAutoGenerateWarnings();
	if(shouldValidateBoardForMode()) validateBoard();


}

function bindGridHoverHighlights(grid){
	let activeCell=null;
	const clearVisualState=()=>{
		grid.querySelectorAll('.cell-hovered, .cell-hover-time, .station-hover').forEach(el=>{
			el.classList.remove('cell-hovered','cell-hover-time','station-hover');
		});
	};
	const getLockedCell=()=>{
		if(!_pickerOpenCell || !grid.contains(_pickerOpenCell)) return null;
		return _pickerOpenCell;
	};
	const clear=()=>{
		const lockedCell=getLockedCell();
		if(lockedCell){
			apply(lockedCell);
			return;
		}
		clearVisualState();
		activeCell=null;
	};

	const apply=(cell)=>{
		const stationId=cell.dataset.stationId;
		const slotId=cell.dataset.slotId;
		if(!stationId || !slotId) return;
		clearVisualState();
		activeCell=cell;
		cell.classList.add('cell-hovered');
		grid.querySelector(`.time-cell[data-slot-id="${CSS.escape(String(slotId))}"]`)?.classList.add('cell-hover-time');
		grid.querySelector(`.station-header[data-station-id="${escapeDataId(stationId)}"]`)?.classList.add('station-hover');
	};

	grid.addEventListener('pointerover', ev=>{
		if(getLockedCell()) return;
		const cell=ev.target.closest('.cell[data-station-id][data-slot-id]');
		if(!cell || !grid.contains(cell) || cell===activeCell) return;
		apply(cell);
	});

	grid.addEventListener('pointerleave', clear);
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
		closeAnyPicker({preserveHoverCell:cell});
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
		if(ev.target!==overlay) return;
		const cellRect=cell.getBoundingClientRect();
		const clickedOnTargetCell=
			ev.clientX>=cellRect.left &&
			ev.clientX<=cellRect.right &&
			ev.clientY>=cellRect.top &&
			ev.clientY<=cellRect.bottom;
		closeAnyPicker(clickedOnTargetCell ? {preserveHoverCell:cell} : undefined);
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
	const maxPickerRows=20;

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
	const optionCount=sel.querySelectorAll('option').length;
	const groupCount=sel.querySelectorAll('optgroup').length;
	// Include group headers in the visible row count so short grouped lists don't get an inner scrollbar.
	const visibleRowsNeeded=optionCount+groupCount;
	sel.size=Math.max(1, Math.min(maxPickerRows, visibleRowsNeeded));
	// Ensure nothing is pre-selected so clicking the first item also triggers "change".
	sel.selectedIndex=-1;

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

	let closed=false;
	let onDocDownAttached=false;
	const onDocDown=ev=>{
		if(!overlay.contains(ev.target)){
			cleanup();
		}
	};

	// outside click closes (mousedown so it beats focus changes)
	setTimeout(()=>{
		if(closed) return;
		document.addEventListener('mousedown', onDocDown);
		onDocDownAttached=true;
	},0);

	// global Esc also closes
	document.addEventListener('keydown', _onPickerKeydown, true);

	function cleanup(){
		if(closed) return;
		closed=true;
		window.removeEventListener('resize', position);
		if(onDocDownAttached){
			document.removeEventListener('mousedown', onDocDown);
			onDocDownAttached=false;
		}
		document.removeEventListener('keydown', _onPickerKeydown, true);
		cell.classList.remove('picker-target');
		cell.removeAttribute('data-picker-open');
		_pickerOpenCell=null;
		overlay.remove();
	}
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

	withAssignmentHistoryAction('Flytta person', ()=>{
		// Move semantics: remove existing assignment/pill for this person in this slot
		const removed=removeAssignmentsWhere(a =>
			(a.date===dateStr && a.personId===personId && String(a.timeSlotId)===String(slot.id) && a.dayType===currentDayType)
		);
		document.querySelectorAll(
			`.cell[data-slot-id="${CSS.escape(String(slot.id))}"] .person-pill[data-person-id="${escapeDataId(personId)}"]`
		).forEach(el => { if(typeof killPillTooltip==='function') killPillTooltip(el); el.remove(); });

		// Enable per-move warning toasts
		_toastContextActive = true;
		_lastMovedPersonId = personId;

		placePerson(cell, station, slot, personId, {captureHistory:false, extraRemoved:removed});

		// If we used the training override, inform user (pill already gets orange border)
		if(overrideOk){
			const stTitle = DB.stations.find(s => s.id === station.id)?.title || 'station';
			showToast('warning', 'Under utbildning', `Personen saknar utbildning för ${stTitle}. Placeringen tillåts men markeras.`);
		}

		_toastContextActive = false;
		_lastMovedPersonId = null;
	});
}

function placePerson(cell,station,slot,personId,{captureHistory=true, extraRemoved=[]}={}){
	const applyPlacement=()=>{
		addPersonPill(cell,personId);
		const dateStr=getSelectedDateStr();
		const added=addAssignmentRow({date:dateStr,factoryId:currentFactoryId,dayType:currentDayType,timeSlotId:slot.id,groupId:station.groupId||null,stationId:station.id,personId});
		refreshAutoGenerateWarnings();
		validateChangedCells(createAssignmentInvalidationSetFromDiff({added:[added], removed:extraRemoved}));
	};
	if(!captureHistory || assignmentHistoryBatch || assignmentHistoryIsReplaying){
		applyPlacement();
		return;
	}
	withAssignmentHistoryAction('Placera person', applyPlacement);
}

function measurePillTextWidth(sampleEl, text){
	if(!sampleEl) return 0;
	const probe = document.createElement('span');
	const cs = getComputedStyle(sampleEl);
	probe.style.position = 'fixed';
	probe.style.left = '-99999px';
	probe.style.top = '0';
	probe.style.visibility = 'hidden';
	probe.style.whiteSpace = 'nowrap';
	probe.style.font = cs.font;
	probe.style.letterSpacing = cs.letterSpacing;
	probe.style.fontWeight = cs.fontWeight;
	probe.style.fontKerning = cs.fontKerning;
	probe.textContent = text;
	document.body.appendChild(probe);
	const w = probe.getBoundingClientRect().width;
	probe.remove();
	return w;
}

function parseTranslateX(transformValue){
	if(!transformValue || transformValue==='none') return 0;
	const m2d = transformValue.match(/^matrix\((.+)\)$/);
	if(m2d){
		const parts = m2d[1].split(',').map(v=>Number.parseFloat(v.trim()));
		return Number.isFinite(parts[4]) ? parts[4] : 0;
	}
	const m3d = transformValue.match(/^matrix3d\((.+)\)$/);
	if(m3d){
		const parts = m3d[1].split(',').map(v=>Number.parseFloat(v.trim()));
		return Number.isFinite(parts[12]) ? parts[12] : 0;
	}
	return 0;
}

function isPillMarqueeDebugEnabled(){
	return localStorage.getItem('planning.debugPillMarquee') === '1';
}

function splitNameWithSingleLetterSuffix(name){
	const cleaned = String(name ?? '').trim();
	if(!cleaned) return null;
	const m = cleaned.match(/^(.*\S)\s+(\S+)$/u);
	if(!m) return null;
	const base = m[1].trim();
	const suffixToken = m[2];
	if(Array.from(suffixToken).length!==1) return null;
	return { base, suffix:suffixToken };
}

function elementTextFitsWidth(el, text, maxWidthPx){
	if(!el) return false;
	el.textContent = text;
	return el.scrollWidth <= maxWidthPx;
}

function formatSuffixCompactNameForElement(rawName, maxWidthPx, staticEl){
	const name = String(rawName ?? '').trim();
	if(!name) return '';
	if(!staticEl || !Number.isFinite(maxWidthPx) || maxWidthPx<=0) return name;
	const parts = splitNameWithSingleLetterSuffix(name);
	if(!parts) return name;
	if(elementTextFitsWidth(staticEl, name, maxWidthPx)) return name;
	const { base, suffix } = parts;
	if(!elementTextFitsWidth(staticEl, `...${suffix}`, maxWidthPx)){
		if(elementTextFitsWidth(staticEl, suffix, maxWidthPx)) return suffix;
		return '';
	}
	let lo = 0;
	let hi = base.length;
	let best = `...${suffix}`;
	while(lo<=hi){
		const mid = Math.floor((lo+hi)/2);
		const candidate = `${base.slice(0, mid)}...${suffix}`;
		if(elementTextFitsWidth(staticEl, candidate, maxWidthPx)){
			best = candidate;
			lo = mid + 1;
		}else{
			hi = mid - 1;
		}
	}
	return best;
}

function formatPersonNameForPill(rawName, maxWidthPx, sampleEl){
	const name = String(rawName ?? '').trim();
	if(!name) return '';
	if(!Number.isFinite(maxWidthPx) || maxWidthPx<=0) return name;
	const debugLog = (...args)=>{
		if(!isPillMarqueeDebugEnabled()) return;
		console.debug('[pill-marquee]', ...args);
	};
	const fullWidth = measurePillTextWidth(sampleEl, name);
	if(fullWidth<=maxWidthPx){
		debugLog('label-fit', { rawName, name, maxWidthPx, fullWidth, outcome:name, reason:'fits-full' });
		return name;
	}

	const parts = splitNameWithSingleLetterSuffix(name);
	if(!parts){
		debugLog('label-fit', { rawName, name, maxWidthPx, fullWidth, outcome:name, reason:'pattern-miss' });
		return name;
	}
	const { base, suffix } = parts;
	const minimalCompact = `...${suffix}`;
	const minimalCompactWidth = measurePillTextWidth(sampleEl, minimalCompact);
	if(minimalCompactWidth>maxWidthPx){
		const suffixOnly = suffix;
		const suffixWidth = measurePillTextWidth(sampleEl, suffixOnly);
		const fallback = suffixWidth<=maxWidthPx ? suffixOnly : '';
		debugLog('label-fit', {
			rawName,
			name,
			maxWidthPx,
			fullWidth,
			outcome:fallback,
			reason:'insufficient-width-for-compact',
			minimalCompactWidth,
			suffixWidth
		});
		return fallback;
	}
	let lo = 0;
	let hi = base.length;
	let best = minimalCompact;
	while(lo<=hi){
		const mid = Math.floor((lo+hi)/2);
		const candidate = `${base.slice(0, mid)}...${suffix}`;
		const candidateWidth = measurePillTextWidth(sampleEl, candidate);
		if(candidateWidth<=maxWidthPx){
			best = candidate;
			lo = mid + 1;
		}else{
			hi = mid - 1;
		}
	}
	debugLog('label-fit', { rawName, name, maxWidthPx, fullWidth, outcome:best, reason:'suffix-preserve', base, suffix });
	return best;
}

function tightenCompactLabelToFit(staticEl, maxWidthPx, compactLabel){
	if(!staticEl) return compactLabel;
	const m = String(compactLabel ?? '').match(/^(.*)\.\.\.(\S)$/u);
	if(!m) return compactLabel;
	let prefix = m[1];
	const suffix = m[2];
	staticEl.textContent = compactLabel;
	if(staticEl.scrollWidth<=maxWidthPx) return compactLabel;
	while(prefix.length>0){
		prefix = prefix.slice(0, -1);
		const candidate = `${prefix}...${suffix}`;
		staticEl.textContent = candidate;
		if(staticEl.scrollWidth<=maxWidthPx) return candidate;
	}
	staticEl.textContent = `...${suffix}`;
	if(staticEl.scrollWidth<=maxWidthPx) return `...${suffix}`;
	staticEl.textContent = suffix;
	if(staticEl.scrollWidth<=maxWidthPx) return suffix;
	return '';
}

function fitPersonPillLabel(pill){
	const nameEl = pill.querySelector('.pill-name');
	const trackEl = pill.querySelector('.pill-name-track');
	const staticEl = pill.querySelector('.pill-name-static');
	if(!nameEl || !trackEl || !staticEl) return;
	const fullName = nameEl.dataset.fullName || staticEl.textContent || '';
	const maxWidth = staticEl.clientWidth || nameEl.clientWidth;
	if(maxWidth<=0){
		requestAnimationFrame(()=>fitPersonPillLabel(pill));
		return;
	}
	const gap = '\u00A0\u00A0\u00A0';
	staticEl.textContent = fullName;
	const isTruncated = staticEl.scrollWidth > maxWidth;
	const suffixParts = splitNameWithSingleLetterSuffix(fullName);
	const fittedName = isTruncated
		? (suffixParts ? formatSuffixCompactNameForElement(fullName, maxWidth, staticEl) : formatPersonNameForPill(fullName, maxWidth, staticEl))
		: fullName;
	staticEl.textContent = fittedName;
	if(isTruncated && suffixParts && fittedName.includes('...')){
		staticEl.textContent = tightenCompactLabelToFit(staticEl, maxWidth, fittedName);
	}
	if(isTruncated){
		trackEl.textContent = '';
		const seg1 = document.createElement('span');
		seg1.className = 'pill-name-seg';
		seg1.textContent = fullName;
		const spacer = document.createElement('span');
		spacer.className = 'pill-name-gap';
		spacer.textContent = gap;
		const seg2 = document.createElement('span');
		seg2.className = 'pill-name-seg';
		seg2.textContent = fullName;
		trackEl.append(seg1, spacer, seg2);
		const seg1Rect = seg1.getBoundingClientRect();
		const spacerRect = spacer.getBoundingClientRect();
		const cycleWidth = seg2.offsetLeft - seg1.offsetLeft;
		pill.style.setProperty('--marquee-shift', `${cycleWidth}px`);
		pill.dataset.marqueeCycle = String(cycleWidth);
		if(isPillMarqueeDebugEnabled()){
			console.debug('[pill-marquee]', 'fit metrics', {
				fullName,
				maxWidth,
				fullNameWidth: seg1Rect.width,
				staticScrollWidth: staticEl.scrollWidth,
				fittedName,
				fittedWidth: measurePillTextWidth(staticEl, fittedName),
				seg1Width: seg1Rect.width,
				spacerWidth: spacerRect.width,
				cycleWidth
			});
		}
	}else{
		trackEl.textContent = '';
		pill.style.setProperty('--marquee-shift', '0px');
		delete pill.dataset.marqueeCycle;
	}
	pill.classList.toggle('can-marquee', isTruncated);
	pill.dataset.nameTruncated = isTruncated ? '1' : '0';
	updatePersonPillTooltip(pill, { isTruncated });
}

function stopPillMarquee(pill){
	if(!pill) return;
	const state = _pillMarqueeState.get(pill);
	state?.animation?.cancel();
	if(state?.rafId) cancelAnimationFrame(state.rafId);
	_pillMarqueeState.delete(pill);
	const track = pill.querySelector('.pill-name-track');
	if(track) track.style.transform = 'translateX(0px)';
}

function startPillMarquee(pill){
	if(!pill || !pill.classList.contains('can-marquee')) return;
	if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	stopPillMarquee(pill);
	const track = pill.querySelector('.pill-name-track');
	if(!track) return;
	const cycle = parseFloat(pill.dataset.marqueeCycle || '0');
	if(!(cycle > 0)) return;
	const speedPxPerSec = 62;
	const pauseMs = 0;
	const travelMs = (cycle / speedPxPerSec) * 1000;
	const periodMs = pauseMs + travelMs;
	const debugLog = (...args)=>{
		if(!isPillMarqueeDebugEnabled()) return;
		console.debug('[pill-marquee]', ...args);
	};
	const travelOffset = periodMs>0 ? Math.min(1, Math.max(0, travelMs / periodMs)) : 1;
	const animation = track.animate(
		[
			{ transform:'translateX(0px)', offset:0 },
			{ transform:`translateX(${-cycle}px)`, offset:travelOffset },
			{ transform:`translateX(${-cycle}px)`, offset:1 }
		],
		{
			duration: periodMs,
			iterations: Infinity,
			easing: 'linear',
			fill: 'both'
		}
	);
	const state = { animation, rafId:0, lastLocalTime:0 };
	debugLog('metrics', { cycle, speedPxPerSec, pauseMs, travelMs, periodMs, threshold:-cycle });
	if(isPillMarqueeDebugEnabled()){
		debugLog('keyframes', { travelOffset });
		const monitor=()=>{
			const timing=animation.effect?.getComputedTiming?.();
			const currentTime=animation.currentTime||0;
			const duration=timing?.duration||periodMs;
			const localTime = duration>0 ? (currentTime % duration) : 0;
			const tx = parseTranslateX(getComputedStyle(track).transform);
			if(localTime < state.lastLocalTime){
				debugLog('cycle-boundary', { previousLocalTime:state.lastLocalTime, localTime, tx, expectedMin:-cycle, expectedMax:0 });
			}else{
				debugLog('tick', { localTime, tx });
			}
			state.lastLocalTime=localTime;
			state.rafId=requestAnimationFrame(monitor);
		};
		state.rafId=requestAnimationFrame(monitor);
	}
	_pillMarqueeState.set(pill, state);
}

function updatePersonPillTooltip(pill, opts={}){
	if(!pill) return;
	const SAME_PERSON_WARNING_PART = 'är planerad på denna station föregående pass.';
	const tipLines = [];
	const seen = new Set();
	const pushLine = line=>{
		const cleaned = String(line || '').trim();
		if(!cleaned || seen.has(cleaned)) return;
		seen.add(cleaned);
		tipLines.push(cleaned);
	};
	if(pill.classList.contains('under-training')) pushLine('Ej utbildad/under utbildning');
	let pillWarnings = [];
	try{
		pillWarnings = JSON.parse(pill.dataset.warnList || '[]');
	}catch(_){}
	pillWarnings.forEach(pushLine);
	const cell = pill.closest('.cell');
	if(cell){
		const cellTip = (cell.getAttribute('data-bs-original-title') || cell.getAttribute('data-bs-title') || cell.getAttribute('title') || '').trim();
		cellTip.split('\n').forEach(line=>{
			const msg = String(line || '').replace(/^•\s*/, '').trim();
			if(msg.includes(SAME_PERSON_WARNING_PART)) return;
			pushLine(msg);
		});
	}
	const content = formatTooltipBulletText(tipLines);
	if(!content){
		killPillTooltip(pill);
		return;
	}
	pill.setAttribute('data-bs-toggle', 'tooltip');
	pill.setAttribute('data-bs-title', content);
	const tip = bootstrap.Tooltip.getOrCreateInstance(pill, {
		container: 'body',
		boundary: 'viewport',
		html: false
	});
	if(typeof tip.setContent === 'function') tip.setContent({ '.tooltip-inner': content });
}

function addPersonPill(cell, personId){
	const p = getPlanningPersonById(personId) || { id:personId, name:`Person ${personId}`, groupId:null };
	const pill = document.createElement('span');
	pill.className = 'person-pill';
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
	}

	pill.innerHTML = `<i class="bi bi-person pill-icon"></i><span class="pill-name"><span class="pill-name-static"></span><span class="pill-name-track" aria-hidden="true"></span></span><i class="bi bi-x pill-remove" role="button" aria-label="Ta bort person"></i>`;
	const nameEl = pill.querySelector('.pill-name');
	nameEl.dataset.fullName = String(p.name ?? '');
	pill.querySelector('.pill-name-static').textContent = nameEl.dataset.fullName;
	const removeEl = pill.querySelector('.pill-remove');
	removeEl.addEventListener('click', ev=>{
		ev.stopPropagation();
		if(!canModifyAssignments()) return;
		removePersonPill(cell, personId);
	});

	pill.addEventListener('dragstart', onDragStart);
	pill.addEventListener('dragend', onDragEnd);
	pill.addEventListener('mouseenter', ()=>startPillMarquee(pill));
	pill.addEventListener('mouseleave', ()=>stopPillMarquee(pill));

	cell.querySelector('[data-role="person-list"]').appendChild(pill);
	applyPersonPillDisplayVariant(pill);

}

function removePersonPill(cell,personId){
	withAssignmentHistoryAction('Ta bort person', ()=>{
		const pill=cell.querySelector(`.person-pill[data-person-id="${escapeDataId(personId)}"]`);
		if(pill){
			killPillTooltip(pill);
			stopPillMarquee(pill);
		}
		const dateStr=getSelectedDateStr();
		const slotId=cell.dataset.slotId;
		const stationId=parseEntityId(cell.dataset.stationId);
		const removed=removeAssignmentsWhere(a=>(
			a.date===dateStr &&
			String(a.timeSlotId)===String(slotId) &&
			a.stationId===stationId &&
			a.personId===personId &&
			a.dayType===currentDayType
		));
		cell.querySelector(`[data-person-id="${escapeDataId(personId)}"]`)?.remove();
		refreshAutoGenerateWarnings();
		validateChangedCells(createAssignmentInvalidationSetFromDiff({removed}));
	});
}

function onDragStart(ev){
	if(!canModifyAssignments()){
		ev.preventDefault();
		return;
	}
	const pill=ev.target.closest('.person-pill');
	if(pill){
		killPillTooltip(pill);
		stopPillMarquee(pill);
	}
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
