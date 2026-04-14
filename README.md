# ZK-Voting Hub - Instalační a uživatelská příručka

Tento dokument slouží jako komplexní průvodce pro zprovoznění, testování a rozšiřování projektu ZK-Voting Hub, který vznikl jako praktická část bakalářské práce "Anonymní volební systém na blockchainu". Architektura projektu je koncipována jako monorepozitář skládající se z jádrového systému (VotingHub a frontend) a nezávislých verifikačních modulů.

## Živá ukázka (Live Demo)

Plně funkční a nasazená verze aplikace je veřejně dostupná k okamžitému otestování na následujícím odkazu:
**https://zk-hub-seven.vercel.app/**

## 1. Prerekvizity

Před zahájením instalace se ujistěte, že vaše vývojové prostředí splňuje následující požadavky:

- **Node.js**: Verze 18.x nebo vyšší.
- **Správce balíčků**: Doporučuje se `npm` (součást Node.js).
- **Webový prohlížeč**: Chrome, Firefox nebo Brave s nainstalovaným rozšířením kryptoměnové peněženky (např. MetaMask).
- **Poskytovatelé služeb (API klíče)**:
  - Účet na platformě Alchemy (nebo Infura) pro přístup k RPC uzlům blockchainových sítí.
  - Účet na platformě Pinata pro nahrávání souborů do sítě IPFS.

## 2. Příprava prostředí a instalace závislostí

Výchozím bodem je stažený a rozbalený repozitář. Struktura projektu je rozdělena na dvě hlavní části, které vyžadují oddělenou instalaci závislostí.

### Instalace jádra a frontendu

1. Otevřete terminál a přejděte do hlavní složky projektu.
2. Přejděte do složky frontendu a nainstalujte závislosti:

    ```bash
    cd zk-votingHub/frontend
    npm install
    ```

Přejděte do složky s chytrými kontrakty jádra a zopakujte proces:

```bash
cd ../
npm install
```

Instalace verifikačních modulů

Závislosti je nutné nainstalovat i v adresářích jednotlivých verifikátorů (např. Proof of Membership, Proof of Storage).

```bash
cd ../verifiers/POM_verifier
npm install
```

### 3. Konfigurace proměnných prostředí (.env)

Z bezpečnostních důvodů repozitář neobsahuje produkční klíče ani privátní tajemství. V každé složce, která interaguje s blockchainem nebo sítí IPFS (kořenová složka jádra a složky jednotlivých verifikátorů), naleznete vzorový soubor .env.example.

Zkopírujte soubor .env.example a přejmenujte jej na .env.

Vyplňte proměnné.

Upozornění: K nasazení a testování využívejte výhradně testovací účty. Nikdy nezadávejte privátní klíč k peněžence, která obsahuje reálné finanční prostředky (mainnet ETH).

### 4. Nasazení (Deployment) infrastruktury

Pro spuštění celého ekosystému je nutné nejprve nasadit chytré kontrakty na zvolenou testovací síť (např. Sepolia nebo Arbitrum Sepolia). Nástroj Hardhat je v projektu předkonfigurován pro automatizaci tohoto procesu.

Krok 1: Nasazení centrálního kontraktu VotingHub

Přejděte do složky jádra a spusťte nasazovací skript. Zvolte síť podle konfigurace ve vašem souboru hardhat.config.ts.

```bash
cd zk-votingHub
npx hardhat run scripts/deploy.ts --network sepolia
```

Skript do konzole vypíše adresu nově nasazeného kontraktu. Tuto adresu je zpravidla nutné aktualizovat v konfiguračních souborech frontendu (např. frontend/src/artifacts/contractAddress.json), aby webová aplikace věděla, s jakým kontraktem má komunikovat.

Krok 2: Nasazení verifikátorů a nahrání manifestů

Každý verifikátor (např. POM_verifier) má vlastní nasazovací logiku, která zahrnuje nasazení Solidity kontraktu a následné nahrání konfiguračního manifestu a kryptografických artefaktů (WASM, ZKEY) na IPFS.

```bash
cd ../verifiers/POM_verifier
npx hardhat run scripts/deploy.ts --network sepolia
node scripts/uploadManifest.js
```

Výsledkem druhého příkazu bude CID (Content Identifier) odkazující na manifest v síti IPFS. Tento hash bude následně použit při vytváření nové ankety ve frontendu.

### 5. Spuštění a používání webového rozhraní

Frontendová aplikace je postavena na knihovně React s využitím nástroje Vite.

Pro lokální spuštění vývojového serveru přejděte do složky frontendu:

```bash
cd zk-votingHub/frontend
npm run dev
```

Aplikace bude následně dostupná v prohlížeči, standardně na adrese http://localhost:5173.

#### Integrace a nastavení peněženky MetaMask

Aby bylo možné s aplikací plnohodnotně interagovat, je nutné propojit ji s Web3 peněženkou.

Instalace: Pokud ještě nemáte, nainstalujte si rozšíření MetaMask do svého prohlížeče.

Přepnutí sítě: V nastavení MetaMasku povolte zobrazení testovacích sítí a přepněte na síť, na kterou jste nasadili kontrakty (např. Sepolia).

Získání testovacích prostředků: Pro provádění on-chain transakcí (např. vytváření anket organizátorem) budete potřebovat testovací tokeny. Ty lze zdarma získat z veřejných faucetů (např. Alchemy Sepolia Faucet).

Připojení k aplikaci: Na úvodní stránce ZK-Voting Hub klikněte na tlačítko pro připojení peněženky a potvrďte požadavek v okně rozšíření MetaMask.

Hlasování pro běžné uživatele probíhá díky integraci standardu ERC-4337 zcela bez poplatků, uživatel tedy testovací tokeny nepotřebuje; stačí mu pouze podepsat uživatelskou operaci (UserOperation).

### 6. Průvodce rozšířením: Tvorba vlastního verifikátoru

Architektura ZK-Voting Hub je navržena tak, aby umožňovala snadné přidání nových metod ověřování bez zásahu do zdrojového kódu jádra. Chcete-li vytvořit vlastní verifikátor, postupujte podle následujících tří kroků:

1. Návrh kryptografického obvodu

    Vytvořte soubor, ve kterém definujete matematickou logiku ověření (např. porovnání věku, členství ve stromu).

    Obvod musí vždy přijímat a zpracovávat proměnné pro deterministické generování nulifikátoru (typicky secret a pollId), aby se zabránilo dvojímu hlasování.

    Obvod musí implementovat techniku "Square Binding" pro veřejný signál optionId.

    Pomocí knihovny SnarkJS obvod zkompilujte a vygenerujte potřebné artefakty (.wasm a .zkey).

2. Implementace chytrého kontraktu (Solidity)

    Vytvořte nový kontrakt, který povinně implementuje rozhraní IUniversalVerifier.

    Kontrakt musí obsahovat funkci verifyProof.

    Tato funkce přijímá pole veřejných signálů, samotný ZK důkaz a dodatečnou konfiguraci (bytes config).

    Funkce musí vracet dvě hodnoty: boolean (zda je důkaz platný) a bytes32 (výsledný nulifikátor).

3. Vytvoření IPFS Manifestu

    Aby heuristický frontend věděl, jaká data má od uživatele vyžadovat a jak s nimi pracovat, vytvořte soubor manifest.json.

    Definujte registrySchema (jaká pole má frontend vykreslit jako formulář pro uživatele).

    Uveďte cesty k vygenerovaným artefaktům (WASM, ZKEY).

    Definujte circuitSignals a jejich pořadí, aby frontend správně zformátoval vstupní data pro důkazový generátor (snarkjs).

    Nahrajte manifest na IPFS (pomocí Pinata) a získáte adresu pro organizátory.

    Při vytváření nového hlasování v rozhraní pak organizátorovi stačí zadat on-chain adresu vašeho nového kontraktu a IPFS hash vašeho manifestu. Frontend i VotingHub se postarají o zbytek.

## 7. Testovací scénáře

Tato sekce obsahuje připravené scénáře pro demonstrační hlasování. Každý scénář uvádí název hlasování, stručný kontext, volby a dataset.

### 7.1 Scénář 1: Korporátní hlasování akcionářů (POM)

- Modul: Proof of Membership (POM)
- Název hlasování: Řádná valná hromada 2026: Volba členů dozorčí rady společnosti (Přístup pouze pro kryptograficky ověřené akcionáře)
- Popis: Organizátor předem vytvoří Merkle strom ze seznamu oprávněných akcionářů. Uživatel dokazuje členství bez odhalení identity.
- Možnosti:
    - Bc. Jan Novák (Navržen: Představenstvo)
    - Ing. Petra Svobodová (Nezávislá kandidátka)
    - Zdržuji se hlasování

Dataset (CSV):

```csv
secret,value
0x4f8b2c1e9d3a7f6b5c4e8a1d2b3f9c7e6d5a4b1c2d3e9f8a7b6c5d4e3f2a1b0c,1
0x7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b,1
0x1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d,1
0x9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f,1
0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b,1
0xb1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2,1
0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f,1
0xd9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0,1
0x2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a,1
0x0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c,1
0x8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e,1
0x6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c,1
0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e,1
0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c,1
0x0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a,1
0xe2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3,1
0xc0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1,1
0xa8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9,1
0x8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a,1
0x6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e,1
0x4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c,1
0x2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b,1
0x0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f,1
0xe9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0,1
0xc7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8,1
```

### 7.2 Scénář 2: DAO governance s minimálním zůstatkem (POS)

- Modul: Proof of Storage (POS / Gated L2 Verifier)
- Název hlasování: DAO Governance (EIP-42): Snížení inflační křivky protokolu (Požadovaný minimální zůstatek: 10 000 GOV)
- Popis: K dosažení spravedlivého rozhodování v rámci DAO je klíčové omezit vliv čerstvých a spekulativních účtů. Organizátor využívá snímek stavu L2 sítě (snapshot), aby matematicky zajistil, že právo hlasovat mají pouze dlouhodobí držitelé, jejichž prokazatelný zůstatek dosahuje alespoň 10 000 GOV tokenů.
- Možnosti:
    - Schvaluji EIP-42 (Snížení inflace o 15%)
    - Zamítám návrh (Zachování současného stavu)
    - Požaduji přepracování návrhu

Dataset (CSV):

```csv
slot,value
0x1111111111111111111111111111111111111111111111111111111111111111,15000
0x2222222222222222222222222222222222222222222222222222222222222222,25500
0x3333333333333333333333333333333333333333333333333333333333333333,10000
0x4444444444444444444444444444444444444444444444444444444444444444,10500
0x5555555555555555555555555555555555555555555555555555555555555555,500000
0x6666666666666666666666666666666666666666666666666666666666666666,12000
0x7777777777777777777777777777777777777777777777777777777777777777,18400
0x8888888888888888888888888888888888888888888888888888888888888888,33000
0x9999999999999999999999999999999999999999999999999999999999999999,95000
0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,10001
0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,15050
0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc,22000
0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd,78000
0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee,11200
0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,45000
0x0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a,31000
0x1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b,62000
0x2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c,10100
0x3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d,88000
0x4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e,10050
0x5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f,14000
0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd,9999
0x1234123412341234123412341234123412341234123412341234123412341234,500
0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef,8500
0xcafe000000000000000000000000000000000000000000000000000000000000,0
```

### 7.3 Scénář 3: Evropská občanská iniciativa (ZKPassport)

- Modul: ZKPassport (Stateless Biometric Verifier)
- Název hlasování: Občanská iniciativa k ochraně digitálního soukromí (Podmínky: Platný e-Pas, Věk 18+, CZE/RUS)
- Popis: V reakci na kontroverzní návrh legislativy byla spuštěna nadnárodní iniciativa. Aby se předešlo podvodům s uměle vytvořenými profily, ověřuje systém oprávněnost voliče čtením biometrických dat a elektronického podpisu státu přímo ze smartphonu. Účastníkovi musí být více než 18 let a musí prokázat občanství ČR nebo Ruské federace, aniž by svá osobní data sdílel se systémem.
- Možnosti:
    - Souhlasím se striktní regulací zpracování osobních dat (Opt-in)
    - Podporuji kompromisní návrh s výjimkami pro výzkumné účely
    - Zásadně nesouhlasím, omezuje to technologický vývoj

### 7.4 Scénář 4: Tajné hlasování odborového svazu (POM)

- Modul: Proof of Membership (POM)
- Název hlasování: Mimořádné tajné hlasování Odborového svazu: Vyhlášení generální stávky v podniku (Kryptograficky ověřená členská základna)
- Popis: V napjaté atmosféře probíhajícího kolektivního vyjednávání potřebuje odborový svaz zjistit reálnou ochotu zaměstnanců stávkovat, a to bez obav z možných represí ze strany vedení podniku. Odborová centrála předem vytvořila Merkle strom z interního seznamu aktivních členů. Systém umožňuje každému členu tajně a nezávisle potvrdit svou účast, a přitom kryptograficky prokázat, že je evidovaným odborářem.
- Možnosti:
    - Pro vyhlášení neomezené stávky
    - Pro vyhlášení výstražné stávky (omezení na 2 hodiny)
    - Proti vyhlášení stávky (Pokračovat v kolektivním vyjednávání)

Dataset (CSV):

```csv
secret,value
0x84d1c9e7a2b5f6d8e3c4a1f9b2d7e5c8a6b3f1d4e9c7a2b5f8d6e3c1a9f4b2d7,1
0x5f6d8e3c4a1f9b2d7e5c8a6b3f1d4e9c7a2b5f8d6e3c1a9f4b2d7e5c8a6b3f1d,1
0x1a9f4b2d7e5c8a6b3f1d4e9c7a2b5f8d6e3c1a9f4b2d7e5c8a6b3f1d4e9c7a2b,1
0xe5c8a6b3f1d4e9c7a2b5f8d6e3c1a9f4b2d7e5c8a6b3f1d4e9c7a2b5f8d6e3c1,1
0xb2d7e5c8a6b3f1d4e9c7a2b5f8d6e3c1a9f4b2d7e5c8a6b3f1d4e9c7a2b5f8d6,1
0x9c7a2b5f8d6e3c1a9f4b2d7e5c8a6b3f1d4e9c7a2b5f8d6e3c1a9f4b2d7e5c8a,1
0x6e3c1a9f4b2d7e5c8a6b3f1d4e9c7a2b5f8d6e3c1a9f4b2d7e5c8a6b3f1d4e9c,1
0x3f1d4e9c7a2b5f8d6e3c1a9f4b2d7e5c8a6b3f1d4e9c7a2b5f8d6e3c1a9f4b2d,1
0x7a2b5f8d6e3c1a9f4b2d7e5c8a6b3f1d4e9c7a2b5f8d6e3c1a9f4b2d7e5c8a6b,1
0x2b5f8d6e3c1a9f4b2d7e5c8a6b3f1d4e9c7a2b5f8d6e3c1a9f4b2d7e5c8a6b3f,1
0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef,1
0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210,1
0x112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00,1
0x00ffeeddccbbaa99887766554433221100ffeeddccbbaa998877665544332211,1
0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef,1
0xcafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe,1
0x8badf00d8badf00d8badf00d8badf00d8badf00d8badf00d8badf00d8badf00d,1
0x1029384756afbecd1029384756afbecd1029384756afbecd1029384756afbecd,1
0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789,1
0x56789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234,1
0xdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abc,1
0x89abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567,1
0x3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012,1
0xab12cd34ef567890ab12cd34ef567890ab12cd34ef567890ab12cd34ef567890,1
0x907856ef34cd12ab907856ef34cd12ab907856ef34cd12ab907856ef34cd12ab,1
```

### 7.5 Scénář 5: ESG fond (ReFi) - řízení kapitálu (POS)

- Modul: Proof of Storage (POS)
- Název hlasování: Alokace investičního fondu GreenDeFi DAO: Financování solárního parku (Vyžadován minimální vklad 10 000 environmentálních tokenů)
- Popis: Ekologický investiční fond rozhoduje o obří investici do obnovitelných zdrojů energie. Aby bylo zajištěno, že o nakládání s pokladnou fondu nerozhodují nezainteresované osoby, musí každý hlasující předložit důkaz, že do projektu dříve investoval kapitál. Systém dynamicky ověřuje, zda hodnota prokazatelného vkladu překračuje bezpečnostní bariéru (minThreshold) 10 000 tokenů, a to bez odhalení konkrétního investora.
- Možnosti:
    - Schválit financování projektu (100% požadované alokace)
    - Schválit částečné financování (50% alokace, zbytek z jiných zdrojů)
    - Zamítnout financování (Vysoké investiční riziko)

Dataset (CSV):

```csv
secret,value
0x1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a,150000
0x2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b,75000
0x3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c,50001
0x4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d,88500
0x5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e,1000000
0x6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f,62000
0x7070707070707070707070707070707070707070707070707070707070707070,95000
0x8181818181818181818181818181818181818181818181818181818181818181,55000
0x9292929292929292929292929292929292929292929292929292929292929292,120000
0xa3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3,50000
0xb4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4b4,67000
0xc5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5,81000
0xd6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6d6,250000
0xe7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7,99000
0xf8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8,53500
0x0909090909090909090909090909090909090909090909090909090909090909,60000
0x1010101010101010101010101010101010101010101010101010101010101010,72000
0x2121212121212121212121212121212121212121212121212121212121212121,50500
0x3232323232323232323232323232323232323232323232323232323232323232,180000
0x4343434343434343434343434343434343434343434343434343434343434343,14500
0x5454545454545454545454545454545454545454545454545454545454545454,49999
0x6565656565656565656565656565656565656565656565656565656565656565,25000
0x7676767676767676767676767676767676767676767676767676767676767676,1000
0x8787878787878787878787878787878787878787878787878787878787878787,0
0x9898989898989898989898989898989898989898989898989898989898989898,48500
```