pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/mux1.circom";

template Membership(depth) {
    signal input merkleRoot;
    signal input pollId;
    signal input expectedMinAge;

    signal input secret;
    signal input age;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    signal output nullifier;

    component ageCheck = GreaterEqThan(8);
    ageCheck.in[0] <== age;
    ageCheck.in[1] <== expectedMinAge;
    ageCheck.out === 1;

    component leafHash = Poseidon(2);
    leafHash.inputs[0] <== secret;
    leafHash.inputs[1] <== age;
    signal leaf <== leafHash.out;

    signal currentHash[depth + 1];
    currentHash[0] <== leaf;

    component poseidons[depth];
    component muxes[depth][2];

    for (var i = 0; i < depth; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        poseidons[i] = Poseidon(2);
        muxes[i][0] = Mux1();
        muxes[i][1] = Mux1();

        muxes[i][0].c[0] <== currentHash[i];
        muxes[i][0].c[1] <== pathElements[i];
        muxes[i][0].s <== pathIndices[i];
        poseidons[i].inputs[0] <== muxes[i][0].out;

        muxes[i][1].c[0] <== pathElements[i];
        muxes[i][1].c[1] <== currentHash[i];
        muxes[i][1].s <== pathIndices[i];
        poseidons[i].inputs[1] <== muxes[i][1].out;

        currentHash[i + 1] <== poseidons[i].out;
    }

    merkleRoot === currentHash[depth];

    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== secret;
    nullifierHash.inputs[1] <== pollId;
    nullifier <== nullifierHash.out;
}

component main {public [merkleRoot, pollId, expectedMinAge]} = Membership(10);