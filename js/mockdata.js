const DB={
	appSettings:{CoordinatorPasswordHash:'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'},
	factories:[{id:1,title:'Fabrik 1'},{id:2,title:'Fabrik 2'},{id:'expedition',title:'Expedition'}],
	groups:[
		{id:101,factoryId:2,title:'Grön',color:'#6fbf73',coordinator:'Matilda Ferm'},
		{id:102,factoryId:2,title:'Gul',color:'#f3c54b',coordinator:'Matilda Nilsson'},
		{id:201,factoryId:1,title:'Orange',color:'#f6b26b',coordinator:'Sajma Olevic'},
		{id:202,factoryId:1,title:'Grå',color:'#cccccc',coordinator:'Henrik Sandberg'},
		{id:301,factoryId:'expedition',title:'Blå',color:'#4AA1F2',coordinator:'Loredana Tiganila'}
	],
	/* visual order per factory: tokens are 'resurs' or group ids */
	groupDisplayOrder:{1:[201,'resurs',202],2:[101,'resurs',102],expedition:[301]},
	stations:[
		{id:501,factoryId:2,groupId:101,title:'EQ-P-0626',defaultCapacity:2,operational:true,sort:1},
		{id:502,factoryId:2,groupId:101,title:'EQ-P-0627',defaultCapacity:2,operational:true,sort:2},
		{id:503,factoryId:2,groupId:101,title:'Montering Renrum',defaultCapacity:2,operational:true,sort:3},
		{id:504,factoryId:2,groupId:101,title:'Packa sterillåda',defaultCapacity:2,operational:true,sort:4},
		{id:505,factoryId:2,groupId:101,title:'EQ-P-0887',defaultCapacity:2,operational:true,sort:5},
		{id:506,factoryId:2,groupId:101,title:'EQ-P-0794',defaultCapacity:2,operational:true,sort:6},
		{id:507,factoryId:2,groupId:101,title:'EV halvfabrikat',defaultCapacity:2,operational:true,sort:7},
		{id:508,factoryId:2,groupId:101,title:'Multibase',defaultCapacity:2,operational:true,sort:8},
		{id:509,factoryId:2,groupId:101,title:'EQ-P-0550',defaultCapacity:2,operational:true,sort:9},
		{id:521,factoryId:2,groupId:102,title:'EQ-P-0581A',defaultCapacity:2,operational:true,sort:1},
		{id:522,factoryId:2,groupId:102,title:'EQ-P-0581B',defaultCapacity:2,operational:true,sort:2},
		{id:523,factoryId:2,groupId:102,title:'TX LAF',defaultCapacity:1,operational:true,sort:3},
		{id:524,factoryId:2,groupId:102,title:'EQ-P-1400 / EQ-P-0099',defaultCapacity:1,operational:true,sort:4},
		{id:525,factoryId:2,groupId:102,title:'Packa sterillåda',defaultCapacity:1,operational:true,sort:5},
		{id:526,factoryId:2,groupId:102,title:'TX halvfabrikat',defaultCapacity:1,operational:true,sort:6},
		{id:527,factoryId:2,groupId:102,title:'Montera UNI',defaultCapacity:1,operational:true,sort:7},
		{id:528,factoryId:2,groupId:102,title:'Cochlear LAF',defaultCapacity:1,operational:true,sort:8},
		{id:529,factoryId:2,groupId:102,title:'Cochlear svets',defaultCapacity:1,operational:true,sort:9},
		
		{id:601,factoryId:1,groupId:201,title:'Förbereda disk',defaultCapacity:1,operational:true,sort:1},
		{id:602,factoryId:1,groupId:201,title:'Processmaskiner',defaultCapacity:1,operational:true,sort:2},
		{id:603,factoryId:1,groupId:201,title:'Blästra EQ-P-1100',defaultCapacity:1,operational:true,sort:3},
		{id:604,factoryId:1,groupId:201,title:'Blästra EQ-P-0044',defaultCapacity:1,operational:true,sort:4},
		{id:605,factoryId:1,groupId:201,title:'Montera carrier',defaultCapacity:1,operational:true,sort:5},
		{id:606,factoryId:1,groupId:201,title:'Bas/syra dragskåp',defaultCapacity:1,operational:true,sort:6},
		{id:607,factoryId:1,groupId:201,title:'EQ-P-0794',defaultCapacity:1,operational:true,sort:7},
		{id:621,factoryId:1,groupId:202,title:'Anodisering',defaultCapacity:1,operational:true,sort:1},
		{id:622,factoryId:1,groupId:202,title:'Diska',defaultCapacity:1,operational:true,sort:2},
		{id:623,factoryId:1,groupId:202,title:'Blästra EQ-P-0802',defaultCapacity:1,operational:true,sort:3},
		{id:624,factoryId:1,groupId:202,title:'Etsa Plus',defaultCapacity:1,operational:true,sort:4},
		{id:625,factoryId:1,groupId:202,title:'Montera / demontera',defaultCapacity:1,operational:true,sort:5},
		{id:626,factoryId:1,groupId:202,title:'Montera innerförpackning',defaultCapacity:1,operational:true,sort:6},
		{id:627,factoryId:1,groupId:202,title:'Blister A EQ-P-0809',defaultCapacity:1,operational:true,sort:7},
		
		{id:700,factoryId:1,groupId:null,title:'Resurs',defaultCapacity:2,operational:true,sort:0,isResurs:true},
		{id:701,factoryId:2,groupId:null,title:'Resurs',defaultCapacity:2,operational:true,sort:0,isResurs:true},
		
		{id:801,factoryId:'expedition',groupId:301,title:'Manuell pack',defaultCapacity:2,operational:true,sort:0,isResurs:false},
		{id:802,factoryId:'expedition',groupId:301,title:'Artemis',defaultCapacity:2,operational:true,sort:0,isResurs:false},
		{id:803,factoryId:'expedition',groupId:301,title:'Påsmaskin',defaultCapacity:2,operational:true,sort:0,isResurs:false},
		{id:804,factoryId:'expedition',groupId:301,title:'Boxpackare EQ-P-0006',defaultCapacity:2,operational:true,sort:0,isResurs:false},
		{id:805,factoryId:'expedition',groupId:301,title:'Packa kit',defaultCapacity:2,operational:true,sort:0,isResurs:false},
		{id:806,factoryId:'expedition',groupId:301,title:'Avsyna och justera Sleeve',defaultCapacity:2,operational:true,sort:0,isResurs:false},
		{id:807,factoryId:'expedition',groupId:301,title:'Cochlear',defaultCapacity:2,operational:true,sort:0,isResurs:false},
		{id:808,factoryId:'expedition',groupId:301,title:'Skicka till sterilisering',defaultCapacity:2,operational:true,sort:0,isResurs:false},
		{id:809,factoryId:'expedition',groupId:301,title:'Boxpackaren EQ-P-0792',defaultCapacity:2,operational:true,sort:0,isResurs:false},
		{id:810,factoryId:'expedition',groupId:301,title:'Batcha',defaultCapacity:2,operational:true,sort:0,isResurs:false},
		{id:811,factoryId:'expedition',groupId:301,title:'Packa sterillåda A/X',defaultCapacity:2,operational:true,sort:0,isResurs:false},
		{id:812,factoryId:'expedition',groupId:301,title:'Orderavslut',defaultCapacity:2,operational:true,sort:0,isResurs:false},
	],
	persons:[
		{"id": 105, "name": "Matilda N", "factoryId": 2, "groupId": 102, "isNight": false, "present": true},
		{"id": 106, "name": "Nuvia", "factoryId": 2, "groupId": 102, "isNight": true, "present": true},
		{"id": 107, "name": "Thomas E", "factoryId": 2, "groupId": 102, "isNight": false, "present": true},
		{"id": 108, "name": "Elvedina", "factoryId": 2, "groupId": 102, "isNight": true, "present": true},
		{"id": 109, "name": "Fatime", "factoryId": 2, "groupId": 102, "isNight": true, "present": true},
		{"id": 110, "name": "David", "factoryId": 2, "groupId": 102, "isNight": false, "present": true},
		{"id": 111, "name": "Yahye", "factoryId": 2, "groupId": 102, "isNight": false, "present": true},
		{"id": 112, "name": "Mohammed", "factoryId": 2, "groupId": 102, "isNight": false, "present": true},
		{"id": 113, "name": "Dyena", "factoryId": 2, "groupId": 102, "isNight": false, "present": true},
		{"id": 114, "name": "Matilda F", "factoryId": 2, "groupId": 101, "isNight": false, "present": true},
		{"id": 115, "name": "Markus", "factoryId": 2, "groupId": 101, "isNight": false, "present": true},
		{"id": 116, "name": "Anders", "factoryId": 2, "groupId": 101, "isNight": false, "present": true},
		{"id": 117, "name": "Milica", "factoryId": 2, "groupId": 101, "isNight": true, "present": true},
		{"id": 118, "name": "Kemal", "factoryId": 2, "groupId": 101, "isNight": false, "present": true},
		{"id": 119, "name": "Liridon", "factoryId": 2, "groupId": 101, "isNight": false, "present": true},
		{"id": 120, "name": "Erma", "factoryId": 2, "groupId": 101, "isNight": false, "present": true},
		{"id": 121, "name": "Thomas O", "factoryId": 2, "groupId": 101, "isNight": false, "present": true},
		{"id": 122, "name": "Veronika", "factoryId": 2, "groupId": 101, "isNight": true, "present": true},
		{"id": 123, "name": "Loredana", "factoryId": 'expedition', "groupId": 301, "isNight": true, "present": true},
		{"id": 124, "name": "Sofia", "factoryId": 2, "groupId": 101, "isNight": false, "present": true},
		{"id": 125, "name": "Sara", "factoryId": 2, "groupId": 102, "isNight": false, "present": true},
		{"id": 126, "name": "Anna", "factoryId": 1, "groupId": 201, "isNight": false, "present": true},
		{"id": 127, "name": "Johan", "factoryId": 1, "groupId": 201, "isNight": false, "present": true},
		{"id": 128, "name": "Emma", "factoryId": 1, "groupId": 201, "isNight": true, "present": true},
		{"id": 129, "name": "Mikael", "factoryId": 1, "groupId": 201, "isNight": false, "present": true},
		{"id": 130, "name": "Lina", "factoryId": 1, "groupId": 201, "isNight": true, "present": true},
		{"id": 131, "name": "Oskar", "factoryId": 1, "groupId": 201, "isNight": false, "present": true},
		{"id": 132, "name": "Nora", "factoryId": 1, "groupId": 201, "isNight": true, "present": true},
		{"id": 133, "name": "Viktor", "factoryId": 1, "groupId": 201, "isNight": false, "present": true},
		{"id": 134, "name": "Felicia", "factoryId": 1, "groupId": 201, "isNight": false, "present": true},
		{"id": 135, "name": "Anton", "factoryId": 1, "groupId": 201, "isNight": true, "present": true},
		{"id": 136, "name": "Maja", "factoryId": 1, "groupId": 202, "isNight": false, "present": true},
		{"id": 137, "name": "Elias", "factoryId": 1, "groupId": 202, "isNight": true, "present": true},
		{"id": 138, "name": "Ida", "factoryId": 1, "groupId": 202, "isNight": false, "present": true},
		{"id": 139, "name": "Albin", "factoryId": 1, "groupId": 202, "isNight": false, "present": true},
		{"id": 140, "name": "Elin", "factoryId": 1, "groupId": 202, "isNight": true, "present": true},
		{"id": 141, "name": "Filip", "factoryId": 1, "groupId": 202, "isNight": false, "present": true},
		{"id": 142, "name": "Wilma", "factoryId": 1, "groupId": 202, "isNight": true, "present": true},
		{"id": 143, "name": "Axel", "factoryId": 1, "groupId": 202, "isNight": false, "present": true},
		{"id": 144, "name": "Tilda", "factoryId": 1, "groupId": 202, "isNight": false, "present": true},
		{"id": 145, "name": "Hugo", "factoryId": 1, "groupId": 202, "isNight": true, "present": true},
		{"id": 146, "name": "Nadja", "factoryId": "expedition", "groupId": 301, "isNight": true, "present": true},
		{"id": 147, "name": "Kevin", "factoryId": "expedition", "groupId": 301, "isNight": false, "present": true},
		{"id": 148, "name": "Mariam", "factoryId": "expedition", "groupId": 301, "isNight": true, "present": true},
		{"id": 149, "name": "Daniel", "factoryId": "expedition", "groupId": 301, "isNight": false, "present": true},
		{"id": 150, "name": "Rebecka", "factoryId": "expedition", "groupId": 301, "isNight": true, "present": true},
		{"id": 151, "name": "Mona", "factoryId": "expedition", "groupId": 301, "isNight": false, "present": true},
		{"id": 152, "name": "Arvid", "factoryId": "expedition", "groupId": 301, "isNight": true, "present": true},
		{"id": 153, "name": "Samira", "factoryId": "expedition", "groupId": 301, "isNight": false, "present": true},
		{"id": 154, "name": "Robin", "factoryId": "expedition", "groupId": 301, "isNight": true, "present": true},
	],
	training:[
	  {
		"personId": 105,
		"stationId": 527
	  },
	  {
		"personId": 105,
		"stationId": 521
	  },
	  {
		"personId": 105,
		"stationId": 522
	  },
	  {
		"personId": 105,
		"stationId": 524
	  },
	  {
		"personId": 105,
		"stationId": 526
	  },
	  {
		"personId": 105,
		"stationId": 528
	  },
	  {
		"personId": 105,
		"stationId": 525
	  },
	  {
		"personId": 105,
		"stationId": 507
	  },
	  {
		"personId": 105,
		"stationId": 503
	  },
	  {
		"personId": 105,
		"stationId": 501
	  },
	  {
		"personId": 105,
		"stationId": 502
	  },
	  {
		"personId": 105,
		"stationId": 508
	  },
	  {
		"personId": 105,
		"stationId": 509
	  },
	  {
		"personId": 105,
		"stationId": 505
	  },
	  {
		"personId": 105,
		"stationId": 527
	  },
	  {
		"personId": 105,
		"stationId": 521
	  },
	  {
		"personId": 105,
		"stationId": 522
	  },
	  {
		"personId": 105,
		"stationId": 524
	  },
	  {
		"personId": 105,
		"stationId": 528
	  },
	  {
		"personId": 105,
		"stationId": 507
	  },
	  {
		"personId": 105,
		"stationId": 503
	  },
	  {
		"personId": 105,
		"stationId": 501
	  },
	  {
		"personId": 105,
		"stationId": 502
	  },
	  {
		"personId": 105,
		"stationId": 508
	  },
	  {
		"personId": 105,
		"stationId": 509
	  },
	  {
		"personId": 105,
		"stationId": 505
	  },
	  {
		"personId": 119,
		"stationId": 527
	  },
	  {
		"personId": 119,
		"stationId": 521
	  },
	  {
		"personId": 119,
		"stationId": 522
	  },
	  {
		"personId": 119,
		"stationId": 524
	  },
	  {
		"personId": 119,
		"stationId": 526
	  },
	  {
		"personId": 119,
		"stationId": 528
	  },
	  {
		"personId": 119,
		"stationId": 507
	  },
	  {
		"personId": 119,
		"stationId": 503
	  },
	  {
		"personId": 119,
		"stationId": 501
	  },
	  {
		"personId": 119,
		"stationId": 502
	  },
	  {
		"personId": 119,
		"stationId": 508
	  },
	  {
		"personId": 106,
		"stationId": 523
	  },
	  {
		"personId": 106,
		"stationId": 521
	  },
	  {
		"personId": 106,
		"stationId": 522
	  },
	  {
		"personId": 106,
		"stationId": 524
	  },
	  {
		"personId": 106,
		"stationId": 526
	  },
	  {
		"personId": 106,
		"stationId": 525
	  },
	  {
		"personId": 106,
		"stationId": 507
	  },
	  {
		"personId": 106,
		"stationId": 503
	  },
	  {
		"personId": 106,
		"stationId": 501
	  },
	  {
		"personId": 106,
		"stationId": 502
	  },
	  {
		"personId": 106,
		"stationId": 508
	  },
	  {
		"personId": 106,
		"stationId": 509
	  },
	  {
		"personId": 106,
		"stationId": 505
	  },
	  {
		"personId": 107,
		"stationId": 521
	  },
	  {
		"personId": 107,
		"stationId": 522
	  },
	  {
		"personId": 108,
		"stationId": 527
	  },
	  {
		"personId": 108,
		"stationId": 523
	  },
	  {
		"personId": 108,
		"stationId": 521
	  },
	  {
		"personId": 108,
		"stationId": 522
	  },
	  {
		"personId": 108,
		"stationId": 526
	  },
	  {
		"personId": 108,
		"stationId": 507
	  },
	  {
		"personId": 108,
		"stationId": 503
	  },
	  {
		"personId": 108,
		"stationId": 501
	  },
	  {
		"personId": 108,
		"stationId": 506
	  },
	  {
		"personId": 108,
		"stationId": 509
	  },
	  {
		"personId": 109,
		"stationId": 523
	  },
	  {
		"personId": 109,
		"stationId": 521
	  },
	  {
		"personId": 109,
		"stationId": 522
	  },
	  {
		"personId": 109,
		"stationId": 526
	  },
	  {
		"personId": 109,
		"stationId": 528
	  },
	  {
		"personId": 109,
		"stationId": 525
	  },
	  {
		"personId": 109,
		"stationId": 507
	  },
	  {
		"personId": 109,
		"stationId": 503
	  },
	  {
		"personId": 109,
		"stationId": 502
	  },
	  {
		"personId": 109,
		"stationId": 506
	  },
	  {
		"personId": 109,
		"stationId": 509
	  },
	  {
		"personId": 110,
		"stationId": 523
	  },
	  {
		"personId": 110,
		"stationId": 521
	  },
	  {
		"personId": 110,
		"stationId": 522
	  },
	  {
		"personId": 110,
		"stationId": 524
	  },
	  {
		"personId": 110,
		"stationId": 526
	  },
	  {
		"personId": 110,
		"stationId": 528
	  },
	  {
		"personId": 110,
		"stationId": 507
	  },
	  {
		"personId": 110,
		"stationId": 503
	  },
	  {
		"personId": 110,
		"stationId": 501
	  },
	  {
		"personId": 110,
		"stationId": 502
	  },
	  {
		"personId": 110,
		"stationId": 508
	  },
	  {
		"personId": 110,
		"stationId": 506
	  },
	  {
		"personId": 110,
		"stationId": 509
	  },
	  {
		"personId": 110,
		"stationId": 505
	  },
	  {
		"personId": 110,
		"stationId": 527
	  },
	  {
		"personId": 110,
		"stationId": 523
	  },
	  {
		"personId": 110,
		"stationId": 521
	  },
	  {
		"personId": 110,
		"stationId": 522
	  },
	  {
		"personId": 110,
		"stationId": 524
	  },
	  {
		"personId": 110,
		"stationId": 526
	  },
	  {
		"personId": 110,
		"stationId": 528
	  },
	  {
		"personId": 110,
		"stationId": 525
	  },
	  {
		"personId": 110,
		"stationId": 507
	  },
	  {
		"personId": 110,
		"stationId": 503
	  },
	  {
		"personId": 110,
		"stationId": 501
	  },
	  {
		"personId": 110,
		"stationId": 502
	  },
	  {
		"personId": 110,
		"stationId": 508
	  },
	  {
		"personId": 110,
		"stationId": 506
	  },
	  {
		"personId": 110,
		"stationId": 509
	  },
	  {
		"personId": 111,
		"stationId": 523
	  },
	  {
		"personId": 111,
		"stationId": 521
	  },
	  {
		"personId": 111,
		"stationId": 522
	  },
	  {
		"personId": 111,
		"stationId": 524
	  },
	  {
		"personId": 111,
		"stationId": 526
	  },
	  {
		"personId": 111,
		"stationId": 525
	  },
	  {
		"personId": 111,
		"stationId": 507
	  },
	  {
		"personId": 111,
		"stationId": 503
	  },
	  {
		"personId": 111,
		"stationId": 501
	  },
	  {
		"personId": 111,
		"stationId": 506
	  },
	  {
		"personId": 111,
		"stationId": 509
	  },
	  {
		"personId": 112,
		"stationId": 523
	  },
	  {
		"personId": 112,
		"stationId": 521
	  },
	  {
		"personId": 112,
		"stationId": 522
	  },
	  {
		"personId": 112,
		"stationId": 526
	  },
	  {
		"personId": 112,
		"stationId": 503
	  },
	  {
		"personId": 112,
		"stationId": 501
	  },
	  {
		"personId": 112,
		"stationId": 502
	  },
	  {
		"personId": 106,
		"stationId": 527
	  },
	  {
		"personId": 106,
		"stationId": 523
	  },
	  {
		"personId": 106,
		"stationId": 521
	  },
	  {
		"personId": 106,
		"stationId": 522
	  },
	  {
		"personId": 106,
		"stationId": 524
	  },
	  {
		"personId": 106,
		"stationId": 526
	  },
	  {
		"personId": 106,
		"stationId": 507
	  },
	  {
		"personId": 106,
		"stationId": 503
	  },
	  {
		"personId": 106,
		"stationId": 501
	  },
	  {
		"personId": 106,
		"stationId": 502
	  },
	  {
		"personId": 106,
		"stationId": 505
	  },
	  {
		"personId": 114,
		"stationId": 527
	  },
	  {
		"personId": 114,
		"stationId": 523
	  },
	  {
		"personId": 114,
		"stationId": 521
	  },
	  {
		"personId": 114,
		"stationId": 522
	  },
	  {
		"personId": 114,
		"stationId": 524
	  },
	  {
		"personId": 114,
		"stationId": 526
	  },
	  {
		"personId": 114,
		"stationId": 529
	  },
	  {
		"personId": 114,
		"stationId": 525
	  },
	  {
		"personId": 114,
		"stationId": 507
	  },
	  {
		"personId": 114,
		"stationId": 503
	  },
	  {
		"personId": 114,
		"stationId": 501
	  },
	  {
		"personId": 114,
		"stationId": 502
	  },
	  {
		"personId": 114,
		"stationId": 508
	  },
	  {
		"personId": 114,
		"stationId": 506
	  },
	  {
		"personId": 114,
		"stationId": 509
	  },
	  {
		"personId": 113,
		"stationId": 523
	  },
	  {
		"personId": 113,
		"stationId": 521
	  },
	  {
		"personId": 113,
		"stationId": 522
	  },
	  {
		"personId": 113,
		"stationId": 529
	  },
	  {
		"personId": 113,
		"stationId": 525
	  },
	  {
		"personId": 113,
		"stationId": 507
	  },
	  {
		"personId": 113,
		"stationId": 503
	  },
	  {
		"personId": 113,
		"stationId": 501
	  },
	  {
		"personId": 113,
		"stationId": 508
	  },
	  {
		"personId": 113,
		"stationId": 506
	  },
	  {
		"personId": 113,
		"stationId": 509
	  },
	  {
		"personId": 112,
		"stationId": 521
	  },
	  {
		"personId": 112,
		"stationId": 522
	  },
	  {
		"personId": 112,
		"stationId": 526
	  },
	  {
		"personId": 112,
		"stationId": 507
	  },
	  {
		"personId": 112,
		"stationId": 503
	  },
	  {
		"personId": 112,
		"stationId": 501
	  },
	  {
		"personId": 112,
		"stationId": 502
	  },
	  {
		"personId": 114,
		"stationId": 527
	  },
	  {
		"personId": 114,
		"stationId": 523
	  },
	  {
		"personId": 114,
		"stationId": 521
	  },
	  {
		"personId": 114,
		"stationId": 522
	  },
	  {
		"personId": 114,
		"stationId": 524
	  },
	  {
		"personId": 114,
		"stationId": 526
	  },
	  {
		"personId": 114,
		"stationId": 529
	  },
	  {
		"personId": 114,
		"stationId": 525
	  },
	  {
		"personId": 114,
		"stationId": 507
	  },
	  {
		"personId": 114,
		"stationId": 503
	  },
	  {
		"personId": 114,
		"stationId": 501
	  },
	  {
		"personId": 114,
		"stationId": 502
	  },
	  {
		"personId": 114,
		"stationId": 508
	  },
	  {
		"personId": 114,
		"stationId": 506
	  },
	  {
		"personId": 114,
		"stationId": 509
	  },
	  {
		"personId": 114,
		"stationId": 505
	  },
	  {
		"personId": 120,
		"stationId": 525
	  },
	  {
		"personId": 120,
		"stationId": 507
	  },
	  {
		"personId": 120,
		"stationId": 503
	  },
	  {
		"personId": 120,
		"stationId": 501
	  },
	  {
		"personId": 120,
		"stationId": 506
	  },
	  {
		"personId": 120,
		"stationId": 509
	  },
	  {
		"personId": 120,
		"stationId": 505
	  },
	  {
		"personId": 115,
		"stationId": 526
	  },
	  {
		"personId": 116,
		"stationId": 523
	  },
	  {
		"personId": 116,
		"stationId": 526
	  },
	  {
		"personId": 116,
		"stationId": 525
	  },
	  {
		"personId": 116,
		"stationId": 507
	  },
	  {
		"personId": 116,
		"stationId": 503
	  },
	  {
		"personId": 116,
		"stationId": 506
	  },
	  {
		"personId": 116,
		"stationId": 509
	  },
	  {
		"personId": 116,
		"stationId": 505
	  },
	  {
		"personId": 117,
		"stationId": 523
	  },
	  {
		"personId": 117,
		"stationId": 521
	  },
	  {
		"personId": 117,
		"stationId": 522
	  },
	  {
		"personId": 117,
		"stationId": 507
	  },
	  {
		"personId": 117,
		"stationId": 503
	  },
	  {
		"personId": 117,
		"stationId": 501
	  },
	  {
		"personId": 117,
		"stationId": 502
	  },
	  {
		"personId": 117,
		"stationId": 508
	  },
	  {
		"personId": 117,
		"stationId": 505
	  },
	  {
		"personId": 121,
		"stationId": 523
	  },
	  {
		"personId": 121,
		"stationId": 521
	  },
	  {
		"personId": 121,
		"stationId": 522
	  },
	  {
		"personId": 121,
		"stationId": 526
	  },
	  {
		"personId": 121,
		"stationId": 525
	  },
	  {
		"personId": 121,
		"stationId": 507
	  },
	  {
		"personId": 121,
		"stationId": 503
	  },
	  {
		"personId": 121,
		"stationId": 501
	  },
	  {
		"personId": 121,
		"stationId": 502
	  },
	  {
		"personId": 121,
		"stationId": 506
	  },
	  {
		"personId": 121,
		"stationId": 509
	  },
	  {
		"personId": 121,
		"stationId": 505
	  },
	  {
		"personId": 118,
		"stationId": 521
	  },
	  {
		"personId": 118,
		"stationId": 522
	  },
	  {
		"personId": 118,
		"stationId": 525
	  },
	  {
		"personId": 118,
		"stationId": 507
	  },
	  {
		"personId": 118,
		"stationId": 503
	  },
	  {
		"personId": 118,
		"stationId": 501
	  },
	  {
		"personId": 118,
		"stationId": 502
	  },
	  {
		"personId": 118,
		"stationId": 508
	  },
	  {
		"personId": 118,
		"stationId": 506
	  },
	  {
		"personId": 118,
		"stationId": 509
	  },
	  {
		"personId": 118,
		"stationId": 505
	  },
	  {
		"personId": 119,
		"stationId": 527
	  },
	  {
		"personId": 119,
		"stationId": 523
	  },
	  {
		"personId": 119,
		"stationId": 521
	  },
	  {
		"personId": 119,
		"stationId": 522
	  },
	  {
		"personId": 119,
		"stationId": 524
	  },
	  {
		"personId": 119,
		"stationId": 526
	  },
	  {
		"personId": 119,
		"stationId": 525
	  },
	  {
		"personId": 119,
		"stationId": 507
	  },
	  {
		"personId": 119,
		"stationId": 503
	  },
	  {
		"personId": 119,
		"stationId": 501
	  },
	  {
		"personId": 119,
		"stationId": 502
	  },
	  {
		"personId": 119,
		"stationId": 508
	  },
	  {
		"personId": 119,
		"stationId": 506
	  },
	  {
		"personId": 119,
		"stationId": 509
	  },
	  {
		"personId": 119,
		"stationId": 505
	  },
	  {
		"personId": 120,
		"stationId": 523
	  },
	  {
		"personId": 120,
		"stationId": 525
	  },
	  {
		"personId": 120,
		"stationId": 507
	  },
	  {
		"personId": 120,
		"stationId": 503
	  },
	  {
		"personId": 120,
		"stationId": 501
	  },
	  {
		"personId": 120,
		"stationId": 502
	  },
	  {
		"personId": 120,
		"stationId": 508
	  },
	  {
		"personId": 120,
		"stationId": 506
	  },
	  {
		"personId": 120,
		"stationId": 509
	  },
	  {
		"personId": 120,
		"stationId": 505
	  },
	  {
		"personId": 121,
		"stationId": 527
	  },
	  {
		"personId": 121,
		"stationId": 523
	  },
	  {
		"personId": 121,
		"stationId": 521
	  },
	  {
		"personId": 121,
		"stationId": 522
	  },
	  {
		"personId": 121,
		"stationId": 526
	  },
	  {
		"personId": 121,
		"stationId": 525
	  },
	  {
		"personId": 121,
		"stationId": 507
	  },
	  {
		"personId": 121,
		"stationId": 503
	  },
	  {
		"personId": 121,
		"stationId": 501
	  },
	  {
		"personId": 121,
		"stationId": 502
	  },
	  {
		"personId": 121,
		"stationId": 508
	  },
	  {
		"personId": 121,
		"stationId": 506
	  },
	  {
		"personId": 121,
		"stationId": 509
	  },
	  {
		"personId": 121,
		"stationId": 505
	  },
	  {
		"personId": 122,
		"stationId": 526
	  },
	  {
		"personId": 122,
		"stationId": 525
	  },
	  {
		"personId": 122,
		"stationId": 507
	  },
	  {
		"personId": 122,
		"stationId": 503
	  },
	  {
		"personId": 122,
		"stationId": 501
	  },
	  {
		"personId": 122,
		"stationId": 523
	  },
	  {
		"personId": 122,
		"stationId": 521
	  },
	  {
		"personId": 122,
		"stationId": 522
	  },
	  {
		"personId": 122,
		"stationId": 526
	  },
	  {
		"personId": 122,
		"stationId": 525
	  },
	  {
		"personId": 122,
		"stationId": 507
	  },
	  {
		"personId": 122,
		"stationId": 503
	  },
	  {
		"personId": 122,
		"stationId": 501
	  },
	  {
		"personId": 122,
		"stationId": 502
	  }
	],
	compatibility:[{a:105,b:114}],
	weekdaySettings:[
		{factoryId:1,day:'Mon',nightEarliest:'21:45'},
		{factoryId:1,day:'Tue',nightEarliest:'21:45'},
		{factoryId:1,day:'Wed',nightEarliest:'21:45'},
		{factoryId:1,day:'Thu',nightEarliest:'21:45'},
		{factoryId:1,day:'Fri',nightEarliest:'21:45'},
		{factoryId:2,day:'Mon',nightEarliest:'21:45'},
		{factoryId:2,day:'Tue',nightEarliest:'21:45'},
		{factoryId:2,day:'Wed',nightEarliest:'21:45'},
		{factoryId:2,day:'Thu',nightEarliest:'21:45'},
		{factoryId:2,day:'Fri',nightEarliest:'21:45'}
	],
	timeSlots:[],
	assignments:[]
};
const RAW_DB=JSON.parse(JSON.stringify(DB));

function collectForeignKeyIssues(datasetLabel, data){
	const issues=[];
	const personIds=new Set((data.persons||[]).map(p=>p.id));
	const stationIds=new Set((data.stations||DB.stations||[]).map(s=>s.id));
	const rows=(data.training||[]);
	rows.forEach((row,index)=>{
		if(!personIds.has(row.personId)){
			issues.push({
				dataset:datasetLabel,
				type:'training.personId',
				index,
				personId:row.personId,
				stationId:row.stationId
			});
		}
		if(!stationIds.has(row.stationId)){
			issues.push({
				dataset:datasetLabel,
				type:'training.stationId',
				index,
				personId:row.personId,
				stationId:row.stationId
			});
		}
	});
	return issues;
}

function getMockDataIntegrityIssues(db=DB){
	const issues=[...collectForeignKeyIssues('default',db)];
	if(db.shiftData){
		for(const [shift,shiftData] of Object.entries(db.shiftData)){
			issues.push(...collectForeignKeyIssues(`shift:${shift}`,{
				persons:shiftData.persons,
				stations:db.stations,
				training:shiftData.training
			}));
		}
	}
	return issues;
}

function reconcileTrainingForeignKeys(db=DB,options={}){
	const {datasetLabel='default',throwOnInvalid=false,logInvalidRows=true}=options;
	const personIds=new Set((db.persons||[]).map(p=>p.id));
	const stationIds=new Set((db.stations||[]).map(s=>s.id));
	const invalidRows=[];
	db.training=(db.training||[]).filter((row,index)=>{
		const valid=personIds.has(row.personId)&&stationIds.has(row.stationId);
		if(!valid){
			invalidRows.push({index,personId:row.personId,stationId:row.stationId});
		}
		return valid;
	});
	if(invalidRows.length){
		const summary=`[mockdata] ${datasetLabel} dropped ${invalidRows.length} invalid training row(s): ${invalidRows.map(row=>row.index).join(', ')}`;
		if(throwOnInvalid){
			throw new Error(summary);
		}
		if(logInvalidRows&&typeof console!=='undefined'&&typeof console.warn==='function'){
			console.warn(summary, invalidRows);
		}
	}
	return invalidRows;
}

const shouldThrowOnInvalidTrainingRows=
	typeof process!=='undefined'&&process&&process.env&&process.env.NODE_ENV==='development';
reconcileTrainingForeignKeys(DB,{datasetLabel:'default',throwOnInvalid:shouldThrowOnInvalidTrainingRows});
(function initShiftMockData(){
	const clone=v=>JSON.parse(JSON.stringify(v));
	const shifts=['day','evening','night'];
	const shiftMeta={day:{idBase:10000,label:'Dag',night:false},evening:{idBase:20000,label:'Kväll',night:false},night:{idBase:30000,label:'Natt',night:true}};
	const stationsByFactory=new Map();
	for(const f of DB.factories.map(x=>x.id)){
		stationsByFactory.set(f, DB.stations.filter(s=>s.factoryId===f).map(s=>s.id));
	}

	function pickStationIds(factoryId, personId, count){
		const all=stationsByFactory.get(factoryId)||[];
		if(!all.length) return [];
		const out=[];
		let seed=(personId*1103515245+12345)>>>0;
		while(out.length<count && out.length<all.length){
			seed=(seed*1664525+1013904223)>>>0;
			const idx=seed%all.length;
			const sid=all[idx];
			if(!out.includes(sid)) out.push(sid);
		}
		return out;
	}

	const shiftData={};
	for(const shift of shifts){
		const meta=shiftMeta[shift];
		const persons=DB.persons.map((p,i)=>({
			...clone(p),
			id:meta.idBase+i+1,
			name:`${p.name} (${meta.label})`,
			isNight:meta.night
		}));
		const training=[];
		for(const person of persons){
			const count=2+((person.id+7)%4); // 2..5 stations
			for(const stationId of pickStationIds(person.factoryId, person.id, count)){
				training.push({personId:person.id,stationId});
			}
		}
		shiftData[shift]={
			persons,
			groups:clone(DB.groups),
			timeSlots:clone(DB.timeSlots),
			compatibility:[],
			training,
			assignments:[],
			groupDisplayOrder:clone(DB.groupDisplayOrder)
		};
	}

	DB.shiftData=shiftData;
	DB.persons=clone(shiftData.evening.persons);
	DB.training=clone(shiftData.evening.training);
	DB.assignments=[];
	DB.compatibility=[];

	const issues=getMockDataIntegrityIssues(DB);
	if(issues.length){
		console.warn('[mockdata] integrity issues detected', issues);
	}
})();

if(typeof module!=='undefined'&&module.exports){
	module.exports={DB,RAW_DB,getMockDataIntegrityIssues,reconcileTrainingForeignKeys};
}
