// Training, compatibility, placement validation, and validation UI diffing.

const HAS_CROSSFADE = CSS && CSS.supports && CSS.supports('background-image', 'cross-fade(var(--img-warn); var(--img-invalid); 50%)');

let _inValidation = false;
let _pendingCellStates = new Map();
let _pendingPillStates = new Map();
let _skipCellWarningTransitionOnce = false;

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
		if(shouldShowCompatibilityWarnings()){
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
	const consecutiveByCell = new Map();

	for(const [, items] of byPersonStation.entries()){
		items.sort((a, b) => workSlotOrder.get(String(a.timeSlotId)) - workSlotOrder.get(String(b.timeSlotId)));
		for(let i=1; i<items.length; i++){
			const cur = items[i], prev = items[i-1];
			if(workSlotOrder.get(String(cur.timeSlotId)) === workSlotOrder.get(String(prev.timeSlotId)) + 1){
				const personName = getPlanningPersonById(cur.personId)?.name || `Person ${cur.personId}`;
				queuePillWarn(cur.stationId, cur.timeSlotId, cur.personId, `${personName} är planerad på denna station föregående pass.`);
				const key = cellKey(cur.stationId, cur.timeSlotId);
				const list = consecutiveByCell.get(key) || [];
				if(!list.includes(personName)) list.push(personName);
				consecutiveByCell.set(key, list);
			}
		}
	}
	consecutiveByCell.forEach((names, key)=>{
		const [stationId, slotId] = key.split(':');
		const text = `${formatNameListSv(names)} är planerad på denna station föregående pass.`;
		markCellInvalid(stationId, slotId, text, 'Dubbelpass');
	});



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
	applyPillValidationDiff();
	renderSummaryPanel();

}

function cellKey(stationId, slotId){ return `${stationId}:${slotId}` }

function getCellByKey(key){
	const [sid,slot]=key.split(':')
	return findCell(parseEntityId(sid), slot)
}

function beginCellValidation(){
	_pendingCellStates.clear();
	_pendingPillStates.clear();
	_inValidation = true;
	document.querySelectorAll('.person-pill[data-warn-list]').forEach(pill=>{
		delete pill.dataset.warnList;
		pill.classList.remove('pill-warn');
		updatePersonPillTooltip(pill, { isTruncated: pill.dataset.nameTruncated === '1' });
	});

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
	const tip=bootstrap.Tooltip.getOrCreateInstance(cell,{container:'body', boundary:'viewport'})
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
