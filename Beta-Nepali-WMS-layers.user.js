// ==UserScript==
// @name          Beta - Nepali WMS layers
// @version       2026.09.13.016
// @author        kid4rm90s
// @description   Displays layers from Nepali WMS services in WME
// @include      /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @run-at        document-end
// @namespace     https://greasyfork.org/en/users/1087400-kid4rm90s
// @license       MIT
// @grant         GM_xmlhttpRequest
// @grant         unsafeWindow
// @require       https://greasyfork.org/scripts/560385/code/WazeToastr.js
// @require       https://update.greasyfork.org/scripts/516445/1480246/Make%20GM%20xhr%20more%20parallel%20again.js
// @require https://update.greasyfork.org/scripts/565546/1750869/Preeti%20to%20Unicode%20Converter.js
// @require       https://update.greasyfork.org/scripts/542477/1742119/wmeGisLBBOX.js
// @require             https://update.greasyfork.org/scripts/526229/1537672/GeoGMLer.js
// @require             https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.15.0/proj4-src.js
// @connect       geoserver.softwel.com.np
// @connect       admin.nationalgeoportal.gov.np
// @connect       localhost:8080
// @connect       greasyfork.org
// @connect       geonep.com.np
// @connect       gis.dmgnepal.gov.np

// ==/UserScript==

/*  Scripts modified from Czech WMS layers (https://greasyfork.org/en/scripts/35069-czech-wms-layers; https://greasyfork.org/en/scripts/34720-private-czech-wms-layers, https://greasyfork.org/en/scripts/28160)
orgianl authors: petrjanik, d2-mac, MajkiiTelini, and Croatian WMS layers (https://greasyfork.org/en/scripts/519676-croatian-wms-layers) author: JS55CT
The sidebar panel pattern (gradient header + category cards + per-category opacity slider + checkbox per layer)
and the WME CSS-variable theming are borrowed from the Croatian WMS layers script. */

/* global W */
/* global WazeToastr */
/* global $ */
/* global OpenLayers */
/* global require */

(function main() {
  ('use strict');
  const updateMessage =
'<strong>Added HNs:</strong><br>- Dhangadhi Sub Metropolitan City <br>- Ghodaghodi Municipality <br>- Nepalgunj Sub Metropolitan City<br><br>';
  const scriptName = GM_info.script.name;
  const scriptVersion = GM_info.script.version;
  const downloadUrl = 'https://greasyfork.org/scripts/521924-nepali-wms-layers/code/nepali-wms-layers.user.js';
  let wmeSDK;

  var WMSLayersTechSource = {};
  var W;
  var OL;
  var ZIndexes = {};
  var WMSLayerTogglers = {};
  var loadedGeoJSONLayers = [];
  var geoJsonLayerOffsets = {};
  // Refresh callbacks of the collapsible group cards' "on/total" badges. They are
  // rebuilt with the panel and re-run whenever a layer's checkbox state changes.
  var categoryCountRefreshers = [];

  /* ==================================================================
     SDK KEYBOARD SHORTCUTS
     Replaces the legacy W.accelerators + I18n registration. Keys are
     assigned by the user in WME Settings -> Keyboard Shortcuts and are
     persisted here as { settingsKey: { raw, combo } }.
     Pattern ported from WME EZRoad Mod.
     ================================================================== */
  var sdkShortcutDefs = []; // { id, description, settingsKey, callback } - filled by addLayerToggler()
  var SHORTCUTS_STORAGE_KEY = '_wme_nepali_wms_shortcuts';
  var LEGACY_SHORTCUTS_KEY_SUFFIX = 'KBS'; // WME stored W.accelerators keys under "<scriptName>KBS"
  // settingsKeys whose saved key could not be assigned (conflict) - the sync poll
  // skips them so a preserved key is never clobbered back to null.
  var _conflictBlockedKeys = new Set();
  // settingsKey -> stale combo that getAllShortcuts() still reports after WME moved
  // that key away (SDK quirk: originalShortcut is not cleared on conflict resolution).
  var _conflictStaleKeys = new Map();
  var _shortcutsSyncTimer = null;

  // --- Key-code <-> SDK combo converters -----------------------------
  // WME's own storage uses raw "modifiers,keycode" (e.g. "4,82" = Alt+R) while the
  // SDK uses readable combos ("A+R"). Both formats show up in saved data, so every
  // value is normalized to { raw, combo } before use.
  var _KEYCODE_TO_CHAR = {
    65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I', 74: 'J', 75: 'K', 76: 'L',
    77: 'M', 78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R', 83: 'S', 84: 'T', 85: 'U', 86: 'V', 87: 'W', 88: 'X',
    89: 'Y', 90: 'Z',
    48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
    112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6',
    118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
    32: 'Space', 13: 'Enter', 9: 'Tab', 27: 'Esc', 8: 'Backspace', 46: 'Delete',
    36: 'Home', 35: 'End', 33: 'PageUp', 34: 'PageDown', 45: 'Insert',
    37: '\u2190', 38: '\u2191', 39: '\u2192', 40: '\u2193',
    188: ',', 190: '.', 191: '/', 186: ';', 222: "'", 219: '[', 221: ']', 220: '\\', 189: '-', 187: '=', 192: '',
  };

  var _CHAR_TO_KEYCODE = Object.fromEntries(
    Object.entries(_KEYCODE_TO_CHAR).map(function (entry) {
      return [entry[1].toUpperCase(), Number(entry[0])];
    })
  );

  var _MOD_CHAR_TO_VAL = { C: 1, S: 2, A: 4 };

  function _comboToRaw(str) {
    if (!str || str === '' || str === '-1' || str === 'None') return null;
    if (/^\d+,-?\d+$/.test(str)) {
      var keyCodeRaw = parseInt(str.split(',')[1], 10);
      return keyCodeRaw < 0 ? null : str;
    }
    // Legacy/bare numeric key code ("67" = 'C'). Only 2+ digits are key codes:
    // the SDK reports single-digit keys as the CHARACTER ("8" = the '8' key).
    if (/^\d{2,}$/.test(str)) return '0,' + str;

    var upperStr = String(str).toUpperCase();
    if (/^[A-Z0-9]$/.test(upperStr)) return '0,' + upperStr.charCodeAt(0);
    if (_CHAR_TO_KEYCODE[upperStr] !== undefined) return '0,' + _CHAR_TO_KEYCODE[upperStr];

    function modValueOf(mods) {
      return mods.split('').reduce(function (acc, ch) {
        return acc | (_MOD_CHAR_TO_VAL[ch] || 0);
      }, 0);
    }

    var letterMatch = upperStr.match(/^([ACS]+)\+([A-Z0-9])$/);
    if (letterMatch) return modValueOf(letterMatch[1]) + ',' + letterMatch[2].charCodeAt(0);

    var numericMatch = upperStr.match(/^([ACS]+)\+(\d+)$/);
    if (numericMatch) return modValueOf(numericMatch[1]) + ',' + numericMatch[2];

    var specialMatch = upperStr.match(/^([ACS]+)\+(.+)$/);
    if (specialMatch && _CHAR_TO_KEYCODE[specialMatch[2]] !== undefined) {
      return modValueOf(specialMatch[1]) + ',' + _CHAR_TO_KEYCODE[specialMatch[2]];
    }
    return null;
  }

  function _rawToCombo(str) {
    var raw = _comboToRaw(str);
    if (!raw) return null;
    var parts = raw.split(',');
    var modValue = parseInt(parts[0], 10);
    var keyCode = parseInt(parts[1], 10);
    var keyChar = _KEYCODE_TO_CHAR[keyCode] || String(keyCode);
    var modifiers = '';
    if (modValue & 1) modifiers += 'C';
    if (modValue & 2) modifiers += 'S';
    if (modValue & 4) modifiers += 'A';
    return modifiers ? modifiers + '+' + keyChar : keyChar;
  }

  function _normalizeShortcut(value) {
    var src = value && typeof value === 'object' ? value.raw ?? value.combo : value;
    var raw = _comboToRaw(src);
    return { raw: raw, combo: _rawToCombo(raw) };
  }

  // --- Persistence ---------------------------------------------------
  function loadShortcutKeys() {
    try {
      var saved = JSON.parse(localStorage.getItem(SHORTCUTS_STORAGE_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch (e) {
      console.warn(scriptName + ': could not read saved shortcut keys', e);
      return {};
    }
  }

  function saveShortcutKeys(keys) {
    try {
      localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(keys));
    } catch (e) {
      console.warn(scriptName + ': could not save shortcut keys', e);
    }
  }

  // Migrate keys the user had assigned to the old W.accelerators shortcuts so they
  // survive the switch to the SDK. Legacy format: "<scriptName>KBS" holding
  // [{ "<shortcutString>": "<actionId>" }], where actionId was the layer key.
  function migrateLegacyShortcuts() {
    var legacyStoreKey = scriptName + LEGACY_SHORTCUTS_KEY_SUFFIX;
    var legacyRaw;
    try {
      legacyRaw = JSON.parse(localStorage.getItem(legacyStoreKey));
      if (!Array.isArray(legacyRaw)) return;
    } catch (e) {
      return; // no legacy data
    }

    var keys = loadShortcutKeys();
    var knownSettingsKeys = new Set(sdkShortcutDefs.map(function (d) {
      return d.settingsKey;
    }));
    var migrated = 0;

    legacyRaw.forEach(function (entry) {
      if (!entry) return;
      var shortcutString = Object.keys(entry)[0];
      if (!shortcutString) return;
      var actionId = entry[shortcutString];
      if (!knownSettingsKeys.has(actionId)) return; // not one of our layers
      if (shortcutString === '-1' || shortcutString === 'None' || shortcutString === '') return;
      if (keys[actionId] && keys[actionId].combo !== null) return; // already assigned

      // Legacy values are bare key codes with no modifier prefix. Prefix "0," so a
      // single-digit code (8 = Backspace) is not read as the character '8'.
      var legacyShortcut = String(shortcutString);
      if (/^\d+$/.test(legacyShortcut)) legacyShortcut = '0,' + legacyShortcut;
      keys[actionId] = _normalizeShortcut(legacyShortcut);
      migrated++;
    });

    if (migrated > 0) {
      saveShortcutKeys(keys);
      localStorage.removeItem(legacyStoreKey);
      console.log(scriptName + ': migrated ' + migrated + ' legacy shortcut key(s) to the SDK format.');
    }
  }

  // Register every layer shortcut. Re-runs are safe: existing registrations are
  // deleted first. A key already taken by WME or another script is preserved in
  // storage and the shortcut is registered keyless, with a warning to resolve it.
  function initializeSDKShortcuts() {
    if (!wmeSDK?.Shortcuts || sdkShortcutDefs.length === 0) return;

    sdkShortcutDefs.forEach(function (def) {
      if (wmeSDK.Shortcuts.isShortcutRegistered({ shortcutId: def.id })) {
        wmeSDK.Shortcuts.deleteShortcut({ shortcutId: def.id });
      }
    });

    var keys = loadShortcutKeys();
    sdkShortcutDefs.forEach(function (def) {
      keys[def.settingsKey] = _normalizeShortcut(keys[def.settingsKey]);
    });

    // Duplicate combos can survive from older data: keep the first occurrence,
    // register the rest keyless (their saved key is preserved, never nulled).
    var taken = {};
    var conflicts = [];
    sdkShortcutDefs.forEach(function (def) {
      var combo = keys[def.settingsKey]?.combo || null;
      if (!combo) return;
      if (taken[combo] !== undefined) {
        _conflictBlockedKeys.add(def.settingsKey);
        conflicts.push(def.description + ' (' + combo + ')');
      } else {
        taken[combo] = def.settingsKey;
      }
    });

    sdkShortcutDefs.forEach(function (def) {
      var shortcutKeys = _conflictBlockedKeys.has(def.settingsKey) ? null : keys[def.settingsKey].combo;
      try {
        wmeSDK.Shortcuts.createShortcut({
          shortcutId: def.id,
          description: def.description,
          callback: def.callback,
          shortcutKeys: shortcutKeys,
        });
      } catch (e) {
        if (String(e).indexOf('already in use') !== -1) {
          if (!_conflictBlockedKeys.has(def.settingsKey)) {
            _conflictBlockedKeys.add(def.settingsKey);
            conflicts.push(def.description + ' (' + (keys[def.settingsKey].combo || 'key in use') + ')');
          }
          try {
            wmeSDK.Shortcuts.createShortcut({
              shortcutId: def.id,
              description: def.description,
              callback: def.callback,
              shortcutKeys: null,
            });
          } catch (e2) {
            console.error(scriptName + ': unable to register shortcut ' + def.id, e2);
          }
        } else {
          console.error(scriptName + ': unable to register shortcut ' + def.id, e);
        }
      }
    });

    saveShortcutKeys(keys);

    if (conflicts.length > 0) {
      console.warn(scriptName + ': shortcut conflicts (no key assigned): ' + conflicts.join(', '));
      try {
        WazeToastr.Alerts.warning(
          scriptName,
          'Shortcut conflict: ' + conflicts.join(', ') + ' could not be assigned a key. Resolve it in WME Settings \u2192 Keyboard Shortcuts.',
          false,
          false,
          8000
        );
      } catch (e) {
        console.warn(scriptName + ': WazeToastr warning failed', e);
      }
    }
    console.log(scriptName + ': ' + sdkShortcutDefs.length + ' SDK shortcuts initialized.');
  }

  // WME moves a key away from its previous owner when the user reassigns it, so the
  // SDK state is the source of truth. This syncs SDK -> localStorage for shortcuts
  // the user changed in WME Settings -> Keyboard Shortcuts.
  function checkSDKShortcutsChanged() {
    if (!wmeSDK?.Shortcuts || sdkShortcutDefs.length === 0) return;

    var defsById = {};
    sdkShortcutDefs.forEach(function (def) {
      defsById[def.id] = def;
    });

    var sdkState = {}; // settingsKey -> { raw, combo }
    var combos = {}; // combo -> [settingsKey]
    wmeSDK.Shortcuts.getAllShortcuts().forEach(function (shortcut) {
      var def = defsById[shortcut.shortcutId];
      if (!def) return;
      var normalized = _normalizeShortcut(shortcut.shortcutKeys);
      sdkState[def.settingsKey] = normalized;
      if (normalized.combo) {
        (combos[normalized.combo] = combos[normalized.combo] || []).push(def.settingsKey);
      }
    });

    var keys = loadShortcutKeys();
    var changedKeys = [];
    Object.keys(sdkState).forEach(function (settingsKey) {
      var savedCombo = keys[settingsKey]?.combo || null;
      var sdkCombo = sdkState[settingsKey].combo || null;

      // Stale value from a moved key (SDK quirk) - ignore until it really changes.
      if (_conflictStaleKeys.has(settingsKey)) {
        if (sdkCombo === _conflictStaleKeys.get(settingsKey)) return;
        _conflictStaleKeys.delete(settingsKey);
      }
      // Key we could not assign this session - keep the preserved saved value.
      if (_conflictBlockedKeys.has(settingsKey)) {
        if (sdkCombo === null) return;
        _conflictBlockedKeys.delete(settingsKey);
      }
      if (savedCombo !== sdkCombo) changedKeys.push(settingsKey);
    });

    // Resolve stale duplicates: when several of our shortcuts report the same combo,
    // the one that actually changed is the real holder; the others were displaced by
    // WME and must not be written back as if they still owned the key.
    var staleCleared = false;
    Object.keys(combos).forEach(function (combo) {
      var holders = combos[combo];
      if (holders.length < 2) return;
      var changedHolders = holders.filter(function (settingsKey) {
        return changedKeys.indexOf(settingsKey) !== -1;
      });
      if (changedHolders.length !== 1) return;
      holders.forEach(function (holder) {
        if (holder === changedHolders[0]) return;
        if (_conflictBlockedKeys.has(holder) || _conflictStaleKeys.has(holder)) return;
        keys[holder] = { raw: null, combo: null };
        _conflictStaleKeys.set(holder, combo);
        staleCleared = true;
        console.log(scriptName + ': cleared stale shortcut key for ' + holder + ' (SDK still reports "' + combo + '")');
      });
    });

    if (!staleCleared && changedKeys.length === 0) return;

    changedKeys.forEach(function (settingsKey) {
      if (_conflictStaleKeys.has(settingsKey)) return;
      keys[settingsKey] = sdkState[settingsKey];
    });

    saveShortcutKeys(keys);
    console.log(scriptName + ': SDK shortcut changes saved.');
    try {
      WazeToastr.Alerts.success(scriptName, 'Keyboard shortcut(s) saved.', false, false, 2500);
    } catch (e) {
      console.warn(scriptName + ': WazeToastr success failed', e);
    }
  }

  function startShortcutKeySync() {
    if (_shortcutsSyncTimer) return;
    var handler = function () {
      try {
        checkSDKShortcutsChanged();
      } catch (e) {
        console.error(scriptName + ': shortcut sync failed', e);
      }
    };
    window.addEventListener('beforeunload', handler);
    _shortcutsSyncTimer = setInterval(handler, 5000);
  }

  // WME's map model has no centre until the map is centred, and reading .lat from a
  // null centre throws a TypeError inside the shift maths. Falls back to the OL2 map
  // centre (same value) and finally to Nepal's latitude - it only scales metres to
  // degrees, so a rough value is harmless.
  function getMapCenterLat() {
    try {
      var center = W.map.getCenter();
      if (center && typeof center.lat === 'number') return center.lat;
      var olMap = W.map.getOLMap();
      var olCenter = olMap && olMap.getCenter();
      if (olCenter && typeof olCenter.lat === 'number') return olCenter.lat;
    } catch (e) {
      // Ignore - fall through to the default below.
    }
    return 27.7;
  }

  // Helper: update GeoJSON layer selector dropdown
  function updateGeoJsonLayerSelector() {
    const select = document.getElementById('geoJsonLayerSelect');
    if (!select) return;

    // Clear existing options except first (default)
    while (select.options.length > 1) {
      select.remove(1);
    }

    // Add options for each loaded layer
    loadedGeoJSONLayers.forEach(layerInfo => {
      const option = document.createElement('option');
      option.value = layerInfo.name;
      option.textContent = layerInfo.name;
      select.appendChild(option);
    });

    // Reset to default if no layers
    if (loadedGeoJSONLayers.length === 0) {
      select.selectedIndex = 0;
    }
  }

  /* ------------------------------------------------------------------
     GeoJSON layers (LMC ward buildings / ward boundaries) - SDK feature layers.
     Replaces OL.Format.GeoJSON + OL.Layer.Vector + OL.StyleMap: the SDK's
     FeatureStyle is the OL2 style key list, so the old styles are declared as
     style rules instead. Labels are read through styleContext getters, which is
     what lets the label colour/size inputs re-render a loaded layer through
     redrawLayer() without reloading the ward.
     ------------------------------------------------------------------ */
  var geoJsonLabelStyle = { fontColor: '#ffffff', fontSize: '13' };

  var GEOJSON_LAYER_STYLES = {
    buildings: {
      stroke: true,
      strokeColor: '#FF5722',
      strokeWidth: 2,
      strokeOpacity: 0.8,
      fill: true,
      fillColor: '#FF5722',
      fillOpacity: 0.01,
      pointRadius: 4,
      label: '${getLabel}',
      labelAlign: 'cm',
      labelOutlineColor: '#000000',
      labelOutlineWidth: 3,
      fontSize: '${getFontSize}',
      fontWeight: 'bold',
      fontFamily: 'inherit',
      fontColor: '${getFontColor}',
    },
    boundary: {
      stroke: true,
      strokeColor: '#FF0000',
      strokeWidth: 3,
      strokeOpacity: 0.9,
      fill: true,
      fillColor: '#FF0000',
      fillOpacity: 0.05,
      pointRadius: 4,
      label: '',
    },
  };

  function findGeoJsonLayer(layerName) {
    for (var i = 0; i < loadedGeoJSONLayers.length; i++) {
      if (loadedGeoJSONLayers[i].name === layerName) return loadedGeoJSONLayers[i];
    }
    return null;
  }

  // Translate every coordinate of a GeoJSON geometry in place - the SDK has no
  // geometry.move(). The recursion covers Point/LineString/Polygon/Multi*.
  function translateGeoJsonCoordinates(coordinates, dLon, dLat) {
    if (!coordinates || coordinates.length === 0) return;
    if (typeof coordinates[0] === 'number') {
      coordinates[0] += dLon;
      coordinates[1] += dLat;
      return;
    }
    for (var i = 0; i < coordinates.length; i++) {
      translateGeoJsonCoordinates(coordinates[i], dLon, dLat);
    }
  }

  function translateGeoJsonFeatures(features, dLon, dLat) {
    if (!features) return;
    features.forEach(function (feature) {
      if (feature && feature.geometry) translateGeoJsonCoordinates(feature.geometry.coordinates, dLon, dLat);
    });
  }

  // Draw a geometry change: the feature objects are ours, so they can be removed
  // and re-added (the SDK has no "move feature" call).
  function redrawGeoJsonLayer(info) {
    try {
      wmeSDK.Map.removeAllFeaturesFromLayer({ layerName: info.name });
      wmeSDK.Map.dangerouslyAddFeaturesToLayerWithoutValidation({ features: info.sdkFeatures, layerName: info.name });
    } catch (e) {
      console.error(`${scriptName}: could not re-render layer ${info.name}`, e);
    }
  }

  // Label colour/size are read by the styleContext getters on every render, so a
  // change only needs a redraw of the building layers.
  function applyGeoJsonLabelStyle(fontColor, fontSize) {
    if (fontColor) geoJsonLabelStyle.fontColor = fontColor;
    if (fontSize) geoJsonLabelStyle.fontSize = String(fontSize);
    loadedGeoJSONLayers.forEach(function (info) {
      if (info.layerType !== 'buildings') return;
      try {
        wmeSDK.Map.redrawLayer({ layerName: info.name });
      } catch (e) {
        console.warn(`${scriptName}: could not redraw layer ${info.name}`, e);
      }
    });
  }

  // Helper: shift GeoJSON layer
  function shiftGeoJsonLayer(direction) {
    const selectElem = document.getElementById('geoJsonLayerSelect');
    const distInput = document.getElementById('geoJsonShiftDistance');
    
    if (!selectElem || !distInput) return;
    
    const layerName = selectElem.value;
    const dist = parseFloat(distInput.value) || 0;
    
    if (!layerName || dist === 0) {
      WazeToastr.Alerts.warning('Selection Required', 'Please select a layer and enter a shift distance.', false, false, 2000);
      return;
    }

    // Find the layer
    const layerInfo = loadedGeoJSONLayers.find(l => l.name === layerName);
    if (!layerInfo) return;

    // Find paired layer (boundary/building)
    const layersToShift = [layerInfo];
    const wardNo = layerInfo.wardNo;
    if (wardNo) {
      const pairedLayerName = layerInfo.layerType === 'buildings' 
        ? `LMC_Ward_${wardNo}_Boundary`
        : `LMC_Ward_${wardNo}_Buildings`;
      const pairedLayer = loadedGeoJSONLayers.find(l => l.name === pairedLayerName);
      if (pairedLayer) {
        layersToShift.push(pairedLayer);
      }
    }

    // SDK feature layers always store WGS84 degrees, so the distance is converted
    // from metres to degrees here - the map's own projection is no longer relevant.
    let dx = 0,
      dy = 0; // metres, east / north
    const diag = dist * 0.7071; // sqrt(2)/2 for diagonal

    // Direction convention (field-verified on the map): this table is the horizontal
    // MIRROR of the WMS shiftLayer() table - dx is negated for left/right and for the
    // diagonals, dy is not. The WMS pad shifts the request bbox (content moves the
    // opposite way), this pad translates the features, so the two tables differ by
    // design. Do not "correct" it back to the WMS negation without a fresh test.
    switch (direction) {
      case 'up': dy = dist; break;
      case 'down': dy = -dist; break;
      case 'left': dx = dist; break;
      case 'right': dx = -dist; break;
      case 'upleft': dx = diag; dy = diag; break;
      case 'upright': dx = -diag; dy = diag; break;
      case 'downleft': dx = diag; dy = -diag; break;
      case 'downright': dx = -diag; dy = -diag; break;
    }

    const centerLat = getMapCenterLat();
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLon = (40075000 * Math.cos((centerLat * Math.PI) / 180)) / 360;
    const dLon = dx / metersPerDegreeLon;
    const dLat = dy / metersPerDegreeLat;

    // Shift all paired layers together
    layersToShift.forEach(info => {
      const shiftLayerName = info.name;

      // Offset is kept in degrees so Reset can undo it exactly
      if (!geoJsonLayerOffsets[shiftLayerName]) {
        geoJsonLayerOffsets[shiftLayerName] = { x: 0, y: 0 };
      }
      geoJsonLayerOffsets[shiftLayerName].x += dLon;
      geoJsonLayerOffsets[shiftLayerName].y += dLat;

      // No geometry.move() in the SDK - translate the coordinates and re-add
      translateGeoJsonFeatures(info.sdkFeatures, dLon, dLat);
      redrawGeoJsonLayer(info);
    });

    const shiftMsg = layersToShift.length > 1 
      ? `Ward ${wardNo} layers shifted ${dist} meters ${direction}`
      : `Layer shifted ${dist} meters ${direction}`;
    WazeToastr.Alerts.info('Layer Shifted', shiftMsg, false, false, 2000);
  }

  // Helper: reset GeoJSON layer shift
  function resetGeoJsonShift() {
    const selectElem = document.getElementById('geoJsonLayerSelect');
    if (!selectElem) return;

    const layerName = selectElem.value;
    if (!layerName) {
      WazeToastr.Alerts.warning('Selection Required', 'Please select a layer to reset.', false, false, 2000);
      return;
    }

    // Find the layer
    const layerInfo = loadedGeoJSONLayers.find(l => l.name === layerName);
    if (!layerInfo) return;

    // Find paired layer (boundary/building)
    const layersToReset = [layerInfo];
    const wardNo = layerInfo.wardNo;
    if (wardNo) {
      const pairedLayerName = layerInfo.layerType === 'buildings' 
        ? `LMC_Ward_${wardNo}_Boundary`
        : `LMC_Ward_${wardNo}_Buildings`;
      const pairedLayer = loadedGeoJSONLayers.find(l => l.name === pairedLayerName);
      if (pairedLayer) {
        layersToReset.push(pairedLayer);
      }
    }

    let hasOffset = false;
    layersToReset.forEach(info => {
      const resetLayerName = info.name;
      const offset = geoJsonLayerOffsets[resetLayerName];

      if (offset && (offset.x !== 0 || offset.y !== 0)) {
        hasOffset = true;
        // Move back to original position
        translateGeoJsonFeatures(info.sdkFeatures, -offset.x, -offset.y);

        // Reset offset
        geoJsonLayerOffsets[resetLayerName] = { x: 0, y: 0 };

        // Re-render layer
        redrawGeoJsonLayer(info);
      }
    });

    if (hasOffset) {
      const resetMsg = layersToReset.length > 1
        ? `Ward ${wardNo} layers position reset to original`
        : 'Layer position reset to original';
      WazeToastr.Alerts.success('Shift Reset', resetMsg, false, false, 2000);
    } else {
      WazeToastr.Alerts.info('No Shift', 'Layer has no offset to reset.', false, false, 2000);
    }
  }

  async function init() {
      console.log(`${scriptName} initializing.`);
      W = unsafeWindow.W;
      OL = unsafeWindow.OpenLayers;

      WMSLayersTechSource.tileSizeG = new OL.Size(512, 512);
    WMSLayersTechSource.resolutions = [
      156543.03390625, 78271.516953125, 39135.7584765625, 19567.87923828125, 9783.939619140625, 4891.9698095703125, 2445.9849047851562, 1222.9924523925781, 611.4962261962891, 305.74811309814453, 152.87405654907226, 76.43702827453613,
      38.218514137268066, 19.109257068634033, 9.554628534317017, 4.777314267158508, 2.388657133579254, 1.194328566789627, 0.5971642833948135, 0.298582141697406, 0.149291070848703, 0.0746455354243515, 0.0373227677121757,
    ];
    ZIndexes.base = W.map.getOLMap().Z_INDEX_BASE.Overlay + 20;
    ZIndexes.overlay = W.map.getOLMap().Z_INDEX_BASE.Overlay + 100;
    ZIndexes.popup = W.map.getOLMap().Z_INDEX_BASE.Overlay + 500;

    /* ------------------------------------------------------------------
       Built-in default shifts - "this service is published in the wrong place".
       Keyed by layer key (the WMSLayerTogglers.* name). The values are metres the
       DRAWN CONTENT has to move, named the way you measure them on the map, so a
       correction can be written down straight away:

         { west: 260, north: 20 }  -> pull the layer 260 m west and 20 m north
         { east: 30, south: 15 }   -> push it 30 m east and 15 m south

       Only WMS layers can be shifted (an external XYZ basemap has no bbox to move).
       The shift is in place before the first tile of that layer is drawn - no manual
       nudging needed after a reload. A shift made by hand with the pad is remembered
       per layer as well, and "Reset Shift" returns to the default below.
       ------------------------------------------------------------------ */
    var WMS_LAYER_SHIFT_PRESETS = {
      // DMG's municipal boundary is published ~260 m east and ~20 m south of its real
      // position, so the content is pulled west and north until it lines up with WME.
      wms_dmg_municipality: { west: 250, north: 25 },
      wms_dmg_districts: { west: 250, north: 25 },
    };

    // adresy WMS služeb * WMS service addresses
    var service_wms_PL2023 = {
      type: 'WMS',
      url: 'https://geoserver.softwel.com.np/geoserver/ows/wms?CQL_FILTER=dyear%3D%272023%27',
      attribution: '© DoR / Softwel.com.np',
      comment: 'ssrn_PavementLayer2023',
    };

    var service_wms_softwel = {
      type: 'WMS',
      url: 'https://geoserver.softwel.com.np/geoserver/ows/wms?',
      attribution: '© DoR Nepal/Softwel.com.np',
      comment: 'geoserver softwel.com.np',
    };

    var service_wms_geoportal = {
      type: 'WMS',
      url: 'https://admin.nationalgeoportal.gov.np/geoserver/wms?',
      attribution: '© National Geoportal Nepal',
      comment: 'Municipalities names and boundaries',
    };
    var service_wms_dmgnepal = {
      type: 'WMS',
      url: 'http://gis.dmgnepal.gov.np:8080/geoserver/dmg/wms?',
      attribution: '© Department of Mines and Geology Nepal',
      comment: 'Municipalities names and boundaries',
    };
    // var service_wms_geo_lalitpur = {
    //   type: 'WMS_4326',
    //   url: 'http://localhost:8080/geoserver/geo-lalitpur/wms?',
    //   attribution: '© Geonp.com.np / LMC',
    //   comment: 'Lalitpur House numbers and boundaries',
    // };

    //skupiny vrstev v menu * MapTile service addresses
    var service_xyz_livemap = {
      type: 'XYZ',
      url: ['https://worldtiles1.waze.com/tiles/${z}/${x}/${y}.png?highres=true', 'https://worldtiles2.waze.com/tiles/${z}/${x}/${y}.png?highres=true', 'https://worldtiles3.waze.com/tiles/${z}/${x}/${y}.png?highres=true'],
      attribution: "© 2006-2023 Waze Mobile. Všechna práva vyhrazena. <a href='https://www.waze.com/legal/notices' target='_blank'>Poznámky</a>",
      comment: 'Waze Livemapa',
    };
    var service_xyz_google = {
      type: 'XYZ',
      url: [
        'https://mts0.googleapis.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}',
        'https://mts1.googleapis.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}',
        'https://mts2.googleapis.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}',
        'https://mts3.googleapis.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}',
      ],
      attribution: "Mapová data ©2023 GeoBasis-DE/BKG (©2009),Google <a href='https://www.google.com/intl/cs_cz/help/terms_maps.html' target='_blank'>Terms and conditions</a>",
      comment: 'Google Mapy',
    };
    var service_xyz_google_terrain = {
      type: 'XYZ',
      url: [
        'https://mts0.googleapis.com/vt/lyrs=p&x=${x}&y=${y}&z=${z}',
        'https://mts1.googleapis.com/vt/lyrs=p&x=${x}&y=${y}&z=${z}',
        'https://mts2.googleapis.com/vt/lyrs=p&x=${x}&y=${y}&z=${z}',
        'https://mts3.googleapis.com/vt/lyrs=p&x=${x}&y=${y}&z=${z}',
      ],
      attribution: "Mapová data ©2023 GeoBasis-DE/BKG (©2009),Google <a href='https://www.google.com/intl/cs_cz/help/terms_maps.html' target='_blank'>Terms and conditions</a>",
      comment: 'Google Terénní Mapy',
    };
    var service_xyz_google_hybrid = {
      type: 'XYZ',
      url: [
        'https://mts0.googleapis.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}',
        'https://mts1.googleapis.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}',
        'https://mts2.googleapis.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}',
        'https://mts3.googleapis.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}',
      ],
      attribution: "Snímky ©2023 Landsat / Copernicus, Google, GEODIS Brno, Mapová data ©2023 GeoBasis-DE/BKG (©2009),Google <a href='https://www.google.com/intl/cs_cz/help/terms_maps.html' target='_blank'>Terms and conditions</a>",
      comment: 'Google Hybridní Mapy',
    };
    var service_xyz_google_streetview = {
      type: 'XYZ',
      url: [
        'https://mts0.google.com/mapslt?lyrs=svv&&x=${x}&y=${y}&z=${z}&style=40',
        'https://mts1.google.com/mapslt?lyrs=svv&&x=${x}&y=${y}&z=${z}&style=40',
        'https://mts2.google.com/mapslt?lyrs=svv&&x=${x}&y=${y}&z=${z}&style=40',
        'https://mts3.google.com/mapslt?lyrs=svv&&x=${x}&y=${y}&z=${z}&style=40',
      ],
      attribution: "Google <a href='https://www.google.com/intl/cs_cz/help/terms_maps.html' target='_blank'>Terms and conditions</a>",
      comment: 'Google Streetview',
    };
    var service_xyz_osm = {
      type: 'XYZ',
      maxZoom: 20,
      url: ['https://tile.openstreetmap.org/${z}/${x}/${y}.png'],
      attribution: "© Contributors <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>",
      comment: 'OpenStreetMaps',
    };
    var service_xyz_april = {
      type: 'XYZ',
      maxZoom: 19,
      url: [
        'https://worldtiles1.waze.com/tiles/${z}/${x}/${y}.png?highres=true',
        'https://mts0.googleapis.com/vt/lyrs=m&z=${z}&x=${x}&y=${y}',
        'https://mts0.googleapis.com/vt/lyrs=p&z=${z}&x=${x}&y=${y}',
        'https://tile.openstreetmap.org/${z}/${x}/${y}.png',
      ],
      attribution: 'mišmaš',
      comment: 'mišmaš',
    };

    //skupiny vrstev v menu * layer groups in the menu
    // WME's layer switcher is a shadow-DOM web component, so the checkboxes are created
    // through wmeSDK.LayerSwitcher instead of hand-made DOM. The SDK exposes a flat
    // checkbox list (there is no group API), so each group name is kept as a label
    // prefix to keep the list organised and ordered.
    var groupTogglerPlaces = 'NP Places';
    var groupTogglerRoad = 'NP Roads';
    var groupTogglerHNS = 'NP Metric HNs';
    var groupTogglerNames = 'NP names and addresses';
    var groupTogglerBorders = 'NP Borders';
    var groupTogglerExternal = 'External Maps!!!';

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
    WMSLayerTogglers.wms_rivers = addLayerToggler(groupTogglerPlaces, 'Rivers', false, [addNewLayer('wms_rivers', service_wms_softwel, 'ssrn:ssrn_major_river,npgp:river_nepal')]);
    WMSLayerTogglers.wms_airport = addLayerToggler(groupTogglerPlaces, 'Geoportal Airports', false, [addNewLayer('wms_airport', service_wms_geoportal, 'geonode:Transportation', ZIndexes.popup)]);
    // Separate education facility layers to avoid duplicate labels
    WMSLayerTogglers.wms_prtmp_education = addLayerToggler(groupTogglerPlaces, 'Education Facilities (PRTMP)', false, [addNewLayer('wms_prtmp_education', service_wms_softwel, 'prtmp_01:prtmp_education', ZIndexes.popup)]);
    WMSLayerTogglers.wms_prtmp_health = addLayerToggler(groupTogglerPlaces, 'Health Facilities (PRTMP)', false, [addNewLayer('wms_prtmp_health', service_wms_softwel, 'prtmp_01:health_facilities', ZIndexes.popup)]);
    WMSLayerTogglers.wms_geoportal_health = addLayerToggler(groupTogglerPlaces, 'Health Facilities (Geoportal)', false, [addNewLayer('wms_geoportal_health', service_wms_geoportal, 'geonode:health_facilities', ZIndexes.popup)]);
    WMSLayerTogglers.wms_geoportal_police = addLayerToggler(groupTogglerPlaces, 'Police Units (Geoportal)', false, [addNewLayer('wms_geoportal_police', service_wms_geoportal, 'geonode:All_Nepal_Final_short', ZIndexes.popup)]);
    WMSLayerTogglers.wms_prtmp_palika = addLayerToggler(groupTogglerPlaces, 'Palika Centre (PRTMP)', false, [addNewLayer('wms_prtmp_palika', service_wms_softwel, 'prtmp_01:palika_center,prtmp_01:palika_center_name', ZIndexes.popup)]);
    WMSLayerTogglers.wms_prtmp_ward = addLayerToggler(groupTogglerPlaces, 'Ward Centre (PRTMP)', false, [addNewLayer('wms_prtmp_ward', service_wms_softwel, 'prtmp_01:prtmp_ward_center', ZIndexes.popup)]);
    WMSLayerTogglers.wms_prtmp_tourist = addLayerToggler(groupTogglerPlaces, 'Tourist Attraction', false, [addNewLayer('wms_prtmp_tourist', service_wms_softwel, 'prtmp_01:tourist_attraction', ZIndexes.popup)]);
    WMSLayerTogglers.wms_prtmp_customs = addLayerToggler(groupTogglerPlaces, 'Customs Office', false, [addNewLayer('wms_prtmp_customs', service_wms_softwel, 'prtmp_01:trade_transit', ZIndexes.popup)]);

    //SILNICE * ROAD
    WMSLayerTogglers.wms_PL2023 = addLayerToggler(groupTogglerRoad, 'SSRN Highway 2023', false, [addNewLayer('wms_PL2023', service_wms_PL2023, 'ssrn:ssrn_pavementstatus')]);
    WMSLayerTogglers.wms_PRTMP_NH = addLayerToggler(groupTogglerRoad, 'NH 2023 (BSM/PRTMP)', false, [addNewLayer('wms_PRTMP_NH', service_wms_softwel, 'prtmp_01:road_network,prtmp_01:road_network_name', "road_class='NH';road_class='NH'")]);
    WMSLayerTogglers.wms_PRTMP_PH = addLayerToggler(groupTogglerRoad, 'PH 2023 (BSM/PRTMP)', false, [addNewLayer('wms_PRTMP_PH', service_wms_softwel, 'prtmp_01:road_network,prtmp_01:road_network_name', "road_class='PH';road_class='PH'")]);
    WMSLayerTogglers.wms_PRTMP_PR = addLayerToggler(groupTogglerRoad, 'PR 2023 (BSM/PRTMP)', false, [addNewLayer('wms_PRTMP_PR', service_wms_softwel, 'prtmp_01:road_network,prtmp_01:road_network_name', "road_class='PR';road_class='PR'")]);
    WMSLayerTogglers.wms_BSM_Bridge = addLayerToggler(groupTogglerRoad, 'Bridges (BSM)', false, [addNewLayer('wms_BSM_Bridge', service_wms_softwel, 'bsm:bsm_nc_primary_detail,bsm:nc_primary_detail_code,bsm:bsm_bi_primary_detail', ZIndexes.popup)]);
    WMSLayerTogglers.wms_prtmp_bridge = addLayerToggler(groupTogglerRoad, 'Bridges (PRTMP)', false, [addNewLayer('wms_prtmp_bridge', service_wms_softwel, 'prtmp_01:bridge_inventory_local,prtmp_01:local_bridge,prtmp_01:major_bridge', ZIndexes.popup)]);

    //Metric HNs
        // Dhangadhi
    WMSLayerTogglers.wms_DhangadhiMetricHNS_mun_road = addLayerToggler(groupTogglerHNS, 'Dhangadhi Mun Road', false, [addNewLayer('wms_DhangadhiMetricHNS_mun_road', service_wms_softwel, 'MetricHNS:mun_road', "mun_code = 70813"),addNewLayer('wms_DhangadhiMetricHNS_mun_road', service_wms_softwel, 'MetricHNS:mun_road_noname', "mun_code = 70813")]);
    WMSLayerTogglers.wms_DhangadhiMetricHNS_HNS = addLayerToggler(groupTogglerHNS, 'Dhangadhi House Numbers', false, [addNewLayer('wms_DhangadhiMetricHNS_HNS', service_wms_softwel, 'MetricHNS:hh', 'mun_code = 70813')]);
    WMSLayerTogglers.wms_DhangadhiWards = addLayerToggler(groupTogglerHNS, 'Dhangadhi Wards', false, [addNewLayer('wms_DhangadhiWards', service_wms_softwel, 'MetricHNS:mhns_basemap_ward_boundary_polygon', "loc_code='70813'")]);
// Ghodaghodi
    WMSLayerTogglers.wms_GhodaghodiMetricHNS_mun_road = addLayerToggler(groupTogglerHNS, 'Ghodaghodi Mun Road', false, [addNewLayer('wms_GhodaghodiMetricHNS_mun_road', service_wms_softwel, 'MetricHNS:mun_road', "mun_code = 70805"),addNewLayer('wms_GhodaghodiMetricHNS_mun_road', service_wms_softwel, 'MetricHNS:mun_road_noname', "mun_code = 70805")]);
    WMSLayerTogglers.wms_GhodaghodiMetricHNS_HNS = addLayerToggler(groupTogglerHNS, 'Ghodaghodi House Numbers', false, [addNewLayer('wms_GhodaghodiMetricHNS_HNS', service_wms_softwel, 'MetricHNS:hh', 'mun_code = 70805')]);
    WMSLayerTogglers.wms_GhodaghodiWards = addLayerToggler(groupTogglerHNS, 'Ghodaghodi Wards', false, [addNewLayer('wms_GhodaghodiWards', service_wms_softwel, 'MetricHNS:mhns_basemap_ward_boundary_polygon', "loc_code='70805'")]);
 // Nepalgunj   
    WMSLayerTogglers.wms_NepalgunjMetricHNS_mun_road = addLayerToggler(groupTogglerHNS, 'Nepalgunj Mun Road', false, [addNewLayer('wms_NepalgunjMetricHNS_mun_road', service_wms_softwel, 'MetricHNS:mun_road', "mun_code = 51106"),addNewLayer('wms_NepalgunjMetricHNS_mun_road', service_wms_softwel, 'MetricHNS:mun_road_noname', "mun_code = 51106")]);
    WMSLayerTogglers.wms_NepalgunjMetricHNS_HNS = addLayerToggler(groupTogglerHNS, 'Nepalgunj House Numbers', false, [addNewLayer('wms_NepalgunjMetricHNS_HNS', service_wms_softwel, 'MetricHNS:hh', 'mun_code = 51106')]);
    WMSLayerTogglers.wms_NepalgunjWards = addLayerToggler(groupTogglerHNS, 'Nepalgunj Wards', false, [addNewLayer('wms_NepalgunjWards', service_wms_softwel, 'MetricHNS:mhns_basemap_ward_boundary_polygon', "loc_code='51106'")]);

    //ČÚZK NÁZVY A ADRESY * ČÚZK NAMES AND ADDRESSES
    WMSLayerTogglers.wms_mun_name = addLayerToggler(groupTogglerNames, 'BSM Municipality Names', false, [addNewLayer('wms_mun_name', service_wms_softwel, 'bsm:bsm_localbodies_label')]);
    WMSLayerTogglers.wms_junction_name = addLayerToggler(groupTogglerNames, 'SSRN Junction Names', false, [addNewLayer('wms_junction_name', service_wms_softwel, 'ssrn:ssrn_junction_name')]);

    //ČÚZK HRANICE * BORDER BOARD
    WMSLayerTogglers.wms_geonational = addLayerToggler(groupTogglerBorders, 'Geoportal National Border', false, [addNewLayer('wms_geonational', service_wms_geoportal, 'geonode:nepal')]);
    WMSLayerTogglers.wms_national = addLayerToggler(groupTogglerBorders, 'SSRN National Border', false, [addNewLayer('wms_national', service_wms_softwel, 'ssrn:ssrn_national_boundary_line')]);
    WMSLayerTogglers.wms_geoprovince = addLayerToggler(groupTogglerBorders, 'Geoportal Province Border', false, [addNewLayer('wms_geoprovince', service_wms_geoportal, 'geonode:province')]);
    WMSLayerTogglers.wms_province = addLayerToggler(groupTogglerBorders, 'SSRN Province Border', false, [addNewLayer('wms_province', service_wms_softwel, 'ssrn:ssrn_province_line')]);
    WMSLayerTogglers.wms_geodistrict = addLayerToggler(groupTogglerBorders, 'Geoportal District Border', false, [addNewLayer('wms_geodistrict', service_wms_geoportal, 'geonode:districts')]);
    WMSLayerTogglers.wms_district = addLayerToggler(groupTogglerBorders, 'SSRN District Border', false, [addNewLayer('wms_district', service_wms_softwel, 'ssrn:ssrn_district_boundary_line')]);
    WMSLayerTogglers.wms_geomunicipality = addLayerToggler(groupTogglerBorders, 'Geoportal Municipality Border', false, [addNewLayer('wms_geomunicipality', service_wms_geoportal, 'geonode:NepalLocalUnits0')]);
    WMSLayerTogglers.wms_municipality = addLayerToggler(groupTogglerBorders, 'BSM Municipality Border', false, [addNewLayer('wms_municipality', service_wms_softwel, 'bsm:bsm_localbodies_line')]);
    WMSLayerTogglers.wms_dmg_states = addLayerToggler(groupTogglerBorders, 'DMG Province Border', false, [addNewLayer('wms_dmg_states', service_wms_dmgnepal, 'dmg:states')]);
    WMSLayerTogglers.wms_dmg_districts = addLayerToggler(groupTogglerBorders, 'DMG District Border', false, [addNewLayer('wms_dmg_districts', service_wms_dmgnepal, 'dmg:districts')]);
    WMSLayerTogglers.wms_dmg_municipality = addLayerToggler(groupTogglerBorders, 'DMG Municipality Border', false, [addNewLayer('wms_dmg_municipality', service_wms_dmgnepal, 'dmg:locallevels')]);

    //EXTERNÍ MAPY * EXTERNAL MAPS
    WMSLayerTogglers.xyz_livemap = addLayerToggler(groupTogglerExternal, 'Waze LiveMap', false, [addNewLayer('xyz_livemap', service_xyz_livemap)]);
    WMSLayerTogglers.xyz_google = addLayerToggler(groupTogglerExternal, 'Google Maps', false, [addNewLayer('xyz_google', service_xyz_google)]);
    WMSLayerTogglers.xyz_google_terrain = addLayerToggler(groupTogglerExternal, 'Google Terrain Maps', false, [addNewLayer('xyz_google_terrain', service_xyz_google_terrain)]);
    WMSLayerTogglers.xyz_google_hybrid = addLayerToggler(groupTogglerExternal, 'Google Hybrid Maps', false, [addNewLayer('xyz_google_hybrid', service_xyz_google_hybrid)]);
    WMSLayerTogglers.xyz_google_streetview = addLayerToggler(groupTogglerExternal, 'Google StreetView', false, [addNewLayer('xyz_google_streetview', service_xyz_google_streetview, null, ZIndexes.popup)]);
    WMSLayerTogglers.xyz_osm = addLayerToggler(groupTogglerExternal, 'OpenStreetMaps', false, [addNewLayer('xyz_osm', service_xyz_osm)]);
    WMSLayerTogglers.xyz_april = addLayerToggler(groupTogglerExternal, 'Apríl !!!', false, [addNewLayer('xyz_april', service_xyz_april)]);


    // --- Layer switcher: ONE master checkbox for the whole script; the individual
    //     layers live in the script's own sidebar tab (Croatian WMS pattern) ---
    masterLayerToggleOn = loadMasterToggleState();
    restoreLayerTogglerStates(); // only loads the per-layer checkbox state
    registerMasterLayerCheckbox();

    // Fired by the SDK when the user toggles the master checkbox.
    wmeSDK.Events.on({
      eventName: 'wme-layer-checkbox-toggled',
      eventHandler: function (evt) {
        if (!evt || evt.name !== scriptName) return; // not our master checkbox
        masterLayerToggleOn = !!evt.checked;
        saveMasterToggleState(masterLayerToggleOn);
        syncAllTogglerVisibility();
      },
    });

    // --- SDK keyboard shortcuts (one per layer toggler) ---
    migrateLegacyShortcuts();
    initializeSDKShortcuts();
    startShortcutKeySync();
    /*********************  start of popup code ***************************/
    // --- WMS GetFeatureInfo popup for SSRN Pavement Layer ---
    // const map = W.map.getOLMap();
    // Note: wmeSDK.Map APIs used for map extent/size; OL2 map kept only where no SDK alternative exists

    // Helper: get all visible supported WMS layers for popup
    function getAllVisibleWMSLayerInfo() {
      const supported = [
        { key: 'wms_rivers', service: service_wms_softwel, queryLayer: 'ssrn:ssrn_major_river,npgp:river_nepal', displayName: 'Rivers', formatFn: (feature) => formatFeatureInfo('RIVER', feature) },
        { key: 'wms_prtmp_education', service: service_wms_softwel, queryLayer: 'prtmp_01:prtmp_education', displayName: 'Education Facilities (PRTMP)', formatFn: (feature) => formatFeatureInfo('EDUCATION', feature) },
        { key: 'wms_prtmp_health', service: service_wms_softwel, queryLayer: 'prtmp_01:health_facilities', displayName: 'Health Facilities (PRTMP)', formatFn: (feature) => formatFeatureInfo('HEALTH', feature) },
        { key: 'wms_geoportal_health', service: service_wms_geoportal, queryLayer: 'geonode:health_facilities', displayName: 'Health Facilities (Geoportal)', formatFn: (feature) => formatFeatureInfo('GEO_HEALTH', feature) },
        { key: 'wms_geoportal_police', service: service_wms_geoportal, queryLayer: 'geonode:All_Nepal_Final_short', displayName: 'Police Units (Geoportal)', formatFn: (feature) => formatFeatureInfo('GEO_POLICE', feature) },
        { key: 'wms_prtmp_palika', service: service_wms_softwel, queryLayer: 'prtmp_01:palika_center', displayName: 'Palika Centre (PRTMP)', formatFn: (feature) => formatFeatureInfo('PALIKA', feature) },
        { key: 'wms_prtmp_ward', service: service_wms_softwel, queryLayer: 'prtmp_01:prtmp_ward_center', displayName: 'Ward Centre (PRTMP)', formatFn: (feature) => formatFeatureInfo('WARD', feature) },
        { key: 'wms_prtmp_tourist', service: service_wms_softwel, queryLayer: 'prtmp_01:tourist_attraction', displayName: 'Tourist Attraction', formatFn: (feature) => formatFeatureInfo('TOURIST', feature) },
        { key: 'wms_prtmp_customs', service: service_wms_softwel, queryLayer: 'prtmp_01:trade_transit', displayName: 'Customs Office', formatFn: (feature) => formatFeatureInfo('CUSTOMS', feature) },
        { key: 'wms_PL2023', service: service_wms_PL2023, queryLayer: 'ssrn:ssrn_pavementstatus', displayName: 'SSRN Highway 2023', formatFn: (feature) => formatFeatureInfo('SSRN', feature) },
        { key: 'wms_PRTMP_NH', service: service_wms_softwel, queryLayer: 'prtmp_01:road_network', displayName: 'NH 2023 (BSM/PRTMP)', formatFn: (feature) => formatFeatureInfo('BSM', feature), cqlFilter: "road_class='NH'" },
        { key: 'wms_PRTMP_PH', service: service_wms_softwel, queryLayer: 'prtmp_01:road_network', displayName: 'PH 2023 (BSM/PRTMP)', formatFn: (feature) => formatFeatureInfo('BSM', feature), cqlFilter: "road_class='PH'" },
        { key: 'wms_PRTMP_PR', service: service_wms_softwel, queryLayer: 'prtmp_01:road_network', displayName: 'PR 2023 (BSM/PRTMP)', formatFn: (feature) => formatFeatureInfo('BSM', feature), cqlFilter: "road_class='PR'" },
        {
          key: 'wms_BSM_Bridge',
          service: service_wms_softwel,
          queryLayer: 'bsm:bsm_nc_primary_detail,bsm:nc_primary_detail_code,bsm:bsm_bi_primary_detail',
          displayName: 'Bridges (BSM)',
          formatFn: (feature) => formatFeatureInfo('BRIDGE', feature),
        },
        {
          key: 'wms_prtmp_bridge',
          service: service_wms_softwel,
          queryLayer: 'prtmp_01:bridge_inventory_local,prtmp_01:local_bridge,prtmp_01:major_bridge',
          displayName: 'Bridges (PRTMP)',
          formatFn: (feature) => formatFeatureInfo('BRIDGE', feature),
        },
        {
          key: 'wms_DhangadhiMetricHNS_mun_road',
          service: service_wms_softwel,
          queryLayer: 'MetricHNS:mun_road,MetricHNS:mun_road_noname',
          displayName: 'Dhangadhi Mun Road',
          formatFn: (feature) => formatFeatureInfo('MUN_ROAD', feature),
        },
        {
          key: 'wms_GhodaghodiMetricHNS_mun_road',
          service: service_wms_softwel,
          queryLayer: 'MetricHNS:mun_road,MetricHNS:mun_road_noname',
          displayName: 'Ghodaghodi Mun Road',
          formatFn: (feature) => formatFeatureInfo('MUN_ROAD', feature),
        },
        {
          key: 'wms_NepalgunjMetricHNS_mun_road',
          service: service_wms_softwel,
          queryLayer: 'MetricHNS:mun_road,MetricHNS:mun_road_noname',
          displayName: 'Nepalgunj Mun Road',
          formatFn: (feature) => formatFeatureInfo('MUN_ROAD', feature),
        },
        {
          key: 'wms_DhangadhiMetricHNS_HNS',
          service: service_wms_softwel,
          queryLayer: 'MetricHNS:hh',
          displayName: 'Dhangadhi Metric HNS',
          formatFn: (feature) => formatFeatureInfo('METRIC_HNS', feature),
        },
        {
          key: 'wms_GhodaghodiMetricHNS_HNS',
          service: service_wms_softwel,
          queryLayer: 'MetricHNS:hh',
          displayName: 'Ghodaghodi Metric HNS',
          formatFn: (feature) => formatFeatureInfo('METRIC_HNS', feature),
        },
        {
          key: 'wms_NepalgunjMetricHNS_HNS',
          service: service_wms_softwel,
          queryLayer: 'MetricHNS:hh',
          displayName: 'Nepalgunj Metric HNS',
          formatFn: (feature) => formatFeatureInfo('METRIC_HNS', feature),
        },
      ];
      const visible = [];
      for (const s of supported) {
        const toggler = WMSLayerTogglers[s.key];
        if (!toggler) {
          continue;
        }
        const layer = toggler.layerArray && toggler.layerArray[0] && toggler.layerArray[0].layer;
        if (layer && layer.getVisibility()) {
          visible.push({ layer, service: s.service, queryLayer: s.queryLayer, formatFn: s.formatFn, key: s.key, displayName: s.displayName, cqlFilter: s.cqlFilter });
        }
      }
      return visible;
    }

    // Helper: build GetFeatureInfo URL for any supported WMS layer
    function buildGetFeatureInfoUrl(service, queryLayer, evt, cqlFilter = null) {
      const wmsUrl = service.url;
      // getMapExtent() returns [west, south, east, north] in WGS84 degrees
      const extent = wmeSDK.Map.getMapExtent();
      // Convert WGS84 degrees → EPSG:3857 (Web Mercator) meters
      const toMercX = (lon) => lon * 20037508.34 / 180;
      const toMercY = (lat) => Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 6378137;
      const bboxLeft = toMercX(extent[0]);
      const bboxRight = toMercX(extent[2]);
      const bboxBottom = toMercY(extent[1]);
      const bboxTop = toMercY(extent[3]);
      const mapEl = wmeSDK.Map.getMapViewportElement();
      const width = mapEl.offsetWidth;
      const height = mapEl.offsetHeight;
      // Derive I/J from geographic click position relative to BBOX (avoids pixel coord system mismatch)
      const clickMercX = toMercX(evt.lon);
      const clickMercY = toMercY(evt.lat);
      const x = Math.round((clickMercX - bboxLeft) / (bboxRight - bboxLeft) * width);
      const y = Math.round((bboxTop - clickMercY) / (bboxTop - bboxBottom) * height);

      // Handle CQL filters - priority: parameter > service URL
      let cql = '';
      if (cqlFilter) {
        cql = 'CQL_FILTER=' + encodeURIComponent(cqlFilter);
        console.log('[WMS DEBUG] Using layer-specific CQL filter for GetFeatureInfo:', cqlFilter);
      } else if (wmsUrl.includes('CQL_FILTER=')) {
        const match = wmsUrl.match(/CQL_FILTER=([^&]*)/);
        if (match) {
          cql = 'CQL_FILTER=' + match[1];
          console.log('[WMS DEBUG] Using service URL CQL filter for GetFeatureInfo:', decodeURIComponent(match[1]));
        }
      }

      // Determine CRS: use map.projection or fallback to EPSG:3857
      let crs = 'EPSG:3857';
      if (map.projection && (map.projection === 'EPSG:4326' || map.projection === 'EPSG:3857')) {
        crs = map.projection;
      }
      // Optionally add FEATURE_COUNT if present in service config
      let featureCount = '';
      if (service.featureCount) {
        featureCount = 'FEATURE_COUNT=' + service.featureCount;
      }
      const params = [
        'SERVICE=WMS',
        'VERSION=1.3.0',
        'REQUEST=GetFeatureInfo',
        'FORMAT=image/png',
        'TRANSPARENT=true',
        'QUERY_LAYERS=' + encodeURIComponent(queryLayer),
        'LAYERS=' + encodeURIComponent(queryLayer),
        'INFO_FORMAT=application/json',
        cql,
        'STYLES=',
        'TILED=true',
        'buffer=10',
        'CRS=' + crs,
        'WIDTH=' + width,
        'HEIGHT=' + height,
        'BBOX=' + bboxLeft + ',' + bboxBottom + ',' + bboxRight + ',' + bboxTop,
        'I=' + x,
        'J=' + y,
        featureCount,
      ].filter(Boolean);

      const finalUrl = wmsUrl.split('?')[0] + '?' + params.join('&');
      if (cqlFilter) {
        console.log('[WMS DEBUG] GetFeatureInfo URL with CQL filter:', finalUrl);
      }
      return finalUrl;
    }

    // Helper: place a popup so it always stays fully inside the visible viewport.
    // Popups use position:fixed, so their left/top are the same screen pixels
    // that wmeSDK.Map.getPixelFromLonLat() returns - no page overflow possible.
    function positionPopupInViewport(popup, lonLat, offsetX) {
      const MARGIN = 8;
      // A tall popup scrolls internally instead of growing past the viewport.
      popup.style.maxHeight = Math.max(120, window.innerHeight - MARGIN * 2) + 'px';
      popup.style.overflowY = 'auto';
      // Make it measurable without showing a jump.
      popup.style.display = 'block';
      popup.style.visibility = 'hidden';

      const px = wmeSDK.Map.getPixelFromLonLat({ lonLat: { lon: lonLat.lon, lat: lonLat.lat } });
      const width = popup.offsetWidth;
      const height = popup.offsetHeight;
      const maxLeft = Math.max(MARGIN, window.innerWidth - width - MARGIN);
      const maxTop = Math.max(MARGIN, window.innerHeight - height - MARGIN);

      // Preferred spot: offset to the right of the click, slightly above it.
      let left = px.x + offsetX;
      let top = px.y - 10;

      // Not enough room on the right -> flip to the left of the click.
      if (left + width + MARGIN > window.innerWidth) {
        left = px.x - width - 10;
      }
      // Not enough room below -> flip above the click, when that fits.
      if (top + height + MARGIN > window.innerHeight) {
        const above = px.y - height - 10;
        if (above >= MARGIN) top = above;
      }

      // Final clamp keeps the popup inside the viewport in every direction.
      popup.style.left = Math.min(Math.max(left, MARGIN), maxLeft) + 'px';
      popup.style.top = Math.min(Math.max(top, MARGIN), maxTop) + 'px';
      popup.style.visibility = 'visible';
    }

    // Helper: show popup at pixel position with content (custom HTML popup)
    function showWMSPopupAtPixel(lonLat, html) {
      let popup = document.getElementById('wms-info-popup');
      if (!popup) {
        popup = document.createElement('div');
        popup.id = 'wms-info-popup';
        popup.style.position = 'fixed';
        popup.style.zIndex = 9999;
        // WME CSS variables keep the popup readable in both light and dark themes.
        popup.style.background = 'var(--background_default, #fff)';
        popup.style.color = 'var(--content_default, #333)';
        popup.style.border = '2px solid var(--hairline, #999)';
        popup.style.borderRadius = '8px';
        popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        popup.style.padding = '10px 14px 10px 10px';
        popup.style.minWidth = '220px';
        popup.style.maxWidth = '350px';
        popup.style.pointerEvents = 'auto';
        popup.style.fontSize = '11px';
        popup.style.fontFamily = 'inherit';
        popup.style.display = 'block';
        popup.innerHTML = '';
        document.body.appendChild(popup);
      }
      // Add close button and table styling
      popup.innerHTML = `
        <a href="#" id="wms-info-popup-close" style="position:absolute;top:4px;right:8px;font-size:16px;text-decoration:none;color:#888;">&times;</a>
        <style>
          #wms-info-popup table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 11px; }
          #wms-info-popup th, #wms-info-popup td { border: 1px solid var(--hairline, #ccc); padding: 2px 6px; text-align: left; font-size: 11px; }
          #wms-info-popup th { background: rgba(128, 128, 128, 0.18); font-weight: bold; font-size: 11px; }
          #wms-info-popup tr.alert-success th { background: rgba(40, 167, 69, 0.25); text-align: center; font-size: 11px; }
        </style>
        ${html}
      `;
      // Keep the popup fully inside the visible viewport, clamped on all sides.
      positionPopupInViewport(popup, lonLat, 10);
      // Close handler
      document.getElementById('wms-info-popup-close').onclick = function (e) {
        e.preventDefault();
        popup.style.display = 'none';
      };
    }

    // Helper: show popup at pixel position with content (custom HTML popup), unique per layer
    function showWMSPopupAtPixelForLayer(lonLat, html, layerKey) {
      let popupId = 'wms-info-popup-' + layerKey;
      let popup = document.getElementById(popupId);
      if (!popup) {
        popup = document.createElement('div');
        popup.id = popupId;
        popup.style.position = 'fixed';
        popup.style.zIndex = 9999;
        // WME CSS variables keep the popup readable in both light and dark themes.
        popup.style.background = 'var(--background_default, #fff)';
        popup.style.color = 'var(--content_default, #333)';
        popup.style.border = '2px solid var(--hairline, #999)';
        popup.style.borderRadius = '8px';
        popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        popup.style.padding = '10px 14px 10px 10px';
        popup.style.minWidth = '220px';
        popup.style.maxWidth = '350px';
        popup.style.pointerEvents = 'auto';
        popup.style.fontSize = '11px';
        popup.style.fontFamily = 'inherit';
        popup.style.display = 'block';
        popup.innerHTML = '';
        document.body.appendChild(popup);
      }
      // Add close button and table styling
      popup.innerHTML = `
        <a href="#" id="${popupId}-close" style="position:absolute;top:4px;right:8px;font-size:16px;text-decoration:none;color:#888;">&times;</a>
        <style>
          #${popupId} table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 11px; }
          #${popupId} th, #${popupId} td { border: 1px solid var(--hairline, #ccc); padding: 2px 6px; text-align: left; font-size: 11px; }
          #${popupId} th { background: rgba(128, 128, 128, 0.18); font-weight: bold; font-size: 11px; }
          #${popupId} tr.alert-success th { background: rgba(40, 167, 69, 0.25); text-align: center; font-size: 11px; }
        </style>
        ${html}
      `;
      // Offset each popup horizontally so they don't overlap, then clamp to viewport.
      const offsetX = 10 + 260 * ['wms_PL2023', 'wms_PRTMP_PH', 'wms_PRTMP_PR'].indexOf(layerKey);
      positionPopupInViewport(popup, lonLat, offsetX);
      // Close handler
      document.getElementById(`${popupId}-close`).onclick = function (e) {
        e.preventDefault();
        popup.style.display = 'none';
      };
    }
    // Helper: format feature info for popup based on type
    function formatFeatureInfo(type, feature) {
      // Define field sets and titles for each type
      const configs = {
        SSRN: {
          title: (feature) => feature.layerName || 'Strategic Road Network',
          fields: [
            ['road_code', 'Road Code'],
            ['link_name', 'Link Name'],
            ['road_name', 'Road Name'],
            ['from_ch', 'From chainage'],
            ['to_ch', 'To chainage'],
            ['pave_type', 'Pavement type'],
            ['last_resurface', 'Last Resurface Year'],
            ['pave_width', 'Pave Width'],
            ['dyear', 'Year'],
            ['add_date', 'Added'],
          ],
        },
        BSM: {
          title: (feature) => feature.layerName || 'BSM Province Road Info',
          fields: [
            ['road_code', 'Road Code'],
            ['road_class', 'Road Class'],
            ['road_name', 'Road Name'],
            ['pcode', 'Province'],
            ['start_ch', 'From chainage'],
            ['end_ch', 'To chainage'],
            ['dyear', 'Year'],
            ['add_date', 'Added'],
          ],
        },
        EDUCATION: {
          title: (feature) => feature.layerName || 'Education Facilities',
          fields: [
            ['name', 'School Name'],
            ['loc_bodies', 'Mun Name'],
            ['district', 'District'],
          ],
        },
        HEALTH: {
          title: (feature) => feature.layerName || 'Health Facilities',
          fields: [
            ['hf_name', 'Name'],
            ['category', 'Category'],
            ['loc_bodies', 'Mun Name'],
            ['ward', 'Ward'],
            ['district', 'District'],
            ['province', 'Province'],
          ],
        },
        GEO_HEALTH: {
          title: (feature) => feature.layerName || 'Health Facilities',
          fields: [
            ['health_fac', 'Name'],
            ['Categorise', 'Category'],
            ['status_lev', 'Status Level'],
            ['local_gove', 'Mun Name'],
            ['District', 'District'],
            ['Province', 'Province'],
          ],
        },
        GEO_POLICE: {
          title: (feature) => feature.layerName || 'Police Units',
          fields: [
            ['EngName', 'Name'],
            ['Nepali_Nam', 'Nep Name'],
            ['dis', 'District'],
            ['Provinces', 'Province'],
          ],
        },
        RIVER: {
          title: (feature) => feature.layerName || 'River Features',
          fields: [['riv_name', 'Name']],
        },
        PALIKA: {
          title: (feature) => feature.layerName || 'Palika Centre',
          fields: [
            ['loc_bod', 'Name Eng'],
            ['dist_name', 'District Eng'],
            ['province', 'Province'],
            ['palika_nep', 'Palika NP'],
            ['dist_nep', 'District NP'],
          ],
        },
        WARD: {
          title: (feature) => feature.layerName || 'Ward Centre',
          fields: [
            ['pcode', 'Province'],
            ['loc_name', 'Name'],
            ['type_gn', 'Type'],
            ['ward_no', 'Ward No'],
          ],
        },
        TOURIST: {
          title: (feature) => feature.layerName || 'Tourist Attraction',
          fields: [
            ['pcode', 'Province'],
            ['name', 'Name'],
            ['district', 'District'],
          ],
        },
        CUSTOMS: {
          title: (feature) => feature.layerName || 'Customs Office',
          fields: [
            ['pcode', 'Province'],
            ['name', 'Name'],
            ['district', 'District'],
          ],
        },
        BRIDGE: {
          title: (feature) => feature.layerName || 'Bridge',
          fields: [
            ['pcode', 'Province'],
            [['name', 'bridge_name'], 'Bridge Name'], // Array of fallback field names
            [['bridge_id', 'bridge_no', 'new_bridge_no'], 'Bridge ID'], // Array of fallback field names
            ['bridge_length', 'Bridge Length'],
            [['river', 'river_name'], 'River'], // Array of fallback field names
            ['road', 'Road Name'], // Array of fallback field names
            ['district', 'District'],
            ['updated_date', 'Updated Date'],
          ],
        },
        MUN_ROAD: {
          title: (feature) => feature.layerName || 'Municipality Road',
          fields: [
            ['r_code', 'Road Code'],
            ['r_name', 'Name'],
            ['r_type', 'Road Type'],
            ['r_width', 'Road Width'],
          ],
        },
        METRIC_HNS: {
          title: (feature) => feature.layerName || 'Metric House Numbers',
          fields: [
            ['hh_number', 'House Number'],
            ['road_name', 'Road Name'],
            // ['road_code', 'Road Code'],
            ['ward_no', 'Ward No'],
            ['hh_nameplate_status', 'Number Plate Status'],
            [['lat', 'lon'], 'Coordinates', 'combine'],
            ['sur_date', 'Survey Date'],
            ['hh_link', 'More Info'],
            ['photo1_path', null],
          ],
        },
      };

      const config = configs[type];
      if (!config) return '<div>No info available</div>';

      // Always use user-friendly display name if present
      let layerTitle = feature.layerName; // || (typeof config.title === 'function' ? config.title(feature) : config.title);

      let html = '<table class="link-table"><tbody>';
      html += `<tr class="alert-success text-center"><th colspan="2">${layerTitle}</th></tr>`;
      for (const [key, label, mode] of config.fields) {
        let value = '';
        if (Array.isArray(key)) {
          if (mode === 'combine') {
            // Combine all non-empty values (e.g. lat + lon)
            value = key.map(k => feature.properties[k]).filter(Boolean).join(', ');
          } else {
            // Fallback: use first non-empty value
            for (const fallbackKey of key) {
              if (feature.properties[fallbackKey]) {
                value = feature.properties[fallbackKey];
                break;
              }
            }
          }
        } else {
          // Single field name
          value = feature.properties[key] || '';
        }
        if (label === null) {
          // Render as photo (value is a relative path appended to the base URL)
          if (value) {
            html += `<tr><td colspan="2" style="text-align:center;padding:4px 0;"><img src="https://hncdsg2.softavi.com/uploads/${value}" style="max-width:100%;border-radius:4px;" onerror="this.style.display='none'"></td></tr>`;
          }
        } else {
          html += `<tr><td>${label}: </td><td>${value}</td></tr>`;
        }
      }
      html += '</tbody></table>';
      return '<div id="popup-content">' + html + '</div>';
    }

    // Map click handler
    wmeSDK.Events.on({ eventName: 'wme-map-mouse-click', eventHandler: function (evt) {
      console.log('[WMS] Map clicked at', { viewportX: evt.viewportX, viewportY: evt.viewportY }, { lat: evt.lat, lon: evt.lon });
      const visibleLayers = getAllVisibleWMSLayerInfo();
      if (!visibleLayers.length) {
        console.log('[WMS] No supported WMS layer visible for popup.');
        return;
      }
      let responses = 0;
      let foundFeatures = [];
      let total = visibleLayers.length;
      for (const info of visibleLayers) {
        const url = buildGetFeatureInfoUrl(info.service, info.queryLayer, evt, info.cqlFilter);
        console.log(`[WMS] GetFeatureInfo URL for ${info.key}:`, url);
        GM_xmlhttpRequest({
          method: 'GET',
          url: url,
          headers: { Accept: 'application/json' },
          onload: function (response) {
            responses++;
            try {
              const data = JSON.parse(response.responseText);
              console.log(`[WMS] GetFeatureInfo response for ${info.key}:`, data);
              if (data.features && data.features.length > 0) {
                // For combined layers, deduplicate features by name to avoid showing identical entries
                const uniqueFeatures = [];
                const seenNames = new Set();

                for (let feature of data.features) {
                  // Use the facility name as the deduplication key
                  const facilityName = feature.properties?.name || feature.properties?.hf_name || feature.properties?.riv_name || 'unnamed';

                  if (!seenNames.has(facilityName)) {
                    seenNames.add(facilityName);
                    feature.layerName = info.displayName;
                    uniqueFeatures.push({ info, feature });
                  }
                }

                // Add all unique features to the foundFeatures array
                foundFeatures.push(...uniqueFeatures);
              }
            } catch (e) {
              console.error(`[WMS] Error parsing GetFeatureInfo response for ${info.key}:`, e);
            }
            if (responses === total) {
              if (foundFeatures.length > 0) {
                // Show all found features in one popup at the click location
                let html = foundFeatures.map((f) => f.info.formatFn(f.feature)).join('<hr style="margin:6px 0;">');
                showWMSPopupAtPixel({ lon: evt.lon, lat: evt.lat }, html);
                console.log('[WMS] Popup shown for features:', foundFeatures);
              }
            }
          },
          onerror: function (err) {
            responses++;
            console.error(`[WMS] GetFeatureInfo request failed for ${info.key}:`, err);
            if (responses === total) {
              if (foundFeatures.length > 0) {
                let html = foundFeatures.map((f) => f.info.formatFn(f.feature)).join('<hr style="margin:6px 0;">');
                showWMSPopupAtPixel({ lon: evt.lon, lat: evt.lat }, html);
              }
            }
          },
        });
      }
    }});
    /*end of pop up code*/

    /* ------------------------------------------------------------------
       Street View integration (SDK)
       Replaces the MutationObserver that watched the .street-view-control CSS class.
       The Google StreetView overlay is added while Street View is in use and removed
       when it closes - unless the user enabled that layer themselves from the layer
       switcher, in which case the layer is left fully under their control.
       ------------------------------------------------------------------ */
    var streetViewToggler = WMSLayerTogglers.xyz_google_streetview;
    var GSVlayer = streetViewToggler.layerArray[0].layer;
    var streetViewButtonActive = false; // pegman being dragged / peek mode
    var streetViewPanelVisible = false; // street view pane open
    var streetViewOverlayOn = false;

    function isGSVLayerCheckedByUser() {
      // The Google StreetView layer is owned by the user as soon as its checkbox
      // in the script's sidebar tab is ticked.
      return !!streetViewToggler.tabChecked;
    }

    function setStreetViewOverlay(active) {
      if (isGSVLayerCheckedByUser()) return; // user owns this layer
      var isOnMap = W.map.getLayers().indexOf(GSVlayer) !== -1;
      if (active) {
        if (!isOnMap) W.map.addLayer(GSVlayer);
        GSVlayer.setVisibility(true);
      } else {
        GSVlayer.setVisibility(false);
        // Detach only when the layer is really on the map (see applyLayerTogglerVisibility).
        if (!isOnMap) return;
        try {
          W.map.removeLayer(GSVlayer);
        } catch (e) {
          // The <div> was already detached - the overlay is hidden either way.
        }
      }
    }

    function updateStreetViewOverlay() {
      var active = streetViewButtonActive || streetViewPanelVisible;
      if (active === streetViewOverlayOn) return;
      streetViewOverlayOn = active;
      setStreetViewOverlay(active);
    }

    wmeSDK.Events.on({
      eventName: 'wme-street-view-button-activated',
      eventHandler: function () {
        streetViewButtonActive = true;
        updateStreetViewOverlay();
      },
    });
    wmeSDK.Events.on({
      eventName: 'wme-street-view-button-deactivated',
      eventHandler: function () {
        streetViewButtonActive = false;
        updateStreetViewOverlay();
      },
    });
    wmeSDK.Events.on({
      eventName: 'wme-street-view-panel-visibility-changed',
      eventHandler: function (evt) {
        streetViewPanelVisible = !!(evt && evt.isVisible);
        updateStreetViewOverlay();
      },
    });
    // Pick up a Street View pane that is already open when the script loads.
    try {
      streetViewPanelVisible = wmeSDK.Map.isStreetViewActive();
      updateStreetViewOverlay();
    } catch (e) {
      // SDK not ready - the events above will drive it from here on.
    }

    /* ------------------------------------------------------------------
       WMS layer shift: state + conversion helpers

       The pad moves the REQUESTED BBOX, so the drawn content travels the other way.
       `wmsLayerOffsets` therefore holds bbox offsets in the map's own units, while
       everything saved or configured holds metres of CONTENT movement. The two
       converters below are the only place that sign is written down.
       ------------------------------------------------------------------ */
    var wmsLayerOffsets = {}; // layer name -> { x, y } bbox offset (map projection units)
    var wmsLayerOriginalOffsets = {};
    var wmsLayerPresetOffsets = {}; // layer name -> its built-in default offset

    // Metres per degree at the current map centre - only needed for the (unusual)
    // case of a map that is itself in EPSG:4326.
    function wmsMetersPerDegree() {
      var centerLat = getMapCenterLat();
      return {
        lon: (40075000 * Math.cos((centerLat * Math.PI) / 180)) / 360,
        lat: 111320,
      };
    }

    function wmsMapIs4326() {
      try {
        var proj = W.map.getProjectionObject();
        return !!(proj && proj.projCode === 'EPSG:4326');
      } catch (e) {
        return false;
      }
    }

    // Desired content movement (metres) -> the bbox offset getURL needs.
    function wmsOffsetFromContentMeters(east, north) {
      if (wmsMapIs4326()) {
        var per = wmsMetersPerDegree();
        return { x: -east / per.lon, y: -north / per.lat };
      }
      return { x: -east, y: -north };
    }

    // The inverse, used for saving and for describing an offset to the user.
    function wmsContentMetersFromOffset(offset) {
      if (!offset) return { east: 0, north: 0 };
      if (wmsMapIs4326()) {
        var per = wmsMetersPerDegree();
        return { east: -offset.x * per.lon, north: -offset.y * per.lat };
      }
      return { east: -offset.x, north: -offset.y };
    }

    function wmsSameOffset(a, b) {
      return !!a && !!b && a.x === b.x && a.y === b.y;
    }

    // Human-readable form of an offset, e.g. "260 m W, 20 m N" (or "none").
    function describeWmsOffset(offset) {
      var meters = wmsContentMetersFromOffset(offset);
      var east = Math.round(meters.east);
      var north = Math.round(meters.north);
      var parts = [];
      if (east) parts.push(Math.abs(east) + ' m ' + (east > 0 ? 'E' : 'W'));
      if (north) parts.push(Math.abs(north) + ' m ' + (north > 0 ? 'N' : 'S'));
      return parts.length ? parts.join(', ') : 'none';
    }

    // Apply a shift to a layer and arm its getURL patch, so the correction is already
    // active when the layer is switched on and requests its first tile.
    function setWmsLayerOffset(layer, offset) {
      if (!layer) return;
      patchWMSLayerGetURL(layer);
      wmsLayerOffsets[layer.name] = { x: offset.x, y: offset.y };
    }

    // Reads a preset written in map terms: { west: 260, north: 20 } means the content
    // has to move 260 m west and 20 m north. east/south work as well, negatives too.
    function presetContentMeters(preset) {
      return {
        east: (preset.east || 0) - (preset.west || 0),
        north: (preset.north || 0) - (preset.south || 0),
      };
    }

    // Remember the total shift of a layer, converted to metres so the stored value is
    // independent of the map projection.
    function rememberWmsLayerOffset(layerName) {
      var meters = wmsContentMetersFromOffset(wmsLayerOffsets[layerName]);
      var stored = loadStoredLayerOffsets();
      stored[layerName] = { east: meters.east, north: meters.north };
      saveStoredLayerOffsets(stored);
    }

    // "Applied shift: 260 m W, 20 m N (built-in default)" next to the shift pad.
    function refreshWmsShiftStatus() {
      var el = document.getElementById('WMSShiftStatus');
      if (!el) return;
      var select = document.getElementById('WMSLayersSelect');
      var name = select ? select.value : '';
      if (!name || name === 'undefined') {
        el.textContent = '';
        return;
      }
      var offset = wmsLayerOffsets[name];
      var isZero = !offset || (!offset.x && !offset.y);
      var suffix = isZero ? '' : wmsSameOffset(wmsLayerPresetOffsets[name], offset) ? ' (built-in default)' : ' (remembered)';
      el.textContent = 'Applied shift: ' + describeWmsOffset(offset) + suffix;
    }

    // Every WMS layer of the script, by OL2 layer name (a toggler can hold several).
    function allWmsLayersByName() {
      var byName = {};
      for (var key in WMSLayerTogglers) {
        WMSLayerTogglers[key].layerArray.forEach(function (item) {
          if (item.layer && typeof item.serviceType === 'string' && item.serviceType.indexOf('WMS') === 0) {
            byName[item.layer.name] = item.layer;
          }
        });
      }
      return byName;
    }

    // Built-in defaults first, then the shifts the user nudged into place earlier,
    // which take precedence over them.
    function applyStoredAndPresetShifts() {
      var layersByName = allWmsLayersByName();

      Object.keys(WMS_LAYER_SHIFT_PRESETS).forEach(function (key) {
        var toggler = WMSLayerTogglers[key];
        if (!toggler) {
          console.warn(scriptName + ': shift preset for unknown layer "' + key + '" ignored.');
          return;
        }
        var meters = presetContentMeters(WMS_LAYER_SHIFT_PRESETS[key]);
        var offset = wmsOffsetFromContentMeters(meters.east, meters.north);
        toggler.layerArray.forEach(function (item) {
          if (!item.layer || typeof item.serviceType !== 'string' || item.serviceType.indexOf('WMS') !== 0) return;
          setWmsLayerOffset(item.layer, offset);
          wmsLayerPresetOffsets[item.layer.name] = offset;
        });
        console.log(scriptName + ': default shift for "' + key + '": ' + describeWmsOffset(offset));
      });

      var stored = loadStoredLayerOffsets();
      Object.keys(stored).forEach(function (layerName) {
        var layer = layersByName[layerName];
        var meters = stored[layerName];
        if (!layer || !meters || typeof meters.east !== 'number' || typeof meters.north !== 'number') return;
        setWmsLayerOffset(layer, wmsOffsetFromContentMeters(meters.east, meters.north));
      });
    }

    // Corrections are applied before any layer can be switched on: the initial
    // syncAllTogglerVisibility, the master checkbox and every shortcut only toggle
    // visibility, so a corrected layer is already right when its first tile is drawn.
    applyStoredAndPresetShifts();

    const { tabLabel, tabPane } = await wmeSDK.Sidebar.registerScriptTab();
    tabLabel.innerText = 'WMS-NP';
    tabLabel.title = 'Nepali WMS Layers';
    tabLabel.id = 'sidepanel-wms';

    injectWmsPanelStyles();

    // The whole tab is a single panel: gradient header -> one card per layer group
    // (opacity slider + checkbox per layer) -> layer tools -> GeoJSON tools.
    var panel = npwCreate('div', 'npw-panel');
    panel.id = 'nepali-wms-panel';

    var panelHeader = npwCreate('div', 'npw-header');
    var panelTitle = npwCreate('a', 'npw-title', GM_info.script.name);
    panelTitle.href = 'https://greasyfork.org/en/scripts/521924';
    panelTitle.target = '_blank';
    panelTitle.title = 'Open the script page on GreasyFork';
    panelHeader.appendChild(panelTitle);
    panelHeader.appendChild(npwCreate('span', 'npw-version', 'v' + GM_info.script.version));
    panel.appendChild(panelHeader);
    tabPane.appendChild(panel);

    // One card per layer group, with the per-layer checkboxes.
    buildLayerCategoryPanels(panel);
    // Now that the checkboxes exist, push the stored state onto the OL2 layers.
    syncAllTogglerVisibility();

    // --- Layer tools: pick a layer for shifting / per-layer opacity ---
    var section = npwCard(panel, 'Layer tools');
    section.id = 'WMS';
    section.appendChild(npwCreate('span', 'npw-small-label', 'WMS layer (shift + opacity):'));
    var WMSSelect = document.createElement('select');
    WMSSelect.id = 'WMSLayersSelect';
    WMSSelect.className = 'npw-select';
    section.appendChild(WMSSelect);
    var opacityRange = document.createElement('input');
    var opacityLabel = document.createElement('label');
    opacityRange.type = 'range';
    opacityRange.min = 0;
    opacityRange.max = 100;
    opacityRange.value = 100;
    opacityRange.className = 'npw-opacity-slider';
    opacityRange.id = 'WMSOpacity';
    opacityLabel.textContent = 'Layer transparency: ' + opacityRange.value + ' %';
    opacityLabel.className = 'npw-small-label';
    opacityLabel.id = 'WMSOpacityLabel';
    opacityLabel.htmlFor = opacityRange.id;
    section.appendChild(opacityLabel);
    section.appendChild(opacityRange);

    // Shift controls (3x3 pad)
    var shiftContainer = document.createElement('div');
    shiftContainer.style.marginTop = '8px';
    shiftContainer.appendChild(npwCreate('span', 'npw-small-label', 'Shift distance (meters):'));
    var distanceInput = document.createElement('input');
    distanceInput.type = 'number';
    distanceInput.value = 1;
    distanceInput.min = 1;
    distanceInput.className = 'npw-input';
    distanceInput.id = 'WMSShiftDistance';
    shiftContainer.appendChild(distanceInput);
    npwBuildShiftPad(
      shiftContainer,
      function (direction) {
        shiftLayer(direction);
      },
      function () {
        resetWMSLayerShift();
      }
    );
    section.appendChild(shiftContainer);

    // Shows the shift currently applied to the selected layer, including a built-in
    // default - feedback that an inaccurate service is already corrected on load.
    var wmsShiftStatus = npwCreate('div', 'npw-status', '');
    wmsShiftStatus.id = 'WMSShiftStatus';
    section.appendChild(wmsShiftStatus);

    // Helper: patch getURL to apply offset
    function patchWMSLayerGetURL(layer) {
      if (!layer || layer._wmsShiftPatched) return;
      const origGetURL = layer.getURL;
      layer._wmsShiftPatched = true;
      layer.getURL = function (bounds) {
        const offset = wmsLayerOffsets?.[layer.name] ?? { x: 0, y: 0 };
        const newBounds = bounds.clone();
        newBounds.right += offset.x;
        newBounds.left += offset.x;
        newBounds.top += offset.y;
        newBounds.bottom += offset.y;
        return origGetURL.call(this, newBounds);
      };
    }

    // Helper to shift layer (now accepts dx, dy)
    function shiftLayer(direction, customDx, customDy) {
      var value = document.getElementById('WMSLayersSelect').value;
      var dist = parseFloat(document.getElementById('WMSShiftDistance').value) || 0;
      if (!value || value === 'undefined' || dist === 0) return;
      var layer = W.map.getLayers().find(l => l.name === value) || null;
      if (!layer) return;
      patchWMSLayerGetURL(layer);
      var map = W.map;
      var proj = map.getProjectionObject();
      var dx = 0,
        dy = 0;
      var diag = dist * 0.7071; // sqrt(2)/2 for diagonal
      if (typeof customDx === 'number' && typeof customDy === 'number') {
        dx = customDx;
        dy = customDy;
      } else if (proj && proj.projCode === 'EPSG:4326') {
        var centerLat = getMapCenterLat();
        var metersPerDegreeLat = 111320;
        var metersPerDegreeLon = (40075000 * Math.cos((centerLat * Math.PI) / 180)) / 360;
        switch (direction) {
          case 'up':
            dy = -dist / metersPerDegreeLat;
            break;
          case 'down':
            dy = dist / metersPerDegreeLat;
            break;
          case 'left':
            dx = dist / metersPerDegreeLon;
            break;
          case 'right':
            dx = -dist / metersPerDegreeLon;
            break;
          case 'upleft':
            dx = diag / metersPerDegreeLon;
            dy = -diag / metersPerDegreeLat;
            break;
          case 'upright':
            dx = -diag / metersPerDegreeLon;
            dy = -diag / metersPerDegreeLat;
            break;
          case 'downleft':
            dx = diag / metersPerDegreeLon;
            dy = diag / metersPerDegreeLat;
            break;
          case 'downright':
            dx = -diag / metersPerDegreeLon;
            dy = diag / metersPerDegreeLat;
            break;
        }
      } else {
        switch (direction) {
          case 'up':
            dy = -dist;
            break;
          case 'down':
            dy = dist;
            break;
          case 'left':
            dx = dist;
            break;
          case 'right':
            dx = -dist;
            break;
          case 'upleft':
            dx = diag;
            dy = -diag;
            break;
          case 'upright':
            dx = -diag;
            dy = -diag;
            break;
          case 'downleft':
            dx = diag;
            dy = diag;
            break;
          case 'downright':
            dx = -diag;
            dy = diag;
            break;
        }
      }
      if (!wmsLayerOffsets[layer.name]) wmsLayerOffsets[layer.name] = { x: 0, y: 0 };
      wmsLayerOffsets[layer.name].x += dx;
      wmsLayerOffsets[layer.name].y += dy;
      // Store original offset if not already stored
      if (!wmsLayerOriginalOffsets[layer.name]) {
        wmsLayerOriginalOffsets[layer.name] = { x: 0, y: 0 };
      }
      // Remember the total shift of this layer, so the next page load starts from the
      // corrected position instead of having to be nudged there again.
      rememberWmsLayerOffset(layer.name);
      refreshWmsShiftStatus();
      // Show WazeToastr alert
      WazeToastr.Alerts.info('Layer Shifted', `Layer shifted to ${dist} metres ${direction}. Please wait for fully load.`, false, false, 2000);
      layer.redraw();
    }
    // Reset the shift of the layer selected above.
    function resetWMSLayerShift() {
      var value = document.getElementById('WMSLayersSelect').value;
      if (!value || value === 'undefined') return;
      var layer = W.map.getLayers().find(l => l.name === value) || null;
      if (!layer) return;
      patchWMSLayerGetURL(layer);
      // Back to the layer's built-in default (its published position when it has none).
      var preset = wmsLayerPresetOffsets[layer.name];
      wmsLayerOffsets[layer.name] = preset ? { x: preset.x, y: preset.y } : { x: 0, y: 0 };
      var stored = loadStoredLayerOffsets();
      delete stored[layer.name];
      saveStoredLayerOffsets(stored);
      refreshWmsShiftStatus();
      layer.redraw();
      // Show WazeToastr alert on reset
      var resetMessage = preset
        ? 'Layer shift reset to the built-in default (' + describeWmsOffset(preset) + ').'
        : 'Layer shift has been reset to default.';
      WazeToastr.Alerts.info('Layer Reset', resetMessage, false, false, 2000);
    }


    // --- GeoJSON URL Loading Section ---
    var geoJsonSection = npwCard(panel, 'Load GeoJSON from URL');
    geoJsonSection.id = 'GeoJSONURLSection';

    // Font styling controls
    var fontStyleContainer = document.createElement('div');
    fontStyleContainer.style.display = 'flex';
    fontStyleContainer.style.gap = '10px';
    fontStyleContainer.style.marginBottom = '10px';

    // Font color picker
    var fontColorContainer = document.createElement('div');
    fontColorContainer.style.flex = '1';
    var fontColorLabel = document.createElement('label');
    fontColorLabel.textContent = 'Label Color:';
    fontColorLabel.className = 'npw-small-label';
    var fontColorInput = document.createElement('input');
    fontColorInput.type = 'color';
    fontColorInput.id = 'geoJsonFontColor';
    fontColorInput.value = '#ffffff';
    fontColorInput.className = 'npw-input';
    fontColorInput.style.height = '30px';
    fontColorInput.style.cursor = 'pointer';
    fontColorContainer.appendChild(fontColorLabel);
    fontColorContainer.appendChild(fontColorInput);

    // Font size input
    var fontSizeContainer = document.createElement('div');
    fontSizeContainer.style.flex = '1';
    var fontSizeLabel = document.createElement('label');
    fontSizeLabel.textContent = 'Label Size (px):';
    fontSizeLabel.className = 'npw-small-label';
    var fontSizeInput = document.createElement('input');
    fontSizeInput.type = 'number';
    fontSizeInput.id = 'geoJsonFontSize';
    fontSizeInput.value = '13';
    fontSizeInput.min = '8';
    fontSizeInput.max = '24';
    fontSizeInput.className = 'npw-input';
    fontSizeContainer.appendChild(fontSizeLabel);
    fontSizeContainer.appendChild(fontSizeInput);

    // The label colour/size are read by the SDK styleContext getters, so changing
    // them re-renders the already loaded building layers (no reload needed).
    fontColorInput.addEventListener('input', function () {
      applyGeoJsonLabelStyle(fontColorInput.value, null);
    });
    fontSizeInput.addEventListener('change', function () {
      applyGeoJsonLabelStyle(null, fontSizeInput.value);
    });

    fontStyleContainer.appendChild(fontColorContainer);
    fontStyleContainer.appendChild(fontSizeContainer);
    geoJsonSection.appendChild(fontStyleContainer);

    // Ward selector
    var wardLabel = document.createElement('label');
    wardLabel.textContent = 'Select Ward Number:';
    wardLabel.className = 'npw-small-label';
    geoJsonSection.appendChild(wardLabel);

    var wardSelect = document.createElement('select');
    wardSelect.id = 'geoJsonWardSelect';
    wardSelect.className = 'npw-select';

    // Add ward options 1-29
    for (let i = 1; i <= 29; i++) {
      let option = document.createElement('option');
      option.value = i;
      option.textContent = `Ward ${i}`;
      wardSelect.appendChild(option);
    }
    geoJsonSection.appendChild(wardSelect);

    // Load + Clear side by side - WME GeoFile's button-row pattern. A future provider
    // (Django, ...) only has to append another npwButton() to this row.
    var geoJsonBtnRow = npwButtonRow(geoJsonSection);
    npwButton(geoJsonBtnRow, 'Load Buildings', 'Load building data from geonep.com.np', 'primary').addEventListener('click', loadGeoJSONFromURL);
    npwButton(geoJsonBtnRow, 'Clear Buildings', 'Remove all loaded building layers', 'danger').addEventListener('click', clearLoadedGeoJSON);

    // Status display
    var geoJsonStatus = document.createElement('div');
    geoJsonStatus.id = 'geoJsonStatus';
    geoJsonStatus.className = 'npw-status';
    geoJsonSection.appendChild(geoJsonStatus);

    // --- GeoJSON Layer Shift Controls ---
    var geoJsonShiftContainer = document.createElement('div');
    geoJsonShiftContainer.style.marginTop = '12px';
    geoJsonShiftContainer.appendChild(npwCreate('div', 'npw-card-title', 'GeoJSON layer shift controls'));

    // Layer selector for shift
    var geoJsonLayerSelectLabel = document.createElement('label');
    geoJsonLayerSelectLabel.textContent = 'Select Layer:';
    geoJsonLayerSelectLabel.className = 'npw-small-label';
    geoJsonShiftContainer.appendChild(geoJsonLayerSelectLabel);

    var geoJsonLayerSelect = document.createElement('select');
    geoJsonLayerSelect.id = 'geoJsonLayerSelect';
    geoJsonLayerSelect.className = 'npw-select';
    var defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a loaded layer --';
    geoJsonLayerSelect.appendChild(defaultOption);
    geoJsonShiftContainer.appendChild(geoJsonLayerSelect);

    // Shift distance input
    var geoJsonShiftDistLabel = document.createElement('label');
    geoJsonShiftDistLabel.textContent = 'Shift Distance (meters):';
    geoJsonShiftDistLabel.className = 'npw-small-label';
    geoJsonShiftContainer.appendChild(geoJsonShiftDistLabel);

    var geoJsonShiftDistInput = document.createElement('input');
    geoJsonShiftDistInput.type = 'number';
    geoJsonShiftDistInput.id = 'geoJsonShiftDistance';
    geoJsonShiftDistInput.value = '1'; // default 1 meter shift in direction of arrow clicked
    geoJsonShiftDistInput.min = '0';
    geoJsonShiftDistInput.step = '1';
    geoJsonShiftDistInput.className = 'npw-input';
    geoJsonShiftContainer.appendChild(geoJsonShiftDistInput);

    // Direction pad for GeoJSON
    npwBuildShiftPad(
      geoJsonShiftContainer,
      function (direction) {
        shiftGeoJsonLayer(direction);
      },
      function () {
        resetGeoJsonShift();
      }
    );

    geoJsonSection.appendChild(geoJsonShiftContainer);

    fillWMSLayersSelectList();
    refreshWmsShiftStatus();
    opacityRange.addEventListener('input', function () {
      var value = document.getElementById('WMSLayersSelect').value;
      if (value !== '' && value !== 'undefined') {
        var layer = W.map.getLayers().find(l => l.name === value) || null;
        if (!layer) return;
        layer.setOpacity(opacityRange.value / 100);
        document.getElementById('WMSOpacityLabel').textContent = 'Layer transparency: ' + document.getElementById('WMSOpacity').value + ' %';
      }
    });
    WMSSelect.addEventListener('change', function () {
      var selectedLayer = W.map.getLayers().filter((layer) => layer.name == WMSSelect.value)[0];
      if (selectedLayer) {
        opacityRange.value = selectedLayer.opacity * 100;
        document.getElementById('WMSOpacityLabel').textContent = 'Layer transparency: ' + document.getElementById('WMSOpacity').value + ' %';
      }
      refreshWmsShiftStatus();
    });
    setZOrdering(WMSLayerTogglers);
    wmeSDK.Events.on({
      eventName: 'wme-map-layer-added',
      eventHandler: function () {
        fillWMSLayersSelectList();
        refreshWmsShiftStatus();
      },
    });
    wmeSDK.Events.on({
      eventName: 'wme-map-layer-removed',
      eventHandler: function () {
        fillWMSLayersSelectList();
        refreshWmsShiftStatus();
      },
    });
    wmeSDK.Events.on({ eventName: 'wme-map-layer-added', eventHandler: () => setZOrdering(WMSLayerTogglers) });
    wmeSDK.Events.on({ eventName: 'wme-map-layer-removed', eventHandler: () => setZOrdering(WMSLayerTogglers) });
    wmeSDK.Events.on({ eventName: 'wme-map-move-end', eventHandler: () => setZOrdering(WMSLayerTogglers) });
  }

  function fillWMSLayersSelectList() {
    const select = document.getElementById('WMSLayersSelect');
    const value = select.value;
    let htmlCode = '';
    W.map.getLayers().filter((layer) => layer.params?.SERVICE === 'WMS').forEach((layer) => (htmlCode += `<option value='${layer.name}'>${layer.name}</option><br>`));
    select.innerHTML = htmlCode;
    select.value = value;
  }

  /* ------------------------------------------------------------------
     HTTP-only WMS support (mixed-content workaround)
     Some Nepali WMS servers (e.g. gis.dmgnepal.gov.np:8080) are only
     reachable over plain HTTP. WME runs on HTTPS, so the browser blocks
     those tile <img> requests as mixed content and the layer stays empty.
     Such tiles are fetched with GM_xmlhttpRequest (privileged, exempt from
     mixed-content rules) and handed to OpenLayers as blob: URLs instead
     (WME's CSP allows blob: for images).
     ------------------------------------------------------------------ */
  var HTTP_TILE_CACHE_LIMIT = 400;
  var TRANSPARENT_TILE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  var httpTileBlobCache = {}; // tile URL -> blob URL
  var httpTileCacheOrder = []; // FIFO order, used for cache eviction
  var httpTilePendingCallbacks = {}; // tile URL -> pending callbacks (request de-duplication)
  var httpTileProxyPatchInstalled = false;

  function isHttpUrl(url) {
    return typeof url === 'string' && url.slice(0, 7).toLowerCase() === 'http://';
  }

  function cacheHttpTileBlob(url, blobUrl) {
    if (httpTileBlobCache[url]) return;
    httpTileBlobCache[url] = blobUrl;
    httpTileCacheOrder.push(url);
    while (httpTileCacheOrder.length > HTTP_TILE_CACHE_LIMIT) {
      var expiredUrl = httpTileCacheOrder.shift();
      var expiredBlobUrl = httpTileBlobCache[expiredUrl];
      delete httpTileBlobCache[expiredUrl];
      // Revoking only prevents *new* loads of that URL, already decoded tiles stay visible.
      if (expiredBlobUrl) {
        try {
          URL.revokeObjectURL(expiredBlobUrl);
        } catch (e) {}
      }
    }
  }

  function fetchHttpTile(url, callback) {
    if (httpTileBlobCache[url]) {
      callback(httpTileBlobCache[url], null);
      return;
    }
    if (httpTilePendingCallbacks[url]) {
      httpTilePendingCallbacks[url].push(callback);
      return;
    }
    httpTilePendingCallbacks[url] = [callback];

    function settle(blobUrl, error) {
      var callbacks = httpTilePendingCallbacks[url] || [];
      delete httpTilePendingCallbacks[url];
      if (blobUrl) {
        cacheHttpTileBlob(url, blobUrl);
      }
      callbacks.forEach(function (cb) {
        try {
          cb(blobUrl, error);
        } catch (e) {
          console.error(scriptName + ': tile proxy callback failed for ' + url, e);
        }
      });
    }

    GM_xmlhttpRequest({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: 30000,
      onload: function (response) {
        var data = response.response;
        var isEmpty = !data || (data instanceof ArrayBuffer ? data.byteLength === 0 : data.size === 0);
        if (response.status >= 200 && response.status < 300 && !isEmpty) {
          var blob = data instanceof Blob ? data : new Blob([data], { type: 'image/png' });
          settle(URL.createObjectURL(blob), null);
        } else {
          settle(null, new Error('HTTP ' + response.status));
        }
      },
      onerror: function () {
        settle(null, new Error('network error'));
      },
      ontimeout: function () {
        settle(null, new Error('request timeout'));
      },
    });
  }

  // Safety net: intercept the last step before OpenLayers assigns an image src.
  // Only layers flagged with _httpTileProxy are touched.
  function patchTileImageSetImgSrc() {
    if (httpTileProxyPatchInstalled) return;
    if (!OL || !OL.Tile || !OL.Tile.Image || !OL.Tile.Image.prototype) return;
    var originalSetImgSrc = OL.Tile.Image.prototype.setImgSrc;
    if (typeof originalSetImgSrc !== 'function') return;
    httpTileProxyPatchInstalled = true;
    OL.Tile.Image.prototype.setImgSrc = function (url) {
      var layer = this.layer;
      if (!url || !layer || !layer._httpTileProxy || !isHttpUrl(url)) {
        return originalSetImgSrc.apply(this, arguments);
      }
      var self = this;
      var imgDiv = this.imgDiv;
      fetchHttpTile(url, function (blobUrl) {
        // The tile may have been cleared or redrawn while the request was in flight.
        if (!blobUrl || !imgDiv || self.imgDiv !== imgDiv) return;
        originalSetImgSrc.call(self, blobUrl);
      });
    };
  }

  // Route all tile requests of an HTTP-only service through GM_xmlhttpRequest
  function enableHttpTileProxy(layer) {
    if (!layer || layer._httpTileProxy) return;
    layer._httpTileProxy = true;
    // Preferred path: OpenLayers.Tile.Image.renderTile() asks for the tile URL
    // asynchronously when layer.async is set, so blob URLs become the tile URL.
    layer.async = true;
    layer.getURLasync = function (bounds, callback, tile) {
      var url = this.getURL(bounds);
      if (!isHttpUrl(url)) {
        callback.call(tile, url);
        return;
      }
      fetchHttpTile(url, function (blobUrl, error) {
        if (blobUrl) {
          callback.call(tile, blobUrl);
        } else {
          console.warn(scriptName + ': could not fetch WMS tile ' + url + ' (' + (error && error.message) + '), showing empty tile.');
          callback.call(tile, TRANSPARENT_TILE);
        }
      });
    };
    patchTileImageSetImgSrc();
  }

  function addNewLayer(id, service, serviceLayers, zIndex = 0, opacity = 1) {
    var newLayer = {};
    newLayer.serviceType = service.type;
    if ((service.type == 'XYZ') & (zIndex == 0)) {
      newLayer.zIndex = ZIndexes.base;
    } else {
      newLayer.zIndex = zIndex == 0 ? ZIndexes.popup : zIndex;
    }
    switch (service.type) {
      case 'WMS':
        // Debug log for WMS request URL and filter
        if (typeof zIndex === 'string' && zIndex.includes("road_class='")) {
          console.log('[WMS DEBUG] Creating WMS Layer:', id);
          console.log('[WMS DEBUG] Service URL:', service.url);
          console.log('[WMS DEBUG] Layers:', serviceLayers);
          console.log('[WMS DEBUG] Filter:', zIndex);
        }
        newLayer.layer = new OL.Layer.WMS(
          id,
          service.url,
          {
            layers: serviceLayers,
            transparent: 'true',
            format: 'image/png',
            version: service.version || '1.3.0', // Use service.version if provided, else default to 1.3.0 use WMS 1.3.0 + EPSG:3857
            CQL_FILTER: typeof zIndex === 'string' ? zIndex : undefined,
          },
          {
            opacity: opacity,
            tileSize: WMSLayersTechSource.tileSizeG || new OL.Size(256, 256), // Use service-defined tile size if available
            isBaseLayer: false,
            visibility: false,
            transitionEffect: 'resize',
            attribution: service.attribution,
            projection: new OL.Projection('EPSG:3857'), //alternativa defaultní EPSG:900913
          }
        );
        break;
      case 'WMS_4326':
        newLayer.layer = new OL.Layer.WMS(
          id,
          service.url,
          {
            layers: serviceLayers,
            transparent: 'true',
            format: 'image/png',
            version: service.version || '1.1.1', //use WMS 1.1.1 + EPSG:4326
            CQL_FILTER: typeof zIndex === 'string' ? zIndex : undefined,
          },
          {
            opacity: opacity,
            tileSize: WMSLayersTechSource.tileSizeG || new OL.Size(256, 256), // Use service-defined tile size if available
            isBaseLayer: false,
            visibility: false,
            transitionEffect: 'resize',
            attribution: service.attribution,
            epsg4326: new OL.Projection('EPSG:4326'),
            getURL: getUrl4326,
            getFullRequestString: getFullRequestString4326,
          }
        );
        break;
      case 'XYZ':
        newLayer.layer = new OL.Layer.XYZ(id, service.url, {
          sphericalMercator: true,
          isBaseLayer: false,
          visibility: false,
          RESOLUTION_PROPERTIES: {},
          resolutions: WMSLayersTechSource.resolutions,
          serverResolutions: WMSLayersTechSource.resolutions.slice(0, 'maxZoom' in service && service.maxZoom > 0 ? service.maxZoom : 23),
          transitionEffect: 'resize',
          attribution: service.attribution,
        });
        break;
      default:
        newLayer.layer = null;
    }
    if (newLayer.layer) {
      var serviceUrls = Array.isArray(service.url) ? service.url : [service.url];
      if (serviceUrls.some(isHttpUrl)) {
        console.log(scriptName + ': "' + id + '" is served over plain HTTP, enabling tile proxy.');
        enableHttpTileProxy(newLayer.layer);
      }
    }
    return newLayer;
  }
  /*For GeoServer WMS:

WMS 1.1.1 prefers coordinates in EPSG:4326 (longitude, latitude order).
WMS 1.3.0 uses EPSG:4326 (latitude, longitude order) and supports EPSG:3857 (Web Mercator) natively.
Recommendations:

If your client expects (longitude, latitude) order, use WMS 1.1.1 with EPSG:4326.
If your client expects (latitude, longitude) order or uses web maps (Google, OSM), use WMS 1.3.0 with EPSG:3857.
Summary:

For web mapping (slippy maps), use WMS 1.3.0 + EPSG:3857.
For GIS tools or legacy clients, use WMS 1.1.1 + EPSG:4326.*/

  /* ==================================================================
     SIDEBAR UI - pattern and theming borrowed from "Croatian WMS layers"
     (https://greasyfork.org/en/scripts/519676-croatian-wms-layers, author JS55CT).

     Instead of one layer-switcher checkbox per layer, a SINGLE master checkbox
     is registered with wmeSDK.LayerSwitcher and every layer lives in the custom
     sidebar tab, grouped into category cards with a per-category opacity slider
     and one checkbox per layer.

     A layer is visible only when its sidebar checkbox is on AND the master
     checkbox in WME's layer switcher is on.

     The panel is styled through WME's own CSS custom properties
     (--content_default, --background_default, --hairline, --primary,
     --content_p1, --content_p2), so it follows the editor theme (including dark
     mode) instead of hard-coding colours.
     ================================================================== */
  var WMS_MASTER_STORAGE_KEY = '_wme_nepali_wms_master';
  var WMS_CATEGORY_OPACITY_STORAGE_KEY = '_wme_nepali_wms_opacity';
  var WMS_COLLAPSED_STORAGE_KEY = '_wme_nepali_wms_collapsed';
  var WMS_LAYER_OFFSETS_STORAGE_KEY = '_wme_nepali_wms_layer_offsets';
  var masterLayerToggleOn = true;

  // Panel stylesheet. The crimson accent (#DC143C = Nepal crimson) is used for
  // the header gradient and the control accents.
  function injectWmsPanelStyles() {
    if (document.getElementById('npw-panel-styles')) return;
    var style = document.createElement('style');
    style.id = 'npw-panel-styles';
    style.textContent = [
      '.npw-panel { box-sizing: border-box; padding: 4px; font-family: inherit; font-size: 11px; line-height: 1.45; color: var(--content_default, #333); }',
      '.npw-header { display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 6px 8px; margin-bottom: 8px; border-radius: 6px; background: linear-gradient(135deg, #DC143C, #7d0b22); color: #fff; }',
      '.npw-header .npw-title { color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 0.3px; text-decoration: none; }',
      '.npw-header .npw-title:hover { text-decoration: underline; }',
      '.npw-header .npw-version { font-size: 9px; font-weight: 500; opacity: 0.85; }',
      '.npw-card { padding: 6px 8px; margin-bottom: 6px; border: 1px solid var(--hairline, #ddd); border-radius: 6px; background: var(--background_default, #fff); }',
      '.npw-card-title { display: flex; align-items: center; gap: 6px; padding-bottom: 3px; margin-bottom: 6px; border-bottom: 1px solid var(--hairline, #ddd); font-size: 9px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--primary, #DC143C); }',
      '.npw-card-title-text { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
      '.npw-card-count { flex: none; font-size: 9px; font-weight: 600; opacity: 0.75; }',
      '.npw-caret { flex: none; width: 8px; text-align: center; font-size: 9px; line-height: 1; }',
      '.npw-card-title-clickable { cursor: pointer; user-select: none; }',
      '.npw-card-title-clickable:hover .npw-card-title-text { text-decoration: underline; }',
      '.npw-card-title-clickable:focus-visible { outline: 2px solid var(--primary, #DC143C); outline-offset: 2px; border-radius: 3px; }',
      '.npw-card.npw-collapsed .npw-card-title { margin-bottom: 0; }',
      '.npw-card-body.npw-collapsed { display: none; }',
      '.npw-row { display: flex; align-items: center; gap: 6px; margin: 4px 0; }',
      '.npw-layer-item { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }',
      '.npw-layer-item:last-child { margin-bottom: 0; }',
      '.npw-checkbox { flex: none; margin: 0; cursor: pointer; accent-color: var(--primary, #DC143C); }',
      '.npw-label { flex: 1; font-size: 10px; cursor: pointer; user-select: none; color: var(--content_p1, #333); }',
      '.npw-opacity-row { display: flex; align-items: center; gap: 6px; margin: 2px 0 6px; }',
      '.npw-opacity-label { min-width: 48px; font-size: 9px; font-weight: 600; color: var(--content_p2, #666); }',
      '.npw-opacity-value { min-width: 28px; text-align: right; font-size: 9px; color: var(--content_p2, #666); }',
      '.npw-opacity-slider { flex: 1; height: 4px; border-radius: 2px; outline: none; cursor: pointer; background: linear-gradient(to right, #ddd 0%, #999 100%); -webkit-appearance: none; appearance: none; }',
      '.npw-opacity-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: var(--primary, #DC143C); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); cursor: pointer; }',
      '.npw-opacity-slider::-moz-range-thumb { width: 12px; height: 12px; border: none; border-radius: 50%; background: var(--primary, #DC143C); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); cursor: pointer; }',
      '.npw-btn { display: block; box-sizing: border-box; width: 100%; padding: 7px 12px; margin: 0 0 4px 0; border: none; border-radius: 6px; font-family: inherit; font-size: 12px; font-weight: 600; line-height: 1.2; text-align: center; color: #fff; cursor: pointer; transition: background-color 0.2s; }',
      '.npw-btn:disabled { opacity: 0.5; cursor: not-allowed; }',
      '.npw-btn-primary { background-color: #8BC34A; }',
      '.npw-btn-primary:hover:not(:disabled) { background-color: #689F38; }',
      '.npw-btn-danger { background-color: #E57373; }',
      '.npw-btn-danger:hover:not(:disabled) { background-color: #D32F2F; }',
      '.npw-btn-neutral { background-color: #0066cc; }',
      '.npw-btn-neutral:hover:not(:disabled) { background-color: #0052a3; }',
      '.npw-btn-accent { background-color: #DC143C; }',
      '.npw-btn-accent:hover:not(:disabled) { background-color: #7d0b22; }',
      '.npw-btn-sm { padding: 4px 0; margin-bottom: 0; font-size: 13px; line-height: 1; }',
      '.npw-btn-row { display: flex; gap: 6px; }',
      '.npw-btn-row > .npw-btn { flex: 1; min-width: 0; }',
      '.npw-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; margin-bottom: 6px; }',
      '.npw-select, .npw-input { box-sizing: border-box; width: 100%; padding: 4px; margin-bottom: 6px; border: 1px solid var(--hairline, #ccc); border-radius: 4px; background: var(--background_default, #fff); color: var(--content_default, #333); font-size: 11px; }',
      '.npw-small-label { display: block; margin-bottom: 3px; font-size: 10px; color: var(--content_p2, #666); }',
      '.npw-status { margin-top: 8px; font-size: 11px; font-style: italic; color: var(--content_p2, #666); }',
      '.npw-split { display: flex; gap: 8px; }',
      '.npw-split > div { flex: 1; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  /* --------------------------- small DOM helpers --------------------------- */
  function npwCreate(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }

  // Collapsed/expanded state of the panel cards, kept in one localStorage object so a
  // new card only needs a storageKey (a layer group name today, a provider section -
  // Django, ... - tomorrow).
  function loadCollapsedState(storageKey) {
    try {
      var all = JSON.parse(localStorage.getItem(WMS_COLLAPSED_STORAGE_KEY) || '{}');
      return typeof all[storageKey] === 'boolean' ? all[storageKey] : null;
    } catch (e) {
      return null;
    }
  }

  function saveCollapsedState(storageKey, collapsed) {
    try {
      var all = JSON.parse(localStorage.getItem(WMS_COLLAPSED_STORAGE_KEY) || '{}');
      all[storageKey] = collapsed;
      localStorage.setItem(WMS_COLLAPSED_STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      // Ignore - a failed preference write must never break the script.
    }
  }

  // A card is the panel's building block: an optional uppercase title bar plus a
  // content area. Content goes into `card.npwBody`, which is the element
  // `options.collapsible` folds away; the state is remembered per `options.storageKey`.
  // The layer-group cards use this, and any provider card added later can opt in the
  // same way. The title bar is a button-like element (click or Enter/Space).
  function npwCard(host, title, options) {
    options = options || {};
    var card = npwCreate('div', 'npw-card');
    var body = npwCreate('div', 'npw-card-body');
    card.npwBody = body;

    if (title) {
      var titleBar = npwCreate('div', 'npw-card-title');
      titleBar.appendChild(npwCreate('span', 'npw-card-title-text', title));
      card.appendChild(titleBar);

      if (options.collapsible) {
        var caret = npwCreate('span', 'npw-caret', '\u25BE');
        titleBar.appendChild(caret);
        titleBar.classList.add('npw-card-title-clickable');
        titleBar.setAttribute('role', 'button');
        titleBar.tabIndex = 0;
        titleBar.title = 'Click to collapse / expand this group';

        var applyCollapsed = function (collapsed) {
          card.classList.toggle('npw-collapsed', collapsed);
          body.classList.toggle('npw-collapsed', collapsed);
          caret.textContent = collapsed ? '\u25B8' : '\u25BE';
          titleBar.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        };
        var toggleCollapsed = function () {
          var collapsed = !card.classList.contains('npw-collapsed');
          applyCollapsed(collapsed);
          if (options.storageKey) saveCollapsedState(options.storageKey, collapsed);
        };
        titleBar.addEventListener('click', toggleCollapsed);
        titleBar.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCollapsed();
          }
        });

        var stored = options.storageKey ? loadCollapsedState(options.storageKey) : null;
        applyCollapsed(stored === null ? !!options.defaultCollapsed : stored);
      }
    }

    card.appendChild(body);
    if (host) host.appendChild(card);
    return card;
  }

  // Button colour pairs, identical to the "WME GeoFile" script (WME-NP-GIS-Layers):
  // background + hover only, so every panel - including the provider sections that
  // will be added later (Django, ...) - speaks one visual language. `.npw-btn` itself
  // (size, radius, weight, transition) lives in injectWmsPanelStyles().
  var NPW_BUTTON_VARIANTS = {
    primary: 'npw-btn-primary', // positive: load / import / apply
    danger: 'npw-btn-danger',   // destructive: clear / remove
    neutral: 'npw-btn-neutral', // secondary: shift pad arrows
    accent: 'npw-btn-accent',   // panel accent (Nepal crimson)
  };

  // Full-width solid button - same shape, weight and hover as WME GeoFile's
  // createButton(). `variant` is a key of NPW_BUTTON_VARIANTS (default neutral),
  // `extraClass` is used by the shift pad for its compact size.
  function npwButton(host, label, title, variant, extraClass) {
    var btn = npwCreate(
      'button',
      'npw-btn ' + (NPW_BUTTON_VARIANTS[variant] || NPW_BUTTON_VARIANTS.neutral) + (extraClass ? ' ' + extraClass : ''),
      label
    );
    if (title) btn.title = title;
    if (host) host.appendChild(btn);
    return btn;
  }

  // Flex row of equal-width buttons - WME GeoFile's ".geofile-btn-row" layout.
  function npwButtonRow(host) {
    var row = npwCreate('div', 'npw-btn-row');
    if (host) host.appendChild(row);
    return row;
  }

  // 3x3 shift pad shared by the WMS and the GeoJSON shift controls.
  function npwBuildShiftPad(host, onShift, onReset) {
    var defs = [
      ['\u2196', 'Shift Up-Left', 'upleft'],
      ['\u2191', 'Shift Up', 'up'],
      ['\u2197', 'Shift Up-Right', 'upright'],
      ['\u2190', 'Shift Left', 'left'],
      [null, null, null],
      ['\u2192', 'Shift Right', 'right'],
      ['\u2199', 'Shift Down-Left', 'downleft'],
      ['\u2193', 'Shift Down', 'down'],
      ['\u2198', 'Shift Down-Right', 'downright'],
    ];
    var grid = npwCreate('div', 'npw-grid');
    defs.forEach(function (def) {
      if (!def[0]) {
        grid.appendChild(npwCreate('div', 'npw-grid-empty')); // centre cell stays empty
        return;
      }
      var btn = npwButton(null, def[0], def[1], 'neutral', 'npw-btn-sm');
      btn.addEventListener('click', function () {
        onShift(def[2]);
      });
      grid.appendChild(btn);
    });
    host.appendChild(grid);
    var resetBtn = npwButton(host, 'Reset Shift', 'Undo every shift applied to this layer', 'accent');
    resetBtn.addEventListener('click', onReset);
  }

  /* --------------------- master toggle + opacity storage -------------------- */
  function loadMasterToggleState() {
    try {
      return localStorage.getItem(WMS_MASTER_STORAGE_KEY) !== 'false';
    } catch (e) {
      return true;
    }
  }

  function saveMasterToggleState(state) {
    try {
      localStorage.setItem(WMS_MASTER_STORAGE_KEY, state ? 'true' : 'false');
    } catch (e) {
      // Ignore - a failed preference write must never break the script.
    }
  }

  function loadCategoryOpacity(category) {
    try {
      var all = JSON.parse(localStorage.getItem(WMS_CATEGORY_OPACITY_STORAGE_KEY) || '{}');
      return typeof all[category] === 'number' ? all[category] : null;
    } catch (e) {
      return null;
    }
  }

  function saveCategoryOpacity(category, opacity) {
    try {
      var all = JSON.parse(localStorage.getItem(WMS_CATEGORY_OPACITY_STORAGE_KEY) || '{}');
      all[category] = opacity;
      localStorage.setItem(WMS_CATEGORY_OPACITY_STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      // Ignore - see above.
    }
  }

  // Per-layer WMS shifts the user nudged into place with the pad. Kept in metres of
  // content movement ({ east, north }), so the values do not depend on the map
  // projection and one can be copied straight into WMS_LAYER_SHIFT_PRESETS.
  function loadStoredLayerOffsets() {
    try {
      var all = JSON.parse(localStorage.getItem(WMS_LAYER_OFFSETS_STORAGE_KEY) || '{}');
      return all && typeof all === 'object' ? all : {};
    } catch (e) {
      return {};
    }
  }

  function saveStoredLayerOffsets(all) {
    try {
      localStorage.setItem(WMS_LAYER_OFFSETS_STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      // Ignore - a failed preference write must never break the script.
    }
  }

  // Register the single master checkbox that owns every layer of the script.
  function registerMasterLayerCheckbox() {
    if (!wmeSDK || !wmeSDK.LayerSwitcher) return;
    try {
      // Remove first so a re-init never leaves a stale checkbox behind.
      wmeSDK.LayerSwitcher.removeLayerCheckbox({ name: scriptName });
    } catch (e) {
      // Not registered yet - expected on first run.
    }
    try {
      wmeSDK.LayerSwitcher.addLayerCheckbox({ name: scriptName, isChecked: masterLayerToggleOn });
    } catch (e) {
      console.error(scriptName + ': could not register the master layer checkbox', e);
    }
  }

  // Apply a toggler's state to its OL2 layer(s) - the sidebar checkbox is UI only.
  // A layer that is switched off is hidden and then detached from the map, so an off
  // layer really is gone and no hidden tile grid is kept in memory.
  // Detaching may only happen for a layer that is actually attached: WME's
  // removeLayer() detaches the layer <div> unconditionally and throws NotFoundError
  // on removeChild when there is no such node.
  function applyLayerTogglerVisibility(toggler, visible) {
    for (var i = 0; i < toggler.layerArray.length; i++) {
      var layer = toggler.layerArray[i].layer;
      if (!layer) continue;
      var isOnMap = false;
      try {
        isOnMap = W.map.getLayers().indexOf(layer) !== -1;
      } catch (e) {
        isOnMap = false;
      }
      if (visible) {
        if (!isOnMap) W.map.addLayer(layer);
        layer.setVisibility(true);
      } else {
        layer.setVisibility(false);
        if (!isOnMap) continue; // nothing to detach
        try {
          W.map.removeLayer(layer);
        } catch (e) {
          // The <div> was already detached - the layer is hidden either way.
          console.warn(scriptName + ': could not detach layer "' + layer.name + '" from the map', e);
        }
      }
    }
  }

  // A layer is visible only when its sidebar checkbox is ticked AND the master
  // checkbox of the script in WME's layer switcher is on.
  function syncTogglerVisibility(toggler) {
    applyLayerTogglerVisibility(toggler, !!toggler.tabChecked && !!masterLayerToggleOn);
  }

  function syncAllTogglerVisibility() {
    for (var key in WMSLayerTogglers) syncTogglerVisibility(WMSLayerTogglers[key]);
  }

  // State is persisted under the existing localStorage.WMSLayers key, so preferences
  // saved by the previous implementations are picked up unchanged.
  function saveLayerTogglerStates() {
    var state = {};
    for (var key in WMSLayerTogglers) state[key] = !!WMSLayerTogglers[key].tabChecked;
    try {
      localStorage.WMSLayers = JSON.stringify(state);
    } catch (e) {
      console.warn(scriptName + ': could not save layer toggler states', e);
    }
    // Both the checkbox handler and the keyboard-shortcut handler end up here, so this
    // is the one place that keeps the group cards' "on/total" badges in sync.
    categoryCountRefreshers.forEach(function (refresh) {
      refresh();
    });
  }

  // Only loads the saved state into the togglers; the checkboxes and the layer
  // visibility are applied once the sidebar tab exists (see buildLayerCategoryPanels).
  function restoreLayerTogglerStates() {
    var state;
    try {
      state = JSON.parse(localStorage.WMSLayers || 'null');
    } catch (e) {
      return;
    }
    if (!state) return;
    for (var key in state) {
      var toggler = WMSLayerTogglers[key];
      if (!toggler) continue;
      toggler.tabChecked = !!state[key];
    }
  }

  // Build the category cards of the sidebar tab: one card per layer group, each
  // with an opacity slider for the whole group and a checkbox per layer.
  function buildLayerCategoryPanels(host) {
    // Rebuild-safe: drop the badge refreshers of a previous panel, if any.
    categoryCountRefreshers = [];
    var byGroup = {};
    var groupOrder = [];
    for (var key in WMSLayerTogglers) {
      var toggler = WMSLayerTogglers[key];
      var group = toggler.groupName || 'Other';
      if (!byGroup[group]) {
        byGroup[group] = [];
        groupOrder.push(group);
      }
      byGroup[group].push(toggler);
    }

    groupOrder.forEach(function (group) {
      var groupTogglers = byGroup[group];
      // Collapsible group card: the folded state is remembered per group name, so
      // "NP Places" can stay closed while "NP Roads" is open.
      var card = npwCard(host, group, { collapsible: true, storageKey: group });
      var cardBody = card.npwBody;

      // "on/total" badge in the title bar, so a collapsed group still shows how many
      // of its layers are enabled.
      var titleBar = card.querySelector('.npw-card-title');
      var countBadge = npwCreate('span', 'npw-card-count', '');
      titleBar.insertBefore(countBadge, titleBar.querySelector('.npw-caret'));
      var refreshCount = function () {
        var on = groupTogglers.filter(function (tg) {
          return !!tg.tabChecked;
        }).length;
        countBadge.textContent = on + '/' + groupTogglers.length;
      };
      refreshCount();
      categoryCountRefreshers.push(refreshCount);

      // Per-category opacity slider.
      var opacityRow = npwCreate('div', 'npw-opacity-row');
      opacityRow.appendChild(npwCreate('span', 'npw-opacity-label', 'Opacity'));
      var slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'npw-opacity-slider';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.1';
      var opacity = loadCategoryOpacity(group);
      if (opacity === null) {
        // Nothing stored yet - adopt the opacity of the first layer of the group.
        var firstItem = groupTogglers[0].layerArray[0];
        var firstLayer = firstItem && firstItem.layer;
        opacity = firstLayer && typeof firstLayer.opacity === 'number' ? firstLayer.opacity : 1;
      }
      slider.value = String(opacity);
      var valueLabel = npwCreate('span', 'npw-opacity-value', Math.round(opacity * 100) + '%');
      slider.addEventListener('input', function () {
        var newOpacity = parseFloat(slider.value);
        valueLabel.textContent = Math.round(newOpacity * 100) + '%';
        saveCategoryOpacity(group, newOpacity);
        groupTogglers.forEach(function (tg) {
          tg.layerArray.forEach(function (item) {
            if (item.layer && typeof item.layer.setOpacity === 'function') item.layer.setOpacity(newOpacity);
          });
        });
      });
      opacityRow.appendChild(slider);
      opacityRow.appendChild(valueLabel);
      cardBody.appendChild(opacityRow);

      // One checkbox row per layer.
      groupTogglers.forEach(function (toggler) {
        var row = npwCreate('div', 'npw-layer-item');
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'npw-checkbox';
        checkbox.checked = !!toggler.tabChecked;
        checkbox.addEventListener('change', function () {
          toggler.tabChecked = checkbox.checked;
          syncTogglerVisibility(toggler);
          saveLayerTogglerStates();
        });
        var label = npwCreate('label', 'npw-label', toggler.layerName);
        // Deliberately no htmlFor: this click handler is the only toggle path, so
        // clicking the label cannot double-toggle the checkbox.
        label.addEventListener('click', function () {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        });
        row.appendChild(checkbox);
        row.appendChild(label);
        cardBody.appendChild(row);
        toggler.tabCheckbox = checkbox;
      });
    });
  }

  function addLayerToggler(groupName, layerName, isPublic, layerArray) {
    var layerToggler = {};
    layerToggler.layerName = layerName;
    layerToggler.groupName = groupName;
    // NOTE: isPublic is kept for call-site compatibility - SDK checkboxes have no
    // icon slot, so the old public/locked padlock icon can no longer be shown.
    layerToggler.serviceType =
      layerArray.filter(function (e) {
        return e.serviceType == 'XYZ';
      }).length > 0
        ? 'XYZ'
        : 'WMS';
    var layerShortcut = layerName.replace(/ /g, '_').replace('.', '');
    // Sidebar state: tabChecked is the persisted checkbox state of this layer in
    // the script's own tab, tabCheckbox is the DOM checkbox once the tab is built.
    layerToggler.tabChecked = false;
    layerToggler.tabCheckbox = null;
    layerToggler.layerArray = layerArray;
    for (var i = 0; i < layerArray.length; i++) {
      layerArray[i].layer.name = layerName + (layerArray.length > 1 ? ' ' + i : '');
    }
    // Register this toggler as an SDK shortcut. The key itself is assigned by the
    // user in WME Settings -> Keyboard Shortcuts (see initializeSDKShortcuts()).
    sdkShortcutDefs.push({
      id: 'NepaliWMS_' + layerShortcut.replace(/[^A-Za-z0-9]/g, '_'),
      description: 'WMS: ' + layerName,
      settingsKey: layerShortcut,
      callback: layerKeyShortcutEventHandler(layerToggler),
    });
    return layerToggler;
  }

  // Shortcut callback: toggles the layer's sidebar checkbox and applies visibility.
  function layerKeyShortcutEventHandler(toggler) {
    return function () {
      toggler.tabChecked = !toggler.tabChecked;
      if (toggler.tabCheckbox) toggler.tabCheckbox.checked = toggler.tabChecked;
      syncTogglerVisibility(toggler);
      saveLayerTogglerStates();
    };
  }

  function setZOrdering(layerTogglers) {
    return function () {
      for (var key in layerTogglers) {
        for (var j = 0; j < layerTogglers[key].layerArray.length; j++) {
          if (layerTogglers[key].layerArray[j].zIndex > 0) {
            var l = W.map.getLayers().find(layer => layer.name === layerTogglers[key].layerName);
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
    this.params.SRS = 'EPSG:4326';
    return OL.Layer.Grid.prototype.getFullRequestString.apply(this, arguments);
  }

  // Function to load GeoJSON from URL
  function loadGeoJSONFromURL() {
    const wardNo = document.getElementById('geoJsonWardSelect').value;
    const fontColor = document.getElementById('geoJsonFontColor').value;
    const fontSize = document.getElementById('geoJsonFontSize').value;
    const buildingUrl = `https://geonep.com.np/LMC/ajax/x_building.php?ward_no=${wardNo}`;
    const boundaryUrl = `https://geonep.com.np/LMC/ajax/x_ward_bnd.php?ward_no=${wardNo}`;
    const buildingLayerName = `LMC_Ward_${wardNo}_Buildings`;
    const boundaryLayerName = `LMC_Ward_${wardNo}_Boundary`;
    
    // Check if layers already exist
    if (findGeoJsonLayer(buildingLayerName) || findGeoJsonLayer(boundaryLayerName)) {
      WazeToastr.Alerts.warning(
        scriptName,
        `Ward ${wardNo} layers already loaded`,
        false,
        false,
        3000
      );
      return;
    }
    
    updateGeoJsonStatus('Loading buildings and boundary...');
    console.log(`${scriptName}: Fetching buildings from ${buildingUrl}`);
    console.log(`${scriptName}: Fetching boundary from ${boundaryUrl}`);
    
    // Load buildings first
    GM_xmlhttpRequest({
      method: 'GET',
      url: buildingUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      onload: function(response) {
        if (response.status >= 200 && response.status < 300) {
          try {
            const geojsonData = JSON.parse(response.responseText);
            
            // Validate GeoJSON structure
            if (!geojsonData || !geojsonData.type || !geojsonData.features) {
              throw new Error('Invalid GeoJSON format');
            }
            
            if (geojsonData.features.length === 0) {
              throw new Error('No features found in GeoJSON');
            }
            
            console.log(`${scriptName}: Loaded ${geojsonData.features.length} building features`);
            
            // Create the SDK layer for buildings
            createGeoJSONLayer(geojsonData, buildingLayerName, wardNo, fontColor, fontSize, 'buildings');
            
            // Now load the boundary
            loadWardBoundary(wardNo, boundaryUrl, boundaryLayerName, geojsonData.features.length);
            
          } catch (error) {
            console.error(`${scriptName}: Error parsing buildings GeoJSON:`, error);
            updateGeoJsonStatus(`Error: ${error.message}`);
            WazeToastr.Alerts.error(
              scriptName,
              `Failed to parse buildings GeoJSON: ${error.message}`,
              false,
              false,
              5000
            );
          }
        } else {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          console.error(`${scriptName}: ${errorMsg}`);
          updateGeoJsonStatus(`Error: ${errorMsg}`);
          WazeToastr.Alerts.error(
            scriptName,
            `Failed to load buildings data: ${errorMsg}`,
            false,
            false,
            5000
          );
        }
      },
      onerror: function(error) {
        console.error(`${scriptName}: Network error:`, error);
        updateGeoJsonStatus('Network error occurred');
        WazeToastr.Alerts.error(
          scriptName,
          'Network error: Unable to connect to geonep.com.np',
          false,
          false,
          5000
        );
      },
      ontimeout: function() {
        console.error(`${scriptName}: Request timeout`);
        updateGeoJsonStatus('Request timeout');
        WazeToastr.Alerts.error(
          scriptName,
          'Request timeout: Server took too long to respond',
          false,
          false,
          5000
        );
      }
    });
  }

  // Function to load ward boundary
  function loadWardBoundary(wardNo, boundaryUrl, boundaryLayerName, buildingCount) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: boundaryUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      onload: function(response) {
        if (response.status >= 200 && response.status < 300) {
          try {
            const boundaryData = JSON.parse(response.responseText);
            
            // Validate GeoJSON structure
            if (!boundaryData || !boundaryData.type || !boundaryData.features) {
              throw new Error('Invalid boundary GeoJSON format');
            }
            
            console.log(`${scriptName}: Loaded ${boundaryData.features.length} boundary features`);
            
            // Create the SDK layer for the boundary
            createGeoJSONLayer(boundaryData, boundaryLayerName, wardNo, null, null, 'boundary');
            
            updateGeoJsonStatus(`Loaded ${buildingCount} buildings and boundary for Ward ${wardNo}`);
            WazeToastr.Alerts.success(
              scriptName,
              `Successfully loaded ${buildingCount} buildings and boundary for Ward ${wardNo}`,
              false,
              false,
              3000
            );
            
          } catch (error) {
            console.error(`${scriptName}: Error parsing boundary GeoJSON:`, error);
            updateGeoJsonStatus(`Loaded buildings but boundary failed: ${error.message}`);
            WazeToastr.Alerts.warning(
              scriptName,
              `Loaded buildings but boundary failed: ${error.message}`,
              false,
              false,
              5000
            );
          }
        } else {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          console.error(`${scriptName}: Boundary ${errorMsg}`);
          updateGeoJsonStatus(`Loaded buildings but boundary failed`);
          WazeToastr.Alerts.warning(
            scriptName,
            `Loaded buildings but boundary failed: ${errorMsg}`,
            false,
            false,
            5000
          );
        }
      },
      onerror: function(error) {
        console.error(`${scriptName}: Boundary network error:`, error);
        updateGeoJsonStatus('Buildings loaded, boundary network error');
        WazeToastr.Alerts.warning(
          scriptName,
          'Buildings loaded, but boundary failed to load',
          false,
          false,
          5000
        );
      },
      ontimeout: function() {
        console.error(`${scriptName}: Boundary request timeout`);
        updateGeoJsonStatus('Buildings loaded, boundary timeout');
        WazeToastr.Alerts.warning(
          scriptName,
          'Buildings loaded, but boundary request timeout',
          false,
          false,
          5000
        );
      }
    });
  }

  // Helper function to remove Z coordinates from GeoJSON
  function removeZCoordinates(coords) {
    if (!coords) return coords;
    
    // Check if this is a coordinate pair [lon, lat] or [lon, lat, elevation]
    if (typeof coords[0] === 'number') {
      // It's a coordinate pair/triple - return only [lon, lat]
      return coords.slice(0, 2);
    }
    
    // It's an array of coordinates - recurse
    return coords.map(removeZCoordinates);
  }

  // Function to create a GeoJSON SDK feature layer
  function createGeoJSONLayer(geojsonData, layerName, wardNo, fontColor, fontSize, layerType) {
    try {
      // Default values for building layers
      fontColor = fontColor || '#ffffff';
      fontSize = fontSize || '13';
      layerType = layerType || 'buildings';

      // Seed the mutable label style so a newly loaded layer matches the inputs
      if (layerType === 'buildings') {
        geoJsonLabelStyle.fontColor = fontColor;
        geoJsonLabelStyle.fontSize = String(fontSize);
      }

      console.log(`${scriptName}: Creating ${layerType} SDK layer for Ward ${wardNo}`);

      if (layerType === 'buildings') {
        console.log(`${scriptName}: Label settings - Color: ${geoJsonLabelStyle.fontColor}, Size: ${geoJsonLabelStyle.fontSize}px`);
      }
      
      console.log(`${scriptName}: GeoJSON data:`, geojsonData);
      
      // Ensure we have valid GeoJSON
      if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) {
        throw new Error('No features in GeoJSON data');
      }
      
      // Parse GeoJSON - convert string to object if needed
      const geojson = typeof geojsonData === 'string' ? JSON.parse(geojsonData) : geojsonData;
      
      // Remove Z coordinates (elevation) from all features as OpenLayers 2 doesn't handle 3D coordinates well
      geojson.features.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
          feature.geometry.coordinates = removeZCoordinates(feature.geometry.coordinates);
        }
      });
      
      console.log(`${scriptName}: Processing ${geojson.features.length} features from GeoJSON (Z-coordinates removed)`);
      
      // Build SDK features. A SdkFeature id is required, and the GeoJSON properties
      // are kept as they are - they carry the fields the label is built from.
      const sdkFeatures = [];
      geojson.features.forEach((feature, index) => {
        if (!feature || !feature.geometry) return;
        const properties = feature.properties || {};
        if (layerType === 'buildings') {
          // Create a custom label by filtering out null/undefined values
          const labelParts = [];
          if (properties.metric_num !== null && properties.metric_num !== undefined) {
            labelParts.push(properties.metric_num);
          } else {
            // If metric_num is not available, skip the rest
            properties.custom_label = '';
          }
          if (labelParts.length > 0) {
            if (properties.rd_naeng !== null && properties.rd_naeng !== undefined) {
              labelParts.push(properties.rd_naeng);
            }
            if (properties.rd_nanep !== null && properties.rd_nanep !== undefined) {
              // Convert Preeti font to Unicode
              const unicodeText = typeof preeti === 'function' ? preeti(properties.rd_nanep) : properties.rd_nanep;
              labelParts.push(unicodeText);
            }
            if (properties.tole_ne_en !== null && properties.tole_ne_en !== undefined) {
              labelParts.push(properties.tole_ne_en);
            }
            properties.custom_label = labelParts.join('\n');
          }
        }
        sdkFeatures.push({
          id: layerName + '_' + index,
          type: 'Feature',
          geometry: feature.geometry,
          properties: properties,
        });
      });

      console.log(`${scriptName}: Prepared ${sdkFeatures.length} SDK features (Z-coordinates removed)`);

      if (sdkFeatures.length === 0) {
        throw new Error('No valid features could be parsed from GeoJSON');
      }
      
      // Declarative SDK styling (see GEOJSON_LAYER_STYLES). The label values reference
      // the styleContext getters, so colour/size can change without reloading.
      const layerConfig = {
        layerName: layerName,
        zIndexing: true,
        styleRules: [{ style: GEOJSON_LAYER_STYLES[layerType] || GEOJSON_LAYER_STYLES.buildings }],
      };
      if (layerType === 'buildings') {
        layerConfig.styleContext = {
          getLabel: (ctx) => (ctx && ctx.feature && ctx.feature.properties && ctx.feature.properties.custom_label) || '',
          getFontSize: () => geoJsonLabelStyle.fontSize + 'px',
          getFontColor: () => geoJsonLabelStyle.fontColor,
        };
      }

      wmeSDK.Map.addLayer(layerConfig);
      // Bulk load - the GeoJSON was already parsed, so validation is skipped on purpose
      wmeSDK.Map.dangerouslyAddFeaturesToLayerWithoutValidation({ features: sdkFeatures, layerName: layerName });
      wmeSDK.Map.setLayerVisibility({ layerName: layerName, visibility: true });
      console.log(`${scriptName}: Added ${sdkFeatures.length} features to SDK layer ${layerName}`);

      // z-index based on layer type - boundaries below buildings
      wmeSDK.Map.setLayerZIndex({
        layerName: layerName,
        zIndex: layerType === 'boundary' ? ZIndexes.popup + 5 : ZIndexes.popup + 10,
      });

      // Store reference for cleanup and shifting
      loadedGeoJSONLayers.push({
        name: layerName,
        sdkFeatures: sdkFeatures,
        wardNo: wardNo,
        layerType: layerType,
      });

      // Update layer selector dropdown
      updateGeoJsonLayerSelector();
      
    } catch (error) {
      console.error(`${scriptName}: Error creating GeoJSON layer:`, error);
      WazeToastr.Alerts.error(
        scriptName,
        `Failed to create GeoJSON layer: ${error.message}`,
        false,
        false,
        5000
      );
      throw error;
    }
  }

  // Function to clear all loaded GeoJSON layers
  function clearLoadedGeoJSON() {
    if (loadedGeoJSONLayers.length === 0) {
      WazeToastr.Alerts.info(
        scriptName,
        'No building layers to clear',
        false,
        false,
        2000
      );
      return;
    }
    
    let removedCount = 0;
    loadedGeoJSONLayers.forEach(item => {
      try {
        wmeSDK.Map.removeAllFeaturesFromLayer({ layerName: item.name });
      } catch (e) {
        // Layer may already be gone - removing it below is enough.
      }
      try {
        wmeSDK.Map.removeLayer({ layerName: item.name });
        removedCount++;
      } catch (e) {
        if (!(wmeSDK.Errors && e instanceof wmeSDK.Errors.InvalidStateError)) {
          console.warn(`${scriptName}: could not remove layer ${item.name}`, e);
        }
      }
      delete geoJsonLayerOffsets[item.name];
    });

    loadedGeoJSONLayers = [];
    updateGeoJsonLayerSelector();
    updateGeoJsonStatus('All building layers cleared');
    
    WazeToastr.Alerts.success(
      scriptName,
      `Removed ${removedCount} building layer(s)`,
      false,
      false,
      2000
    );
  }

  // Helper function to update status display
  function updateGeoJsonStatus(message) {
    const statusDiv = document.getElementById('geoJsonStatus');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.style.color = message.includes('Error') ? '#f44336' : '#4CAF50';
    }
  }

    function scriptupdatemonitor() {
  if (WazeToastr?.Ready) {
    // Create and start the ScriptUpdateMonitor
    const updateMonitor = new WazeToastr.Alerts.ScriptUpdateMonitor(scriptName, scriptVersion, downloadUrl, GM_xmlhttpRequest);

    // Check immediately on page load, then every 2 hours
    updateMonitor.start(2, true); // checkImmediately = true

    // Show the update dialog for the current version
    WazeToastr.Interface.ShowScriptUpdate(scriptName, scriptVersion, updateMessage, downloadUrl);
  } else {
    setTimeout(scriptupdatemonitor, 250);
  }
}
  function bootstrap() {
    wmeSDK = unsafeWindow.getWmeSdk({ scriptId: 'nepali-wms-layers-beta', scriptName });
    console.log(`${scriptName} initialized.`);
    scriptupdatemonitor();
    // SDK event bus (replaces document.addEventListener('wme-map-data-loaded', ...)).
    // Resolves once map data has been fetched; runs init exactly once.
    wmeSDK.Events.once({ eventName: 'wme-map-data-loaded' }).then(init);
  }

  unsafeWindow.SDK_INITIALIZED.then(bootstrap);
  /*
changeLog
2026.09.13.016
<strong>Added:</strong><br>
- WMS layers can now start from a corrected position: <code>WMS_LAYER_SHIFT_PRESETS</code> holds a built-in default shift per layer, applied <em>before the first tile is drawn</em>, so e.g. the inaccurate DMG municipality border no longer has to be nudged into place by hand (no 260 clicks after every reload). Values are written the way they are measured on the map: <code>{ west: 260, north: 20 }</code> = pull the layer 260 m west and 20 m north. Currently set for the DMG municipality border.<br>
- A shift made by hand with the pad is now remembered per layer (stored in metres, so it is projection-independent) and re-applied on the next page load. <em>Reset Shift</em> returns to the layer's built-in default instead of an unshifted position.<br>
- The Layer tools card shows the shift currently applied to the selected layer, e.g. <em>Applied shift: 260 m W, 20 m N (built-in default)</em> / <em>(remembered)</em> - the value can be copied straight into the preset table.<br><br>
2026.09.13.015
<strong>UI:</strong><br>
- The layer-group cards (NP Places, NP Roads, ...) can now be collapsed and expanded by clicking their title bar (keyboard: Enter/Space). The folded state is remembered per group, so a collapsed "NP Places" stays collapsed after a page reload.<br>
- Each group title shows an <em>on/total</em> badge (e.g. <code>2/12</code>) that stays visible while the group is collapsed, and `npwCard()` now takes an optional <code>{ collapsible, storageKey }</code> so the provider cards planned next (Django, etc.) get the same behaviour for free.<br><br>
2026.09.13.014
<strong>UI:</strong><br>
- Buttons modernised to the "WME GeoFile" (WME-NP-GIS-Layers) look: full-width solid button, 6px radius, 600 weight, coloured hover, using the same palette (green = load/import, red = clear/remove, blue = neutral, crimson = accent).<br>
- Load / Clear are now one two-button row, and each shift pad has a full-width <em>Reset Shift</em> button under the 3x3 arrow grid instead of a small inline one.<br>
- The button factory, palette and row helper are shared (<code>npwButton()</code>, <code>npwButtonRow()</code>, <code>NPW_BUTTON_VARIANTS</code>) so the provider sections planned next (Django, etc.) can reuse the same layout and colours.<br><br>
2026.09.13.013
<strong>Fixed:</strong><br>
- GeoJSON layer shift direction: only up/down moved the layer the way the arrow points; <em>left/right and the four diagonals were mirrored horizontally</em>. The horizontal component of the shift is now negated so every arrow moves the layer in the direction it points (vertical was already correct).<br><br>
2026.09.13.012
<strong>SDK migration (GeoJSON layers):</strong><br>
- The LMC ward GeoJSON layers are now WME SDK feature layers: <code>Map.addLayer</code> with <code>styleRules</code>/<code>styleContext</code> + <code>dangerouslyAddFeaturesToLayerWithoutValidation</code>, <code>setLayerVisibility</code>, <code>setLayerZIndex</code>, <code>redrawLayer</code>, <code>removeAllFeaturesFromLayer</code> and <code>removeLayer</code> replace <code>OL.Format.GeoJSON</code>, <code>OL.Layer.Vector</code>, <code>OL.StyleMap</code> and the OL2 layer calls.<br>
- Every feature now gets the <code>id</code> the SDK requires (<code>&lt;layerName&gt;_&lt;index&gt;</code>), and the label is built from the feature properties instead of OL2 <code>attributes</code>.<br>
- The label colour/size inputs now update the loaded building layers immediately (<code>redrawLayer</code> re-runs the styleContext getters) instead of only affecting newly loaded wards.<br>
- Shifting no longer uses OL2 <code>geometry.move()</code>: coordinates are translated in WGS84 degrees and the layer is re-added. The metres-to-degrees conversion now always applies, because SDK features are stored in WGS84 regardless of the map projection.<br><br>
2026.09.13.011
<strong>Fixed:</strong><br>
- <code>W.map.getCenter()</code> is no longer read blindly: the WMS and GeoJSON shift maths asked for <code>.lat</code> even when the map had no centre yet (TypeError). Both now use <code>getMapCenterLat()</code>, which falls back to the OL2 map centre and finally to Nepal's latitude.<br><br>
2026.09.13.010
<strong>Changed:</strong><br>
- Switching a layer off now detaches it from the map again instead of only hiding it, so an off layer keeps no hidden tile grid in memory. The detach is guarded - only layers that are actually attached to the map are removed and a failed detach can no longer break the toggle, which is what caused the <code>NotFoundError: removeChild</code> in 2026.09.13.007.<br>
- The Street View overlay cleanup detaches the layer the same way.<br><br>
2026.09.13.009
<strong>Changed:</strong><br>
- Layers are no longer detached from the map: a layer is attached on demand and then only switched with <code>setVisibility()</code>, the way "Croatian WMS layers" does it. <code>W.map.removeLayer()</code> is no longer called anywhere for WMS/XYZ layers, so the <code>NotFoundError: removeChild</code> class of failure cannot occur at all.<br>
- Side effect: a layer that has been enabled once stays in the map's layer list after being switched off (it no longer disappears from the "Layer tools" drop-down), and re-enabling it is instant.<br><br>
2026.09.13.008
<strong>Fixed:</strong><br>
- <code>NotFoundError: Failed to execute 'removeChild' on 'Node'</code> when switching a layer off. WME's <code>removeLayer()</code> detaches the layer <code>&lt;div&gt;</code> unconditionally, so it was being called for layers that were never added to the map (e.g. on start-up and when the master checkbox was off). Layers are now detached only when they are actually on the map, and hiding relies on <code>setVisibility(false)</code> alone.<br>
- Same guard applied to the Street View overlay cleanup.<br><br>
2026.09.13.007
<strong>UI:</strong><br>
- Sidebar tab rebuilt on the "Croatian WMS layers" pattern: gradient header (title + version), one card per layer group with a per-group <strong>opacity slider</strong> and one checkbox per layer, plus theme-aware controls.<br>
- The WME layer switcher now holds a <strong>single master checkbox</strong> for the script instead of one checkbox per layer; a layer is drawn only when its sidebar checkbox <em>and</em> the master checkbox are on. The master state is remembered.<br>
- Panel and both WMS popups are now themed with WME CSS variables (<code>--content_default</code>, <code>--background_default</code>, <code>--hairline</code>, <code>--primary</code>, <code>--content_p1/p2</code>), so they follow the editor's light/dark theme instead of hard-coded colours.<br><br>
2026.09.13.006
<strong>SDK migration:</strong><br>
- Layer switcher rebuilt on <code>wmeSDK.LayerSwitcher</code> (addLayerCheckbox / setLayerCheckboxChecked / isLayerCheckboxChecked + the <code>wme-layer-checkbox-toggled</code> event) instead of hand-made shadow-DOM <code>wz-checkbox</code> elements. Saved states are preserved; the group names are kept as label prefixes since the SDK has no group API.<br>
- Street View overlay is now driven by the SDK street view events (<code>wme-street-view-button-activated/deactivated</code>, <code>wme-street-view-panel-visibility-changed</code>) and <code>Map.isStreetViewActive()</code>, replacing the MutationObserver on <code>.street-view-control</code>.<br><br>
2026.09.13.005
<strong>SDK migration:</strong><br>
- Bootstrap now waits on <code>wmeSDK.Events.once('wme-map-data-loaded')</code> instead of a DOM event listener.<br>
- WMS info popups are positioned with the SDK screen-pixel API and are clamped to stay inside the viewport (no more page distortion at the map edges).<br>
- Keyboard shortcuts migrated from <code>W.accelerators</code>/<code>I18n</code> to the WME SDK (<code>wmeSDK.Shortcuts</code>), with automatic migration of previously assigned legacy keys.<br><br>
2026.05.20.10
<strong>Added HNs:</strong><br>- Dhangadhi Sub Metropolitan City <br>- Ghodaghodi Municipality <br>- Nepalgunj Sub Metropolitan City<br><br>
2026.05.20.09
- Fixed issue where script fails to load. 
- Most of the code is currently using WMESDK and its equivalent APIs. 
2026-04-16.1
<strong>Fixed:</strong><br> - Compability with latest WME version.<br><br> - swapped W.map.olMap with W.map.getOLMap() to fix layers not showing up issue. <br><br> Thanks to davidsl4 to pointing out.
2026.02.06.06
- Added Preeti font to Unicode conversion for rd_nanep field
- Building labels now display Nepali text in proper Unicode format
2026.02.06.01
- Added feature: Load GeoJSON from URL (LMC Ward Buildings from geonep.com.np)
- New UI section to select ward number (1-29) and load building data
- Buildings display with house numbers as labels
- Clear button to remove all loaded GeoJSON layers
2025.11.29.01
- Added layers: Health Facilities from National Geoportal, Police Units from National Geoportal.
2025.08.30.01
- ZIndex update for : Education Facilities (PRTMP),<br> Health Facilities (PRTMP),<br> Palika Centre (PRTMP),<br> Ward Centre (PRTMP),<br> Tourist Attraction,<br> Customs Office <br> Bridges (BSM),<br> Bridges (PRTMP),<br> and Lalitpur Metropolitan City (LMC) layers.
version: 2025.07.27.1 - Added Layers:
  - Rivers
  - Education Facilities (PRTMP)
  - Health Facilities (PRTMP)
  - Palika Centre (PRTMP)
  - Ward Centre (PRTMP)
  - Tourist Attraction
  - Customs Office
  - National Highways 2023
  - Province Highways 2023
  - Province Roads 2023
  - Bridges (BSM)
  - Bridges (PRTMP)
  - and popup support for above layers and more.
version: 2025.07.24.01 - It now supports to display popup for highway with various information.
version: 2025.06.23.01 - Added diagonal (↖, ↗, ↙, ↘) shift buttons for WMS layers.
                       - Shows alert when the shift is reset to default.
version: 2025.06.08.01 - Now the WMS layer can be shifted by a specified distance in meters.
Version: 2025.06.06.02 - Added Bridge Management System bridge locations!
                       - Loaded layers will be reloaded even after the page refresh.
Version: 2025.06.06.01 - Added Bridge Management System bridge locations!
version: 2025.05.11.01 - Fixed Z-ordering
version: 2025.04.13.01 - Fixed Combatible with the latest wme beta v2.287-5! Now it monitors the script update!
version: 2025.03.06.01 - Now LMC HN can be filtered by ward
version: 2025.02.03.01 - Line modification
version: 2025.02.01.02 - Added support for WazeToastr update dialogue box
version: 2025.02.01.01 - Modified how WMS 4326 image is displayed
version: "1.0", message: "Initial Version"

*/
})();
