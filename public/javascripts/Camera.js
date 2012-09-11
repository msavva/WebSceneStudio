'use strict';

define([
	'Ray',
	'gl-matrix',
	'gl-matrix-ext',
	'jquery'
],
function(Ray){

function Camera(eye, lookAt, up)
{
	this.eyePos = vec3.create();
	this.lookAtPoint = vec3.create();
	this.upVec = vec3.create();
	this.lookVec = vec3.create();
	this.leftVec = vec3.create();
	this.Reset(eye, lookAt, up);
	
	this.savedState = null;
}

Camera.prototype.CalculateYaw = function()
{
	// Project forward into the xy plane
	var tmp = vec3.create(this.lookVec);
	tmp[2] = 0;
	
	// Find angle between forward and world y
	return vec3.signedAngleBetween([0, 1, 0], tmp, [0, 0, 1]);
}

Camera.prototype.CalculatePitch = function()
{
	// Project forward into the yz plane
	var tmp = vec3.create(this.lookVec);
	tmp[0] = 0;
	
	// Find angle between forward and world y
	return vec3.signedAngleBetween([0, 1, 0], tmp, [1, 0, 0]);
}

Camera.prototype.CalculatePitch = function()
{
	//
}

Camera.prototype.SaveStateForReset = function()
{
	if (!this.savedState)
		this.savedState = {};
	this.savedState.eyePos = vec3.create(this.eyePos);
	this.savedState.lookAtPoint = vec3.create(this.lookAtPoint);
	this.savedState.upVec = vec3.create(this.upVec);
}

Camera.prototype.ResetSavedState = function()
{
	if (this.savedState)
	{
		this.Reset(this.savedState.eyePos, this.savedState.lookAtPoint, this.savedState.upVec);
	}
}

Camera.prototype.Reset = function(eye, lookAt, up)
{
	if (eye)
		vec3.set(eye, this.eyePos);
	else
		vec3.set([0, 0, 0], this.eyePos);
	
	if (lookAt)
		vec3.set(lookAt, this.lookAtPoint);
	else
		vec3.set([0, 1, 0], this.lookAtPoint);
	
	if (up)
	{
		vec3.set(up, this.upVec);
		vec3.normalize(this.upVec);
	}
	else
		vec3.set([0, 0, 1], this.upVec);
	
	vec3.subtract(this.lookAtPoint, this.eyePos, this.lookVec);
	vec3.normalize(this.lookVec);
	
	vec3.cross(this.upVec, this.lookVec, this.leftVec);
	
	vec3.cross(this.lookVec, this.leftVec, this.upVec);
}

Camera.prototype.LookAtMatrix = function()
{
	return mat4.lookAt(this.eyePos, this.lookAtPoint, this.upVec);
}

Camera.prototype.DollyLeft = function(dist)
{
	var offset = vec3.create();
	vec3.scale(this.leftVec, dist, offset);
	vec3.add(this.eyePos, offset);
	vec3.add(this.lookAtPoint, offset);
}

Camera.prototype.DollyUp = function(dist)
{
	var offset = vec3.create();
	vec3.scale(this.upVec, dist, offset);
	vec3.add(this.eyePos, offset);
	vec3.add(this.lookAtPoint, offset);
}

Camera.prototype.DollyForward = function(dist)
{
	var offset = vec3.create();
	vec3.scale(this.lookVec, dist, offset);
	vec3.add(this.eyePos, offset);
	vec3.add(this.lookAtPoint, offset);
}

Camera.prototype.PanLeft = function(theta)
{	
	var rotmat = mat4.create(); mat4.identity(rotmat); mat4.rotateZ(rotmat, theta);
	var lookdir = vec3.create(); vec3.subtract(this.lookAtPoint, this.eyePos, lookdir);
	mat4.multiplyVec3(rotmat, lookdir);
	vec3.add(this.eyePos, lookdir, this.lookAtPoint);
	vec3.normalize(lookdir, this.lookVec);
	mat4.multiplyVec3(rotmat, this.upVec);
	mat4.multiplyVec3(rotmat, this.leftVec);
}

Camera.prototype.PanUp = function(theta)
{	
	var rotmat = mat4.create(); mat4.identity(rotmat); mat4.rotate(rotmat, theta, this.leftVec);
	// first, we'll try to rotate the up vector.  If this causes the
    // up vector to point downwards, then we abort the pan.
    // This effectively clamps the vertical rotation and prevents
    // the user from flipping the model upside down
    var newUp = vec3.create(); vec3.set(this.upVec, newUp);
    mat4.multiplyVec3(rotmat, newUp);
    // throw in the second part of the check to prevent sticking
    if(newUp[2] < 0.0 && this.upVec[2] >= 0.0)  {
        return;
    }
	var lookdir = vec3.create(); vec3.subtract(this.lookAtPoint, this.eyePos, lookdir);
	mat4.multiplyVec3(rotmat, lookdir);
	vec3.add(this.eyePos, lookdir, this.lookAtPoint);
	vec3.normalize(lookdir, this.lookVec);
	mat4.multiplyVec3(rotmat, this.upVec);
}

Camera.prototype.OrbitLeft = function(theta)
{	
	var rotmat = mat4.create(); mat4.identity(rotmat); mat4.rotateZ(rotmat, theta);
	var invlookdir = vec3.create(); vec3.subtract(this.eyePos, this.lookAtPoint, invlookdir);
	mat4.multiplyVec3(rotmat, invlookdir);
	vec3.add(this.lookAtPoint, invlookdir, this.eyePos);
	vec3.negate(invlookdir, this.lookVec);
	vec3.normalize(this.lookVec);
	mat4.multiplyVec3(rotmat, this.upVec);
	mat4.multiplyVec3(rotmat, this.leftVec);
}

Camera.prototype.OrbitUp = function(theta)
{
	var rotmat = mat4.create(); mat4.identity(rotmat); mat4.rotate(rotmat, theta, this.leftVec);
	// first, we'll try to rotate the up vector.  If this causes the
    // up vector to point downwards, then we abort the orbit.
    // This effectively clamps the vertical rotation and prevents
    // the user from flipping the model upside down
    var newUp = vec3.create(); vec3.set(this.upVec, newUp);
    mat4.multiplyVec3(rotmat, newUp);
    // throw in the second part of the check to prevent sticking
    if(newUp[2] < 0.0 && this.upVec[2] >= 0.0)  {
        return;
    }
	var invlookdir = vec3.create(); vec3.subtract(this.eyePos, this.lookAtPoint, invlookdir);
	mat4.multiplyVec3(rotmat, invlookdir);
	vec3.add(this.lookAtPoint, invlookdir, this.eyePos);
	vec3.negate(invlookdir, this.lookVec);
	vec3.normalize(this.lookVec);
	mat4.multiplyVec3(rotmat, this.upVec);
}

Camera.prototype.Zoom = function(dist)
{
	var offset = vec3.create(); vec3.scale(this.lookVec, dist, offset);
	var oldlookdir = vec3.create(); vec3.subtract(this.lookAtPoint, this.eyePos, oldlookdir);
	vec3.add(this.eyePos, offset);
	var lookdir = vec3.create(); vec3.subtract(this.lookAtPoint, this.eyePos, lookdir);
	
	// Have to keep the look at point in front of the eye at all times.
	if (vec3.dot(lookdir, oldlookdir) < 0)
		vec3.add(this.lookAtPoint, offset)
}

Camera.prototype.TrackTo = function(newPos)
{
	this.Reset(newPos, this.lookAtPoint, this.upVec);
}

Camera.prototype.MakePickRay = function(x, y, renderer)
{
	var screenV = vec3.create([x, y, 0.5]);
	var unprojV = renderer.UnprojectVector(screenV);
	
	var o = this.eyePos;
	var d = vec3.create();
	vec3.subtract(unprojV, o, d);
	vec3.normalize(d);
	var ray = new Ray(o, d);
	
	return ray;
}

// Exports
return Camera;

});