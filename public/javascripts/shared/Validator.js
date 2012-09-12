// Check if we are being loaded server-side in which case exports should be defined, else stuff definition into global scope
var ns = typeof exports == 'undefined' ? (function() {
    return window['Validator'] = {};
})() : exports;

ns.alphaNumPlus  = function(string) { return /^[a-z0-9\-_\s]+$/i.test(string); };

delete ns; // remove ns from the global scope

// Client-side jQuery.validator code
if (typeof $ != 'undefined') {
    $.validator.addMethod("alphanumPlus", function(value, element) {
        return this.optional(element) || ns.alphaNumPlus(value);
    }, "\nOnly letters, numbers, spaces, dashes or underscores allowed.");
}