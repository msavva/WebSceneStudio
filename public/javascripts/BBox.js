'use strict';

define([
	'gl-matrix'
],
function(){

function BBox()
{
	this.mins = vec3.create();
	this.maxs = vec3.create();
}

BBox.prototype.FromCenterRadius = function(cx, cy, cz, rx, ry, rz)
{
	this.mins[0] = cx-rx; this.mins[1] = cy-ry; this.mins[2] = cz-rz;
	this.maxs[0] = cx+rx; this.maxs[1] = cy+ry; this.maxs[2] = cz+rz;
}

BBox.prototype.FromCenterRadiusArray = function(arr)
{
	this.FromCenterRadius(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5]);
}

BBox.prototype.FromBBox = function(bbox)
{
	vec3.set(bbox.mins, this.mins);
	vec3.set(bbox.maxs, this.maxs);
}

BBox.prototype.Centroid = function()
{
	var centroid = vec3.create();
	vec3.add(this.mins, this.maxs, centroid);
	vec3.scale(centroid, 0.5, centroid);
	return centroid;
}

BBox.prototype.Dimensions = function()
{
	var dims = vec3.create();
	vec3.subtract(this.maxs, this.mins, dims);
	return dims;
}

BBox.prototype.ExpandPoint = function(point)
{
	this.mins[0] = Math.min(this.mins[0], point[0]);
	this.mins[1] = Math.min(this.mins[1], point[1]);
	this.mins[2] = Math.min(this.mins[2], point[2]);
	
	this.maxs[0] = Math.max(this.maxs[0], point[0]);
	this.maxs[1] = Math.max(this.maxs[1], point[1]);
	this.maxs[2] = Math.max(this.maxs[2], point[2]);
}

BBox.prototype.ExpandBBox = function(bbox)
{
    this.ExpandPoint(bbox.mins);
    this.ExpandPoint(bbox.maxs);
}

BBox.prototype.Transform = function(matrix)
{
	var bbox = new BBox();
	bbox.FromBBox(this);
	mat4.multiplyVec3(matrix, bbox.mins);
	mat4.multiplyVec3(matrix, bbox.maxs);
	return bbox;
}

// Exports
return BBox;

});