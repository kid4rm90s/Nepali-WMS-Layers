// ==UserScript==
// @name             Nepali WMS layers
// @namespace        https://greasyfork.org/en/users/1087400-kid4rm90s
// @description      Displays layers from Nepali WMS services in WME
// @version          2025.01.01.01
// @author           kid4rm90s
// @match            https://*.waze.com/*/editor*
// @match            https://*.waze.com/editor
// @exclude          https://*.waze.com/user/editor*
// @grant            unsafeWindow
// @license          MIT
// ==/UserScript==

/*  Scripts modified from Czech WMS layers (https://greasyfork.org/cs/scripts/35069-czech-wms-layers) orgianl authors: petrjanik, d2-mac, MajkiiTelini, and Croatian WMS layers (https://greasyfork.org/en/scripts/519676-croatian-wms-layers) author: JS55CT */ 
 
(function () {
  var W;
  var OL;
  var I18n;
  var ZIndexes = {};
 
  const scriptMetadata = GM_info.script;
  const scriptName = scriptMetadata.name;
  const storageName = scriptName.replace(/ /g, "");
  var WMSLayerTogglers = {};
  const debug = false;
 
  function init(e) {
    if (debug) console.log(`${scriptName}: Nepali WMS layers Script Started......`);
 
    W = unsafeWindow.W;
    OL = unsafeWindow.OpenLayers;
    I18n = unsafeWindow.I18n;
 
    ZIndexes.base = W.map.olMap.Z_INDEX_BASE.Overlay + 10;
    ZIndexes.overlay = W.map.olMap.Z_INDEX_BASE.Overlay + 150;
    ZIndexes.popup = W.map.olMap.Z_INDEX_BASE.Popup + 150;
 
    var groupTogglerHRV = addGroupToggler(false, "layer-switcher-group_SSRN", "WMS Nepal");
 

    // where .params.VERSION >= "1.3.0" use "CRS:" else use  "SRS:"" for the Coordinate System Value
    // New nepali WMS service definition
 
      var service_ssrn_PavementLayer2023 = {
      type: "WMS",
      url: "https://geoserver.softwel.com.np/geoserver/ssrn/wms?CQL_FILTER=dyear%3D%272023%27",
      params: {
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetMap",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        LAYERS: "ssrn:ssrn_pavementstatus",
        CRS: "EPSG:6207",
	    STYLES: "",
		},
      attribution: "DOR SSRN Geoserver Softwel 2023",
      tileSize: new OL.Size(256, 256),
	  comment: "ssrn_PavementLayer2023",
    };
	//BSM Province Highways 2078/79
      var service_BSM_PH = {
      type: "WMS",
      url: "https://geoserver.softwel.com.np/geoserver/prtmp_01/wms?CQL_FILTER=road_class%3D%27PH%27",
      params: {
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetMap",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        LAYERS: "prtmp_01:road_network",
        CRS: "EPSG:6207",
	    STYLES: "",
		},
      attribution: "DOR SSRN Geoserver Softwel 2023",
      tileSize: new OL.Size(256, 256),
	  comment: "BSM Province Highways 2078/79",
    };	
	//BSM Province Roads 2078/79
      var service_BSM_PR = {
      type: "WMS",
      url: "https://geoserver.softwel.com.np/geoserver/prtmp_01/wms?CQL_FILTER=road_class%3D%27PR%27",
      params: {
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetMap",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        LAYERS: "prtmp_01:road_network",
        CRS: "EPSG:6207",
	    STYLES: "",
		},
      attribution: "DOR SSRN Geoserver Softwel 2023",
      tileSize: new OL.Size(256, 256),
	  comment: "BSM Province Highways 2078/79",
    };
    //National bounadary line
      var service_ssrn_national_boundary_line = {
      type: "WMS",
      url: "https://geoserver.softwel.com.np/geoserver/ssrn/wms?",
      params: {
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetMap",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        LAYERS: "ssrn:ssrn_national_boundary_line",
        CRS: "EPSG:3857",
	    STYLES: "",
		},
      attribution: "DOR SSRN Geoserver Softwel Boundary Line",
      tileSize: new OL.Size(256, 256),
	  comment: "ssrn National Boundary Line",
    };	
    //Province bounadary line
      var service_ssrn_province_line = {
      type: "WMS",
      url: "https://geoserver.softwel.com.np/geoserver/ssrn/wms?",
      params: {
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetMap",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        LAYERS: "ssrn:ssrn_province_line",
        CRS: "EPSG:3857",
	    STYLES: "",
		},
      attribution: "SSRN Geoserver Softwel Province Line",
      tileSize: new OL.Size(256, 256),
	  comment: "ssrn Procince Boundary Line",
    };	
    //District bounadary line
      var service_ssrn_district_line = {
      type: "WMS",
      url: "https://geoserver.softwel.com.np/geoserver/ssrn/wms?",
      params: {
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetMap",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        LAYERS: "ssrn:ssrn_district_boundary_line",
        CRS: "EPSG:3857",
	    STYLES: "",
		},
      attribution: "SSRN Geoserver Softwel District Line",
      tileSize: new OL.Size(256, 256),
	  comment: "ssrn District Line",
    };		
    //Municipality bounadary line
      var service_bsm_municipality_line = {
      type: "WMS",
      url: "https://geoserver.softwel.com.np/geoserver/bsm/wms?",
      params: {
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetMap",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        LAYERS: "bsm:bsm_localbodies_line",
        CRS: "EPSG:3857",
	    STYLES: "",
		},
      attribution: "BSM Geoserver Softwel Municipality Line",
      tileSize: new OL.Size(256, 256),
	  comment: "BSM Municipality Line",
    };		
    //Municipality name
      var service_bsm_municipality_name = {
      type: "WMS",
      url: "https://geoserver.softwel.com.np/geoserver/bsm/wms?",
      params: {
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetMap",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        LAYERS: "bsm:bsm_localbodies_label",
        CRS: "EPSG:3857",
	    STYLES: "",
		},
      attribution: "BSM Geoserver Softwel Municipality name",
      tileSize: new OL.Size(256, 256),
	  comment: "BSM Municipality Name",
    };			
    //major Rivers
      var service_ssrn_major_river = {
      type: "WMS",
      url: "https://geoserver.softwel.com.np/geoserver/ssrn/wms?",
      params: {
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetMap",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        LAYERS: "ssrn:ssrn_major_river",
        CRS: "EPSG:3857",
	    STYLES: "",
		},
      attribution: "SSRN Softwel Major River",
      tileSize: new OL.Size(256, 256),
	  comment: "SSRN Major River",
    };
    //Place Junction Names
      var service_ssrn_junction_name = {
      type: "WMS",
      url: "https://geoserver.softwel.com.np/geoserver/ssrn/wms?",
      params: {
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetMap",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        LAYERS: "ssrn:ssrn_junction_name",
        CRS: "EPSG:3857",
	    STYLES: "",
		},
      attribution: "SSRN Softwel Place Junction Name",
      tileSize: new OL.Size(256, 256),
	  comment: "SSRN Place Junction Name",
    };	

    // Add WMS layers
	//Streets and Highways
    WMSLayerTogglers.ssrn_PavementLayer2023 = addLayerToggler(groupTogglerHRV, "SSRN Highway Layer 2023", [addNewLayer("Nepal:ssrn_PavementLayer2023", service_ssrn_PavementLayer2023, ZIndexes.overlay, 1.0)]);
	//BSM Province Highways
    WMSLayerTogglers.BSM_PH = addLayerToggler(groupTogglerHRV, "BSM Province Hwy 2078/79", [addNewLayer("Nepal:BSM_PH", service_BSM_PH, ZIndexes.overlay, 1.0)]);
	//BSM Province Roads
    WMSLayerTogglers.BSM_PR = addLayerToggler(groupTogglerHRV, "BSM Province Rds 2078/79", [addNewLayer("Nepal:BSM_PR", service_BSM_PR, ZIndexes.overlay, 1.0)]);
	//National Bounadary Line
    WMSLayerTogglers.ssrn_national_boundary_line = addLayerToggler(groupTogglerHRV, "SSRN National Boundary Line", [addNewLayer("Nepal:ssrn_national_boundary_line", service_ssrn_national_boundary_line, ZIndexes.overlay, 1.0)]);
	//Province Line
    WMSLayerTogglers.ssrn_province_line = addLayerToggler(groupTogglerHRV, "SSRN Province Line", [addNewLayer("Nepal:ssrn_province_line", service_ssrn_province_line, ZIndexes.overlay, 1.0)]);
	//District Line
    WMSLayerTogglers.ssrn_district_line = addLayerToggler(groupTogglerHRV, "SSRN District Line", [addNewLayer("Nepal:ssrn_district_line", service_ssrn_district_line, ZIndexes.overlay, 1.0)]);	
	//Municipality Line
    WMSLayerTogglers.bsm_municipality_line = addLayerToggler(groupTogglerHRV, "BSM Municipality Line", [addNewLayer("Nepal:bsm_municipality_line", service_bsm_municipality_line, ZIndexes.overlay, 1.0)]);	
	//Municipality Name
    WMSLayerTogglers.bsm_municipality_name = addLayerToggler(groupTogglerHRV, "BSM Municipality Name", [addNewLayer("Nepal:bsm_municipality_name", service_bsm_municipality_name, ZIndexes.overlay, 1.0)]);	
	//Major River
    WMSLayerTogglers.ssrn_major_river = addLayerToggler(groupTogglerHRV, "SSRN Major River", [addNewLayer("Nepal:ssrn_major_river", service_ssrn_major_river, ZIndexes.overlay, 1.0)]);
	//Places Junction Name
    WMSLayerTogglers.ssrn_junction_name = addLayerToggler(groupTogglerHRV, "SSRN Place Junction Name", [addNewLayer("Nepal:ssrn_junction_name", service_ssrn_junction_name, ZIndexes.overlay, 1.0)]);	
	
	if (debug) console.log(`${scriptName}: WMSLayerTogglers`, WMSLayerTogglers);
 
    setZOrdering(WMSLayerTogglers);
    W.map.events.register("addlayer", null, setZOrdering(WMSLayerTogglers));
    W.map.events.register("removelayer", null, setZOrdering(WMSLayerTogglers));
 
    if (localStorage[storageName]) {
      let JSONStorageOptions = JSON.parse(localStorage[storageName]);
 
      if (debug) console.log(`${scriptName}: Loading Layer and Group States from Storage`);
 
      // Load individual layer toggler states
      for (let key in WMSLayerTogglers) {
        if (JSONStorageOptions[key]) {
          const checkboxElement = document.getElementById(WMSLayerTogglers[key].htmlItem);
          if (checkboxElement) {
            if (JSONStorageOptions[key].checked !== checkboxElement.checked) {
              checkboxElement.click(); // Ensure the visual state matches the saved state
            }
          } else {
            console.warn(`${scriptName}: Checkbox with ID ${WMSLayerTogglers[key].htmlItem} not found.`);
          }
        }
      }
 
      /************************  Need to Fix this when I have time. ******************
      // Load group toggler states 
      document.querySelectorAll('wz-toggle-switch').forEach(groupToggler => {
        const state = JSONStorageOptions[groupToggler.id];
        if (state && state.checked !== groupToggler.checked) {
          groupToggler.click();  // Ensure the visual state matches the saved state
        } else {
          console.warn(`${scriptName}: Group toggler with ID ${groupToggler.id} not found in storage.`);
        }
      });
      ***********************************************************************************/
    } else {
      localStorage[storageName] = {};
    }
 
    window.addEventListener("beforeunload", saveWMSLayersOptions, false);
    if (debug) console.log(`${scriptName}: Croatian WMS layers Script Loaded`);
  }
 
  function saveWMSLayersOptions() {
    const storageObject = {};
 
    // Example for individual layer togglers using WMSLayerTogglers object
    for (let key in WMSLayerTogglers) {
      const element = document.getElementById(WMSLayerTogglers[key].htmlItem);
      if (element) {
        storageObject[key] = { checked: element.checked };
      }
    }
 
    /*********************** NEED TO FIX THIS WHEN I HAVE TIME  ***************************
    // Save group toggler states
    const groupTogglers = document.querySelectorAll('wz-toggle-switch');
    groupTogglers.forEach((toggler) => {
      storageObject[toggler.id] = { checked: toggler.checked };
    });
  *****************************************************************************************/
 
    // Save to local storage using the variable storageName
    if (typeof storageName !== "undefined") {
      localStorage[storageName] = JSON.stringify(storageObject);
    } else {
      console.error("storageName is not defined.");
    }
 
    if (debug) console.log(`${scriptName}: Layer options saved....`);
  }
  /**********************************************************************************************
OL.Layer.WMS(name (String), url (String), params (Object), options (Object, optional) )
 
params (Object): This object contains key-value pairs of parameters to send to the WMS service. Common parameters include:
* LAYERS: Specifies the names of the layers you want to request from the WMS service.
* TRANSPARENT: Usually set to "true" to request transparent images that can be overlaid on other layers.
* FORMAT: The image format for the tiles, commonly "image/png" for transparency.
* VERSION: The version of the WMS request protocol, such as "1.1.1" or "1.3.0".
* STYLES: Defines styles to apply to layers, often an empty string if default styles are desired.
 
options (Object, optional): This optional object provides additional configuration options for the layer. Common options include:
* opacity: Sets the opacity of the layer, typically between 0 (fully transparent) and 1 (fully opaque).
* isBaseLayer: Boolean value indicating whether this layer is a base layer.
* projection: Defines the spatial reference system for the layer.
* tileSize: Specifies the size of the tile as an OL.Size object.
* attribution: Provides attribution text for the layer, often displayed on the map to give credit to data providers.
***************************************************************************************************/
 
  function addNewLayer(id, service, zIndex = 0, opacity = 1) {
    if (debug) console.log(`${scriptName}: addNewKayer() called for: ${id}`);
 
    var newLayer = {};
 
    // Determine if CRS or SRS should be used
    const wmsVersion = service.params.VERSION || "1.3.0"; // Default to 1.3.0 if not specified
    const coordinateSystemParam = wmsVersion >= "1.3.0" ? "CRS" : "SRS";
 
    // Set the appropriate coordinate reference system
    const coordinateSystemValue = service.params[coordinateSystemParam] || "EPSG:6207"; // Default to EPSG:6207 for Nepal
 
    newLayer.zIndex = zIndex == 0 ? ZIndexes.overlay : zIndex;
    newLayer.layer = new OL.Layer.WMS(
      id,
      service.url,
      {
        layers: service.params.LAYERS,
        transparent: service.params.TRANSPARENT || "true",
        format: service.params.FORMAT || "image/png",
        version: wmsVersion,
        [coordinateSystemParam]: coordinateSystemValue,
        styles: service.params.STYLES || "",
      },
      {
        opacity: opacity,
        tileSize: service.tileSize || new OL.Size(512, 512), // Use service-defined tile size if available
        isBaseLayer: false,
        visibility: true,
        transitionEffect: "resize",
        attribution: service.attribution,
        projection: new OL.Projection(coordinateSystemValue), //EPSG:6207 is specifically designed for use in Nepal.
      }
    );
 
    if (debug) console.log(`${scriptName}: addNewKayer() newLayer:`, newLayer);
 
    return newLayer;
  }
 
  function addGroupToggler(isDefault, layerSwitcherGroupItemName, layerGroupVisibleName) {
    var group;
    if (isDefault === true) {
      group = document.getElementById(layerSwitcherGroupItemName).parentElement.parentElement;
    } else {
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
 
    if (debug) console.log(`${scriptName}: Group Toggler created for ${layerGroupVisibleName}`);
 
    return group;
  }
 
  function addLayerToggler(groupToggler, layerName, layerArray) {
    var layerToggler = {};
    layerToggler.layerName = layerName;
    var layerShortcut = layerName.replace(/ /g, "_").replace(".", "");
    layerToggler.htmlItem = "layer-switcher-item_" + layerShortcut;
    layerToggler.layerArray = layerArray;
    var layer_container = groupToggler.getElementsByTagName("UL")[0];
    var layerGroupCheckbox = groupToggler.getElementsByClassName("layer-switcher-toggler-tree-category")[0].getElementsByTagName("wz-toggle-switch")[0];
    var toggler = document.createElement("li");
    var togglerCheckbox = document.createElement("wz-checkbox");
    togglerCheckbox.id = layerToggler.htmlItem;
    togglerCheckbox.className = "hydrated";
    togglerCheckbox.appendChild(document.createTextNode(layerName));
    toggler.appendChild(togglerCheckbox);
    layer_container.appendChild(toggler);
    for (var i = 0; i < layerArray.length; i++) {
      togglerCheckbox.addEventListener("change", layerTogglerEventHandler(layerArray[i]));
      layerGroupCheckbox.addEventListener("change", layerTogglerGroupEventHandler(togglerCheckbox, layerArray[i]));
      layerArray[i].layer.name = layerName + (layerArray.length > 1 ? " " + i : "");
    }
    // REMOVING SHORT CUT KEY, THEY ARE NOT CURRENTLY WORKING
    //registerKeyShortcut("WMS: " + layerName, layerKeyShortcutEventHandler(layerGroupCheckbox, togglerCheckbox), layerShortcut);
 
    if (debug) console.log(`${scriptName}: Layer Toggler created for ${layerName}`);
    return layerToggler;
  }
 
  /***** REMOVING SHORT CUT KEY, THEY ARE NOT CURRENTLY WORKING **************
  function registerKeyShortcut(actionName, callback, keyName) {
    I18n.translations[I18n.locale].keyboard_shortcuts.groups.default.members[keyName] = actionName;
    W.accelerators.addAction(keyName, { group: "default" });
    W.accelerators.events.register(keyName, null, callback);
    W.accelerators._registerShortcuts({ ["name"]: keyName });
  }
    function layerKeyShortcutEventHandler(groupCheckbox, checkbox) {
    return function () {
      if (!groupCheckbox.disabled) {
        checkbox.click();
      }
    };
  }
    *********************************************************************/
 
  function layerTogglerEventHandler(layerType) {
    return function () {
      const isVisible = this.checked;
 
      if (isVisible) {
        W.map.addLayer(layerType.layer);
      } else {
        W.map.removeLayer(layerType.layer);
      }
      layerType.layer.setVisibility(isVisible);
      // Call to save the current state of the layers
      saveWMSLayersOptions();
    };
  }
 
  function layerTogglerGroupEventHandler(groupCheckbox, layerType) {
    return function () {
      // Update visibility only if both group and individual checkbox are checked
      const shouldBeVisible = this.checked && groupCheckbox.checked;
 
      if (shouldBeVisible) {
        W.map.addLayer(layerType.layer);
      } else {
        W.map.removeLayer(layerType.layer);
      }
      // Set the layer visibility
      layerType.layer.setVisibility(shouldBeVisible);
      // Disable the group checkbox if this checkbox is not checked
      groupCheckbox.disabled = !this.checked;
      // Save the current state of the WMS layer options
      saveWMSLayersOptions();
    };
  }
 
  function layerTogglerGroupMinimizerEventHandler(iCaretDown) {
    return function () {
      const ulCollapsible = iCaretDown.closest("li").querySelector("ul");
      iCaretDown.classList.toggle("upside-down");
      ulCollapsible.classList.toggle("collapse-layer-switcher-group");
    };
  }
 
  function setZOrdering(layerTogglers) {
    return function () {
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
 
  document.addEventListener("wme-map-data-loaded", init, { once: true });
})();