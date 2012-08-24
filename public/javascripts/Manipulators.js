'use strict';

define([
	'Constants',
	'Mesh',
	'Material',
	'Model',
	'UndoStack',
	'gl-matrix',
	'gl-matrix-ext',
	'jquery'
],
function(Constants, Mesh, Material, Model, UndoStack){

////  Manipulator base class ////


function Manipulator()
{
	this.model = null;
	
	this.state = Manipulator.states.normal;
	
	// Transform stuff
	this.transform = mat4.identity(mat4.create());
	this.normalTransform = mat3.identity(mat3.create());
	this.center = vec3.create();
	this.ownerInstance = null;
	
	// Tooltip
	this.tooltipText = 'tooltip';
	this.tooltipTimer = null;
	this.tooltip = null;
}

Manipulator.states = {
	normal: 0,
	highlighted: 1,
	active: 2
}

Manipulator.prototype.UpdateState = function(newState)
{
	this.state = newState;
}

Manipulator.prototype.Attach = function(mInst)
{
	this.ownerInstance = mInst;
}

Manipulator.prototype.Detach = function()
{
	this.ownerInstance = null;
}

Manipulator.prototype.BasicTransform = function(dest)
{	
	if (!this.ownerInstance)
	{
		// No point in trying to determine transform if the owner instance
		// does not exist
		return;
	}
	var mInst = this.ownerInstance;
	
	mat4.identity(dest);
	var anchorPos = mInst.BaseCentroid();
	vec3.set(anchorPos, this.center);
	var anchorNormal = mInst.parentNormal;
	
	// If owner has a parent, rotate about the up vector *by the parent's rotation*
	if (mInst.parent)
	{
		mat4.rotateZ(dest, mInst.parent.rotation);
	}
	
	// Rotate to face the local up direction
    var faceNormal = mat4.identity(mat4.create());
    mat4.face(vec3.createFrom(0.0, 0.0, 1.0), anchorNormal, faceNormal);
    mat4.multiply(faceNormal, dest, dest);
	
	// Translate disc to the surface contact point + a small offset above the surface
	var transVec = vec3.create(anchorPos);
	var offset = vec3.create(anchorNormal);
	vec3.scale(offset, Constants.manipulatorOffset);
	vec3.add(transVec, offset);
	var translateMat = mat4.identity(mat4.create());
	mat4.translate(translateMat, transVec);
	mat4.multiply(translateMat, dest, dest);
	
}

Manipulator.prototype.CommonDrawSetup = function(renderer)
{
	var gl = renderer.gl_;
	
	mat4.multiply(renderer.viewProj_, this.transform, renderer.mvp_);
    gl.uniformMatrix4fv(renderer.activeProgram_.uniformLocs.u_mvp, false, renderer.mvp_);
}

Manipulator.prototype.Draw = function(renderer)
{
	if (this.ownerInstance && this.ownerInstance.renderState.isPickable)
	{
		var gl = renderer.gl_;
		this.CommonDrawSetup(renderer);
		this.model.Draw(renderer);
	}
}

Manipulator.prototype.Pick = function(renderer, manipID)
{
	if (this.ownerInstance && this.ownerInstance.renderState.isPickable)
	{
		this.CommonDrawSetup(renderer);
		this.model.Pick(renderer, manipID);
	}
}

Manipulator.prototype.SpawnTooltip = function(data)
{
	this.tooltip = $('<span class="tooltip">' + this.tooltipText + '</span>');
	$('#graphicsArea').append(this.tooltip);
	this.MoveTooltip(data);
}

Manipulator.prototype.MoveTooltip = function(data)
{
	this.tooltip.offset({left: data.x, top: data.y + Constants.toolTipYOffset});
}

Manipulator.prototype.KillTooltip = function(data)
{
	if (this.tooltipTimer)
	{
		clearTimeout(this.tooltipTimer);
		this.tooltipTimer = null;
	}
	$('.tooltip').remove();
	this.tooltip = null;
}

Manipulator.prototype.GainFocus = function(data)
{
	this.UpdateState(Manipulator.states.highlighted);
	return true;
}

Manipulator.prototype.Hover = function(data)
{
	// If we don't already have a tooltip active, start the timer for one
	if (!this.tooltip)
	{
		this.KillTooltip(data);
		this.tooltipTimer = setTimeout(function(){ this.SpawnTooltip(data); }.bind(this), Constants.toolTipDelay);
	}
	return false;
}

Manipulator.prototype.LoseFocus = function(data)
{
	this.KillTooltip(data);
	this.UpdateState(Manipulator.states.normal);
	return true;
}

Manipulator.prototype.BeginMouseInteract = function(data)
{
	this.KillTooltip(data);
	return false;
}

Manipulator.prototype.ContinueMouseInteract = function(data)
{
	this.UpdateState(Manipulator.states.active);
	return false;
}

Manipulator.prototype.EndMouseInteract = function(data)
{
	this.UpdateState(Manipulator.states.highlighted);
	return true;
}

// This is useful for lots of manipulator interactions
Manipulator.prototype.PickPlane = function(data)
{
	var pp = this.center;
	var pn = this.ownerInstance.parentNormal;
	return data.app.renderer.picker.PickPlane(data.x, data.y, pp, pn, data.app.camera, data.app.renderer);
}


//// Rotation Manipulator ////

function RotationManipulator(gl)
{
	// EXTEND: call Manipulator constructor
	Manipulator.call(this);
	
	this.gl = gl;
	
	// Colors and materials
	this.mainColors = [Constants.rotateNormalColor, Constants.rotateHighlightColor, Constants.rotateActiveColor];
	this.notchColors = [Constants.rotateNotchNormalColor, Constants.rotateNotchHighlightColor, Constants.rotateNotchActiveColor];
	this.mainMaterial = new Material.ManipulatorMaterial(gl, {color: Constants.rotateNormalColor});
	this.notchMaterial = new Material.ManipulatorMaterial(gl, {color: Constants.rotateNotchNormalColor});
	
	// Manipulation state
	this.prevVector = vec3.create();
	this.currVector = vec3.create();
	
	// Tooltip
	this.tooltipText = 'Rotate (Left/Right arrow keys)';
}

// EXTEND: inherit Manipulator prototype
RotationManipulator.prototype = Object.create(Manipulator.prototype);

RotationManipulator.prototype.RegenGeometry = function(newRi)
{
	var ri = newRi;
	var ro = newRi + Math.max(Constants.rotateMinThickness, Constants.rotateRelativeThickness*newRi);
	
	var components = [];
	
	// Generate the main dic mesh
	components.push({mesh: Mesh.GenerateDisc(this.gl, ri, ro, Constants.rotateSlices), material: this.mainMaterial, attribs: {bothFaces: true}});
	
	// Generate the notch meshes
	var n0 = 0;
	var n1 = 0.5 * Math.PI;
	var n2 = Math.PI;
	var n3 = 1.5 * Math.PI
	var hw = 0.5 * Constants.rotateNotchWidth;
	var slices = Constants.rotateNotchSlices;
	var zoff = Constants.rotateNotchExtraOffset;
	components.push({mesh: Mesh.GenerateDisc(this.gl, ri, ro, slices, zoff, n0-hw, n0+hw), material: this.notchMaterial});
	components.push({mesh: Mesh.GenerateDisc(this.gl, ri, ro, slices, zoff, n1-hw, n1+hw), material: this.notchMaterial});
	components.push({mesh: Mesh.GenerateDisc(this.gl, ri, ro, slices, zoff, n2-hw, n2+hw), material: this.notchMaterial});
	components.push({mesh: Mesh.GenerateDisc(this.gl, ri, ro, slices, zoff, n3-hw, n3+hw), material: this.notchMaterial});
	
	// Finalize the model
	this.model = new Model("RotationManipulator", components);
}

RotationManipulator.prototype.UpdateState = function(newState)
{
	Manipulator.prototype.UpdateState.call(this, newState);
	
	this.mainMaterial.UpdateColor(this.mainColors[this.state]);
	this.notchMaterial.UpdateColor(this.notchColors[this.state]);
}

RotationManipulator.prototype.Attach = function(mInst)
{
	Manipulator.prototype.Attach.call(this, mInst);
	
	this.RegenGeometry(mInst.ProjectedBoundingRadius());
	this.UpdateTransform();
	mInst.Subscribe('Moved', this, this.UpdateTransform);
	var regenfunc = function() {
		this.RegenGeometry(this.ownerInstance.ProjectedBoundingRadius());
	};
	mInst.Subscribe('Scaled', this, regenfunc);
	mInst.Subscribe('Tumbled', this, regenfunc);
}

RotationManipulator.prototype.Detach = function()
{
	this.ownerInstance.Unsubscribe('Moved', this);
	this.ownerInstance.Unsubscribe('Scaled', this);
	this.ownerInstance.Unsubscribe('Tumbled', this);
	
	Manipulator.prototype.Detach.call(this);
}

RotationManipulator.prototype.UpdateTransform = function()
{
	if (!this.ownerInstance)
	{
		return;
	}
	
	// Use the basic transform utility from Manipulator
	this.BasicTransform(this.transform);
	
	// Update normal transform
	mat4.toRotationMat(this.transform, this.normalTransform);
}

RotationManipulator.prototype.BeginMouseInteract = function(data)
{
	Manipulator.prototype.BeginMouseInteract.call(this, data);
	
	var isect = this.PickPlane(data);
	vec3.subtract(isect.position, this.center, this.prevVector);
	
	this.actualAbsoluteAng = this.ownerInstance.rotation;
	this.snappedAbsoluteAng = this.ownerInstance.rotation;
	
	return true;
}

RotationManipulator.prototype.ContinueMouseInteract = function(data)
{
	Manipulator.prototype.ContinueMouseInteract.apply(this, data);
	
	var isect = this.PickPlane(data);
	vec3.subtract(isect.position, this.center, this.currVector);
	var ang = vec3.signedAngleBetween(this.prevVector, this.currVector, this.ownerInstance.parentNormal);
	this.actualAbsoluteAng += ang;
	this.SnapAbsoluteAng();
	ang = this.AbsoluteAngToRelativeAng(this.snappedAbsoluteAng);
	this.ownerInstance.CascadingRotate(ang);
	
	vec3.set(this.currVector, this.prevVector);
	
	return true;
}

RotationManipulator.prototype.EndMouseInteract = function(data)
{
	if (this.state === Manipulator.states.active)
		data.app.undoStack.pushCurrentState(UndoStack.CMDTYPE.ROTATE, this.ownerInstance);
	Manipulator.prototype.EndMouseInteract.call(this, data);
	return true;
}

RotationManipulator.prototype.SnapAbsoluteAng = function()
{
	var HALFPI = Math.PI * 0.5;
	var parRot = (this.ownerInstance.parent ? this.ownerInstance.parent.rotation : 0);
	var rotmod = (this.actualAbsoluteAng - parRot) % HALFPI;
	var hw = Constants.rotateSnapHalfWidth;
	if (rotmod > 0 && rotmod < hw)
		this.snappedAbsoluteAng = this.actualAbsoluteAng - rotmod;
	else if (rotmod <= 0 && rotmod > -hw)
		this.snappedAbsoluteAng = this.actualAbsoluteAng - rotmod;
	else if (rotmod > 0 && rotmod > HALFPI - hw)
		this.snappedAbsoluteAng = this.actualAbsoluteAng + HALFPI-rotmod;
	else if (rotmod <= 0 && rotmod < -HALFPI + hw)
		this.snappedAbsoluteAng = this.actualAbsoluteAng + -HALFPI-rotmod;
	
	else this.snappedAbsoluteAng = this.actualAbsoluteAng;
}

RotationManipulator.prototype.AbsoluteAngToRelativeAng = function(absAng)
{
	return absAng - this.ownerInstance.rotation;
}





//// Scale Manipulator ////


function ScaleManipulator(gl)
{
	// EXTEND: call Manipulator constructor
	Manipulator.call(this);
	
	this.gl = gl;
	
	// Colors and materials
	this.colors = [Constants.scaleNormalColor, Constants.scaleHighlightColor, Constants.scaleActiveColor];
	this.material = new Material.ManipulatorMaterial(gl, {color: Constants.scaleNormalColor});
	
	// Manipulation state
	this.prevVector = vec3.create();
	this.currVector = vec3.create();
	
	// Tooltip
	this.tooltipText = 'Scale (Up/Down arrow keys)';
}

// EXTEND: inherit Manipulator prototype
ScaleManipulator.prototype = Object.create(Manipulator.prototype);

ScaleManipulator.prototype.RegenGeometry = function(newR)
{
	var r = newR + Math.max(Constants.scaleMinRadiusBoost, Constants.scaleRelativeRadiusBoost*newR);
	
	var components = [];
	
	// Generate each of the four corner meshes
	var c0 = 0.25 * Math.PI;
	var c1 = 0.75 * Math.PI;
	var c2 = 1.25 * Math.PI;
	var c3 = 1.75 * Math.PI
	var hw = 0.5 * Constants.scaleWidth;
	var slices = Constants.scaleSlices;
	var attr = {bothFaces: true};
	components.push({mesh: Mesh.GenerateCircularSquareSlice(this.gl, r, slices, c0-hw, c0+hw), material: this.material, attribs: attr});
	components.push({mesh: Mesh.GenerateCircularSquareSlice(this.gl, r, slices, c1-hw, c1+hw), material: this.material, attribs: attr});
	components.push({mesh: Mesh.GenerateCircularSquareSlice(this.gl, r, slices, c2-hw, c2+hw), material: this.material, attribs: attr});
	components.push({mesh: Mesh.GenerateCircularSquareSlice(this.gl, r, slices, c3-hw, c3+hw), material: this.material, attribs: attr});
	
	// Finalize the model
	this.model = new Model("ScaleManipulator", components);
}

ScaleManipulator.prototype.UpdateState = function(newState)
{
	Manipulator.prototype.UpdateState.call(this, newState);
	
	this.material.UpdateColor(this.colors[this.state]);
}

ScaleManipulator.prototype.Attach = function(mInst)
{
	Manipulator.prototype.Attach.call(this, mInst);
	
	this.RegenGeometry(mInst.ProjectedBoundingRadius());
	this.UpdateTransform();
	mInst.Subscribe('Moved', this, this.UpdateTransform);
	var regenfunc = function() {
		this.RegenGeometry(this.ownerInstance.ProjectedBoundingRadius());
	};
	mInst.Subscribe('Scaled', this, regenfunc);
	mInst.Subscribe('Tumbled', this, regenfunc);
}

ScaleManipulator.prototype.Detach = function()
{
	this.ownerInstance.Unsubscribe('Moved', this);
	this.ownerInstance.Unsubscribe('Scaled', this);
	this.ownerInstance.Unsubscribe('Tumbled', this);
	
	Manipulator.prototype.Detach.call(this);
}

ScaleManipulator.prototype.UpdateTransform = function()
{
	if (!this.ownerInstance)
	{
		return;
	}
	
	// Use the basic transform utility from Manipulator
	this.BasicTransform(this.transform);
	
	// Update normal transform
	mat4.toRotationMat(this.transform, this.normalTransform);
}

ScaleManipulator.prototype.BeginMouseInteract = function(data)
{
	Manipulator.prototype.BeginMouseInteract.call(this, data);
	
	var isect = this.PickPlane(data);
	vec3.subtract(isect.position, this.center, this.prevVector);
	
	return true;
}

ScaleManipulator.prototype.ContinueMouseInteract = function(data)
{
	Manipulator.prototype.ContinueMouseInteract.apply(this, data);
	
	var isect = this.PickPlane(data);
	vec3.subtract(isect.position, this.center, this.currVector);
	
	var ldiff = vec3.length(this.currVector) / vec3.length(this.prevVector);
	this.ownerInstance.CascadingScale(ldiff * Constants.scaleMagnitudeMultiplier);

	vec3.set(this.currVector, this.prevVector);
	return true;
}

ScaleManipulator.prototype.EndMouseInteract = function(data)
{
	if (this.state === Manipulator.states.active)
		data.app.undoStack.pushCurrentState(UndoStack.CMDTYPE.SCALE, this.ownerInstance);
	Manipulator.prototype.EndMouseInteract.call(this, data);
	return true;
}


// Exports
return {
	RotationManipulator: RotationManipulator,
	ScaleManipulator: ScaleManipulator
};

});