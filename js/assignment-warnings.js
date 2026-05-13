// Auto-generation assignment warning helpers.

function formatUnassignedTooltipText(names){
	if(!names || names.length===0) return '';
	const count=names.length;
	const adjective=count===1 ? 'tilldelad' : 'tilldelade';
	const unit=count===1 ? 'person' : 'personer';
	const lines=names.map(name=>`• ${name}`).join('\n');
	return `${count} ej ${adjective} ${unit}:\n${lines}`;
}

function getAutoGenerateUnassignedBySlot(){
	if(!lastAutoGenerateContext) return null;
	const dateStr=getSelectedDateStr();
	if(lastAutoGenerateContext.factoryId!==currentFactoryId ||
		lastAutoGenerateContext.dayType!==currentDayType ||
		lastAutoGenerateContext.date!==dateStr){
		return null;
	}
	const candidateGroupIds=new Set(lastAutoGenerateContext.candidateGroupIds||[]);
	const hasGroupFilter=Array.isArray(lastAutoGenerateContext.candidateGroupIds);
	const workSlots=DB.timeSlots
		.filter(ts=>ts.factoryId===currentFactoryId&&ts.dayType===currentDayType&&ts.type==='Work')
		.sort((a,b)=>a.sort-b.sort);
	const rows=DB.assignments.filter(a=>a.date===dateStr&&a.factoryId===currentFactoryId&&a.dayType===currentDayType);
	const bySlot=new Map();
	for(const slot of workSlots){
		const available=getPlanningPersons(currentFactoryId).filter(p=>
			p.factoryId===currentFactoryId &&
			p.present &&
			(!hasGroupFilter || candidateGroupIds.has(p.groupId))
		);
		const assigned=new Set(rows.filter(a=>a.timeSlotId===slot.id).map(a=>a.personId));
		const names=available
			.filter(p=>!assigned.has(p.id))
			.map(p=>p.name)
			.sort((a,b)=>a.localeCompare(b,'sv'));
		if(names.length>0) bySlot.set(String(slot.id), names);
	}
	return bySlot;
}

function refreshAutoGenerateWarnings(){
	const grid=document.querySelector('.schedule-grid');
	if(!grid) return;
	if(!shouldValidateBoardForMode()){
		grid.querySelectorAll('.time-cell[data-slot-id]').forEach(timeCell=>{
			timeCell.classList.remove('slot-unassigned-highlight');
			bootstrap.Tooltip.getInstance(timeCell)?.dispose();
			timeCell.removeAttribute('data-bs-toggle');
			timeCell.removeAttribute('data-bs-title');
			timeCell.removeAttribute('title');
			timeCell.querySelector('.slot-unassigned-indicator')?.remove();
		});
		return;
	}
	const unassignedBySlot=getAutoGenerateUnassignedBySlot();
	grid.querySelectorAll('.time-cell[data-slot-id]').forEach(timeCell=>{
		const slotId=String(timeCell.dataset.slotId||'');
		const missingNames=unassignedBySlot?.get(slotId)||[];
		let indicator=timeCell.querySelector('.slot-unassigned-indicator');
		if(missingNames.length===0){
			timeCell.classList.remove('slot-unassigned-highlight');
			bootstrap.Tooltip.getInstance(timeCell)?.dispose();
			timeCell.removeAttribute('data-bs-toggle');
			timeCell.removeAttribute('data-bs-title');
			timeCell.removeAttribute('title');
			if(indicator){
				indicator.remove();
			}
			return;
		}
		timeCell.classList.add('slot-unassigned-highlight');
		if(!indicator){
			indicator=document.createElement('span');
			indicator.className='slot-unassigned-indicator';
			indicator.innerHTML='<i class="bi bi-person-exclamation" aria-hidden="true"></i><span class="visually-hidden">Ej tilldelade personer</span>';
			timeCell.appendChild(indicator);
		}
		const tipText=formatUnassignedTooltipText(missingNames);
		timeCell.setAttribute('data-bs-toggle','tooltip');
		timeCell.setAttribute('data-bs-title', tipText);
		timeCell.removeAttribute('title');
		const tip=bootstrap.Tooltip.getOrCreateInstance(timeCell,{trigger:'hover',placement:'auto'});
		if(typeof tip.setContent==='function') tip.setContent({ '.tooltip-inner': tipText });
	});
}
