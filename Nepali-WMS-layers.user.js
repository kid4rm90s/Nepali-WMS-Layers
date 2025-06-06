// ==UserScript==
// @name          Nepali WMS layers
// @version       2025.06.06.02
// @author        kid4rm90s
// @description   Displays layers from Nepali WMS services in WME
// @match         https://*.waze.com/*/editor*
// @match         https://*.waze.com/editor
// @exclude       https://*.waze.com/user/editor*
// @run-at        document-end
// @namespace     https://greasyfork.org/en/users/1087400-kid4rm90s
// @license       MIT
// @grant         GM_xmlhttpRequest
// @connect       greasyfork.org
// @require       https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @require       https://update.greasyfork.org/scripts/509664/WME%20Utils%20-%20Bootstrap.js
// @downloadURL   https://update.greasyfork.org/scripts/521924-nepali-wms-layers.user.js
// @updateURL     https://update.greasyfork.org/scripts/521924-nepali-wms-layers.meta.js 
// ==/UserScript==

/*  Scripts modified from Czech WMS layers (https://greasyfork.org/cs/scripts/35069-czech-wms-layers; https://greasyfork.org/en/scripts/34720-private-czech-wms-layers, https://greasyfork.org/en/scripts/28160) 
orgianl authors: petrjanik, d2-mac, MajkiiTelini, and Croatian WMS layers (https://greasyfork.org/en/scripts/519676-croatian-wms-layers) author: JS55CT */ 

/* global W */
/* global WazeWrap */
/* global $ */
/* global OpenLayers */
/* global require */

(function main() {
  "use strict";
   const updateMessage = 'Added Bridge Management System bridge locations!<br> Loaded layers will be reloaded even after the page refresh.';
   const scriptName = GM_info.script.name;
   const scriptVersion = GM_info.script.version;
  const downloadUrl = 'https://greasyfork.org/scripts/521924-nepali-wms-layers/code/nepali-wms-layers.user.js';
   let wmeSDK;

var WMSLayersTechSource = {};
var W;
var OL;
var I18n;
var ZIndexes = {};
var WMSLayerTogglers = {};

async function init() {
	console.log(`${scriptName} initializing.`);
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
	ZIndexes.overlay = W.map.olMap.Z_INDEX_BASE.Overlay + 100;
	ZIndexes.popup = W.map.olMap.Z_INDEX_BASE.Overlay + 500;
	
	// adresy WMS služeb * WMS service addresses
    var service_wms_PL2023 = {"type" : "WMS", "url" : "https://geoserver.softwel.com.np/geoserver/ssrn/wms?CQL_FILTER=dyear%3D%272023%27", "attribution" : "© Department of Roads Nepal", "comment" : "ssrn_PavementLayer2023"};
    var service_wms_BSM_PH = {"type" : "WMS", "url" : "https://geoserver.softwel.com.np/geoserver/prtmp_01/wms?CQL_FILTER=road_class%3D%27PH%27", "attribution" : "© Department of Roads Nepal", "comment" : "BSM Province Highways 2078/79"};
    var service_wms_BSM_PR = {"type" : "WMS", "url" : "https://geoserver.softwel.com.np/geoserver/prtmp_01/wms?CQL_FILTER=road_class%3D%27PR%27", "attribution" : "© Department of Roads Nepal", "comment" : "BSM Province Roads 2078/79"};
	var service_wms_SSRN = {"type" : "WMS", "url" : "https://geoserver.softwel.com.np/geoserver/ssrn/wms?", "attribution" : "© Department of Roads Nepal", "comment" : "National + Province + District Boundaries, Rivers, Junctions"};
	var service_wms_BSM = {"type" : "WMS", "url" : "https://geoserver.softwel.com.np/geoserver/bsm/wms?", "attribution" : "© Department of Roads Nepal", "comment" : "Municipalities names and boundaries"};
	var service_wms_geoportal = {"type" : "WMS", "url" : "https://admin.nationalgeoportal.gov.np/geoserver/wms?", "attribution" : "© National Geoportal Nepal", "comment" : "Municipalities names and boundaries"};
	var service_wms_geo_lalitpur = {"type" : "WMS_4326", "url" : "http://localhost:8080/geoserver/geo-lalitpur/wms?", "attribution" : "© Geonp.com.np / LMC", "comment" : "Lalitpur House numbers and boundaries"};
	
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
	var groupTogglerLalitpur = addGroupToggler(false, "layer-switcher-group_lalitpur", "Lalitpur MC HN!");
	//vrstvy v menu * layers in the menu
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
	WMSLayerTogglers.wms_BSM_Brg1 = addLayerToggler(groupTogglerRoad, "BSM Bridges New", false, [addNewLayer("wms_BSM_Brg1", service_wms_BSM, "bsm:bsm_nc_primary_detail,bsm:nc_primary_detail_code")])	
	WMSLayerTogglers.wms_BSM_Brg2 = addLayerToggler(groupTogglerRoad, "BSM Bridges Old", false, [addNewLayer("wms_BSM_Brg2", service_wms_BSM, "bsm:bsm_bi_primary_detail,bsm:bi_primary_detail_code")]);
	
	//ZOBRAZENÍ * DISPLAY
	// WMSLayerTogglers.wms_orto = addLayerToggler(groupTogglerDisplay, "Ortofoto ČUZK", true, [addNewLayer("wms_orto", service_wms_orto, "GR_ORTFOTORGB", ZIndexes.base)]);

	//ČÚZK NÁZVY A ADRESY * ČÚZK NAMES AND ADDRESSES
	WMSLayerTogglers.wms_mun_name = addLayerToggler(groupTogglerNames, "BSM Municipality Names", false, [addNewLayer("wms_mun_name", service_wms_BSM, "bsm:bsm_localbodies_label")]);
	WMSLayerTogglers.wms_junction_name = addLayerToggler(groupTogglerNames, "SSRN Junction Names", false, [addNewLayer("wms_junction_name", service_wms_SSRN, "ssrn:ssrn_junction_name")]);
	WMSLayerTogglers.wms_lalitpur_metric_house = addLayerToggler(groupTogglerNames, "Lalitpur Metric House", false, [addNewLayer("wms_lalitpur_metric_house", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-01_metric_house,geo-lalitpur:lmc_w-02_metric_house,geo-lalitpur:lmc_w-03_metric_house,geo-lalitpur:lmc_w-04_metric_house,geo-lalitpur:lmc_w-05_metric_house,geo-lalitpur:lmc_w-06_metric_house,geo-lalitpur:lmc_w-07_metric_house,geo-lalitpur:lmc_w-08_metric_house,geo-lalitpur:lmc_w-09_metric_house,geo-lalitpur:lmc_w-10_metric_house,geo-lalitpur:lmc_w-11_metric_house,geo-lalitpur:lmc_w-12_metric_house,geo-lalitpur:lmc_w-13_metric_house,geo-lalitpur:lmc_w-14_metric_house,geo-lalitpur:lmc_w-15_metric_house,geo-lalitpur:lmc_w-16_metric_house,geo-lalitpur:lmc_w-17_metric_house,geo-lalitpur:lmc_w-18_metric_house,geo-lalitpur:lmc_w-19_metric_house,geo-lalitpur:lmc_w-20_metric_house,geo-lalitpur:lmc_w-22_metric_house,geo-lalitpur:lmc_w-23_metric_house,geo-lalitpur:lmc_w-24_metric_house,geo-lalitpur:lmc_w-25_metric_house,geo-lalitpur:lmc_w-26_metric_house,geo-lalitpur:lmc_w-27_metric_house,geo-lalitpur:lmc_w-28_metric_house,geo-lalitpur:lmc_w-29_metric_house")]);	
	
	//ČÚZK HRANICE * BORDER BOARD
	WMSLayerTogglers.wms_geonational = addLayerToggler(groupTogglerBorders, "Geoportal National Border", false, [addNewLayer("wms_geonational", service_wms_geoportal, "geonode:nepal")]);
	WMSLayerTogglers.wms_national = addLayerToggler(groupTogglerBorders, "SSRN National Border", false, [addNewLayer("wms_national", service_wms_SSRN, "ssrn:ssrn_national_boundary_line")]);
	WMSLayerTogglers.wms_geoprovince = addLayerToggler(groupTogglerBorders, "Geoportal Province Border", false, [addNewLayer("wms_geoprovince", service_wms_geoportal, "geonode:province")]);
	WMSLayerTogglers.wms_province = addLayerToggler(groupTogglerBorders, "SSRN Province Border", false, [addNewLayer("wms_province", service_wms_SSRN, "ssrn:ssrn_province_line")]);
	WMSLayerTogglers.wms_geodistrict = addLayerToggler(groupTogglerBorders, "Geoportal District Border", false, [addNewLayer("wms_geodistrict", service_wms_geoportal, "geonode:districts")]);
	WMSLayerTogglers.wms_district = addLayerToggler(groupTogglerBorders, "SSRN District Border", false, [addNewLayer("wms_district", service_wms_SSRN, "ssrn:ssrn_district_boundary_line")]);
	WMSLayerTogglers.wms_geomunicipality = addLayerToggler(groupTogglerBorders, "Geoportal Municipality Border", false, [addNewLayer("wms_geomunicipality", service_wms_geoportal, "geonode:NepalLocalUnits0")]);
	WMSLayerTogglers.wms_municipality = addLayerToggler(groupTogglerBorders, "BSM Municipality Border", false, [addNewLayer("wms_municipality", service_wms_BSM, "bsm:bsm_localbodies_line")]);	
	WMSLayerTogglers.wms_lalitpur_boundary = addLayerToggler(groupTogglerBorders, "Lalitpur Ward Boundary", false, [addNewLayer("wms_lalitpur_boundary", service_wms_geo_lalitpur, "geo-lalitpur:lmc_w-01_boundary,geo-lalitpur:lmc_w-02_boundary,geo-lalitpur:lmc_w-03_boundary,geo-lalitpur:lmc_w-04_boundary,geo-lalitpur:lmc_w-05_boundary,geo-lalitpur:lmc_w-06_boundary,geo-lalitpur:lmc_w-07_boundary,geo-lalitpur:lmc_w-08_boundary,geo-lalitpur:lmc_w-09_boundary,geo-lalitpur:lmc_w-10_boundary,geo-lalitpur:lmc_w-11_boundary,geo-lalitpur:lmc_w-12_boundary,geo-lalitpur:lmc_w-13_boundary,geo-lalitpur:lmc_w-14_boundary,geo-lalitpur:lmc_w-15_boundary,geo-lalitpur:lmc_w-16_boundary,geo-lalitpur:lmc_w-17_boundary,geo-lalitpur:lmc_w-18_boundary,geo-lalitpur:lmc_w-19_boundary,geo-lalitpur:lmc_w-20_boundary,geo-lalitpur:lmc_w-22_boundary,geo-lalitpur:lmc_w-23_boundary,geo-lalitpur:lmc_w-24_boundary,geo-lalitpur:lmc_w-25_boundary,geo-lalitpur:lmc_w-26_boundary,geo-lalitpur:lmc_w-27_boundary,geo-lalitpur:lmc_w-28_boundary,geo-lalitpur:lmc_w-29_boundary")]);		
	
	//EXTERNÍ MAPY * EXTERNAL MAPS
	WMSLayerTogglers.xyz_livemap = addLayerToggler(groupTogglerExternal, "Waze LiveMap", false, [addNewLayer("xyz_livemap", service_xyz_livemap)]);
	WMSLayerTogglers.xyz_google = addLayerToggler(groupTogglerExternal, "Google Maps", false, [addNewLayer("xyz_google", service_xyz_google)]);
	WMSLayerTogglers.xyz_google_terrain = addLayerToggler(groupTogglerExternal, "Google Terrain Maps", false, [addNewLayer("xyz_google_terrain", service_xyz_google_terrain)]);
	WMSLayerTogglers.xyz_google_hybrid = addLayerToggler(groupTogglerExternal, "Google Hybrid Maps", false, [addNewLayer("xyz_google_hybrid", service_xyz_google_hybrid)]);
	WMSLayerTogglers.xyz_google_streetview = addLayerToggler(groupTogglerExternal, "Google StreetView", false, [addNewLayer("xyz_google_streetview", service_xyz_google_streetview, null, ZIndexes.popup)]);
	WMSLayerTogglers.xyz_osm = addLayerToggler(groupTogglerExternal, "OpenStreetMaps", false, [addNewLayer("xyz_osm", service_xyz_osm)]);
	WMSLayerTogglers.xyz_april = addLayerToggler(groupTogglerExternal, "Apríl !!!", false, [addNewLayer("xyz_april", service_xyz_april)]);

	//LALITPUR METRO CITY METRIC HOUSE NUMBERING
	WMSLayerTogglers.wms_lmc_ward1 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 1", false, [addNewLayer("wms_lmc_ward1", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-01_metric_house,geo-lalitpur:lmc_w-01_boundary")]);
	WMSLayerTogglers.wms_lmc_ward2 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 2", false, [addNewLayer("wms_lmc_ward2", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-02_metric_house,geo-lalitpur:lmc_w-02_boundary")]);
	WMSLayerTogglers.wms_lmc_ward3 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 3", false, [addNewLayer("wms_lmc_ward3", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-03_metric_house,geo-lalitpur:lmc_w-03_boundary")]);
	WMSLayerTogglers.wms_lmc_ward4 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 4", false, [addNewLayer("wms_lmc_ward4", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-04_metric_house,geo-lalitpur:lmc_w-04_boundary")]);
	WMSLayerTogglers.wms_lmc_ward5 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 5", false, [addNewLayer("wms_lmc_ward5", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-05_metric_house,geo-lalitpur:lmc_w-05_boundary")]);
	WMSLayerTogglers.wms_lmc_ward6 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 6", false, [addNewLayer("wms_lmc_ward6", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-06_metric_house,geo-lalitpur:lmc_w-06_boundary")]);
	WMSLayerTogglers.wms_lmc_ward7 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 7", false, [addNewLayer("wms_lmc_ward7", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-07_metric_house,geo-lalitpur:lmc_w-07_boundary")]);
	WMSLayerTogglers.wms_lmc_ward8 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 8", false, [addNewLayer("wms_lmc_ward8", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-08_metric_house,geo-lalitpur:lmc_w-08_boundary")]);
	WMSLayerTogglers.wms_lmc_ward9 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 9", false, [addNewLayer("wms_lmc_ward9", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-09_metric_house,geo-lalitpur:lmc_w-09_boundary")]);
	WMSLayerTogglers.wms_lmc_ward10 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 10", false, [addNewLayer("wms_lmc_ward10", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-10_metric_house,geo-lalitpur:lmc_w-10_boundary")]);
	WMSLayerTogglers.wms_lmc_ward11 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 11", false, [addNewLayer("wms_lmc_ward11", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-11_metric_house,geo-lalitpur:lmc_w-11_boundary")]);
	WMSLayerTogglers.wms_lmc_ward12 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 12", false, [addNewLayer("wms_lmc_ward12", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-12_metric_house,geo-lalitpur:lmc_w-12_boundary")]);
	WMSLayerTogglers.wms_lmc_ward13 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 13", false, [addNewLayer("wms_lmc_ward13", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-13_metric_house,geo-lalitpur:lmc_w-13_boundary")]);
	WMSLayerTogglers.wms_lmc_ward14 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 14", false, [addNewLayer("wms_lmc_ward14", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-14_metric_house,geo-lalitpur:lmc_w-14_boundary")]);
	WMSLayerTogglers.wms_lmc_ward15 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 15", false, [addNewLayer("wms_lmc_ward15", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-15_metric_house,geo-lalitpur:lmc_w-15_boundary")]);
	WMSLayerTogglers.wms_lmc_ward16 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 16", false, [addNewLayer("wms_lmc_ward16", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-16_metric_house,geo-lalitpur:lmc_w-16_boundary")]);
	WMSLayerTogglers.wms_lmc_ward17 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 17", false, [addNewLayer("wms_lmc_ward17", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-17_metric_house,geo-lalitpur:lmc_w-17_boundary")]);
	WMSLayerTogglers.wms_lmc_ward18 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 18", false, [addNewLayer("wms_lmc_ward18", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-18_metric_house,geo-lalitpur:lmc_w-18_boundary")]);
	WMSLayerTogglers.wms_lmc_ward19 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 19", false, [addNewLayer("wms_lmc_ward19", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-19_metric_house,geo-lalitpur:lmc_w-19_boundary")]);
	WMSLayerTogglers.wms_lmc_ward20 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 20", false, [addNewLayer("wms_lmc_ward20", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-20_metric_house,geo-lalitpur:lmc_w-20_boundary")]);
	WMSLayerTogglers.wms_lmc_ward21 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 21", false, [addNewLayer("wms_lmc_ward21", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-21_metric_house,geo-lalitpur:lmc_w-21_boundary")]);
	WMSLayerTogglers.wms_lmc_ward22 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 22", false, [addNewLayer("wms_lmc_ward22", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-22_metric_house,geo-lalitpur:lmc_w-22_boundary")]);
	WMSLayerTogglers.wms_lmc_ward23 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 23", false, [addNewLayer("wms_lmc_ward23", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-23_metric_house,geo-lalitpur:lmc_w-23_boundary")]);
	WMSLayerTogglers.wms_lmc_ward24 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 24", false, [addNewLayer("wms_lmc_ward24", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-24_metric_house,geo-lalitpur:lmc_w-24_boundary")]);
	WMSLayerTogglers.wms_lmc_ward25 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 25", false, [addNewLayer("wms_lmc_ward25", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-25_metric_house,geo-lalitpur:lmc_w-25_boundary")]);
	WMSLayerTogglers.wms_lmc_ward26 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 26", false, [addNewLayer("wms_lmc_ward26", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-26_metric_house,geo-lalitpur:lmc_w-26_boundary")]);
	WMSLayerTogglers.wms_lmc_ward27 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 27", false, [addNewLayer("wms_lmc_ward27", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-27_metric_house,geo-lalitpur:lmc_w-27_boundary")]);
	WMSLayerTogglers.wms_lmc_ward28 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 28", false, [addNewLayer("wms_lmc_ward28", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-28_metric_house,geo-lalitpur:lmc_w-28_boundary")]);
	WMSLayerTogglers.wms_lmc_ward29 = addLayerToggler(groupTogglerLalitpur, "LMC Ward 29", false, [addNewLayer("wms_lmc_ward29", service_wms_geo_lalitpur,  "geo-lalitpur:lmc_w-29_metric_house,geo-lalitpur:lmc_w-29_boundary")]);

	// --- Layer toggler state persistence ---
    function saveLayerTogglerStates() {
        if (!localStorage) return;
        const state = {};
        for (const key in WMSLayerTogglers) {
            const togglerId = WMSLayerTogglers[key].htmlItem;
            const toggler = document.getElementById(togglerId);
            if (toggler) state[key] = toggler.checked;
        }
        localStorage.WMSLayers = JSON.stringify(state);
    }

    function restoreLayerTogglerStates() {
        if (!localStorage.WMSLayers) return;
        const state = JSON.parse(localStorage.WMSLayers);
        for (const key in state) {
            if (WMSLayerTogglers[key]) {
                const togglerId = WMSLayerTogglers[key].htmlItem;
                const toggler = document.getElementById(togglerId);
                if (toggler && toggler.checked !== state[key]) {
                    toggler.checked = state[key];
                    toggler.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    }

    // Attach change listeners to save state on toggle
    for (const key in WMSLayerTogglers) {
        const togglerId = WMSLayerTogglers[key].htmlItem;
        const toggler = document.getElementById(togglerId);
        if (toggler) {
            toggler.addEventListener('change', saveLayerTogglerStates);
        }
    }
    // Restore state after togglers are created
    restoreLayerTogglerStates();

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
	await W.userscripts.waitForElementConnected(tabPane);
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
	if (service.type == "XYZ" & zIndex == 0) {
		newLayer.zIndex = ZIndexes.base;
	} else {
		newLayer.zIndex = (zIndex == 0) ? ZIndexes.popup : zIndex;
	}
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
	var imageSize = this.getImageSize(bounds);
	newParams.WIDTH = imageSize.w;
	newParams.HEIGHT = imageSize.h;	
	// newParams.WIDTH = 742;
	// newParams.HEIGHT = 485;
	//from geoserver
	// newParams.WIDTH = 648;
	// newParams.HEIGHT = 768;
	var requestString = this.getFullRequestString(newParams);
	return requestString;
}

function getFullRequestString4326(newParams) {
	this.params.SRS = "EPSG:4326";
	return OL.Layer.Grid.prototype.getFullRequestString.apply(this, arguments);
}

// After all WMSLayerTogglers are created:

// --- Layer toggler state persistence ---
    // Utility to save all toggler states
    function saveLayerTogglerStates() {
        if (!localStorage) return;
        const state = {};
        for (const key in WMSLayerTogglers) {
            const togglerId = WMSLayerTogglers[key].htmlItem;
            const toggler = document.getElementById(togglerId);
            if (toggler) state[key] = toggler.checked;
        }
        localStorage.WMSLayers = JSON.stringify(state);
    }

    // Utility to restore all toggler states
    function restoreLayerTogglerStates() {
        if (!localStorage.WMSLayers) return;
        const state = JSON.parse(localStorage.WMSLayers);
        for (const key in state) {
            if (WMSLayerTogglers[key]) {
                const togglerId = WMSLayerTogglers[key].htmlItem;
                const toggler = document.getElementById(togglerId);
                if (toggler && toggler.checked !== state[key]) {
                    toggler.checked = state[key];
                    toggler.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    }

    // Attach change listeners to save state on toggle
    for (const key in WMSLayerTogglers) {
        const togglerId = WMSLayerTogglers[key].htmlItem;
        const toggler = document.getElementById(togglerId);
        if (toggler) {
            toggler.addEventListener('change', saveLayerTogglerStates);
        }
    }
    // Restore state after togglers are created
    restoreLayerTogglerStates();

/*
changeLog

version: "1.0", message: "Initial Version" },
version: 2025.02.01.01 - Modified how WMS 4326 image is displayed
version: 2025.02.01.02 - Added support for Wazewrap update dialogue box
version: 2025.02.03.01 - Line modification
version: 2025.03.06.01 - Now LMC HN can be filtered by ward
version: 2025.04.13.01 - Fixed Combatible with the latest wme beta v2.287-5! Now it monitors the script update!
version: 2025.05.11.01 - Fixed Z-ordering
Version: 2025.06.06.01 - Added Bridge Management System bridge locations!
Version: 2025.06.06.02 - Added Bridge Management System bridge locations!
                       - Loaded layers will be reloaded even after the page refresh.
	
*/
  
 function scriptupdatemonitor() {
        if (WazeWrap?.Ready) {
            WazeWrap.Interface.ShowScriptUpdate(scriptName, scriptVersion, updateMessage);
        } else {
            setTimeout(scriptupdatemonitor, 250);
        }
    }
    // Start the "scriptupdatemonitor"
    scriptupdatemonitor();
	wmeSDK = bootstrap({ scriptUpdateMonitor: { downloadUrl } });
    console.log(`${scriptName} initialized.`);

document.addEventListener("wme-map-data-loaded", init, {once: true});

})();