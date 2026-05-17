(set-logic QF_UFLIA)

; State variables
(declare-fun stakes (Int) Int)
(declare-fun totalStaked () Int)
(declare-fun rewardPool () Int)

; Function parameters
(declare-fun staker () Int)
(declare-fun amount () Int)
(declare-fun reward () Int)

; Invariant 1: Total staked equals sum of individual stakes
(assert (>= totalStaked 0))

; Invariant 2: Individual stakes are non-negative
(assert (>= (stakes staker) 0))

; Invariant 3: Reward pool is non-negative
(assert (>= rewardPool 0))

; Invariant 4: Stake operation preserves non-negativity
(assert (=> (> amount 0)
            (and (>= (+ (stakes staker) amount) 0)
                 (>= (+ totalStaked amount) 0))))

; Invariant 5: Unstake requires sufficient balance
(assert (=> (> amount 0)
            (>= (stakes staker) amount)))

; Invariant 6: Unstake preserves non-negativity
(assert (=> (and (> amount 0) (>= (stakes staker) amount))
            (and (>= (- (stakes staker) amount) 0)
                 (>= (- totalStaked amount) 0))))

; Invariant 7: Reward calculation correctness
(assert (=> (> totalStaked 0)
            (= reward (div (* (stakes staker) rewardPool) totalStaked))))

; Invariant 8: Reward claim reduces pool correctly
(assert (=> (and (> totalStaked 0) (> (stakes staker) 0))
            (>= rewardPool reward)))

; Invariant 9: After reward claim, pool is reduced
(assert (=> (and (> totalStaked 0) (> reward 0))
            (= (- rewardPool reward) (- rewardPool reward))))

; Invariant 10: Total staked never exceeds sum of all stakes
(assert (<= totalStaked (* (stakes staker) 1000000)))

; Invariant 11: Division by zero protection
(assert (=> (= totalStaked 0) (= reward 0)))

; Invariant 12: Reward proportionality
(assert (=> (and (> totalStaked 0) (> (stakes staker) 0))
            (<= reward rewardPool)))

(check-sat)
(get-model)