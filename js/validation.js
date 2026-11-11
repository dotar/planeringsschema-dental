// Training, compatibility, placement validation, and validation UI diffing.

let _inValidation = false;
let _pendingCellStates = new Map();
let _pendingPillStates = new Map();
let _skipCellWarningTransitionOnce = false;
const HAS_CROSSFADE = CSS && CSS.supports && CSS.supports('background-image', 'cross-fade(var(--img-warn); var(--img-invalid); 50%)');

function isPersonAllowedFor(person, station, slot, opts = {}){
	if(!person || !person.present) return false;

	// Night cutoff (evening context): night staff may not work before cutoff
	if(currentShift==='night' && currentDayType!==DayType.OvertimeDay && currentDayType!==DayType.Night && person.isNight){
		const cutoff=getNightCutoffFor(currentFactoryId, currentDate);
		if(timeLess(slot.start, cutoff)) return false;
	}

	// Training requirement (can be ignored for manual placement/picker).
	// Resurs can optionally enforce training via opts.forceTrainingForResurs
	// (used by randomizer's "Kräv utbildad personal per station").
	const ignoreTraining = !!opts.ignoreTraining;
	const forceTrainingForResurs = !!opts.forceTrainingForResurs;
	if(!ignoreTraining && (!station.isResurs || forceTrainingForResurs)){
		const trained = isPersonTrainedForStation(person.id, station.id, opts.trainingIndex);
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

function validateBoard(evaluation=evaluateCurrentSchedule()){
	return runMeasured('validateBoard(full)', ()=>{
		applyScheduleValidation(evaluation);
		renderDependentSummaries(evaluation);
	});
}

function validateChangedCells(invalidationKeys){
	const context=getSchedulingContext();
	const keys=new Set([...(invalidationKeys || [])].filter(key=>{
		const ref=parseInvalidationKey(key);
		return ref.date===context.date && String(ref.factoryId)===String(context.factoryId) && ref.dayType===context.dayType;
	}));
	const evaluation=evaluateCurrentSchedule();
	if(keys.size===0 || !shouldValidateBoardForMode()){
		renderDependentSummaries(evaluation);
		return;
	}
	return runMeasured(`validateBoard(partial ${keys.size} cells)`, ()=>{
		applyScheduleValidation(evaluation, keys);
		renderDependentSummaries(evaluation);
	});
}

function applyScheduleValidation(evaluation, scopeKeys=null){
	const previous=beginCellValidation(scopeKeys);
	const inScope=(stationId, slotId)=>!scopeKeys || scopeKeys.has(makeCurrentCellInvalidationKey(slotId, stationId));
	const markDoubleBooking=row=>{
		if(inScope(row.stationId, row.timeSlotId)){
			markCellInvalid(row.stationId, row.timeSlotId, 'Samma person dubbelbokad i samma tid.');
		}
	};
	for(const rows of groupArray(evaluation.rows, row=>String(row.timeSlotId)).values()){
		const seen=new Map();
		for(const row of rows){
			const personId=String(row.personId);
			if(seen.has(personId)){
				markDoubleBooking(row);
				markDoubleBooking(seen.get(personId));
			}else{
				seen.set(personId, row);
			}
		}
	}

	const checkCutoff=currentShift==='night' && currentDayType!==DayType.OvertimeDay && currentDayType!==DayType.Night;
	const cutoff=checkCutoff ? getNightCutoffFor(currentFactoryId, currentDate) : null;
	for(const cell of evaluation.cells){
		const {station, slot}=cell;
		if(!inScope(station.id, slot.id)) continue;
		if(shouldShowCompatibilityWarnings() && cell.compatibilityPairs.length){
			markCellWarn(station.id, slot.id, 'Byt plats på en av dessa personer.');
		}
		if(cell.rotationEvents.length){
			const names=[];
			for(const event of cell.rotationEvents){
				const name=evaluation.personById.get(String(event.personId))?.name || `Person ${event.personId}`;
				queuePillWarn(station.id, slot.id, event.personId, `${name} är planerad på denna station föregående pass.`);
				if(!names.includes(name)) names.push(name);
			}
			markCellInvalid(station.id, slot.id, `${formatNameListSv(names)} är planerad på denna station föregående pass.`);
		}
		if(cell.overCapacity) markCellInvalid(station.id, slot.id, 'Över kapacitet.');
		if(cell.nonoperationalIssue) markCellWarn(station.id, slot.id, 'Tilldelning på en icke-operativ station.');
		if(checkCutoff && timeLess(slot.start, cutoff) && cell.assignedRows.some(row=>evaluation.personById.get(String(row.personId))?.isNight)){
			markCellInvalid(station.id, slot.id, 'Nattpersonal får ej bokas före cutoff.');
		}
	}
	applyCellValidationDiff(previous);
	applyPillValidationDiff();
}

function renderDependentSummaries(evaluation=evaluateCurrentSchedule()){
	renderSummaryPanel(evaluation);
	renderDerivedReport(evaluation);
}

function cellKey(stationId, slotId){ return `${stationId}:${slotId}` }

function getCellByKey(key){
	const [sid,slot]=key.split(':')
	return findCell(parseEntityId(sid), slot)
}

function beginCellValidation(scopeKeys=null){
	_pendingCellStates.clear();
	_pendingPillStates.clear();
	_inValidation = true;
	const scopedKeys = scopeKeys ? new Set(scopeKeys) : null;
	const pillSelector = scopedKeys
		? [...scopedKeys].map(key=>{
			const ref=parseInvalidationKey(key);
			return `.cell[data-station-id=\"${escapeDataId(ref.stationId)}\"][data-slot-id=\"${CSS.escape(String(ref.slotId))}\"] .person-pill[data-warn-list]`;
		}).join(',')
		: '.person-pill[data-warn-list]';
	if(pillSelector){
	document.querySelectorAll(pillSelector).forEach(pill=>{
		delete pill.dataset.warnList;
		pill.classList.remove('pill-warn');
		updatePersonPillTooltip(pill, { isTruncated: pill.dataset.nameTruncated === '1' });
	});
	}

	const prev = new Map();
	const cellSelector = scopedKeys
		? [...scopedKeys].map(key=>{
			const ref=parseInvalidationKey(key);
			return `.cell[data-station-id=\"${escapeDataId(ref.stationId)}\"][data-slot-id=\"${CSS.escape(String(ref.slotId))}\"]`;
		}).join(',')
		: '.cell';
	if(!cellSelector) return prev;
	document.querySelectorAll(cellSelector).forEach(c=>{
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

function queuePillWarn(stationId, slotId, personId, msg){
	const key = `${stationId}:${slotId}:${personId}`;
	const s = _pendingPillStates.get(key) || { msgs: [] };
	if(msg && !s.msgs.includes(msg)) s.msgs.push(msg);
	_pendingPillStates.set(key, s);
}

function formatTooltipBulletText(lines){
	const cleaned = lines
		.map(line=>String(line || '').trim())
		.filter(Boolean);
	return cleaned.map(line=>`• ${line.replace(/^•\s*/, '')}`).join('\n');
}

function formatNameListSv(names){
	const items = names.map(n=>String(n || '').trim()).filter(Boolean);
	if(items.length<=1) return items[0] || '';
	if(items.length===2) return `${items[0]} & ${items[1]}`;
	return `${items.slice(0,-1).join(', ')} & ${items[items.length-1]}`;
}

function applyPillValidationDiff(){
	_pendingPillStates.forEach((state, key)=>{
		const [stationId, slotId, personId] = key.split(':');
		const pill = document.querySelector(
			`.cell[data-station-id="${escapeDataId(stationId)}"][data-slot-id="${CSS.escape(String(slotId))}"] .person-pill[data-person-id="${escapeDataId(personId)}"]`
		);
		if(!pill) return;
		pill.dataset.warnList = JSON.stringify(state.msgs || []);
		pill.classList.add('pill-warn');
		updatePersonPillTooltip(pill, { isTruncated: pill.dataset.nameTruncated === '1' });
	});
}

function setCellTooltipContent(cell, text){
	const cur=(cell.getAttribute('data-bs-original-title')||cell.getAttribute('data-bs-title')||cell.getAttribute('title')||'').trim()
	const normalized = formatTooltipBulletText((text||'').split('\n'));
	if(normalized===cur) return
	if(!normalized){
		disposeCellTooltip(cell)
		return
	}
	cell.setAttribute('data-bs-toggle','tooltip')
	cell.setAttribute('data-bs-title', normalized)
	const tip=bootstrap.Tooltip.getOrCreateInstance(cell,{container:'body', boundary:'viewport', html:false})
	if(tip && tip.setContent) tip.setContent({'.tooltip-inner': normalized})
}

function applyCellValidationDiff(prev){
	_inValidation=false
	const skipTransitions=_skipCellWarningTransitionOnce;
	_skipCellWarningTransitionOnce=false;

	// union of keys (prev + next)
	const allKeys=new Set([...prev.keys(), ..._pendingCellStates.keys()])
	allKeys.forEach(key=>{
		const cell=getCellByKey(key)
		if(!cell) return

		const p = prev.get(key) || { warn:false, invalid:false, tip:'' };
		const n = _pendingCellStates.get(key) || { warn:false, invalid:false, msgs:[] };

		const prevTag = _stateTag(p.warn, p.invalid);
		const nextTag = _stateTag(n.warn, n.invalid);

		if(skipTransitions){
			_setBase(cell, nextTag === 'warn' || nextTag === 'both', nextTag === 'invalid' || nextTag === 'both');
		}else if(HAS_CROSSFADE){
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
