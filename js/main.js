// Application bootstrap, high-level event wiring, theme handling, and global Bootstrap setup.
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

	function pauseForSchemaDiagnostics(){
		document.documentElement.classList.add('mode-ready');
		[facSel,settingsFacSel,shiftSel,settingsShiftSel].forEach(el=>{
			if(!el) return;
			el.querySelectorAll('button,select,input').forEach(control=>{control.disabled=true;});
			if('disabled' in el) el.disabled=true;
		});
		updateToastAreaPosition();
	}

	const bootDiagnostics=validateDbShape(DB,{context:'init'});
	if(!bootDiagnostics.ok){
		pauseForSchemaDiagnostics();
		return;
	}
	if(!initShiftData() || !setShift(qs.get('shift')||'evening',{updateUrl:false})){
		pauseForSchemaDiagnostics();
		return;
	}
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
		if(!setShift(v,{updateUrl})){
			syncShiftSelectors();
			return;
		}
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
	const printBtn=document.getElementById('printBtn');
	printBtn?.addEventListener('click',()=>window.print());
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

async function saveAll(){
	console.log('Saving assignments (mock):',DB.assignments.filter(a=>a.date===getSelectedDateStr()&&a.factoryId===currentFactoryId&&a.dayType===currentDayType));
}

// one-time, global delegated tooltips
const infoTooltipAllowList = {
	...bootstrap.Tooltip.Default.allowList,
	strong: [],
	br: []
};

new bootstrap.Tooltip(document.body, {
	selector: '[data-bs-toggle="tooltip"]:not([data-bs-custom-class~="info-tooltip"])',
	container: 'body',
	boundary: 'viewport',
	html: false,
	trigger: 'hover'
});

new bootstrap.Tooltip(document.body, {
	selector: '[data-bs-toggle="tooltip"][data-bs-custom-class~="info-tooltip"]',
	container: 'body',
	boundary: 'viewport',
	html: true,
	trigger: 'hover',
	sanitize: true,
	allowList: infoTooltipAllowList
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
