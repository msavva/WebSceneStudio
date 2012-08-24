'use strict';

define([
	'Constants',
	'PubSub',
	'UndoStack',
	'gl-matrix',
	'gl-matrix-ext',
    'msgpack'
],
function(Constants, PubSub, UndoStack){

function ModelInstance(model, parentInst)
{
	// EXTEND PUBSUB: Call PubSub constructor
	PubSub.call(this);
	
	this.index = -1;

	// Model
	this.model = model;
	
	// Hierarchy information
	this.SetParent(parentInst);
	this.children = [];
	
	// Transform information
	this.parentMeshI = -1;
	this.parentTriI = -1;
	this.parentUV = new Float32Array([0, 0]);
	this.cubeFace = 0;
	this.scale = 1.0;
	this.rotation = 0.0;
	this.parentPos = vec3.create();
	this.parentNormal = vec3.create();
	this.transform = mat4.identity(mat4.create());
	this.normalTransform = mat4.identity(mat4.create());
	
	// UI status
	this.renderState = {
		isPickable: true,
		isInserting: false,
		isSelected: false,
		isSelectable: true
	};
	
	// Manipulation state
	this.manipState = {
		moveX: -1,
		moveY: -1,
		isInteracting: false
	}
}

// EXTEND PUBSUB: Inherit PubSub prototype
ModelInstance.prototype = Object.create(PubSub.prototype);

ModelInstance.prototype.Serialize = function()
{
	// Save special members
	var modelID = this.model.id;
	var oldParent = this.parent;
	var oldModel = this.model;
	var oldChildren = this.children;
    var oldSubscribers = this.subscribers;
	
	// Remove special members
	this.parent = null;
	this.model = null;
	this.children = [];
    this.subscribers = {};
	
	// Pack into bytes
	var bytes = msgpack.pack(this);
	
	// Restore special members
	this.parent = oldParent;
	this.model = oldModel;
	this.children = oldChildren;
    this.subscribers = oldSubscribers;
	
	// Create packed object, store parent index
	var packedMinst = {bytes: bytes, modelID: modelID, parentIndex: -1};
	if (this.parent) packedMinst.parentIndex = this.parent.index;
	
	return packedMinst;
};

/**
 * Deserializes ModelInstance. Note that transform and parent/children instances need to be re-instated by caller.
 * Optional argument modelMap to get stored Model objects instead of calling AssetManager assman to retrieve them again
 **/
ModelInstance.Deserialize = function(packedMinst, assman, modelMap)
{
    // If modelMap was not given, retrieve model from AssMan
    var model;
    if (!modelMap)
    {
        assman.GetModel(packedMinst.modelID, function(m) { model = m; }.bind(this)); // TODO: Dangerous! Handle this in a proper asynchronous style
    }
    else // Else get stored model from modelMap
    {
        model = modelMap[packedMinst.modelID];
    }
	
	// Unpack serialized bytes, create new ModelInstance with model and copy over basic fields
	var unpacked = msgpack.unpack(packedMinst.bytes);
	var newMinst = new ModelInstance(model, null);
	newMinst.index = unpacked.index;
	newMinst.parentMeshI = unpacked.parentMeshI;
	newMinst.parentTriI = unpacked.parentTriI;
	newMinst.parentUV = new Float32Array(unpacked.parentUV);
	newMinst.cubeFace = unpacked.cubeFace;
	newMinst.scale = unpacked.scale;
	newMinst.rotation = unpacked.rotation
	
	// Copy over parent index. Actual model will need to be re-instated at a later time
	// by the logic that has requested deserialization
	newMinst.parentIndex = packedMinst.parentIndex;
	
	return newMinst;
};

ModelInstance.prototype.Clone = function()
{	
	var newMinst = new ModelInstance(this.model, null);
	newMinst.parentMeshI = this.parentMeshI;
	newMinst.parentTriI = this.parentTriI;
	newMinst.parentUV = new Float32Array(this.parentUV);
	newMinst.cubeFace = this.cubeFace;
	newMinst.scale = this.scale;
	newMinst.rotation = this.rotation;
	newMinst.UpdateTransform();
	
	for (var iChild = 0; iChild < this.children.length; iChild++)
	{
		var child = this.children[iChild];
		var newChild = child.Clone();
		newChild.SetParent(newMinst);
		newChild.UpdateTransform();
	}
	
	return newMinst;
};

ModelInstance.prototype.Remove = function()
{
	this.children.forEach(
		function(child)
		{
			child.Remove();
		}
	);
	this.SetParent(null);
};

// TODO: Make this work correctly for objects whose upright orientation
// is different from their parent.
ModelInstance.prototype.CascadingRotate = function (rotate)
{
    this.rotation += rotate;
    this.UpdateTransform();

    this.children.forEach(
		function (mInst)
		{
		    mInst.CascadingRotate(rotate);
		}
	);
};

ModelInstance.prototype.CascadingScale = function (scale)
{
    this.scale *= scale;
    this.UpdateTransform();
	
	this.Publish('Scaled');

    this.children.forEach(
		function (mInst)
		{
		    mInst.CascadingScale(scale);
		}
	);
};

ModelInstance.prototype.SetReasonableScale = function (scene)
{
    var sceneSize = vec3.length(scene.root.model.bbox.Dimensions());
    var mySize = vec3.length(this.model.bbox.Dimensions());

    this.scale = 1.0;
    if (mySize < 0.05 * sceneSize)
    {
        this.scale = 0.05 * sceneSize / mySize;
    }
    if (mySize > 0.25 * sceneSize)
    {
        this.scale = 0.25 * sceneSize / mySize;
    }
};

ModelInstance.prototype.SetParent = function(parInst)
{
	// You cannot be your own parent
	if (this === parInst)
	{
		throw new Error('ModelInstance.SetParent: an instance cannot be its own parent.');
	}
	
	// Remove from current parent
	var p = this.parent;
	if (this.parent)
	{
		var idx = $.inArray(this, p.children);
		if (idx >= 0) p.children.splice(idx, 1);
	}
	// Add to new parent
	this.parent = parInst;
	if (parInst)
		parInst.children.push(this);
};

ModelInstance.prototype.UpdateStateFromRayIntersection = function(isect)
{
	this.SetParent(isect.inst);
	this.parentMeshI = isect.geoID;
	this.parentTriI = isect.triI;
	this.parentUV = isect.uv;
	this.UpdateTransformCascading();
	this.Publish('Moved');
};

ModelInstance.prototype.BaseCentroid = function()
{
	var bcent = vec3.create([0, 0, 0]);
	var xform = mat4.identity(mat4.create());
	this.SecondTransform(xform);
	mat4.multiplyVec3(xform, bcent);
	return bcent;
};

// Radius of the bounding circle in the plane of the
// supporting surface
ModelInstance.prototype.ProjectedBoundingRadius = function()
{
	var bbox = this.model.bbox;
	var xform = mat4.identity(mat4.create());
	this.FirstTransform(xform);
	bbox = bbox.Transform(xform);
	var dims = bbox.Dimensions();
	var x = dims[0]/2;
	var y = dims[1]/2;
	return Math.sqrt(x*x + y*y);
};

ModelInstance.prototype.UpdateTransformCascading = function ()
{
    this.UpdateTransform();
    this.children.forEach(
		function (mInst)
		{
		    mInst.UpdateTransformCascading();
		}
	);
};

ModelInstance.prototype.UpdateTransform = function ()
{
    if (!this.parent) return;

    this.transform = mat4.identity(mat4.create());
	
	this.FirstTransform(this.transform);
	this.SecondTransform(this.transform);

    // Update inverse transpose
    mat4.toRotationMat(this.transform, this.normalTransform);
};

// Make the object upright and sitting at the origin
ModelInstance.prototype.FirstTransform = function(xform)
{	
	// Translate centroid to origin
    var bbox = this.model.bbox;
    var center = bbox.Centroid();
    vec3.negate(center);
    mat4.translate(xform, center);

    // Orient toward proper cube face so that up is positive Z
    var axis;
    if (this.cubeFace == 0) axis = vec3.createFrom(0.0, 0.0, 1.0);
    if (this.cubeFace == 1) axis = vec3.createFrom(1.0, 0.0, 0.0);
    if (this.cubeFace == 2) axis = vec3.createFrom(0.0, 1.0, 0.0);
    if (this.cubeFace == 3) axis = vec3.createFrom(0.0, 0.0, -1.0);
    if (this.cubeFace == 4) axis = vec3.createFrom(-1.0, 0.0, 0.0);
    if (this.cubeFace == 5) axis = vec3.createFrom(0.0, -1.0, 0.0);

    // Translate bottom center to origin
    var d = this.model.bbox.Dimensions();
    d[0] *= axis[0] * 0.5; d[1] *= axis[1] * 0.5; d[2] *= axis[2] * 0.5;

    var translateToCenterMatrix = mat4.identity(mat4.create());
    mat4.translate(translateToCenterMatrix, d);
    mat4.multiply(translateToCenterMatrix, xform, xform);

    var faceZ = mat4.identity(mat4.create());
    mat4.face(axis, vec3.createFrom(0.0, 0.0, 1.0), faceZ);
    mat4.multiply(faceZ, xform, xform);
	
	// Scale
    var scaleMatrix = mat4.identity(mat4.create());
    mat4.scale(scaleMatrix, vec3.createFrom(this.scale, this.scale, this.scale));
    mat4.multiply(scaleMatrix, xform, xform);
};

// Scale, orient, rotate, and place the object in its final configuration
ModelInstance.prototype.SecondTransform = function(xform)
{
	// rotate about the up vector
    var zRotateMatrix = mat4.identity(mat4.create());
    mat4.rotateZ(zRotateMatrix, this.rotation);
    mat4.multiply(zRotateMatrix, xform, xform);

    var anchorInfo = this.parent.EvaluateSurface(this.parentMeshI, this.parentTriI, this.parentUV);
    this.parentPos = anchorInfo.position;
    this.parentNormal = anchorInfo.normal;

    // Align z with parent normal
    var faceNormal = mat4.identity(mat4.create());
    mat4.face(vec3.createFrom(0.0, 0.0, 1.0), anchorInfo.normal, faceNormal);
    mat4.multiply(faceNormal, xform, xform);

    // Translate to anchor position (+ small z offset to avoid coplanarity)
	var offset = vec3.create(anchorInfo.normal);
	vec3.scale(offset, Constants.transformZoffset);
	vec3.add(offset, anchorInfo.position);
    var translateToAnchor = mat4.identity(mat4.create());
    mat4.translate(translateToAnchor, offset);
    mat4.multiply(translateToAnchor, xform, xform);
};

ModelInstance.prototype.CommonDrawSetup = function(renderer)
{
	var gl = renderer.gl_;

	mat4.multiply(renderer.viewProj_, this.transform, renderer.mvp_);
    gl.uniformMatrix4fv(renderer.activeProgram_.uniformLocs.u_mvp, false, renderer.mvp_);
    gl.uniformMatrix3fv(renderer.activeProgram_.uniformLocs.u_model, false,
                      mat4.toMat3(this.transform));
};

ModelInstance.prototype.Draw = function (renderer) {
    
	this.CommonDrawSetup(renderer);
    
	var opts = renderer.Options();
	opts.isInserting |= this.renderState.isInserting;
	this.model.Draw(renderer);
	
	// Recursively draw children
	this.children.forEach(
		function (mInst)
		{
			renderer.PushOptions();
			mInst.Draw(renderer);
			renderer.PopOptions();
		}
	);
};

ModelInstance.prototype.Pick = function (renderer)
{
	if (!this.renderState.isPickable) return;
	
	this.CommonDrawSetup(renderer);
	
	// Pass modelInstance id to model.Pick	
	this.model.Pick(renderer, this.index);
	
	// Recursively pick children
	this.children.forEach(
		function (mInst)
		{
			mInst.Pick(renderer);
		}
	);
};

ModelInstance.prototype.EvaluateSurface = function(meshI, triI, uv)
{
	var result = this.model.EvaluateSurface(meshI, triI, uv);
	mat4.multiplyVec3(this.transform, result.position);
	mat4.multiplyVec3(this.normalTransform, result.normal);
	return result;
};

ModelInstance.prototype.GainFocus = function(data)
{
	return false;
};

ModelInstance.prototype.Hover = function(data)
{
	return false;
};

ModelInstance.prototype.LoseFocus = function(data)
{
	return false;
};

ModelInstance.prototype.BeginMouseInteract = function(data)
{
	var app = data.app;
	
	// If this is a selectable instance, then proceed.
	// Else, kill the entire interaction right now.
	if (this.renderState.isSelectable)
		app.SelectInstance(this);
	else
	{
		app.SelectInstance(null);
		return false;
	}

	// Project the base centroid of the selected model instance
	// This now becomes the 'x, y' screen space point used for
	// picking a location for the object.
	var bc = this.BaseCentroid();
	var projc = app.renderer.ProjectVector(bc);
	this.manipState.moveX = projc[0];
	this.manipState.moveY = projc[1];
	this.manipState.isInteracting = false;

	// Hide the cursor while moves are happening
	$('#ui').addClass('hideCursor');
	
	return true;
};

ModelInstance.prototype.ContinueMouseInteract = function(data)
{
	var app = data.app;
	
	// Make the model unpickable, so drag moves don't pick it.
	app.ToggleSuppressPickingOnSelectedInstance(true);

	// Update manipulation state
	this.manipState.moveX += data.dx;
	this.manipState.moveY += data.dy;
	this.manipState.isInteracting = true;

	var intersect = app.PickTriangle(this.manipState.moveX,this.manipState.moveY);
	if (intersect)
	{
		intersect.inst = app.scene.IndexToObject(intersect.modelID);
		this.UpdateStateFromRayIntersection(intersect);
		app.scene.UpdateModelList();
	}
	
	this.Publish('Moving');
	
	return true;
};

ModelInstance.prototype.EndMouseInteract = function(data)
{
	var app = data.app;
	
	// Make this mode pickable again.
	app.ToggleSuppressPickingOnSelectedInstance(false);

	// Show the cursor again
	$('#ui').removeClass('hideCursor');

	// If we actually did a move, then record it
	// (this will fail to fire when the mouse was simply clicked and released)
	if (this.manipState.isInteracting)
		app.undoStack.pushCurrentState(UndoStack.CMDTYPE.MOVE, this);
		
	this.Publish('StoppedMoving');
		
	return true;
};


// Exports
return ModelInstance;

});