// ==UserScript==
// @name             Nepali WMS layers
// @version          2025.01.11.02
// @author           kid4rm90s
// @description      Displays layers from Nepali WMS services in WME
// @match            https://*.waze.com/*/editor*
// @match            https://*.waze.com/editor
// @exclude          https://*.waze.com/user/editor*
// @run-at           document-end
// @namespace        https://greasyfork.org/en/users/1087400-kid4rm90s
// @license          MIT
// @downloadURL      https://update.greasyfork.org/scripts/521924-nepali-wms-layers.user.js
// @updateURL        https://update.greasyfork.org/scripts/521924-nepali-wms-layers.meta.js 
// ==/UserScript==

/*  Scripts modified from Czech WMS layers (https://greasyfork.org/cs/scripts/35069-czech-wms-layers; https://greasyfork.org/en/scripts/34720-private-czech-wms-layers, https://greasyfork.org/en/scripts/28160) 
orgianl authors: petrjanik, d2-mac, MajkiiTelini, and Croatian WMS layers (https://greasyfork.org/en/scripts/519676-croatian-wms-layers) author: JS55CT */ 

var WMSLayersTechSource = {};
var W;
var OL;
var I18n;
var ZIndexes = {};

function init() {
	W = unsafeWindow.W;
	OL = unsafeWindow.OpenLayers;
	I18n = unsafeWindow.I18n;

	WMSLayersTechSource.tileSizeG = new OL.Size(512,512);
	WMSLayersTechSource.resolutions =	 [156543.03390625,
										  78271.516953125,
										  39135.7584765625,
										  19567.87923828125,
										  9783.939619140625,
										  4891.9698095703125,
										  2445.9849047851562,
										  1222.9924523925781,
										  611.4962261962891,
										  305.74811309814453,
										  152.87405654907226,
										  76.43702827453613,
										  38.218514137268066,
										  19.109257068634033,
										  9.554628534317017,
										  4.777314267158508,
										  2.388657133579254,
										  1.194328566789627,
										  0.5971642833948135,
										  0.298582141697406,
										  0.149291070848703,
										  0.0746455354243515,
										  0.0373227677121757
										 ];
	ZIndexes.base = W.map.olMap.Z_INDEX_BASE.Overlay + 20;
	ZIndexes.overlay = W.map.olMap.Z_INDEX_BASE.Overlay + 150;
	ZIndexes.popup = W.map.olMap.Z_INDEX_BASE.Popup + 150;
	
	// adresy WMS služeb * WMS service addresses
    var service_wms_PL2023 = {"type" : "WMS", "url" : "https://geoserver.softwel.com.np/geoserver/ssrn/wms?CQL_FILTER=dyear%3D%272023%27", "attribution" : "© Department of Roads Nepal", "comment" : "ssrn_PavementLayer2023"};
    var service_wms_BSM_PH = {"type" : "WMS", "url" : "https://geoserver.softwel.com.np/geoserver/prtmp_01/wms?CQL_FILTER=road_class%3D%27PH%27", "attribution" : "© Department of Roads Nepal", "comment" : "BSM Province Highways 2078/79"};
    var service_wms_BSM_PR = {"type" : "WMS", "url" : "https://geoserver.softwel.com.np/geoserver/prtmp_01/wms?CQL_FILTER=road_class%3D%27PR%27", "attribution" : "© Department of Roads Nepal", "comment" : "BSM Province Roads 2078/79"};
	var service_wms_SSRN = {"type" : "WMS", "url" : "https://geoserver.softwel.com.np/geoserver/ssrn/wms?", "attribution" : "© Department of Roads Nepal", "comment" : "National + Province + District Boundaries, Rivers, Junctions"};
	var service_wms_BSM = {"type" : "WMS", "url" : "https://geoserver.softwel.com.np/geoserver/bsm/wms?", "attribution" : "© Department of Roads Nepal", "comment" : "Municipalities names and boundaries"};
	var service_wms_geoportal = {"type" : "WMS", "url" : "https://admin.nationalgeoportal.gov.np/geoserver/wms?", "attribution" : "© National Geoportal Nepal", "comment" : "Municipalities names and boundaries"};

	//skupiny vrstev v menu * MapTile service addresses
	var service_xyz_livemap = {"type" : "XYZ", "url" : ["https://worldtiles1.waze.com/tiles/${z}/${x}/${y}.png?highres=true", "https://worldtiles2.waze.com/tiles/${z}/${x}/${y}.png?highres=true", "https://worldtiles3.waze.com/tiles/${z}/${x}/${y}.png?highres=true"],
							   "attribution" : "© 2006-2023 Waze Mobile. Všechna práva vyhrazena. <a href='https://www.waze.com/legal/notices' target='_blank'>Poznámky</a>", "comment" : "Waze Livemapa"};
	var service_xyz_google = {"type" : "XYZ", "url" : ["https://mts0.googleapis.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}", "https://mts1.googleapis.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}", "https://mts2.googleapis.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}", "https://mts3.googleapis.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}"],
							  "attribution" : "Mapová data ©2023 GeoBasis-DE/BKG (©2009),Google <a href='https://www.google.com/intl/cs_cz/help/terms_maps.html' target='_blank'>Terms and conditions</a>", "comment" : "Google Mapy"};
	var service_xyz_google_terrain = {"type" : "XYZ", "url" : ["https://mts0.googleapis.com/vt/lyrs=p&x=${x}&y=${y}&z=${z}", "https://mts1.googleapis.com/vt/lyrs=p&x=${x}&y=${y}&z=${z}", "https://mts2.googleapis.com/vt/lyrs=p&x=${x}&y=${y}&z=${z}", "https://mts3.googleapis.com/vt/lyrs=p&x=${x}&y=${y}&z=${z}"],
									  "attribution" : "Mapová data ©2023 GeoBasis-DE/BKG (©2009),Google <a href='https://www.google.com/intl/cs_cz/help/terms_maps.html' target='_blank'>Terms and conditions</a>", "comment" : "Google Terénní Mapy"};
	var service_xyz_google_hybrid = {"type" : "XYZ", "url" : ["https://mts0.googleapis.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}", "https://mts1.googleapis.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}", "https://mts2.googleapis.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}", "https://mts3.googleapis.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}"],
									 "attribution" : "Snímky ©2023 Landsat / Copernicus, Google, GEODIS Brno, Mapová data ©2023 GeoBasis-DE/BKG (©2009),Google <a href='https://www.google.com/intl/cs_cz/help/terms_maps.html' target='_blank'>Terms and conditions</a>", "comment" : "Google Hybridní Mapy"};
	var service_xyz_google_streetview = {"type" : "XYZ", "url" : ["https://mts0.google.com/mapslt?lyrs=svv&&x=${x}&y=${y}&z=${z}&style=40", "https://mts1.google.com/mapslt?lyrs=svv&&x=${x}&y=${y}&z=${z}&style=40", "https://mts2.google.com/mapslt?lyrs=svv&&x=${x}&y=${y}&z=${z}&style=40", "https://mts3.google.com/mapslt?lyrs=svv&&x=${x}&y=${y}&z=${z}&style=40"],
										 "attribution" : "Google <a href='https://www.google.com/intl/cs_cz/help/terms_maps.html' target='_blank'>Terms and conditions</a>", "comment" : "Google Streetview"};
	var service_xyz_osm = {"type" : "XYZ", "maxZoom" : 20, "url" : ["https://tile.openstreetmap.org/${z}/${x}/${y}.png"], "attribution" : "© Contributors <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>", "comment" : "OpenStreetMaps"};
	var service_xyz_april = {"type" : "XYZ", "maxZoom" : 19,
							 "url" : ["https://worldtiles1.waze.com/tiles/${z}/${x}/${y}.png?highres=true", "https://mts0.googleapis.com/vt/lyrs=m&z=${z}&x=${x}&y=${y}", "https://mts0.googleapis.com/vt/lyrs=p&z=${z}&x=${x}&y=${y}",
									  "https://tile.openstreetmap.org/${z}/${x}/${y}.png"],
							 "attribution" : "mišmaš", "comment" : "mišmaš"};
	//skupiny vrstev v menu * layer groups in the menu
	var groupTogglerPlaces = addGroupToggler(true, "layer-switcher-group_places");
	var groupTogglerRoad = addGroupToggler(true, "layer-switcher-group_road");
	// var groupTogglerDisplay = addGroupToggler(true, "layer-switcher-group_display");
	var groupTogglerNames = addGroupToggler(false, "layer-switcher-group_names", "NP names and addresses");
	var groupTogglerBorders = addGroupToggler(false, "layer-switcher-group_borders", "NP Borders");
	var groupTogglerExternal = addGroupToggler(false, "layer-switcher-group_external", "External Maps!!!");
	//vrstvy v menu * layers in the menu
	var WMSLayerTogglers = {};
	/************************How To add LayerTogglers***************************
	WMSLayerTogglers.*(1)* = addLayerToggler(groupTogglerPlaces, "*(2)*", false, [addNewLayer("*(1)*", *(3)*, "*(4)*")]);
	INDEX:
	*(1)* : LAYER NAME
	*(2)* : LAYER DISPLAY NAME AT LIST
	*(3)* : SERVICE URL NAME TO PULL DATA FROM
	*(4)* : SERVICE URL LAYER NAME TO PULL DATA FROM
	****************************************************************************/
	
	//MÍSTA * PLACES
	WMSLayerTogglers.wms_rivers = addLayerToggler(groupTogglerPlaces, "SSRN Major Rivers", false, [addNewLayer("wms_rivers", service_wms_SSRN, "ssrn:ssrn_major_river")]);	
	WMSLayerTogglers.wms_airport = addLayerToggler(groupTogglerPlaces, "Geoportal Airports", false, [addNewLayer("wms_airport", service_wms_geoportal, "geonode:Transportation")]);
	
	//SILNICE * ROAD
	WMSLayerTogglers.wms_PL2023 = addLayerToggler(groupTogglerRoad, "SSRN Highway Layer 2023", false, [addNewLayer("wms_PL2023", service_wms_PL2023, "ssrn:ssrn_pavementstatus")]);
	WMSLayerTogglers.wms_BSM_PH = addLayerToggler(groupTogglerRoad, "BSM Province Hwy 2078/79", false, [addNewLayer("wms_BSM_PH", service_wms_BSM_PH, "prtmp_01:road_network")]);
	WMSLayerTogglers.wms_BSM_PR = addLayerToggler(groupTogglerRoad, "BSM Province Rd 2078/79", false, [addNewLayer("wms_BSM_PR", service_wms_BSM_PR, "prtmp_01:road_network")]);	
	
	//ZOBRAZENÍ * DISPLAY
	// WMSLayerTogglers.wms_orto = addLayerToggler(groupTogglerDisplay, "Ortofoto ČUZK", true, [addNewLayer("wms_orto", service_wms_orto, "GR_ORTFOTORGB", ZIndexes.base)]);

	//ČÚZK NÁZVY A ADRESY * ČÚZK NAMES AND ADDRESSES
	WMSLayerTogglers.wms_mun_name = addLayerToggler(groupTogglerNames, "BSM Municipality Names", false, [addNewLayer("wms_mun_name", service_wms_BSM, "bsm:bsm_localbodies_label", ZIndexes.popup)]);
	WMSLayerTogglers.wms_junction_name = addLayerToggler(groupTogglerNames, "SSRN Junction Names", false, [addNewLayer("wms_junction_name", service_wms_SSRN, "ssrn:ssrn_junction_name", ZIndexes.popup)]);
	
	//ČÚZK HRANICE * BORDER BOARD
	WMSLayerTogglers.wms_geonational = addLayerToggler(groupTogglerBorders, "Geoportal National Border", false, [addNewLayer("wms_geonational", service_wms_geoportal, "geonode:nepal")]);
	WMSLayerTogglers.wms_national = addLayerToggler(groupTogglerBorders, "SSRN National Border", false, [addNewLayer("wms_national", service_wms_SSRN, "ssrn:ssrn_national_boundary_line")]);
	WMSLayerTogglers.wms_geoprovince = addLayerToggler(groupTogglerBorders, "Geoportal Province Border", false, [addNewLayer("wms_geoprovince", service_wms_geoportal, "geonode:province")]);
	WMSLayerTogglers.wms_province = addLayerToggler(groupTogglerBorders, "SSRN Province Border", false, [addNewLayer("wms_province", service_wms_SSRN, "ssrn:ssrn_province_line")]);
	WMSLayerTogglers.wms_geodistrict = addLayerToggler(groupTogglerBorders, "Geoportal District Border", false, [addNewLayer("wms_geodistrict", service_wms_geoportal, "geonode:districts")]);
	WMSLayerTogglers.wms_district = addLayerToggler(groupTogglerBorders, "SSRN District Border", false, [addNewLayer("wms_district", service_wms_SSRN, "ssrn:ssrn_district_boundary_line")]);
	WMSLayerTogglers.wms_geomunicipality = addLayerToggler(groupTogglerBorders, "Geoportal Municipality Border", false, [addNewLayer("wms_geomunicipality", service_wms_geoportal, "geonode:NepalLocalUnits0")]);
	WMSLayerTogglers.wms_municipality = addLayerToggler(groupTogglerBorders, "BSM Municipality Border", false, [addNewLayer("wms_municipality", service_wms_BSM, "bsm:bsm_localbodies_line")]);	
	
	//EXTERNÍ MAPY * EXTERNAL MAPS
	WMSLayerTogglers.xyz_livemap = addLayerToggler(groupTogglerExternal, "Waze LiveMap", false, [addNewLayer("xyz_livemap", service_xyz_livemap)]);
	WMSLayerTogglers.xyz_google = addLayerToggler(groupTogglerExternal, "Google Maps", false, [addNewLayer("xyz_google", service_xyz_google)]);
	WMSLayerTogglers.xyz_google_terrain = addLayerToggler(groupTogglerExternal, "Google Terrain Maps", false, [addNewLayer("xyz_google_terrain", service_xyz_google_terrain)]);
	WMSLayerTogglers.xyz_google_hybrid = addLayerToggler(groupTogglerExternal, "Google Hybrid Maps", false, [addNewLayer("xyz_google_hybrid", service_xyz_google_hybrid)]);
	WMSLayerTogglers.xyz_google_streetview = addLayerToggler(groupTogglerExternal, "Google StreetView", false, [addNewLayer("xyz_google_streetview", service_xyz_google_streetview, null, ZIndexes.popup)]);
	WMSLayerTogglers.xyz_osm = addLayerToggler(groupTogglerExternal, "OpenStreetMaps", false, [addNewLayer("xyz_osm", service_xyz_osm)]);
	WMSLayerTogglers.xyz_april = addLayerToggler(groupTogglerExternal, "Apríl !!!", false, [addNewLayer("xyz_april", service_xyz_april)]);

	var isLoaded = false;
	window.addEventListener("beforeunload", function() {
		if (localStorage && isLoaded) {
			var JSONStorageOptions = {};
			for (var key in WMSLayerTogglers) {
				if (WMSLayerTogglers[key].serviceType == "WMS") {
					JSONStorageOptions[key] = document.getElementById(WMSLayerTogglers[key].htmlItem).checked;
				}
			}
			localStorage.WMSLayers = JSON.stringify(JSONStorageOptions);
		}
	}, false);
	window.addEventListener("load", function() {
		isLoaded = true;
		if (localStorage.WMSLayers) {
			var JSONStorageOptions = JSON.parse(localStorage.WMSLayers);
			for (var key in WMSLayerTogglers) {
				if (JSONStorageOptions[key] && WMSLayerTogglers[key].serviceType == "WMS") {
					document.getElementById(WMSLayerTogglers[key].htmlItem).click();
				}
			}
		}
	}, false);

	var GSVlayer = WMSLayerTogglers.xyz_google_streetview.layerArray[0].layer;
	var enteringStreetView = false;
	var ignoreStreetViewExit = false;
	var previousDisplayState = true;
	var controlObserver = new MutationObserver(function(mutationRecords) {
			if (!document.getElementById("layer-switcher-item_Google_StreetView").checked) {
				if (mutationRecords[0].target.classList.contains('overlay-button-active') == previousDisplayState) {
					if (previousDisplayState == true && !ignoreStreetViewExit) {
						previousDisplayState = ! mutationRecords[0].target.classList.contains('overlay-button-active');
						W.map.addLayer(GSVlayer);
						enteringStreetView = true;
						GSVlayer.setVisibility(true);
						enteringStreetView = false;
					} else if (previousDisplayState == false) {
						previousDisplayState = ! mutationRecords[0].target.classList.contains('overlay-button-active');
						GSVlayer.setVisibility(false);
						W.map.removeLayer(GSVlayer);
					}
				}
			}
		});
	controlObserver.observe(document.querySelector(".street-view-control"), { attributes: true, attributeFilter: ['class'] });
	GSVlayer.events.register('visibilitychanged', null, function() {
		if (!enteringStreetView && GSVlayer.getVisibility()) {
			ignoreStreetViewExit = true;
		}
		if (!GSVlayer.getVisibility()) {
			ignoreStreetViewExit = false;
		}
	});

	const { tabLabel, tabPane } = W.userscripts.registerSidebarTab("wms-NP-layers");
	tabLabel.innerText = 'WMS-NP';
    tabLabel.title = 'Nepali WMS Layers';
	tabLabel.id = "sidepanel-wms";
    tabPane.innerHTML = "<b><u><a href='https://greasyfork.org/en/scripts/521924' target='_blank'>" + GM_info.script.name + "</a></u></b> &nbsp; v" + GM_info.script.version;
	var section = document.createElement("section");
	section.style.fontSize = "13px";
	section.id = "WMS";
	section.style.marginBottom = "15px";
	section.appendChild(document.createElement("br"));
	section.appendChild(document.createTextNode("WMS layer: "));
	var WMSSelect = document.createElement("select");
	WMSSelect.id = "WMSLayersSelect";
	section.appendChild(WMSSelect);
	var opacityRange = document.createElement("input");
	var opacityLabel = document.createElement("label");
	opacityRange.type = "range";
	opacityRange.min = 0;
	opacityRange.max = 100;
	opacityRange.value = 100;
	opacityRange.id = "WMSOpacity";
	opacityLabel.textContent = "Layer transparency: " + opacityRange.value + " %";
	opacityLabel.id = "WMSOpacityLabel";
	opacityLabel.htmlFor = opacityRange.id;
	section.appendChild(opacityLabel);
	section.appendChild(opacityRange);
	tabPane.appendChild(section);
	opacityRange.addEventListener("input", function() {
		var value = document.getElementById("WMSLayersSelect").value;
		if (value !== "" && value !== "undefined") {
			var layer = W.map.getLayerByName(value);
			layer.setOpacity(opacityRange.value / 100);
			document.getElementById("WMSOpacityLabel").textContent = "Layer transparency: " + document.getElementById("WMSOpacity").value + " %";
		}
	});
	WMSSelect.addEventListener("change", function() {
		opacityRange.value = W.map.layers.filter(layer => layer.name == WMSSelect.value)[0].opacity * 100;
		document.getElementById("WMSOpacityLabel").textContent = "Layer transparency: " + document.getElementById("WMSOpacity").value + " %";
	});
	setZOrdering(WMSLayerTogglers);
	W.map.events.register("addlayer", null, fillWMSLayersSelectList);
	W.map.events.register("removelayer", null, fillWMSLayersSelectList);
	W.map.events.register("addlayer", null, setZOrdering(WMSLayerTogglers));
	W.map.events.register("removelayer", null, setZOrdering(WMSLayerTogglers));
	W.map.events.register("moveend", null, setZOrdering(WMSLayerTogglers));
}

function fillWMSLayersSelectList() {
	var select = document.getElementById("WMSLayersSelect");
	var value = select.value;
	var htmlCode;
	W.map.layers.filter(layer => layer.params !== undefined && layer.params.SERVICE !== undefined && layer.params.SERVICE == "WMS").forEach(
		layer => (htmlCode += "<option value='" + layer.name + "'>" + layer.name + "</option><br>"));
	select.innerHTML = htmlCode;
	select.value = value;
}

function addNewLayer(id, service, serviceLayers, zIndex = 0, opacity = 1) {
	var newLayer = {};
	newLayer.serviceType = service.type;
	newLayer.zIndex = (service.type == "XYZ" || zIndex == 0) ? ZIndexes.overlay : zIndex;
	switch(service.type) {
		case "WMS":
			newLayer.layer = new OL.Layer.WMS(
				id, service.url,
				{
					layers: serviceLayers,
					transparent: "true",
					format: "image/png"
				},
				{
					opacity: opacity,
					tileSize: WMSLayersTechSource.tileSizeG || new OL.Size(256, 256), // Use service-defined tile size if available
					isBaseLayer: false,
					visibility: false,
					transitionEffect: "resize",
					attribution: service.attribution,
					projection: new OL.Projection("EPSG:3857") //alternativa defaultní EPSG:900913
				}
			);
			break;
		case "WMS_4326":
			newLayer.layer = new OL.Layer.WMS(
				id, service.url,
				{
					layers: serviceLayers ,
					transparent: "true",
					format: "image/png"
				},
				{
					opacity: opacity,
					tileSize: WMSLayersTechSource.tileSizeG || new OL.Size(256, 256), // Use service-defined tile size if available
					isBaseLayer: false,
					visibility: false,
					transitionEffect: "resize",
					attribution: service.attribution,
					epsg4326: new OL.Projection("EPSG:4326"),
					getURL: getUrl4326,
					getFullRequestString: getFullRequestString4326
				}
			);
			break;
		case "XYZ":
			newLayer.layer = new OL.Layer.XYZ(
				id, service.url,
				{
					sphericalMercator: true,
					isBaseLayer: false,
					visibility: false,
					RESOLUTION_PROPERTIES: {},
					resolutions: WMSLayersTechSource.resolutions,
					serverResolutions: WMSLayersTechSource.resolutions.slice(0, ("maxZoom" in service && service.maxZoom > 0) ? service.maxZoom : 23),
					transitionEffect: "resize",
					attribution: service.attribution
				}
			);
			break;
		default:
			newLayer.layer = null;
	}
	return newLayer;
}

function addGroupToggler(isDefault, layerSwitcherGroupItemName, layerGroupVisibleName) {
	var group;
	if (isDefault === true) {
		group = document.getElementById(layerSwitcherGroupItemName).parentElement.parentElement;
	}
	else {
		var layerGroupsList = document.getElementsByClassName("list-unstyled togglers")[0];
		group = document.createElement("li");
		group.className = "group";
		var togglerContainer = document.createElement("div");
		togglerContainer.className = "layer-switcher-toggler-tree-category";
		var groupButton = document.createElement("wz-button");
		groupButton.color = "clear-icon";
		groupButton.size = "xs";
		var iCaretDown = document.createElement("i");
		iCaretDown.className = "toggle-category w-icon w-icon-caret-down";
		iCaretDown.dataset.groupId = layerSwitcherGroupItemName.replace("layer-switcher-", "").toUpperCase();
		var togglerSwitch = document.createElement("wz-toggle-switch");
		togglerSwitch.className = layerSwitcherGroupItemName + " hydrated";
		togglerSwitch.id = layerSwitcherGroupItemName;
		togglerSwitch.checked = true;
		var label = document.createElement("label");
		label.className = "label-text";
		label.htmlFor = togglerSwitch.id;
		var togglerChildrenList = document.createElement("ul");
		togglerChildrenList.className = "collapsible-" + layerSwitcherGroupItemName.replace("layer-switcher-", "").toUpperCase();
		label.appendChild(document.createTextNode(layerGroupVisibleName));
		groupButton.addEventListener("click", layerTogglerGroupMinimizerEventHandler(iCaretDown));
		togglerSwitch.addEventListener("click", layerTogglerGroupMinimizerEventHandler(iCaretDown));
		groupButton.appendChild(iCaretDown);
		togglerContainer.appendChild(groupButton);
		togglerContainer.appendChild(togglerSwitch);
		togglerContainer.appendChild(label);
		group.appendChild(togglerContainer);
		group.appendChild(togglerChildrenList);
		layerGroupsList.appendChild(group);
	}
	return group;
}

function addLayerToggler(groupToggler, layerName, isPublic, layerArray) {
	var layerToggler = {};
	layerToggler.layerName = layerName;
	layerToggler.serviceType = (layerArray.filter(function(e) {return e.serviceType == "XYZ";}).length > 0) ? "XYZ" : "WMS";
	var layerShortcut = layerName.replace(/ /g, "_").replace(".", "");
	layerToggler.htmlItem = "layer-switcher-item_" + layerShortcut;
	layerToggler.layerArray = layerArray;
	var layer_container = groupToggler.getElementsByTagName("UL")[0];
	var layerGroupCheckbox = groupToggler.getElementsByClassName("layer-switcher-toggler-tree-category")[0].getElementsByTagName("wz-toggle-switch")[0];
	var toggler = document.createElement("li");
	var togglerCheckbox = document.createElement("wz-checkbox");
	togglerCheckbox.id = layerToggler.htmlItem;
	togglerCheckbox.className = "hydrated";
	var labelSymbol = document.createElement("span");
	labelSymbol.className = (isPublic) ? "fa fa-location-arrow" : "fa fa-lock";
	togglerCheckbox.appendChild(labelSymbol);
	togglerCheckbox.appendChild(document.createTextNode(layerName));
	toggler.appendChild(togglerCheckbox);
	layer_container.appendChild(toggler);
	for (var i = 0; i < layerArray.length; i++){
		togglerCheckbox.addEventListener("change", layerTogglerEventHandler(layerArray[i]));
		layerGroupCheckbox.addEventListener("change", layerTogglerGroupEventHandler(togglerCheckbox, layerArray[i]));
		layerArray[i].layer.name = layerName + ((layerArray.length > 1) ? " " + i : "");
	}
	registerKeyShortcut("WMS: " + layerName, layerKeyShortcutEventHandler(layerGroupCheckbox, togglerCheckbox), layerShortcut);
	return layerToggler;
}

function registerKeyShortcut(actionName, callback, keyName) {
	I18n.translations[I18n.locale].keyboard_shortcuts.groups.default.members[keyName] = actionName;
	W.accelerators.addAction(keyName, {group: "default"});
	W.accelerators.events.register(keyName, null, callback);
	W.accelerators._registerShortcuts({["name"]: keyName});
}

function layerTogglerEventHandler(layerType) {
	return function() {
		if (this.checked) {
			W.map.addLayer(layerType.layer);
			layerType.layer.setVisibility(this.checked);
		}
		else {
			layerType.layer.setVisibility(this.checked);
			W.map.removeLayer(layerType.layer);
		}
	};
}

function layerKeyShortcutEventHandler(groupCheckbox, checkbox) {
	return function() {
		if (!groupCheckbox.disabled) {
			checkbox.click();
		}
	};
}

function layerTogglerGroupEventHandler(checkbox, layerType) {
	return function() {
		if (this.checked) {
			if (checkbox.checked) {
				W.map.addLayer(layerType.layer);
				layerType.layer.setVisibility(this.checked && checkbox.checked);
			}
		}
		else {
			if (checkbox.checked) {
				layerType.layer.setVisibility(this.checked && checkbox.checked);
				W.map.removeLayer(layerType.layer);
			}
		}
		checkbox.disabled = !this.checked;
	};
}

function layerTogglerGroupMinimizerEventHandler(iCaretDown) {
	return function() {
		var ulCollapsible = iCaretDown.parentElement.parentElement.parentElement.getElementsByTagName("UL")[0];
		if (!iCaretDown.classList.contains("upside-down")) {
			iCaretDown.classList.add("upside-down");
			ulCollapsible.classList.add("collapse-layer-switcher-group");
		}
		else {
			iCaretDown.classList.remove("upside-down");
			ulCollapsible.classList.remove("collapse-layer-switcher-group");
		}
	};
}

function setZOrdering(layerTogglers) {
	return function() {
		for (var key in layerTogglers) {
			for (var j = 0; j < layerTogglers[key].layerArray.length; j++) {
				if (layerTogglers[key].layerArray[j].zIndex > 0) {
					var l = W.map.getLayerByName(layerTogglers[key].layerName);
					if (l !== undefined) {
						l.setZIndex(layerTogglers[key].layerArray[j].zIndex);
					}
				}
			}
		}
	};
}

function getUrl4326(bounds) {
	var newParams = {};
	bounds.transform(this.projection, this.epsg4326);
	newParams.BBOX = bounds.toArray(this.reverseAxisOrder());
	newParams.WIDTH = 742;
	newParams.HEIGHT = 485;
	var requestString = this.getFullRequestString(newParams);
	return requestString;
}

function getFullRequestString4326(newParams) {
	this.params.SRS = "EPSG:4326";
	return OL.Layer.Grid.prototype.getFullRequestString.apply(this, arguments);
}

document.addEventListener("wme-map-data-loaded", init, {once: true});