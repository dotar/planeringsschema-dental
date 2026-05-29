// Randomized assignment generation and randomizer modal behavior.

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

	const content = formatTooltipBulletText(list);
	cell.setAttribute('data-bs-toggle', 'tooltip');
	cell.setAttribute('data-bs-title', content);

	const tip = bootstrap.Tooltip.getOrCreateInstance(cell, {
		container: 'body',
		boundary: 'viewport'
	});
	tip.setContent({ '.tooltip-inner': content });
}

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
		const adjacentSlots = [
			idx>0 ? workSlots[idx-1] : null,
			idx>=0 && idx<workSlots.length-1 ? workSlots[idx+1] : null
		].filter(Boolean);
		if(adjacentSlots.length){
			const adjacentAss = DB.assignments
				.filter(a =>
					a.date===dateStr &&
					a.dayType===currentDayType &&
					a.stationId===station.id &&
					adjacentSlots.some(adj => adj.id===a.timeSlotId)
				)
				.map(a => a.personId);
			if(adjacentAss.length) candidates = candidates.filter(c => !adjacentAss.includes(c.id));
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

function roundRobinFill(stations, slot, opts = {}){
	const dateStr = getSelectedDateStr();
	const getStationDayLoad = (stationId)=>DB.assignments.filter(a =>
		a.date===dateStr &&
		a.dayType===currentDayType &&
		a.stationId===stationId
	).length;
	const stationBaseOrder = new Map(stations.map((s, idx)=>[s.id, idx]));

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
	specialists.sort((a, b)=>{
		const loadDiff = getStationDayLoad(a.s.id) - getStationDayLoad(b.s.id);
		if(loadDiff!==0) return loadDiff;
		return (stationBaseOrder.get(a.s.id) ?? 0) - (stationBaseOrder.get(b.s.id) ?? 0);
	});
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
		const stationOrder = stations.slice().sort((a, b)=>{
			if(opts.preferCriticalCoverage !== false){
				const aSupply = getStationCandidateSupply(a, slot, opts, takenThisSlot, remaining);
				const bSupply = getStationCandidateSupply(b, slot, opts, takenThisSlot, remaining);
				if(aSupply!==bSupply) return aSupply - bSupply; // scarcer first
			}
			const loadDiff = getStationDayLoad(a.id) - getStationDayLoad(b.id);
			if(loadDiff!==0) return loadDiff;
			return (stationBaseOrder.get(a.id) ?? 0) - (stationBaseOrder.get(b.id) ?? 0);
		});
		for(const s of stationOrder){
			const rem = remaining.get(s.id) || 0;
			if(rem <= 0) continue;

			const candidates = generalists.filter(p => canPlace(p, s, slot, opts, takenThisSlot, remaining));
			if(!candidates.length) continue;
			let chosen;
			if(opts.preferCriticalCoverage !== false){
				const scored = candidates
					.map(p => ({
						person: p,
						criticalNeed: countCriticalNeed(p, s, stations, slot, opts, takenThisSlot, remaining)
					}))
					.sort((a, b) => a.criticalNeed - b.criticalNeed);
				const bestNeed = scored[0].criticalNeed;
				const best = scored.filter(x => x.criticalNeed === bestNeed).map(x => x.person);
				shuffle(best);
				chosen = best[0];
			}else{
				shuffle(candidates);
				chosen = candidates[0];
			}

			const cell = findCell(s.id, slot.id);
			placePerson(cell, s, slot, chosen.id);
			remaining.set(s.id, rem - 1);
			takenThisSlot.add(chosen.id);
			progressed = true;
		}
	}

	// 3) utilization pass: if capacity remains, try to place as many people as possible in this slot.
	// Keeps normal constraints (training, incompatibilities, double-booking, consecutive rule),
	// but skips only the conservative next-slot reserve guard.
	let utilizationProgressed = true;
	while(utilizationProgressed){
		utilizationProgressed = false;
		const stationOrder = stations.slice().sort((a, b)=>{
			if(opts.preferCriticalCoverage !== false){
				const aSupply = getStationCandidateSupply(a, slot, {...opts, _skipNextSlotReserve:true}, takenThisSlot, remaining);
				const bSupply = getStationCandidateSupply(b, slot, {...opts, _skipNextSlotReserve:true}, takenThisSlot, remaining);
				if(aSupply!==bSupply) return aSupply - bSupply; // scarcer first
			}
			const loadDiff = getStationDayLoad(a.id) - getStationDayLoad(b.id);
			if(loadDiff!==0) return loadDiff;
			return (stationBaseOrder.get(a.id) ?? 0) - (stationBaseOrder.get(b.id) ?? 0);
		});

		for(const s of stationOrder){
			const rem = remaining.get(s.id) || 0;
			if(rem <= 0) continue;

			const relaxedOpts = {...opts, _skipNextSlotReserve:true};
			const candidates = getPlanningPersons(currentFactoryId).filter(p =>
				p.factoryId===currentFactoryId &&
				p.present &&
				(!opts.candidateGroupIds || opts.candidateGroupIds.has(p.groupId)) &&
				canPlace(p, s, slot, relaxedOpts, takenThisSlot, remaining)
			);
			if(!candidates.length) continue;

			let chosen;
			if(opts.preferCriticalCoverage !== false){
				const scored = candidates
					.map(p => ({
						person: p,
						criticalNeed: countCriticalNeed(p, s, stations, slot, relaxedOpts, takenThisSlot, remaining)
					}))
					.sort((a, b) => a.criticalNeed - b.criticalNeed);
				const bestNeed = scored[0].criticalNeed;
				const best = scored.filter(x => x.criticalNeed === bestNeed).map(x => x.person);
				shuffle(best);
				chosen = best[0];
			}else{
				shuffle(candidates);
				chosen = candidates[0];
			}

			const cell = findCell(s.id, slot.id);
			placePerson(cell, s, slot, chosen.id);
			remaining.set(s.id, rem - 1);
			takenThisSlot.add(chosen.id);
			utilizationProgressed = true;
		}
	}
}

function countCriticalNeed(person, currentStation, stations, slot, opts = {}, takenThisSlot, remaining){
	let criticalNeed = 0;
	for(const other of stations){
		if(other.id===currentStation.id) continue;
		if((remaining.get(other.id) || 0) <= 0) continue;
		if(!canPlace(person, other, slot, opts, takenThisSlot, remaining)) continue;

		const alternatives = getPlanningPersons(currentFactoryId).filter(p =>
			p.id!==person.id &&
			canPlace(p, other, slot, opts, takenThisSlot, remaining)
		).length;
		if(alternatives===0) criticalNeed++;
	}
	return criticalNeed;
}

function getStationCandidateSupply(station, slot, opts = {}, takenThisSlot, remaining){
	if((remaining.get(station.id) || 0) <= 0) return Number.POSITIVE_INFINITY;
	return getPlanningPersons(currentFactoryId).filter(p =>
		p.factoryId===currentFactoryId &&
		p.present &&
		(!opts.candidateGroupIds || opts.candidateGroupIds.has(p.groupId)) &&
		canPlace(p, station, slot, opts, takenThisSlot, remaining)
	).length;
}

function canPlace(person, station, slot, opts = {}, takenThisSlot, remaining){
	const dateStr = getSelectedDateStr();
	if(takenThisSlot.has(person.id)) return false;
	if((remaining.get(station.id) || 0) <= 0) return false;
	if(!isPersonAllowedFor(person, station, slot, {
		ignoreTraining: opts.requireTraining===false,
		forceTrainingForResurs: !!opts.requireTraining
	})) return false;

	if(opts.avoidConsecutive !== false){
		const workSlots = DB.timeSlots
			.filter(ts => ts.factoryId===currentFactoryId && ts.dayType===currentDayType && ts.type==='Work')
			.sort((a, b) => a.sort - b.sort);
		const idx = workSlots.findIndex(x => x.id === slot.id);
		const adjacentSlots = [
			idx > 0 ? workSlots[idx-1] : null,
			idx >= 0 && idx < workSlots.length - 1 ? workSlots[idx+1] : null
		].filter(Boolean);
		if(adjacentSlots.length){
			const adjacentAss = DB.assignments
				.filter(a =>
					a.date===dateStr &&
					a.dayType===currentDayType &&
					a.stationId===station.id &&
					adjacentSlots.some(adj => adj.id===a.timeSlotId)
				)
				.map(a => a.personId);
			if(adjacentAss.includes(person.id)) return false;
		}
	}

	const existingHere = DB.assignments
		.filter(a => a.date===dateStr && a.dayType===currentDayType && a.stationId===station.id && a.timeSlotId===slot.id)
		.map(a => a.personId);
	if(existingHere.some(e => isIncompatible(e, person.id))) return false;

	// Keep scarce trained candidates available for the next slot when consecutive-rule is active.
	// This avoids overfilling an early slot (up to max capacity) when it would create avoidable gaps next.
	if(opts.avoidConsecutive !== false && !opts._skipNextSlotReserve){
		const workSlots = DB.timeSlots
			.filter(ts => ts.factoryId===currentFactoryId && ts.dayType===currentDayType && ts.type==='Work')
			.sort((a, b) => a.sort - b.sort);
		const idx = workSlots.findIndex(x => x.id === slot.id);
		const nextSlot = idx >= 0 && idx < workSlots.length - 1 ? workSlots[idx+1] : null;
		if(nextSlot){
			const nextCapacity = station.defaultCapacity || 1;
			const nextAssignments = DB.assignments.filter(a =>
				a.date===dateStr &&
				a.dayType===currentDayType &&
				a.stationId===station.id &&
				a.timeSlotId===nextSlot.id
			);
			const nextNeed = Math.max(0, nextCapacity - nextAssignments.length);
			if(nextNeed > 0){
				const blockedByCurrent = new Set(existingHere);
				const personCanTakeNext = !blockedByCurrent.has(person.id) &&
					isPersonAllowedFor(person, station, nextSlot, {
						ignoreTraining: opts.requireTraining===false,
						forceTrainingForResurs: !!opts.requireTraining
					}) &&
					!nextAssignments.some(a => isIncompatible(a.personId, person.id));
				if(personCanTakeNext){
					const availableOthers = getPlanningPersons(currentFactoryId).filter(p =>
						p.id!==person.id &&
						p.factoryId===currentFactoryId &&
						p.present &&
						(!opts.candidateGroupIds || opts.candidateGroupIds.has(p.groupId)) &&
						!blockedByCurrent.has(p.id) &&
						isPersonAllowedFor(p, station, nextSlot, {
							ignoreTraining: opts.requireTraining===false,
							forceTrainingForResurs: !!opts.requireTraining
						}) &&
						!nextAssignments.some(a => isIncompatible(a.personId, p.id))
					).length;
					if(availableOthers < nextNeed) return false;
				}
			}
		}
	}

	return true;
}

function eligibleStationsFor(person, stations, slot, opts = {}, takenThisSlot, remaining){
	const out = [];
	for(const s of stations){
		if(canPlace(person, s, slot, opts, takenThisSlot, remaining)) out.push(s);
	}
	return out;
}

function openRandomizer(){
	const m=new bootstrap.Modal('#randomizeModal');

	// ----- restore toggles from storage -----
	const acSaved=localStorage.getItem('planning.avoidConsecutive');
	const ac=(acSaved===null)?true:(acSaved==='1'||acSaved==='true');
	document.getElementById('avoidConsecutive').checked=ac;
	const fillResursSaved=localStorage.getItem('planning.fillResurs');
	const fillResurs=(fillResursSaved===null)?true:(fillResursSaved==='1'||fillResursSaved==='true');
	document.getElementById('fillResurs').checked=fillResurs;
	const keepPrefilledSaved=localStorage.getItem('planning.keepPrefilled');
	const keepPrefilled=(keepPrefilledSaved===null)?true:(keepPrefilledSaved==='1'||keepPrefilledSaved==='true');
	document.getElementById('keepPrefilled').checked=keepPrefilled;
	const preferTrainedSaved=localStorage.getItem('planning.preferTrained');
	const preferTrained=(preferTrainedSaved===null)?true:(preferTrainedSaved==='1'||preferTrainedSaved==='true');
	document.getElementById('preferTrained').checked=preferTrained;
	const preferCriticalCoverageSaved=localStorage.getItem('planning.preferCriticalCoverage');
	const preferCriticalCoverage=(preferCriticalCoverageSaved===null)?true:(preferCriticalCoverageSaved==='1'||preferCriticalCoverageSaved==='true');
	document.getElementById('preferCriticalCoverage').checked=preferCriticalCoverage;

	// ----- Groups (now: defines PEOPLE POOL) -----
	const wrapG=document.getElementById('randGroups');
	wrapG.innerHTML='';
	const {order}=orderedColumns();
	order.filter(tok=>tok!=='resurs' && !isResursGroupId(tok)).forEach(id=>{
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
		if(isResursOrderToken(tok))return;
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
	if(selectedGroupIds.size===0){
		showToast('warning','Validering','Välj minst en personalgrupp innan autogenerering körs.');
		return;
	}

	// stations to fill
	const selectedStationIds = new Set(
		[...document.querySelectorAll('#randStations input[data-kind="station"]:checked')].map(i => parseEntityId(i.value))
	);

	// avoid consecutive toggle (persist)
	const avoidConsecutive = document.getElementById('avoidConsecutive').checked;
	localStorage.setItem('planning.avoidConsecutive', avoidConsecutive ? '1' : '0');
	const fillResurs = document.getElementById('fillResurs').checked;
	localStorage.setItem('planning.fillResurs', fillResurs ? '1' : '0');
	const keepPrefilled = document.getElementById('keepPrefilled').checked;
	localStorage.setItem('planning.keepPrefilled', keepPrefilled ? '1' : '0');
	const preferTrained = document.getElementById('preferTrained').checked;
	localStorage.setItem('planning.preferTrained', preferTrained ? '1' : '0');
	const preferCriticalCoverage = document.getElementById('preferCriticalCoverage').checked;
	localStorage.setItem('planning.preferCriticalCoverage', preferCriticalCoverage ? '1' : '0');

	withAssignmentHistoryAction('Autogenerering', ()=>{
		// ordered work slots
		const slots = DB.timeSlots
			.filter(ts => ts.factoryId===currentFactoryId && ts.dayType===currentDayType && ts.type==='Work')
			.sort((a, b)=>a.sort-b.sort);

		if(!keepPrefilled){
			const dateStr=getSelectedDateStr();
			removeAssignmentsWhere(a => (
				a.date===dateStr &&
				a.factoryId===currentFactoryId &&
				a.dayType===currentDayType
			));
		}

		// chosen stations: non-Resurs first; Resurs auto last
		const chosen = DB.stations.filter(s => s.factoryId===currentFactoryId && selectedStationIds.has(s.id));
		const nonRes = chosen.filter(s => !s.isResurs);
		const resursStations = getResursStations(currentFactoryId).filter(s => s.operational);

		// per slot: round-robin across non-Resurs
		for(const sl of slots){
			roundRobinFill(nonRes, sl, {candidateGroupIds:selectedGroupIds, avoidConsecutive, requireTraining:preferTrained, preferCriticalCoverage});
		}
		// then Resurs columns (if present)
		if(resursStations.length && fillResurs){
			for(const sl of slots){
				roundRobinFill(resursStations, sl, {candidateGroupIds:selectedGroupIds, avoidConsecutive, requireTraining:preferTrained, preferCriticalCoverage});
			}
		}
	});

	lastAutoGenerateContext={
		factoryId:currentFactoryId,
		dayType:currentDayType,
		date:getSelectedDateStr(),
		candidateGroupIds:[...selectedGroupIds]
	};

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
