pragma circom 2.1.4;

/* "В академической работе важно показать, что ты не просто 'скачал готовое', а провел анализ и принял инженерное решение. 
В дипломе это можно описать в разделе 'Выбор архитектуры верификации'.
Тезисы для диплома:Ограничения конечных полей (Finite Field Arithmetic): 
ZK-снарки (в частности Groth16) оперируют в конечном поле кривой bn128, где максимальное значение числа ограничено $\approx 254$ битами.
Государственные паспорта используют RSA-подписи длиной 2048 или 4096 бит. 
Реализация проверки RSA требует сложной математики больших чисел (BigInt),
разбиения ключей на массивы 64-битных регистров и оптимизации тысяч ограничений, 
что выходит за рамки протокола голосования.Сложность структур данных: Данные в чипах ePassport упакованы в формат ASN.1. 
Парсинг динамических структур ASN.1 внутри ZK-контура крайне неэффективен и требует специализированных библиотек.
Безопасность и аудит (Security Risks): Криптографические примитивы, обеспечивающие Proof-of-Personhood (доказательство личности), 
должны проходить строгий аудит. Ошибка на уровне ограничения сигналов (unconstrained signals) в самописной схеме 
может скомпрометировать весь процесс выборов.Фокус работы: Главная цель диплома — разработка децентрализованного хаба 
для анонимного голосования и интеграция механизмов, предотвращающих двойное голосование (Nullifiers). 
Использование проверенных open-source SDK (подобно использованию библиотек OpenZeppelin для смарт-контрактов) является 
индустриальным стандартом и позволяет сфокусироваться на архитектуре приложения."

"🛡 Как это описать в дипломе
Ты можешь посвятить этому целую главу: «Архитектура ZK-реестра избирателей».
Объясни, что в реальном мире проверка подписи паспорта (то, что мы обсуждали до этого) нужна только один раз, на этапе добавления пользователя в систему.

Этап 1 (Регистрация): Приложение проверяет паспорт, генерирует userSecret и userAge, хеширует их и отправляет leaf (лист) в смарт-контракт реестра. Контракт пересчитывает merkleRoot.

Этап 2 (Голосование): Пользователь скачивает актуальное дерево, берет свой pollId и генерирует ZK-Proof с помощью нашей схемы AdvancedKycVoting. Смарт-контракт VotingHub проверяет пруф и нуллификатор.

Это изящно, технически грамотно и полностью решает проблему анонимности." */

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

template MerkleTreeInclusionProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component hashers[levels];
    signal currentHash[levels + 1];

    currentHash[0] <== leaf;
    signal left[levels];
    signal right[levels];

    for (var i = 0; i < levels; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        hashers[i] = Poseidon(2);

        left[i] <== currentHash[i] - pathIndices[i] * (currentHash[i] - pathElements[i]);
        right[i] <== pathElements[i] - pathIndices[i] * (pathElements[i] - currentHash[i]);

        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];

        currentHash[i + 1] <== hashers[i].out;
    }

    root <== currentHash[levels];
}

template KycVoting(levels) {
    signal input userSecret;
    signal input userAge;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    signal input pollId;
    signal input merkleRoot;
    signal input minAge;

    signal output nullifier;

    component leafHasher = Poseidon(2);
    leafHasher.inputs[0] <== userSecret;
    leafHasher.inputs[1] <== userAge;
    signal leaf <== leafHasher.out;

    component tree = MerkleTreeInclusionProof(levels);
    tree.leaf <== leaf;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    tree.root === merkleRoot;

    component ageCheck = GreaterEqThan(8);
    ageCheck.in[0] <== userAge;
    ageCheck.in[1] <== minAge;
    ageCheck.out === 1;

    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== userSecret;
    nullifierHash.inputs[1] <== pollId;

    nullifier <== nullifierHash.out;
}

component main { public [pollId, merkleRoot, minAge] } = KycVoting(10);