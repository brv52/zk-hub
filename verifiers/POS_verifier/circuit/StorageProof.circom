pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/mux1.circom";

template BindPublicInput() {
    signal input in;
    signal output bound;
    bound <== in * in;
}

template StorageProof(depth) {
    signal input stateRoot;
    signal input pollId;
    signal input minThreshold;
    signal input optionId;

    signal input slot;
    signal input value;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    
    signal output nullifier;

    component valBits = Num2Bits(64);
    valBits.in <== value;
    
    component thresholdCheck = GreaterEqThan(64);
    thresholdCheck.in[0] <== value;
    thresholdCheck.in[1] <== minThreshold;
    thresholdCheck.out === 1;

    component leafHasher = Poseidon(2);
    leafHasher.inputs[0] <== slot;
    leafHasher.inputs[1] <== value;

    signal currentHash[depth + 1];
    currentHash[0] <== leafHasher.out;

    component hashers[depth];
    component mux[depth][2];

    for (var i = 0; i < depth; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;
        hashers[i] = Poseidon(2);
        
        mux[i][0] = Mux1();
        mux[i][1] = Mux1();

        mux[i][0].c[0] <== currentHash[i];
        mux[i][0].c[1] <== pathElements[i];
        mux[i][0].s <== pathIndices[i];
        
        mux[i][1].c[0] <== pathElements[i];
        mux[i][1].c[1] <== currentHash[i];
        mux[i][1].s <== pathIndices[i];

        hashers[i].inputs[0] <== mux[i][0].out;
        hashers[i].inputs[1] <== mux[i][1].out;

        currentHash[i + 1] <== hashers[i].out;
    }

    stateRoot === currentHash[depth];

    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== slot;
    nullifierHasher.inputs[1] <== pollId;
    nullifier <== nullifierHasher.out;

    component voteBinder = BindPublicInput();
    voteBinder.in <== optionId;
}

component main {public [stateRoot, pollId, minThreshold, optionId]} = StorageProof(10);