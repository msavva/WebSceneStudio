'use strict';

define([
	'BrowserDetect',
	'jquery',
	'base',
],
function(BrowserDetect){

// This Module uses ideas from madrobby's keymaster script,
// which was made available under the MIT License.
// Please see the project on github for more information:
// https://github.com/madrobby/keymaster/


// WRAP everything in another function which will create
// an instance.  This ensures proper data encapsulation/privacy
// while allowing for instancing of the uimap module!
function create(canvas) {

// MODULE VARIABLES...

var mousedown_handlers = [];
var mouseup_handlers = [];
var mousemove_handlers = [];

var keydown_handlers = [];
var keyup_handlers = [];

var ui_key_update_callbacks = [];

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
//var mod_status = { 16: false, 17: false, 18: false, 91: false };
function mod_proto() {
    return { 16: false, 17: false, 18: false, 91: false };
};

// END MODULE VARIABLES


/*function modMatch(mods) {
    for (var key in mod_status) {
        if(mod_status[key] !== mods[key])
            return false;
    }
    return true;
}*/

function modMatch(mods, event) {
    /*if(BrowserDetect.OS == "Mac" &&
       BrowserDetect.browser == "Firefox")
    {
        event.ctrlKey = false; // suppress control key on Mac/Firefox
    }*/
    return (mods[MOD_MAP['alt']] == event.altKey) &&
           (mods[MOD_MAP['ctrl']] == event.ctrlKey) &&
           (mods[MOD_MAP['shift']] == event.shiftKey) &&
           (mods[MOD_MAP['cmd']] == event.metaKey);
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
/*    if(event.shiftKey === undefined)    return;
    mod_status[MOD_MAP.shift] = event.shiftKey;
    mod_status[MOD_MAP.ctrl] = event.ctrlKey;
    mod_status[MOD_MAP.alt] = event.altKey;*/
}



function install()
{
    installHandlers();
}

function installHandlers()
{
    canvas = canvas || $('#canvas')[0];
    function inCanvas(event) {
        return event.target == canvas;
    }
    
    function dispatchEvent(handler_list, event) {
        var list_copy = [];
        handler_list.forEach(function(x) { list_copy.push(x); });
        // We make a copy to ensure that there are no conflicts
        // if handlers are removed from their own list during processing
        list_copy.forEach(function(handler) {
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
            dispatchEvent(mousedown_handlers, event);
        /*console.log(event.button + " down w/ " +
                    JSON.stringify(mod_status) +
                    ", inCanvas=" + inCanvas(event));*/
    });
    
    $(document).mouseup(function(event) {
        setModifiersFromEvent(event);
        button_status[event.button] = false;
        //if(inCanvas(event))
        // ALWAYS dispatch mouse up events
            dispatchEvent(mouseup_handlers, event);
        /*console.log(event.button + " up w/ " +
                    JSON.stringify(mod_status) +
                    ", inCanvas=" + inCanvas(event));*/
    });
    
    $(document).mousemove(function(event) {
        setModifiersFromEvent(event);
        diffX = event.clientX - prevX;
        diffY = event.clientY - prevY;
        if(inCanvas(event))
            dispatchEvent(mousemove_handlers, event);
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
    
    /*$(document).keydown(function(event) {
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
    });*/
    
    // loss of focus must be detected on window, not document
    /*$(window).blur(function(event) {
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
        // CLEARING modifier state is safer
        mod_status = mod_proto();
    });*/
    
    
    // these don't appear necessary
    /*$(canvas).blur(function(event) {
        console.log('blur in canvas');
    });
    $(canvas).focus(function(event) {
        console.log('focus in canvas');
    });*/
    $(canvas).keydown(function(event) {
        dispatchEvent(keydown_handlers, event);
        ui_key_update_callbacks.forEach(function(callback) {
            callback();
        });
        //console.log('keydown in canvas: ' + event.which);
    });
    $(canvas).keyup(function(event) {
        console.log('key up: ' + event.which);
        dispatchEvent(keyup_handlers, event);
        ui_key_update_callbacks.forEach(function(callback) {
            callback();
        });
        //console.log('keyup in canvas: ' + event.which);
    });
}


/*
format for a criterion chunk returned:
[ {button: b_id, mods: [ mod_id1, ... ]}, ... ]
*/

// Stole this processing mostly from madrobby/keymaster.js
function commonProcessCriterion(criterion, processLastToken, last_token_name) {
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
        // INJECTED CODE HERE
        var last_token_converted = processLastToken(last_token);
        // END INJECTED CODE
        var mods = mod_proto();
        tokens.slice(0,-1).forEach(function(token) {
            var mapped = MOD_MAP[token];
            if(mapped !== undefined)
                mods[mapped] = true;
        });
        
        var chunk = {mods: mods};
        // INJECTED FIELD NAME
        chunk[last_token_name] = last_token_converted;
        result.push(chunk);
    }
    return result;
}

// platform independence wrapping for keys and mice
function localizeModifiers(chunk)
{
    var hasCtrl = chunk.mods[MOD_MAP['ctrl']];
    var hasCmd  = chunk.mods[MOD_MAP['cmd']];
    
    if(hasCtrl && hasCmd) {
        console.log("UIMap Error: Platform Independency Conflict!");
        console.log("Cannot specify both control and command modifier keys.");
        console.log("Collapsing both into a single modifier.");
    }
    if(hasCtrl || hasCmd) {
        if(BrowserDetect.OS == "Mac") {
            chunk.mods[MOD_MAP['ctrl']] = false;
            chunk.mods[MOD_MAP['cmd']]  = true;
        } else {
            chunk.mods[MOD_MAP['ctrl']] = true;
            chunk.mods[MOD_MAP['cmd']]  = false;
        }
    }
}

function localizeMouse(chunk)
{
    if(chunk.button == BUTTON_MAP["middle"]) {
        console.log("UIMap Error: Platform Independency Conflict!");
        console.log("No Middle click available on Mac");
    }
    // handle right mouse button fiasco on mac
    if(BrowserDetect.OS == "Mac") {
        if (chunk.button == BUTTON_MAP["right"]) {
            chunk.mods[MOD_MAP['ctrl']] = true;
            if(BrowserDetect.browser != "Firefox")
                chunk.button = BUTTON_MAP["left"];
        }
    }
}


function processMouseCriterion(criterion) {
    var chunks = commonProcessCriterion(criterion, function(last_token) {
        var button = BUTTON_MAP[last_token];
        if(button === undefined) button = invalid;
        return button;
    }, 'button');
    chunks.forEach(localizeModifiers);
    chunks.forEach(localizeMouse); // must come second
    return chunks;
}

function processKeyCriterion(criterion) {
    var chunks = commonProcessCriterion(criterion, function(last_token) {
        var key = KEY_MAP[last_token];
        if(key === undefined) {
            if(last_token.length > 1)
                key = invalid;
            else
                key = last_token.charCodeAt(0);
        }
        return key;
    }, 'key');
    chunks.forEach(localizeModifiers);
    return chunks;
}



function mousepress(criterion, handler) {
    processMouseCriterion(criterion).forEach(function(chunk) {
        mousedown_handlers.push(function(event) {
            if(chunk.button === event.button &&
               modMatch(chunk.mods, event)) {
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
    if(!(handlers.start && handlers.drag && handlers.finish)) {
        throw new Error(
            'invalid handlers object passed to uimap.mousedrag()');
        return;
    }
    processMouseCriterion(criterion).forEach(function(chunk) {
        // used to keep track of whether we are in the middle of this drag
        var isActive = false;
        
        // set-up handler wrappers for all three stages
        // the drag is designed to install and then remove the move and finish
        function down_handler(event) {
            if(chunk.button === event.button &&
               modMatch(chunk.mods, event)) {
                var opts = { x: event.clientX, y: event.clientY,
                             /* MORE STUFF? */ };
                var result = handlers.start(opts);
                isActive = !(opts.cancel_drag || result === false);
            }
        };
        function move_handler(event) {
            if(isActive &&
               /* so long as we haven't finished... */ true) {
                var opts = { x: event.clientX, y: event.clientY,
                             dx: diffX, dy: diffY,
                             /* MORE STUFF? */ };
                var result = handlers.drag(opts);
                if(opts.finish_drag || result === false) {
                    var finishOpts = { x: opts.x, y: opts.y };
                    handlers.finish(opts);
                    isActive = false;
                }
            }
        };
        function up_handler(event) {
            if(isActive &&
               chunk.button === event.button) {
                var opts = { x: event.clientX, y: event.clientY,
                             /* MORE STUFF? */ };
                handlers.finish(opts);
                isActive = false;
            }
        };
        // install this drag behavior as triggering on appropriate
        // mouse down
        mousedown_handlers.push(down_handler);
        mousemove_handlers.push(move_handler);
        mouseup_handlers.push(up_handler);
    });
}

function mousehover(criterion, handler) {
    function check_buttons(chunk_button) {
        var buttons = button_proto();
        if(chunk_button != invalid)
            buttons[chunk_button] = true;
        return buttonMatch(buttons);
    }
    processMouseCriterion(criterion).forEach(function(chunk) {
        mousemove_handlers.push(function(event) {
            if(check_buttons(chunk.button) &&
               modMatch(chunk.mods, event)) {
                    var opts = { x: event.clientX, y: event.clientY,
                                 dx: diffX, dy: diffY, };
                    handler(opts);
            }
        });
    });
}

function keypress(criterion, handler) {
    processKeyCriterion(criterion).forEach(function(chunk) {
        var isDown = false;
        keydown_handlers.push(function(event) {
            if(chunk.key === event.which &&
               modMatch(chunk.mods, event)) {
                console.log("fire: " + event.which);
                if(!isDown) { // prevent multiple firing
                    var opts = {x: prevX, y: prevY};
                    handler(opts);
                    isDown = true;
                    console.log("isDown=true:  " + event.which);
                }
				event.preventDefault();
            }
        });
        keyup_handlers.push(function(event) {
            if(chunk.key === event.which /* no mod match neccessary */) {
                isDown = false;
                    console.log("isDown=false: " + event.which);
				event.preventDefault();
            }
        });
    });
}

/* handlers = {
    hold:    function(opts) { ... },
    finish:  function(opts) { ... }
}*/
function keyhold(criterion, handlers) {
    if(!(handlers.hold && handlers.finish)) {
        throw new Error(
            'invalid handlers object passed to uimap.keyhold()');
        return;
    }
    processKeyCriterion(criterion).forEach(function(chunk) {
        var isDown = false;
        keydown_handlers.push(function(event) {
            if(chunk.key === event.which &&
               modMatch(chunk.mods, event)) {
                // allow multiple firing, but inform the client
                var opts = {x: prevX, y: prevY, first_press: !isDown};
                handlers.hold(opts);
                isDown = true;
				event.preventDefault();
            }
        });
        keyup_handlers.push(function(event) {
            if(chunk.key === event.which /* no mod match neccessary */) {
                var opts = {x: prevX, y: prevY};
                handlers.finish(opts);
                isDown = false;
				event.preventDefault();
            }
        });
    });
}

/* handlers = {
    move:   function(opts) { ... },
    finish:  function(opts) { ... }
}*/
function mouseattach_tillclick(criterion, handlers) {
    if(!(handlers.move && handlers.finish)) {
        throw new Error(
            'invalid handlers object passed to uimap.mouseattach_tillclick()');
        return;
    }
    
    var all_handlers = [];
    function install() {
        all_handlers.forEach(function(pack) {
            mousedown_handlers.push(pack.down_handler);
            mousemove_handlers.push(pack.move_handler);
            mouseup_handlers.push(pack.up_handler);
        });
    }
    function uninstall() {
        all_handlers.forEach(function(pack) {
            arrayRemove(mousedown_handlers, pack.down_handler);
            arrayRemove(mousemove_handlers, pack.move_handler);
            arrayRemove(mouseup_handlers,   pack.up_handler);
        });
    }
    
    processMouseCriterion(criterion).forEach(function(chunk) {
        // used to keep track of whether we are in the middle of this drag
        var isPressed = false;
        
        // set-up handler wrappers for all three stages
        // the drag is designed to install and then remove the move and finish
        function down_handler(event) {
            if(chunk.button === event.button &&
               modMatch(chunk.mods, event)) {
                isPressed = true;
            }
        };
        function move_handler(event) {
            if(/* so long as we haven't finished... */ true) {
                var opts = { x: event.clientX, y: event.clientY,
                             dx: diffX, dy: diffY,
                             /* MORE STUFF? */ };
                var result = handlers.move(opts);
                if(opts.finish_move || result === false) {
                    var finishOpts = { x: opts.x, y: opts.y };
                    handlers.finish(opts);
                    uninstall();
                }
            }
        };
        function up_handler(event) {
            if(isPressed &&
               chunk.button === event.button) {
                var opts = { x: event.clientX, y: event.clientY,
                             /* MORE STUFF? */ };
                handlers.finish(opts);
                uninstall();
            }
        };
        
        all_handlers.push({
            down_handler: down_handler,
            move_handler: move_handler,
            up_handler:   up_handler,
        });
    });
    
    install(); // installs handlers for mouseattach_tillclick behavior
}

/* handlers = {
    move:   function(opts) { ... },
    finish:  function(opts) { ... }
}*/
function mouseattach_tillkey(criterion, handlers) {
    if(!(handlers.move && handlers.finish)) {
        throw new Error(
            'invalid handlers object passed to uimap.mouseattach_tillkey()');
        return;
    }
    
    var all_handlers = [];
    function install() {
        all_handlers.forEach(function(pack) {
            keydown_handlers.push(pack.down);
            mousemove_handlers.push(pack.move);
            keyup_handlers.push(pack.up);
        });
    }
    function uninstall() {
        all_handlers.forEach(function(pack) {
            arrayRemove(mousedown_handlers, pack.down);
            arrayRemove(mousemove_handlers, pack.move);
            arrayRemove(mouseup_handlers,   pack.up);
        });
    }
    
    processKeyCriterion(criterion).forEach(function(chunk) {
        // used to keep track of whether we are in the middle of this drag
        var isPressed = false;
        
        // set-up handler wrappers for all three stages
        // the drag is designed to install and then remove the move and finish
        function down_handler(event) {
            if(chunk.key === event.which &&
               modMatch(chunk.mods, event)) {
                isPressed = true;
				event.preventDefault();
            }
        };
        function move_handler(event) {
            if(/* so long as we haven't finished... */ true) {
                var opts = { x: event.clientX, y: event.clientY,
                             dx: diffX, dy: diffY,
                             /* MORE STUFF? */ };
                var result = handlers.move(opts);
                if(opts.finish_move || result === false) {
                    var finishOpts = { x: opts.x, y: opts.y };
                    handlers.finish(opts);
                    uninstall();
                }
            }
        };
        function up_handler(event) {
            if(isPressed &&
               chunk.key === event.which) {
                var opts = { x: event.clientX, y: event.clientY,
                             /* MORE STUFF? */ };
                handlers.finish(opts);
                uninstall();
				event.preventDefault();
            }
        };
        
        all_handlers.push({
            down: down_handler,
            move: move_handler,
            up:   up_handler,
        });
    });
    
    install(); // installs handlers for mouseattach_tillkey behavior
}

function allkeyupdates(callback) {
    ui_key_update_callbacks.push(callback);
}

install(); // installs the entire uimap

return {
    mousepress:             mousepress,
    mousedrag:              mousedrag,
    mousehover:             mousehover,
    keypress:               keypress,
    keyhold:                keyhold,
    mouseattach_tillclick:  mouseattach_tillclick,
    mouseattach_tillkey:    mouseattach_tillkey,
    allkeyupdates:          allkeyupdates,
};

} // END create(canvas)

// Exports
return {
    create: create,
};

});