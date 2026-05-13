// Application bootstrap, settings editors, and remaining feature wiring.
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



























function renderSettingsInfoTexts(){
	const factoryTitle=getCurrentFactoryTitle();
	const shiftTitle=capitalizeFirst(shiftLabel(currentShift));
	const withIcon=(text)=>`<i class="bi bi-info-circle-fill"></i> ${text}`;

	const personnel=document.getElementById('personnelInfoText');
	if(personnel) personnel.innerHTML=withIcon(`Dra för att flytta personer mellan grupper i ${factoryTitle} ${shiftTitle}`);

	const groups=document.getElementById('groupsInfoText');
	if(groups) groups.innerHTML=withIcon(`Dra för att ändra kolumnordningen för grupper i ${factoryTitle} ${shiftTitle}`);

	const stations=document.getElementById('stationsInfoText');
	if(stations) stations.innerHTML=withIcon(`Dra för att ändra kolumnordningen för stationer inom en grupp i ${factoryTitle}`);

	const slots=document.getElementById('slotsInfoText');
	if(slots) slots.innerHTML=withIcon(`Dra rader för att sortera tidsintervaller i ${factoryTitle} ${shiftTitle}. Använd format <strong>HH:MM</strong>.`);
}

const INACTIVITY_RESET_KEY='planning.inactivityResetMinutes';
const VIEWER_SHIFT_LEAD_KEY='planning.viewerShiftLeadMinutes';
const VIEWER_EDIT_KEY='planning.viewerCanEditAssignments';
const VIEWER_WARNINGS_KEY='planning.viewerShowWarnings';
const COORD_AUTO_LOGOUT_KEY='planning.coordAutoLogoutMinutes';
const INACTIVITY_ACTIVITY_EVENTS=['pointerdown','keydown','touchstart'];






















const _pillVariantTransitionState = new WeakMap();



































// ---- Cell warning animation state (must be declared before init()) ----
// Detect support once
const HAS_CROSSFADE = CSS && CSS.supports && CSS.supports('background-image', 'cross-fade(var(--img-warn); var(--img-invalid); 50%)');




// map (warn, invalid) -> state tag

/* Cross-fade exactly between prevTag and nextTag using CSS cross-fade().
   Sequence:
   1) Overlay FROM=prev; TO=next; MIX=0%.
   2) Force paint, then clear base classes (so overlay fully owns visuals).
   3) Animate MIX → 100%.
   4) On transition end: remove overlay and set base to nextTag. */

/* Fallback (if cross-fade unsupported): simple overlay opacity crossfade between two layers */

// ensure a single child effect layer (created on demand)



// Map boolean state -> overlay class

// Ensure overlay element (ephemeral per animation)

// fade the lines ON (to reach “both”) while keeping the current solid tint visible

// fade the lines OFF (leaving a solid tint visible underneath)

// optional: only when transitioning to/from NONE (so solid tint itself fades)

// apply base bg classes (your CSS owns the final look)

// Transitions WITHOUT double-tint and WITHOUT opposite-angle overlays

















// mirror "operational" everywhere (DB + all UIs)
// NEW: place exactly one person into a single cell (or none). Returns personId or null.

// NEW: round-robin fill over stations for one slot






// Can this person be placed in this station for this slot, given current state?

// Which of these stations are valid for this person right now?





const FIRST_RUN_TOUR_STORAGE_KEY='planning.firstRunTour';
const FIRST_RUN_TOUR_DONE_VALUE='completed';
const FIRST_RUN_TOUR_NEVER_VALUE='never';
let onboardingTourState=null;























buildDefaultSlots();
function buildDefaultSlots(){const defs=[];const add=(factoryId,dayType,arr)=>{arr.forEach((s,i)=>defs.push({id:`${factoryId}-${dayType}-${i+1}`,factoryId,dayType,start:s[0],end:s[1],type:s[2],sort:i+1}));};const work='Work',br='Break';const dayMonFri=[["06:55","07:55",work],["07:55","08:55",work],["08:55","09:15",br],["09:15","10:30",work],["10:30","11:35",work],["11:35","12:10",br],["12:10","13:45",work],["13:45","14:00",br],["14:00","14:57",work]];const eveMonThu=[["14:52","16:00",work],["16:00","17:10",work],["17:10","17:45",br],["17:45","19:00",work],["19:00","20:30",work],["20:30","20:55",br],["20:55","22:30",work],["22:30","22:45",br],["22:45","00:31",work]];const eveFri=[["14:52","16:00",work],["16:00","17:00",work],["17:00","17:25",br],["17:25","18:00",work],["18:00","19:00",work]];const overtime=[["07:00","08:00",work],["08:00","09:00",work],["09:00","09:25",br],["09:25","11:30",work],["11:30","12:05",br],["12:05","13:45",work],["13:45","14:00",br],["14:00","15:00",work]];const night=[["00:31","01:00",work],["01:00","01:35",br],["01:35","03:00",work],["03:00","03:25",br],["03:25","05:00",work],["05:00","05:15",br],["05:15","07:00",work]];for(const f of DB.factories.map(f=>f.id)){add(f,DayType.Day,dayMonFri);add(f,DayType.EveningMonThu,eveMonThu);add(f,DayType.EveningFri,eveFri);add(f,DayType.OvertimeDay,overtime);add(f,DayType.Night,night);}DB.timeSlots=defs;}

(function init(){
	const qs=new URLSearchParams(location.search);
	mode=qs.get('mode')==='edit'?'edit':'viewer';
	currentFactoryId=parseFactoryId(qs.get('factory')||'1');
	applyViewerEditSetting(getViewerEditSetting(),{persist:false});
	applyViewerWarningsSetting(getViewerWarningsSetting(),{persist:false,rerender:false});
	applyCoordAutoLogoutSetting(getCoordAutoLogoutMinutes(),{persist:false});

	const facSel=document.getElementById('factorySel');
	const settingsFacSel=document.getElementById('settingsFactorySel');
	const shiftSel=document.getElementById('shiftSel');
	const settingsShiftSel=document.getElementById('settingsShiftSel');

	initShiftData();
	setShift(qs.get('shift')||'evening',{updateUrl:false});
	applyMode(mode,{updateUrl:false,animateNav:false});
	document.documentElement.classList.add('mode-ready');
	updateToastAreaPosition();
	if(mode==='edit'){
		showCoordLogin({
			onSuccess:()=>{
				applyMode('edit');
				renderSettings();
				rebuildAll();
				maybeStartFirstRunTour();
			}
		});
	}

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

		resetAssignmentHistory();
		if(rerenderSettings) renderSettings();
		rebuildAll();
	}

	function applyShiftChange(v,{rerenderSettings=false,updateUrl=true}={}){
		setShift(v,{updateUrl});
		syncShiftSelectors();
		suggestAndApplyTemplates();
		resetAssignmentHistory();
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

	const todayStr=formatLocalDateYYYYMMDD(new Date());
	document.getElementById('dateInput').value=todayStr;
	currentDate=new Date(todayStr+'T00:00:00');
	document.getElementById('dateInput').addEventListener('change',e=>{currentDate=new Date(e.target.value+'T00:00:00');syncDayChoiceFromDate();syncViewerShiftIfNeeded();toggleDayButtons();suggestAndApplyTemplates();resetAssignmentHistory();rebuildAll();});
	document.getElementById('btnToday').addEventListener('click',()=>{dayChoice='today';setDateToOffset(0);syncViewerShiftIfNeeded();toggleDayButtons();suggestAndApplyTemplates();resetAssignmentHistory();rebuildAll();});
	document.getElementById('btnTomorrow').addEventListener('click',()=>{dayChoice='tomorrow';setDateToOffset(1);toggleDayButtons();suggestAndApplyTemplates();resetAssignmentHistory();rebuildAll();});
	const templateSel=document.getElementById('templateSel');
	templateSel.classList.add('d-none');
	templateSel.addEventListener('change',e=>{currentDayType=e.target.value;resetAssignmentHistory();rebuildAll();});
	bindTopbarActionDelegation();
	relocateTopbarSecondaryActions();
	document.getElementById('runRandomizeBtn').addEventListener('click',runRandomizer);
	const reportModalEl=document.getElementById('reportModal');
	reportModalEl?.addEventListener('show.bs.modal',()=>renderDerivedReport());
	applyInactivityResetSetting(getInactivityResetMinutes(),{persist:false});
	applyViewerShiftLeadSetting(getViewerShiftLeadMinutes(),{persist:false});
	renderSettings();
	document.getElementById('idleResetMinutes')?.addEventListener('change',e=>applyInactivityResetSetting(e.target.value));
	document.getElementById('viewerShiftLeadMinutes')?.addEventListener('change',e=>applyViewerShiftLeadSetting(e.target.value));
	document.getElementById('viewerCanEditAssignments')?.addEventListener('change',e=>applyViewerEditSetting(e.target.checked));
	document.getElementById('viewerShowWarnings')?.addEventListener('change',e=>applyViewerWarningsSetting(e.target.checked));
	document.getElementById('coordAutoLogoutMinutes')?.addEventListener('change',e=>applyCoordAutoLogoutSetting(e.target.value));
	document.getElementById('replayTourBtn')?.addEventListener('click',replayFirstRunTour);
	const modeBadge=document.getElementById('modeBadge');
	modeBadge?.addEventListener('click',()=>{
		clearModeBadgeTooltip();
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
				maybeStartFirstRunTour();
			}
		});
	});
	modeBadge?.addEventListener('keydown',e=>{
		if(e.key==='Enter' || e.key===' '){
			e.preventDefault();
			modeBadge.click();
		}
	});
	syncDayChoiceFromDate();
	toggleDayButtons();
	suggestAndApplyTemplates();
	updateHeaderContext();
	rebuildAll();
	maybeStartFirstRunTour();
	window.addEventListener('resize',fitToViewport);
	window.addEventListener('resize',updateToastAreaPosition);
	window.addEventListener('resize',relocateTopbarSecondaryActions);
	document.addEventListener('mousedown',ev=>{const ov=document.querySelector('.picker-overlay');if(ov&&!ov.contains(ev.target))closeAnyPicker();});
	document.addEventListener('keydown',ev=>{
		if(mode!=='edit') return;
		if(!ev.ctrlKey && !ev.metaKey) return;
		const target=ev.target;
		if(target && (target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target.tagName))) return;
		const key=String(ev.key||'').toLowerCase();
		if(key==='z' && !ev.shiftKey){
			ev.preventDefault();
			undoAssignmentChange();
			return;
		}
		if(key==='y' || (key==='z' && ev.shiftKey)){
			ev.preventDefault();
			redoAssignmentChange();
		}
	});
})();

(function initTheme(){const saved=localStorage.getItem('planning.theme');if(saved){document.documentElement.setAttribute('data-bs-theme',saved);}document.getElementById('themeBtn').addEventListener('click',()=>{const cur=document.documentElement.getAttribute('data-bs-theme')||'auto';const nxt=cur==='light'?'dark':'light';document.documentElement.setAttribute('data-bs-theme',nxt);localStorage.setItem('planning.theme',nxt);rebuildAll();});})();










































const _pillMarqueeState = new WeakMap();











































async function saveAll(){
	console.log('Saving assignments (mock):',DB.assignments.filter(a=>a.date===getSelectedDateStr()&&a.factoryId===currentFactoryId&&a.dayType===currentDayType));
}

function renderSettings(){syncInactivitySettingInput();syncViewerShiftLeadSettingInput();syncViewerEditSettingInput();syncViewerWarningsSettingInput();syncCoordAutoLogoutInput();renderSettingsInfoTexts();renderPersonGroups();renderGroupTable();renderStationsByGroup();renderSlotEditor();renderConstraintTable();}

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
							<th style="width:12%"><span class="d-inline-flex align-items-center gap-1">Närvarande <button type="button" class="settings-info-btn summary-info-btn small fw-semibold" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-custom-class="info-tooltip" data-bs-html="true" data-bs-title="<strong>Aktiverad:</strong> Personen kan användas i planeringen.<br><strong>Avaktiverad:</strong> Personen räknas som frånvarande och kan inte tilldelas."><i class="bi bi-info-circle-fill" aria-hidden="true"></i><span class="visually-hidden">Info om Närvarande</span></button></span></th>
							<th style="width:12%"><span class="d-inline-flex align-items-center gap-1">Utbildning <button type="button" class="settings-info-btn summary-info-btn small fw-semibold" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-custom-class="info-tooltip" data-bs-html="true" data-bs-title="Öppnar och redigerar personens utbildningar per station"><i class="bi bi-info-circle-fill" aria-hidden="true"></i><span class="visually-hidden">Info om Utbildning</span></button></span></th>
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
			if(el.dataset.bind==='name'){
				p.name = el.value.trim();
				rebuildAll();
			}
			if(el.dataset.bind==='present'){
				p.present = el.checked;
				rebuildAll();
			}
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
			<thead><tr><th style="width:32px"></th><th>Namn</th><th>Kapacitet</th><th><span class="d-inline-flex align-items-center gap-1">Operativ <button type="button" class="settings-info-btn summary-info-btn small fw-semibold" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-custom-class="info-tooltip" data-bs-html="true" data-bs-title="<strong>Aktiverad:</strong> Stationen kan väljas och fyllas vid autogenerering.<br><strong>Avaktiverad:</strong> Stationen exkluderas från autogenerering."><i class="bi bi-info-circle-fill" aria-hidden="true"></i><span class="visually-hidden">Info om Operativ</span></button></span></th><th></th></tr></thead>
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
				if(el.dataset.bind==='op') s.operational=el.checked;
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





// Async confirm modal that dims/blur any open modal behind it
















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




function armHandleOnlyRowDrag(tr){
	const handle=tr.querySelector('.drag-handle');
	if(!handle){
		tr.draggable=true;
		return;
	}
	tr.draggable=false;
	const disarm=()=>{ tr.draggable=false; };
	handle.addEventListener('pointerdown',()=>{
		tr.draggable=true;
		window.addEventListener('pointerup', disarm, { once:true, capture:true });
		window.addEventListener('pointercancel', disarm, { once:true, capture:true });
	});
	tr.addEventListener('dragend', disarm);
	tr.addEventListener('drop', disarm);
}

function enableRowDrag(tbody, onReorder){
	let dragId=null;
	tbody.querySelectorAll('tr').forEach(tr=>{
		armHandleOnlyRowDrag(tr);
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
		armHandleOnlyRowDrag(tr);
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


// Toasts

// Explain *why* a placement is blocked (mirror of isPersonAllowedFor)

// Context so we toast only for the *latest* move warnings
let _toastContextActive=false;
let _lastMovedPersonId=null;



// one-time, global delegated tooltips
new bootstrap.Tooltip(document.body, {
	selector: '[data-bs-toggle="tooltip"]',
	container: 'body',
	boundary: 'viewport',
	html: true,
	trigger: 'hover',
	sanitize: false
});

document.addEventListener('show.bs.tooltip', ev=>{
	const target = ev.target;
	if(!(target instanceof Element)) return;
	if(target.matches('.cell') && target.querySelector('.person-pill:hover')){
		ev.preventDefault();
		return;
	}
	if(target.matches('.person-pill')){
		updatePersonPillTooltip(target, { isTruncated: target.dataset.nameTruncated === '1' });
		const cell = target.closest('.cell');
		if(cell){
			const cellTip = bootstrap.Tooltip.getInstance(cell);
			if(cellTip){
				try{ cellTip.hide(); }catch(_){}
				cellTip.dispose();
			}
		}
	}
	document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el=>{
		if(el===target) return;
		const tip = bootstrap.Tooltip.getInstance(el);
		if(tip){
			try{ tip.hide(); }catch(_){}
		}
	});
});
new bootstrap.Popover(document.body, {
	selector: '[data-bs-toggle="popover"]',
	container: 'body',
	html: true,
	trigger: 'focus',
	sanitize: false
});