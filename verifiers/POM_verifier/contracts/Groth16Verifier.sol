// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    uint256 constant alphax  = 8602579037286890583433159754142763180438216600079184974278234417926904575765;
    uint256 constant alphay  = 20163287191910019229267134826537168016660693268904143606230595950670990834083;
    uint256 constant betax1  = 20512395562896165617614548693130414714000457065168622078943678966624324955180;
    uint256 constant betax2  = 19360752118098012581983354747682536449638889632370378871339202080841773259416;
    uint256 constant betay1  = 15120279129178012220297789122551166127329033953919890707674935414954594218543;
    uint256 constant betay2  = 14183119295841197352474406788262594952436388208562048930878163736365280080933;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 575009709345798600555531952917910380232507108222086169254547860412056846475;
    uint256 constant deltax2 = 3726462314494664279000786718470072672586243665129090629245901629288542282740;
    uint256 constant deltay1 = 17663841083164449340820022591354630290534753851811244461149081210314657117463;
    uint256 constant deltay2 = 3490083043117624087313905542617980210227804845002877936601774842538023646753;

    
    uint256 constant IC0x = 14361144753364817100111907247715192970277335771192343555464815533698084721504;
    uint256 constant IC0y = 8571921635098478348084458053584179914336409199059468178520159768075636076735;
    
    uint256 constant IC1x = 11151121799860479969862833917125718644729064853914508996895384796088863912028;
    uint256 constant IC1y = 9045066903015195818754175473066782053864886395073401691105310909524680227108;
    
    uint256 constant IC2x = 13517517777066627297653403460852137789710183195699578080276449460353090514271;
    uint256 constant IC2y = 8293793309878044065087262375083593629291182189165828988748159668920917658972;
    
    uint256 constant IC3x = 8533737093938220412697483100437995234664760231871466575989207651745696379371;
    uint256 constant IC3y = 4812751713930579177670192873879428596617414216978315208609749149354489280344;
    
    uint256 constant IC4x = 12504843563342999863207392325311423734038059973718355350816218238326850689899;
    uint256 constant IC4y = 19934771970161590404524320809418184410224686524052737085069218586472174398097;
    
    uint256 constant IC5x = 7849778338065892076062045242399755048548052440849956227781387752769998474573;
    uint256 constant IC5y = 14954597047017591970115422914916822286159959096355314624666212335199912338953;
    
 
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[5] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                

                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            

            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
