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
	'CameraControls',
	'PubSub',
	'SplitView',
	'uimap',
	'jquery'
],
function (Constants, Camera, Renderer, AssetManager, ModelInstance, Scene, SearchController,
		  ArchitectureGenerator, Manipulators, UndoStack, Toolbar, CameraControls, PubSub, SplitView, uimap)
{
    // support function should be factored out...?
    function mapTable(table, perField) {
        var result = {};
        for(var key in table)
            result[key] = perField(key, table[key]);
        return result;
    }

    function UIState(gl)
    {
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

        this.isBusy = false;
    }

    function App(canvas)
    {
		// Extend PubSub
		PubSub.call(this);
		
        this.canvas = canvas;
        
        // the following variables from globalViewData
        // should be rendered by the jade template
        this.user_name  = window.globalViewData.user_name;
        this.scene_name = window.globalViewData.scene_name;
        this.close_url  = window.globalViewData.close_url;
        
        this.uimap = uimap.create(canvas);

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
		this.cameraControls = new CameraControls(this);
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
        this.LoadScene(this.scene_name,
        function() { // on failure create an empty room
            this.assman.GetModel('room', function (model)
            {
                this.scene.Reset(new ModelInstance(model, null));
				this.camera.SaveStateForReset();
				this.camera.UpdateSceneBounds(this.scene.Bounds());
                this.undoStack.clear();
                this.renderer.postRedisplay();
            } .bind(this));
        }.bind(this),
        function() { // on success finish up some setup
			this.camera.SaveStateForReset();
			this.camera.UpdateSceneBounds(this.scene.Bounds());
            this.undoStack.clear();
            this.renderer.postRedisplay();
        }.bind(this));
		
        
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
        // Try to prevent accidental navigation away from app
        window.onbeforeunload = function(e) {
            return 'If you leave this page, you may lose unsaved work!'
        }
        
        /*** Behaviors are specified here ***/

        // Keeping track of what object is under the mouse cursor
        // while the mouse is idly moving across the screen.
        this.uimap.mousehover('none', function (data)
        {
            if (!this.uistate.insertInstance)
                this.UpdateFocusedObject(data);
        } .bind(this));

        // orbiting rotation
        var orbiting_behavior = {
            start: function (data) { },
            drag: function (data)
            {
                this.camera.OrbitLeft(-data.dx * Constants.cameraOrbitSpeed);
                this.camera.OrbitUp(data.dy * Constants.cameraOrbitSpeed);
                this.UpdateView();
            } .bind(this),
            finish: function (data) { }
        };
        this.uimap.mousedrag('right', orbiting_behavior);

        // dollying
        var dollying_behavior = {
            start: function (data) { },
            drag: function (data)
            {
                this.camera.DollyLeft(data.dx * Constants.cameraDollySpeed);
                this.camera.DollyUp(data.dy * Constants.cameraDollySpeed);
                this.UpdateView();
            } .bind(this),
            finish: function (data) { }
        };
        this.uimap.mousedrag('middle, shift+right',
                             dollying_behavior);

        // interactions with 3d objects in the scene (instances, manipulators)
        var interacting_behavior = {
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
        };
        this.uimap.mousedrag('left', interacting_behavior);

        // model insertion IDEALLY THIS WOULD BE A SINGLE REGISTERED BEHAVIOR
        this.uimap.mousepress('left', function ()
        {
            if (this.uistate.insertInstance)
            {
                this.FinishModelInsertion();
            }
        } .bind(this));
        this.uimap.mousehover('none', function (data)
        {
            if (this.uistate.insertInstance)
                this.ContinueModelInsertion(data.x, data.y);
        } .bind(this));

		// mouse wheel scrolls
        addWheelHandler(this.canvas, this.MouseWheel.bind(this));
        
        // some support functions
        var ensureInstance = function(toWrap) {
            var helper = function(opts) {
                if(this.uistate.insertInstance) {
                    opts.instance = this.uistate.insertInstance;
                } else if(this.uistate.selectedInstance) {
                    opts.instance = this.uistate.selectedInstance;
                    opts.saveUndo = true;
                } else {
                    return false;
                }
                return true;
            }.bind(this);
            if($.isFunction(toWrap)) {
                return function(opts) {
                    if(helper(opts))
                        toWrap(opts);
                };
            } else  {
                return mapTable(toWrap, function(key, callback) {
                    return function(opts) {
                        if(helper(opts))
                            callback(opts);
                    };
                });
            }
        }.bind(this);
        
        // Keyboard Rotate/Scale
        var rotateIncrement = Constants.keyboardRotationIncrementUnmodified;
        var scaleIncrement  = Constants.keyboardScaleFactorUnmodified;
        var rotate_left_behavior = ensureInstance({
            hold: function(opts) {
                opts.instance.CascadingRotate(rotateIncrement);
            },
            finish: function(opts) {
                if(opts.saveUndo) 
                    this.undoStack.pushCurrentState(UndoStack.CMDTYPE.ROTATE,
                                                    opts.instance);
            }.bind(this)
        });
        this.uimap.keyhold('left', rotate_left_behavior);
        var rotate_right_behavior = ensureInstance({
            hold: function(opts) {
                opts.instance.CascadingRotate(-rotateIncrement);
            },
            finish: function(opts) {
                if(opts.saveUndo) 
                    this.undoStack.pushCurrentState(UndoStack.CMDTYPE.ROTATE,
                                                    opts.instance);
            }.bind(this)
        });
        this.uimap.keyhold('right', rotate_right_behavior);
        var scale_up_behavior = ensureInstance({
            hold: function(opts) {
                opts.instance.CascadingScale(scaleIncrement);
            },
            finish: function(opts) {
                if(opts.saveUndo) 
                    this.undoStack.pushCurrentState(UndoStack.CMDTYPE.SCALE,
                                                    opts.instance);
            }.bind(this)
        });
        this.uimap.keyhold('up', scale_up_behavior);
        var scale_down_behavior = ensureInstance({
            hold: function(opts) {
                opts.instance.CascadingScale(1.0 / scaleIncrement);
            },
            finish: function(opts) {
                if(opts.saveUndo) 
                    this.undoStack.pushCurrentState(UndoStack.CMDTYPE.SCALE,
                                                    opts.instance);
            }.bind(this)
        });
        this.uimap.keyhold('down', scale_down_behavior);
        
        // Keyboard Tumble
        this.uimap.keyhold('M', ensureInstance({
            hold: function(opts) {
                this.Tumble(opts.instance, false);
            }.bind(this),
            finish: function(opts) {
                if(opts.saveUndo) 
                    this.undoStack.pushCurrentState(
                        UndoStack.CMDTYPE.SWITCHFACE, opts.instance);
            }.bind(this)
        }));
        
        // Copy/Paste
        this.uimap.keypress('C', function() {
            this.Copy();
        }.bind(this));
        this.uimap.keypress('V', function(opts) {
            this.Paste(opts);
        }.bind(this));
        // Undo/Redo
        this.uimap.keypress('Z', function() {
            this.CancelModelInsertion();
            this.Undo();
        }.bind(this));
        this.uimap.keypress('Y', function() {
            this.CancelModelInsertion();
            this.Redo();
        }.bind(this));
        // Save
        this.uimap.keypress('S', function() {
            this.SaveScene();
        }.bind(this));
        
        // Delete object, Escape selection
        this.uimap.keypress('delete, backspace', function() {
            this.Delete();
        }.bind(this));
        this.uimap.keypress('escape', function() {
            this.CancelModelInsertion();
            this.SelectInstance(null);
        }.bind(this));
        
        // open dialog
        this.uimap.keypress('Q', function() {
            this.architectureGenerator.openDialog();
        }.bind(this));
        
        // debug which instance is currently being manipulated
        this.uimap.keypress('X', ensureInstance(function(opts) {
            console.log(opts.instance.model.id);
        }));
        
        
        // ensure the scene re-renders on all key events
        this.uimap.allkeyupdates(function() {
            this.renderer.postRedisplay();
        }.bind(this));
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
    
    App.prototype.MouseWheel = function (dx, dy)
    {
        this.camera.Zoom(dy * Constants.cameraZoomSpeed);
        this.UpdateView();
    };
	
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
	
	App.prototype.Paste = function(opts)
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
			
			// Necessary to get the inserting model to show up
			// without having to move the mouse.
			// If no mouse position data is provided, then we
			// assume that we can wait until the mouse starts moving
            if(opts)
                this.ContinueModelInsertion(opts.x, opts.y);
        }
	}
    
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
	
	App.prototype.LoadScene = function(scene_name, on_failure, on_success)
	{
        $.get('/scenes/' + this.scene_name + '/load')
        .error(function() {
            on_failure();
        }.bind(this)).success(function(scene_json) {
            scene_json = JSON.parse(scene_json);
            this.scene.LoadFromNetworkSerialized(scene_json,
                                                 this.assman,
                                                 on_success);
        }.bind(this));
	}
	
	App.prototype.SaveScene = function(on_success, on_error)
	{
        on_success = on_success || function() {
            alert('saved!  Please develop a better UI alert');
        };
        on_error = on_error || function() {
            alert('did not save!  Please develop a better UI alert');
        };
        var serialized = this.scene.SerializeForNetwork();
        $.ajax({
            type: 'POST',
            url: '/scenes/' +
                 this.user_name +
                 '/' +
                 this.scene_name +
                 '/save',
            data: {
                scene_file: JSON.stringify(serialized),
            },
            dataType: 'json',
            timeout: 10000,
        }).error(on_error).success(on_success);
	}
    
    App.prototype.ExitTo = function(destination)
    {
        this.SaveScene(function() {
            window.onbeforeunload = null;
            window.location.href = this.close_url;
        }.bind(this)); // should add dialog to ask if the user wants to leave
        // even though nothing was saved in event of error
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