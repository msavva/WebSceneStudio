'use strict';

define([
	'Constants',
	'Camera',
	'Renderer',
	'AssetManager',
	'ModelInstance',
	'Scene',
	'SearchController',
    'ArchitectureGenerator',
	'Manipulators',
    'UndoStack',
	'Toolbar',
	'PubSub',
	'SplitView',
	'uimap',
	'jquery'
],
function (Constants, Camera, Renderer, AssetManager, ModelInstance, Scene, SearchController,
		  ArchitectureGenerator, Manipulators, UndoStack, Toolbar, PubSub, SplitView, uimap)
{

    function UIState(gl)
    {
        // Mouse state
        this.mouseButtonsDown = [false, false, false];
        this.mousePrevX = -1;
        this.mousePrevY = -1;
        this.moveSelectedX = -1;
        this.moveSelectedY = -1;

        // Keeping track of which object will be manipulated during
        // mouse interactions. This is the object that is under the mouse
        // cursor--or, if an interaction is in progress, this is the object
        // that has focus for that interaction.
        this.focusedObject = null;

        // Model insertion
        this.insertInstance = null;

        // Model selection
        this.selectedInstance = null;

        // Model copying/pasting
        this.copyInstance = null;
        this.copying = false;
        this.pasting = false;
		
		// Undo/redo
		this.undoRedoing = false;
		this.undoRedoWhich = null;

        this.isBusy = false;
    }

    function App(canvas)
    {
		// Extend PubSub
		PubSub.call(this);
		
        this.canvas = canvas;

        this.camera = new Camera();
        var cameraData = JSON.parse("{\"eyePos\":{\"0\":3.776055335998535,\"1\":-187.77793884277344,\"2\":164.77069091796875,\"buffer\":{\"byteLength\":12},\"length\":3,\"byteOffset\":0,\"byteLength\":12},\"lookAtPoint\":{\"0\":0,\"1\":1,\"2\":0,\"buffer\":{\"byteLength\":12},\"length\":3,\"byteOffset\":0,\"byteLength\":12},\"upVec\":{\"0\":-0.01314918976277113,\"1\":0.6573730707168579,\"2\":0.7534525990486145,\"buffer\":{\"byteLength\":12},\"length\":3,\"byteOffset\":0,\"byteLength\":12},\"lookVec\":{\"0\":-0.015068011358380318,\"1\":0.7533015012741089,\"2\":-0.6575027108192444,\"buffer\":{\"byteLength\":12},\"length\":3,\"byteOffset\":0,\"byteLength\":12},\"leftVec\":{\"0\":-0.9998010993003845,\"1\":-0.019998691976070404,\"2\":0,\"buffer\":{\"byteLength\":12},\"length\":3,\"byteOffset\":0,\"byteLength\":12}}");
        $.extend(this.camera, cameraData);

        this.scene = new Scene();
        this.renderer = new Renderer(canvas, this.scene);
        this.assman = new AssetManager(this.renderer.gl_);
		this.uistate = new UIState(this.renderer.gl_);

        preventSelection(this.canvas);

        this.scene.AddManipulator(new Manipulators.RotationManipulator(this.renderer.gl_));
		this.scene.AddManipulator(new Manipulators.ScaleManipulator(this.renderer.gl_));

        this.AttachEventHandlers();

		this.undoStack = new UndoStack.UndoStack(this, Constants.undoStackMaxSize);
		this.toolbar = new Toolbar(this);
        this.searchController = new SearchController(this);
        this.architectureGenerator = new ArchitectureGenerator(this);
		
		SplitView.MakeSplitView({
			leftElem: $('#graphicsOverlay'),
			rightElem: $('#searchArea'),
			rightMinWidth: Constants.searchAreaMinWidth,
			rightMaxWidth: Constants.searchAreaMaxWidth,
			snapToGrid: Constants.searchAreaResizeGrid
		});
    }
	
	// Extend PubSub
	App.prototype = Object.create(PubSub.prototype);
	
    App.prototype.Launch = function ()
    {
        this.assman.GetModel('room', function (model)
        {
            this.scene.Reset(new ModelInstance(model, null));
            this.undoStack.clear();
            this.renderer.postRedisplay();
        } .bind(this));
		this.renderer.resizeEnd();
        this.UpdateView();
    };

    App.prototype.UpdateView = function ()
    {
        // While the view is changing, no object in the scene should have focus
        this.uistate.focusedObject && this.uistate.focusedObject.LoseFocus();
        this.uistate.focusedObject = null;

        this.renderer.view_ = this.camera.LookAtMatrix();
        mat4.multiply(this.renderer.proj_, this.renderer.view_, this.renderer.viewProj_);
        this.renderer.postRedisplay();
    };

    App.prototype.AttachEventHandlers = function ()
    {
        /*** Behaviors are specified here ***/

        // Keeping track of what object is under the mouse cursor
        // while the mouse is idly moving across the screen.
        uimap.mousehover('none', function (data)
        {
			this.uistate.mousePrevX = data.x;
			this.uistate.mousePrevY = data.y;
            if (!this.uistate.insertInstance)
                this.UpdateFocusedObject(data);
        } .bind(this));

        // orbiting rotation
        uimap.mousedrag('right, ctrl+left', {
            start: function (data) { },
            drag: function (data)
            {
                this.camera.OrbitLeft(-data.dx * Constants.cameraOrbitSpeed);
                this.camera.OrbitUp(data.dy * Constants.cameraOrbitSpeed);
                this.UpdateView();
            } .bind(this),
            finish: function (data) { }
        });

        // dollying
        uimap.mousedrag('middle, ctrl+right, ctrl+shift+left', {
            start: function (data) { },
            drag: function (data)
            {
                this.camera.DollyLeft(data.dx * Constants.cameraDollySpeed);
                this.camera.DollyUp(data.dy * Constants.cameraDollySpeed);
                this.UpdateView();
            } .bind(this),
            finish: function (data) { }
        });

        // interactions with 3d objects in the scene (instances, manipulators)
        uimap.mousedrag('left', {
            start: function (data)
            {
                // prevent other interaction while inserting
                if (this.uistate.insertInstance)
                    return false;
				
                // Now do stuff.
                this.renderer.postRedisplay();
                this.UpdateFocusedObject(data);
                if (!this.uistate.focusedObject)
                {
                    this.SelectInstance(null);
                    return false;
                }
                data.app = this;
                return this.uistate.focusedObject.BeginMouseInteract(data);
            } .bind(this),
            drag: function (data)
            {
                data.app = this;
                if (this.uistate.focusedObject.ContinueMouseInteract(data))
                    this.renderer.postRedisplay();
            } .bind(this),
            finish: function (data)
            {
                data.app = this;
                if (this.uistate.focusedObject.EndMouseInteract(data))
                    this.renderer.postRedisplay();
                this.UpdateFocusedObject(data);
            } .bind(this)
        });

        // model insertion IDEALLY THIS WOULD BE A SINGLE REGISTERED BEHAVIOR
        uimap.mousepress('left', function ()
        {
            if (this.uistate.insertInstance)
            {
                this.FinishModelInsertion();
            }
        } .bind(this));
        uimap.mousehover('none', function (data)
        {
            if (this.uistate.insertInstance)
                this.ContinueModelInsertion(data.x, data.y);
        } .bind(this));

		// mouse wheel scrolls
        addWheelHandler(this.canvas, this.MouseWheel.bind(this));

		// key presses
        $("body").keydown(
		function (event)
		{
		    if (this.KeyDown(event.which, event.ctrlKey, event.shiftKey, event.altKey))
				event.preventDefault();
		} .bind(this)
		);
        $("body").keyup(
		function (event)
		{
		    if (this.KeyUp(event.which, event.ctrlKey, event.shiftKey, event.altKey))
				event.preventDefault();
		} .bind(this)
		);
    };

    App.prototype.UpdateFocusedObject = function (data)
    {
        var oldobj = this.uistate.focusedObject;
        var newobj = this.renderer.picker.PickObject(data.x, data.y, this.renderer);
        var needsRedisplay = false;
        if (newobj !== oldobj)
        {
            needsRedisplay |= (oldobj && oldobj.LoseFocus(data));
            this.uistate.focusedObject = newobj;
            needsRedisplay |= (newobj && newobj.GainFocus(data));
        }
        newobj && newobj.Hover(data);
        if (needsRedisplay)
            this.renderer.postRedisplay();
    };

    App.prototype.ToggleBusy = function (isBusy)
    {
        this.uistate.isBusy = isBusy;
        if (isBusy)
            $('#ui').addClass('busy');
        else
            $('#ui').removeClass('busy');
    };

	// TODO: KeyUp and KeyDown really should be converted to unified 'behavior' specifications
	// a la UIMap at some point.
	
    App.prototype.KeyDown = function (which, ctrl, shift, alt)
    {
		var handled = true;
		
		var instanceToModify = null;
        if (this.uistate.insertInstance) instanceToModify = this.uistate.insertInstance;
        else if (this.uistate.selectedInstance) instanceToModify = this.uistate.selectedInstance;

        switch (which)
        {
            case 37: // left arrow key
				instanceToModify.CascadingRotate(Constants.keyboardRotationIncrementUnmodified);
                break;
            case 38: // up arrow key
				instanceToModify.CascadingScale(Constants.keyboardScaleFactorUnmodified);
                break;
            case 39: // right arrow key
                instanceToModify.CascadingRotate(-Constants.keyboardRotationIncrementUnmodified);
                break;
            case 40: // down arrow key
				instanceToModify.CascadingScale(1.0 / Constants.keyboardScaleFactorUnmodified);
                break;
            case 77: // M key
				this.Tumble(instanceToModify, false);
                break;
            case 67: // C key
                if (ctrl) this.BeginCopy();
                break;
            case 86: // V key
                if (ctrl) this.BeginPaste();
                break;
            case 90: // Z key
                if (ctrl) this.BeginUndoRedo('undo');
                break;
            case 89: // Y key
                if (ctrl) this.BeginUndoRedo('redo');
                break;
			default:
				handled = false;
				break;
        }

        this.renderer.postRedisplay();
		return handled;
    };

    App.prototype.KeyUp = function (which, ctrl, shift, alt)
    {
		var handled = true;
		
		var instanceToModify = null;
        var saveUndo = false;
        if (this.uistate.insertInstance) instanceToModify = this.uistate.insertInstance;
        else if (this.uistate.selectedInstance)
        {
            instanceToModify = this.uistate.selectedInstance;
            saveUndo = true;
        }

        switch (which)
        {
            case 27: // ESCAPE key
                this.CancelModelInsertion();
				this.SelectInstance(null);
                break;
            case 46: // DELETE key
                this.Delete();
                break;
            case 67: // C key
                this.EndCopy();
                break;
            case 86: // V key
                this.EndPaste();
                break;
            case 81: // Q key
                //console.log(JSON.stringify(this.camera, null));
                //this.architectureGenerator.Test();
                this.architectureGenerator.openDialog();
                break;
			case 90: // Z key
                this.EndUndoRedo();
                break;
            case 89: // Y key
                this.EndUndoRedo();
                break;
			case 37: case 39: // left/right arrow keys
				if (instanceToModify && saveUndo)
					this.undoStack.pushCurrentState(UndoStack.CMDTYPE.ROTATE, instanceToModify);
                break;
            case 38: case 40: // up/down arrow keys
				if (instanceToModify && saveUndo)
					this.undoStack.pushCurrentState(UndoStack.CMDTYPE.SCALE, instanceToModify);
                break;
			case 77: // M key
				if (instanceToModify && saveUndo)
					this.undoStack.pushCurrentState(UndoStack.CMDTYPE.SWITCHFACE, instanceToModify);
                break;
            case 88:
                if (instanceToModify)
                    console.log(instanceToModify.model.id);
                break;
            default:
				handled = false;
                break;
        }

        // Redisplay in case we've changed something
        this.renderer.postRedisplay();
		return handled;
    };

    App.prototype.MouseWheel = function (dx, dy)
    {
        this.camera.Zoom(dy * Constants.cameraZoomSpeed);
        this.UpdateView();
    };
	
	App.prototype.BeginUndoRedo = function(whichOp)
	{
		this.CancelModelInsertion();
		this.uistate.undoRedoing = true;
		this.uistate.undoRedoWhich = whichOp;
	}
	
	App.prototype.EndUndoRedo = function()
	{
		if (this.uistate.undoRedoWhich === 'undo')
			this.Undo();
		else if (this.uistate.undoRedoWhich === 'redo')
			this.Redo();
		this.uistate.undoRedoing = false;
	}
	
	App.prototype.Undo = function()
	{
		this.undoStack.undo();
		this.renderer.postRedisplay();
	}
	
	App.prototype.Redo = function()
	{
		this.undoStack.redo();
		this.renderer.postRedisplay();
	}

    App.prototype.BeginCopy = function ()
    {
        if (!this.uistate.copying)
        {
			this.Copy();
            this.uistate.copying = true;
        }
    };
	
	App.prototype.Copy = function()
	{
		if (this.uistate.selectedInstance)
        {
            // Clear the existing copied instance, if there is one.
            if (this.uistate.copyInstance)
                this.uistate.copyInstance.Remove();
            // Set up the new copied instance.
            this.uistate.copyInstance = this.uistate.selectedInstance.Clone();
			
			this.Publish('CopyCompleted');
		}
	}

    App.prototype.EndCopy = function ()
    {
        this.uistate.copying = false;
    };

    App.prototype.BeginPaste = function ()
    {
        if (!this.uistate.pasting)
        {
			this.Paste();
            this.uistate.pasting = true;
        }
    };
	
	App.prototype.Paste = function()
	{
		if (this.uistate.copyInstance)
        {
            this.CancelModelInsertion(); // In case anything else is being inserted.

            this.uistate.insertInstance = this.uistate.copyInstance.Clone();

            var hi = this.uistate.insertInstance;
            hi.renderState.isSelected = false;
            hi.renderState.isPickable = false;
            hi.renderState.isInserting = true;

            hi.SetParent(null);
			
			// Necessary to get the inserting model to show up without moving the mouse.
			this.ContinueModelInsertion(this.uistate.mousePrevX, this.uistate.mousePrevY);
        }
	}

    App.prototype.EndPaste = function ()
    {
        this.uistate.pasting = false;
    };
	
	App.prototype.Delete = function()
	{
		var selectedMinst = this.uistate.selectedInstance;
		if (selectedMinst)
		{
			this.RemoveModelInstance(selectedMinst);
			this.undoStack.pushCurrentState(UndoStack.CMDTYPE.DELETE, null);
		}
	}
	
	App.prototype.Tumble = function(mInst, doRecordUndoEvent)
	{
		mInst.Tumble();
		doRecordUndoEvent && this.undoStack.pushCurrentState(UndoStack.CMDTYPE.SWITCHFACE, mInst);
		this.renderer.postRedisplay();	
	}

    App.prototype.ToggleSuppressPickingOnSelectedInstance = function (toggle)
    {
        if (this.uistate.selectedInstance)
        {
            var wasPickable = this.uistate.selectedInstance.renderState.isPickable;
            this.uistate.selectedInstance.renderState.isPickable = !toggle;

            // If pickability changed ensure picking pass runs now to avoid out of sync pick buffer
            if (wasPickable !== this.uistate.selectedInstance.renderState.isPickable) this.renderer.pickingDrawPass();
        }
    };

    App.prototype.RemoveModelInstance = function (mInst)
    {
        mInst.Publish('Removed');
        mInst.Remove();
        this.scene.UpdateModelList();
        this.renderer.postRedisplay();
    };

    App.prototype.SelectInstance = function (mInst)
    {
        // Deselect the current selected instance
        var oldsi = this.uistate.selectedInstance;
        if (oldsi)
        {
            oldsi.Unsubscribe('Removed', this);
            oldsi.renderState.isSelected = false;
            this.uistate.selectedInstance = null;
            this.scene.DetachManipulators();
        }

        // Select the new one
        if (mInst)
        {
            mInst.Subscribe('Removed', this, function ()
            {
                this.SelectInstance(null);
            });
            mInst.renderState.isSelected = true;
            this.uistate.selectedInstance = mInst;
            this.scene.AttachManipulators(mInst);
        }
		this.Publish('SelectedInstanceChanged', oldsi, mInst);
    };

    App.prototype.PickTriangle = function (x, y)
    {
        return this.renderer.picker.PickTriangle(x, y, this.camera, this.renderer);
    };

    App.prototype.BeginModelInsertion = function (modelid, callback)
    {
        // If there is an existing insert instance (meaning, we were already in
        // model insertion mode), then clear this hoverinstance and release
        // the previous model
        this.CancelModelInsertion();

        // Clear the current selection (gets rid of widgets, etc.)
        this.SelectInstance(null);

        // Now, fetch the new model, and when it is ready, set the new insert instance.
        // Don't forget to call back into the Search widget so that things can be updated
        // appropriately.
        this.assman.GetModel(modelid, function (model)
        {
            this.uistate.insertInstance = new ModelInstance(model, null);
            var hi = this.uistate.insertInstance;
            hi.renderState.isPickable = false;
            hi.renderState.isInserting = true;
            hi.SetReasonableScale(this.scene);
            this.renderer.postRedisplay();
            callback();
        } .bind(this));
    };

    App.prototype.ContinueModelInsertion = function (x, y)
    {
        var hi = this.uistate.insertInstance;
        var intersect = this.PickTriangle(x, y);
        if (intersect)
        {
            intersect.inst = this.scene.IndexToObject(intersect.modelID);
            hi.UpdateStateFromRayIntersection(intersect);
        }
        else
        {
            hi.SetParent(null);
        }
        this.scene.UpdateModelList();
        this.renderer.postRedisplay();
    };

    App.prototype.CancelModelInsertion = function ()
    {
        var hi = this.uistate.insertInstance;
        if (hi)
        {
            this.searchController.ResultDeselected(hi.model.id);
            this.RemoveModelInstance(hi);
            this.uistate.insertInstance = null;
            this.renderer.postRedisplay();
        }
    };

    App.prototype.FinishModelInsertion = function ()
    {
        var hi = this.uistate.insertInstance;

        // If the click happened while the mouse was over empty space (and thus the insert instance
        // has no parent), treat this the same as canceling the insert.
        if (!hi.parent)
        {
            this.CancelModelInsertion();
        }
        else
        // Otherwise, leave the model in the scene and clean up.
        {
            this.searchController.ResultDeselected(hi.model.id);
            hi.renderState.isPickable = true;
            hi.renderState.isInserting = false;
            this.uistate.insertInstance = null;

			this.SelectInstance(hi);
            this.undoStack.pushCurrentState(UndoStack.CMDTYPE.INSERT, hi);
            this.renderer.postRedisplay();
        }
    };

    // Exports
    return App;

});