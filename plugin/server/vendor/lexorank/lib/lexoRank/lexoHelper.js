"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lexoHelper = void 0;
exports.lexoHelper = {
    arrayCopy,
};
function arrayCopy(sourceArray, sourceIndex, destinationArray, destinationIndex, length) {
    let destination = destinationIndex;
    const finalLength = sourceIndex + length;
    for (let i = sourceIndex; i < finalLength; i++) {
        destinationArray[destination] = sourceArray[i];
        ++destination;
    }
    // while(length--) destinationArray[destinationIndex++] = sourceArray[sourceIndex++];
}
