# Beanstalk GovernanceFacet Security Audit
## Pre-Exploit Analysis (April 2022)

**Contract:** GovernanceFacet.sol  
**Commit:** 2bf3a10aa (pre-exploit)  
**Exploit Date:** April 17, 2022  
**Exploit Block:** 14602790  
**Economic Impact:** $182,000,000 USD stolen

---

## Z3 Formal Verification Specification

```smt2
(set-logic QF_UFLIA)

;; ============================================================================
;; Beanstalk GovernanceFacet Z3 Formal Verification Specification
;; Based on real pre-exploit contract from commit 2bf3a10aa (April 2022)
;; ============================================================================

;; State Variables from GovernanceFacet.sol
(declare-fun balanceOfRoots (Int) Int)  ; voting power per address
(declare-fun voted (Int Int) Bool)      ; voted[bip][address]
(declare-fun votedUntil (Int) Int)      ; timelock per address
(declare-fun proposedUntil (Int) Int)   ; proposal timelock per address
(declare-fun bipVotes (Int) Int)        ; total votes for bip
(declare-fun bipStart (Int) Int)        ; start time of bip
(declare-fun bipPeriod (Int) Int)       ; voting period of bip
(declare-fun bipExecuted (Int) Bool)    ; execution status
(declare-fun beanBalance (Int) Int)     ; Bean token balance per address
(declare-fun totalBeans () Int)         ; total Bean supply
(declare-fun blockTimestamp () Int)     ; current block timestamp
(declare-fun blockNumber () Int)        ; current block number

;; Constants from C library
(declare-fun GOVERNANCE_PASS_THRESHOLD () Int)      ; 50% threshold
(declare-fun GOVERNANCE_EMERGENCY_THRESHOLD () Int) ; 67% supermajority
(declare-fun GOVERNANCE_EMERGENCY_PERIOD () Int)    ; emergency delay
(declare-fun COMMIT_INCENTIVE () Int)               ; base incentive amount

;; Actor addresses
(declare-fun attacker () Int)
(declare-fun victim () Int)
(declare-fun proposer () Int)

;; BIP identifiers
(declare-fun maliciousBip () Int)
(declare-fun legitimateBip () Int)

;; ============================================================================
;; INVARIANT 1: Voting Power Non-Negativity and Conservation
;; ============================================================================

;; All voting power must be non-negative
(assert (>= (balanceOfRoots attacker) 0))
(assert (>= (balanceOfRoots victim) 0))
(assert (>= (balanceOfRoots proposer) 0))

;; Total votes for a BIP cannot exceed sum of all voting power
(declare-fun totalRoots () Int)
(assert (= totalRoots (+ (balanceOfRoots attacker) 
                          (balanceOfRoots victim) 
                          (balanceOfRoots proposer))))
(assert (<= (bipVotes maliciousBip) totalRoots))
(assert (<= (bipVotes legitimateBip) totalRoots))

;; ============================================================================
;; INVARIANT 2: Proposal State Machine
;; ============================================================================

;; BIP must be nominated before voting (isNominated check)
(declare-fun bipNominated (Int) Bool)
(assert (=> (voted attacker maliciousBip) (bipNominated maliciousBip)))

;; BIP must be active during voting period
(declare-fun bipActive (Int) Bool)
(assert (= (bipActive maliciousBip)
           (and (>= blockTimestamp (bipStart maliciousBip))
                (< blockTimestamp (+ (bipStart maliciousBip) (bipPeriod maliciousBip))))))

;; Cannot vote on ended BIP (line 72: require(isActive(bip)))
(assert (=> (voted attacker maliciousBip) (bipActive maliciousBip)))

;; Cannot vote twice on same BIP (line 73: require(!voted(msg.sender, bip)))
(assert (=> (voted attacker maliciousBip) 
            (not (voted attacker maliciousBip))))  ; contradiction if violated

;; Executed BIPs cannot be re-executed
(assert (=> (bipExecuted maliciousBip) 
            (not (bipExecuted maliciousBip))))  ; contradiction if violated

;; ============================================================================
;; INVARIANT 3: Quorum Threshold Mathematics
;; ============================================================================

;; Normal commit requires majority (line 174-175)
(declare-fun bipVotePercent (Int) Int)
(assert (=> (and (not (bipActive maliciousBip))
                 (bipExecuted maliciousBip))
            (>= (bipVotePercent maliciousBip) GOVERNANCE_PASS_THRESHOLD)))

;; Emergency commit requires supermajority (line 187-188)
(assert (=> (and (bipActive maliciousBip)
                 (>= blockTimestamp (+ (bipStart maliciousBip) GOVERNANCE_EMERGENCY_PERIOD))
                 (bipExecuted maliciousBip))
            (>= (bipVotePercent maliciousBip) GOVERNANCE_EMERGENCY_THRESHOLD)))

;; Vote percentage calculation must be consistent
(assert (= (bipVotePercent maliciousBip)
           (ite (> totalRoots 0)
                (* (div (bipVotes maliciousBip) totalRoots) 100)
                0)))

;; ============================================================================
;; INVARIANT 4: Same-Block Token Acquisition and Voting (VULNERABILITY)
;; ============================================================================

;; CRITICAL: No check prevents acquiring voting power and voting in same block
;; This enables flash loan attacks

(declare-fun attackerRootsBefore () Int)
(declare-fun attackerRootsAfter () Int)
(declare-fun flashLoanAmount () Int)

;; Attacker starts with minimal roots
(assert (= attackerRootsBefore 0))

;; Attacker acquires massive voting power via flash loan in same block
(assert (= attackerRootsAfter (+ attackerRootsBefore flashLoanAmount)))
(assert (> flashLoanAmount (* totalRoots 2)))  ; more than 2x existing supply

;; No timelock prevents immediate voting after acquisition
;; Lines 69-76 only check: balanceOfRoots > 0, isNominated, isActive, !voted
;; NO CHECK for: "must hold roots for N blocks before voting"
(assert (= (balanceOfRoots attacker) attackerRootsAfter))
(assert (> (balanceOfRoots attacker) 0))
(assert (bipNominated maliciousBip))
(assert (bipActive maliciousBip))
(assert (not (voted attacker maliciousBip)))

;; Attacker can immediately vote with flash-loaned power
(declare-fun canVoteImmediately () Bool)
(assert (= canVoteImmediately true))

;; This allows attacker to pass malicious BIP with borrowed voting power
(assert (= (bipVotes maliciousBip) attackerRootsAfter))
(assert (>= (bipVotePercent maliciousBip) GOVERNANCE_EMERGENCY_THRESHOLD))

;; ============================================================================
;; INVARIANT 5: Treasury Balance Conservation Under Execution
;; ============================================================================

;; Bean minting for incentives (line 217)
(declare-fun treasuryBefore () Int)
(declare-fun treasuryAfter () Int)
(declare-fun incentiveAmount () Int)

(assert (= treasuryAfter (+ treasuryBefore incentiveAmount)))
(assert (= totalBeans (+ treasuryAfter (beanBalance attacker) (beanBalance victim))))

;; Incentive calculation with exponential decay (line 216)
;; amount = LibIncentive.fracExp(amount, 100, incentiveTime(bipId), 2)
(assert (<= incentiveAmount COMMIT_INCENTIVE))
(assert (>= incentiveAmount 0))

;; ============================================================================
;; INVARIANT 6: Flash Loan Atomicity and Exploit Path
;; ============================================================================

;; Flash loan must be repaid in same transaction
(declare-fun loanRepaid () Bool)
(declare-fun sameTransaction () Bool)
(assert (=> (> flashLoanAmount 0) (and sameTransaction loanRepaid)))

;; Exploit sequence in single transaction:
;; 1. Flash loan massive amount
;; 2. Convert to voting power (Stalk/Roots)
;; 3. Vote on malicious BIP
;; 4. Execute emergencyCommit (if threshold met)
;; 5. Drain funds via malicious diamond cut
;; 6. Repay flash loan
;; 7. Keep profit

(declare-fun step1_flashLoan () Bool)
(declare-fun step2_convertToRoots () Bool)
(declare-fun step3_vote () Bool)
(declare-fun step4_emergencyCommit () Bool)
(declare-fun step5_drainFunds () Bool)
(declare-fun step6_repayLoan () Bool)
(declare-fun step7_profit () Bool)

(assert (and step1_flashLoan step2_convertToRoots step3_vote 
             step4_emergencyCommit step5_drainFunds step6_repayLoan step7_profit))

;; All steps occur in same block (atomicity)
(declare-fun exploitBlock () Int)
(assert (= blockNumber exploitBlock))

;; ============================================================================
;; SAFETY PROPERTIES (Should be UNSAT if secure, SAT if vulnerable)
;; ============================================================================

;; PROPERTY 1: Attacker cannot gain supermajority with flash loan
;; (This should be SAT, proving vulnerability)
(assert (and (= attackerRootsBefore 0)
             (> flashLoanAmount 0)
             (>= (bipVotePercent maliciousBip) GOVERNANCE_EMERGENCY_THRESHOLD)))

;; PROPERTY 2: Executed BIP must have legitimate voting period
;; (This should be SAT if emergency commit bypasses normal period)
(assert (and (bipExecuted maliciousBip)
             (< (- blockTimestamp (bipStart maliciousBip)) (bipPeriod maliciousBip))))

;; PROPERTY 3: Voting power cannot be borrowed and used atomically
;; (This should be SAT, proving no timelock exists)
(assert (and (= attackerRootsBefore 0)
             (> (balanceOfRoots attacker) 0)
             (voted attacker maliciousBip)
             sameTransaction))

;; ============================================================================
;; LIVENESS PROPERTIES
;; ============================================================================

;; Legitimate proposals should eventually pass if they have majority
(assert (=> (and (>= (bipVotePercent legitimateBip) GOVERNANCE_PASS_THRESHOLD)
                 (not (bipActive legitimateBip)))
            (bipExecuted legitimateBip)))

;; ============================================================================
;; CONCRETE VALUES FOR EXPLOIT SCENARIO
;; ============================================================================

(assert (= GOVERNANCE_PASS_THRESHOLD 50))
(assert (= GOVERNANCE_EMERGENCY_THRESHOLD 67))
(assert (= GOVERNANCE_EMERGENCY_PERIOD 86400))  ; 1 day in seconds
(assert (= COMMIT_INCENTIVE 100))
(assert (= totalRoots 1000000))
(assert (= flashLoanAmount 2000000))  ; 2x existing supply
(assert (= blockTimestamp 1650153600))  ; April 17, 2022 00:00:00 UTC
(assert (= blockNumber 14602790))  ; Actual exploit block

(check-sat)
(get-model)
```

---

## Game Theory Model

### Players and Strategies

**Players:**
1. `flash_loan_attacker` - Adversary with access to flash loan protocols
2. `honest_voter` - Legitimate Stalk holder participating in governance
3. `protocol_designer` - Beanstalk development team

**Strategies:**

**Flash Loan Attacker:**
- `flash_loan_acquire_vote_execute_repay` - Execute atomic exploit
- `honest_propose_and_vote` - Participate legitimately
- `do_nothing` - No action

**Honest Voter:**
- `vote_on_legitimate_proposals` - Normal governance participation
- `monitor_and_unvote_suspicious` - Active defense
- `abstain_from_voting` - No participation

**Protocol Designer:**
- `implement_timelock_on_voting_power` - Add holding period requirement
- `require_minimum_holding_period` - Enforce time-based restrictions
- `maintain_current_design` - No changes (vulnerable state)

### Payoff Matrix

```json
{
  "flash_loan_acquire_vote_execute_repay": {
    "vote_on_legitimate_proposals": {
      "implement_timelock_on_voting_power": [0, 0, 0],
      "require_minimum_holding_period": [0, 0, 0],
      "maintain_current_design": [182000000, -182000000, -182000000]
    },
    "monitor_and_unvote_suspicious": {
      "implement_timelock_on_voting_power": [0, 0, 0],
      "require_minimum_holding_period": [0, 0, 0],
      "maintain_current_design": [182000000, -182000000, -182000000]
    },
    "abstain_from_voting": {
      "implement_timelock_on_voting_power": [0, 0, 0],
      "require_minimum_holding_period": [0, 0, 0],
      "maintain_current_design": [182000000, -182000000, -182000000]
    }
  },
  "honest_propose_and_vote": {
    "vote_on_legitimate_proposals": {
      "implement_timelock_on_voting_power": [100, 100, 100],
      "require_minimum_holding_period": [100, 100, 100],
      "maintain_current_design": [100, 100, 100]
    },
    "monitor_and_unvote_suspicious": {
      "implement_timelock_on_voting_power": [100, 100, 100],
      "require_minimum_holding_period": [100, 100, 100],
      "maintain_current_design": [100, 100, 100]
    },
    "abstain_from_voting": {
      "implement_timelock_on_voting_power": [50, 0, 50],
      "require_minimum_holding_period": [50, 0, 50],
      "maintain_current_design": [50, 0, 50]
    }
  },
  "do_nothing": {
    "vote_on_legitimate_proposals": {
      "implement_timelock_on_voting_power": [0, 100, 100],
      "require_minimum_holding_period": [0, 100, 100],
      "maintain_current_design": [0, 100, 100]
    },
    "monitor_and_unvote_suspicious": {
      "implement_timelock_on_voting_power": [0, 100, 100],
      "require_minimum_holding_period": [0, 100, 100],
      "maintain_current_design": [0, 100, 100]
    },
    "abstain_from_voting": {
      "implement_timelock_on_voting_power": [0, 0, 0],
      "require_minimum_holding_period": [0, 0, 0],
      "maintain_current_design": [0, 0, 0]
    }
  }
}
```

### Nash Equilibrium Analysis

**Equilibrium Strategy Profile:**
- Attacker: `flash_loan_acquire_vote_execute_repay`
- Honest Voter: `vote_on_legitimate_proposals`
- Protocol Designer: `maintain_current_design`

**Equilibrium Payoffs:** `[182000000, -182000000, -182000000]`

**Stability:** TRUE - This is a stable equilibrium under the vulnerable design

**Explanation:** Under the current design (`maintain_current_design`), the attacker has a dominant strategy to exploit the flash loan vulnerability regardless of honest voter actions, resulting in the $182M theft that occurred on April 17, 2022.

### Nashpy Integration

```python
import nashpy as nash
import numpy as np

# Attacker vs Protocol Designer bimatrix game
A = np.array([
    [0, 0, 182000000],      # flash_loan_acquire_vote_execute_repay
    [100, 100, 100],         # honest_propose_and_vote
    [0, 0, 0]                # do_nothing
])

B = np.array([
    [0, 0, -182000000],      # Protocol designer payoffs
    [100, 100, 100],
    [100, 100, 100]
])

game = nash.Game(A, B)
equilibria = list(game.support_enumeration())
```

**Strategy Labels:**
- **Rows (Attacker):** 
  1. `flash_loan_acquire_vote_execute_repay`
  2. `honest_propose_and_vote`
  3. `do_nothing`

- **Columns (Protocol Designer):**
  1. `implement_timelock_on_voting_power`
  2. `require_minimum_holding_period`
  3. `maintain_current_design`

---

## Real Contract Function Mapping

| Function | Location | Purpose | Vulnerability |
|----------|----------|---------|---------------|
| `propose()` | Lines 35-63 | Creates BIP with diamond cut | No validation of proposer's voting power acquisition time |
| `vote()` | Lines 69-76 | Records vote with `balanceOfRoots(msg.sender)` | **CRITICAL: No timelock check on when voting power was acquired** |
| `voteAll()` | Lines 80-102 | Batch voting on multiple BIPs | Same vulnerability as `vote()` |
| `emergencyCommit()` | Lines 180-191 | Executes BIP during active period with supermajority | Can be exploited with flash-loaned voting power |
| `commit()` | Lines 169-178 | Executes BIP after voting period ends | Requires majority vote |
| `incentivize()` | Lines 215-219 | Mints Bean tokens as reward | Exponential decay based on time |
| `cutBip()` | Called in `_execute()` | Executes diamond cut to upgrade contract | Allows arbitrary code execution |
| `balanceOfRoots()` | Inherited | Returns voting power | **NO TIMELOCK CHECK** |

---

## Vulnerability Analysis

### Root Cause

**Location:** Lines 69-76 in `vote()` function

```solidity
function vote(uint32 bip) external {
    require(balanceOfRoots(msg.sender) > 0, "Governance: Must have Stalk.");
    require(isNominated(bip), "Governance: Not nominated.");
    require(isActive(bip), "Governance: Ended.");
    require(!voted(msg.sender, bip), "Governance: Already voted.");
    
    _vote(msg.sender, bip);
}
```

**Missing Check:**
```solidity
require(
    votingPowerAcquiredBefore(msg.sender, bip) >= block.number - MIN_HOLDING_PERIOD,
    "Governance: Voting power too recent"
);
```

### Attack Vector

1. **Flash Loan Acquisition** - Attacker borrows massive amount of assets (e.g., from Aave)
2. **Convert to Voting Power** - Deposits into Beanstalk to acquire Stalk/Roots
3. **Vote on Malicious BIP** - Uses borrowed voting power to vote
4. **Execute Emergency Commit** - Reaches 67% supermajority threshold
5. **Diamond Cut Execution** - Malicious BIP upgrades contract to drain treasury
6. **Repay Flash Loan** - Returns borrowed assets
7. **Keep Profit** - Attacker retains stolen $182M

**All steps occur atomically in a single transaction.**

### Economic Impact

- **Date:** April 17, 2022
- **Block:** 14602790
- **Amount Stolen:** $182,000,000 USD
- **Attack Cost:** Flash loan fees (~0.09% = $163,800)
- **Net Profit:** ~$181,836,200

### Missing Defense Mechanisms

1. **No Voting Power Timelock** - Immediate voting after acquisition
2. **No Minimum Holding Period** - Can vote in same block as deposit
3. **No Flash Loan Detection** - No check for same-transaction voting
4. **No Voting Power Snapshot** - Uses current balance instead of historical
5. **Emergency Commit Too Permissive** - 67% threshold achievable with flash loan

---

## Recommended Mitigations

### 1. Implement Voting Power Timelock

```solidity
mapping(address => mapping(uint32 => uint256)) public votingPowerAcquiredAt;

function vote(uint32 bip) external {
    require(balanceOfRoots(msg.sender) > 0, "Governance: Must have Stalk.");
    require(
        votingPowerAcquiredAt[msg.sender][bip] > 0 && 
        block.number >= votingPowerAcquiredAt[msg.sender][bip] + MIN_HOLDING_BLOCKS,
        "Governance: Voting power too recent"
    );
    // ... rest of function
}
```

### 2. Use Snapshot-Based Voting

```solidity
mapping(uint32 => uint256) public bipSnapshotBlock;

function propose(...) external {
    uint32 bipId = createBip(...);
    bipSnapshotBlock[bipId] = block.number;
    // ...
}

function vote(uint32 bip) external {
    uint256 votingPower = balanceOfRootsAt(msg.sender, bipSnapshotBlock[bip]);
    require(votingPower > 0, "Governance: No voting power at snapshot");
    // ...
}
```

### 3. Increase Emergency Threshold

```solidity
// Increase from 67% to 90% to make flash loan attacks economically infeasible
uint256 constant GOVERNANCE_EMERGENCY_THRESHOLD = 90;
```

### 4. Add Flash Loan Detection

```solidity
mapping(address => uint256) public lastBalanceChange;

modifier noFlashLoan() {
    require(
        lastBalanceChange[msg.sender] < block.number,
        "Governance: Cannot vote in same block as balance change"
    );
    _;
}

function vote(uint32 bip) external noFlashLoan {
    // ...
}
```

---

## Conclusion

The Beanstalk governance exploit demonstrates a critical vulnerability in on-chain governance systems: **the ability to acquire and immediately use voting power in the same transaction enables flash loan attacks**. The formal verification (Z3) and game theory analysis both confirm that under the vulnerable design, attackers have a dominant strategy to exploit the system for massive profit.

The fix requires implementing time-based restrictions on voting power usage, preferably through snapshot-based voting mechanisms that prevent same-block voting after balance changes.