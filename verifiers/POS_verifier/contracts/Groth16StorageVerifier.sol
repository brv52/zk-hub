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

    uint256 constant alphax  = 2612021973681299670120564849628999712602907666319322305472901532857587868325;
    uint256 constant alphay  = 7626034690500812756650908183160700862474173535595652526843234742868998296490;
    uint256 constant betax1  = 1796788156808453514081291952192568694420011415957170981838607134271381288962;
    uint256 constant betax2  = 14309958249829802717220810040554140174168661339456195337947343291520899900221;
    uint256 constant betay1  = 14447601943781582937859197442120339422570729150959648887212907265219498818809;
    uint256 constant betay2  = 20281280583740459223308466611960721273710993598706355113272424644360421682909;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 19729595996211183098446871830331852982908771892325884753139004068215183273519;
    uint256 constant deltax2 = 10231765820355879778321312154197334139759969315744135060631785453986440470300;
    uint256 constant deltay1 = 174412207242059295675719562483987714244319538049352441355211626550693545597;
    uint256 constant deltay2 = 2504383220986141467045569752242734523276578296440796764995422958974216713193;

    
    uint256 constant IC0x = 4306346461691389594091748003447495722373688126372888027471354192309534662509;
    uint256 constant IC0y = 9832477212810254134441950475790914892977972393567547535932321203958460518423;
    
    uint256 constant IC1x = 5336067456716548639048706595527142213776549465677442283175298767660498041869;
    uint256 constant IC1y = 6065328803114991778208368876430579404664056523291190044192468546895831029487;
    
    uint256 constant IC2x = 5109729758340266872703511927650878355992943340873721991842792077423188942851;
    uint256 constant IC2y = 17121428493609618156114555196310060677309818151262813227195135154066711489211;
    
    uint256 constant IC3x = 12992169685654230377969402907320765271005821484915176258391345159815007740005;
    uint256 constant IC3y = 8828266759815313774240215640181976074835008610082916771706922630301096139791;
    
    uint256 constant IC4x = 10939816906071478059000440387113443585943342914742756402719073893108722849778;
    uint256 constant IC4y = 12399254276249131774461503257581172347244335921229816145997524757737286092103;
    
    uint256 constant IC5x = 12023525530613729216344943398956791555688034888477682931626984890861176545190;
    uint256 constant IC5y = 11263970402249104196629727478679794654315868244672712392074546626411990505583;
    
 
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
