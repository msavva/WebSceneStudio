'use strict';

define(function(){

function Framebuffer(gl, options)
{
    this.width = options.width;
    this.height = options.height;
    
    this.handle = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.handle);
    
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    //gl.generateMipmap(gl.TEXTURE_2D);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    this.renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.renderbuffer);
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

Framebuffer.prototype.bind = function(gl)
{
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.handle);
    return this;
}

Framebuffer.prototype.unbind = function(gl)
{
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    //gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    return this;
}

// Exports
return Framebuffer;

});