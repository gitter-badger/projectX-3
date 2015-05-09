
// Provides control sap.m.App.
sap.ui.define(['jquery.sap.global', 'sap/ui/base/ManagedObject'],
	function(jQuery, ManagedObject) {
	"use strict";

	var PrefixUrl = ManagedObject.extend("projectX.util.PrefixUrl", { metadata : {

		properties : {
			url : {type : "string", defaultValue : null}
		},
		events : {

		}
	}});

	// /////////////////////////////////////////////////////////////////////////////
	// /// public functions
	// /////////////////////////////////////////////////////////////////////////////

	/**
	 * create a serialized version of this sequenceItem.
	 * set temporary data to null.
	 * @return {object} a javascript object containing the data that has to be saved to disk.
	 */
	PrefixUrl.prototype.serialize = function() {
		this.resetTempData();
		return this.mProperties;
	};

	/**
	 * reset temporary data.
	 */
	PrefixUrl.prototype.resetTempData = function() {

	};

	return PrefixUrl;

}, /* bExport= */ true);