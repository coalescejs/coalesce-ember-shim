/*!
 * @overview  Coalesce-Ember
 * @copyright Copyright 2014 Gordon L. Hempton and contributors
 * @license   Licensed under MIT license
 *            See https://raw.github.com/coalescejs/coalesce-ember/master/LICENSE
 * @version   0.4.0+dev.9570067c
 */
(function() {
!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.jsondiffpatch=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],2:[function(_dereq_,module,exports){

var Pipe = _dereq_('../pipe').Pipe;

var Context = function Context(){
};

Context.prototype.setResult = function(result) {
	this.result = result;
	this.hasResult = true;
	return this;
};

Context.prototype.exit = function() {
	this.exiting = true;
	return this;
};

Context.prototype.switchTo = function(next, pipe) {
	if (typeof next === 'string' || next instanceof Pipe) {
		this.nextPipe = next;
	} else {
		this.next = next;
		if (pipe) {
			this.nextPipe = pipe;
		}
	}
	return this;
};

Context.prototype.push = function(child, name) {
	child.parent = this;
	if (typeof name !== 'undefined') {
		child.childName = name;
	}
	child.root = this.root || this;
	child.options = child.options || this.options;
	if (!this.children) {
		this.children = [child];
		this.nextAfterChildren = this.next || null;
		this.next = child;
	} else {
		this.children[this.children.length - 1].next = child;
		this.children.push(child);
	}
	child.next = this;
	return this;
};

exports.Context = Context;
},{"../pipe":15}],3:[function(_dereq_,module,exports){

var Context = _dereq_('./context').Context;

var DiffContext = function DiffContext(left, right){
    this.left = left;
    this.right = right;
    this.pipe = 'diff';
};

DiffContext.prototype = new Context();

exports.DiffContext = DiffContext;
},{"./context":2}],4:[function(_dereq_,module,exports){

var Context = _dereq_('./context').Context;

var PatchContext = function PatchContext(left, delta){
    this.left = left;
    this.delta = delta;
    this.pipe = 'patch';
};

PatchContext.prototype = new Context();

exports.PatchContext = PatchContext;
},{"./context":2}],5:[function(_dereq_,module,exports){

var Context = _dereq_('./context').Context;

var ReverseContext = function ReverseContext(delta){
    this.delta = delta;
    this.pipe = 'reverse';
};

ReverseContext.prototype = new Context();

exports.ReverseContext = ReverseContext;
},{"./context":2}],6:[function(_dereq_,module,exports){

// use as 2nd parameter for JSON.parse to revive Date instances
module.exports = function dateReviver(key, value) {
    var parts;
    if (typeof value === 'string') {
        parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d*))?(Z|([+\-])(\d{2}):(\d{2}))$/.exec(value);
        if (parts) {
            return new Date(Date.UTC(+parts[1], +parts[2] - 1, +parts[3],
              +parts[4], +parts[5], +parts[6], +(parts[7] || 0)));
        }
    }
    return value;
};

},{}],7:[function(_dereq_,module,exports){

var Processor = _dereq_('./processor').Processor;
var Pipe = _dereq_('./pipe').Pipe;
var DiffContext = _dereq_('./contexts/diff').DiffContext;
var PatchContext = _dereq_('./contexts/patch').PatchContext;
var ReverseContext = _dereq_('./contexts/reverse').ReverseContext;

var trivial = _dereq_('./filters/trivial');
var nested = _dereq_('./filters/nested');
var arrays = _dereq_('./filters/arrays');
var dates = _dereq_('./filters/dates');
var texts = _dereq_('./filters/texts');

var DiffPatcher = function DiffPatcher(options){
    this.processor = new Processor(options);
    this.processor.pipe(new Pipe('diff').append(
        nested.collectChildrenDiffFilter,
        trivial.diffFilter,
        dates.diffFilter,
        texts.diffFilter,
        nested.objectsDiffFilter,
        arrays.diffFilter
        ).shouldHaveResult());
    this.processor.pipe(new Pipe('patch').append(
        nested.collectChildrenPatchFilter,
        arrays.collectChildrenPatchFilter,
        trivial.patchFilter,
        texts.patchFilter,
        nested.patchFilter,
        arrays.patchFilter
        ).shouldHaveResult());
    this.processor.pipe(new Pipe('reverse').append(
        nested.collectChildrenReverseFilter,
        arrays.collectChildrenReverseFilter,
        trivial.reverseFilter,
        texts.reverseFilter,
        nested.reverseFilter,
        arrays.reverseFilter
        ).shouldHaveResult());
};

DiffPatcher.prototype.options = function() {
    return this.processor.options.apply(this.processor, arguments);
};

DiffPatcher.prototype.diff = function(left, right) {
    return this.processor.process(new DiffContext(left, right));
};

DiffPatcher.prototype.patch = function(left, delta) {
    return this.processor.process(new PatchContext(left, delta));
};

DiffPatcher.prototype.reverse = function(delta) {
    return this.processor.process(new ReverseContext(delta));
};

DiffPatcher.prototype.unpatch = function(right, delta) {
    return this.patch(right, this.reverse(delta));
};

exports.DiffPatcher = DiffPatcher;

},{"./contexts/diff":3,"./contexts/patch":4,"./contexts/reverse":5,"./filters/arrays":9,"./filters/dates":10,"./filters/nested":12,"./filters/texts":13,"./filters/trivial":14,"./pipe":15,"./processor":16}],8:[function(_dereq_,module,exports){
(function (process){

var DiffPatcher = _dereq_('./diffpatcher').DiffPatcher;
exports.DiffPatcher = DiffPatcher;

exports.create = function(options){
	return new DiffPatcher(options);
};

exports.dateReviver = _dereq_('./date-reviver');

var defaultInstance;

exports.diff = function() {
	if (!defaultInstance) {
		defaultInstance = new DiffPatcher();
	}
	return defaultInstance.diff.apply(defaultInstance, arguments);
};

exports.patch = function() {
	if (!defaultInstance) {
		defaultInstance = new DiffPatcher();
	}
	return defaultInstance.patch.apply(defaultInstance, arguments);
};

exports.unpatch = function() {
	if (!defaultInstance) {
		defaultInstance = new DiffPatcher();
	}
	return defaultInstance.unpatch.apply(defaultInstance, arguments);
};

exports.reverse = function() {
	if (!defaultInstance) {
		defaultInstance = new DiffPatcher();
	}
	return defaultInstance.reverse.apply(defaultInstance, arguments);
};

var inNode = typeof process !== 'undefined' && typeof process.execPath === 'string';
if (inNode) {
	var formatters = _dereq_('./formatters' + '/index');
	exports.formatters = formatters;
	// shortcut for console
	exports.console = formatters.console;
} else {
	exports.homepage = 'https://github.com/benjamine/jsondiffpatch';
	exports.version = '0.1.8';
}

}).call(this,_dereq_("1YiZ5S"))
},{"./date-reviver":6,"./diffpatcher":7,"1YiZ5S":1}],9:[function(_dereq_,module,exports){

var DiffContext = _dereq_('../contexts/diff').DiffContext;
var PatchContext = _dereq_('../contexts/patch').PatchContext;
var ReverseContext = _dereq_('../contexts/reverse').ReverseContext;

var lcs = _dereq_('./lcs');

var ARRAY_MOVE = 3;

var isArray = (typeof Array.isArray === 'function') ?
    // use native function
    Array.isArray :
    // use instanceof operator
    function(a) {
        return a instanceof Array;
    };

var arrayIndexOf = typeof Array.prototype.indexOf === 'function' ?
    function(array, item) {
        return array.indexOf(item);
    } : function(array, item) {
        var length = array.length;
        for (var i = 0; i < length; i++) {
            if (array[i] === item) {
                return i;
            }
        }
        return -1;
    };

var diffFilter = function arraysDiffFilter(context){
    if (!context.leftIsArray) { return; }

    var objectHash = context.options && context.options.objectHash;

    var match = function(array1, array2, index1, index2, context) {
        var value1 = array1[index1];
        var value2 = array2[index2];
        if (value1 === value2) {
            return true;
        }
        if (typeof value1 !== 'object' || typeof value2 !== 'object') {
            return false;
        }
        if (!objectHash) { return false; }
        var hash1, hash2;
        if (typeof index1 === 'number') {
            context.hashCache1 = context.hashCache1 || [];
            hash1 = context.hashCache1[index1];
            if (typeof hash1 === 'undefined') {
                context.hashCache1[index1] = hash1 = objectHash(value1, index1);
            }
        } else {
            hash1 = objectHash(value1);
        }
        if (typeof hash1 === 'undefined') {
            return false;
        }
        if (typeof index2 === 'number') {
            context.hashCache2 = context.hashCache2 || [];
            hash2 = context.hashCache2[index2];
            if (typeof hash2 === 'undefined') {
                context.hashCache2[index2] = hash2 = objectHash(value2, index2);
            }
        } else {
            hash2 = objectHash(value2);
        }
        if (typeof hash2 === 'undefined') {
            return false;
        }
        return hash1 === hash2;
    };

    var matchContext = {};
    var commonHead = 0, commonTail = 0, index, index1, index2;
    var array1 = context.left;
    var array2 = context.right;
    var len1 = array1.length;
    var len2 = array2.length;

    var child;

    // separate common head
    while (commonHead < len1 && commonHead < len2 &&
        match(array1, array2, commonHead, commonHead, matchContext)) {
        index = commonHead;
        child = new DiffContext(context.left[index], context.right[index]);
        context.push(child, index);
        commonHead++;
    }
    // separate common tail
    while (commonTail + commonHead < len1 && commonTail + commonHead < len2 &&
        match(array1, array2, len1 - 1 - commonTail, len2 - 1 - commonTail, matchContext)) {
        index1 = len1 - 1 - commonTail;
        index2 = len2 - 1 - commonTail;
        child = new DiffContext(context.left[index1], context.right[index2]);
        context.push(child, index2);
        commonTail++;
    }
    var result;
    if (commonHead + commonTail === len1) {
        if (len1 === len2) {
            // arrays are identical
            context.setResult(undefined).exit();
            return;
        }
        // trivial case, a block (1 or more consecutive items) was added
        result = result || { _t: 'a' };
        for (index = commonHead; index < len2 - commonTail; index++) {
            result[index] = [array2[index]];
        }
        context.setResult(result).exit();
        return;
    }
    if (commonHead + commonTail === len2) {
        // trivial case, a block (1 or more consecutive items) was removed
        result = result || { _t: 'a' };
        for (index = commonHead; index < len1 - commonTail; index++) {
            result['_'+index] = [array1[index], 0, 0];
        }
        context.setResult(result).exit();
        return;
    }
    // reset hash cache
    matchContext = {};
    // diff is not trivial, find the LCS (Longest Common Subsequence)
    var trimmed1 = array1.slice(commonHead, len1 - commonTail);
    var trimmed2 = array2.slice(commonHead, len2 - commonTail);
    var seq = lcs.get(
        trimmed1, trimmed2,
        match,
        matchContext
    );
    var removedItems = [];
    result = result || { _t: 'a' };
    for (index = commonHead; index < len1 - commonTail; index++) {
        if (arrayIndexOf(seq.indices1, index - commonHead) < 0) {
            // removed
            result['_'+index] = [array1[index], 0, 0];
            removedItems.push(index);
        }
    }

    var detectMove = true;
    if (context.options && context.options.arrays && context.options.arrays.detectMove === false) {
        detectMove = false;
    }
    var includeValueOnMove = false;
    if (context.options && context.options.arrays && context.options.arrays.includeValueOnMove) {
        includeValueOnMove = true;
    }

    var removedItemsLength = removedItems.length;
    for (index = commonHead; index < len2 - commonTail; index++) {
        var indexOnArray2 = arrayIndexOf(seq.indices2, index - commonHead);
        if (indexOnArray2 < 0) {
            // added, try to match with a removed item and register as position move
            var isMove = false;
            if (detectMove && removedItemsLength > 0) {
                for (var removeItemIndex1 = 0; removeItemIndex1 < removedItemsLength; removeItemIndex1++) {
                    index1 = removedItems[removeItemIndex1];
                    if (match(trimmed1, trimmed2, index1 - commonHead,
                        index - commonHead, matchContext)) {
                        // store position move as: [originalValue, newPosition, ARRAY_MOVE]
                        result['_' + index1].splice(1, 2, index, ARRAY_MOVE);
                        if (!includeValueOnMove) {
                            // don't include moved value on diff, to save bytes
                            result['_' + index1][0] = '';
                        }

                        index2 = index;
                        child = new DiffContext(context.left[index1], context.right[index2]);
                        context.push(child, index2);
                        removedItems.splice(removeItemIndex1, 1);
                        isMove = true;
                        break;
                    }
                }
            }
            if (!isMove) {
                // added
                result[index] = [array2[index]];
            }
        } else {
            // match, do inner diff
            index1 = seq.indices1[indexOnArray2] + commonHead;
            index2 = seq.indices2[indexOnArray2] + commonHead;
            child = new DiffContext(context.left[index1], context.right[index2]);
            context.push(child, index2);
        }
    }

    context.setResult(result).exit();

};
diffFilter.filterName = 'arrays';

var compare = {
    numerically: function(a, b) {
        return a - b;
    },
    numericallyBy: function(name) {
        return function(a, b) {
            return a[name] - b[name];
        };
    }
};

var patchFilter = function nestedPatchFilter(context) {
    if (!context.nested) { return; }
    if (context.delta._t !== 'a') { return; }
    var index, index1;

    var delta = context.delta;
    var array = context.left;

    // first, separate removals, insertions and modifications
    var toRemove = [];
    var toInsert = [];
    var toModify = [];
    for (index in delta) {
        if (index !== '_t') {
            if (index[0] === '_') {
                // removed item from original array
                if (delta[index][2] === 0 || delta[index][2] === ARRAY_MOVE) {
                    toRemove.push(parseInt(index.slice(1), 10));
                } else {
                    throw new Error('only removal or move can be applied at original array indices' +
                        ', invalid diff type: ' + delta[index][2]);
                }
            } else {
                if (delta[index].length === 1) {
                    // added item at new array
                    toInsert.push({
                        index: parseInt(index, 10),
                        value: delta[index][0]
                    });
                } else {
                    // modified item at new array
                    toModify.push({
                        index: parseInt(index, 10),
                        delta: delta[index]
                    });
                }
            }
        }
    }

    // remove items, in reverse order to avoid sawing our own floor
    toRemove = toRemove.sort(compare.numerically);
    for (index = toRemove.length - 1; index >= 0; index--) {
        index1 = toRemove[index];
        var indexDiff = delta['_' + index1];
        var removedValue = array.splice(index1, 1)[0];
        if (indexDiff[2] === ARRAY_MOVE) {
            // reinsert later
            toInsert.push({
                index: indexDiff[1],
                value: removedValue
            });
        }
    }

    // insert items, in reverse order to avoid moving our own floor
    toInsert = toInsert.sort(compare.numericallyBy('index'));
    var toInsertLength = toInsert.length;
    for (index = 0; index < toInsertLength; index++) {
        var insertion = toInsert[index];
        array.splice(insertion.index, 0, insertion.value);
    }

    // apply modifications
    var toModifyLength = toModify.length;
    var child;
    if (toModifyLength > 0) {
        for (index = 0; index < toModifyLength; index++) {
            var modification = toModify[index];
            child = new PatchContext(context.left[modification.index], modification.delta);
            context.push(child, modification.index);
        }
    }

    if (!context.children) {
        context.setResult(context.left).exit();
        return;
    }
    context.exit();
};
patchFilter.filterName = 'arrays';

var collectChildrenPatchFilter = function collectChildrenPatchFilter(context) {
    if (!context || !context.children) { return; }
    if (context.delta._t !== 'a') { return; }
    var length = context.children.length;
    var child;
    for (var index = 0; index < length; index++) {
        child = context.children[index];
        context.left[child.childName] = child.result;
    }
    context.setResult(context.left).exit();
};
collectChildrenPatchFilter.filterName = 'arraysCollectChildren';

var reverseFilter = function arraysReverseFilter(context) {
    if (!context.nested) {
        if (context.delta[2] === ARRAY_MOVE) {
            context.newName = '_' + context.delta[1];
            context.setResult([context.delta[0], parseInt(context.childName.substr(1), 10), ARRAY_MOVE]).exit();
        }
        return;
    }
    if (context.delta._t !== 'a') { return; }
    var name, child;
    for (name in context.delta) {
        if (name === '_t') { continue; }
        child = new ReverseContext(context.delta[name]);
        context.push(child, name);
    }
    context.exit();
};
reverseFilter.filterName = 'arrays';

var reverseArrayDeltaIndex = function(delta, index, itemDelta) {
    var newIndex = index;
    if (typeof index === 'string' && index[0] === '_') {
        newIndex = parseInt(index.substr(1), 10);
    } else {
        var uindex = '_' + index;
        if (isArray(itemDelta) && itemDelta[2] === 0) {
            newIndex = uindex;
        } else {
            for (var index2 in delta) {
                var itemDelta2 = delta[index2];
                if (isArray(itemDelta2) && itemDelta2[2] === ARRAY_MOVE && itemDelta2[1].toString() === index) {
                    newIndex = index2.substr(1);
                }
            }
        }
    }
    return newIndex;
};

var collectChildrenReverseFilter = function collectChildrenReverseFilter(context) {
    if (!context || !context.children) { return; }
    if (context.delta._t !== 'a') { return; }
    var length = context.children.length;
    var child;
    var delta = { _t: 'a' };
    for (var index = 0; index < length; index++) {
        child = context.children[index];
        var name = child.newName;
        if (typeof name === 'undefined') {
            name = reverseArrayDeltaIndex(context.delta, child.childName, child.result);
        }
        if (delta[name] !== child.result) {
            delta[name] = child.result;
        }
    }
    context.setResult(delta).exit();
};
collectChildrenReverseFilter.filterName = 'arraysCollectChildren';

exports.diffFilter = diffFilter;
exports.patchFilter = patchFilter;
exports.collectChildrenPatchFilter = collectChildrenPatchFilter;
exports.reverseFilter = reverseFilter;
exports.collectChildrenReverseFilter = collectChildrenReverseFilter;

},{"../contexts/diff":3,"../contexts/patch":4,"../contexts/reverse":5,"./lcs":11}],10:[function(_dereq_,module,exports){
var diffFilter = function datesDiffFilter(context) {
    if (context.left instanceof Date) {
        if (context.right instanceof Date) {
            if (context.left.getTime() !== context.right.getTime()) {
                context.setResult([context.left, context.right]);
            } else {
                context.setResult(undefined);
            }
        } else {
            context.setResult([context.left, context.right]);
        }
        context.exit();
    } else if (context.right instanceof Date) {
        context.setResult([context.left, context.right]).exit();
    }
};
diffFilter.filterName = 'dates';

exports.diffFilter = diffFilter;
},{}],11:[function(_dereq_,module,exports){
/*

LCS implementation that supports arrays or strings

reference: http://en.wikipedia.org/wiki/Longest_common_subsequence_problem

*/

var defaultMatch = function(array1, array2, index1, index2) {
    return array1[index1] === array2[index2];
};

var lengthMatrix = function(array1, array2, match, context) {
    var len1 = array1.length;
    var len2 = array2.length;
    var x, y;

    // initialize empty matrix of len1+1 x len2+1
    var matrix = [len1 + 1];
    for (x = 0; x < len1 + 1; x++) {
        matrix[x] = [len2 + 1];
        for (y = 0; y < len2 + 1; y++) {
            matrix[x][y] = 0;
        }
    }
    matrix.match = match;
    // save sequence lengths for each coordinate
    for (x = 1; x < len1 + 1; x++) {
        for (y = 1; y < len2 + 1; y++) {
            if (match(array1, array2, x - 1, y - 1, context)) {
                matrix[x][y] = matrix[x - 1][y - 1] + 1;
            } else {
                matrix[x][y] = Math.max(matrix[x - 1][y], matrix[x][y - 1]);
            }
        }
    }
    return matrix;
};

var backtrack = function(matrix, array1, array2, index1, index2, context) {
    if (index1 === 0 || index2 === 0) {
        return {
            sequence: [],
            indices1: [],
            indices2: []
        };
    }

    if (matrix.match(array1, array2, index1 - 1, index2 - 1, context)) {
        var subsequence = backtrack(matrix, array1, array2, index1 - 1, index2 - 1, context);
        subsequence.sequence.push(array1[index1 - 1]);
        subsequence.indices1.push(index1 - 1);
        subsequence.indices2.push(index2 - 1);
        return subsequence;
    }

    if (matrix[index1][index2 - 1] > matrix[index1 - 1][index2]) {
        return backtrack(matrix, array1, array2, index1, index2 - 1, context);
    } else {
        return backtrack(matrix, array1, array2, index1 - 1, index2, context);
    }
};

var get = function(array1, array2, match, context) {
    context = context || {};
    var matrix = lengthMatrix(array1, array2, match || defaultMatch, context);
    var result = backtrack(matrix, array1, array2, array1.length, array2.length, context);
    if (typeof array1 === 'string' && typeof array2 === 'string') {
        result.sequence = result.sequence.join('');
    }
    return result;
};

exports.get = get;

},{}],12:[function(_dereq_,module,exports){

var DiffContext = _dereq_('../contexts/diff').DiffContext;
var PatchContext = _dereq_('../contexts/patch').PatchContext;
var ReverseContext = _dereq_('../contexts/reverse').ReverseContext;

var collectChildrenDiffFilter = function collectChildrenDiffFilter(context) {
    if (!context || !context.children) { return; }
    var length = context.children.length;
    var child;
    var result = context.result;
    for (var index = 0; index < length; index++) {
        child = context.children[index];
        if (typeof child.result === 'undefined') {
            continue;
        }
        result = result || {};
        result[child.childName] = child.result;
    }
    if (result && context.leftIsArray) {
        result._t = 'a';
    }
    context.setResult(result).exit();
};
collectChildrenDiffFilter.filterName = 'collectChildren';

var objectsDiffFilter = function objectsDiffFilter(context) {
    if (context.leftIsArray || context.leftType !== 'object') { return; }

    var name, child;
    for (name in context.left) {
        child = new DiffContext(context.left[name], context.right[name]);
        context.push(child, name);
    }
    for (name in context.right) {
        if (typeof context.left[name] === 'undefined') {
            child = new DiffContext(undefined, context.right[name]);
            context.push(child, name);
        }
    }

    if (!context.children || context.children.length === 0) {
        context.setResult(undefined).exit();
        return;
    }
    context.exit();
};
objectsDiffFilter.filterName = 'objects';

var patchFilter = function nestedPatchFilter(context) {
    if (!context.nested) { return; }
    if (context.delta._t) { return; }
    var name, child;
    for (name in context.delta) {
        child = new PatchContext(context.left[name], context.delta[name]);
        context.push(child, name);
    }
    context.exit();
};
patchFilter.filterName = 'objects';

var collectChildrenPatchFilter = function collectChildrenPatchFilter(context) {
    if (!context || !context.children) { return; }
    if (context.delta._t) { return; }
    var length = context.children.length;
    var child;
    for (var index = 0; index < length; index++) {
        child = context.children[index];
        if (context.left[child.childName] !== child.result) {
            context.left[child.childName] = child.result;
        }
    }
    context.setResult(context.left).exit();
};
collectChildrenPatchFilter.filterName = 'collectChildren';

var reverseFilter = function nestedReverseFilter(context) {
    if (!context.nested) { return; }
    if (context.delta._t) { return; }
    var name, child;
    for (name in context.delta) {
        child = new ReverseContext(context.delta[name]);
        context.push(child, name);
    }
    context.exit();
};
reverseFilter.filterName = 'objects';

var collectChildrenReverseFilter = function collectChildrenReverseFilter(context) {
    if (!context || !context.children) { return; }
    if (context.delta._t) { return; }
    var length = context.children.length;
    var child;
    var delta = {};
    for (var index = 0; index < length; index++) {
        child = context.children[index];
        if (delta[child.childName] !== child.result) {
            delta[child.childName] = child.result;
        }
    }
    context.setResult(delta).exit();
};
collectChildrenReverseFilter.filterName = 'collectChildren';

exports.collectChildrenDiffFilter = collectChildrenDiffFilter;
exports.objectsDiffFilter = objectsDiffFilter;
exports.patchFilter = patchFilter;
exports.collectChildrenPatchFilter = collectChildrenPatchFilter;
exports.reverseFilter = reverseFilter;
exports.collectChildrenReverseFilter = collectChildrenReverseFilter;
},{"../contexts/diff":3,"../contexts/patch":4,"../contexts/reverse":5}],13:[function(_dereq_,module,exports){
/* global diff_match_patch */
var TEXT_DIFF = 2;
var DEFAULT_MIN_LENGTH = 60;
var cachedDiffPatch = null;

var getDiffMatchPatch = function(){
    /*jshint camelcase: false */

    if (!cachedDiffPatch) {
        var instance;
        if (typeof diff_match_patch !== 'undefined') {
            // already loaded, probably a browser
            instance = new diff_match_patch();
        } else if (typeof _dereq_ === 'function') {
            var dmp = _dereq_('../../external/diff_match_patch_uncompressed');
            instance = new dmp.diff_match_patch();
        }
        if (!instance) {
            var error = new Error('text diff_match_patch library not found');
            error.diff_match_patch_not_found = true;
            throw error;
        }
        cachedDiffPatch = {
            diff: function(txt1, txt2){
                return instance.patch_toText(instance.patch_make(txt1, txt2));
            },
            patch: function(txt1, patch){
                var results = instance.patch_apply(instance.patch_fromText(patch), txt1);
                for (var i = 0; i < results[1].length; i++) {
                    if (!results[1][i]) {
                        var error = new Error('text patch failed');
                        error.textPatchFailed = true;
                    }
                }
                return results[0];
            }
        };
    }
    return cachedDiffPatch;
};

var diffFilter = function textsDiffFilter(context) {
    if (context.leftType !== 'string') { return; }
    var minLength = (context.options && context.options.textDiff &&
        context.options.textDiff.minLength) || DEFAULT_MIN_LENGTH;
    if (context.left.length < minLength ||
        context.right.length < minLength) {
        context.setResult([context.left, context.right]).exit();
        return;
    }
    // large text, use a text-diff algorithm
    var diff = getDiffMatchPatch().diff;
    context.setResult([diff(context.left, context.right), 0, TEXT_DIFF]).exit();
};
diffFilter.filterName = 'texts';

var patchFilter = function textsPatchFilter(context) {
    if (context.nested) { return; }
    if (context.delta[2] !== TEXT_DIFF) { return; }

    // text-diff, use a text-patch algorithm
    var patch = getDiffMatchPatch().patch;
    context.setResult(patch(context.left, context.delta[0])).exit();
};
patchFilter.filterName = 'texts';

var textDeltaReverse = function(delta){
    var i, l, lines, line, lineTmp, header = null,
    headerRegex = /^@@ +\-(\d+),(\d+) +\+(\d+),(\d+) +@@$/,
    lineHeader, lineAdd, lineRemove;
    lines = delta.split('\n');
    for (i = 0, l = lines.length; i<l; i++) {
        line = lines[i];
        var lineStart = line.slice(0,1);
        if (lineStart==='@'){
            header = headerRegex.exec(line);
            lineHeader = i;
            lineAdd = null;
            lineRemove = null;

            // fix header
            lines[lineHeader] = '@@ -' + header[3] + ',' + header[4] + ' +' + header[1] + ',' + header[2] + ' @@';
        } else if (lineStart === '+'){
            lineAdd = i;
            lines[i] = '-' + lines[i].slice(1);
            if (lines[i-1].slice(0,1)==='+') {
                // swap lines to keep default order (-+)
                lineTmp = lines[i];
                lines[i] = lines[i-1];
                lines[i-1] = lineTmp;
            }
        } else if (lineStart === '-'){
            lineRemove = i;
            lines[i] = '+' + lines[i].slice(1);
        }
    }
    return lines.join('\n');
};

var reverseFilter = function textsReverseFilter(context) {
    if (context.nested) { return; }
    if (context.delta[2] !== TEXT_DIFF) { return; }

    // text-diff, use a text-diff algorithm
    context.setResult([textDeltaReverse(context.delta[0]), 0, TEXT_DIFF]).exit();
};
reverseFilter.filterName = 'texts';

exports.diffFilter = diffFilter;
exports.patchFilter = patchFilter;
exports.reverseFilter = reverseFilter;
},{}],14:[function(_dereq_,module,exports){

var isArray = (typeof Array.isArray === 'function') ?
    // use native function
    Array.isArray :
    // use instanceof operator
    function(a) {
        return a instanceof Array;
    };

var diffFilter = function trivialMatchesDiffFilter(context) {
    if (context.left === context.right) {
        context.setResult(undefined).exit();
        return;
    }
    if (typeof context.left === 'undefined') {
        if (typeof context.right === 'function') {
            throw new Error('functions are not supported');
        }
        context.setResult([context.right]).exit();
        return;
    }
    if (typeof context.right === 'undefined') {
        context.setResult([context.left, 0, 0]).exit();
        return;
    }
    if (typeof context.left === 'function' || typeof context.right === 'function' ) {
        throw new Error('functions are not supported');
    }
    context.leftType = context.left === null ? 'null' : typeof context.left;
    context.rightType = context.right === null ? 'null' : typeof context.right;
    if (context.leftType !== context.rightType) {
        context.setResult([context.left, context.right]).exit();
        return;
    }
    if (context.leftType === 'boolean' || context.leftType === 'number') {
        context.setResult([context.left, context.right]).exit();
        return;
    }
    if (context.leftType === 'object') {
        context.leftIsArray = isArray(context.left);
    }
    if (context.rightType === 'object') {
        context.rightIsArray = isArray(context.right);
    }
    if (context.leftIsArray !== context.rightIsArray) {
        context.setResult([context.left, context.right]).exit();
        return;
    }
};
diffFilter.filterName = 'trivial';

var patchFilter = function trivialMatchesPatchFilter(context) {
    if (typeof context.delta === 'undefined') {
        context.setResult(context.left).exit();
        return;
    }
    context.nested = !isArray(context.delta);
    if (context.nested) { return; }
    if (context.delta.length === 1) {
        context.setResult(context.delta[0]).exit();
        return;
    }
    if (context.delta.length === 2) {
        context.setResult(context.delta[1]).exit();
        return;
    }
    if (context.delta.length === 3 && context.delta[2] === 0) {
        context.setResult(undefined).exit();
        return;
    }
};
patchFilter.filterName = 'trivial';

var reverseFilter = function trivialReferseFilter(context) {
    if (typeof context.delta === 'undefined') {
        context.setResult(context.delta).exit();
        return;
    }
    context.nested = !isArray(context.delta);
    if (context.nested) { return; }
    if (context.delta.length === 1) {
        context.setResult([context.delta[0], 0, 0]).exit();
        return;
    }
    if (context.delta.length === 2) {
        context.setResult([context.delta[1], context.delta[0]]).exit();
        return;
    }
    if (context.delta.length === 3 && context.delta[2] === 0) {
        context.setResult([context.delta[0]]).exit();
        return;
    }
};
reverseFilter.filterName = 'trivial';

exports.diffFilter = diffFilter;
exports.patchFilter = patchFilter;
exports.reverseFilter = reverseFilter;

},{}],15:[function(_dereq_,module,exports){

var Pipe = function Pipe(name){
    this.name = name;
    this.filters = [];
};

Pipe.prototype.process = function(input) {
    if (!this.processor) {
        throw new Error('add this pipe to a processor before using it');
    }
    var debug = this.debug;
    var length = this.filters.length;
    var context = input;
    for (var index = 0; index < length; index++) {
        var filter = this.filters[index];
        if (debug) {
            this.log('filter: ' + filter.filterName);
        }
        filter(context);
        if (typeof context === 'object' && context.exiting) {
            context.exiting = false;
            break;
        }
    }
    if (!context.next && this.resultCheck) {
        this.resultCheck(context);
    }
};

Pipe.prototype.log = function(msg) {
    console.log('[jsondiffpatch] ' + this.name + ' pipe, ' + msg);
};

Pipe.prototype.append = function() {
    this.filters.push.apply(this.filters, arguments);
    return this;
};

Pipe.prototype.prepend = function() {
    this.filters.unshift.apply(this.filters, arguments);
    return this;
};

Pipe.prototype.indexOf = function(filterName) {
    if (!filterName) {
        throw new Error('a filter name is required');
    }
    for (var index = 0; index < this.filters.length; index++) {
        var filter = this.filters[index];
        if (filter.filterName === filterName) {
            return index;
        }
    }
    throw new Error('filter not found: ' + filterName);
};

Pipe.prototype.list = function() {
    var names = [];
    for (var index = 0; index < this.filters.length; index++) {
        var filter = this.filters[index];
        names.push(filter.filterName);
    }
    return names;
};

Pipe.prototype.after = function(filterName) {
    var index = this.indexOf(filterName);
    var params = Array.prototype.slice.call(arguments, 1);
    if (!params.length) {
        throw new Error('a filter is required');
    }
    params.unshift(index + 1, 0);
    Array.prototype.splice.apply(this.filters, params);
    return this;
};

Pipe.prototype.before = function(filterName) {
    var index = this.indexOf(filterName);
    var params = Array.prototype.slice.call(arguments, 1);
    if (!params.length) {
        throw new Error('a filter is required');
    }
    params.unshift(index, 0);
    Array.prototype.splice.apply(this.filters, params);
    return this;
};

Pipe.prototype.clear = function() {
    this.filters.length = 0;
    return this;
};

Pipe.prototype.shouldHaveResult = function(should) {
    if (should === false) {
        this.resultCheck = null;
        return;
    }
    if (this.resultCheck) { return; }
    var pipe = this;
    this.resultCheck = function(context) {
        if (!context.hasResult) {
            console.log(context);
            var error = new Error(pipe.name + ' failed');
            error.noResult = true;
            throw error;
        }
    };
    return this;
};

exports.Pipe = Pipe;
},{}],16:[function(_dereq_,module,exports){

var Processor = function Processor(options){
	this.selfOptions = options;
	this.pipes = {};
};

Processor.prototype.options = function(options) {
	if (options) {
		this.selfOptions = options;
	}
	return this.selfOptions;
};

Processor.prototype.pipe = function(name, pipe) {
	if (typeof name === 'string') {
		if (typeof pipe === 'undefined') {
			return this.pipes[name];
		} else {
			this.pipes[name] = pipe;
		}
	}
	if (name && name.name) {
		pipe = name;
		if (pipe.processor === this) { return pipe; }
		this.pipes[pipe.name] = pipe;
	}
	pipe.processor = this;
	return pipe;
};

Processor.prototype.process = function(input, pipe) {
	var context = input;
	context.options = this.options();
	var nextPipe = pipe || input.pipe || 'default';
	var lastPipe, lastContext;
	while (nextPipe) {
		if (typeof context.nextAfterChildren !== 'undefined') {
			// children processed and coming back to parent
			context.next = context.nextAfterChildren;
			context.nextAfterChildren = null;
		}

		if (typeof nextPipe === 'string') {
			nextPipe = this.pipe(nextPipe);
		}
		nextPipe.process(context);
		lastContext = context;
		lastPipe = nextPipe;
		nextPipe = null;
		if (context) {
			if (context.next) {
				context = context.next;
				nextPipe = lastContext.nextPipe || context.pipe || lastPipe;
			}
		}
	}
	return context.hasResult ? context.result : undefined;
};

exports.Processor = Processor;

},{}]},{},[8])
(8)
});
var define, requireModule, require, requirejs;

(function() {
  var registry = {}, seen = {}, state = {};
  var FAILED = false;

  define = function(name, deps, callback) {
    registry[name] = {
      deps: deps,
      callback: callback
    };
  };

  function reify(deps, name, seen) {
    var length = deps.length;
    var reified = new Array(length);
    var dep;
    var exports;

    for (var i = 0, l = length; i < l; i++) {
      dep = deps[i];
      if (dep === 'exports') {
        exports = reified[i] = seen;
      } else {
        reified[i] = require(resolve(dep, name));
      }
    }

    return {
      deps: reified,
      exports: exports
    };
  }

  requirejs = require = requireModule = function(name) {
    if (state[name] !== FAILED &&
        seen.hasOwnProperty(name)) {
      return seen[name];
    }

    if (!registry[name]) {
      throw new Error('Could not find module ' + name);
    }

    var mod = registry[name];
    var reified;
    var module;
    var loaded = false;

    seen[name] = { }; // placeholder for run-time cycles

    try {
      reified = reify(mod.deps, name, seen[name]);
      module = mod.callback.apply(this, reified.deps);
      loaded = true;
    } finally {
      if (!loaded) {
        state[name] = FAILED;
      }
    }

    return reified.exports ? seen[name] : (seen[name] = module);
  };

  function resolve(child, name) {
    if (child.charAt(0) !== '.') { return child; }

    var parts = child.split('/');
    var nameParts = name.split('/');
    var parentBase;

    if (nameParts.length === 1) {
      parentBase = nameParts;
    } else {
      parentBase = nameParts.slice(0, -1);
    }

    for (var i = 0, l = parts.length; i < l; i++) {
      var part = parts[i];

      if (part === '..') { parentBase.pop(); }
      else if (part === '.') { continue; }
      else { parentBase.push(part); }
    }

    return parentBase.join('/');
  }

  requirejs.entries = requirejs._eak_seen = registry;
  requirejs.clear = function(){
    requirejs.entries = requirejs._eak_seen = registry = {};
    seen = state = {};
  };
})();

(function(global) {
  'use strict';
  if (global.$traceurRuntime) {
    return;
  }
  var $Object = Object;
  var $TypeError = TypeError;
  var $create = $Object.create;
  var $defineProperties = $Object.defineProperties;
  var $defineProperty = $Object.defineProperty;
  var $freeze = $Object.freeze;
  var $getOwnPropertyDescriptor = $Object.getOwnPropertyDescriptor;
  var $getOwnPropertyNames = $Object.getOwnPropertyNames;
  var $keys = $Object.keys;
  var $hasOwnProperty = $Object.prototype.hasOwnProperty;
  var $toString = $Object.prototype.toString;
  var $preventExtensions = Object.preventExtensions;
  var $seal = Object.seal;
  var $isExtensible = Object.isExtensible;
  function nonEnum(value) {
    return {
      configurable: true,
      enumerable: false,
      value: value,
      writable: true
    };
  }
  var types = {
    void: function voidType() {},
    any: function any() {},
    string: function string() {},
    number: function number() {},
    boolean: function boolean() {}
  };
  var method = nonEnum;
  var counter = 0;
  function newUniqueString() {
    return '__$' + Math.floor(Math.random() * 1e9) + '$' + ++counter + '$__';
  }
  var symbolInternalProperty = newUniqueString();
  var symbolDescriptionProperty = newUniqueString();
  var symbolDataProperty = newUniqueString();
  var symbolValues = $create(null);
  var privateNames = $create(null);
  function createPrivateName() {
    var s = newUniqueString();
    privateNames[s] = true;
    return s;
  }
  function isSymbol(symbol) {
    return typeof symbol === 'object' && symbol instanceof SymbolValue;
  }
  function typeOf(v) {
    if (isSymbol(v))
      return 'symbol';
    return typeof v;
  }
  function Symbol(description) {
    var value = new SymbolValue(description);
    if (!(this instanceof Symbol))
      return value;
    throw new TypeError('Symbol cannot be new\'ed');
  }
  $defineProperty(Symbol.prototype, 'constructor', nonEnum(Symbol));
  $defineProperty(Symbol.prototype, 'toString', method(function() {
    var symbolValue = this[symbolDataProperty];
    if (!getOption('symbols'))
      return symbolValue[symbolInternalProperty];
    if (!symbolValue)
      throw TypeError('Conversion from symbol to string');
    var desc = symbolValue[symbolDescriptionProperty];
    if (desc === undefined)
      desc = '';
    return 'Symbol(' + desc + ')';
  }));
  $defineProperty(Symbol.prototype, 'valueOf', method(function() {
    var symbolValue = this[symbolDataProperty];
    if (!symbolValue)
      throw TypeError('Conversion from symbol to string');
    if (!getOption('symbols'))
      return symbolValue[symbolInternalProperty];
    return symbolValue;
  }));
  function SymbolValue(description) {
    var key = newUniqueString();
    $defineProperty(this, symbolDataProperty, {value: this});
    $defineProperty(this, symbolInternalProperty, {value: key});
    $defineProperty(this, symbolDescriptionProperty, {value: description});
    freeze(this);
    symbolValues[key] = this;
  }
  $defineProperty(SymbolValue.prototype, 'constructor', nonEnum(Symbol));
  $defineProperty(SymbolValue.prototype, 'toString', {
    value: Symbol.prototype.toString,
    enumerable: false
  });
  $defineProperty(SymbolValue.prototype, 'valueOf', {
    value: Symbol.prototype.valueOf,
    enumerable: false
  });
  var hashProperty = createPrivateName();
  var hashPropertyDescriptor = {value: undefined};
  var hashObjectProperties = {
    hash: {value: undefined},
    self: {value: undefined}
  };
  var hashCounter = 0;
  function getOwnHashObject(object) {
    var hashObject = object[hashProperty];
    if (hashObject && hashObject.self === object)
      return hashObject;
    if ($isExtensible(object)) {
      hashObjectProperties.hash.value = hashCounter++;
      hashObjectProperties.self.value = object;
      hashPropertyDescriptor.value = $create(null, hashObjectProperties);
      $defineProperty(object, hashProperty, hashPropertyDescriptor);
      return hashPropertyDescriptor.value;
    }
    return undefined;
  }
  function freeze(object) {
    getOwnHashObject(object);
    return $freeze.apply(this, arguments);
  }
  function preventExtensions(object) {
    getOwnHashObject(object);
    return $preventExtensions.apply(this, arguments);
  }
  function seal(object) {
    getOwnHashObject(object);
    return $seal.apply(this, arguments);
  }
  Symbol.iterator = Symbol();
  freeze(SymbolValue.prototype);
  function toProperty(name) {
    if (isSymbol(name))
      return name[symbolInternalProperty];
    return name;
  }
  function getOwnPropertyNames(object) {
    var rv = [];
    var names = $getOwnPropertyNames(object);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (!symbolValues[name] && !privateNames[name])
        rv.push(name);
    }
    return rv;
  }
  function getOwnPropertyDescriptor(object, name) {
    return $getOwnPropertyDescriptor(object, toProperty(name));
  }
  function getOwnPropertySymbols(object) {
    var rv = [];
    var names = $getOwnPropertyNames(object);
    for (var i = 0; i < names.length; i++) {
      var symbol = symbolValues[names[i]];
      if (symbol)
        rv.push(symbol);
    }
    return rv;
  }
  function hasOwnProperty(name) {
    return $hasOwnProperty.call(this, toProperty(name));
  }
  function getOption(name) {
    return global.traceur && global.traceur.options[name];
  }
  function setProperty(object, name, value) {
    var sym,
        desc;
    if (isSymbol(name)) {
      sym = name;
      name = name[symbolInternalProperty];
    }
    object[name] = value;
    if (sym && (desc = $getOwnPropertyDescriptor(object, name)))
      $defineProperty(object, name, {enumerable: false});
    return value;
  }
  function defineProperty(object, name, descriptor) {
    if (isSymbol(name)) {
      if (descriptor.enumerable) {
        descriptor = $create(descriptor, {enumerable: {value: false}});
      }
      name = name[symbolInternalProperty];
    }
    $defineProperty(object, name, descriptor);
    return object;
  }
  function polyfillObject(Object) {
    $defineProperty(Object, 'defineProperty', {value: defineProperty});
    $defineProperty(Object, 'getOwnPropertyNames', {value: getOwnPropertyNames});
    $defineProperty(Object, 'getOwnPropertyDescriptor', {value: getOwnPropertyDescriptor});
    $defineProperty(Object.prototype, 'hasOwnProperty', {value: hasOwnProperty});
    $defineProperty(Object, 'freeze', {value: freeze});
    $defineProperty(Object, 'preventExtensions', {value: preventExtensions});
    $defineProperty(Object, 'seal', {value: seal});
    Object.getOwnPropertySymbols = getOwnPropertySymbols;
  }
  function exportStar(object) {
    for (var i = 1; i < arguments.length; i++) {
      var names = $getOwnPropertyNames(arguments[i]);
      for (var j = 0; j < names.length; j++) {
        var name = names[j];
        if (privateNames[name])
          continue;
        (function(mod, name) {
          $defineProperty(object, name, {
            get: function() {
              return mod[name];
            },
            enumerable: true
          });
        })(arguments[i], names[j]);
      }
    }
    return object;
  }
  function isObject(x) {
    return x != null && (typeof x === 'object' || typeof x === 'function');
  }
  function toObject(x) {
    if (x == null)
      throw $TypeError();
    return $Object(x);
  }
  function assertObject(x) {
    if (!isObject(x))
      throw $TypeError(x + ' is not an Object');
    return x;
  }
  function setupGlobals(global) {
    global.Symbol = Symbol;
    global.Reflect = global.Reflect || {};
    global.Reflect.global = global.Reflect.global || global;
    polyfillObject(global.Object);
  }
  setupGlobals(global);
  global.$traceurRuntime = {
    assertObject: assertObject,
    createPrivateName: createPrivateName,
    exportStar: exportStar,
    getOwnHashObject: getOwnHashObject,
    privateNames: privateNames,
    setProperty: setProperty,
    setupGlobals: setupGlobals,
    toObject: toObject,
    isObject: isObject,
    toProperty: toProperty,
    type: types,
    typeof: typeOf,
    defineProperties: $defineProperties,
    defineProperty: $defineProperty,
    getOwnPropertyDescriptor: $getOwnPropertyDescriptor,
    getOwnPropertyNames: $getOwnPropertyNames,
    keys: $keys
  };
})(typeof global !== 'undefined' ? global : this);
(function() {
  'use strict';
  function spread() {
    var rv = [],
        j = 0,
        iterResult;
    for (var i = 0; i < arguments.length; i++) {
      var valueToSpread = arguments[i];
      if (!$traceurRuntime.isObject(valueToSpread)) {
        throw new TypeError('Cannot spread non-object.');
      }
      if (typeof valueToSpread[$traceurRuntime.toProperty(Symbol.iterator)] !== 'function') {
        throw new TypeError('Cannot spread non-iterable object.');
      }
      var iter = valueToSpread[$traceurRuntime.toProperty(Symbol.iterator)]();
      while (!(iterResult = iter.next()).done) {
        rv[j++] = iterResult.value;
      }
    }
    return rv;
  }
  $traceurRuntime.spread = spread;
})();
(function() {
  'use strict';
  var $Object = Object;
  var $TypeError = TypeError;
  var $create = $Object.create;
  var $defineProperties = $traceurRuntime.defineProperties;
  var $defineProperty = $traceurRuntime.defineProperty;
  var $getOwnPropertyDescriptor = $traceurRuntime.getOwnPropertyDescriptor;
  var $getOwnPropertyNames = $traceurRuntime.getOwnPropertyNames;
  var $getPrototypeOf = Object.getPrototypeOf;
  function superDescriptor(homeObject, name) {
    var proto = $getPrototypeOf(homeObject);
    do {
      var result = $getOwnPropertyDescriptor(proto, name);
      if (result)
        return result;
      proto = $getPrototypeOf(proto);
    } while (proto);
    return undefined;
  }
  function superCall(self, homeObject, name, args) {
    return superGet(self, homeObject, name).apply(self, args);
  }
  function superGet(self, homeObject, name) {
    var descriptor = superDescriptor(homeObject, name);
    if (descriptor) {
      if (!descriptor.get)
        return descriptor.value;
      return descriptor.get.call(self);
    }
    return undefined;
  }
  function superSet(self, homeObject, name, value) {
    var descriptor = superDescriptor(homeObject, name);
    if (descriptor && descriptor.set) {
      descriptor.set.call(self, value);
      return value;
    }
    throw $TypeError("super has no setter '" + name + "'.");
  }
  function getDescriptors(object) {
    var descriptors = {},
        name,
        names = $getOwnPropertyNames(object);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      descriptors[name] = $getOwnPropertyDescriptor(object, name);
    }
    return descriptors;
  }
  function createClass(ctor, object, staticObject, superClass) {
    $defineProperty(object, 'constructor', {
      value: ctor,
      configurable: true,
      enumerable: false,
      writable: true
    });
    if (arguments.length > 3) {
      if (typeof superClass === 'function')
        ctor.__proto__ = superClass;
      ctor.prototype = $create(getProtoParent(superClass), getDescriptors(object));
    } else {
      ctor.prototype = object;
    }
    $defineProperty(ctor, 'prototype', {
      configurable: false,
      writable: false
    });
    return $defineProperties(ctor, getDescriptors(staticObject));
  }
  function getProtoParent(superClass) {
    if (typeof superClass === 'function') {
      var prototype = superClass.prototype;
      if ($Object(prototype) === prototype || prototype === null)
        return superClass.prototype;
    }
    if (superClass === null)
      return null;
    throw new $TypeError();
  }
  function defaultSuperCall(self, homeObject, args) {
    if ($getPrototypeOf(homeObject) !== null)
      superCall(self, homeObject, 'constructor', args);
  }
  $traceurRuntime.createClass = createClass;
  $traceurRuntime.defaultSuperCall = defaultSuperCall;
  $traceurRuntime.superCall = superCall;
  $traceurRuntime.superGet = superGet;
  $traceurRuntime.superSet = superSet;
})();
(function() {
  'use strict';
  var createPrivateName = $traceurRuntime.createPrivateName;
  var $defineProperties = $traceurRuntime.defineProperties;
  var $defineProperty = $traceurRuntime.defineProperty;
  var $create = Object.create;
  var $TypeError = TypeError;
  function nonEnum(value) {
    return {
      configurable: true,
      enumerable: false,
      value: value,
      writable: true
    };
  }
  var ST_NEWBORN = 0;
  var ST_EXECUTING = 1;
  var ST_SUSPENDED = 2;
  var ST_CLOSED = 3;
  var END_STATE = -2;
  var RETHROW_STATE = -3;
  function getInternalError(state) {
    return new Error('Traceur compiler bug: invalid state in state machine: ' + state);
  }
  function GeneratorContext() {
    this.state = 0;
    this.GState = ST_NEWBORN;
    this.storedException = undefined;
    this.finallyFallThrough = undefined;
    this.sent_ = undefined;
    this.returnValue = undefined;
    this.tryStack_ = [];
  }
  GeneratorContext.prototype = {
    pushTry: function(catchState, finallyState) {
      if (finallyState !== null) {
        var finallyFallThrough = null;
        for (var i = this.tryStack_.length - 1; i >= 0; i--) {
          if (this.tryStack_[i].catch !== undefined) {
            finallyFallThrough = this.tryStack_[i].catch;
            break;
          }
        }
        if (finallyFallThrough === null)
          finallyFallThrough = RETHROW_STATE;
        this.tryStack_.push({
          finally: finallyState,
          finallyFallThrough: finallyFallThrough
        });
      }
      if (catchState !== null) {
        this.tryStack_.push({catch: catchState});
      }
    },
    popTry: function() {
      this.tryStack_.pop();
    },
    get sent() {
      this.maybeThrow();
      return this.sent_;
    },
    set sent(v) {
      this.sent_ = v;
    },
    get sentIgnoreThrow() {
      return this.sent_;
    },
    maybeThrow: function() {
      if (this.action === 'throw') {
        this.action = 'next';
        throw this.sent_;
      }
    },
    end: function() {
      switch (this.state) {
        case END_STATE:
          return this;
        case RETHROW_STATE:
          throw this.storedException;
        default:
          throw getInternalError(this.state);
      }
    },
    handleException: function(ex) {
      this.GState = ST_CLOSED;
      this.state = END_STATE;
      throw ex;
    }
  };
  function nextOrThrow(ctx, moveNext, action, x) {
    switch (ctx.GState) {
      case ST_EXECUTING:
        throw new Error(("\"" + action + "\" on executing generator"));
      case ST_CLOSED:
        if (action == 'next') {
          return {
            value: undefined,
            done: true
          };
        }
        throw x;
      case ST_NEWBORN:
        if (action === 'throw') {
          ctx.GState = ST_CLOSED;
          throw x;
        }
        if (x !== undefined)
          throw $TypeError('Sent value to newborn generator');
      case ST_SUSPENDED:
        ctx.GState = ST_EXECUTING;
        ctx.action = action;
        ctx.sent = x;
        var value = moveNext(ctx);
        var done = value === ctx;
        if (done)
          value = ctx.returnValue;
        ctx.GState = done ? ST_CLOSED : ST_SUSPENDED;
        return {
          value: value,
          done: done
        };
    }
  }
  var ctxName = createPrivateName();
  var moveNextName = createPrivateName();
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}
  GeneratorFunction.prototype = GeneratorFunctionPrototype;
  $defineProperty(GeneratorFunctionPrototype, 'constructor', nonEnum(GeneratorFunction));
  GeneratorFunctionPrototype.prototype = {
    constructor: GeneratorFunctionPrototype,
    next: function(v) {
      return nextOrThrow(this[ctxName], this[moveNextName], 'next', v);
    },
    throw: function(v) {
      return nextOrThrow(this[ctxName], this[moveNextName], 'throw', v);
    }
  };
  $defineProperties(GeneratorFunctionPrototype.prototype, {
    constructor: {enumerable: false},
    next: {enumerable: false},
    throw: {enumerable: false}
  });
  Object.defineProperty(GeneratorFunctionPrototype.prototype, Symbol.iterator, nonEnum(function() {
    return this;
  }));
  function createGeneratorInstance(innerFunction, functionObject, self) {
    var moveNext = getMoveNext(innerFunction, self);
    var ctx = new GeneratorContext();
    var object = $create(functionObject.prototype);
    object[ctxName] = ctx;
    object[moveNextName] = moveNext;
    return object;
  }
  function initGeneratorFunction(functionObject) {
    functionObject.prototype = $create(GeneratorFunctionPrototype.prototype);
    functionObject.__proto__ = GeneratorFunctionPrototype;
    return functionObject;
  }
  function AsyncFunctionContext() {
    GeneratorContext.call(this);
    this.err = undefined;
    var ctx = this;
    ctx.result = new Promise(function(resolve, reject) {
      ctx.resolve = resolve;
      ctx.reject = reject;
    });
  }
  AsyncFunctionContext.prototype = $create(GeneratorContext.prototype);
  AsyncFunctionContext.prototype.end = function() {
    switch (this.state) {
      case END_STATE:
        this.resolve(this.returnValue);
        break;
      case RETHROW_STATE:
        this.reject(this.storedException);
        break;
      default:
        this.reject(getInternalError(this.state));
    }
  };
  AsyncFunctionContext.prototype.handleException = function() {
    this.state = RETHROW_STATE;
  };
  function asyncWrap(innerFunction, self) {
    var moveNext = getMoveNext(innerFunction, self);
    var ctx = new AsyncFunctionContext();
    ctx.createCallback = function(newState) {
      return function(value) {
        ctx.state = newState;
        ctx.value = value;
        moveNext(ctx);
      };
    };
    ctx.errback = function(err) {
      handleCatch(ctx, err);
      moveNext(ctx);
    };
    moveNext(ctx);
    return ctx.result;
  }
  function getMoveNext(innerFunction, self) {
    return function(ctx) {
      while (true) {
        try {
          return innerFunction.call(self, ctx);
        } catch (ex) {
          handleCatch(ctx, ex);
        }
      }
    };
  }
  function handleCatch(ctx, ex) {
    ctx.storedException = ex;
    var last = ctx.tryStack_[ctx.tryStack_.length - 1];
    if (!last) {
      ctx.handleException(ex);
      return;
    }
    ctx.state = last.catch !== undefined ? last.catch : last.finally;
    if (last.finallyFallThrough !== undefined)
      ctx.finallyFallThrough = last.finallyFallThrough;
  }
  $traceurRuntime.asyncWrap = asyncWrap;
  $traceurRuntime.initGeneratorFunction = initGeneratorFunction;
  $traceurRuntime.createGeneratorInstance = createGeneratorInstance;
})();
(function() {
  function buildFromEncodedParts(opt_scheme, opt_userInfo, opt_domain, opt_port, opt_path, opt_queryData, opt_fragment) {
    var out = [];
    if (opt_scheme) {
      out.push(opt_scheme, ':');
    }
    if (opt_domain) {
      out.push('//');
      if (opt_userInfo) {
        out.push(opt_userInfo, '@');
      }
      out.push(opt_domain);
      if (opt_port) {
        out.push(':', opt_port);
      }
    }
    if (opt_path) {
      out.push(opt_path);
    }
    if (opt_queryData) {
      out.push('?', opt_queryData);
    }
    if (opt_fragment) {
      out.push('#', opt_fragment);
    }
    return out.join('');
  }
  ;
  var splitRe = new RegExp('^' + '(?:' + '([^:/?#.]+)' + ':)?' + '(?://' + '(?:([^/?#]*)@)?' + '([\\w\\d\\-\\u0100-\\uffff.%]*)' + '(?::([0-9]+))?' + ')?' + '([^?#]+)?' + '(?:\\?([^#]*))?' + '(?:#(.*))?' + '$');
  var ComponentIndex = {
    SCHEME: 1,
    USER_INFO: 2,
    DOMAIN: 3,
    PORT: 4,
    PATH: 5,
    QUERY_DATA: 6,
    FRAGMENT: 7
  };
  function split(uri) {
    return (uri.match(splitRe));
  }
  function removeDotSegments(path) {
    if (path === '/')
      return '/';
    var leadingSlash = path[0] === '/' ? '/' : '';
    var trailingSlash = path.slice(-1) === '/' ? '/' : '';
    var segments = path.split('/');
    var out = [];
    var up = 0;
    for (var pos = 0; pos < segments.length; pos++) {
      var segment = segments[pos];
      switch (segment) {
        case '':
        case '.':
          break;
        case '..':
          if (out.length)
            out.pop();
          else
            up++;
          break;
        default:
          out.push(segment);
      }
    }
    if (!leadingSlash) {
      while (up-- > 0) {
        out.unshift('..');
      }
      if (out.length === 0)
        out.push('.');
    }
    return leadingSlash + out.join('/') + trailingSlash;
  }
  function joinAndCanonicalizePath(parts) {
    var path = parts[ComponentIndex.PATH] || '';
    path = removeDotSegments(path);
    parts[ComponentIndex.PATH] = path;
    return buildFromEncodedParts(parts[ComponentIndex.SCHEME], parts[ComponentIndex.USER_INFO], parts[ComponentIndex.DOMAIN], parts[ComponentIndex.PORT], parts[ComponentIndex.PATH], parts[ComponentIndex.QUERY_DATA], parts[ComponentIndex.FRAGMENT]);
  }
  function canonicalizeUrl(url) {
    var parts = split(url);
    return joinAndCanonicalizePath(parts);
  }
  function resolveUrl(base, url) {
    var parts = split(url);
    var baseParts = split(base);
    if (parts[ComponentIndex.SCHEME]) {
      return joinAndCanonicalizePath(parts);
    } else {
      parts[ComponentIndex.SCHEME] = baseParts[ComponentIndex.SCHEME];
    }
    for (var i = ComponentIndex.SCHEME; i <= ComponentIndex.PORT; i++) {
      if (!parts[i]) {
        parts[i] = baseParts[i];
      }
    }
    if (parts[ComponentIndex.PATH][0] == '/') {
      return joinAndCanonicalizePath(parts);
    }
    var path = baseParts[ComponentIndex.PATH];
    var index = path.lastIndexOf('/');
    path = path.slice(0, index + 1) + parts[ComponentIndex.PATH];
    parts[ComponentIndex.PATH] = path;
    return joinAndCanonicalizePath(parts);
  }
  function isAbsolute(name) {
    if (!name)
      return false;
    if (name[0] === '/')
      return true;
    var parts = split(name);
    if (parts[ComponentIndex.SCHEME])
      return true;
    return false;
  }
  $traceurRuntime.canonicalizeUrl = canonicalizeUrl;
  $traceurRuntime.isAbsolute = isAbsolute;
  $traceurRuntime.removeDotSegments = removeDotSegments;
  $traceurRuntime.resolveUrl = resolveUrl;
})();
(function(global) {
  'use strict';
  var $__2 = $traceurRuntime.assertObject($traceurRuntime),
      canonicalizeUrl = $__2.canonicalizeUrl,
      resolveUrl = $__2.resolveUrl,
      isAbsolute = $__2.isAbsolute;
  var moduleInstantiators = Object.create(null);
  var baseURL;
  if (global.location && global.location.href)
    baseURL = resolveUrl(global.location.href, './');
  else
    baseURL = '';
  var UncoatedModuleEntry = function UncoatedModuleEntry(url, uncoatedModule) {
    this.url = url;
    this.value_ = uncoatedModule;
  };
  ($traceurRuntime.createClass)(UncoatedModuleEntry, {}, {});
  var UncoatedModuleInstantiator = function UncoatedModuleInstantiator(url, func) {
    $traceurRuntime.superCall(this, $UncoatedModuleInstantiator.prototype, "constructor", [url, null]);
    this.func = func;
  };
  var $UncoatedModuleInstantiator = UncoatedModuleInstantiator;
  ($traceurRuntime.createClass)(UncoatedModuleInstantiator, {getUncoatedModule: function() {
      if (this.value_)
        return this.value_;
      return this.value_ = this.func.call(global);
    }}, {}, UncoatedModuleEntry);
  function getUncoatedModuleInstantiator(name) {
    if (!name)
      return;
    var url = ModuleStore.normalize(name);
    return moduleInstantiators[url];
  }
  ;
  var moduleInstances = Object.create(null);
  var liveModuleSentinel = {};
  function Module(uncoatedModule) {
    var isLive = arguments[1];
    var coatedModule = Object.create(null);
    Object.getOwnPropertyNames(uncoatedModule).forEach((function(name) {
      var getter,
          value;
      if (isLive === liveModuleSentinel) {
        var descr = Object.getOwnPropertyDescriptor(uncoatedModule, name);
        if (descr.get)
          getter = descr.get;
      }
      if (!getter) {
        value = uncoatedModule[name];
        getter = function() {
          return value;
        };
      }
      Object.defineProperty(coatedModule, name, {
        get: getter,
        enumerable: true
      });
    }));
    Object.preventExtensions(coatedModule);
    return coatedModule;
  }
  var ModuleStore = {
    normalize: function(name, refererName, refererAddress) {
      if (typeof name !== "string")
        throw new TypeError("module name must be a string, not " + typeof name);
      if (isAbsolute(name))
        return canonicalizeUrl(name);
      if (/[^\.]\/\.\.\//.test(name)) {
        throw new Error('module name embeds /../: ' + name);
      }
      if (name[0] === '.' && refererName)
        return resolveUrl(refererName, name);
      return canonicalizeUrl(name);
    },
    get: function(normalizedName) {
      var m = getUncoatedModuleInstantiator(normalizedName);
      if (!m)
        return undefined;
      var moduleInstance = moduleInstances[m.url];
      if (moduleInstance)
        return moduleInstance;
      moduleInstance = Module(m.getUncoatedModule(), liveModuleSentinel);
      return moduleInstances[m.url] = moduleInstance;
    },
    set: function(normalizedName, module) {
      normalizedName = String(normalizedName);
      moduleInstantiators[normalizedName] = new UncoatedModuleInstantiator(normalizedName, (function() {
        return module;
      }));
      moduleInstances[normalizedName] = module;
    },
    get baseURL() {
      return baseURL;
    },
    set baseURL(v) {
      baseURL = String(v);
    },
    registerModule: function(name, func) {
      var normalizedName = ModuleStore.normalize(name);
      if (moduleInstantiators[normalizedName])
        throw new Error('duplicate module named ' + normalizedName);
      moduleInstantiators[normalizedName] = new UncoatedModuleInstantiator(normalizedName, func);
    },
    bundleStore: Object.create(null),
    register: function(name, deps, func) {
      if (!deps || !deps.length && !func.length) {
        this.registerModule(name, func);
      } else {
        this.bundleStore[name] = {
          deps: deps,
          execute: function() {
            var $__0 = arguments;
            var depMap = {};
            deps.forEach((function(dep, index) {
              return depMap[dep] = $__0[index];
            }));
            var registryEntry = func.call(this, depMap);
            registryEntry.execute.call(this);
            return registryEntry.exports;
          }
        };
      }
    },
    getAnonymousModule: function(func) {
      return new Module(func.call(global), liveModuleSentinel);
    },
    getForTesting: function(name) {
      var $__0 = this;
      if (!this.testingPrefix_) {
        Object.keys(moduleInstances).some((function(key) {
          var m = /(traceur@[^\/]*\/)/.exec(key);
          if (m) {
            $__0.testingPrefix_ = m[1];
            return true;
          }
        }));
      }
      return this.get(this.testingPrefix_ + name);
    }
  };
  ModuleStore.set('@traceur/src/runtime/ModuleStore', new Module({ModuleStore: ModuleStore}));
  var setupGlobals = $traceurRuntime.setupGlobals;
  $traceurRuntime.setupGlobals = function(global) {
    setupGlobals(global);
  };
  $traceurRuntime.ModuleStore = ModuleStore;
  global.System = {
    register: ModuleStore.register.bind(ModuleStore),
    get: ModuleStore.get,
    set: ModuleStore.set,
    normalize: ModuleStore.normalize
  };
  $traceurRuntime.getModuleImpl = function(name) {
    var instantiator = getUncoatedModuleInstantiator(name);
    return instantiator && instantiator.getUncoatedModule();
  };
})(typeof global !== 'undefined' ? global : this);
System.register("traceur-runtime@0.0.49/src/runtime/polyfills/utils", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.49/src/runtime/polyfills/utils";
  var toObject = $traceurRuntime.toObject;
  function toUint32(x) {
    return x | 0;
  }
  function isObject(x) {
    return x && (typeof x === 'object' || typeof x === 'function');
  }
  function isCallable(x) {
    return typeof x === 'function';
  }
  function toInteger(x) {
    x = +x;
    if (isNaN(x))
      return 0;
    if (!isFinite(x) || x === 0)
      return x;
    return x > 0 ? Math.floor(x) : Math.ceil(x);
  }
  var MAX_SAFE_LENGTH = Math.pow(2, 53) - 1;
  function toLength(x) {
    var len = toInteger(x);
    return len < 0 ? 0 : Math.min(len, MAX_SAFE_LENGTH);
  }
  function checkIterable(x) {
    return !isObject(x) ? undefined : x[Symbol.iterator];
  }
  function isConstructor(x) {
    return isCallable(x);
  }
  return {
    get toObject() {
      return toObject;
    },
    get toUint32() {
      return toUint32;
    },
    get isObject() {
      return isObject;
    },
    get isCallable() {
      return isCallable;
    },
    get toInteger() {
      return toInteger;
    },
    get toLength() {
      return toLength;
    },
    get checkIterable() {
      return checkIterable;
    },
    get isConstructor() {
      return isConstructor;
    }
  };
});
System.register("traceur-runtime@0.0.49/src/runtime/polyfills/Array", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.49/src/runtime/polyfills/Array";
  var $__3 = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/utils"),
      isCallable = $__3.isCallable,
      isConstructor = $__3.isConstructor,
      checkIterable = $__3.checkIterable,
      toInteger = $__3.toInteger,
      toLength = $__3.toLength,
      toObject = $__3.toObject;
  function from(arrLike) {
    var mapFn = arguments[1];
    var thisArg = arguments[2];
    var C = this;
    var items = toObject(arrLike);
    var mapping = mapFn !== undefined;
    var k = 0;
    var arr,
        len;
    if (mapping && !isCallable(mapFn)) {
      throw TypeError();
    }
    if (checkIterable(items)) {
      arr = isConstructor(C) ? new C() : [];
      for (var $__4 = items[Symbol.iterator](),
          $__5; !($__5 = $__4.next()).done; ) {
        var item = $__5.value;
        {
          if (mapping) {
            arr[k] = mapFn.call(thisArg, item, k);
          } else {
            arr[k] = item;
          }
          k++;
        }
      }
      arr.length = k;
      return arr;
    }
    len = toLength(items.length);
    arr = isConstructor(C) ? new C(len) : new Array(len);
    for (; k < len; k++) {
      if (mapping) {
        arr[k] = mapFn.call(thisArg, items[k], k);
      } else {
        arr[k] = items[k];
      }
    }
    arr.length = len;
    return arr;
  }
  function fill(value) {
    var start = arguments[1] !== (void 0) ? arguments[1] : 0;
    var end = arguments[2];
    var object = toObject(this);
    var len = toLength(object.length);
    var fillStart = toInteger(start);
    var fillEnd = end !== undefined ? toInteger(end) : len;
    fillStart = fillStart < 0 ? Math.max(len + fillStart, 0) : Math.min(fillStart, len);
    fillEnd = fillEnd < 0 ? Math.max(len + fillEnd, 0) : Math.min(fillEnd, len);
    while (fillStart < fillEnd) {
      object[fillStart] = value;
      fillStart++;
    }
    return object;
  }
  function find(predicate) {
    var thisArg = arguments[1];
    return findHelper(this, predicate, thisArg);
  }
  function findIndex(predicate) {
    var thisArg = arguments[1];
    return findHelper(this, predicate, thisArg, true);
  }
  function findHelper(self, predicate) {
    var thisArg = arguments[2];
    var returnIndex = arguments[3] !== (void 0) ? arguments[3] : false;
    var object = toObject(self);
    var len = toLength(object.length);
    if (!isCallable(predicate)) {
      throw TypeError();
    }
    for (var i = 0; i < len; i++) {
      if (i in object) {
        var value = object[i];
        if (predicate.call(thisArg, value, i, object)) {
          return returnIndex ? i : value;
        }
      }
    }
    return returnIndex ? -1 : undefined;
  }
  return {
    get from() {
      return from;
    },
    get fill() {
      return fill;
    },
    get find() {
      return find;
    },
    get findIndex() {
      return findIndex;
    }
  };
});
System.register("traceur-runtime@0.0.49/src/runtime/polyfills/ArrayIterator", [], function() {
  "use strict";
  var $__8;
  var __moduleName = "traceur-runtime@0.0.49/src/runtime/polyfills/ArrayIterator";
  var $__6 = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/utils"),
      toObject = $__6.toObject,
      toUint32 = $__6.toUint32;
  var ARRAY_ITERATOR_KIND_KEYS = 1;
  var ARRAY_ITERATOR_KIND_VALUES = 2;
  var ARRAY_ITERATOR_KIND_ENTRIES = 3;
  var ArrayIterator = function ArrayIterator() {};
  ($traceurRuntime.createClass)(ArrayIterator, ($__8 = {}, Object.defineProperty($__8, "next", {
    value: function() {
      var iterator = toObject(this);
      var array = iterator.iteratorObject_;
      if (!array) {
        throw new TypeError('Object is not an ArrayIterator');
      }
      var index = iterator.arrayIteratorNextIndex_;
      var itemKind = iterator.arrayIterationKind_;
      var length = toUint32(array.length);
      if (index >= length) {
        iterator.arrayIteratorNextIndex_ = Infinity;
        return createIteratorResultObject(undefined, true);
      }
      iterator.arrayIteratorNextIndex_ = index + 1;
      if (itemKind == ARRAY_ITERATOR_KIND_VALUES)
        return createIteratorResultObject(array[index], false);
      if (itemKind == ARRAY_ITERATOR_KIND_ENTRIES)
        return createIteratorResultObject([index, array[index]], false);
      return createIteratorResultObject(index, false);
    },
    configurable: true,
    enumerable: true,
    writable: true
  }), Object.defineProperty($__8, Symbol.iterator, {
    value: function() {
      return this;
    },
    configurable: true,
    enumerable: true,
    writable: true
  }), $__8), {});
  function createArrayIterator(array, kind) {
    var object = toObject(array);
    var iterator = new ArrayIterator;
    iterator.iteratorObject_ = object;
    iterator.arrayIteratorNextIndex_ = 0;
    iterator.arrayIterationKind_ = kind;
    return iterator;
  }
  function createIteratorResultObject(value, done) {
    return {
      value: value,
      done: done
    };
  }
  function entries() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_ENTRIES);
  }
  function keys() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_KEYS);
  }
  function values() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_VALUES);
  }
  return {
    get entries() {
      return entries;
    },
    get keys() {
      return keys;
    },
    get values() {
      return values;
    }
  };
});
System.register("traceur-runtime@0.0.49/src/runtime/polyfills/Map", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.49/src/runtime/polyfills/Map";
  var isObject = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/utils").isObject;
  var getOwnHashObject = $traceurRuntime.getOwnHashObject;
  var $hasOwnProperty = Object.prototype.hasOwnProperty;
  var deletedSentinel = {};
  function lookupIndex(map, key) {
    if (isObject(key)) {
      var hashObject = getOwnHashObject(key);
      return hashObject && map.objectIndex_[hashObject.hash];
    }
    if (typeof key === 'string')
      return map.stringIndex_[key];
    return map.primitiveIndex_[key];
  }
  function initMap(map) {
    map.entries_ = [];
    map.objectIndex_ = Object.create(null);
    map.stringIndex_ = Object.create(null);
    map.primitiveIndex_ = Object.create(null);
    map.deletedCount_ = 0;
  }
  var Map = function Map() {
    var iterable = arguments[0];
    if (!isObject(this))
      throw new TypeError('Map called on incompatible type');
    if ($hasOwnProperty.call(this, 'entries_')) {
      throw new TypeError('Map can not be reentrantly initialised');
    }
    initMap(this);
    if (iterable !== null && iterable !== undefined) {
      for (var $__11 = iterable[Symbol.iterator](),
          $__12; !($__12 = $__11.next()).done; ) {
        var $__13 = $traceurRuntime.assertObject($__12.value),
            key = $__13[0],
            value = $__13[1];
        {
          this.set(key, value);
        }
      }
    }
  };
  ($traceurRuntime.createClass)(Map, {
    get size() {
      return this.entries_.length / 2 - this.deletedCount_;
    },
    get: function(key) {
      var index = lookupIndex(this, key);
      if (index !== undefined)
        return this.entries_[index + 1];
    },
    set: function(key, value) {
      var objectMode = isObject(key);
      var stringMode = typeof key === 'string';
      var index = lookupIndex(this, key);
      if (index !== undefined) {
        this.entries_[index + 1] = value;
      } else {
        index = this.entries_.length;
        this.entries_[index] = key;
        this.entries_[index + 1] = value;
        if (objectMode) {
          var hashObject = getOwnHashObject(key);
          var hash = hashObject.hash;
          this.objectIndex_[hash] = index;
        } else if (stringMode) {
          this.stringIndex_[key] = index;
        } else {
          this.primitiveIndex_[key] = index;
        }
      }
      return this;
    },
    has: function(key) {
      return lookupIndex(this, key) !== undefined;
    },
    delete: function(key) {
      var objectMode = isObject(key);
      var stringMode = typeof key === 'string';
      var index;
      var hash;
      if (objectMode) {
        var hashObject = getOwnHashObject(key);
        if (hashObject) {
          index = this.objectIndex_[hash = hashObject.hash];
          delete this.objectIndex_[hash];
        }
      } else if (stringMode) {
        index = this.stringIndex_[key];
        delete this.stringIndex_[key];
      } else {
        index = this.primitiveIndex_[key];
        delete this.primitiveIndex_[key];
      }
      if (index !== undefined) {
        this.entries_[index] = deletedSentinel;
        this.entries_[index + 1] = undefined;
        this.deletedCount_++;
      }
    },
    clear: function() {
      initMap(this);
    },
    forEach: function(callbackFn) {
      var thisArg = arguments[1];
      for (var i = 0,
          len = this.entries_.length; i < len; i += 2) {
        var key = this.entries_[i];
        var value = this.entries_[i + 1];
        if (key === deletedSentinel)
          continue;
        callbackFn.call(thisArg, value, key, this);
      }
    },
    entries: $traceurRuntime.initGeneratorFunction(function $__14() {
      var i,
          len,
          key,
          value;
      return $traceurRuntime.createGeneratorInstance(function($ctx) {
        while (true)
          switch ($ctx.state) {
            case 0:
              i = 0, len = this.entries_.length;
              $ctx.state = 12;
              break;
            case 12:
              $ctx.state = (i < len) ? 8 : -2;
              break;
            case 4:
              i += 2;
              $ctx.state = 12;
              break;
            case 8:
              key = this.entries_[i];
              value = this.entries_[i + 1];
              $ctx.state = 9;
              break;
            case 9:
              $ctx.state = (key === deletedSentinel) ? 4 : 6;
              break;
            case 6:
              $ctx.state = 2;
              return [key, value];
            case 2:
              $ctx.maybeThrow();
              $ctx.state = 4;
              break;
            default:
              return $ctx.end();
          }
      }, $__14, this);
    }),
    keys: $traceurRuntime.initGeneratorFunction(function $__15() {
      var i,
          len,
          key,
          value;
      return $traceurRuntime.createGeneratorInstance(function($ctx) {
        while (true)
          switch ($ctx.state) {
            case 0:
              i = 0, len = this.entries_.length;
              $ctx.state = 12;
              break;
            case 12:
              $ctx.state = (i < len) ? 8 : -2;
              break;
            case 4:
              i += 2;
              $ctx.state = 12;
              break;
            case 8:
              key = this.entries_[i];
              value = this.entries_[i + 1];
              $ctx.state = 9;
              break;
            case 9:
              $ctx.state = (key === deletedSentinel) ? 4 : 6;
              break;
            case 6:
              $ctx.state = 2;
              return key;
            case 2:
              $ctx.maybeThrow();
              $ctx.state = 4;
              break;
            default:
              return $ctx.end();
          }
      }, $__15, this);
    }),
    values: $traceurRuntime.initGeneratorFunction(function $__16() {
      var i,
          len,
          key,
          value;
      return $traceurRuntime.createGeneratorInstance(function($ctx) {
        while (true)
          switch ($ctx.state) {
            case 0:
              i = 0, len = this.entries_.length;
              $ctx.state = 12;
              break;
            case 12:
              $ctx.state = (i < len) ? 8 : -2;
              break;
            case 4:
              i += 2;
              $ctx.state = 12;
              break;
            case 8:
              key = this.entries_[i];
              value = this.entries_[i + 1];
              $ctx.state = 9;
              break;
            case 9:
              $ctx.state = (key === deletedSentinel) ? 4 : 6;
              break;
            case 6:
              $ctx.state = 2;
              return value;
            case 2:
              $ctx.maybeThrow();
              $ctx.state = 4;
              break;
            default:
              return $ctx.end();
          }
      }, $__16, this);
    })
  }, {});
  Object.defineProperty(Map.prototype, Symbol.iterator, {
    configurable: true,
    writable: true,
    value: Map.prototype.entries
  });
  return {get Map() {
      return Map;
    }};
});
System.register("traceur-runtime@0.0.49/src/runtime/polyfills/Object", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.49/src/runtime/polyfills/Object";
  var $__17 = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/utils"),
      toInteger = $__17.toInteger,
      toLength = $__17.toLength,
      toObject = $__17.toObject,
      isCallable = $__17.isCallable;
  var $__18 = $traceurRuntime.assertObject($traceurRuntime),
      defineProperty = $__18.defineProperty,
      getOwnPropertyDescriptor = $__18.getOwnPropertyDescriptor,
      getOwnPropertyNames = $__18.getOwnPropertyNames,
      keys = $__18.keys,
      privateNames = $__18.privateNames;
  function is(left, right) {
    if (left === right)
      return left !== 0 || 1 / left === 1 / right;
    return left !== left && right !== right;
  }
  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      var props = keys(source);
      var p,
          length = props.length;
      for (p = 0; p < length; p++) {
        var name = props[p];
        if (privateNames[name])
          continue;
        target[name] = source[name];
      }
    }
    return target;
  }
  function mixin(target, source) {
    var props = getOwnPropertyNames(source);
    var p,
        descriptor,
        length = props.length;
    for (p = 0; p < length; p++) {
      var name = props[p];
      if (privateNames[name])
        continue;
      descriptor = getOwnPropertyDescriptor(source, props[p]);
      defineProperty(target, props[p], descriptor);
    }
    return target;
  }
  return {
    get is() {
      return is;
    },
    get assign() {
      return assign;
    },
    get mixin() {
      return mixin;
    }
  };
});
System.register("traceur-runtime@0.0.49/node_modules/rsvp/lib/rsvp/asap", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.49/node_modules/rsvp/lib/rsvp/asap";
  function asap(callback, arg) {
    var length = queue.push([callback, arg]);
    if (length === 1) {
      scheduleFlush();
    }
  }
  var $__default = asap;
  ;
  var browserGlobal = (typeof window !== 'undefined') ? window : {};
  var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
  function useNextTick() {
    return function() {
      process.nextTick(flush);
    };
  }
  function useMutationObserver() {
    var iterations = 0;
    var observer = new BrowserMutationObserver(flush);
    var node = document.createTextNode('');
    observer.observe(node, {characterData: true});
    return function() {
      node.data = (iterations = ++iterations % 2);
    };
  }
  function useSetTimeout() {
    return function() {
      setTimeout(flush, 1);
    };
  }
  var queue = [];
  function flush() {
    for (var i = 0; i < queue.length; i++) {
      var tuple = queue[i];
      var callback = tuple[0],
          arg = tuple[1];
      callback(arg);
    }
    queue = [];
  }
  var scheduleFlush;
  if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
    scheduleFlush = useNextTick();
  } else if (BrowserMutationObserver) {
    scheduleFlush = useMutationObserver();
  } else {
    scheduleFlush = useSetTimeout();
  }
  return {get default() {
      return $__default;
    }};
});
System.register("traceur-runtime@0.0.49/src/runtime/polyfills/Promise", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.49/src/runtime/polyfills/Promise";
  var async = System.get("traceur-runtime@0.0.49/node_modules/rsvp/lib/rsvp/asap").default;
  var promiseRaw = {};
  function isPromise(x) {
    return x && typeof x === 'object' && x.status_ !== undefined;
  }
  function idResolveHandler(x) {
    return x;
  }
  function idRejectHandler(x) {
    throw x;
  }
  function chain(promise) {
    var onResolve = arguments[1] !== (void 0) ? arguments[1] : idResolveHandler;
    var onReject = arguments[2] !== (void 0) ? arguments[2] : idRejectHandler;
    var deferred = getDeferred(promise.constructor);
    switch (promise.status_) {
      case undefined:
        throw TypeError;
      case 0:
        promise.onResolve_.push(onResolve, deferred);
        promise.onReject_.push(onReject, deferred);
        break;
      case +1:
        promiseEnqueue(promise.value_, [onResolve, deferred]);
        break;
      case -1:
        promiseEnqueue(promise.value_, [onReject, deferred]);
        break;
    }
    return deferred.promise;
  }
  function getDeferred(C) {
    if (this === $Promise) {
      var promise = promiseInit(new $Promise(promiseRaw));
      return {
        promise: promise,
        resolve: (function(x) {
          promiseResolve(promise, x);
        }),
        reject: (function(r) {
          promiseReject(promise, r);
        })
      };
    } else {
      var result = {};
      result.promise = new C((function(resolve, reject) {
        result.resolve = resolve;
        result.reject = reject;
      }));
      return result;
    }
  }
  function promiseSet(promise, status, value, onResolve, onReject) {
    promise.status_ = status;
    promise.value_ = value;
    promise.onResolve_ = onResolve;
    promise.onReject_ = onReject;
    return promise;
  }
  function promiseInit(promise) {
    return promiseSet(promise, 0, undefined, [], []);
  }
  var Promise = function Promise(resolver) {
    if (resolver === promiseRaw)
      return;
    if (typeof resolver !== 'function')
      throw new TypeError;
    var promise = promiseInit(this);
    try {
      resolver((function(x) {
        promiseResolve(promise, x);
      }), (function(r) {
        promiseReject(promise, r);
      }));
    } catch (e) {
      promiseReject(promise, e);
    }
  };
  ($traceurRuntime.createClass)(Promise, {
    catch: function(onReject) {
      return this.then(undefined, onReject);
    },
    then: function(onResolve, onReject) {
      if (typeof onResolve !== 'function')
        onResolve = idResolveHandler;
      if (typeof onReject !== 'function')
        onReject = idRejectHandler;
      var that = this;
      var constructor = this.constructor;
      return chain(this, function(x) {
        x = promiseCoerce(constructor, x);
        return x === that ? onReject(new TypeError) : isPromise(x) ? x.then(onResolve, onReject) : onResolve(x);
      }, onReject);
    }
  }, {
    resolve: function(x) {
      if (this === $Promise) {
        return promiseSet(new $Promise(promiseRaw), +1, x);
      } else {
        return new this(function(resolve, reject) {
          resolve(x);
        });
      }
    },
    reject: function(r) {
      if (this === $Promise) {
        return promiseSet(new $Promise(promiseRaw), -1, r);
      } else {
        return new this((function(resolve, reject) {
          reject(r);
        }));
      }
    },
    cast: function(x) {
      if (x instanceof this)
        return x;
      if (isPromise(x)) {
        var result = getDeferred(this);
        chain(x, result.resolve, result.reject);
        return result.promise;
      }
      return this.resolve(x);
    },
    all: function(values) {
      var deferred = getDeferred(this);
      var resolutions = [];
      try {
        var count = values.length;
        if (count === 0) {
          deferred.resolve(resolutions);
        } else {
          for (var i = 0; i < values.length; i++) {
            this.resolve(values[i]).then(function(i, x) {
              resolutions[i] = x;
              if (--count === 0)
                deferred.resolve(resolutions);
            }.bind(undefined, i), (function(r) {
              deferred.reject(r);
            }));
          }
        }
      } catch (e) {
        deferred.reject(e);
      }
      return deferred.promise;
    },
    race: function(values) {
      var deferred = getDeferred(this);
      try {
        for (var i = 0; i < values.length; i++) {
          this.resolve(values[i]).then((function(x) {
            deferred.resolve(x);
          }), (function(r) {
            deferred.reject(r);
          }));
        }
      } catch (e) {
        deferred.reject(e);
      }
      return deferred.promise;
    }
  });
  var $Promise = Promise;
  var $PromiseReject = $Promise.reject;
  function promiseResolve(promise, x) {
    promiseDone(promise, +1, x, promise.onResolve_);
  }
  function promiseReject(promise, r) {
    promiseDone(promise, -1, r, promise.onReject_);
  }
  function promiseDone(promise, status, value, reactions) {
    if (promise.status_ !== 0)
      return;
    promiseEnqueue(value, reactions);
    promiseSet(promise, status, value);
  }
  function promiseEnqueue(value, tasks) {
    async((function() {
      for (var i = 0; i < tasks.length; i += 2) {
        promiseHandle(value, tasks[i], tasks[i + 1]);
      }
    }));
  }
  function promiseHandle(value, handler, deferred) {
    try {
      var result = handler(value);
      if (result === deferred.promise)
        throw new TypeError;
      else if (isPromise(result))
        chain(result, deferred.resolve, deferred.reject);
      else
        deferred.resolve(result);
    } catch (e) {
      try {
        deferred.reject(e);
      } catch (e) {}
    }
  }
  var thenableSymbol = '@@thenable';
  function isObject(x) {
    return x && (typeof x === 'object' || typeof x === 'function');
  }
  function promiseCoerce(constructor, x) {
    if (!isPromise(x) && isObject(x)) {
      var then;
      try {
        then = x.then;
      } catch (r) {
        var promise = $PromiseReject.call(constructor, r);
        x[thenableSymbol] = promise;
        return promise;
      }
      if (typeof then === 'function') {
        var p = x[thenableSymbol];
        if (p) {
          return p;
        } else {
          var deferred = getDeferred(constructor);
          x[thenableSymbol] = deferred.promise;
          try {
            then.call(x, deferred.resolve, deferred.reject);
          } catch (r) {
            deferred.reject(r);
          }
          return deferred.promise;
        }
      }
    }
    return x;
  }
  return {get Promise() {
      return Promise;
    }};
});
System.register("traceur-runtime@0.0.49/src/runtime/polyfills/Set", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.49/src/runtime/polyfills/Set";
  var isObject = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/utils").isObject;
  var Map = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/Map").Map;
  var getOwnHashObject = $traceurRuntime.getOwnHashObject;
  var $hasOwnProperty = Object.prototype.hasOwnProperty;
  function initSet(set) {
    set.map_ = new Map();
  }
  var Set = function Set() {
    var iterable = arguments[0];
    if (!isObject(this))
      throw new TypeError('Set called on incompatible type');
    if ($hasOwnProperty.call(this, 'map_')) {
      throw new TypeError('Set can not be reentrantly initialised');
    }
    initSet(this);
    if (iterable !== null && iterable !== undefined) {
      for (var $__25 = iterable[Symbol.iterator](),
          $__26; !($__26 = $__25.next()).done; ) {
        var item = $__26.value;
        {
          this.add(item);
        }
      }
    }
  };
  ($traceurRuntime.createClass)(Set, {
    get size() {
      return this.map_.size;
    },
    has: function(key) {
      return this.map_.has(key);
    },
    add: function(key) {
      return this.map_.set(key, true);
    },
    delete: function(key) {
      return this.map_.delete(key);
    },
    clear: function() {
      return this.map_.clear();
    },
    forEach: function(callbackFn) {
      var thisArg = arguments[1];
      var $__23 = this;
      return this.map_.forEach((function(value, key) {
        callbackFn.call(thisArg, key, key, $__23);
      }));
    },
    values: $traceurRuntime.initGeneratorFunction(function $__27() {
      var $__28,
          $__29;
      return $traceurRuntime.createGeneratorInstance(function($ctx) {
        while (true)
          switch ($ctx.state) {
            case 0:
              $__28 = this.map_.keys()[Symbol.iterator]();
              $ctx.sent = void 0;
              $ctx.action = 'next';
              $ctx.state = 12;
              break;
            case 12:
              $__29 = $__28[$ctx.action]($ctx.sentIgnoreThrow);
              $ctx.state = 9;
              break;
            case 9:
              $ctx.state = ($__29.done) ? 3 : 2;
              break;
            case 3:
              $ctx.sent = $__29.value;
              $ctx.state = -2;
              break;
            case 2:
              $ctx.state = 12;
              return $__29.value;
            default:
              return $ctx.end();
          }
      }, $__27, this);
    }),
    keys: $traceurRuntime.initGeneratorFunction(function $__30() {
      var $__31,
          $__32;
      return $traceurRuntime.createGeneratorInstance(function($ctx) {
        while (true)
          switch ($ctx.state) {
            case 0:
              $__31 = this.map_.keys()[Symbol.iterator]();
              $ctx.sent = void 0;
              $ctx.action = 'next';
              $ctx.state = 12;
              break;
            case 12:
              $__32 = $__31[$ctx.action]($ctx.sentIgnoreThrow);
              $ctx.state = 9;
              break;
            case 9:
              $ctx.state = ($__32.done) ? 3 : 2;
              break;
            case 3:
              $ctx.sent = $__32.value;
              $ctx.state = -2;
              break;
            case 2:
              $ctx.state = 12;
              return $__32.value;
            default:
              return $ctx.end();
          }
      }, $__30, this);
    })
  }, {});
  Object.defineProperty(Set.prototype, Symbol.iterator, {
    configurable: true,
    writable: true,
    value: Set.prototype.values
  });
  return {get Set() {
      return Set;
    }};
});
System.register("traceur-runtime@0.0.49/src/runtime/polyfills/String", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.49/src/runtime/polyfills/String";
  var $toString = Object.prototype.toString;
  var $indexOf = String.prototype.indexOf;
  var $lastIndexOf = String.prototype.lastIndexOf;
  function startsWith(search) {
    var string = String(this);
    if (this == null || $toString.call(search) == '[object RegExp]') {
      throw TypeError();
    }
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var position = arguments.length > 1 ? arguments[1] : undefined;
    var pos = position ? Number(position) : 0;
    if (isNaN(pos)) {
      pos = 0;
    }
    var start = Math.min(Math.max(pos, 0), stringLength);
    return $indexOf.call(string, searchString, pos) == start;
  }
  function endsWith(search) {
    var string = String(this);
    if (this == null || $toString.call(search) == '[object RegExp]') {
      throw TypeError();
    }
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var pos = stringLength;
    if (arguments.length > 1) {
      var position = arguments[1];
      if (position !== undefined) {
        pos = position ? Number(position) : 0;
        if (isNaN(pos)) {
          pos = 0;
        }
      }
    }
    var end = Math.min(Math.max(pos, 0), stringLength);
    var start = end - searchLength;
    if (start < 0) {
      return false;
    }
    return $lastIndexOf.call(string, searchString, start) == start;
  }
  function contains(search) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var position = arguments.length > 1 ? arguments[1] : undefined;
    var pos = position ? Number(position) : 0;
    if (isNaN(pos)) {
      pos = 0;
    }
    var start = Math.min(Math.max(pos, 0), stringLength);
    return $indexOf.call(string, searchString, pos) != -1;
  }
  function repeat(count) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    var n = count ? Number(count) : 0;
    if (isNaN(n)) {
      n = 0;
    }
    if (n < 0 || n == Infinity) {
      throw RangeError();
    }
    if (n == 0) {
      return '';
    }
    var result = '';
    while (n--) {
      result += string;
    }
    return result;
  }
  function codePointAt(position) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    var size = string.length;
    var index = position ? Number(position) : 0;
    if (isNaN(index)) {
      index = 0;
    }
    if (index < 0 || index >= size) {
      return undefined;
    }
    var first = string.charCodeAt(index);
    var second;
    if (first >= 0xD800 && first <= 0xDBFF && size > index + 1) {
      second = string.charCodeAt(index + 1);
      if (second >= 0xDC00 && second <= 0xDFFF) {
        return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
      }
    }
    return first;
  }
  function raw(callsite) {
    var raw = callsite.raw;
    var len = raw.length >>> 0;
    if (len === 0)
      return '';
    var s = '';
    var i = 0;
    while (true) {
      s += raw[i];
      if (i + 1 === len)
        return s;
      s += arguments[++i];
    }
  }
  function fromCodePoint() {
    var codeUnits = [];
    var floor = Math.floor;
    var highSurrogate;
    var lowSurrogate;
    var index = -1;
    var length = arguments.length;
    if (!length) {
      return '';
    }
    while (++index < length) {
      var codePoint = Number(arguments[index]);
      if (!isFinite(codePoint) || codePoint < 0 || codePoint > 0x10FFFF || floor(codePoint) != codePoint) {
        throw RangeError('Invalid code point: ' + codePoint);
      }
      if (codePoint <= 0xFFFF) {
        codeUnits.push(codePoint);
      } else {
        codePoint -= 0x10000;
        highSurrogate = (codePoint >> 10) + 0xD800;
        lowSurrogate = (codePoint % 0x400) + 0xDC00;
        codeUnits.push(highSurrogate, lowSurrogate);
      }
    }
    return String.fromCharCode.apply(null, codeUnits);
  }
  return {
    get startsWith() {
      return startsWith;
    },
    get endsWith() {
      return endsWith;
    },
    get contains() {
      return contains;
    },
    get repeat() {
      return repeat;
    },
    get codePointAt() {
      return codePointAt;
    },
    get raw() {
      return raw;
    },
    get fromCodePoint() {
      return fromCodePoint;
    }
  };
});
System.register("traceur-runtime@0.0.49/src/runtime/polyfills/polyfills", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.49/src/runtime/polyfills/polyfills";
  var Map = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/Map").Map;
  var Set = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/Set").Set;
  var Promise = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/Promise").Promise;
  var $__36 = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/String"),
      codePointAt = $__36.codePointAt,
      contains = $__36.contains,
      endsWith = $__36.endsWith,
      fromCodePoint = $__36.fromCodePoint,
      repeat = $__36.repeat,
      raw = $__36.raw,
      startsWith = $__36.startsWith;
  var $__37 = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/Array"),
      fill = $__37.fill,
      find = $__37.find,
      findIndex = $__37.findIndex,
      from = $__37.from;
  var $__38 = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/ArrayIterator"),
      entries = $__38.entries,
      keys = $__38.keys,
      values = $__38.values;
  var $__39 = System.get("traceur-runtime@0.0.49/src/runtime/polyfills/Object"),
      assign = $__39.assign,
      is = $__39.is,
      mixin = $__39.mixin;
  function maybeDefineMethod(object, name, value) {
    if (!(name in object)) {
      Object.defineProperty(object, name, {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
  }
  function maybeAddFunctions(object, functions) {
    for (var i = 0; i < functions.length; i += 2) {
      var name = functions[i];
      var value = functions[i + 1];
      maybeDefineMethod(object, name, value);
    }
  }
  function polyfillPromise(global) {
    if (!global.Promise)
      global.Promise = Promise;
  }
  function polyfillCollections(global) {
    if (!global.Map)
      global.Map = Map;
    if (!global.Set)
      global.Set = Set;
  }
  function polyfillString(String) {
    maybeAddFunctions(String.prototype, ['codePointAt', codePointAt, 'contains', contains, 'endsWith', endsWith, 'startsWith', startsWith, 'repeat', repeat]);
    maybeAddFunctions(String, ['fromCodePoint', fromCodePoint, 'raw', raw]);
  }
  function polyfillArray(Array, Symbol) {
    maybeAddFunctions(Array.prototype, ['entries', entries, 'keys', keys, 'values', values, 'fill', fill, 'find', find, 'findIndex', findIndex]);
    maybeAddFunctions(Array, ['from', from]);
    if (Symbol && Symbol.iterator) {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        value: values,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
  }
  function polyfillObject(Object) {
    maybeAddFunctions(Object, ['assign', assign, 'is', is, 'mixin', mixin]);
  }
  function polyfill(global) {
    polyfillPromise(global);
    polyfillCollections(global);
    polyfillString(global.String);
    polyfillArray(global.Array, global.Symbol);
    polyfillObject(global.Object);
  }
  polyfill(this);
  var setupGlobals = $traceurRuntime.setupGlobals;
  $traceurRuntime.setupGlobals = function(global) {
    setupGlobals(global);
    polyfill(global);
  };
  return {};
});
System.register("traceur-runtime@0.0.49/src/runtime/polyfill-import", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.49/src/runtime/polyfill-import";
  System.get("traceur-runtime@0.0.49/src/runtime/polyfills/polyfills");
  return {};
});
System.get("traceur-runtime@0.0.49/src/runtime/polyfill-import" + '');

/*!
 * @overview  Coalesce.js
 * @copyright Copyright 2014 Gordon L. Hempton and contributors
 * @license   Licensed under MIT license
 *            See https://raw.github.com/coalescejs/coalesce/master/LICENSE
 * @version   0.4.0+dev.183ae1df
 */
define("coalesce", ['./namespace', './container', './container', './adapter', './id_manager', './collections/model_array', './collections/model_set', './collections/has_many_array', './merge/base', './merge/per_field', './model/model', './model/diff', './model/errors', './rest/serializers/errors', './rest/serializers/payload', './rest/embedded_manager', './rest/operation', './rest/operation_graph', './rest/payload', './rest/rest_adapter', './active_model/active_model_adapter', './active_model/serializers/model', './serializers/base', './serializers/belongs_to', './serializers/boolean', './serializers/date', './serializers/has_many', './serializers/id', './serializers/number', './serializers/model', './serializers/revision', './serializers/string', './session/collection_manager', './session/inverse_manager', './session/session', './utils/is_equal', './utils/inflector'], function($__0,$__2,$__4,$__6,$__8,$__10,$__12,$__14,$__16,$__18,$__20,$__22,$__23,$__25,$__27,$__29,$__31,$__33,$__35,$__37,$__39,$__41,$__43,$__45,$__47,$__49,$__51,$__53,$__55,$__57,$__59,$__61,$__63,$__65,$__67,$__69,$__71) {
  "use strict";
  var __moduleName = "coalesce";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  if (!$__8 || !$__8.__esModule)
    $__8 = {default: $__8};
  if (!$__10 || !$__10.__esModule)
    $__10 = {default: $__10};
  if (!$__12 || !$__12.__esModule)
    $__12 = {default: $__12};
  if (!$__14 || !$__14.__esModule)
    $__14 = {default: $__14};
  if (!$__16 || !$__16.__esModule)
    $__16 = {default: $__16};
  if (!$__18 || !$__18.__esModule)
    $__18 = {default: $__18};
  if (!$__20 || !$__20.__esModule)
    $__20 = {default: $__20};
  if (!$__22 || !$__22.__esModule)
    $__22 = {default: $__22};
  if (!$__23 || !$__23.__esModule)
    $__23 = {default: $__23};
  if (!$__25 || !$__25.__esModule)
    $__25 = {default: $__25};
  if (!$__27 || !$__27.__esModule)
    $__27 = {default: $__27};
  if (!$__29 || !$__29.__esModule)
    $__29 = {default: $__29};
  if (!$__31 || !$__31.__esModule)
    $__31 = {default: $__31};
  if (!$__33 || !$__33.__esModule)
    $__33 = {default: $__33};
  if (!$__35 || !$__35.__esModule)
    $__35 = {default: $__35};
  if (!$__37 || !$__37.__esModule)
    $__37 = {default: $__37};
  if (!$__39 || !$__39.__esModule)
    $__39 = {default: $__39};
  if (!$__41 || !$__41.__esModule)
    $__41 = {default: $__41};
  if (!$__43 || !$__43.__esModule)
    $__43 = {default: $__43};
  if (!$__45 || !$__45.__esModule)
    $__45 = {default: $__45};
  if (!$__47 || !$__47.__esModule)
    $__47 = {default: $__47};
  if (!$__49 || !$__49.__esModule)
    $__49 = {default: $__49};
  if (!$__51 || !$__51.__esModule)
    $__51 = {default: $__51};
  if (!$__53 || !$__53.__esModule)
    $__53 = {default: $__53};
  if (!$__55 || !$__55.__esModule)
    $__55 = {default: $__55};
  if (!$__57 || !$__57.__esModule)
    $__57 = {default: $__57};
  if (!$__59 || !$__59.__esModule)
    $__59 = {default: $__59};
  if (!$__61 || !$__61.__esModule)
    $__61 = {default: $__61};
  if (!$__63 || !$__63.__esModule)
    $__63 = {default: $__63};
  if (!$__65 || !$__65.__esModule)
    $__65 = {default: $__65};
  if (!$__67 || !$__67.__esModule)
    $__67 = {default: $__67};
  if (!$__69 || !$__69.__esModule)
    $__69 = {default: $__69};
  if (!$__71 || !$__71.__esModule)
    $__71 = {default: $__71};
  var Coalesce = $__0.default;
  var setupContainer = $__2.setupContainer;
  var Container = $__4.default;
  var Adapter = $__6.default;
  var IdManager = $__8.default;
  var ModelArray = $__10.default;
  var ModelSet = $__12.default;
  var HasManyArray = $__14.default;
  var MergeStrategy = $__16.default;
  var PerField = $__18.default;
  var Model = $__20.default;
  $__22;
  var Errors = $__23.default;
  var RestErrorsSerializer = $__25.default;
  var PayloadSerializer = $__27.default;
  var EmbeddedManager = $__29.default;
  var Operation = $__31.default;
  var OperationGraph = $__33.default;
  var Payload = $__35.default;
  var RestAdapter = $__37.default;
  var ActiveModelAdapter = $__39.default;
  var ActiveModelSerializer = $__41.default;
  var Serializer = $__43.default;
  var BelongsToSerializer = $__45.default;
  var BooleanSerializer = $__47.default;
  var DateSerializer = $__49.default;
  var HasManySerializer = $__51.default;
  var IdSerializer = $__53.default;
  var NumberSerializer = $__55.default;
  var ModelSerializer = $__57.default;
  var RevisionSerializer = $__59.default;
  var StringSerializer = $__61.default;
  var CollectionManager = $__63.default;
  var InverseManager = $__65.default;
  var Session = $__67.default;
  var isEqual = $__69.default;
  var $__72 = $__71,
      pluralize = $__72.pluralize,
      singularize = $__72.singularize;
  Coalesce.Container = Container;
  Coalesce.setupContainer = setupContainer;
  Coalesce.Adapter = Adapter;
  Coalesce.IdManager = IdManager;
  Coalesce.ModelArray = ModelArray;
  Coalesce.ModelSet = ModelSet;
  Coalesce.HasManyArray = HasManyArray;
  Coalesce.MergeStrategy = MergeStrategy;
  Coalesce.PerField = PerField;
  Coalesce.Model = Model;
  Coalesce.Errors = Errors;
  Coalesce.RestErrorsSerializer = RestErrorsSerializer;
  Coalesce.PayloadSerializer = PayloadSerializer;
  Coalesce.EmbeddedManager = EmbeddedManager;
  Coalesce.Operation = Operation;
  Coalesce.OperationGraph = OperationGraph;
  Coalesce.Payload = Payload;
  Coalesce.RestAdapter = RestAdapter;
  Coalesce.ActiveModelAdapter = ActiveModelAdapter;
  Coalesce.ActiveModelSerializer = ActiveModelSerializer;
  Coalesce.Serializer = Serializer;
  Coalesce.BelongsToSerializer = BelongsToSerializer;
  Coalesce.BooleanSerializer = BooleanSerializer;
  Coalesce.DateSerializer = DateSerializer;
  Coalesce.HasManySerializer = HasManySerializer;
  Coalesce.IdSerializer = IdSerializer;
  Coalesce.NumberSerializer = NumberSerializer;
  Coalesce.ModelSerializer = ModelSerializer;
  Coalesce.RevisionSerializer = RevisionSerializer;
  Coalesce.StringSerializer = StringSerializer;
  Coalesce.CollectionManager = CollectionManager;
  Coalesce.InverseManager = InverseManager;
  Coalesce.Session = Session;
  Coalesce.pluralize = pluralize;
  Coalesce.singularize = singularize;
  Coalesce.isEqual = isEqual;
  var $__default = Coalesce;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/active_model/active_model_adapter", ['../rest/rest_adapter', './serializers/model', '../utils/inflector'], function($__0,$__2,$__4) {
  "use strict";
  var __moduleName = "coalesce/active_model/active_model_adapter";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var RestAdapter = $__0.default;
  var ActiveModelSerializer = $__2.default;
  var $__5 = $__4,
      decamelize = $__5.decamelize,
      underscore = $__5.underscore,
      pluralize = $__5.pluralize;
  var ActiveModelAdapter = function ActiveModelAdapter() {
    $traceurRuntime.defaultSuperCall(this, $ActiveModelAdapter.prototype, arguments);
  };
  var $ActiveModelAdapter = ActiveModelAdapter;
  ($traceurRuntime.createClass)(ActiveModelAdapter, {
    setupContainer: function(parent) {
      var container = $traceurRuntime.superCall(this, $ActiveModelAdapter.prototype, "setupContainer", [parent]);
      container.register('serializer:model', ActiveModelSerializer);
      return container;
    },
    pathForType: function(type) {
      var decamelized = decamelize(type);
      var underscored = underscore(decamelized);
      return pluralize(underscored);
    }
  }, {}, RestAdapter);
  var $__default = ActiveModelAdapter;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/active_model/serializers/model", ['../../serializers/model', '../../utils/inflector'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/active_model/serializers/model";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var ModelSerializer = $__0.default;
  var singularize = $__2.singularize;
  var ActiveModelSerializer = function ActiveModelSerializer() {
    $traceurRuntime.defaultSuperCall(this, $ActiveModelSerializer.prototype, arguments);
  };
  var $ActiveModelSerializer = ActiveModelSerializer;
  ($traceurRuntime.createClass)(ActiveModelSerializer, {keyForType: function(name, type, opts) {
      var key = $traceurRuntime.superCall(this, $ActiveModelSerializer.prototype, "keyForType", [name, type]);
      if (!opts || !opts.embedded) {
        if (type === 'belongs-to') {
          return key + '_id';
        } else if (type === 'has-many') {
          return singularize(key) + '_ids';
        }
      }
      return key;
    }}, {}, ModelSerializer);
  var $__default = ActiveModelSerializer;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/adapter", ['./error', './utils/base_class', './factories/serializer', './session/session', './utils/array_from'], function($__0,$__2,$__4,$__6,$__8) {
  "use strict";
  var __moduleName = "coalesce/adapter";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  if (!$__8 || !$__8.__esModule)
    $__8 = {default: $__8};
  var Error = $__0.default;
  var BaseClass = $__2.default;
  var SerializerFactory = $__4.default;
  var Session = $__6.default;
  var array_from = $__8.default;
  var Adapter = function Adapter() {
    this.configs = {};
    this.container = this.setupContainer(this.container);
    this.serializerFactory = new SerializerFactory(this.container);
  };
  ($traceurRuntime.createClass)(Adapter, {
    setupContainer: function(container) {
      return container;
    },
    configFor: function(type) {
      var configs = this.configs,
          typeKey = type.typeKey;
      return configs[typeKey] || {};
    },
    newSession: function() {
      return new Session({
        adapter: this,
        idManager: this.idManager,
        container: this.container
      });
    },
    serialize: function(model, opts) {
      return this.serializerFactory.serializerForModel(model).serialize(model, opts);
    },
    deserialize: function(typeKey, data, opts) {
      return this.serializerFor(typeKey).deserialize(data, opts);
    },
    serializerFor: function(typeKey) {
      return this.serializerFactory.serializerFor(typeKey);
    },
    merge: function(model, session) {
      if (!session) {
        session = this.container.lookup('session:main');
      }
      return session.merge(model);
    },
    mergeData: function(data, typeKey, session) {
      if (!typeKey) {
        typeKey = this.defaultSerializer;
      }
      var serializer = this.serializerFor(typeKey),
          deserialized = serializer.deserialize(data);
      if (deserialized.isModel) {
        return this.merge(deserialized, session);
      } else {
        return array_from(deserialized).map(function(model) {
          return this.merge(model, session);
        }, this);
      }
    },
    isDirtyFromRelationships: function(model, cached, relDiff) {
      return relDiff.length > 0;
    },
    shouldSave: function(model) {
      return true;
    },
    reifyClientId: function(model) {
      this.idManager.reifyClientId(model);
    }
  }, {}, BaseClass);
  var $__default = Adapter;
  function mustImplement(name) {
    return function() {
      throw new Error("Your adapter " + this.toString() + " does not implement the required method " + name);
    };
  }
  Adapter.reopen({
    mergeError: Adapter.mergeData,
    willMergeModel: function() {},
    didMergeModel: function() {},
    load: mustImplement("load"),
    query: mustImplement("find"),
    refresh: mustImplement("refresh"),
    flush: mustImplement("flush"),
    remoteCall: mustImplement("remoteCall")
  });
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/collections/has_many_array", ['../collections/model_array'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/collections/has_many_array";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var ModelArray = $__0.default;
  var HasManyArray = function HasManyArray() {
    $traceurRuntime.defaultSuperCall(this, $HasManyArray.prototype, arguments);
  };
  var $HasManyArray = HasManyArray;
  ($traceurRuntime.createClass)(HasManyArray, {
    get session() {
      return this.owner && this.owner.session;
    },
    replace: function(idx, amt, objects) {
      if (this.session) {
        objects = objects.map(function(model) {
          return this.session.add(model);
        }, this);
      }
      $traceurRuntime.superCall(this, $HasManyArray.prototype, "replace", [idx, amt, objects]);
    },
    arrayContentWillChange: function(index, removed, added) {
      var model = this.owner,
          name = this.name,
          session = this.session;
      if (session) {
        session.modelWillBecomeDirty(model);
        if (!model._suspendedRelationships) {
          for (var i = index; i < index + removed; i++) {
            var inverseModel = this.objectAt(i);
            session.inverseManager.unregisterRelationship(model, name, inverseModel);
          }
        }
      }
      return $traceurRuntime.superCall(this, $HasManyArray.prototype, "arrayContentWillChange", [index, removed, added]);
    },
    arrayContentDidChange: function(index, removed, added) {
      $traceurRuntime.superCall(this, $HasManyArray.prototype, "arrayContentDidChange", [index, removed, added]);
      var model = this.owner,
          name = this.name,
          session = this.session;
      if (session && !model._suspendedRelationships) {
        for (var i = index; i < index + added; i++) {
          var inverseModel = this.objectAt(i);
          session.inverseManager.registerRelationship(model, name, inverseModel);
        }
      }
    }
  }, {}, ModelArray);
  var $__default = HasManyArray;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/collections/model_array", ['./observable_array', './model_set', '../utils/is_equal', '../namespace'], function($__0,$__2,$__4,$__6) {
  "use strict";
  var __moduleName = "coalesce/collections/model_array";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  var ObservableArray = $__0.default;
  var ModelSet = $__2.default;
  var isEqual = $__4.default;
  var Coalesce = $__6.default;
  var ModelArray = function ModelArray() {
    $traceurRuntime.defaultSuperCall(this, $ModelArray.prototype, arguments);
  };
  var $ModelArray = ModelArray;
  ($traceurRuntime.createClass)(ModelArray, {
    arrayContentWillChange: function(index, removed, added) {
      for (var i = index; i < index + removed; i++) {
        var model = this.objectAt(i);
        var session = this.session;
        if (session) {
          session.collectionManager.unregister(this, model);
        }
      }
      $traceurRuntime.superCall(this, $ModelArray.prototype, "arrayContentWillChange", [index, removed, added]);
    },
    arrayContentDidChange: function(index, removed, added) {
      $traceurRuntime.superCall(this, $ModelArray.prototype, "arrayContentDidChange", [index, removed, added]);
      for (var i = index; i < index + added; i++) {
        var model = this.objectAt(i);
        var session = this.session;
        if (session) {
          session.collectionManager.register(this, model);
        }
      }
    },
    removeObject: function(obj) {
      var loc = this.length || 0;
      while (--loc >= 0) {
        var curObject = this.objectAt(loc);
        if (isEqual(curObject, obj))
          this.removeAt(loc);
      }
      return this;
    },
    contains: function(obj) {
      for (var i = 0; i < this.length; i++) {
        var m = this.objectAt(i);
        if (isEqual(obj, m))
          return true;
      }
      return false;
    },
    copyTo: function(dest) {
      var existing = new ModelSet(dest);
      this.forEach(function(model) {
        if (existing.has(model)) {
          existing.delete(model);
        } else {
          dest.pushObject(model);
        }
      });
      for (var $__9 = existing[Symbol.iterator](),
          $__10; !($__10 = $__9.next()).done; ) {
        var model = $__10.value;
        {
          dest.removeObject(model);
        }
      }
    },
    copy: function() {
      return $traceurRuntime.superCall(this, $ModelArray.prototype, "copy", [true]);
    },
    diff: function(arr) {
      var diff = new this.constructor();
      this.forEach(function(model) {
        if (!arr.contains(model)) {
          diff.push(model);
        }
      }, this);
      arr.forEach(function(model) {
        if (!this.contains(model)) {
          diff.push(model);
        }
      }, this);
      return diff;
    },
    isEqual: function(arr) {
      return this.diff(arr).length === 0;
    },
    load: function() {
      var array = this;
      return Coalesce.Promise.all(this.map(function(model) {
        return model.load();
      })).then(function() {
        return array;
      });
    }
  }, {}, ObservableArray);
  var $__default = ModelArray;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/collections/model_set", ['../utils/array_from', '../utils/base_class'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/collections/model_set";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  function guidFor(model) {
    return model.clientId;
  }
  var array_from = $__0.default;
  var BaseClass = $__2.default;
  var ModelSet = function ModelSet(iterable) {
    this._size = 0;
    if (iterable) {
      this.addObjects(iterable);
    }
  };
  ($traceurRuntime.createClass)(ModelSet, {
    get size() {
      return this._size;
    },
    clear: function() {
      var len = this._size;
      if (len === 0) {
        return this;
      }
      var guid;
      for (var i = 0; i < len; i++) {
        guid = guidFor(this[i]);
        delete this[guid];
        delete this[i];
      }
      this._size = 0;
      return this;
    },
    add: function(obj) {
      var guid = guidFor(obj),
          idx = this[guid],
          len = this._size;
      if (idx >= 0 && idx < len && (this[idx] && this[idx].isEqual(obj))) {
        if (this[idx] !== obj) {
          this[idx] = obj;
        }
        return this;
      }
      len = this._size;
      this[guid] = len;
      this[len] = obj;
      this._size = len + 1;
      return this;
    },
    delete: function(obj) {
      var guid = guidFor(obj),
          idx = this[guid],
          len = this._size,
          isFirst = idx === 0,
          isLast = idx === len - 1,
          last;
      if (idx >= 0 && idx < len && (this[idx] && this[idx].isEqual(obj))) {
        if (idx < len - 1) {
          last = this[len - 1];
          this[idx] = last;
          this[guidFor(last)] = idx;
        }
        delete this[guid];
        delete this[len - 1];
        this._size = len - 1;
        return true;
      }
      return false;
    },
    has: function(obj) {
      return this[guidFor(obj)] >= 0;
    },
    copy: function() {
      var deep = arguments[0] !== (void 0) ? arguments[0] : false;
      var C = this.constructor,
          ret = new C(),
          loc = this._size;
      ret._size = loc;
      while (--loc >= 0) {
        ret[loc] = deep ? this[loc].copy() : this[loc];
        ret[guidFor(this[loc])] = loc;
      }
      return ret;
    },
    forEach: function(callbackFn) {
      var thisArg = arguments[1];
      for (var i = 0; i < this._size; i++) {
        callbackFn.call(thisArg, this[i], this[i], this);
      }
    },
    toString: function() {
      var len = this.size,
          idx,
          array = [];
      for (idx = 0; idx < len; idx++) {
        array[idx] = this[idx];
      }
      return ("ModelSet<" + array.join(',') + ">");
    },
    get: function(model) {
      var idx = this[guidFor(model)];
      if (idx === undefined)
        return;
      return this[idx];
    },
    getForClientId: function(clientId) {
      var idx = this[clientId];
      if (idx === undefined)
        return;
      return this[idx];
    },
    values: $traceurRuntime.initGeneratorFunction(function $__7() {
      var i;
      return $traceurRuntime.createGeneratorInstance(function($ctx) {
        while (true)
          switch ($ctx.state) {
            case 0:
              i = 0;
              $ctx.state = 7;
              break;
            case 7:
              $ctx.state = (i < this._size) ? 1 : -2;
              break;
            case 4:
              i++;
              $ctx.state = 7;
              break;
            case 1:
              $ctx.state = 2;
              return this[i];
            case 2:
              $ctx.maybeThrow();
              $ctx.state = 4;
              break;
            default:
              return $ctx.end();
          }
      }, $__7, this);
    }),
    addData: function(model) {
      var existing = this.getModel(model);
      var dest;
      if (existing) {
        dest = existing.copy();
        model.copyTo(dest);
      } else {
        dest = model.copy();
      }
      this.add(dest);
      return dest;
    },
    addObjects: function(iterable) {
      if (typeof iterable.forEach === 'function') {
        iterable.forEach(function(item) {
          this.add(item);
        }, this);
      } else {
        for (var $__5 = iterable[Symbol.iterator](),
            $__6; !($__6 = $__5.next()).done; ) {
          var item = $__6.value;
          {
            this.add(item);
          }
        }
      }
      return this;
    },
    removeObjects: function(iterable) {
      if (typeof iterable.forEach === 'function') {
        iterable.forEach(function(item) {
          this.delete(item);
        }, this);
      } else {
        for (var $__5 = iterable[Symbol.iterator](),
            $__6; !($__6 = $__5.next()).done; ) {
          var item = $__6.value;
          {
            this.delete(item);
          }
        }
      }
      return this;
    },
    toArray: function() {
      return array_from(this);
    }
  }, {}, BaseClass);
  var $__default = ModelSet;
  var aliases = {
    'remove': 'delete',
    'contains': 'has',
    'addObject': 'add',
    'removeObject': 'delete',
    'getModel': 'get'
  };
  for (var alias in aliases) {
    if (!aliases.hasOwnProperty(alias))
      continue;
    var target = aliases[alias];
    ModelSet.prototype[alias] = ModelSet.prototype[target];
  }
  Object.defineProperty(ModelSet.prototype, Symbol.iterator, {
    value: ModelSet.prototype.values,
    configurable: true,
    writable: true
  });
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/collections/observable_array", ['../error', '../utils/copy', '../utils/array_from'], function($__0,$__2,$__4) {
  "use strict";
  var __moduleName = "coalesce/collections/observable_array";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var Error = $__0.default;
  var copy = $__2.default;
  var array_from = $__4.default;
  var EMPTY = [],
      splice = Array.prototype.splice;
  var ObservableArray = function ObservableArray() {
    $traceurRuntime.defaultSuperCall(this, $ObservableArray.prototype, arguments);
  };
  var $ObservableArray = ObservableArray;
  ($traceurRuntime.createClass)(ObservableArray, {
    clear: function() {
      var len = this.length;
      if (len === 0)
        return this;
      this.replace(0, len, EMPTY);
      return this;
    },
    insertAt: function(idx, object) {
      if (idx > this.length)
        throw new Error("Index out of range");
      this.replace(idx, 0, [object]);
      return this;
    },
    removeAt: function(start, len) {
      if ('number' === typeof start) {
        if ((start < 0) || (start >= this.length)) {
          throw new Error("Index out of range");
        }
        if (len === undefined)
          len = 1;
        this.replace(start, len, EMPTY);
      }
      return this;
    },
    pushObject: function(obj) {
      this.insertAt(this.length, obj);
      return obj;
    },
    pushObjects: function(objects) {
      this.replace(this.length, 0, objects);
      return this;
    },
    popObject: function() {
      var len = this.length;
      if (len === 0)
        return null;
      var ret = this.objectAt(len - 1);
      this.removeAt(len - 1, 1);
      return ret;
    },
    shiftObject: function() {
      if (this.length === 0)
        return null;
      var ret = this.objectAt(0);
      this.removeAt(0);
      return ret;
    },
    unshiftObject: function(obj) {
      this.insertAt(0, obj);
      return obj;
    },
    unshiftObjects: function(objects) {
      this.replace(0, 0, objects);
      return this;
    },
    reverseObjects: function() {
      var len = this.length;
      if (len === 0)
        return this;
      var objects = this.toArray().reverse();
      this.replace(0, len, objects);
      return this;
    },
    toArray: function() {
      return array_from(this);
    },
    setObjects: function(objects) {
      if (objects.length === 0)
        return this.clear();
      var len = this.length;
      this.replace(0, len, objects);
      return this;
    },
    removeObject: function(obj) {
      var loc = this.length || 0;
      while (--loc >= 0) {
        var curObject = this.objectAt(loc);
        if (curObject === obj)
          this.removeAt(loc);
      }
      return this;
    },
    addObject: function(obj) {
      if (!this.contains(obj))
        this.pushObject(obj);
      return this;
    },
    objectAt: function(idx) {
      return this[idx];
    },
    addObjects: function(objects) {
      for (var i = objects.length - 1; i >= 0; i--) {
        this.addObject(objects[i]);
      }
      return this;
    },
    removeObjects: function(objects) {
      for (var i = objects.length - 1; i >= 0; i--) {
        this.removeObject(objects[i]);
      }
      return this;
    },
    replace: function(idx, amt, objects) {
      var len = objects ? objects.length : 0;
      this.arrayContentWillChange(idx, amt, len);
      if (len === 0) {
        this.splice(idx, amt);
      } else {
        replace(this, idx, amt, objects);
      }
      this.arrayContentDidChange(idx, amt, len);
      return this;
    },
    indexOf: function(object, startAt) {
      var idx,
          len = this.length;
      if (startAt === undefined)
        startAt = 0;
      else
        startAt = (startAt < 0) ? Math.ceil(startAt) : Math.floor(startAt);
      if (startAt < 0)
        startAt += len;
      for (idx = startAt; idx < len; idx++) {
        if (this[idx] === object)
          return idx;
      }
      return -1;
    },
    lastIndexOf: function(object, startAt) {
      var idx,
          len = this.length;
      if (startAt === undefined)
        startAt = len - 1;
      else
        startAt = (startAt < 0) ? Math.ceil(startAt) : Math.floor(startAt);
      if (startAt < 0)
        startAt += len;
      for (idx = startAt; idx >= 0; idx--) {
        if (this[idx] === object)
          return idx;
      }
      return -1;
    },
    copy: function(deep) {
      var arr;
      if (deep) {
        arr = this.map(function(item) {
          return copy(item, true);
        });
      } else {
        arr = this.slice();
      }
      var res = new this.constructor();
      res.addObjects(arr);
      return res;
    },
    get firstObject() {
      return this.objectAt(0);
    },
    get lastObject() {
      return this.objectAt(this.length - 1);
    },
    contains: function(obj) {
      return this.indexOf(obj) >= 0;
    },
    arrayContentWillChange: function(index, removed, added) {},
    arrayContentDidChange: function(index, removed, added) {}
  }, {}, Array);
  var $__default = ObservableArray;
  function replace(array, idx, amt, objects) {
    var args = [].concat(objects),
        chunk,
        ret = [],
        size = 60000,
        start = idx,
        ends = amt,
        count;
    while (args.length) {
      count = ends > size ? size : ends;
      if (count <= 0) {
        count = 0;
      }
      chunk = args.splice(0, size);
      chunk = [start, count].concat(chunk);
      start += size;
      ends -= count;
      ret = ret.concat(splice.apply(array, chunk));
    }
    return ret;
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/container", ['./container/container', './session/session', './id_manager', './serializers/belongs_to', './serializers/boolean', './serializers/date', './serializers/has_many', './serializers/id', './serializers/number', './serializers/model', './serializers/revision', './serializers/string', './merge/per_field', './rest/rest_adapter', './model/errors'], function($__0,$__2,$__4,$__6,$__8,$__10,$__12,$__14,$__16,$__18,$__20,$__22,$__24,$__26,$__28) {
  "use strict";
  var __moduleName = "coalesce/container";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  if (!$__8 || !$__8.__esModule)
    $__8 = {default: $__8};
  if (!$__10 || !$__10.__esModule)
    $__10 = {default: $__10};
  if (!$__12 || !$__12.__esModule)
    $__12 = {default: $__12};
  if (!$__14 || !$__14.__esModule)
    $__14 = {default: $__14};
  if (!$__16 || !$__16.__esModule)
    $__16 = {default: $__16};
  if (!$__18 || !$__18.__esModule)
    $__18 = {default: $__18};
  if (!$__20 || !$__20.__esModule)
    $__20 = {default: $__20};
  if (!$__22 || !$__22.__esModule)
    $__22 = {default: $__22};
  if (!$__24 || !$__24.__esModule)
    $__24 = {default: $__24};
  if (!$__26 || !$__26.__esModule)
    $__26 = {default: $__26};
  if (!$__28 || !$__28.__esModule)
    $__28 = {default: $__28};
  var Container = $__0.default;
  var Session = $__2.default;
  var IdManager = $__4.default;
  var BelongsToSerializer = $__6.default;
  var BooleanSerializer = $__8.default;
  var DateSerializer = $__10.default;
  var HasManySerializer = $__12.default;
  var IdSerializer = $__14.default;
  var NumberSerializer = $__16.default;
  var ModelSerializer = $__18.default;
  var RevisionSerializer = $__20.default;
  var StringSerializer = $__22.default;
  var PerField = $__24.default;
  var RestAdapter = $__26.default;
  var Errors = $__28.default;
  function setupContainer(container) {
    container.register('model:errors', Errors);
    setupSession(container);
    setupInjections(container);
    setupSerializers(container);
    setupMergeStrategies(container);
  }
  function setupSession(container) {
    container.register('adapter:main', container.lookupFactory('adapter:application') || RestAdapter);
    container.register('session:base', Session);
    container.register('session:main', container.lookupFactory('session:application') || Session);
    container.register('id-manager:main', IdManager);
  }
  function setupInjections(container) {
    container.typeInjection('session', 'adapter', 'adapter:main');
    container.typeInjection('serializer', 'idManager', 'id-manager:main');
    container.typeInjection('session', 'idManager', 'id-manager:main');
    container.typeInjection('adapter', 'idManager', 'id-manager:main');
  }
  function setupSerializers(container) {
    container.register('serializer:belongs-to', BelongsToSerializer);
    container.register('serializer:boolean', BooleanSerializer);
    container.register('serializer:date', DateSerializer);
    container.register('serializer:has-many', HasManySerializer);
    container.register('serializer:id', IdSerializer);
    container.register('serializer:number', NumberSerializer);
    container.register('serializer:model', ModelSerializer);
    container.register('serializer:revision', RevisionSerializer);
    container.register('serializer:string', StringSerializer);
  }
  function setupMergeStrategies(container) {
    container.register('merge-strategy:per-field', PerField);
    container.register('merge-strategy:default', PerField);
  }
  function CoalesceContainer() {
    Container.apply(this, arguments);
    setupContainer(this);
  }
  CoalesceContainer.prototype = Object.create(Container.prototype);
  ;
  var $__default = CoalesceContainer;
  return {
    get setupContainer() {
      return setupContainer;
    },
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/container/container", ['./inheriting_dict'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/container/container";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var InheritingDict = $__0.default;
  function Container(parent) {
    this.parent = parent;
    this.children = [];
    this.resolver = parent && parent.resolver || function() {};
    this.registry = new InheritingDict(parent && parent.registry);
    this.cache = new InheritingDict(parent && parent.cache);
    this.factoryCache = new InheritingDict(parent && parent.factoryCache);
    this.resolveCache = new InheritingDict(parent && parent.resolveCache);
    this.typeInjections = new InheritingDict(parent && parent.typeInjections);
    this.injections = {};
    this.factoryTypeInjections = new InheritingDict(parent && parent.factoryTypeInjections);
    this.factoryInjections = {};
    this._options = new InheritingDict(parent && parent._options);
    this._typeOptions = new InheritingDict(parent && parent._typeOptions);
  }
  Container.prototype = {
    parent: null,
    children: null,
    resolver: null,
    registry: null,
    cache: null,
    typeInjections: null,
    injections: null,
    _options: null,
    _typeOptions: null,
    child: function() {
      var container = new Container(this);
      this.children.push(container);
      return container;
    },
    set: function(object, key, value) {
      object[key] = value;
    },
    register: function(fullName, factory, options) {
      console.assert(validateFullName(fullName), 'fullName must be a proper full name');
      if (factory === undefined) {
        throw new TypeError('Attempting to register an unknown factory: `' + fullName + '`');
      }
      var normalizedName = this.normalize(fullName);
      if (this.cache.has(normalizedName)) {
        throw new Error('Cannot re-register: `' + fullName + '`, as it has already been looked up.');
      }
      this.registry.set(normalizedName, factory);
      this._options.set(normalizedName, options || {});
    },
    unregister: function(fullName) {
      console.assert(validateFullName(fullName), 'fullName must be a proper full name');
      var normalizedName = this.normalize(fullName);
      this.registry.remove(normalizedName);
      this.cache.remove(normalizedName);
      this.factoryCache.remove(normalizedName);
      this.resolveCache.remove(normalizedName);
      this._options.remove(normalizedName);
    },
    resolve: function(fullName) {
      console.assert(validateFullName(fullName), 'fullName must be a proper full name');
      return resolve(this, this.normalize(fullName));
    },
    describe: function(fullName) {
      return fullName;
    },
    normalize: function(fullName) {
      return fullName;
    },
    makeToString: function(factory, fullName) {
      return factory.toString();
    },
    lookup: function(fullName, options) {
      console.assert(validateFullName(fullName), 'fullName must be a proper full name');
      return lookup(this, this.normalize(fullName), options);
    },
    lookupFactory: function(fullName) {
      console.assert(validateFullName(fullName), 'fullName must be a proper full name');
      return factoryFor(this, this.normalize(fullName));
    },
    has: function(fullName) {
      console.assert(validateFullName(fullName), 'fullName must be a proper full name');
      return has(this, this.normalize(fullName));
    },
    optionsForType: function(type, options) {
      if (this.parent) {
        illegalChildOperation('optionsForType');
      }
      this._typeOptions.set(type, options);
    },
    options: function(type, options) {
      this.optionsForType(type, options);
    },
    typeInjection: function(type, property, fullName) {
      console.assert(validateFullName(fullName), 'fullName must be a proper full name');
      if (this.parent) {
        illegalChildOperation('typeInjection');
      }
      var fullNameType = fullName.split(':')[0];
      if (fullNameType === type) {
        throw new Error('Cannot inject a `' + fullName + '` on other ' + type + '(s). Register the `' + fullName + '` as a different type and perform the typeInjection.');
      }
      addTypeInjection(this.typeInjections, type, property, fullName);
    },
    injection: function(fullName, property, injectionName) {
      if (this.parent) {
        illegalChildOperation('injection');
      }
      validateFullName(injectionName);
      var normalizedInjectionName = this.normalize(injectionName);
      if (fullName.indexOf(':') === -1) {
        return this.typeInjection(fullName, property, normalizedInjectionName);
      }
      console.assert(validateFullName(fullName), 'fullName must be a proper full name');
      var normalizedName = this.normalize(fullName);
      if (this.cache.has(normalizedName)) {
        throw new Error("Attempted to register an injection for a type that has already been looked up. ('" + normalizedName + "', '" + property + "', '" + injectionName + "')");
      }
      addInjection(this.injections, normalizedName, property, normalizedInjectionName);
    },
    factoryTypeInjection: function(type, property, fullName) {
      if (this.parent) {
        illegalChildOperation('factoryTypeInjection');
      }
      addTypeInjection(this.factoryTypeInjections, type, property, this.normalize(fullName));
    },
    factoryInjection: function(fullName, property, injectionName) {
      if (this.parent) {
        illegalChildOperation('injection');
      }
      var normalizedName = this.normalize(fullName);
      var normalizedInjectionName = this.normalize(injectionName);
      validateFullName(injectionName);
      if (fullName.indexOf(':') === -1) {
        return this.factoryTypeInjection(normalizedName, property, normalizedInjectionName);
      }
      console.assert(validateFullName(fullName), 'fullName must be a proper full name');
      if (this.factoryCache.has(normalizedName)) {
        throw new Error('Attempted to register a factoryInjection for a type that has already ' + 'been looked up. (\'' + normalizedName + '\', \'' + property + '\', \'' + injectionName + '\')');
      }
      addInjection(this.factoryInjections, normalizedName, property, normalizedInjectionName);
    },
    destroy: function() {
      for (var i = 0,
          length = this.children.length; i < length; i++) {
        this.children[i].destroy();
      }
      this.children = [];
      eachDestroyable(this, function(item) {
        item.destroy();
      });
      this.parent = undefined;
      this.isDestroyed = true;
    },
    reset: function() {
      for (var i = 0,
          length = this.children.length; i < length; i++) {
        resetCache(this.children[i]);
      }
      resetCache(this);
    }
  };
  function resolve(container, normalizedName) {
    var cached = container.resolveCache.get(normalizedName);
    if (cached) {
      return cached;
    }
    var resolved = container.resolver(normalizedName) || container.registry.get(normalizedName);
    container.resolveCache.set(normalizedName, resolved);
    return resolved;
  }
  function has(container, fullName) {
    if (container.cache.has(fullName)) {
      return true;
    }
    return !!container.resolve(fullName);
  }
  function lookup(container, fullName, options) {
    options = options || {};
    if (container.cache.has(fullName) && options.singleton !== false) {
      return container.cache.get(fullName);
    }
    var value = instantiate(container, fullName);
    if (value === undefined) {
      return;
    }
    if (isSingleton(container, fullName) && options.singleton !== false) {
      container.cache.set(fullName, value);
    }
    return value;
  }
  function illegalChildOperation(operation) {
    throw new Error(operation + ' is not currently supported on child containers');
  }
  function isSingleton(container, fullName) {
    var singleton = option(container, fullName, 'singleton');
    return singleton !== false;
  }
  function buildInjections(container, injections) {
    var hash = {};
    if (!injections) {
      return hash;
    }
    var injection,
        injectable;
    for (var i = 0,
        length = injections.length; i < length; i++) {
      injection = injections[i];
      injectable = lookup(container, injection.fullName);
      if (injectable !== undefined) {
        hash[injection.property] = injectable;
      } else {
        throw new Error('Attempting to inject an unknown injection: `' + injection.fullName + '`');
      }
    }
    return hash;
  }
  function option(container, fullName, optionName) {
    var options = container._options.get(fullName);
    if (options && options[optionName] !== undefined) {
      return options[optionName];
    }
    var type = fullName.split(':')[0];
    options = container._typeOptions.get(type);
    if (options) {
      return options[optionName];
    }
  }
  function factoryFor(container, fullName) {
    var cache = container.factoryCache;
    if (cache.has(fullName)) {
      return cache.get(fullName);
    }
    var factory = container.resolve(fullName);
    if (factory === undefined) {
      return;
    }
    var type = fullName.split(':')[0];
    if (!factory || typeof factory.extend !== 'function') {
      return factory;
    } else {
      var injections = injectionsFor(container, fullName);
      var factoryInjections = factoryInjectionsFor(container, fullName);
      factoryInjections._toString = container.makeToString(factory, fullName);
      var injectedFactory = factory.extend(injections);
      injectedFactory.reopenClass(factoryInjections);
      cache.set(fullName, injectedFactory);
      return injectedFactory;
    }
  }
  function injectionsFor(container, fullName) {
    var splitName = fullName.split(':'),
        type = splitName[0],
        injections = [];
    injections = injections.concat(container.typeInjections.get(type) || []);
    injections = injections.concat(container.injections[fullName] || []);
    injections = buildInjections(container, injections);
    injections._debugContainerKey = fullName;
    injections.container = container;
    return injections;
  }
  function factoryInjectionsFor(container, fullName) {
    var splitName = fullName.split(':'),
        type = splitName[0],
        factoryInjections = [];
    factoryInjections = factoryInjections.concat(container.factoryTypeInjections.get(type) || []);
    factoryInjections = factoryInjections.concat(container.factoryInjections[fullName] || []);
    factoryInjections = buildInjections(container, factoryInjections);
    factoryInjections._debugContainerKey = fullName;
    return factoryInjections;
  }
  function instantiate(container, fullName) {
    var factory = factoryFor(container, fullName);
    if (option(container, fullName, 'instantiate') === false) {
      return factory;
    }
    if (factory) {
      if (typeof factory.create !== 'function') {
        throw new Error('Failed to create an instance of \'' + fullName + '\'. ' + 'Most likely an improperly defined class or an invalid module export.');
      }
      if (typeof factory.extend === 'function') {
        return factory.create();
      } else {
        return factory.create(injectionsFor(container, fullName));
      }
    }
  }
  function eachDestroyable(container, callback) {
    container.cache.eachLocal(function(key, value) {
      if (option(container, key, 'instantiate') === false) {
        return;
      }
      callback(value);
    });
  }
  function resetCache(container) {
    container.cache.eachLocal(function(key, value) {
      if (option(container, key, 'instantiate') === false) {
        return;
      }
      value.destroy();
    });
    container.cache.dict = {};
  }
  function addTypeInjection(rules, type, property, fullName) {
    var injections = rules.get(type);
    if (!injections) {
      injections = [];
      rules.set(type, injections);
    }
    injections.push({
      property: property,
      fullName: fullName
    });
  }
  var VALID_FULL_NAME_REGEXP = /^[^:]+.+:[^:]+$/;
  function validateFullName(fullName) {
    if (!VALID_FULL_NAME_REGEXP.test(fullName)) {
      throw new TypeError('Invalid Fullname, expected: `type:name` got: ' + fullName);
    }
    return true;
  }
  function addInjection(rules, factoryName, property, injectionName) {
    var injections = rules[factoryName] = rules[factoryName] || [];
    injections.push({
      property: property,
      fullName: injectionName
    });
  }
  var $__default = Container;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/container/inheriting_dict", [], function() {
  "use strict";
  var __moduleName = "coalesce/container/inheriting_dict";
  function InheritingDict(parent) {
    this.parent = parent;
    this.dict = {};
  }
  InheritingDict.prototype = {
    parent: null,
    dict: null,
    get: function(key) {
      var dict = this.dict;
      if (dict.hasOwnProperty(key)) {
        return dict[key];
      }
      if (this.parent) {
        return this.parent.get(key);
      }
    },
    set: function(key, value) {
      this.dict[key] = value;
    },
    remove: function(key) {
      delete this.dict[key];
    },
    has: function(key) {
      var dict = this.dict;
      if (dict.hasOwnProperty(key)) {
        return true;
      }
      if (this.parent) {
        return this.parent.has(key);
      }
      return false;
    },
    eachLocal: function(callback, binding) {
      var dict = this.dict;
      for (var prop in dict) {
        if (dict.hasOwnProperty(prop)) {
          callback.call(binding, prop, dict[prop]);
        }
      }
    }
  };
  var $__default = InheritingDict;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/error", [], function() {
  "use strict";
  var __moduleName = "coalesce/error";
  var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];
  function CsError() {
    var tmp = Error.apply(this, arguments);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CsError);
    }
    for (var idx = 0; idx < errorProps.length; idx++) {
      this[errorProps[idx]] = tmp[errorProps[idx]];
    }
  }
  CsError.prototype = Object.create(Error.prototype);
  var $__default = CsError;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/factories/merge", [], function() {
  "use strict";
  var __moduleName = "coalesce/factories/merge";
  var MergeFactory = function MergeFactory(container) {
    this.container = container;
  };
  ($traceurRuntime.createClass)(MergeFactory, {mergeFor: function(typeKey) {
      console.assert(typeof typeKey === 'string', 'Passed in typeKey must be a string');
      var mergeStrategy = this.container.lookup('merge-strategy:' + typeKey);
      if (!mergeStrategy) {
        var Strategy = this.container.lookupFactory('merge-strategy:default');
        this.container.register('merge-strategy:' + typeKey, Strategy);
        mergeStrategy = this.container.lookup('merge-strategy:' + typeKey);
      }
      mergeStrategy.typeKey = typeKey;
      return mergeStrategy;
    }}, {});
  var $__default = MergeFactory;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/factories/serializer", [], function() {
  "use strict";
  var __moduleName = "coalesce/factories/serializer";
  var SerializerFactory = function SerializerFactory(container) {
    this.container = container;
  };
  ($traceurRuntime.createClass)(SerializerFactory, {
    serializerFor: function(typeKey) {
      console.assert(typeof typeKey === 'string', 'Passed in typeKey must be a string');
      var serializer = this.container.lookup('serializer:' + typeKey);
      if (!serializer) {
        var modelExists = !!this.container.lookupFactory('model:' + typeKey);
        if (!modelExists)
          return;
        var Serializer = this.container.lookupFactory('serializer:model');
        this.container.register('serializer:' + typeKey, Serializer);
        serializer = this.container.lookup('serializer:' + typeKey);
      }
      if (!serializer.typeKey) {
        serializer.typeKey = typeKey;
      }
      return serializer;
    },
    serializerForType: function(type) {
      return this.serializerFor(type.typeKey);
    },
    serializerForModel: function(model) {
      var type = model.constructor;
      return this.serializerForType(type);
    }
  }, {});
  var $__default = SerializerFactory;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/factories/type", [], function() {
  "use strict";
  var __moduleName = "coalesce/factories/type";
  var TypeFactory = function TypeFactory(container) {
    this.container = container;
  };
  ($traceurRuntime.createClass)(TypeFactory, {typeFor: function(typeKey) {
      var factory = this.container.lookupFactory('model:' + typeKey);
      console.assert(factory, "No model was found for '" + typeKey + "'");
      factory.session = this;
      factory.typeKey = typeKey;
      return factory;
    }}, {});
  var $__default = TypeFactory;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/id_manager", ['./utils/base_class'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/id_manager";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var BaseClass = $__0.default;
  var uuid = 1;
  var IdManager = function IdManager() {
    this.idMaps = {};
  };
  ($traceurRuntime.createClass)(IdManager, {
    reifyClientId: function(model) {
      var id = model.id,
          clientId = model.clientId,
          typeKey = model.typeKey,
          idMap = this.idMaps[typeKey];
      if (!idMap) {
        idMap = this.idMaps[typeKey] = {};
      }
      if (id) {
        id = id + '';
      }
      if (id && clientId) {
        var existingClientId = idMap[id];
        console.assert(!existingClientId || existingClientId === clientId, "clientId has changed for " + model.toString());
        if (!existingClientId) {
          idMap[id] = clientId;
        }
      } else if (!clientId) {
        if (id) {
          clientId = idMap[id];
        }
        if (!clientId) {
          clientId = this._generateClientId(typeKey);
        }
        model.clientId = clientId;
        idMap[id] = clientId;
      }
      return clientId;
    },
    getClientId: function(typeKey, id) {
      var idMap = this.idMaps[typeKey];
      return idMap && idMap[id + ''];
    },
    _generateClientId: function(typeKey) {
      return typeKey + (uuid++);
    }
  }, {}, BaseClass);
  var $__default = IdManager;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/merge/base", ['../utils/base_class'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/merge/base";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var BaseClass = $__0.default;
  var Base = function Base() {
    $traceurRuntime.defaultSuperCall(this, $Base.prototype, arguments);
  };
  var $Base = Base;
  ($traceurRuntime.createClass)(Base, {merge: function(ours, ancestor, theirs) {}}, {}, BaseClass);
  var $__default = Base;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/merge/per_field", ['./base', '../collections/model_set', '../utils/is_equal', '../utils/copy'], function($__0,$__2,$__4,$__6) {
  "use strict";
  var __moduleName = "coalesce/merge/per_field";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  var Base = $__0.default;
  var ModelSet = $__2.default;
  var isEqual = $__4.default;
  var copy = $__6.default;
  var PerField = function PerField() {
    $traceurRuntime.defaultSuperCall(this, $PerField.prototype, arguments);
  };
  var $PerField = PerField;
  ($traceurRuntime.createClass)(PerField, {
    merge: function(ours, ancestor, theirs) {
      this.mergeAttributes(ours, ancestor, theirs);
      this.mergeRelationships(ours, ancestor, theirs);
      return ours;
    },
    mergeAttributes: function(ours, ancestor, theirs) {
      ours.eachAttribute(function(name, meta) {
        this.mergeProperty(ours, ancestor, theirs, name);
      }, this);
    },
    mergeRelationships: function(ours, ancestor, theirs) {
      var session = this.session;
      ours.eachRelationship(function(name, relationship) {
        if (relationship.kind === 'belongsTo') {
          this.mergeBelongsTo(ours, ancestor, theirs, name);
        } else if (relationship.kind === 'hasMany') {
          this.mergeHasMany(ours, ancestor, theirs, name);
        }
      }, this);
    },
    mergeBelongsTo: function(ours, ancestor, theirs, name) {
      this.mergeProperty(ours, ancestor, theirs, name);
    },
    mergeHasMany: function(ours, ancestor, theirs, name) {
      this.mergeProperty(ours, ancestor, theirs, name);
    },
    mergeProperty: function(ours, ancestor, theirs, name) {
      var oursValue = ours[name],
          ancestorValue = ancestor[name],
          theirsValue = theirs[name];
      if (!ours.isFieldLoaded(name)) {
        if (theirs.isFieldLoaded(name)) {
          ours[name] = copy(theirsValue);
        }
        return;
      }
      if (!theirs.isFieldLoaded(name) || isEqual(oursValue, theirsValue)) {
        return;
      }
      if (!ancestor.isFieldLoaded(name) || isEqual(oursValue, ancestorValue)) {
        ours[name] = copy(theirsValue);
      } else {}
    }
  }, {}, Base);
  var $__default = PerField;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/model/attribute", ['./field', '../utils/is_equal'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/model/attribute";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var Field = $__0.default;
  var isEqual = $__2.default;
  var Attribute = function Attribute() {
    $traceurRuntime.defaultSuperCall(this, $Attribute.prototype, arguments);
  };
  var $Attribute = Attribute;
  ($traceurRuntime.createClass)(Attribute, {
    get kind() {
      return 'attribute';
    },
    defineProperty: function(prototype) {
      var name = this.name;
      Object.defineProperty(prototype, name, {
        enumerable: true,
        get: function() {
          return this._attributes[name];
        },
        set: function(value) {
          var oldValue = this._attributes[name];
          if (isEqual(oldValue, value))
            return;
          this.attributeWillChange(name);
          this._attributes[name] = value;
          this.attributeDidChange(name);
          return value;
        }
      });
    }
  }, {}, Field);
  var $__default = Attribute;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/model/belongs_to", ['./relationship', '../utils/is_equal'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/model/belongs_to";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var Relationship = $__0.default;
  var isEqual = $__2.default;
  var BelongsTo = function BelongsTo() {
    $traceurRuntime.defaultSuperCall(this, $BelongsTo.prototype, arguments);
  };
  var $BelongsTo = BelongsTo;
  ($traceurRuntime.createClass)(BelongsTo, {defineProperty: function(prototype) {
      var name = this.name;
      Object.defineProperty(prototype, name, {
        enumerable: true,
        get: function() {
          var value = this._relationships[name],
              session = this.session;
          if (session && value && value.session !== session) {
            value = this._relationships[name] = this.session.add(value);
          }
          return value;
        },
        set: function(value) {
          var oldValue = this._relationships[name];
          if (oldValue === value)
            return;
          this.belongsToWillChange(name);
          var session = this.session;
          if (session) {
            session.modelWillBecomeDirty(this);
            if (value) {
              value = session.add(value);
            }
          }
          this._relationships[name] = value;
          this.belongsToDidChange(name);
          return value;
        }
      });
    }}, {}, Relationship);
  var $__default = BelongsTo;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/model/diff", ['./model', '../collections/model_set'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/model/diff";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var Model = $__0.default;
  var ModelSet = $__2.default;
  Model.reopen({diff: function(model) {
      var diffs = [];
      this.eachLoadedAttribute(function(name, meta) {
        var left = this[name];
        var right = model[name];
        if (left && typeof left.diff === 'function' && right && typeof right.diff === 'function') {
          if (left.diff(right).length > 0) {
            diffs.push({
              type: 'attr',
              name: name
            });
          }
          return;
        }
        if (left && right && typeof left === 'object' && typeof right === 'object') {
          var delta = jsondiffpatch.diff(left, right);
          if (delta) {
            diffs.push({
              type: 'attr',
              name: name
            });
          }
          return;
        }
        if (left instanceof Date && right instanceof Date) {
          left = left.getTime();
          right = right.getTime();
        }
        if (left !== right) {
          diffs.push({
            type: 'attr',
            name: name
          });
        }
      }, this);
      this.eachLoadedRelationship(function(name, relationship) {
        var left = this[name];
        var right = model[name];
        if (relationship.kind === 'belongsTo') {
          if (left && right) {
            if (!left.isEqual(right)) {
              diffs.push({
                type: 'belongsTo',
                name: name,
                relationship: relationship,
                oldValue: right
              });
            }
          } else if (left || right) {
            diffs.push({
              type: 'belongsTo',
              name: name,
              relationship: relationship,
              oldValue: right
            });
          }
        } else if (relationship.kind === 'hasMany') {
          var dirty = false;
          var cache = new ModelSet();
          left.forEach(function(model) {
            cache.add(model);
          });
          right.forEach(function(model) {
            if (dirty)
              return;
            if (!cache.contains(model)) {
              dirty = true;
            } else {
              cache.remove(model);
            }
          });
          if (dirty || cache.length > 0) {
            diffs.push({
              type: 'hasMany',
              name: name,
              relationship: relationship
            });
          }
        }
      }, this);
      return diffs;
    }});
  return {};
});

define("coalesce/model/errors", ['../utils/base_class'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/model/errors";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var BaseClass = $__0.default;
  var Errors = function Errors() {
    var obj = arguments[0] !== (void 0) ? arguments[0] : {};
    $traceurRuntime.superCall(this, $Errors.prototype, "constructor", []);
    for (var key in obj) {
      if (!obj.hasOwnProperty(key))
        continue;
      this[key] = obj[key];
    }
  };
  var $Errors = Errors;
  ($traceurRuntime.createClass)(Errors, {
    forEach: function(callback, binding) {
      for (var key in this) {
        if (!this.hasOwnProperty(key))
          continue;
        callback.call(binding, this[key], key);
      }
    },
    copy: function() {
      return new this.constructor(this);
    }
  }, {}, BaseClass);
  var $__default = Errors;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/model/field", [], function() {
  "use strict";
  var __moduleName = "coalesce/model/field";
  var Field = function Field(name, options) {
    this.name = name;
    for (var key in options) {
      if (!options.hasOwnProperty(key))
        continue;
      this[key] = options[key];
    }
  };
  ($traceurRuntime.createClass)(Field, {}, {});
  var $__default = Field;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/model/has_many", ['../namespace', './relationship', '../collections/has_many_array', '../utils/is_equal', '../utils/copy'], function($__0,$__2,$__4,$__6,$__8) {
  "use strict";
  var __moduleName = "coalesce/model/has_many";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  if (!$__8 || !$__8.__esModule)
    $__8 = {default: $__8};
  var Coalesce = $__0.default;
  var Relationship = $__2.default;
  var HasManyArray = $__4.default;
  var isEqual = $__6.default;
  var copy = $__8.default;
  var HasMany = function HasMany() {
    $traceurRuntime.defaultSuperCall(this, $HasMany.prototype, arguments);
  };
  var $HasMany = HasMany;
  ($traceurRuntime.createClass)(HasMany, {defineProperty: function(prototype) {
      var name = this.name;
      Object.defineProperty(prototype, name, {
        enumerable: true,
        get: function() {
          var value = this._relationships[name];
          if (this.isNew && !value) {
            var content = value;
            value = this._relationships[name] = new Coalesce.HasManyArray();
            value.owner = this;
            value.name = name;
            if (content) {
              value.addObjects(content);
            }
          }
          return value;
        },
        set: function(value) {
          var oldValue = this._relationships[name];
          if (oldValue === value)
            return;
          if (value && value instanceof Coalesce.HasManyArray) {
            value = copy(value);
          }
          if (oldValue && oldValue instanceof Coalesce.HasManyArray) {
            oldValue.clear();
            if (value) {
              oldValue.addObjects(value);
            }
          } else {
            this.hasManyWillChange(name);
            var content = value;
            value = this._relationships[name] = new Coalesce.HasManyArray();
            value.owner = this;
            value.name = name;
            if (content) {
              value.addObjects(content);
            }
            this.hasManyDidChange(name);
          }
          return value;
        }
      });
    }}, {}, Relationship);
  var $__default = HasMany;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/model/model", ['../namespace', '../utils/base_class', '../collections/model_set', '../utils/copy', '../utils/lazy_copy', '../utils/is_equal', './attribute', './belongs_to', './has_many', '../error', './field', '../utils/inflector'], function($__0,$__2,$__4,$__6,$__8,$__10,$__12,$__14,$__16,$__18,$__20,$__22) {
  "use strict";
  var __moduleName = "coalesce/model/model";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  if (!$__8 || !$__8.__esModule)
    $__8 = {default: $__8};
  if (!$__10 || !$__10.__esModule)
    $__10 = {default: $__10};
  if (!$__12 || !$__12.__esModule)
    $__12 = {default: $__12};
  if (!$__14 || !$__14.__esModule)
    $__14 = {default: $__14};
  if (!$__16 || !$__16.__esModule)
    $__16 = {default: $__16};
  if (!$__18 || !$__18.__esModule)
    $__18 = {default: $__18};
  if (!$__20 || !$__20.__esModule)
    $__20 = {default: $__20};
  if (!$__22 || !$__22.__esModule)
    $__22 = {default: $__22};
  var Coalesce = $__0.default;
  var BaseClass = $__2.default;
  var ModelSet = $__4.default;
  var copy = $__6.default;
  var lazyCopy = $__8.default;
  var isEqual = $__10.default;
  var Attribute = $__12.default;
  var BelongsTo = $__14.default;
  var HasMany = $__16.default;
  var Error = $__18.default;
  var Field = $__20.default;
  var $__23 = $__22,
      camelize = $__23.camelize,
      pluralize = $__23.pluralize,
      underscore = $__23.underscore,
      classify = $__23.classify;
  var Model = function Model(fields) {
    this._meta = {
      _id: null,
      _clientId: null,
      _rev: null,
      _clientRev: 0,
      _deleted: false,
      _errors: null
    };
    this._attributes = {};
    this._relationships = {};
    this._suspendedRelationships = false;
    this._session = null;
    for (var name in fields) {
      if (!fields.hasOwnProperty(name))
        continue;
      this[name] = fields[name];
    }
  };
  var $Model = Model;
  ($traceurRuntime.createClass)(Model, {
    get id() {
      return this._meta['_id'];
    },
    set id(value) {
      return this._meta['_id'] = value;
    },
    get clientId() {
      return this._meta['_clientId'];
    },
    set clientId(value) {
      return this._meta['_clientId'] = value;
    },
    get rev() {
      return this._meta['_rev'];
    },
    set rev(value) {
      return this._meta['_rev'] = value;
    },
    get clientRev() {
      return this._meta['_clientRev'];
    },
    set clientRev(value) {
      return this._meta['_clientRev'] = value;
    },
    get isDeleted() {
      return this._meta['_deleted'];
    },
    set isDeleted(value) {
      return this._meta['_deleted'] = value;
    },
    get errors() {
      return this._meta['_errors'];
    },
    set errors(value) {
      return this._meta['_errors'] = value;
    },
    get isModel() {
      return true;
    },
    get session() {
      return this._session;
    },
    set session(value) {
      console.assert(!this._session || this._session === value, "Cannot re-assign a model's session");
      this._session = value;
    },
    isEqual: function(model) {
      if (!model)
        return false;
      var clientId = this.clientId;
      var otherClientId = model.clientId;
      if (clientId && otherClientId) {
        return clientId === otherClientId;
      }
      var id = this.id;
      var otherId = model.id;
      return this instanceof model.constructor && id === otherId;
    },
    get typeKey() {
      return this.constructor.typeKey;
    },
    toString: function() {
      var sessionString = this.session ? this.session.toString() : "(detached)";
      return this.constructor.toString() + "<" + (this.id || '(no id)') + ", " + this.clientId + ", " + sessionString + ">";
    },
    toJSON: function() {
      var res = {};
      _.merge(res, this._meta);
      _.merge(res, this._attributes);
      return res;
    },
    get hasErrors() {
      return !!this.errors;
    },
    get isDetached() {
      return !this.session;
    },
    get isManaged() {
      return !!this.session;
    },
    get isNew() {
      return !this.id;
    },
    get isDirty() {
      if (this.session) {
        return this.session.dirtyModels.contains(this);
      } else {
        return false;
      }
    },
    lazyCopy: function() {
      var copy = new this.constructor({
        id: this.id,
        clientId: this.clientId
      });
      return copy;
    },
    copy: function() {
      var dest = new this.constructor();
      this.copyTo(dest);
      return dest;
    },
    copyTo: function(dest) {
      this.copyMeta(dest);
      this.copyAttributes(dest);
      this.copyRelationships(dest);
    },
    copyMeta: function(dest) {
      dest._meta = copy(this._meta);
    },
    copyAttributes: function(dest) {
      dest._attributes = copy(this._attributes, true);
    },
    copyRelationships: function(dest) {
      this.eachLoadedRelationship(function(name, relationship) {
        dest[name] = this[name];
      }, this);
    },
    willWatchProperty: function(key) {
      if (this.isManaged && this.shouldTriggerLoad(key)) {
        Coalesce.run.scheduleOnce('actions', this, this.load);
      }
    },
    shouldTriggerLoad: function(key) {
      return this.isField(key) && !this.isFieldLoaded(key);
    },
    isField: function(key) {
      return !!this.fields.get(key);
    },
    isFieldLoaded: function(key) {
      return this.isNew || typeof this[key] !== 'undefined';
    },
    get anyFieldsLoaded() {
      var res = false;
      this.fields.forEach(function(options, name) {
        res = res || this.isFieldLoaded(name);
      }, this);
      return res;
    },
    get attributes() {
      return this.constructor.attributes;
    },
    get fields() {
      return this.constructor.fields;
    },
    get loadedAttributes() {
      var res = new Map();
      this.attributes.forEach(function(options, name) {
        if (this.isFieldLoaded(name)) {
          res.set(name, options);
        }
      }, this);
      return res;
    },
    get relationships() {
      return this.constructor.relationships;
    },
    get loadedRelationships() {
      var res = new Map();
      this.relationships.forEach(function(options, name) {
        if (this.isFieldLoaded(name)) {
          res.set(name, options);
        }
      }, this);
      return res;
    },
    attributeWillChange: function(name) {
      var session = this.session;
      if (session) {
        session.modelWillBecomeDirty(this);
      }
    },
    attributeDidChange: function(name) {},
    belongsToWillChange: function(name) {
      if (this._suspendedRelationships) {
        return;
      }
      var inverseModel = this[name],
          session = this.session;
      if (session && inverseModel) {
        session.inverseManager.unregisterRelationship(this, name, inverseModel);
      }
    },
    belongsToDidChange: function(name) {
      if (this._suspendedRelationships) {
        return;
      }
      var inverseModel = this[name],
          session = this.session;
      if (session && inverseModel) {
        session.inverseManager.registerRelationship(this, name, inverseModel);
      }
    },
    hasManyWillChange: function(name) {},
    hasManyDidChange: function(name) {},
    eachAttribute: function(callback, binding) {
      this.attributes.forEach(function(options, name) {
        callback.call(binding, name, options);
      });
    },
    eachLoadedAttribute: function(callback, binding) {
      this.loadedAttributes.forEach(function(options, name) {
        callback.call(binding, name, options);
      });
    },
    eachRelationship: function(callback, binding) {
      this.relationships.forEach(function(options, name) {
        callback.call(binding, name, options);
      });
    },
    eachLoadedRelationship: function(callback, binding) {
      this.loadedRelationships.forEach(function(options, name) {
        callback.call(binding, name, options);
      });
    },
    eachRelatedModel: function(callback, binding, cache) {
      if (!cache)
        cache = new Set();
      if (cache.has(this))
        return;
      cache.add(this);
      callback.call(binding || this, this);
      this.eachLoadedRelationship(function(name, relationship) {
        if (relationship.kind === 'belongsTo') {
          var child = this[name];
          if (!child)
            return;
          this.eachRelatedModel.call(child, callback, binding, cache);
        } else if (relationship.kind === 'hasMany') {
          var children = this[name];
          children.forEach(function(child) {
            this.eachRelatedModel.call(child, callback, binding, cache);
          }, this);
        }
      }, this);
    },
    eachChild: function(callback, binding) {
      this.eachLoadedRelationship(function(name, relationship) {
        if (relationship.kind === 'belongsTo') {
          var child = this[name];
          if (child) {
            callback.call(binding, child);
          }
        } else if (relationship.kind === 'hasMany') {
          var children = this[name];
          children.forEach(function(child) {
            callback.call(binding, child);
          }, this);
        }
      }, this);
    },
    suspendRelationshipObservers: function(callback, binding) {
      if (this._suspendedRelationships) {
        return callback.call(binding || this);
      }
      try {
        this._suspendedRelationships = true;
        callback.call(binding || this);
      } finally {
        this._suspendedRelationships = false;
      }
    }
  }, {
    toString: function() {
      if (this.__toString = this.__toString || this.name || (this.typeKey && classify(this.typeKey))) {
        return this.__toString;
      }
      return "[No Type Key]";
    },
    defineSchema: function(schema) {
      if (typeof schema.typeKey !== 'undefined') {
        this.typeKey = schema.typeKey;
      }
      var attributes = schema.attributes || {};
      for (var name in attributes) {
        if (!attributes.hasOwnProperty(name))
          continue;
        var field = new Attribute(name, attributes[name]);
        this.defineField(field);
      }
      var relationships = schema.relationships || {};
      for (var name in relationships) {
        if (!relationships.hasOwnProperty(name))
          continue;
        var options = relationships[name];
        console.assert(options.kind, "Relationships must have a 'kind' property specified");
        var field;
        if (options.kind === 'belongsTo') {
          field = new BelongsTo(name, options);
        } else if (options.kind === 'hasMany') {
          field = new HasMany(name, options);
        } else {
          console.assert(false, "Unkown relationship kind '" + options.kind + "'. Supported kinds are 'belongsTo' and 'hasMany'");
        }
        this.defineField(field);
      }
    },
    defineField: function(field) {
      field.defineProperty(this.prototype);
      field.parentType = this;
      this.ownFields.set(field.name, field);
      return field;
    },
    get ownFields() {
      if (!this.hasOwnProperty('_ownFields')) {
        this._ownFields = new Map();
      }
      return this._ownFields;
    },
    get fields() {
      if (this._fields)
        return this._fields;
      var res = new Map(),
          parentClass = this.parentType;
      var maps = [this.ownFields];
      if (parentClass.prototype instanceof $Model) {
        var parentFields = parentClass.fields;
        if (parentFields) {
          maps.push(parentClass.fields);
        }
      }
      for (var i = 0; i < maps.length; i++) {
        maps[i].forEach(function(field, name) {
          res.set(name, field);
        });
      }
      return this._fields = res;
    },
    get attributes() {
      if (this._attributes)
        return this._attributes;
      var res = new Map();
      this.fields.forEach(function(options, name) {
        if (options.kind === 'attribute') {
          res.set(name, options);
        }
      });
      return this._attributes = res;
    },
    get relationships() {
      if (this._relationships)
        return this._relationships;
      var res = new Map();
      this.fields.forEach(function(options, name) {
        if (options.kind === 'belongsTo' || options.kind === 'hasMany') {
          reifyRelationshipType(options);
          res.set(name, options);
        }
      });
      return this._relationships = res;
    },
    eachRelationship: function(callback, binding) {
      this.relationships.forEach(function(options, name) {
        callback.call(binding, name, options);
      });
    },
    get parentType() {
      return Object.getPrototypeOf(this);
    },
    inverseFor: function(name) {
      var relationship = this.relationships.get(name);
      if (!relationship) {
        return null;
      }
      var inverseType = relationship.type;
      if (typeof relationship.inverse !== 'undefined') {
        var inverseName = relationship.inverse;
        return inverseName && inverseType.relationships.get(inverseName);
      }
      var possibleRelationships = findPossibleInverses(this, inverseType);
      if (possibleRelationships.length === 0) {
        return null;
      }
      console.assert(possibleRelationships.length === 1, "You defined the '" + name + "' relationship on " + this + " but multiple possible inverse relationships of type " + this + " were found on " + inverseType + ".");
      function findPossibleInverses(type, inverseType, possibleRelationships) {
        possibleRelationships = possibleRelationships || [];
        var relationships = inverseType.relationships;
        var typeKey = type.typeKey;
        var propertyName = camelize(typeKey);
        var inverse = relationships.get(propertyName) || relationships.get(pluralize(propertyName));
        if (inverse) {
          possibleRelationships.push(inverse);
        }
        var parentType = type.parentType;
        if (parentType && parentType.typeKey) {}
        return possibleRelationships;
      }
      return possibleRelationships[0];
    }
  }, BaseClass);
  var $__default = Model;
  function reifyRelationshipType(relationship) {
    if (!relationship.type) {
      relationship.type = Coalesce.__container__.lookupFactory('model:' + relationship.typeKey);
    }
    if (!relationship.type) {
      throw new Error("Could not find a type for '" + relationship.name + "' with typeKey '" + relationship.typeKey + "'");
    }
    if (!relationship.type.typeKey) {
      throw new Error("Relationship '" + relationship.name + "' has no typeKey");
    }
    if (!relationship.typeKey) {
      relationship.typeKey = relationship.type.typeKey;
    }
  }
  function sessionAlias(name) {
    return function() {
      var session = this.session;
      console.assert(session, "Cannot call " + name + " on a detached model");
      var args = [].splice.call(arguments, 0);
      args.unshift(this);
      return session[name].apply(session, args);
    };
  }
  Model.reopen({
    load: sessionAlias('loadModel'),
    refresh: sessionAlias('refresh'),
    deleteModel: sessionAlias('deleteModel'),
    remoteCall: sessionAlias('remoteCall'),
    markClean: sessionAlias('markClean'),
    invalidate: sessionAlias('invalidate'),
    touch: sessionAlias('touch')
  });
  Model.reopenClass({find: function(id) {
      if (!Coalesce.__container__) {
        throw new Error("The Coalesce.__container__ property must be set in order to use static find methods.");
      }
      var container = Coalesce.__container__;
      var session = container.lookup('session:main');
      return session.find(this, id);
    }});
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/model/relationship", ['./field'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/model/relationship";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var Field = $__0.default;
  var Relationship = function Relationship(name, options) {
    console.assert(options.type || options.typeKey, "Must specify a `type` or `typeKey` option");
    if (typeof options.type === "string") {
      var typeKey = options.type;
      delete options.type;
      options.typeKey = typeKey;
    } else if (!options.typeKey) {
      options.typeKey = options.type.typeKey;
    }
    $traceurRuntime.superCall(this, $Relationship.prototype, "constructor", [name, options]);
  };
  var $Relationship = Relationship;
  ($traceurRuntime.createClass)(Relationship, {}, {}, Field);
  var $__default = Relationship;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/namespace", [], function() {
  "use strict";
  var __moduleName = "coalesce/namespace";
  var ajax = this.jQuery && this.jQuery.ajax;
  var Backburner = this.Backburner;
  if (requireModule && typeof requireModule === 'function') {
    try {
      Backburner = requireModule('backburner').Backburner;
    } catch (e) {}
  }
  var Coalesce = {
    VERSION: '0.4.0+dev.183ae1df',
    Promise: Promise,
    ajax: ajax,
    run: Backburner && new Backburner(['actions'])
  };
  var $__default = Coalesce;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
}.bind(Reflect.global));

define("coalesce/rest/embedded_manager", ['../utils/base_class'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/rest/embedded_manager";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var BaseClass = $__0.default;
  var EmbeddedManager = function EmbeddedManager(adapter) {
    this.adapter = adapter;
    this._parentMap = {};
    this._cachedIsEmbedded = new Map();
  };
  ($traceurRuntime.createClass)(EmbeddedManager, {
    updateParents: function(model) {
      var type = model.constructor,
          adapter = this.adapter,
          typeKey = type.typeKey,
          serializer = adapter.serializerFor(typeKey);
      this.eachEmbeddedRecord(model, function(embedded, kind) {
        this.adapter.reifyClientId(embedded);
        this._parentMap[embedded.clientId] = model;
      }, this);
    },
    findParent: function(model) {
      var parent = this._parentMap[model.clientId];
      return parent;
    },
    isEmbedded: function(model) {
      var type = model.constructor,
          result = this._cachedIsEmbedded.get(type);
      if (result !== undefined)
        return result;
      var adapter = this.adapter,
          result = false;
      type.eachRelationship(function(name, relationship) {
        var serializer = adapter.serializerFor(relationship.typeKey),
            inverse = type.inverseFor(relationship.name);
        if (!inverse)
          return;
        var config = serializer.configFor(inverse.name);
        result = result || config.embedded === 'always';
      }, this);
      this._cachedIsEmbedded.set(type, result);
      return result;
    },
    embeddedType: function(type, name) {
      var serializer = this.adapter.serializerFactory.serializerForType(type);
      return serializer.embeddedType(type, name);
    },
    eachEmbeddedRecord: function(model, callback, binding) {
      this.eachEmbeddedBelongsToRecord(model, callback, binding);
      this.eachEmbeddedHasManyRecord(model, callback, binding);
    },
    eachEmbeddedBelongsToRecord: function(model, callback, binding) {
      this.eachEmbeddedBelongsTo(model.constructor, function(name, relationship, embeddedType) {
        if (!model.isFieldLoaded(name)) {
          return;
        }
        var embeddedRecord = model[name];
        if (embeddedRecord) {
          callback.call(binding, embeddedRecord, embeddedType);
        }
      });
    },
    eachEmbeddedHasManyRecord: function(model, callback, binding) {
      this.eachEmbeddedHasMany(model.constructor, function(name, relationship, embeddedType) {
        if (!model.isFieldLoaded(name)) {
          return;
        }
        var collection = model[name];
        collection.forEach(function(model) {
          callback.call(binding, model, embeddedType);
        });
      });
    },
    eachEmbeddedHasMany: function(type, callback, binding) {
      this.eachEmbeddedRelationship(type, 'hasMany', callback, binding);
    },
    eachEmbeddedBelongsTo: function(type, callback, binding) {
      this.eachEmbeddedRelationship(type, 'belongsTo', callback, binding);
    },
    eachEmbeddedRelationship: function(type, kind, callback, binding) {
      type.eachRelationship(function(name, relationship) {
        var embeddedType = this.embeddedType(type, name);
        if (embeddedType) {
          if (relationship.kind === kind) {
            callback.call(binding, name, relationship, embeddedType);
          }
        }
      }, this);
    },
    eachEmbeddedRelative: function(model, callback, binding, visited) {
      if (!visited)
        visited = new Set();
      if (visited.has(model))
        return;
      visited.add(model);
      callback.call(binding, model);
      this.eachEmbeddedRecord(model, function(embeddedRecord, embeddedType) {
        this.eachEmbeddedRelative(embeddedRecord, callback, binding, visited);
      }, this);
      var parent = this.findParent(model);
      if (parent) {
        this.eachEmbeddedRelative(parent, callback, binding, visited);
      }
    }
  }, {}, BaseClass);
  var $__default = EmbeddedManager;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/rest/operation", ['../namespace'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/rest/operation";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var Coalesce = $__0.default;
  var Operation = function Operation(model, graph, adapter, session) {
    this.model = model;
    this.graph = graph;
    this.adapter = adapter;
    this.session = session;
    this.force = false;
    this.children = new Set();
    this.parents = new Set();
    var op = this;
    this.promise = new Coalesce.Promise(function(resolve, reject) {
      op.resolve = resolve;
      op.reject = reject;
    });
  };
  ($traceurRuntime.createClass)(Operation, {
    then: function() {
      for (var args = [],
          $__3 = 0; $__3 < arguments.length; $__3++)
        args[$__3] = arguments[$__3];
      var promise = this.promise;
      return promise.then.apply(promise, args);
    },
    get dirtyRelationships() {
      var adapter = this.adapter,
          model = this.model,
          rels = [],
          shadow = this.shadow;
      if (model.isNew) {
        model.eachRelationship(function(name, relationship) {
          if (adapter.isRelationshipOwner(relationship)) {
            rels.push({
              name: name,
              type: relationship.kind,
              relationship: relationship,
              oldValue: null
            });
          }
        }, this);
      } else {
        var diff = model.diff(shadow);
        for (var i = 0; i < diff.length; i++) {
          var d = diff[i];
          if (d.relationship && adapter.isRelationshipOwner(d.relationship)) {
            rels.push(d);
          }
        }
      }
      return rels;
    },
    get isDirty() {
      return !!this.dirtyType;
    },
    get isDirtyFromUpdates() {
      var model = this.model,
          shadow = this.shadow,
          adapter = this.adapter;
      if (!shadow)
        return false;
      var diff = model.diff(shadow);
      var dirty = false;
      var relDiff = [];
      for (var i = 0; i < diff.length; i++) {
        var d = diff[i];
        if (d.type == 'attr') {
          dirty = true;
        } else {
          relDiff.push(d);
        }
      }
      return dirty || adapter.isDirtyFromRelationships(model, shadow, relDiff);
    },
    get dirtyType() {
      var model = this.model;
      if (model.isNew) {
        return "created";
      } else if (model.isDeleted) {
        return "deleted";
      } else if (this.isDirtyFromUpdates || this.force) {
        return "updated";
      }
    },
    perform: function() {
      var adapter = this.adapter,
          session = this.session,
          dirtyType = this.dirtyType,
          model = this.model,
          shadow = this.shadow,
          promise;
      if (!dirtyType || !adapter.shouldSave(model)) {
        if (adapter.isEmbedded(model)) {
          promise = this._promiseFromEmbeddedParent();
        } else {
          promise = Coalesce.Promise.resolve();
        }
      } else if (dirtyType === "created") {
        promise = adapter._contextualizePromise(adapter._create(model), model);
      } else if (dirtyType === "updated") {
        promise = adapter._contextualizePromise(adapter._update(model), model);
      } else if (dirtyType === "deleted") {
        promise = adapter._contextualizePromise(adapter._deleteModel(model), model);
      }
      promise = promise.then(function(serverModel) {
        if (!model.id) {
          model.id = serverModel.id;
        }
        if (!serverModel) {
          serverModel = model;
        } else {
          if (serverModel.meta && Object.keys(serverModel).length == 1) {
            model.meta = serverModel.meta;
            serverModel = model;
          }
          if (!serverModel.clientRev) {
            serverModel.clientRev = model.clientRev;
          }
        }
        return serverModel;
      }, function(serverModel) {
        if (shadow && serverModel === model) {
          shadow.errors = serverModel.errors;
          throw shadow;
        }
        throw serverModel;
      });
      this.resolve(promise);
      return this;
    },
    get _embeddedParent() {
      var model = this.model,
          parentModel = this.adapter._embeddedManager.findParent(model),
          graph = this.graph;
      console.assert(parentModel, "Embedded parent does not exist!");
      return graph.getOp(parentModel);
    },
    _promiseFromEmbeddedParent: function() {
      var model = this.model,
          adapter = this.adapter;
      function findInParent(parentModel) {
        var res = null;
        adapter._embeddedManager.eachEmbeddedRecord(parentModel, function(child, embeddedType) {
          if (res)
            return;
          if (child.isEqual(model))
            res = child;
        });
        return res;
      }
      return this._embeddedParent.then(function(parent) {
        return findInParent(parent);
      }, function(parent) {
        throw findInParent(parent);
      });
    },
    addChild: function(child) {
      this.children.add(child);
      child.parents.add(this);
    }
  }, {});
  var $__default = Operation;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/rest/operation_graph", ['./operation', '../namespace', '../utils/array_from'], function($__0,$__2,$__4) {
  "use strict";
  var __moduleName = "coalesce/rest/operation_graph";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var Operation = $__0.default;
  var Coalesce = $__2.default;
  var array_from = $__4.default;
  var OperationGraph = function OperationGraph(models, shadows, adapter, session) {
    this.models = models;
    this.shadows = shadows;
    this.adapter = adapter;
    this.session = session;
    this.ops = new Map();
    this.build();
  };
  ($traceurRuntime.createClass)(OperationGraph, {
    perform: function() {
      var adapter = this.adapter,
          cumulative = [];
      function createNestedPromise(op) {
        var promise;
        if (op.parents.size > 0) {
          promise = Coalesce.Promise.all(array_from(op.parents)).then(function() {
            return op.perform();
          });
        } else {
          promise = op.perform();
        }
        promise = promise.then(function(model) {
          cumulative.push(model);
          return model;
        }, function(model) {
          cumulative.push(model);
          throw model;
        });
        if (op.children.size > 0) {
          promise = promise.then(function(model) {
            return Coalesce.Promise.all(array_from(op.children)).then(function(models) {
              adapter.rebuildRelationships(models, model);
              return model;
            }, function(models) {
              throw model;
            });
          });
        }
        return promise;
      }
      var promises = [];
      this.ops.forEach(function(op, model) {
        promises.push(createNestedPromise(op));
      });
      return Coalesce.Promise.all(promises).then(function() {
        return cumulative;
      }, function(err) {
        throw cumulative;
      });
    },
    build: function() {
      var adapter = this.adapter,
          models = this.models,
          shadows = this.shadows,
          ops = this.ops;
      models.forEach(function(model) {
        var shadow = shadows.getModel(model);
        console.assert(shadow || model.isNew, "Shadow does not exist for non-new model");
        var op = this.getOp(model);
        op.shadow = shadow;
        var rels = op.dirtyRelationships;
        for (var i = 0; i < rels.length; i++) {
          var d = rels[i];
          var name = d.name;
          var parentModel = model[name] || d.oldValue && shadows.getModel(d.oldValue);
          var isEmbeddedRel = adapter.embeddedType(model.constructor, name);
          if (parentModel && !isEmbeddedRel) {
            var parentOp = this.getOp(parentModel);
            parentOp.addChild(op);
          }
        }
        var isEmbedded = adapter.isEmbedded(model);
        if (op.isDirty && isEmbedded) {
          var rootModel = adapter.findEmbeddedRoot(model, models);
          var rootOp = this.getOp(rootModel);
          rootOp.force = true;
          var parentModel = adapter._embeddedManager.findParent(model);
          var parentOp = this.getOp(parentModel);
          op.parents.forEach(function(parent) {
            if (parent === rootOp)
              return;
            if (adapter.findEmbeddedRoot(parent.model, models) === rootModel)
              return;
            parent.addChild(rootOp);
          });
          parentOp.addChild(op);
        }
      }, this);
    },
    getOp: function(model) {
      var models = this.models,
          materializedModel = models.getModel(model);
      if (materializedModel)
        model = materializedModel;
      var op = this.ops.get(model);
      if (!op) {
        op = new Operation(model, this, this.adapter, this.session);
        this.ops.set(model, op);
      }
      return op;
    }
  }, {});
  var $__default = OperationGraph;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/rest/payload", ['../collections/model_set', '../utils/array_from'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/rest/payload";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var isArray = Array.isArray;
  var ModelSet = $__0.default;
  var array_from = $__2.default;
  var Payload = function Payload(iterable) {
    $traceurRuntime.superCall(this, $Payload.prototype, "constructor", [iterable]);
    this.isPayload = true;
    this.context = null;
    this.meta = null;
  };
  var $Payload = Payload;
  ($traceurRuntime.createClass)(Payload, {merge: function(session) {
      var merged = array_from(this).map(function(model) {
        return session.merge(model);
      }, this);
      var context = this.context;
      if (context && isArray(context)) {
        context = context.map(function(model) {
          return session.getModel(model);
        });
      } else if (context) {
        context = session.getModel(context);
      }
      var result = new $Payload(merged);
      result.context = context;
      result.meta = this.meta;
      result.errors = this.errors;
      return result;
    }}, {}, ModelSet);
  var $__default = Payload;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/rest/rest_adapter", ['../namespace', '../adapter', './embedded_manager', '../collections/model_set', './operation_graph', './serializers/payload', './serializers/errors', '../factories/serializer', '../utils/materialize_relationships', '../utils/inflector', '../utils/array_from'], function($__0,$__2,$__4,$__6,$__8,$__10,$__12,$__14,$__16,$__18,$__20) {
  "use strict";
  var __moduleName = "coalesce/rest/rest_adapter";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  if (!$__8 || !$__8.__esModule)
    $__8 = {default: $__8};
  if (!$__10 || !$__10.__esModule)
    $__10 = {default: $__10};
  if (!$__12 || !$__12.__esModule)
    $__12 = {default: $__12};
  if (!$__14 || !$__14.__esModule)
    $__14 = {default: $__14};
  if (!$__16 || !$__16.__esModule)
    $__16 = {default: $__16};
  if (!$__18 || !$__18.__esModule)
    $__18 = {default: $__18};
  if (!$__20 || !$__20.__esModule)
    $__20 = {default: $__20};
  var Coalesce = $__0.default;
  var Adapter = $__2.default;
  var EmbeddedManager = $__4.default;
  var ModelSet = $__6.default;
  var OperationGraph = $__8.default;
  var PayloadSerializer = $__10.default;
  var RestErrorsSerializer = $__12.default;
  var SerializerFactory = $__14.default;
  var materializeRelationships = $__16.default;
  var $__19 = $__18,
      decamelize = $__19.decamelize,
      pluralize = $__19.pluralize,
      camelize = $__19.camelize;
  var array_from = $__20.default;
  var RestAdapter = function RestAdapter() {
    $traceurRuntime.superCall(this, $RestAdapter.prototype, "constructor", []);
    this._embeddedManager = new EmbeddedManager(this);
    this.serializerFactory = new SerializerFactory(this.container);
    this._pendingOps = {};
  };
  var $RestAdapter = RestAdapter;
  ($traceurRuntime.createClass)(RestAdapter, {
    setupContainer: function(parent) {
      var container = parent.child();
      container.register('serializer:errors', RestErrorsSerializer);
      container.register('serializer:payload', PayloadSerializer);
      return container;
    },
    load: function(model, opts, session) {
      return this._mergeAndContextualizePromise(this._load(model, opts), session, model, opts);
    },
    _load: function(model, opts) {
      opts = opts || {};
      _.defaults(opts, {type: 'GET'});
      return this._remoteCall(model, null, null, opts);
    },
    update: function(model, opts, session) {
      return this._mergeAndContextualizePromise(this._update(model, opts), session, model, opts);
    },
    _update: function(model, opts) {
      opts = opts || {};
      _.defaults(opts, {type: 'PUT'});
      return this._remoteCall(model, null, model, opts);
    },
    create: function(model, opts, session) {
      return this._mergeAndContextualizePromise(this._create(model, opts), session, model, opts);
    },
    _create: function(model, opts) {
      return this._remoteCall(model, null, model, opts);
    },
    deleteModel: function(model, opts, session) {
      return this._mergeAndContextualizePromise(this._deleteModel(model, opts), session, model, opts);
    },
    _deleteModel: function(model, opts) {
      opts = opts || {};
      _.defaults(opts, {type: 'DELETE'});
      return this._remoteCall(model, null, null, opts);
    },
    query: function(typeKey, query, opts, session) {
      return this._mergeAndContextualizePromise(this._query(typeKey, query, opts), session, typeKey, opts);
    },
    _query: function(typeKey, query, opts) {
      opts = opts || {};
      _.defaults(opts, {
        type: 'GET',
        serialize: false,
        deserializer: 'payload'
      });
      return this._remoteCall(typeKey, null, query, opts);
    },
    remoteCall: function(context, name, data, opts, session) {
      var serialize = data && !!data.isModel;
      opts = opts || {};
      _.defaults(opts, {
        serialize: serialize,
        deserializer: 'payload'
      });
      return this._mergeAndContextualizePromise(this._remoteCall(context, name, data, opts), session, context, opts);
    },
    _remoteCall: function(context, name, data, opts) {
      var adapter = this,
          opts = this._normalizeOptions(opts),
          url;
      if (opts.url) {
        url = opts.url;
      } else {
        url = this.buildUrlFromContext(context, name);
      }
      var method = opts.type || "POST";
      if (opts.serialize !== false) {
        var serializer = opts.serializer,
            serializerOptions = opts.serializerOptions || {};
        if (!serializer && context) {
          serializer = this.serializerForContext(context);
        }
        if (serializer && data) {
          serializer = this.serializerFor(serializer);
          serializerOptions = _.defaults(serializerOptions, {context: context});
          data = serializer.serialize(data, serializerOptions);
        }
      }
      if (opts.params) {
        data = data || {};
        data = _.defaults(data, opts.params);
      }
      return this._deserializePromise(this.ajax(url, method, {data: data}), context, opts);
    },
    _normalizeOptions: function(opts) {
      opts = opts || {};
      if (opts.serializerOptions && typeof opts.serializerOptions.context === 'function') {
        opts.serializerOptions.context = opts.serializerOptions.context.typeKey;
      }
      return opts;
    },
    serializerForContext: function(context) {
      return this.defaultSerializer;
    },
    _deserializePromise: function(promise, context, opts) {
      var adapter = this;
      return promise.then(function(data) {
        if (opts.deserialize !== false) {
          var serializer = opts.deserializer || opts.serializer,
              serializerOptions = opts.serializerOptions || {};
          if (!serializer && context) {
            serializer = adapter.serializerForContext(context);
          }
          if (serializer) {
            serializer = adapter.serializerFor(serializer);
            _.defaults(serializerOptions, {context: context});
          }
          return serializer.deserialize(data, serializerOptions);
        }
        return data;
      }, function(xhr) {
        if (opts.deserialize !== false) {
          var data;
          if (xhr.responseText) {
            data = JSON.parse(xhr.responseText);
          } else {
            data = {};
          }
          var serializer = opts.errorSerializer || opts.deserializer || opts.serializer,
              serializerOptions = opts.serializerOptions || {};
          if (!serializer && context) {
            serializer = adapter.serializerForContext(context);
          }
          if (serializer) {
            serializer = adapter.serializerFor(serializer);
            serializerOptions = _.defaults(serializerOptions, {
              context: context,
              xhr: xhr
            });
          }
          throw serializer.deserialize(data, serializerOptions);
        }
        throw xhr;
      });
    },
    _mergePromise: function(promise, session, opts) {
      if (opts && opts.deserialize === false) {
        return promise;
      }
      function merge(deserialized) {
        if (typeof deserialized.merge === 'function') {
          return deserialized.merge(session);
        } else {
          return session.merge(deserialized);
        }
      }
      return promise.then(function(deserialized) {
        return merge(deserialized);
      }, function(deserialized) {
        throw merge(deserialized);
      });
    },
    _contextualizePromise: function(promise, context, opts) {
      if (opts && opts.deserializationContext !== undefined) {
        context = opts.deserializationContext;
      }
      function contextualize(merged) {
        if (context && merged.isPayload) {
          var result = merged.context;
          if (!result) {
            result = context;
          }
          result.meta = merged.meta;
          if (merged.errors && (!result.errors || result === context)) {
            result.errors = merged.errors;
          }
          return result;
        }
        return merged;
      }
      return promise.then(function(merged) {
        return contextualize(merged);
      }, function(merged) {
        throw contextualize(merged);
      });
    },
    _mergeAndContextualizePromise: function(promise, session, context, opts) {
      return this._contextualizePromise(this._mergePromise(promise, session, opts), context, opts);
    },
    mergePayload: function(data, context, session) {
      var payload = this.deserialize('payload', data, {context: context});
      if (!session) {
        session = this.container.lookup('session:main');
      }
      payload.merge(session);
      if (context) {
        return payload.context;
      }
      return payload;
    },
    willMergeModel: function(model) {
      this._embeddedManager.updateParents(model);
    },
    flush: function(session) {
      var models = this.buildDirtySet(session);
      var shadows = new ModelSet(array_from(models).map(function(model) {
        return session.shadows.getModel(model) || model.copy();
      }));
      this.removeEmbeddedOrphans(models, shadows, session);
      materializeRelationships(models);
      var op = new OperationGraph(models, shadows, this, session);
      return this._performFlush(op, session);
    },
    _performFlush: function(op, session) {
      var models = op.models,
          pending = new Set();
      models.forEach(function(model) {
        var op = this._pendingOps[model.clientId];
        if (op)
          pending.add(op);
      }, this);
      var adapter = this;
      if (pending.size > 0) {
        return Coalesce.Promise.all(array_from(pending)).then(function() {
          return adapter._performFlush(op, session);
        });
      }
      var promise = op.perform();
      models.forEach(function(model) {
        this._pendingOps[model.clientId] = promise;
      }, this);
      return promise.then(function(res) {
        models.forEach(function(model) {
          delete adapter._pendingOps[model.clientId];
        });
        return res.map(function(model) {
          return session.merge(model);
        });
      }, function(err) {
        models.forEach(function(model) {
          delete adapter._pendingOps[model.clientId];
        });
        throw err.map(function(model) {
          return session.merge(model);
        });
      });
    },
    rebuildRelationships: function(children, parent) {
      parent.suspendRelationshipObservers(function() {
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          child.eachLoadedRelationship(function(name, relationship) {
            if (relationship.kind === 'belongsTo') {
              var value = child[name],
                  inverse = child.constructor.inverseFor(name);
              if (inverse) {
                if (!(parent instanceof inverse.parentType)) {
                  return;
                }
                if (this.embeddedType(inverse.parentType, inverse.name)) {
                  return;
                }
                if (inverse.kind === 'hasMany' && parent.isFieldLoaded(inverse.name)) {
                  var parentCollection = parent[inverse.name];
                  if (child.isDeleted) {
                    parentCollection.removeObject(child);
                  } else if (value && value.isEqual(parent)) {
                    parentCollection.addObject(child);
                  }
                }
              }
            }
          }, this);
        }
      }, this);
    },
    isRelationshipOwner: function(relationship) {
      var config = this.configFor(relationship.parentType);
      var owner = config[relationship.name] && config[relationship.name].owner;
      return relationship.kind === 'belongsTo' && owner !== false || relationship.kind === 'hasMany' && owner === true;
    },
    embeddedType: function(type, name) {
      return this._embeddedManager.embeddedType(type, name);
    },
    isDirtyFromRelationships: function(model, cached, relDiff) {
      var serializer = this.serializerFactory.serializerForModel(model);
      for (var i = 0; i < relDiff.length; i++) {
        var diff = relDiff[i];
        if (this.isRelationshipOwner(diff.relationship) || serializer.embeddedType(model.constructor, diff.name) === 'always') {
          return true;
        }
      }
      return false;
    },
    shouldSave: function(model) {
      return !this.isEmbedded(model);
    },
    isEmbedded: function(model) {
      return this._embeddedManager.isEmbedded(model);
    },
    removeEmbeddedOrphans: function(models, shadows, session) {
      var orphans = [];
      models.forEach(function(model) {
        if (!this.isEmbedded(model))
          return;
        var root = this.findEmbeddedRoot(model, models);
        if (!root || root.isEqual(model)) {
          orphans.push(model);
        }
      }, this);
      models.removeObjects(orphans);
      shadows.removeObjects(orphans);
    },
    buildDirtySet: function(session) {
      var result = new ModelSet();
      session.dirtyModels.forEach(function(model) {
        result.add(model.copy());
        this._embeddedManager.eachEmbeddedRelative(model, function(embeddedModel) {
          this._embeddedManager.updateParents(embeddedModel);
          if (result.contains(embeddedModel)) {
            return;
          }
          var copy = embeddedModel.copy();
          result.add(copy);
        }, this);
      }, this);
      return result;
    },
    findEmbeddedRoot: function(model, models) {
      var parent = model;
      while (parent) {
        model = parent;
        parent = this._embeddedManager.findParent(model);
      }
      return models.getModel(model);
    },
    buildUrlFromContext: function(context, action) {
      var typeKey,
          id;
      if (typeof context === 'string') {
        typeKey = context;
      } else {
        typeKey = context.typeKey;
        id = context.id;
      }
      var url = this.buildUrl(typeKey, id);
      if (action) {
        url = url + '/' + action;
      }
      return url;
    },
    buildUrl: function(typeKey, id) {
      var url = [],
          host = this.host,
          prefix = this.urlPrefix();
      if (typeKey) {
        url.push(this.pathForType(typeKey));
      }
      if (id) {
        url.push(id);
      }
      if (prefix) {
        url.unshift(prefix);
      }
      url = url.join('/');
      if (!host && url) {
        url = '/' + url;
      }
      return url;
    },
    urlPrefix: function(path, parentURL) {
      var host = this.host,
          namespace = this.namespace,
          url = [];
      if (path) {
        if (path.charAt(0) === '/') {
          if (host) {
            path = path.slice(1);
            url.push(host);
          }
        } else if (!/^http(s)?:\/\//.test(path)) {
          url.push(parentURL);
        }
      } else {
        if (host) {
          url.push(host);
        }
        if (namespace) {
          url.push(namespace);
        }
      }
      if (path) {
        url.push(path);
      }
      return url.join('/');
    },
    pathForType: function(type) {
      var camelized = camelize(type);
      return pluralize(camelized);
    },
    ajaxError: function(jqXHR) {
      if (jqXHR && typeof jqXHR === 'object') {
        jqXHR.then = null;
      }
      return jqXHR;
    },
    ajax: function(url, type, hash) {
      var adapter = this;
      return new Coalesce.Promise(function(resolve, reject) {
        hash = adapter.ajaxOptions(url, type, hash);
        hash.success = function(json) {
          Coalesce.run(null, resolve, json);
        };
        hash.error = function(jqXHR, textStatus, errorThrown) {
          Coalesce.run(null, reject, adapter.ajaxError(jqXHR));
        };
        Coalesce.ajax(hash);
      }, "Coalesce: RestAdapter#ajax " + type + " to " + url);
    },
    ajaxOptions: function(url, type, hash) {
      hash = hash || {};
      hash.url = url;
      hash.type = type;
      hash.dataType = 'json';
      hash.context = this;
      if (hash.data && type !== 'GET') {
        hash.contentType = 'application/json; charset=utf-8';
        hash.data = JSON.stringify(hash.data);
      }
      var headers = this.headers;
      if (headers !== undefined) {
        hash.beforeSend = function(xhr) {
          for (var key in headers) {
            if (!headers.hasOwnProperty(key))
              continue;
            xhr.setRequestHeader(key, headers[key]);
          }
        };
      }
      return hash;
    }
  }, {}, Adapter);
  var $__default = RestAdapter;
  RestAdapter.reopen({defaultSerializer: 'payload'});
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/rest/serializers/errors", ['../../serializers/base', '../../error', '../../utils/inflector', '../../utils/is_empty'], function($__0,$__2,$__4,$__6) {
  "use strict";
  var __moduleName = "coalesce/rest/serializers/errors";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  var Serializer = $__0.default;
  var Error = $__2.default;
  var camelize = $__4.camelize;
  var isEmpty = $__6.default;
  var ErrorsSerializer = function ErrorsSerializer() {
    $traceurRuntime.defaultSuperCall(this, $ErrorsSerializer.prototype, arguments);
  };
  var $ErrorsSerializer = ErrorsSerializer;
  ($traceurRuntime.createClass)(ErrorsSerializer, {
    deserialize: function(serialized, opts) {
      var xhr = opts && opts.xhr;
      if (!xhr && (isEmpty(serialized) || isEmptyObject(serialized)))
        return;
      var Type = this.container.lookupFactory('model:errors');
      var res = Type.create();
      for (var key in serialized) {
        res[this.transformPropertyKey(key)] = serialized[key];
      }
      if (xhr) {
        res.status = xhr.status;
        res.xhr = xhr;
      }
      return res;
    },
    transformPropertyKey: function(name) {
      return camelize(name);
    },
    serialize: function(id) {
      throw new Error("Errors are not currently serialized down to the server.");
    }
  }, {}, Serializer);
  var $__default = ErrorsSerializer;
  function isEmptyObject(obj) {
    return Object.keys(obj).length === 0;
  }
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/rest/serializers/payload", ['../../utils/materialize_relationships', '../../serializers/base', '../payload', '../../utils/inflector'], function($__0,$__2,$__4,$__6) {
  "use strict";
  var __moduleName = "coalesce/rest/serializers/payload";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  var materializeRelationships = $__0.default;
  var Serializer = $__2.default;
  var Payload = $__4.default;
  var singularize = $__6.singularize;
  var PayloadSerializer = function PayloadSerializer() {
    $traceurRuntime.defaultSuperCall(this, $PayloadSerializer.prototype, arguments);
  };
  var $PayloadSerializer = PayloadSerializer;
  ($traceurRuntime.createClass)(PayloadSerializer, {
    singularize: function(name) {
      return singularize(name);
    },
    typeKeyFor: function(name) {
      var singular = this.singularize(name),
          aliases = this.aliases,
          alias = aliases[name];
      return alias || singular;
    },
    rootForTypeKey: function(typeKey) {
      return typeKey;
    },
    serialize: function(model) {
      var typeKey = model.typeKey,
          root = this.rootForTypeKey(typeKey),
          res = {},
          serializer = this.serializerFor(typeKey);
      res[root] = serializer.serialize(model);
      return res;
    },
    deserialize: function(hash, opts) {
      opts = opts || {};
      var result = new Payload(),
          metaKey = this.metaKey,
          errorsKey = this.errorsKey,
          context = opts.context,
          xhr = opts.xhr;
      if (context && typeof context === 'string') {
        result.context = [];
      }
      function checkForContext(model) {
        if (context) {
          if (typeof context === 'string' && typeKey === context) {
            result.context.push(model);
          } else if (context.isModel && context.isEqual(model)) {
            result.context = model;
          }
        }
      }
      for (var prop in hash) {
        if (!hash.hasOwnProperty(prop)) {
          continue;
        }
        if (prop === metaKey) {
          result.meta = hash[prop];
          continue;
        }
        var value = hash[prop];
        if (prop === errorsKey) {
          var serializer = this.serializerFor('errors', opts),
              errors = serializer.deserialize(value, opts);
          result.errors = errors;
          continue;
        }
        var typeKey = this.typeKeyFor(prop),
            serializer = this.serializerFor(typeKey);
        if (Array.isArray(value)) {
          for (var i = 0; i < value.length; i++) {
            var model = serializer.deserialize(value[i]);
            checkForContext(model);
            result.add(model);
          }
        } else {
          var model = serializer.deserialize(value);
          checkForContext(model);
          result.add(model);
        }
      }
      if (xhr) {
        var errors = result.errors;
        if (!errors) {
          var serializer = this.serializerFor('errors'),
              errors = serializer.deserialize({}, opts);
          result.errors = errors;
        }
      }
      materializeRelationships(result, this.idManager);
      return result;
    }
  }, {}, Serializer);
  var $__default = PayloadSerializer;
  PayloadSerializer.reopen({
    metaKey: 'meta',
    aliases: {},
    errorsKey: 'errors'
  });
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/serializers/base", ['../factories/serializer', '../utils/base_class'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/serializers/base";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var SerializerFactory = $__0.default;
  var BaseClass = $__2.default;
  var Base = function Base() {
    this.serializerFactory = new SerializerFactory(this.container);
  };
  ($traceurRuntime.createClass)(Base, {
    serialize: function() {},
    deserialize: function() {},
    serializerFor: function(typeKey) {
      return this.serializerFactory.serializerFor(typeKey);
    }
  }, {}, BaseClass);
  var $__default = Base;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/serializers/belongs_to", ['./base'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/serializers/belongs_to";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var Serializer = $__0.default;
  var BelongsToSerializer = function BelongsToSerializer() {
    $traceurRuntime.defaultSuperCall(this, $BelongsToSerializer.prototype, arguments);
  };
  var $BelongsToSerializer = BelongsToSerializer;
  ($traceurRuntime.createClass)(BelongsToSerializer, {
    deserialize: function(serialized, opts) {
      if (!serialized) {
        return null;
      }
      if (!opts.embedded) {
        var idSerializer = this.serializerFor('id');
        serialized = {id: idSerializer.deserialize(serialized)};
        opts.reifyClientId = false;
      }
      return this.deserializeModel(serialized, opts);
    },
    deserializeModel: function(serialized, opts) {
      var serializer = this.serializerFor(opts.typeKey);
      return serializer.deserialize(serialized, opts);
    },
    serialize: function(model, opts) {
      if (!model) {
        return null;
      }
      if (opts.embedded) {
        return this.serializeModel(model, opts);
      }
      var idSerializer = this.serializerFor('id');
      return idSerializer.serialize(model.id);
    },
    serializeModel: function(model, opts) {
      var serializer = this.serializerFor(opts.typeKey);
      return serializer.serialize(model);
    }
  }, {}, Serializer);
  var $__default = BelongsToSerializer;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/serializers/boolean", ['./base'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/serializers/boolean";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var Serializer = $__0.default;
  var BooleanSerializer = function BooleanSerializer() {
    $traceurRuntime.defaultSuperCall(this, $BooleanSerializer.prototype, arguments);
  };
  var $BooleanSerializer = BooleanSerializer;
  ($traceurRuntime.createClass)(BooleanSerializer, {
    deserialize: function(serialized) {
      var type = typeof serialized;
      if (type === "boolean") {
        return serialized;
      } else if (type === "string") {
        return serialized.match(/^true$|^t$|^1$/i) !== null;
      } else if (type === "number") {
        return serialized === 1;
      } else {
        return false;
      }
    },
    serialize: function(deserialized) {
      return Boolean(deserialized);
    }
  }, {}, Serializer);
  var $__default = BooleanSerializer;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/serializers/date", ['./base', '../utils/parse_date'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/serializers/date";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var Serializer = $__0.default;
  var parseDate = $__2.default;
  var DateSerializer = function DateSerializer() {
    $traceurRuntime.defaultSuperCall(this, $DateSerializer.prototype, arguments);
  };
  var $DateSerializer = DateSerializer;
  ($traceurRuntime.createClass)(DateSerializer, {
    deserialize: function(serialized) {
      var type = typeof serialized;
      if (type === "string") {
        return new Date(parseDate(serialized));
      } else if (type === "number") {
        return new Date(serialized);
      } else if (serialized === null || serialized === undefined) {
        return serialized;
      } else {
        return null;
      }
    },
    serialize: function(date) {
      if (date instanceof Date) {
        var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        var pad = function(num) {
          return num < 10 ? "0" + num : "" + num;
        };
        var utcYear = date.getUTCFullYear(),
            utcMonth = date.getUTCMonth(),
            utcDayOfMonth = date.getUTCDate(),
            utcDay = date.getUTCDay(),
            utcHours = date.getUTCHours(),
            utcMinutes = date.getUTCMinutes(),
            utcSeconds = date.getUTCSeconds();
        var dayOfWeek = days[utcDay];
        var dayOfMonth = pad(utcDayOfMonth);
        var month = months[utcMonth];
        return dayOfWeek + ", " + dayOfMonth + " " + month + " " + utcYear + " " + pad(utcHours) + ":" + pad(utcMinutes) + ":" + pad(utcSeconds) + " GMT";
      } else {
        return null;
      }
    }
  }, {}, Serializer);
  var $__default = DateSerializer;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/serializers/has_many", ['../utils/is_empty', './base'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/serializers/has_many";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var isEmpty = $__0.default;
  var Serializer = $__2.default;
  var HasManySerializer = function HasManySerializer() {
    $traceurRuntime.defaultSuperCall(this, $HasManySerializer.prototype, arguments);
  };
  var $HasManySerializer = HasManySerializer;
  ($traceurRuntime.createClass)(HasManySerializer, {
    deserialize: function(serialized, opts) {
      if (!serialized)
        return [];
      if (!opts.embedded) {
        var idSerializer = this.serializerFor('id');
        serialized = serialized.map(function(id) {
          return {id: id};
        }, this);
        opts.reifyClientId = false;
      }
      return this.deserializeModels(serialized, opts);
    },
    deserializeModels: function(serialized, opts) {
      var serializer = this.serializerFor(opts.typeKey);
      return serialized.map(function(hash) {
        return serializer.deserialize(hash, opts);
      });
    },
    serialize: function(models, opts) {
      if (opts.embedded) {
        return this.serializeModels(models, opts);
      }
      return undefined;
    },
    serializeModels: function(models, opts) {
      var serializer = this.serializerFor(opts.typeKey);
      return models.map(function(model) {
        return serializer.serialize(model);
      });
    }
  }, {}, Serializer);
  var $__default = HasManySerializer;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/serializers/id", ['./base'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/serializers/id";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var Serializer = $__0.default;
  var IdSerializer = function IdSerializer() {
    $traceurRuntime.defaultSuperCall(this, $IdSerializer.prototype, arguments);
  };
  var $IdSerializer = IdSerializer;
  ($traceurRuntime.createClass)(IdSerializer, {
    deserialize: function(serialized) {
      if (serialized === undefined || serialized === null)
        return;
      return serialized + '';
    },
    serialize: function(id) {
      if (isNaN(id) || id === null) {
        return id;
      }
      return +id;
    }
  }, {}, Serializer);
  var $__default = IdSerializer;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/serializers/model", ['./base', '../utils/inflector'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/serializers/model";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var Serializer = $__0.default;
  var $__3 = $__2,
      singularize = $__3.singularize,
      camelize = $__3.camelize,
      underscore = $__3.underscore,
      dasherize = $__3.dasherize;
  var ModelSerializer = function ModelSerializer() {
    for (var args = [],
        $__5 = 0; $__5 < arguments.length; $__5++)
      args[$__5] = arguments[$__5];
    $traceurRuntime.superCall(this, $ModelSerializer.prototype, "constructor", [args]);
    this._keyCache = {};
    this._nameCache = {};
  };
  var $ModelSerializer = ModelSerializer;
  ($traceurRuntime.createClass)(ModelSerializer, {
    nameFor: function(key) {
      var name;
      if (name = this._nameCache[key]) {
        return name;
      }
      var configs = this.properties;
      for (var currentName in configs) {
        var current = configs[name];
        var keyName = current.key;
        if (keyName && key === keyName) {
          name = currentName;
        }
      }
      name = name || camelize(key);
      this._nameCache[key] = name;
      return name;
    },
    configFor: function(name) {
      var properties = this.properties;
      return properties && properties[name] || {};
    },
    keyFor: function(name, type, opts) {
      var key;
      if (key = this._keyCache[name]) {
        return key;
      }
      var config = this.configFor(name);
      key = config.key || this.keyForType(name, type, opts);
      this._keyCache[name] = key;
      return key;
    },
    keyForType: function(name, type, opts) {
      return underscore(name);
    },
    rootForType: function(type) {
      return type.typeKey;
    },
    serialize: function(model) {
      var serialized = {};
      this.addMeta(serialized, model);
      this.addAttributes(serialized, model);
      this.addRelationships(serialized, model);
      return serialized;
    },
    addMeta: function(serialized, model) {
      this.addProperty(serialized, model, 'id', 'id');
      this.addProperty(serialized, model, 'clientId', 'string');
      this.addProperty(serialized, model, 'rev', 'revision');
      this.addProperty(serialized, model, 'clientRev', 'revision');
    },
    addAttributes: function(serialized, model) {
      model.eachLoadedAttribute(function(name, attribute) {
        if (attribute.transient)
          return;
        this.addProperty(serialized, model, name, attribute.type);
      }, this);
    },
    addRelationships: function(serialized, model) {
      model.eachLoadedRelationship(function(name, relationship) {
        var config = this.configFor(name),
            opts = {
              typeKey: relationship.typeKey,
              embedded: config.embedded
            },
            kindKey = dasherize(relationship.kind);
        this.addProperty(serialized, model, name, kindKey, opts);
      }, this);
    },
    addProperty: function(serialized, model, name, type, opts) {
      var key = this.keyFor(name, type, opts),
          value = model[name],
          serializer;
      if (type) {
        serializer = this.serializerFor(type);
      }
      if (serializer) {
        value = serializer.serialize(value, opts);
      }
      if (value !== undefined) {
        serialized[key] = value;
      }
    },
    deserialize: function(hash, opts) {
      var model = this.createModel();
      this.extractMeta(model, hash, opts);
      this.extractAttributes(model, hash);
      this.extractRelationships(model, hash);
      return model;
    },
    extractMeta: function(model, hash, opts) {
      this.extractProperty(model, hash, 'id', 'id');
      this.extractProperty(model, hash, 'clientId', 'string');
      this.extractProperty(model, hash, 'rev', 'revision');
      this.extractProperty(model, hash, 'clientRev', 'revision');
      this.extractProperty(model, hash, 'errors', 'errors');
      if (!opts || opts.reifyClientId !== false) {
        this.idManager.reifyClientId(model);
      }
    },
    extractAttributes: function(model, hash) {
      model.eachAttribute(function(name, attribute) {
        this.extractProperty(model, hash, name, attribute.type);
      }, this);
    },
    extractRelationships: function(model, hash) {
      model.eachRelationship(function(name, relationship) {
        var config = this.configFor(name),
            opts = {
              typeKey: relationship.typeKey,
              embedded: config.embedded
            },
            kindKey = dasherize(relationship.kind);
        this.extractProperty(model, hash, name, kindKey, opts);
      }, this);
    },
    extractProperty: function(model, hash, name, type, opts) {
      var key = this.keyFor(name, type, opts),
          value = hash[key],
          serializer;
      if (typeof value === 'undefined') {
        return;
      }
      if (type) {
        serializer = this.serializerFor(type);
      }
      if (serializer) {
        value = serializer.deserialize(value, opts);
      }
      if (typeof value !== 'undefined') {
        model[name] = value;
      }
    },
    createModel: function() {
      return this.typeFor(this.typeKey).create();
    },
    typeFor: function(typeKey) {
      return this.container.lookupFactory('model:' + typeKey);
    },
    serializerFor: function(typeKey) {
      return this.serializerFactory.serializerFor(typeKey);
    },
    embeddedType: function(type, name) {
      var config = this.configFor(name);
      return config.embedded;
    }
  }, {}, Serializer);
  var $__default = ModelSerializer;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/serializers/number", ['../utils/is_empty', './base'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/serializers/number";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var isEmpty = $__0.default;
  var Serializer = $__2.default;
  var NumberSerializer = function NumberSerializer() {
    $traceurRuntime.defaultSuperCall(this, $NumberSerializer.prototype, arguments);
  };
  var $NumberSerializer = NumberSerializer;
  ($traceurRuntime.createClass)(NumberSerializer, {
    deserialize: function(serialized) {
      return isEmpty(serialized) ? null : Number(serialized);
    },
    serialize: function(deserialized) {
      return isEmpty(deserialized) ? null : Number(deserialized);
    }
  }, {}, Serializer);
  var $__default = NumberSerializer;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/serializers/revision", ['../utils/is_empty', './base'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/serializers/revision";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var isEmpty = $__0.default;
  var Serializer = $__2.default;
  var RevisionSerializer = function RevisionSerializer() {
    $traceurRuntime.defaultSuperCall(this, $RevisionSerializer.prototype, arguments);
  };
  var $RevisionSerializer = RevisionSerializer;
  ($traceurRuntime.createClass)(RevisionSerializer, {
    deserialize: function(serialized) {
      return serialized ? serialized : undefined;
    },
    serialize: function(deserialized) {
      return deserialized ? deserialized : undefined;
    }
  }, {}, Serializer);
  var $__default = RevisionSerializer;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/serializers/string", ['../utils/is_none', './base'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/serializers/string";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var isNone = $__0.default;
  var Serializer = $__2.default;
  var StringSerializer = function StringSerializer() {
    $traceurRuntime.defaultSuperCall(this, $StringSerializer.prototype, arguments);
  };
  var $StringSerializer = StringSerializer;
  ($traceurRuntime.createClass)(StringSerializer, {
    deserialize: function(serialized) {
      return isNone(serialized) ? null : String(serialized);
    },
    serialize: function(deserialized) {
      return isNone(deserialized) ? null : String(deserialized);
    }
  }, {}, Serializer);
  var $__default = StringSerializer;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/session/cache", ['../namespace'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/session/cache";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var Coalesce = $__0.default;
  var Cache = function Cache() {
    this._data = {};
  };
  ($traceurRuntime.createClass)(Cache, {
    addModel: function(model) {
      if (model.anyFieldsLoaded) {
        this.addPromise(model, Coalesce.Promise.resolve());
      }
    },
    removeModel: function(model) {
      delete this._data[model.clientId];
    },
    addPromise: function(model, promise) {
      this._data[model.clientId] = promise;
    },
    getPromise: function(model) {
      console.assert(model.clientId, "Model does not have a client id");
      return this._data[model.clientId];
    }
  }, {});
  var $__default = Cache;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/session/collection_manager", [], function() {
  "use strict";
  var __moduleName = "coalesce/session/collection_manager";
  var CollectionManager = function CollectionManager() {
    this.modelMap = {};
  };
  ($traceurRuntime.createClass)(CollectionManager, {
    register: function(array, model) {
      var clientId = model.clientId,
          arrays = this.modelMap[clientId];
      if (!arrays) {
        arrays = this.modelMap[clientId] = [];
      }
      if (arrays.indexOf(array) !== -1)
        return;
      arrays.push(array);
    },
    unregister: function(array, model) {
      var clientId = model.clientId,
          arrays = this.modelMap[clientId];
      if (arrays) {
        _.pull(arrays, array);
        if (arrays.length === 0) {
          delete this.modelMap[clientId];
        }
      }
    },
    modelWasDeleted: function(model) {
      var clientId = model.clientId,
          arrays = this.modelMap[clientId];
      if (arrays) {
        _.clone(arrays).forEach(function(array) {
          array.removeObject(model);
        });
      }
    }
  }, {});
  var $__default = CollectionManager;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/session/inverse_manager", ['../collections/model_set', '../utils/copy'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce/session/inverse_manager";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var ModelSet = $__0.default;
  var copy = $__2.default;
  var InverseManager = function InverseManager(session) {
    this.session = session;
    this.map = {};
  };
  ($traceurRuntime.createClass)(InverseManager, {
    register: function(model) {
      var session = this.session;
      model.eachLoadedRelationship(function(name, relationship) {
        var existingInverses = this._inversesFor(model, name),
            inversesToClear = existingInverses.copy();
        function checkInverse(inverseModel) {
          session.reifyClientId(inverseModel);
          if (existingInverses.contains(inverseModel)) {} else {
            this.registerRelationship(model, name, inverseModel);
          }
          inversesToClear.remove(inverseModel);
        }
        if (relationship.kind === 'belongsTo') {
          var inverseModel = model[name];
          if (inverseModel) {
            checkInverse.call(this, inverseModel);
          }
        } else if (relationship.kind === 'hasMany') {
          var inverseModels = model[name];
          inverseModels.forEach(function(inverseModel) {
            checkInverse.call(this, inverseModel);
          }, this);
        }
        inversesToClear.forEach(function(inverseModel) {
          this.unregisterRelationship(model, name, inverseModel);
        }, this);
      }, this);
    },
    unregister: function(model) {
      var clientId = model.clientId,
          inverses = this._inverses(model);
      for (var name in inverses) {
        var inverseModels = inverses[name],
            copiedInverseModels = copy(inverseModels);
        copiedInverseModels.forEach(function(inverseModel) {
          this.unregisterRelationship(model, name, inverseModel);
        }, this);
      }
      delete this.map[clientId];
    },
    registerRelationship: function(model, name, inverseModel) {
      var inverse = model.constructor.inverseFor(name);
      this._inversesFor(model, name).addObject(inverseModel);
      if (inverse) {
        this._inversesFor(inverseModel, inverse.name).addObject(model);
        this._addToInverse(inverseModel, inverse, model);
      }
    },
    unregisterRelationship: function(model, name, inverseModel) {
      var inverse = model.constructor.inverseFor(name);
      this._inversesFor(model, name).removeObject(inverseModel);
      if (inverse) {
        this._inversesFor(inverseModel, inverse.name).removeObject(model);
        this._removeFromInverse(inverseModel, inverse, model);
      }
    },
    _inverses: function(model) {
      var clientId = model.clientId,
          inverses = this.map[clientId];
      if (!inverses) {
        inverses = this.map[clientId] = {};
      }
      return inverses;
    },
    _inversesFor: function(model, name) {
      var inverses = this._inverses(model);
      var inversesFor = inverses[name];
      if (!inversesFor) {
        inversesFor = inverses[name] = new ModelSet();
      }
      return inversesFor;
    },
    _addToInverse: function(model, inverse, inverseModel) {
      model = this.session.models.getModel(model);
      if (!model || !model.isFieldLoaded(inverse.name))
        return;
      model.suspendRelationshipObservers(function() {
        if (inverse.kind === 'hasMany') {
          model[inverse.name].addObject(inverseModel);
        } else if (inverse.kind === 'belongsTo') {
          model[inverse.name] = inverseModel;
        }
      }, this);
    },
    _removeFromInverse: function(model, inverse, inverseModel) {
      model = this.session.models.getModel(model);
      if (!model || !model.isFieldLoaded(inverse.name))
        return;
      model.suspendRelationshipObservers(function() {
        if (inverse.kind === 'hasMany') {
          model[inverse.name].removeObject(inverseModel);
        } else if (inverse.kind === 'belongsTo') {
          model[inverse.name] = null;
        }
      }, this);
    }
  }, {});
  var $__default = InverseManager;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/session/session", ['../collections/model_array', '../collections/model_set', './collection_manager', './inverse_manager', '../model/model', './cache', '../factories/type', '../factories/merge', '../utils/copy', '../error', '../utils/array_from'], function($__0,$__2,$__4,$__6,$__8,$__10,$__12,$__14,$__16,$__18,$__20) {
  "use strict";
  var __moduleName = "coalesce/session/session";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  if (!$__8 || !$__8.__esModule)
    $__8 = {default: $__8};
  if (!$__10 || !$__10.__esModule)
    $__10 = {default: $__10};
  if (!$__12 || !$__12.__esModule)
    $__12 = {default: $__12};
  if (!$__14 || !$__14.__esModule)
    $__14 = {default: $__14};
  if (!$__16 || !$__16.__esModule)
    $__16 = {default: $__16};
  if (!$__18 || !$__18.__esModule)
    $__18 = {default: $__18};
  if (!$__20 || !$__20.__esModule)
    $__20 = {default: $__20};
  var ModelArray = $__0.default;
  var ModelSet = $__2.default;
  var CollectionManager = $__4.default;
  var InverseManager = $__6.default;
  var Model = $__8.default;
  var Cache = $__10.default;
  var TypeFactory = $__12.default;
  var MergeFactory = $__14.default;
  var copy = $__16.default;
  var Error = $__18.default;
  var array_from = $__20.default;
  var uuid = 1;
  var Session = function Session($__23) {
    var $__24 = $__23,
        adapter = $__24.adapter,
        idManager = $__24.idManager,
        container = $__24.container,
        parent = $__24.parent;
    this.adapter = adapter;
    this.idManager = idManager;
    this.container = container;
    this.parent = parent;
    this.models = new ModelSet();
    this.collectionManager = new CollectionManager();
    this.inverseManager = new InverseManager(this);
    this.shadows = new ModelSet();
    this.originals = new ModelSet();
    this.newModels = new ModelSet();
    this.cache = new Cache();
    this.typeFactory = new TypeFactory(container);
    this.mergeFactory = new MergeFactory(container);
    this._dirtyCheckingSuspended = false;
    this.name = "session" + uuid++;
  };
  ($traceurRuntime.createClass)(Session, {
    build: function(type, hash) {
      type = this.typeFor(type);
      var model = type.create(hash || {});
      return model;
    },
    create: function(type, hash) {
      var model = this.build(type, hash);
      return this.add(model);
    },
    adopt: function(model) {
      this.reifyClientId(model);
      console.assert(!model.session || model.session === this, "Models instances cannot be moved between sessions. Use `add` or `update` instead.");
      console.assert(!this.models.getModel(model) || this.models.getModel(model) === model, "An equivalent model already exists in the session!");
      if (model.isNew) {
        this.newModels.add(model);
      }
      if (!model.session) {
        this.models.add(model);
        this.inverseManager.register(model);
        model.session = this;
      }
      return model;
    },
    add: function(model) {
      this.reifyClientId(model);
      var dest = this.getModel(model);
      if (dest)
        return dest;
      if (model.session === this)
        return model;
      if (model.isNew && model.isDetached) {
        dest = model;
      } else if (model.isNew) {
        dest = model.copy();
      } else {
        dest = model.lazyCopy();
      }
      return this.adopt(dest);
    },
    remove: function(model) {
      this.models.remove(model);
      this.shadows.remove(model);
      this.originals.remove(model);
    },
    update: function(model) {
      this.reifyClientId(model);
      var dest = this.getModel(model);
      if (model.isNew && !dest) {
        dest = model.constructor.create();
        dest.clientId = model.clientId;
        this.adopt(dest);
      }
      if (model.isDetached || !dest) {
        return this.add(model);
      }
      if (model.isDeleted) {
        if (!dest.isDeleted) {
          this.deleteModel(dest);
        }
        return dest;
      }
      model.copyAttributes(dest);
      model.copyMeta(dest);
      model.eachLoadedRelationship(function(name, relationship) {
        if (relationship.kind === 'belongsTo') {
          var child = model[name];
          if (child) {
            dest[name] = child;
          }
        } else if (relationship.kind === 'hasMany') {
          var children = model[name];
          var destChildren = dest[name];
          children.copyTo(destChildren);
        }
      }, this);
      return dest;
    },
    deleteModel: function(model) {
      if (model.isNew) {
        var newModels = this.newModels;
        newModels.remove(model);
      } else {
        this.modelWillBecomeDirty(model);
      }
      model.isDeleted = true;
      this.collectionManager.modelWasDeleted(model);
      this.inverseManager.unregister(model);
    },
    fetch: function(type, id) {
      type = this.typeFor(type);
      var typeKey = type.typeKey;
      id = id + '';
      var model = this.getForId(typeKey, id);
      if (!model) {
        model = this.build(typeKey, {id: id});
        this.adopt(model);
      }
      return model;
    },
    load: function(type, id, opts) {
      var model = this.fetch(type, id);
      return this.loadModel(model, opts);
    },
    loadModel: function(model, opts) {
      console.assert(model.id, "Cannot load a model with an id");
      var promise = this.cache.getPromise(model);
      if (promise) {
        promise = promise.then(function() {
          return model;
        });
      } else {
        promise = this.adapter.load(model, opts, this);
        this.cache.addPromise(model, promise);
      }
      return promise;
    },
    find: function(type, query, opts) {
      if (typeof query === 'object') {
        return this.query(type, query, opts);
      }
      return this.load(type, query, opts);
    },
    query: function(type, query, opts) {
      type = this.typeFor(type);
      var typeKey = type.typeKey;
      var promise = this.adapter.query(typeKey, query, opts, this);
      return promise;
    },
    refresh: function(model, opts) {
      var session = this;
      return this.adapter.load(model, opts, this);
    },
    flush: function() {
      var session = this,
          dirtyModels = this.dirtyModels,
          newModels = this.newModels,
          shadows = this.shadows;
      dirtyModels.forEach(function(model) {
        model.clientRev += 1;
      }, this);
      var promise = this.adapter.flush(this);
      dirtyModels.forEach(function(model) {
        var original = this.originals.getModel(model);
        var shadow = this.shadows.getModel(model);
        if (shadow && (!original || original.rev < shadow.rev)) {
          this.originals.add(shadow);
        }
        this.markClean(model);
      }, this);
      newModels.clear();
      return promise;
    },
    getModel: function(model) {
      var res = this.models.getModel(model);
      if (!res && this.parent) {
        res = this.parent.getModel(model);
        if (res) {
          res = this.adopt(res.copy());
          this.updateCache(res);
        }
      }
      return res;
    },
    getForId: function(typeKey, id) {
      var clientId = this.idManager.getClientId(typeKey, id);
      return this.getForClientId(clientId);
    },
    getForClientId: function(clientId) {
      var res = this.models.getForClientId(clientId);
      if (!res && this.parent) {
        res = this.parent.getForClientId(clientId);
        if (res) {
          res = this.adopt(res.copy());
          this.updateCache(res);
        }
      }
      return res;
    },
    reifyClientId: function(model) {
      this.idManager.reifyClientId(model);
    },
    remoteCall: function(context, name, params, opts) {
      var session = this;
      if (opts && opts.deserializationContext && typeof opts.deserializationContext !== 'string') {
        opts.deserializationContext = opts.deserializationContext.typeKey;
      }
      return this.adapter.remoteCall(context, name, params, opts, this);
    },
    modelWillBecomeDirty: function(model) {
      if (this._dirtyCheckingSuspended) {
        return;
      }
      this.touch(model);
    },
    get dirtyModels() {
      var models = new ModelSet(array_from(this.shadows).map(function(model) {
        return this.models.getModel(model);
      }, this));
      this.newModels.forEach(function(model) {
        models.add(model);
      });
      return models;
    },
    suspendDirtyChecking: function(callback, binding) {
      var self = this;
      if (this._dirtyCheckingSuspended) {
        return callback.call(binding || self);
      }
      try {
        this._dirtyCheckingSuspended = true;
        return callback.call(binding || self);
      } finally {
        this._dirtyCheckingSuspended = false;
      }
    },
    newSession: function() {
      var child = this.constructor.create({
        parent: this,
        adapter: this.adapter,
        container: this.container,
        idManager: this.idManager
      });
      return child;
    },
    typeFor: function(key) {
      if (typeof key !== 'string') {
        return key;
      }
      return this.typeFactory.typeFor(key);
    },
    getShadow: function(model) {
      var shadows = this.shadows;
      var models = this.models;
      return shadows.getModel(model) || models.getModel(model);
    },
    updateCache: function(model) {
      this.cache.addModel(model);
    },
    invalidate: function(model) {
      this.cache.removeModel(model);
    },
    markClean: function(model) {
      this.shadows.remove(model);
    },
    touch: function(model) {
      if (!model.isNew) {
        var shadow = this.shadows.getModel(model);
        if (!shadow) {
          this.shadows.addObject(model.copy());
        }
      }
    },
    get isDirty() {
      return this.dirtyModels.size > 0;
    },
    mergeData: function(data, typeKey) {
      return this.adapter.mergeData(data, typeKey, this);
    },
    updateParent: function() {
      if (!this.parent) {
        throw new Error("Session does not have a parent");
      }
      var dirty = this.dirtyModels,
          parent = this.parent;
      dirty.forEach(function(model) {
        parent.update(model);
      }, this);
    },
    flushIntoParent: function() {
      if (!this.parent) {
        throw new Error("Session does not have a parent");
      }
      this.updateParent();
      return this.flush();
    },
    merge: function(model, visited) {
      if (this.parent) {
        model = this.parent.merge(model, visited);
      }
      this.reifyClientId(model);
      if (!visited)
        visited = new Set();
      if (visited.has(model)) {
        return this.getModel(model);
      }
      visited.add(model);
      var adapter = this.adapter;
      adapter.willMergeModel(model);
      this.updateCache(model);
      var detachedChildren = [];
      model.eachChild(function(child) {
        if (child.isDetached) {
          detachedChildren.push(child);
        }
      }, this);
      var merged;
      if (model.hasErrors) {
        merged = this._mergeError(model);
      } else {
        merged = this._mergeSuccess(model);
      }
      if (model.meta) {
        merged.meta = model.meta;
      }
      for (var i = 0; i < detachedChildren.length; i++) {
        var child = detachedChildren[i];
        this.merge(child, visited);
      }
      adapter.didMergeModel(model);
      return merged;
    },
    mergeModels: function(models) {
      var merged = new ModelArray();
      merged.session = this;
      merged.addObjects(models);
      merged.meta = models.meta;
      var session = this;
      models.forEach(function(model) {
        merged.pushObject(session.merge(model));
      });
      return merged;
    },
    _mergeSuccess: function(model) {
      var models = this.models,
          shadows = this.shadows,
          newModels = this.newModels,
          originals = this.originals,
          merged,
          ancestor,
          existing = models.getModel(model);
      if (existing && this._containsRev(existing, model)) {
        return existing;
      }
      var hasClientChanges = !existing || this._containsClientRev(model, existing);
      if (hasClientChanges) {
        ancestor = shadows.getModel(model);
      } else {
        ancestor = originals.getModel(model);
      }
      this.suspendDirtyChecking(function() {
        merged = this._mergeModel(existing, ancestor, model);
      }, this);
      if (hasClientChanges) {
        if (merged.isDeleted) {
          this.remove(merged);
        } else {
          if (shadows.contains(model)) {
            shadows.addData(model);
          }
          originals.remove(model);
          if (!merged.isNew) {
            newModels.remove(merged);
          }
        }
      } else {}
      merged.errors = null;
      return merged;
    },
    _mergeError: function(model) {
      var models = this.models,
          shadows = this.shadows,
          newModels = this.newModels,
          originals = this.originals,
          merged,
          ancestor,
          existing = models.getModel(model);
      if (!existing) {
        return model;
      }
      var hasClientChanges = this._containsClientRev(model, existing);
      if (hasClientChanges) {
        ancestor = shadows.getModel(model) || existing;
      } else {
        ancestor = originals.getModel(model);
      }
      if (ancestor && !this._containsRev(existing, model)) {
        this.suspendDirtyChecking(function() {
          merged = this._mergeModel(existing, ancestor, model);
        }, this);
      } else {
        merged = existing;
      }
      merged.errors = copy(model.errors);
      if (!model.isNew) {
        shadows.addData(model);
        originals.remove(model);
      }
      return merged;
    },
    _mergeModel: function(dest, ancestor, model) {
      if (!dest) {
        if (model.isDetached) {
          dest = model;
        } else {
          dest = model.copy();
        }
        this.adopt(dest);
        return dest;
      }
      dest.id = model.id;
      dest.clientId = model.clientId;
      dest.rev = model.rev;
      dest.isDeleted = model.isDeleted;
      this.adopt(dest);
      if (!ancestor) {
        ancestor = dest;
      }
      model.eachChild(function(child) {
        this.reifyClientId(child);
      }, this);
      var strategy = this.mergeFactory.mergeFor(model.typeKey);
      strategy.merge(dest, ancestor, model);
      return dest;
    },
    _containsRev: function(modelA, modelB) {
      if (!modelA.rev)
        return false;
      if (!modelB.rev)
        return false;
      return modelA.rev >= modelB.rev;
    },
    _containsClientRev: function(modelA, modelB) {
      return modelA.clientRev >= modelB.clientRev;
    },
    toString: function() {
      var res = this.name;
      if (this.parent) {
        res += "(child of " + this.parent.toString() + ")";
      }
      return res;
    },
    destroy: function() {}
  }, {create: function(props) {
      return new this(props);
    }});
  var $__default = Session;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/utils/array_from", [], function() {
  "use strict";
  var __moduleName = "coalesce/utils/array_from";
  var USE_NATIVE = typeof Set.prototype[Symbol.iterator] !== 'undefined';
  function from_array(iterable) {
    if (USE_NATIVE || Array.isArray(iterable)) {
      return Array.from.apply(this, arguments);
    }
    var res = [];
    iterable.forEach(function(value) {
      res.push(value);
    });
    return res;
  }
  var $__default = from_array;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/utils/base_class", [], function() {
  "use strict";
  var __moduleName = "coalesce/utils/base_class";
  var Base = function Base() {};
  ($traceurRuntime.createClass)(Base, {destroy: function() {}}, {
    create: function(props) {
      return new this(props);
    },
    reopen: function(props) {
      for (var key in props) {
        if (!props.hasOwnProperty(key))
          return;
        this.prototype[key] = props[key];
      }
      return this;
    },
    extend: function(props) {
      var klass = (function($__super) {
        var $__1 = function() {
          $traceurRuntime.defaultSuperCall(this, $__1.prototype, arguments);
        };
        return ($traceurRuntime.createClass)($__1, {}, {}, $__super);
      }(this));
      klass.reopen(props);
      return klass;
    },
    reopenClass: function(props) {
      for (var key in props) {
        if (!props.hasOwnProperty(key))
          return;
        this[key] = props[key];
      }
      return this;
    }
  });
  var $__default = Base;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/utils/copy", [], function() {
  "use strict";
  var __moduleName = "coalesce/utils/copy";
  function _copy(obj, deep, seen, copies) {
    var ret,
        loc,
        key;
    if ('object' !== typeof obj || obj === null)
      return obj;
    if (obj.copy && typeof obj.copy === 'function')
      return obj.copy(deep);
    if (deep && (loc = seen.indexOf(obj)) >= 0)
      return copies[loc];
    if (obj instanceof Array) {
      ret = obj.slice();
      if (deep) {
        loc = ret.length;
        while (--loc >= 0)
          ret[loc] = _copy(ret[loc], deep, seen, copies);
      }
    } else if (obj instanceof Date) {
      ret = new Date(obj.getTime());
    } else {
      ret = {};
      for (key in obj) {
        if (!obj.hasOwnProperty(key))
          continue;
        if (key.substring(0, 2) === '__')
          continue;
        ret[key] = deep ? _copy(obj[key], deep, seen, copies) : obj[key];
      }
    }
    if (deep) {
      seen.push(obj);
      copies.push(ret);
    }
    return ret;
  }
  function copy(obj, deep) {
    return _copy(obj, deep, deep ? [] : null, deep ? [] : null);
  }
  var $__default = copy;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/utils/inflector", [], function() {
  "use strict";
  var __moduleName = "coalesce/utils/inflector";
  var plurals = [];
  var singulars = [];
  var uncountables = [];
  function gsub(word, rule, replacement) {
    var pattern = new RegExp(rule.source || rule, 'gi');
    return pattern.test(word) ? word.replace(pattern, replacement) : null;
  }
  function plural(rule, replacement) {
    plurals.unshift([rule, replacement]);
  }
  function pluralize(word, count, includeNumber) {
    var result;
    if (count !== undefined) {
      count = parseFloat(count);
      result = (count === 1) ? singularize(word) : pluralize(word);
      result = (includeNumber) ? [count, result].join(' ') : result;
    } else {
      if (_(uncountables).include(word)) {
        return word;
      }
      result = word;
      _(plurals).detect(function(rule) {
        var res = gsub(word, rule[0], rule[1]);
        return res ? (result = res) : false;
      }, this);
    }
    return result;
  }
  function singular(rule, replacement) {
    singulars.unshift([rule, replacement]);
  }
  function singularize(word) {
    if (_(uncountables).include(word)) {
      return word;
    }
    var result = word;
    _(singulars).detect(function(rule) {
      var res = gsub(word, rule[0], rule[1]);
      return res ? (result = res) : false;
    }, this);
    return result;
  }
  function irregular(s, p) {
    plural('\\b' + singular + '\\b', p);
    singular('\\b' + plural + '\\b', s);
  }
  function uncountable(word) {
    uncountables.unshift(word);
  }
  function ordinalize(number) {
    if (isNaN(number)) {
      return number;
    }
    number = number.toString();
    var lastDigit = number.slice(-1);
    var lastTwoDigits = number.slice(-2);
    if (lastTwoDigits === '11' || lastTwoDigits === '12' || lastTwoDigits === '13') {
      return number + 'th';
    }
    switch (lastDigit) {
      case '1':
        return number + 'st';
      case '2':
        return number + 'nd';
      case '3':
        return number + 'rd';
      default:
        return number + 'th';
    }
  }
  function titleize(words) {
    if (typeof words !== 'string') {
      return words;
    }
    return words.replace(/\S+/g, function(word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  }
  function resetInflections() {
    plurals = [];
    singulars = [];
    uncountables = [];
    plural(/$/, 's');
    plural(/s$/, 's');
    plural(/(ax|test)is$/, '$1es');
    plural(/(octop|vir)us$/, '$1i');
    plural(/(octop|vir)i$/, '$1i');
    plural(/(alias|status)$/, '$1es');
    plural(/(bu)s$/, '$1ses');
    plural(/(buffal|tomat)o$/, '$1oes');
    plural(/([ti])um$/, '$1a');
    plural(/([ti])a$/, '$1a');
    plural(/sis$/, 'ses');
    plural(/(?:([^f])fe|([lr])?f)$/, '$1$2ves');
    plural(/(hive)$/, '$1s');
    plural(/([^aeiouy]|qu)y$/, '$1ies');
    plural(/(x|ch|ss|sh)$/, '$1es');
    plural(/(matr|vert|ind)(?:ix|ex)$/, '$1ices');
    plural(/([m|l])ouse$/, '$1ice');
    plural(/([m|l])ice$/, '$1ice');
    plural(/^(ox)$/, '$1en');
    plural(/^(oxen)$/, '$1');
    plural(/(quiz)$/, '$1zes');
    singular(/s$/, '');
    singular(/(n)ews$/, '$1ews');
    singular(/([ti])a$/, '$1um');
    singular(/((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)ses$/, '$1$2sis');
    singular(/(^analy)ses$/, '$1sis');
    singular(/([^f])ves$/, '$1fe');
    singular(/(hive)s$/, '$1');
    singular(/(tive)s$/, '$1');
    singular(/([lr])ves$/, '$1f');
    singular(/([^aeiouy]|qu)ies$/, '$1y');
    singular(/(s)eries$/, '$1eries');
    singular(/(m)ovies$/, '$1ovie');
    singular(/(x|ch|ss|sh)es$/, '$1');
    singular(/([m|l])ice$/, '$1ouse');
    singular(/(bus)es$/, '$1');
    singular(/(o)es$/, '$1');
    singular(/(shoe)s$/, '$1');
    singular(/(cris|ax|test)es$/, '$1is');
    singular(/(octop|vir)i$/, '$1us');
    singular(/(alias|status)es$/, '$1');
    singular(/^(ox)en/, '$1');
    singular(/(vert|ind)ices$/, '$1ex');
    singular(/(matr)ices$/, '$1ix');
    singular(/(quiz)zes$/, '$1');
    singular(/(database)s$/, '$1');
    irregular('person', 'people');
    irregular('man', 'men');
    irregular('child', 'children');
    irregular('sex', 'sexes');
    irregular('move', 'moves');
    irregular('cow', 'kine');
    uncountable('equipment');
    uncountable('information');
    uncountable('rice');
    uncountable('money');
    uncountable('species');
    uncountable('series');
    uncountable('fish');
    uncountable('sheep');
    uncountable('jeans');
    return this;
  }
  resetInflections();
  var STRING_DASHERIZE_REGEXP = (/[ _]/g);
  var STRING_DASHERIZE_CACHE = {};
  var STRING_DECAMELIZE_REGEXP = (/([a-z\d])([A-Z])/g);
  var STRING_CAMELIZE_REGEXP = (/(\-|_|\.|\s)+(.)?/g);
  var STRING_UNDERSCORE_REGEXP_1 = (/([a-z\d])([A-Z]+)/g);
  var STRING_UNDERSCORE_REGEXP_2 = (/\-|\s+/g);
  function decamelize(str) {
    return str.replace(STRING_DECAMELIZE_REGEXP, '$1_$2').toLowerCase();
  }
  function dasherize(str) {
    var cache = STRING_DASHERIZE_CACHE,
        hit = cache.hasOwnProperty(str),
        ret;
    if (hit) {
      return cache[str];
    } else {
      ret = decamelize(str).replace(STRING_DASHERIZE_REGEXP, '-');
      cache[str] = ret;
    }
    return ret;
  }
  function camelize(str) {
    return str.replace(STRING_CAMELIZE_REGEXP, function(match, separator, chr) {
      return chr ? chr.toUpperCase() : '';
    }).replace(/^([A-Z])/, function(match, separator, chr) {
      return match.toLowerCase();
    });
  }
  function classify(str) {
    var parts = str.split("."),
        out = [];
    for (var i = 0,
        l = parts.length; i < l; i++) {
      var camelized = camelize(parts[i]);
      out.push(camelized.charAt(0).toUpperCase() + camelized.substr(1));
    }
    return out.join(".");
  }
  function underscore(str) {
    return str.replace(STRING_UNDERSCORE_REGEXP_1, '$1_$2').replace(STRING_UNDERSCORE_REGEXP_2, '_').toLowerCase();
  }
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.substr(1);
  }
  return {
    get gsub() {
      return gsub;
    },
    get plural() {
      return plural;
    },
    get pluralize() {
      return pluralize;
    },
    get singular() {
      return singular;
    },
    get singularize() {
      return singularize;
    },
    get irregular() {
      return irregular;
    },
    get uncountable() {
      return uncountable;
    },
    get ordinalize() {
      return ordinalize;
    },
    get titleize() {
      return titleize;
    },
    get resetInflections() {
      return resetInflections;
    },
    get decamelize() {
      return decamelize;
    },
    get dasherize() {
      return dasherize;
    },
    get camelize() {
      return camelize;
    },
    get classify() {
      return classify;
    },
    get underscore() {
      return underscore;
    },
    get capitalize() {
      return capitalize;
    },
    __esModule: true
  };
});

define("coalesce/utils/is_empty", ['./is_none'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/utils/is_empty";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var isNone = $__0.default;
  function isEmpty(obj) {
    return isNone(obj) || (obj.length === 0 && typeof obj !== 'function') || (typeof obj === 'object' && obj.size === 0);
  }
  var $__default = isEmpty;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/utils/is_equal", [], function() {
  "use strict";
  var __moduleName = "coalesce/utils/is_equal";
  function isEqual(a, b) {
    if (a && 'function' === typeof a.isEqual)
      return a.isEqual(b);
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    return a === b;
  }
  var $__default = isEqual;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/utils/is_none", [], function() {
  "use strict";
  var __moduleName = "coalesce/utils/is_none";
  function isNone(obj) {
    return obj === null || obj === undefined;
  }
  var $__default = isNone;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/utils/lazy_copy", [], function() {
  "use strict";
  var __moduleName = "coalesce/utils/lazy_copy";
  function _lazyCopy(obj, deep, seen, copies) {
    var ret,
        loc,
        key;
    if ('object' !== typeof obj || obj === null)
      return obj;
    if (obj.lazyCopy && typeof obj.lazyCopy === 'function')
      return obj.lazyCopy(deep);
    if (obj.copy && typeof obj.copy === 'function')
      return obj.copy(deep);
    if (deep && (loc = seen.indexOf(obj)) >= 0)
      return copies[loc];
    if (obj instanceof Array) {
      ret = obj.slice();
      if (deep) {
        loc = ret.length;
        while (--loc >= 0)
          ret[loc] = _lazyCopy(ret[loc], deep, seen, copies);
      }
    } else if (obj instanceof Date) {
      ret = new Date(obj.getTime());
    } else {
      ret = {};
      for (key in obj) {
        if (!obj.hasOwnProperty(key))
          continue;
        if (key.substring(0, 2) === '__')
          continue;
        ret[key] = deep ? _lazyCopy(obj[key], deep, seen, copies) : obj[key];
      }
    }
    if (deep) {
      seen.push(obj);
      copies.push(ret);
    }
    return ret;
  }
  function lazyCopy(obj, deep) {
    return _lazyCopy(obj, deep, deep ? [] : null, deep ? [] : null);
  }
  var $__default = lazyCopy;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/utils/materialize_relationships", ['../collections/model_set'], function($__0) {
  "use strict";
  var __moduleName = "coalesce/utils/materialize_relationships";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var ModelSet = $__0.default;
  function materializeRelationships(models, idManager) {
    if (!(models instanceof ModelSet)) {
      models = new ModelSet(models);
    }
    models.forEach(function(model) {
      model.eachLoadedRelationship(function(name, relationship) {
        if (relationship.kind === 'belongsTo') {
          var child = model[name];
          if (child) {
            if (idManager)
              idManager.reifyClientId(child);
            child = models.getModel(child) || child;
            model[name] = child;
          }
        } else if (relationship.kind === 'hasMany') {
          var children = model[name];
          var lazyChildren = new ModelSet();
          lazyChildren.addObjects(children);
          children.clear();
          lazyChildren.forEach(function(child) {
            if (idManager)
              idManager.reifyClientId(child);
            child = models.getModel(child) || child;
            children.addObject(child);
          });
        }
      }, this);
    }, this);
  }
  var $__default = materializeRelationships;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce/utils/parse_date", [], function() {
  "use strict";
  var __moduleName = "coalesce/utils/parse_date";
  var origParse = Date.parse,
      numericKeys = [1, 4, 5, 6, 7, 10, 11];
  function parseDate(date) {
    var timestamp,
        struct,
        minutesOffset = 0;
    if ((struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date))) {
      for (var i = 0,
          k; (k = numericKeys[i]); ++i) {
        struct[k] = +struct[k] || 0;
      }
      struct[2] = (+struct[2] || 1) - 1;
      struct[3] = +struct[3] || 1;
      if (struct[8] !== 'Z' && struct[9] !== undefined) {
        minutesOffset = struct[10] * 60 + struct[11];
        if (struct[9] === '+') {
          minutesOffset = 0 - minutesOffset;
        }
      }
      timestamp = Date.UTC(struct[1], struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
    } else {
      timestamp = origParse ? origParse(date) : NaN;
    }
    return timestamp;
  }
  var $__default = parseDate;
  ;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce-ember", ['./namespace', 'coalesce', './initializers', './model/model', './model/model', './collections/has_many_array'], function($__0,$__2,$__4,$__5,$__7,$__9) {
  "use strict";
  var __moduleName = "coalesce-ember";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__5 || !$__5.__esModule)
    $__5 = {default: $__5};
  if (!$__7 || !$__7.__esModule)
    $__7 = {default: $__7};
  if (!$__9 || !$__9.__esModule)
    $__9 = {default: $__9};
  var Cs = $__0.default;
  var Coalesce = $__2.default;
  $__4;
  var Model = $__5.default;
  var $__8 = $__7,
      attr = $__8.attr,
      hasMany = $__8.hasMany,
      belongsTo = $__8.belongsTo;
  var HasManyArray = $__9.default;
  Cs.Model = Model;
  Cs.attr = attr;
  Cs.hasMany = hasMany;
  Cs.belongsTo = belongsTo;
  Coalesce.Promise = Ember.RSVP.Promise;
  Coalesce.ajax = Ember.$.ajax;
  Coalesce.run = Ember.run;
  Coalesce.HasManyArray = HasManyArray;
  _.defaults(Cs, Coalesce);
  var $__default = Cs;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce-ember/collections/has_many_array", ['./model_array'], function($__0) {
  "use strict";
  var __moduleName = "coalesce-ember/collections/has_many_array";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var ModelArray = $__0.default;
  var get = Ember.get,
      set = Ember.set;
  var $__default = ModelArray.extend({
    name: null,
    owner: null,
    session: Ember.computed.alias('owner.session'),
    replace: function(idx, amt, objects) {
      if (this.session) {
        objects = objects.map(function(model) {
          return this.session.add(model);
        }, this);
      }
      return this._super(idx, amt, objects);
    },
    arrayContentWillChange: function(index, removed, added) {
      var model = get(this, 'owner'),
          name = get(this, 'name'),
          session = get(this, 'session');
      if (session) {
        session.modelWillBecomeDirty(model);
        if (!model._suspendedRelationships) {
          for (var i = index; i < index + removed; i++) {
            var inverseModel = this.objectAt(i);
            session.inverseManager.unregisterRelationship(model, name, inverseModel);
          }
        }
      }
      return this._super.apply(this, arguments);
    },
    arrayContentDidChange: function(index, removed, added) {
      this._super.apply(this, arguments);
      var model = get(this, 'owner'),
          name = get(this, 'name'),
          session = get(this, 'session');
      if (session && !model._suspendedRelationships) {
        for (var i = index; i < index + added; i++) {
          var inverseModel = this.objectAt(i);
          session.inverseManager.registerRelationship(model, name, inverseModel);
        }
      }
    }
  });
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce-ember/collections/model_array", ['coalesce', 'coalesce/collections/model_set', 'coalesce/utils/is_equal'], function($__0,$__2,$__4) {
  "use strict";
  var __moduleName = "coalesce-ember/collections/model_array";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var Coalesce = $__0.default;
  var ModelSet = $__2.default;
  var isEqual = $__4.default;
  var get = Ember.get,
      set = Ember.set;
  var $__default = Ember.ArrayProxy.extend({
    session: null,
    meta: null,
    init: function() {
      if (!get(this, 'content')) {
        set(this, 'content', []);
      }
      this._super.apply(this, arguments);
    },
    arrayContentWillChange: function(index, removed, added) {
      for (var i = index; i < index + removed; i++) {
        var model = this.objectAt(i);
        var session = get(this, 'session');
        if (session) {
          session.collectionManager.unregister(this, model);
        }
      }
      this._super.apply(this, arguments);
    },
    arrayContentDidChange: function(index, removed, added) {
      this._super.apply(this, arguments);
      for (var i = index; i < index + added; i++) {
        var model = this.objectAt(i);
        var session = get(this, 'session');
        if (session) {
          session.collectionManager.register(this, model);
        }
      }
    },
    removeObject: function(obj) {
      var loc = get(this, 'length') || 0;
      while (--loc >= 0) {
        var curObject = this.objectAt(loc);
        if (curObject.isEqual(obj))
          this.removeAt(loc);
      }
      return this;
    },
    contains: function(obj) {
      for (var i = 0; i < get(this, 'length'); i++) {
        var m = this.objectAt(i);
        if (obj.isEqual(m))
          return true;
      }
      return false;
    },
    copy: function() {
      return this.content.copy();
    },
    copyTo: function(dest) {
      var existing = ModelSet.create();
      existing.addObjects(dest);
      this.forEach(function(model) {
        if (existing.contains(model)) {
          existing.remove(model);
        } else {
          dest.pushObject(model);
        }
      });
      dest.removeObjects(existing);
    },
    diff: function(arr) {
      var diff = Ember.A();
      this.forEach(function(model) {
        if (!arr.contains(model)) {
          diff.push(model);
        }
      }, this);
      arr.forEach(function(model) {
        if (!this.contains(model)) {
          diff.push(model);
        }
      }, this);
      return diff;
    },
    isEqual: function(arr) {
      return this.diff(arr).length === 0;
    },
    load: function() {
      var array = this;
      return Ember.RSVP.all(this.map(function(model) {
        return model.load();
      })).then(function() {
        return array;
      });
    }
  });
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce-ember/debug/debug_adapter", ['../model/model', '../promise', './debug_info'], function($__0,$__2,$__4) {
  "use strict";
  var __moduleName = "coalesce-ember/debug/debug_adapter";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var get = Ember.get,
      capitalize = Ember.String.capitalize,
      underscore = Ember.String.underscore;
  var Model = $__0.default;
  var PromiseArray = $__2.PromiseArray;
  $__4;
  var $__default = Ember.DataAdapter.extend({
    getFilters: function() {
      return [{
        name: 'isNew',
        desc: 'New'
      }, {
        name: 'isModified',
        desc: 'Modified'
      }, {
        name: 'isClean',
        desc: 'Clean'
      }];
    },
    detect: function(klass) {
      return klass !== Model && Model.detect(klass);
    },
    columnsForType: function(type) {
      var columns = [{
        name: 'id',
        desc: 'Id'
      }, {
        name: 'clientId',
        desc: 'Client Id'
      }, {
        name: 'rev',
        desc: 'Revision'
      }, {
        name: 'clientRev',
        desc: 'Client Revision'
      }],
          count = 0,
          self = this;
      Ember.A(get(type, 'attributes')).forEach(function(name, meta) {
        if (count++ > self.attributeLimit) {
          return false;
        }
        var desc = capitalize(underscore(name).replace('_', ' '));
        columns.push({
          name: name,
          desc: desc
        });
      });
      return columns;
    },
    getRecords: function(type) {
      return PromiseArray.create({promise: this.get('session').query(type)});
    },
    getRecordColumnValues: function(record) {
      var self = this,
          count = 0,
          columnValues = {id: get(record, 'id')};
      record.eachAttribute(function(key) {
        if (count++ > self.attributeLimit) {
          return false;
        }
        var value = get(record, key);
        columnValues[key] = value;
      });
      return columnValues;
    },
    getRecordKeywords: function(record) {
      var keywords = [],
          keys = Ember.A(['id']);
      record.eachAttribute(function(key) {
        keys.push(key);
      });
      keys.forEach(function(key) {
        keywords.push(get(record, key));
      });
      return keywords;
    },
    getRecordFilterValues: function(record) {
      return {
        isNew: record.get('isNew'),
        isModified: record.get('isDirty') && !record.get('isNew'),
        isClean: !record.get('isDirty')
      };
    },
    getRecordColor: function(record) {
      var color = 'black';
      if (record.get('isNew')) {
        color = 'green';
      } else if (record.get('isDirty')) {
        color = 'blue';
      }
      return color;
    },
    observeRecord: function(record, recordUpdated) {
      var releaseMethods = Ember.A(),
          self = this,
          keysToObserve = Ember.A(['id', 'clientId', 'rev', 'clientRev', 'isNew', 'isDirty', 'isDeleted']);
      record.eachAttribute(function(key) {
        keysToObserve.push(key);
      });
      keysToObserve.forEach(function(key) {
        var handler = function() {
          recordUpdated(self.wrapRecord(record));
        };
        Ember.addObserver(record, key, handler);
        releaseMethods.push(function() {
          Ember.removeObserver(record, key, handler);
        });
      });
      var release = function() {
        releaseMethods.forEach(function(fn) {
          fn();
        });
      };
      return release;
    }
  });
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce-ember/debug/debug_info", ['../model/model'], function($__0) {
  "use strict";
  var __moduleName = "coalesce-ember/debug/debug_info";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var Model = $__0.default;
  Model.reopen({_debugInfo: function() {
      var attributes = ['id'],
          relationships = {
            belongsTo: [],
            hasMany: []
          },
          expensiveProperties = [];
      this.eachAttribute(function(name, meta) {
        attributes.push(name);
      }, this);
      this.eachRelationship(function(name, relationship) {
        relationships[relationship.kind].push(name);
        expensiveProperties.push(name);
      });
      var groups = [{
        name: 'Attributes',
        properties: attributes,
        expand: true
      }, {
        name: 'Belongs To',
        properties: relationships.belongsTo,
        expand: true
      }, {
        name: 'Has Many',
        properties: relationships.hasMany,
        expand: true
      }, {
        name: 'Flags',
        properties: ['isDirty', 'isDeleted', 'hasErrors']
      }];
      return {propertyInfo: {
          includeOtherProperties: true,
          groups: groups,
          expensiveProperties: expensiveProperties
        }};
    }});
  return {};
});

define("coalesce-ember/initializers", ['coalesce', 'coalesce/container', './debug/debug_adapter', './session', './model/errors'], function($__0,$__2,$__4,$__6,$__8) {
  "use strict";
  var __moduleName = "coalesce-ember/initializers";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  if (!$__8 || !$__8.__esModule)
    $__8 = {default: $__8};
  var Coalesce = $__0.default;
  var setupContainer = $__2.setupContainer;
  var DebugAdapter = $__4.default;
  var Session = $__6.default;
  var Errors = $__8.default;
  Ember.onLoad('Ember.Application', function(Application) {
    Application.initializer({
      name: "coalesce.container",
      initialize: function(container, application) {
        Coalesce.__container__ = container;
        setupContainer(container, application);
        container.register('model:errors', Errors);
        container.register('session:base', Session);
        container.register('session:main', container.lookupFactory('session:application') || Session);
        container.typeInjection('controller', 'adapter', 'adapter:main');
        container.typeInjection('controller', 'session', 'session:main');
        container.typeInjection('route', 'adapter', 'adapter:main');
        container.typeInjection('route', 'session', 'session:main');
        if (Ember.DataAdapter) {
          container.typeInjection('data-adapter', 'session', 'session:main');
          container.register('data-adapter:main', DebugAdapter);
        }
      }
    });
  });
  return {};
});

define("coalesce-ember/model/errors", ['coalesce/utils/copy'], function($__0) {
  "use strict";
  var __moduleName = "coalesce-ember/model/errors";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var copy = $__0.default;
  var get = Ember.get,
      set = Ember.set;
  var Errors = Ember.ObjectProxy.extend(Ember.Copyable, {
    init: function() {
      this._super.apply(this, arguments);
      if (!get(this, 'content'))
        set(this, 'content', {});
    },
    forEach: function(callback, self) {
      var keys = Ember.keys(this.content);
      keys.forEach(function(key) {
        var value = get(this.content, key);
        callback.call(self, key, value);
      }, this);
    },
    copy: function() {
      return Errors.create({content: copy(this.content)});
    }
  });
  var $__default = Errors;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce-ember/model/model", ['../utils/apply_ember', 'coalesce/model/model', 'coalesce/model/field', 'coalesce/model/attribute', 'coalesce/model/has_many', 'coalesce/model/belongs_to'], function($__0,$__2,$__4,$__6,$__8,$__10) {
  "use strict";
  var __moduleName = "coalesce-ember/model/model";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  if (!$__8 || !$__8.__esModule)
    $__8 = {default: $__8};
  if (!$__10 || !$__10.__esModule)
    $__10 = {default: $__10};
  var applyEmber = $__0.default;
  var Model = $__2.default;
  var Field = $__4.default;
  var CoreAttribute = $__6.default;
  var CoreHasMany = $__8.default;
  var CoreBelongsTo = $__10.default;
  var CoreObject = Ember.CoreObject;
  var Observable = Ember.Observable;
  var Mixin = Ember.Mixin;
  var merge = _.merge;
  var EmberModel = applyEmber(Model, ['fields', 'ownFields', 'attributes', 'relationships'], Observable, {
    attributeWillChange: function(name) {
      Model.prototype.attributeWillChange.apply(this, arguments);
      Ember.propertyWillChange(this, name);
    },
    attributeDidChange: function(name) {
      Model.prototype.attributeDidChange.apply(this, arguments);
      Ember.propertyDidChange(this, name);
    },
    belongsToWillChange: function(name) {
      Model.prototype.belongsToWillChange.apply(this, arguments);
      Ember.propertyWillChange(this, name);
    },
    belongsToDidChange: function(name) {
      Model.prototype.belongsToDidChange.apply(this, arguments);
      Ember.propertyDidChange(this, name);
    },
    hasManyWillChange: function(name) {
      Model.prototype.hasManyWillChange.apply(this, arguments);
      Ember.propertyWillChange(this, name);
    },
    hasManyDidChange: function(name) {
      Model.prototype.hasManyDidChange.apply(this, arguments);
      Ember.propertyDidChange(this, name);
    },
    didDefineProperty: function(obj, keyName, value) {
      if (value instanceof Attr) {
        obj.constructor.defineField(new CoreAttribute(keyName, value));
      } else if (value instanceof BelongsTo) {
        obj.constructor.defineField(new CoreBelongsTo(keyName, value));
      } else if (value instanceof HasMany) {
        obj.constructor.defineField(new CoreHasMany(keyName, value));
      }
    }
  });
  function Attr(type) {
    var options = arguments[1] !== (void 0) ? arguments[1] : {};
    this.type = type;
    merge(this, options);
    return this;
  }
  function attr(type) {
    var options = arguments[1] !== (void 0) ? arguments[1] : {};
    return new Attr(type, options);
  }
  function HasMany(type) {
    var options = arguments[1] !== (void 0) ? arguments[1] : {};
    this.kind = 'hasMany';
    this.type = type;
    merge(this, options);
    return this;
  }
  function hasMany(type) {
    var options = arguments[1] !== (void 0) ? arguments[1] : {};
    return new HasMany(type, options);
  }
  function BelongsTo(type) {
    var options = arguments[1] !== (void 0) ? arguments[1] : {};
    this.kind = 'belongsTo';
    this.type = type;
    merge(this, options);
    return this;
  }
  function belongsTo(type) {
    var options = arguments[1] !== (void 0) ? arguments[1] : {};
    return new BelongsTo(type, options);
  }
  var META_KEYS = ['id', 'clientId', 'rev', 'clientRev', 'errors', 'isDeleted'];
  EmberModel.reopenClass({
    create: function(hash) {
      var fields = {};
      for (var key in hash) {
        if (!hash.hasOwnProperty(key))
          continue;
        if (this.fields.get(key) || META_KEYS.indexOf(key) !== -1) {
          fields[key] = hash[key];
          delete hash[key];
        }
      }
      var res = this._super.apply(this, arguments);
      for (var key in fields) {
        if (!fields.hasOwnProperty(key))
          continue;
        res[key] = fields[key];
      }
      return res;
    },
    extend: function() {
      var klass = this._super.apply(this, arguments);
      klass.proto();
      return klass;
    }
  });
  ;
  var $__default = EmberModel;
  return {
    get attr() {
      return attr;
    },
    get hasMany() {
      return hasMany;
    },
    get belongsTo() {
      return belongsTo;
    },
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce-ember/namespace", [], function() {
  "use strict";
  var __moduleName = "coalesce-ember/namespace";
  var Cs;
  if ('undefined' === typeof Cs) {
    Cs = Ember.Namespace.create({VERSION: '0.4.0+dev.9570067c'});
  }
  var $__default = Cs;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce-ember/promise", [], function() {
  "use strict";
  var __moduleName = "coalesce-ember/promise";
  var ModelPromise = Ember.ObjectProxy.extend(Ember.PromiseProxyMixin, {load: passThroughMethod('load')});
  function passThroughMethod(name, defaultReturn) {
    return function() {
      var content = get(this, 'content');
      if (!content)
        return defaultReturn;
      return content[name].apply(content, arguments);
    };
  }
  var PromiseArray = Ember.ArrayProxy.extend(Ember.PromiseProxyMixin);
  ;
  return {
    get ModelPromise() {
      return ModelPromise;
    },
    get PromiseArray() {
      return PromiseArray;
    },
    __esModule: true
  };
});

define("coalesce-ember/session", ['coalesce/session/session', './promise'], function($__0,$__2) {
  "use strict";
  var __moduleName = "coalesce-ember/session";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  var Session = $__0.default;
  var $__3 = $__2,
      ModelPromise = $__3.ModelPromise,
      PromiseArray = $__3.PromiseArray;
  var EmberSession = function EmberSession() {
    $traceurRuntime.defaultSuperCall(this, $EmberSession.prototype, arguments);
  };
  var $EmberSession = EmberSession;
  ($traceurRuntime.createClass)(EmberSession, {
    loadModel: function(model, opts) {
      return ModelPromise.create({
        content: model,
        promise: $traceurRuntime.superCall(this, $EmberSession.prototype, "loadModel", [model, opts])
      });
    },
    query: function(type, query, opts) {
      return PromiseArray.create({promise: $traceurRuntime.superCall(this, $EmberSession.prototype, "query", [type, query, opts])});
    }
  }, {}, Session);
  var $__default = EmberSession;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

define("coalesce-ember/utils/apply_ember", [], function() {
  "use strict";
  var __moduleName = "coalesce-ember/utils/apply_ember";
  var CoreObject = Ember.CoreObject,
      Mixin = Ember.Mixin;
  function applyEmber(Type) {
    var specialClassKeys = arguments[1] !== (void 0) ? arguments[1] : [];
    for (var mixins = [],
        $__0 = 2; $__0 < arguments.length; $__0++)
      mixins[$__0 - 2] = arguments[$__0];
    function cstor() {
      return CoreObject.apply(this);
    }
    var PrototypeMixin = Mixin.create(CoreObject.PrototypeMixin);
    PrototypeMixin.ownerConstructor = cstor;
    cstor.PrototypeMixin = PrototypeMixin;
    cstor.prototype = Object.create(Type.prototype);
    var SpecialClassProps = {};
    for (var key in Type) {
      if (!Type.hasOwnProperty(key))
        continue;
      if (specialClassKeys.indexOf(key) !== -1)
        continue;
      SpecialClassProps[key] = Type[key];
    }
    var ClassMixin = Mixin.create(SpecialClassProps, CoreObject.ClassMixin);
    ClassMixin.reopen({extend: function() {
        var klass = this._super.apply(this, arguments);
        specialClassKeys.forEach(function(name) {
          var desc = Object.getOwnPropertyDescriptor(Type, name);
          Object.defineProperty(klass, name, desc);
        });
        Object.defineProperty(klass, 'parentType', {get: function() {
            return this.superclass;
          }});
        return klass;
      }});
    ClassMixin.apply(cstor);
    ClassMixin.ownerConstructor = cstor;
    cstor.ClassMixin = ClassMixin;
    cstor.proto = function() {
      return this.prototype;
    };
    mixins.unshift({init: function() {
        Type.apply(this, arguments);
        this._super.apply(this, arguments);
      }});
    return cstor.extend.apply(cstor, mixins);
  }
  var $__default = applyEmber;
  return {
    get default() {
      return $__default;
    },
    __esModule: true
  };
});

this.Cs = requireModule("coalesce-ember")["default"];

})();