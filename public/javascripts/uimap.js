'use strict';

define([
	'jquery',
	'base'
],
function(){

// This Module uses ideas from madrobby's keymaster script,
// which was made available under the MIT License.
// Please see the project on github for more information:
// https://github.com/madrobby/keymaster/


// MODULE VARIABLES...

var mousedown_handlers = [];
var mouseup_handlers = [];
var mousemove_handlers = [];

var drag_finalizers = []; // use to force all active drags to abort

var prevX = 0;
var prevY = 0;

var diffX = 0;
var diffY = 0;

// assign this value if a MAP lookup fails
var invalid = -1;

// stole maps mostly from madrobby/keymaster
var MOD_MAP = {
    '⇧': 16, shift: 16,
    '⌥': 18, alt: 18, option: 18, opt: 18,
    '⌃': 17, ctrl: 17, control: 17,
    '⌘': 91, command: 91, cmd: 91,
};

var KEY_MAP = {
    backspace: 8, tab: 9, clear: 12,
    enter: 13, 'return': 13,
    esc: 27, escape: 27, space: 32,
    left: 37, up: 38,
    right: 39, down: 40,
    del: 46, 'delete': 46,
    home: 36, end: 35,
    pageup: 33, pagedown: 34,
    ',': 188, '.': 190, '/': 191,
    '`': 192, '-': 189, '=': 187,
    ';': 186, '\'': 222,
    '[': 219, ']': 221, '\\': 220,
};

var BUTTON_MAP = {
    left: 0,
    middle: 1,
    right: 2,
};

var button_status = { 0: false, 1: false, 2: false };
function button_proto() {
    return { 0: false, 1: false, 2: false };
};
var mod_status = { 16: false, 17: false, 18: false, 91: false };
function mod_proto() {
    return { 16: false, 17: false, 18: false, 91: false };
};

// END MODULE VARIABLES


function modMatch(mods) {
    for (var key in mod_status) {
        if(mod_status[key] !== mods[key])
            return false;
    }
    return true;
}

function buttonMatch(buttons) {
    for (var key in button_status) {
        if(button_status[key] !== buttons[key])
            return false;
    }
    return true;
}

function arrayRemove(array, item) {
    for(var i=0; i<array.length; i++) {
        if(array[i] === item) {
            array.splice(i,1);
            break;
        }
    }
}

function setModifiersFromEvent(event) {
    if(event.shiftKey === undefined)    return;
    mod_status[MOD_MAP.shift] = event.shiftKey;
    mod_status[MOD_MAP.ctrl] = event.ctrlKey;
    mod_status[MOD_MAP.alt] = event.altKey;
}

function install()
{
    installHandlers();
}

function installHandlers()
{
    var canvasId = $('#canvas')[0];
    function inCanvas(event) {
        return event.target == canvasId;
    }
    
    function dispatchMouseEvent(handler_list, event) {
        handler_list.forEach(function(handler) {
            handler(event);
        });
    }
    
    function anyButtonDown() {
        return button_status[0] ||
               button_status[1] ||
               button_status[2];
    }
    
    $(document).mousedown(function(event) {
        setModifiersFromEvent(event);
        button_status[event.button] = true;
        // check if a button is already down? nah.
        prevX = event.clientX;
        prevY = event.clientY;
        if(inCanvas(event))
            dispatchMouseEvent(mousedown_handlers, event);
        /*console.log(event.button + " down w/ " +
                    JSON.stringify(mod_status) +
                    ", inCanvas=" + inCanvas(event));*/
    });
    
    $(document).mouseup(function(event) {
        setModifiersFromEvent(event);
        button_status[event.button] = false;
        //if(inCanvas(event))
        // ALWAYS dispatch mouse up events
            dispatchMouseEvent(mouseup_handlers, event);
        /*console.log(event.button + " up w/ " +
                    JSON.stringify(mod_status) +
                    ", inCanvas=" + inCanvas(event));*/
    });
    
    $(document).mousemove(function(event) {
        setModifiersFromEvent(event);
        diffX = event.clientX - prevX;
        diffY = event.clientY - prevY;
        if(inCanvas(event))
            dispatchMouseEvent(mousemove_handlers, event);
        //console.log(anyButtonDown() + " move w/ " +
        //            JSON.stringify(mod_status) +
        //            ", inCanvas=" + inCanvas(event));
        // update after dispatch
        prevX = event.clientX;
        prevY = event.clientY;
    });
    
    //$(document).mouseleave(function(event) {
    //});
    
    $(document).mouseenter(function(event) {
        // make sure we don't get jumpiness from
        // moving the cursor outside the canvas...  ?
        prevX = event.clientX;
        prevY = event.clientY;
    });
    
    $(document).keydown(function(event) {
        var key = event.keyCode;
        if (key == 93 || key == 224) key = 91; // cross-browser mac command
        if(key in mod_status)
            mod_status[key] = true;
        else {
        }
    });
    
    $(document).keyup(function(event) {
        var key = event.keyCode;
        if (key == 93 || key == 224) key = 91; // cross-browser mac command
        if(key in mod_status)
            mod_status[key] = false;
        else {
        }
    });
    
    // loss of focus must be detected on window, not document
    $(window).blur(function(event) {
        for(var button=0; button<3; button++) {
            var up_event = $.Event("mouseup");
            up_event.button = button;
            up_event.pageX = prevX;
            up_event.pageY = prevY;
            $(document).trigger(up_event);
        }
    });
    $(window).focus(function(event) {
        // could try to check for button and modifier state
        // here to ensure it works right
    });
}


/*
format for a criterion chunk:
[ {button: b_id, mods: [ mod_id1, ... ]}, ... ]
*/

// Stole this processing mostly from madrobby/keymaster.js
function process_criterion(criterion) {
    var criteria = criterion.replace(/\s/g,'').split(',');
    var N = criteria.length;
    if(criteria[N-1]=='') {
        criteria[N-2] += ',';   N-=1;
    }
    var result = [];
    for(var i=0; i<N; i++) {
        var tokens = criteria[i].split('+');
        if(tokens.length < 1)   continue;
        
        var last_token = tokens[tokens.length-1];
        var button = BUTTON_MAP[last_token];
        if(button === undefined) button = invalid;
        var mods = mod_proto();
        tokens.slice(0,-1).forEach(function(token) {
            var mapped = MOD_MAP[token];
            if(mapped !== undefined)
                mods[mapped] = true;
        });
        
        result.push({button: button, mods: mods});
    }
    return result;
}



function mousepress(criterion, handler) {
    process_criterion(criterion).forEach(function(chunk) {
        mousedown_handlers.push(function(event) {
            if(chunk.button === event.button &&
               modMatch(chunk.mods)) {
                    var opts = { x: event.clientX, y: event.clientY };
                    handler(opts);
            }
        });
    });
}

/* handlers = {
    start:  function(opts) { ... },
    drag:   function(opts) { ... },
    finish: function(opts) { ... }
}*/
function mousedrag(criterion, handlers) {
    if(!(handlers.start && handlers.drag && handlers.finish))
        return;
    process_criterion(criterion).forEach(function(chunk) {
        // set-up handler wrappers for all three stages
        // the drag is designed to install and then remove the move and finish
        function down_handler(event) {
            if(chunk.button === event.button &&
               modMatch(chunk.mods)) {
                var opts = { x: event.clientX, y: event.clientY,
                             /* MORE STUFF? */ };
                var result = handlers.start(opts);
                if(!(opts.cancelDrag || result === false)) {
                    // install the mouseup and mousemove handlers
                    mouseup_handlers.push(up_handler);
                    drag_finalizers.push(up_handler);
                    mousemove_handlers.push(move_handler);
                }
            }
        };
        function move_handler(event) {
            if(/* so long as we haven't finished... */ true) {
                var opts = { x: event.clientX, y: event.clientY,
                             dx: diffX, dy: diffY,
                             /* MORE STUFF? */ };
                var result = handlers.drag(opts);
                if(opts.finishDrag || result === false) {
                    up_handler(event); // this will uninstall
                }
            }
        };
        function up_handler(event) {
            if(chunk.button === event.button) {
                var opts = { x: event.clientX, y: event.clientY,
                             /* MORE STUFF? */ };
                handlers.finish(opts);
                // uninstall the move and up handlers!
                arrayRemove(mouseup_handlers, up_handler);
                arrayRemove(drag_finalizers, up_handler);
                arrayRemove(mousemove_handlers, move_handler);
            }
        };
        // install this drag behavior as triggering on appropriate
        // mouse down
        mousedown_handlers.push(down_handler);
    });
}

function mousehover(criterion, handler) {
    function check_buttons(chunk_button) {
        var buttons = button_proto();
        if(chunk_button != invalid)
            buttons[chunk_button] = true;
        return buttonMatch(buttons);
    }
    process_criterion(criterion).forEach(function(chunk) {
        mousemove_handlers.push(function(event) {
            if(check_buttons(chunk.button) &&
               modMatch(chunk.mods)) {
                    var opts = { x: event.clientX, y: event.clientY,
                                 dx: diffX, dy: diffY, };
                    handler(opts);
            }
        });
    });
}

$(document).ready(install());

// Exports
return {
	mousepress: mousepress,
	mousedrag: mousedrag,
	mousehover: mousehover
};

});