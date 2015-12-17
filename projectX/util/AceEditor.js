sap.ui.define(['jquery.sap.global', 'sap/ui/core/Control'],
	function(jQuery, Control) {
		"use strict";

		var AceEditor = Control.extend("projectX.util.AceEditor", {
			metadata: {

				properties: {

					width: {
						type: "sap.ui.core.CSSSize",
						group: "Appearance",
						defaultValue: null
					},

					height: {
						type: "sap.ui.core.CSSSize",
						group: "Appearance",
						defaultValue: null
					},

					value: {
						type: "string",
						defaultValue: null
					},

					readOnly: {
						type: "boolean",
						defaultValue: false
					},

					enableWrapMode: {
						type: "boolean",
						defaultValue: false
					},

					autoHeightMode: {
						type: "boolean",
						defaultValue: false
					},

					mode: {
						type: "string",
						defaultValue: "javascript"
					},
					
					showGutter: {
						type: "boolean",
						defaultValue: true
					},
					
					fontSize: {
						type: "int",
						defaultValue: 12
					},
				},
				events: {
					someEvent: {}
				}
			}
		});

		// /////////////////////////////////////////////////////////////////////////////
		// /// Control Overrides
		// /////////////////////////////////////////////////////////////////////////////

		AceEditor.prototype.init = function() {
			console.log("aceeditor init");
		};


		AceEditor.prototype.onAfterRendering = function() {
			console.log("aceeditor onAfterRendering");
			var sEditID = this.getId();
			if (this._editor) {
				this._editor.destroy();
			}

			this._editor = ace.edit(sEditID);
			this._editor.setTheme("ace/theme/tomorrow");
			this._editor.getSession().setMode("ace/mode/" + this.getMode());
			this._editor.commands.removeCommand('find');
			this._editor.setReadOnly(this.getReadOnly());
			
			this._editor.renderer.setShowGutter(this.getShowGutter());
			this._editor.setFontSize(this.getFontSize()); 


			if (this.getAutoHeightMode()) {
				this._editor.setOptions({
					maxLines: Infinity
				});
			}

			this._editor.getSession().setUseWrapMode(this.getEnableWrapMode());

			this._editor.setValue(this.getValue(), 1);

			var that = this;
			this._editor.getSession().on('change', function(e) {
				var sEditorValue = that._editor.getValue();
				var sControlValue = that.getValue();
				if (sEditorValue !== sControlValue) {
					that.setProperty("value", sEditorValue, true);
				}

			});
		};

		/**
		 * update the value property but do not trigger a rerender of the control.
		 * instead directly set the value into the ace editor
		 * @param {string} sValue the new value string
		 */
		AceEditor.prototype.setValue = function(sValue) {
			this.setProperty("value", sValue, true);
      if (this._editor) {
        this._editor.setValue(sValue, 1);
      }
		};
    
    /**
     * update the mode property but do not trigger a rerender of the control.
     * instead directly set the value into the ace editor
     * @param {string} sMode the new mode of the ace editor
     */
    AceEditor.prototype.setMode = function(sMode) {
      this.setProperty("mode", sMode, true);
      if (this._editor) {
        this._editor.getSession().setMode("ace/mode/" + sMode);
      }
    };


		// /////////////////////////////////////////////////////////////////////////////
		// /// Public functions
		// /////////////////////////////////////////////////////////////////////////////



		// /////////////////////////////////////////////////////////////////////////////
		// /// Private functions
		// /////////////////////////////////////////////////////////////////////////////



		return AceEditor;

	}, /* bExport= */ true);