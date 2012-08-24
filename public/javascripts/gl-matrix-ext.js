// requires 'gl-matrix-min.js'

'use strict';

/*
 * from and to must be normalized.
 */
vec3.makeOrthonormalBasis = function (vec, dest0, dest1)
{
    var axis0 = vec3.create();
    var axis1 = vec3.create();

    vec3.cross(vec, vec3.createFrom(1.0, 0.0, 0.0), axis0);
    vec3.cross(vec, vec3.createFrom(0.0, 1.0, 0.0), axis1);

    if (vec3.length(axis0) >= vec3.length(axis1))
    {
        vec3.normalize(axis0, dest0);
    }
    else
    {
        vec3.normalize(axis1, dest0);
    }
    vec3.cross(dest0, vec, dest1);
    vec3.normalize(dest0);
}

/*
 * from and to must be normalized.
 */
mat4.face = function (from, to, dest)
{
    vec3.normalize(from);
    vec3.normalize(to);

    var axis = vec3.create();
    vec3.cross(from, to, axis);

    var angle = Math.acos(vec3.dot(from, to));

    if (angle == 0.0)
    {
        mat4.identity(dest);
    }
    else if (vec3.length(axis) == 0.0)
    {
        var basis0 = vec3.create();
        var basis1 = vec3.create();
        vec3.makeOrthonormalBasis(from, basis0, basis1);
        mat4.rotate(dest, angle, basis0);
    }
    else
    {
        mat4.rotate(dest, angle, axis);
    }

    return dest;
}

vec3.unproject = function (vec, view, proj, viewport, dest) {
    if (!dest) { dest = vec; }

    var m = mat4.create();
    var v = new MatrixArray(4);
    
    v[0] = (vec[0] - viewport[0]) * 2.0 / viewport[2] - 1.0;
    v[1] = (vec[1] - viewport[1]) * 2.0 / viewport[3] - 1.0;
    v[2] = 2.0 * vec[2] - 1.0;
    v[3] = 1.0;
    
    mat4.multiply(proj, view, m);
    if(!mat4.inverse(m)) { return null; }
    
    mat4.multiplyVec4(m, v);
    if(v[3] === 0.0) { return null; }

    dest[0] = v[0] / v[3];
    dest[1] = v[1] / v[3];
    dest[2] = v[2] / v[3];
    
    return dest;
};

vec3.signedAngleBetween = function(vec1, vec2, planeNormal)
{
	var tmp = vec3.create();
	
	var cosa = vec3.dot(vec1, vec2);
	vec3.cross(vec1, vec2, tmp);
	var sina = vec3.length(tmp);
	
	var ang = Math.atan2(sina, cosa);
	var sign = vec3.dot(planeNormal, tmp);
	return (sign < 0 ? -ang : ang);
}