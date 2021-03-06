jQuery.sap.require("projectX.util.Project");
jQuery.sap.require("projectX.util.Request");
jQuery.sap.require("projectX.util.Controller");
jQuery.sap.require("projectX.util.Helper");
jQuery.sap.require("projectX.util.Constants");

jQuery.sap.require("sap.m.MessageBox");



projectX.util.Controller.extend("projectX.view.Sequence.Sequence", {

	_localProjectModel : undefined,
	_oSequence : null,

	//TODO create enum for the binding targets

	// /////////////////////////////////////////////////////////////////////////////
	// /// initialization and routing
	// /////////////////////////////////////////////////////////////////////////////

	onInit : function() {
		this._localUIModel = new sap.ui.model.json.JSONModel();
		this._localUIModel.setData({
			configVisible: true,
			testVisible: false,
			testRunning : false,
			testNotRunning : true,
			PRE_REQUEST_SCRIPT_EXAMPLES: projectX.util.Constants.PRE_SEQUENCE_SCRIPT_EXAMPLES
		});
		this.getView().setModel(this._localUIModel, "localUIModel");

		//hook navigation event
		this.getRouter().getRoute("sequence").attachPatternMatched(this.onRouteMatched, this);
	},

	onRouteMatched : function(oEvent) {
		var oParameters = oEvent.getParameters();
		var iSequenceId = parseInt(oParameters.arguments.sequenceID, 10);
		var oModel = this.getView().getModel();
		var oSelectedProject = oModel.getProperty("/SelectedProject");

		var oSelectedSequence = oSelectedProject.getSequenceByIdentifier(iSequenceId);
		if (!oSelectedSequence) {
			return;
		}

		this._oSequence = oSelectedSequence;
		this._oProject = oSelectedProject;
		//set data from selected sequence into local project model
		this._localUIModel.setProperty("/sequence", this._oSequence);
		//set helper values to modify the page between edit and new
		this._setSelectedRequests();

		//add list of requests to local ui model for the "add request dialog"
		this._localUIModel.setProperty("/requests", oSelectedProject.getRequests());
	},
	
	
	onBeforeShow : function() {
		var that = this;
		this.getComponent().setKeyboardShortcutExecuteRequest(function(){
			sap.m.MessageToast.show("Running sequence ...", {
				animationDuration: 100,
				duration: 300
			});
			that.onRunSequence();
		});
	},

	onBeforeHide : function() {
		this.getComponent().setKeyboardShortcutExecuteRequest(null);
	},
	
	_setSelectedRequests : function() {
		//get requests for requestIds and set to local ui model
		var aSelectedRequests = [];
		var aRequestIds = this._oSequence.getRequestIds();
		for (var i = 0; i < aRequestIds.length; i++) {
			var oRequest = this._oProject.getRequestByIdentifier(aRequestIds[i]);
			//create deep copy of request because in testrun the same
			//request can be executed multiple times
			// if (oRequest) {
			// 	var oRequestCopy = new projectX.util.Request(oRequest.serialize());
			// 	aSelectedRequests.push(oRequestCopy);
			// }
			if(oRequest) {
				aSelectedRequests.push(oRequest);	
			}
		}
		
		this._localUIModel.setProperty("/selectedRequests", aSelectedRequests);
	},

	// /////////////////////////////////////////////////////////////////////////////
	// /// Request Select Dialog Event handler
	// /////////////////////////////////////////////////////////////////////////////

	onRequestSelectDialogSearch : function(oEvent) {
		var sValue = oEvent.getParameter("value");
	  var oFilter = new sap.ui.model.Filter("mProperties/name", sap.ui.model.FilterOperator.Contains, sValue);
	  var oBinding = oEvent.getSource().getBinding("items");
	  oBinding.filter([oFilter]);
	},
	
	onRequestSelectDialogConfirm : function(oEvent) {
		var aContexts = oEvent.getParameter("selectedContexts");
		var aRequests = [];
		if (aContexts.length) {
			aRequests = aContexts.map(function(oContext) { 
				//return this._localUIModel.getProperty(oContext.sPath);
				return oContext.getObject();
			}, this);
	    }
	    oEvent.getSource().getBinding("items").filter([]);
		
		var aSelectedRequests = this._localUIModel.getProperty("/selectedRequests");
		for (var i = 0; i < aRequests.length; i++) {
			var oRequest = aRequests[i];
			aSelectedRequests.push(oRequest);
			// oRequest = new projectX.util.Request(oRequest.serialize());
			// aSelectedRequests.push(oRequest);
		}
		
		//set the selected requests to localuimodel and to the sequence object
		this._localUIModel.setProperty("/selectedRequests",aSelectedRequests);
		this._oSequence.addRequestIds(aSelectedRequests);
	},
	
	onRequestSelectDialogClose : function(oEvent) {
		
	},

	// /////////////////////////////////////////////////////////////////////////////
	// /// event handler
	// /////////////////////////////////////////////////////////////////////////////

	onBtnAddRequest : function(oEvent) {
		var oRequestSelectDialog = this.getView().byId("idRequestSelectDialog");
		var oSorter = new sap.ui.model.Sorter("mProperties/name", false);
		oRequestSelectDialog.getBinding("items").sort(oSorter);
		jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), oRequestSelectDialog);
		oRequestSelectDialog.open();
	},
	
	onDeleteRequest : function(oEvent) {
		var oRequest = projectX.util.Helper.getBoundObjectForItem(oEvent.getSource(), "localUIModel");
		var oSequence =  this._localUIModel.getProperty("/sequence");
		oSequence.removeRequest(oRequest);
		this._setSelectedRequests();
	},


	/**
	* execute the first request. when it finished than execute the next request.
	* can be aborted by the user. (see onStopSequence function)
	*/
	onRunSequence : function() {
		//get the requests
		var aRequests = this._localUIModel.getProperty("/selectedRequests");
		if (!aRequests || aRequests.length <= 0) {
			return;
		}

		//clear existing results
		this.onClearResults();
		
		var oSequenceStorage = {};
		
		var oSequence =  this._localUIModel.getProperty("/sequence");		
		var bRes = oSequence.runPreSequenceScript(oSequenceStorage);
		this._localUIModel.updateBindings();		
		
		if (bRes) {
			this._setRunning(true);
			this._executeRequests(this._oProject, 0, aRequests, oSequenceStorage);			
		}	else {
			sap.m.MessageBox.alert("Error in Pre-Sequence Script. Sequence aborted!");	
		}
	},

	/**
	* stop the currently running sequence.
	* works only when sequence was started with onRunSequence function.
	*/
	onStopSequence : function() {
		if (this._getRunning()) {
			this._bAbortSequence = true;
		}
	},

	/**
	* loop over the requests and clear out the result data from the last test run.
	*/
	onClearResults : function() {
		var oSequence =  this._localUIModel.getProperty("/sequence");
		oSequence.resetTempData();
		
		//get the requests
		var aRequests = this._localUIModel.getProperty("/selectedRequests");
		if (!aRequests || aRequests.length <= 0) {
			return;
		}

		//loop over requests and reset the result data
		for (var i = 0; i < aRequests.length; i++) {
			//clear old request results
			aRequests[i].resetTempData();
		}
		this._localUIModel.updateBindings();
	},

	onCloseDialog : function () {
		this._oDialog.close();
	},

	/**
	* the user clicked on the title of a specific request.
	* expand the item to show the results of the request.
	*/
	onRequestNamePress : function (oEvent) {
		var oObjectHeader = oEvent.getSource();
		var sPath = oEvent.getSource().getBindingContext("localUIModel").getPath();
		
		// create popover
		if (!this._oDialog) {
			this._oDialog = sap.ui.xmlfragment("projectX.view.Sequence.SequenceRequestDialog", this);
			this.getView().addDependent(this._oDialog);
		}

		this._oDialog.setModel(this._localUIModel);
		this._oDialog.bindElement(sPath);
		// delay because addDependent will do a async rerendering and the actionSheet will immediately close without it.
		jQuery.sap.delayedCall(0, this, function () {
			this._oDialog.open();
		});
		return;
		
		
		// create popover
		if (!this._oPopover) {
			this._oPopover = sap.ui.xmlfragment("projectX.view.Sequence.SequenceRequest", this);
			this.getView().addDependent(this._oPopover);
		}

		this._oPopover.setModel(this._localUIModel);
		this._oPopover.bindElement(sPath);
		// delay because addDependent will do a async rerendering and the actionSheet will immediately close without it.
		jQuery.sap.delayedCall(0, this, function () {
			this._oPopover.openBy(oObjectHeader);
		});

		
	},

	onMoveRequestUp : function(oEvent){
		var oRequest = projectX.util.Helper.getBoundObjectForItem(oEvent.getSource(), "localUIModel");
		this._moveSelectedRequest(oRequest, projectX.util.Helper.moveArrayElementUp);
	},

	onMoveRequestDown : function(oEvent){
		var oRequest = projectX.util.Helper.getBoundObjectForItem(oEvent.getSource(), "localUIModel");
		this._moveSelectedRequest(oRequest, projectX.util.Helper.moveArrayElementDown);
	},

	/**
	 * called from the name input control when the name changes.
	 * after a delay triggers the updating of the master list to show the new name.
	 */
	onNameChanged : function() {	
		this.triggerWithInputDelay(function() {
			this.updateMasterList();
		});
	},
	
	onEditRequest : function(oEvent){
		var oRequest = projectX.util.Helper.getBoundObjectForItem(oEvent.getSource(), "localUIModel");
		this.navToRequest(oRequest.getIdentifier(), this._oProject.getIdentifier());
	},
	
	onButtonPreRequestScriptExamples : function(oEvent) {
		var oButton = oEvent.getSource();
		var oMenu = this.getView().byId("idMenuPreRequestScriptExamples");
		var eDock = sap.ui.core.Popup.Dock;
		oMenu.open(false, oButton, eDock.BeginTop, eDock.BeginBottom, oButton);
	},

	onMenuItemPreRequestScriptExampleSelected : function(oEvent) {
		var oItem = oEvent.getParameter("item");
		var oScriptExample = oItem.getBindingContext("localUIModel").getObject();
		var sScript = this._oSequence.getPreSequenceScript();
		sScript += "\n" + oScriptExample.script;
		this._oSequence.setPreSequenceScript(sScript);
		this._localUIModel.updateBindings();
	},
	
	onPanelPreSequenceScriptExpand : function(){
		var oScriptEditor = this.getView().byId("superEditorPreSequenceScript");
		oScriptEditor.rerender();
	},

	// /////////////////////////////////////////////////////////////////////////////
	// /// Private Methods
	// /////////////////////////////////////////////////////////////////////////////

	_moveSelectedRequest : function(oRequest, fMove) {
		var aArray = this._localUIModel.getProperty("/selectedRequests");
		//reorder the array of selected requests
		fMove(aArray, oRequest);
		this._localUIModel.setProperty("/selectedRequests", aArray);
		//save the new order to the sequence object
		this._oSequence.addRequestIds(this._localUIModel.getProperty("/selectedRequests"));
	},

	/**
	* use recursion to go through the request and execute them one by one.
	* @param  {int} iIndex    the index of the request to execute next
	* @param  {array} aRequests array of all requests to execute one after another
	* @param  {object} oSequenceStorage object that holds data for the run of the storage. 
	*                                  every request has access to this storage object.
	*/
	_executeRequests : function(oProject, iIndex, aRequests, oSequenceStorage) {
		var that = this;
		if (aRequests.length <= iIndex){
			//abort
			this._setRunning(false);
			return;
		}

		//execute the request
		var oRequest = aRequests[iIndex];
		var oDeferred = oRequest.execute(oProject, aRequests[iIndex - 1], oSequenceStorage);
		//add hanlder that gets called once the request finishes
		oDeferred.always(function() {
			oRequest.checkAssertions();			
			//update bindings so that the status will be displayed
			that._localUIModel.updateBindings(false);

			//check if we have to abort the sequence if the assertions failed
			if (that._oSequence.getAbortOnFailedAssertion() 
					&& oRequest.getAssertionsResult() === false) {
				that._bAbortSequence = true;
				sap.m.MessageBox.alert("Error in request assertion. Sequence aborted!");
			}
			//check if we have to abort the sequence if one of the tests failed
			if (that._oSequence.getAbortOnFailedAssertion() 
					&& oRequest.getTestScriptSuccess() === false) {
				that._bAbortSequence = true;
				sap.m.MessageBox.alert("Error in request test script. Sequence aborted!");
			}

			if (that._bAbortSequence === true){
				that._bAbortSequence = false;
				that._setRunning(false);
				return;
			}

			that._executeRequests(oProject, iIndex + 1, aRequests, oSequenceStorage);
		});
	},

	/**
	* set the ui bindings to "test is running" or "test is not running".
	* used to change visibilites on the UI.
	* @param {boolean} bIsRunning state of test running
	*/
	_setRunning : function(bIsRunning) {
		this._localUIModel.setProperty("/testRunning", bIsRunning);
		this._localUIModel.setProperty("/testNotRunning", !bIsRunning);
	},

	_getRunning : function() {
		return this._localUIModel.getProperty("/testRunning");
	}

});
