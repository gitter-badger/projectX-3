jQuery.sap.require("projectX.util.Project");
jQuery.sap.require("projectX.util.Request");
jQuery.sap.require("projectX.util.Controller");
jQuery.sap.require("projectX.util.Helper");



projectX.util.Controller.extend("projectX.view.Sequence.Sequence", {

	_localProjectModel : undefined,
	_sReason : null,
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
			testNotRunning : true
		});
		this.getView().setModel(this._localUIModel, "localUIModel");

		//hook navigation event
		this.getRouter().getRoute("sequence").attachPatternMatched(this.onRouteMatched, this);
	},

	onRouteMatched : function(oEvent) {
		var oParameters = oEvent.getParameters();
		var iSequenceId = parseInt(oParameters.arguments.sequenceID, 10);
		var sReason = oParameters.arguments.reason;
		this._sReason = sReason;
		var oModel = this.getView().getModel();
		var oSelectedProject = oModel.getProperty("/SelectedProject");

		//user wants to edit the currently selected model
		var oSelectedSequence = oSelectedProject.getSequenceByIdentifier(iSequenceId);
		if (!oSelectedSequence) {
			return;
		}

		this._oSequence = oSelectedSequence;
		this._oProject = oSelectedProject;
		//set data from selected sequence into local project model
		this._localUIModel.setProperty("/sequence", this._oSequence);
		//set helper values to modify the page between edit and new
		this._localUIModel.setProperty("/reasonNew", false);
		this._localUIModel.setProperty("/reasonEdit", true);
		this._localUIModel.setProperty("/reason", "Edit sequence");
		this._setSelectedRequests();


		//add list of requests to local ui model
		this._localUIModel.setProperty("/requests", oSelectedProject.getRequests());
	},
	
	_setSelectedRequests : function() {
		//get requests for requestIds and set to local ui model
		var aSelectedRequests = [];
		var aRequestIds = this._oSequence.getRequestIds();
		for (var i = 0; i < aRequestIds.length; i++) {
			var oRequest = this._oProject.getRequestByIdentifier(aRequestIds[i]);
			//create deep copy of request because in testrun the same
			//request can be executed multiple times
			if (oRequest) {
				var oRequestCopy = new projectX.util.Request(oRequest.serialize());
				aSelectedRequests.push(oRequestCopy);
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
			oRequest = new projectX.util.Request(oRequest.serialize());
			aSelectedRequests.push(oRequest);
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
		jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), oRequestSelectDialog);
		oRequestSelectDialog.open();
	},
	
	onBtnRemoveRequests : function(oEvent) {
		var oTable = this.getView().byId("idSelectedRequestsTable");
		var aSelectedItems = oTable.getSelectedItems();
		if (!aSelectedItems || aSelectedItems.length <= 0){
			return;
		}

		var oSequence =  this._localUIModel.getProperty("/sequence");
		for (var i = 0; i < aSelectedItems.length; i++) {
			var oRequest = projectX.util.Helper.getBoundObjectForItem(aSelectedItems[i], "localUIModel");			
			oSequence.removeRequest(oRequest);
		}
		oTable.removeSelections(true);
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
		//TODO create deep copy of single requests
		//maybe on entering the screen

		//clear existing results
		this.onClearResults();

		this._setRunning(true);
		this._executeRequests(this._oProject, 0, aRequests);
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

	/**
	* the user clicked on the title of a specific request.
	* expand the item to show the results of the request.
	*/
	onRequestNamePress : function (oEvent) {
		var oObjectHeader = oEvent.getSource();
		var oColumnListItem = oObjectHeader.getParent(); //the columListItem control
		oColumnListItem.toggleStyleClass("columnListItemExpanded");
	},

	onMoveRequestUp : function(){
		this._moveSelectedListItem(projectX.util.Helper.moveArrayElementUp);
	},

	onMoveRequestDown : function(){
		this._moveSelectedListItem(projectX.util.Helper.moveArrayElementDown);
	},

	onBtnDeletePress : function() {
		var oModel = this.getView().getModel();
		var oSelectedProject = oModel.getProperty("/SelectedProject");
		oSelectedProject.removeSequence(this._oSequence);
		oModel.updateBindings();
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

	// /////////////////////////////////////////////////////////////////////////////
	// /// Private Methods
	// /////////////////////////////////////////////////////////////////////////////

	_moveSelectedListItem : function(fMove) {
		//get the selected item
		var oList = this.getView().byId("idListSelectedRequests");
		var oSelectedItem = oList.getSelectedItem();
		if (!oSelectedItem){
			return;
		}
		var oSelectedObject = projectX.util.Helper.getBoundObjectForItem(oSelectedItem, "localUIModel");
		var aArray = this._localUIModel.getProperty("/selectedRequests");

		var iNewPos = fMove(aArray, oSelectedObject);
		this._localUIModel.setProperty("/selectedRequests", aArray);

		//restore the selection
		var aItems = oList.getItems();
		oList.setSelectedItem(aItems[iNewPos]);
	},

	/**
	* use recursion to go through the request and execute them one by one.
	* @param  {int} iIndex    the index of the request to execute next
	* @param  {array} aRequests array of all requests to execute one after another
	*/
	_executeRequests : function(oProject, iIndex, aRequests) {
		var that = this;
		if (aRequests.length <= iIndex){
			//abort
			this._setRunning(false);
			return;
		}

		//execute the request
		var oRequest = aRequests[iIndex];
		var oDeferred = oRequest.execute(oProject, aRequests[iIndex - 1]);
		//add hanlder that gets called once the request finishes
		oDeferred.always(function() {
			oRequest.checkAssertions();
			//update bindings so that the status will be displayed
			that._localUIModel.updateBindings(false);

			if (that._bAbortSequence === true){
				that._bAbortSequence = false;
				that._setRunning(false);
				return;
			}

			that._executeRequests(oProject, iIndex + 1, aRequests);
			//TODO add positiliy to abort on failure
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
