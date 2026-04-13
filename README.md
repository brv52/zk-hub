# ZK-Voting Hub - Instalační a uživatelská příručka

Tento dokument slouží jako komplexní průvodce pro zprovoznění, testování a rozšiřování projektu ZK-Voting Hub, který vznikl jako praktická část bakalářské práce "Anonymní volební systém na blockchainu". Architektura projektu je koncipována jako monorepozitář skládající se z jádrového systému (VotingHub a frontend) a nezávislých verifikačních modulů.

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

Vyplňte následující proměnné:

ALCHEMY_API_KEY: Váš klíč k RPC uzlu (získáte v dashboardu Alchemy).

PINATA_JWT: Autentizační token pro nahrávání IPFS manifestů (získáte v dashboardu Pinata).

PRIVATE_KEY: Privátní klíč peněženky, ze které bude probíhat nasazení kontraktů.

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

1. Návrh kryptografického obvodu (Circom)

    Vytvořte soubor .circom, ve kterém definujete matematickou logiku ověření (např. porovnání věku, členství ve stromu).

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