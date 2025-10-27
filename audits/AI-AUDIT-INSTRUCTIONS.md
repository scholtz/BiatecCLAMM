# AI Audit Instructions

## Purpose

This document provides comprehensive guidelines for AI models to conduct professional security audits of the BiatecCLAMM concentrated liquidity AMM smart contract system.

---

## Prerequisites

Before conducting the audit, ensure you have:

1. **Access to the complete repository structure**
2. **Understanding of the technology stack**:
   - Algorand blockchain and AVM (Algorand Virtual Machine)
   - TEALScript smart contract language
   - TypeScript for client libraries
   - Concentrated Liquidity AMM mathematics
3. **Familiarity with DeFi security principles**
4. **Knowledge of common smart contract vulnerabilities**

---

## Audit Preparation

### 1. Document Your Identity

At the start of the audit report, clearly document:

```markdown
**AI Model**: [Model Name] ([Model Version])
**Provider**: [Company Name]
**Audit Date**: YYYY-MM-DD
**Commit Hash**: [Full 40-character git commit hash]
**Commit Date**: [Git commit timestamp]
```

Example:
```markdown
**AI Model**: Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)
**Provider**: Anthropic
**Audit Date**: 2025-10-27
**Commit Hash**: a46db71a1c7193324fa369cbfb2e3b735f8e4200
**Commit Date**: 2025-10-27 21:36:52 UTC
```

### 2. Repository Context Gathering

Execute these steps in order:

```bash
# Get commit information
git log -1 --format="%H %cI"

# Understand repository structure
tree -L 2 -I 'node_modules|dist|.git'

# Count lines of code
find contracts -name "*.algo.ts" -exec wc -l {} + | tail -1
find src -name "*.ts" -exec wc -l {} + | tail -1
find __test__ -name "*.test.ts" -exec wc -l {} + | tail -1
```

---

## Audit Methodology

### Phase 1: Comprehensive Code Review

#### Smart Contracts (contracts/*.algo.ts)

Review each contract file systematically:

1. **BiatecClammPool.algo.ts** (Main AMM logic - ~2100 lines)
   - Liquidity management functions
   - Swap calculations
   - Fee accounting
   - Price bound enforcement
   - Identity verification integration
   - Staking pool support

2. **BiatecConfigProvider.algo.ts** (~200 lines)
   - Configuration management
   - Fee parameters
   - Administrative controls

3. **BiatecIdentityProvider.algo.ts** (~450 lines)
   - Identity verification
   - KYC/compliance integration
   - Verification class management

4. **BiatecPoolProvider.algo.ts** (~1300 lines)
   - Pool registry
   - Box storage management
   - Asset metadata
   - Pool deployment orchestration

#### Key Areas to Examine:

**Mathematical Operations**:
- [ ] Integer arithmetic (overflow/underflow risks)
- [ ] Division operations (division by zero, rounding)
- [ ] Square root calculations
- [ ] Scale conversions (9-decimal base scale)
- [ ] LP token minting calculations
- [ ] Fee distribution formulas

**Access Control**:
- [ ] Function authorization (who can call what)
- [ ] Admin privileges
- [ ] Executive fee address permissions
- [ ] Identity verification requirements

**State Management**:
- [ ] Global state consistency
- [ ] Box storage integrity
- [ ] Asset balance tracking
- [ ] Liquidity accounting
- [ ] Fee accumulation

**Asset Handling**:
- [ ] Asset transfer security
- [ ] Opt-in requirements
- [ ] Minimum balance considerations
- [ ] Native token (ALGO) vs ASA handling
- [ ] Same-asset staking pools

**Economic Security**:
- [ ] Fee calculations
- [ ] Slippage protection
- [ ] Price manipulation resistance
- [ ] LP token supply integrity
- [ ] Liquidity fee protection mechanism

### Phase 2: TypeScript Client Library Review

Review transaction builders and helper functions:

1. **Transaction Builders** (`src/biatecClamm/txs/`)
   - [ ] Parameter validation
   - [ ] Transaction group construction
   - [ ] Box reference inclusion
   - [ ] App call resource population

2. **Sender Functions** (`src/biatecClamm/sender/`)
   - [ ] Error handling
   - [ ] State fetching
   - [ ] Transaction signing
   - [ ] Response validation

3. **Common Utilities** (`src/common/`)
   - [ ] Buffer operations
   - [ ] Encoding/decoding
   - [ ] Logger configuration

### Phase 3: Test Coverage Analysis

Analyze test files in `__test__/`:

```bash
# Run existing tests
npm run test:nobuild

# Check test coverage
npm run test -- --coverage
```

**Key Testing Areas**:
- [ ] Basic liquidity operations (add/remove)
- [ ] Swap functionality
- [ ] Fee calculations
- [ ] Edge cases (extreme values, zero amounts)
- [ ] Staking pool scenarios
- [ ] Identity verification flows
- [ ] Error conditions

**Identify Missing Scenarios**:
- Attack vectors not covered
- Edge cases not tested
- Integration scenarios missing
- Stress test scenarios
- Multi-user concurrent operations

### Phase 4: Documentation Review

Review all documentation for:

1. **Completeness**:
   - [ ] All features documented
   - [ ] API documentation clear
   - [ ] Examples provided
   - [ ] Security considerations mentioned

2. **Accuracy**:
   - [ ] Code matches documentation
   - [ ] Examples are correct
   - [ ] Warnings are appropriate

3. **User Safety**:
   - [ ] Risk disclaimers present
   - [ ] Best practices documented
   - [ ] Common pitfalls explained

---

## Security Checklist

### Critical Security Issues

Use this checklist to systematically identify vulnerabilities:

#### Smart Contract Security

- [ ] **Reentrancy**: Can external calls lead to reentrancy attacks?
- [ ] **Integer Overflow/Underflow**: Are all arithmetic operations safe?
- [ ] **Division by Zero**: Are denominators validated before division?
- [ ] **Access Control**: Are privileged functions properly protected?
- [ ] **State Consistency**: Can state become inconsistent?
- [ ] **Asset Safety**: Are asset transfers always correct?
- [ ] **Price Manipulation**: Can prices be manipulated?
- [ ] **Flash Loan Attacks**: Is the protocol vulnerable to flash loans?
- [ ] **Front-Running**: Are users protected from MEV attacks?
- [ ] **Rounding Errors**: Do rounding errors always favor the pool?

#### Algorand-Specific Issues

- [ ] **Box Storage**: Are box names constructed correctly?
- [ ] **App Call Resources**: Are all resources properly referenced?
- [ ] **Transaction Groups**: Are groups atomic and properly ordered?
- [ ] **Minimum Balance**: Are minimum balance requirements enforced?
- [ ] **Opt-In Requirements**: Are asset opt-ins handled correctly?
- [ ] **Inner Transactions**: Are inner transaction limits respected?
- [ ] **Global State Limits**: Are global state size limits considered?
- [ ] **Local State Usage**: Is local state used appropriately?

#### Economic Model Security

- [ ] **Fee Siphoning**: Can users extract fees they don't deserve?
- [ ] **LP Token Inflation**: Can LP supply be manipulated?
- [ ] **Liquidity Drain**: Can liquidity be extracted unfairly?
- [ ] **Price Range Violations**: Can operations occur outside price bounds?
- [ ] **Impermanent Loss**: Is IL properly communicated to users?
- [ ] **Slippage**: Are users protected from excessive slippage?

#### Integration Security

- [ ] **Config Provider**: Are config updates validated?
- [ ] **Identity Provider**: Can identity checks be bypassed?
- [ ] **Pool Provider**: Is pool registry integrity maintained?
- [ ] **Cross-App Calls**: Are external app calls safe?

---

## Vulnerability Severity Classification

Use this framework to classify findings:

### Critical
- Direct loss of user funds
- Smart contract can be permanently locked
- Unauthorized minting of LP tokens
- Complete bypass of access controls

### High
- Indirect loss of funds under specific conditions
- Significant economic manipulation possible
- Partial bypass of security controls
- Data integrity compromise

### Medium
- Potential for loss under unlikely conditions
- Economic inefficiencies
- Partial functionality degradation
- Documentation mismatches leading to misuse

### Low
- Code quality issues
- Gas inefficiencies
- Minor user experience issues
- Non-critical documentation gaps

### Informational
- Code style suggestions
- Optimization opportunities
- Best practice recommendations
- Educational notes

---

## Testing Scenario Development

For each identified gap in test coverage, document:

```markdown
### Missing Test: [Scenario Name]

**Description**: [What the test should verify]

**Risk if Untested**: [Potential vulnerabilities or bugs]

**Test Steps**:
1. [Setup step]
2. [Action step]
3. [Verification step]

**Expected Behavior**: [What should happen]

**Edge Cases to Include**:
- [Edge case 1]
- [Edge case 2]

**Priority**: [Critical/High/Medium/Low]
```

---

## Documentation Requirements

For each identified documentation gap:

```markdown
### Documentation Gap: [Area/Feature]

**Missing Information**: [What's not documented]

**User Impact**: [How this affects users]

**Recommended Documentation**:
- [Point 1]
- [Point 2]

**Location**: [Where to add this documentation]

**Priority**: [Critical/High/Medium/Low]
```

---

## Report Structure

Follow the audit template structure exactly:

1. **Audit Metadata** - Complete all fields
2. **Executive Summary** - High-level findings
3. **Scope and Methodology** - What was reviewed and how
4. **Findings** - Organized by severity
5. **Missing Test Scenarios** - Test gaps identified
6. **Documentation Gaps** - Documentation issues
7. **Security Best Practices** - Compliance assessment
8. **Risk Assessment** - Overall risk evaluation
9. **Recommendations** - Prioritized action items
10. **Testing Recommendations** - Additional test scenarios
11. **Compliance and Standards** - Standards adherence
12. **Appendix** - Supporting information

---

## Analysis Techniques

### Static Analysis

1. **Code Flow Analysis**:
   - Trace execution paths
   - Identify all exit points
   - Map state changes
   - Document side effects

2. **Data Flow Analysis**:
   - Track variable lifecycle
   - Identify data dependencies
   - Check validation at boundaries
   - Verify sanitization

3. **Pattern Matching**:
   - Compare against known vulnerabilities
   - Look for anti-patterns
   - Check for best practice violations

### Mathematical Verification

For AMM calculations:

1. **Verify Formulas**:
   - Concentrated liquidity formula: `L = sqrt(x * y)`
   - Price calculation: `price = y/x`
   - Fee distribution formulas
   - LP minting quadratic equation

2. **Check Invariants**:
   - Liquidity should never decrease from fees alone
   - Price should stay within bounds
   - Total LP supply should match distributed tokens
   - Asset balances should reconcile

3. **Rounding Analysis**:
   - Verify rounding always favors the pool
   - Check for accumulated rounding errors
   - Validate scale conversions

### Attack Modeling

Consider these attack scenarios:

1. **Economic Attacks**:
   - Sandwich attacks
   - Price manipulation
   - Fee harvesting
   - LP token dilution

2. **Technical Attacks**:
   - Reentrancy
   - Overflow/underflow
   - State inconsistency
   - Resource exhaustion

3. **Social Attacks**:
   - Admin key compromise
   - Identity verification bypass
   - Phishing via incorrect documentation

---

## Best Practices for AI Auditors

### 1. Be Thorough
- Review every file in scope
- Don't skip "obvious" code
- Check dependencies
- Verify assumptions

### 2. Be Systematic
- Follow the checklist
- Document everything
- Use consistent terminology
- Reference specific line numbers

### 3. Be Specific
- Cite exact code locations
- Provide reproducible examples
- Explain impact clearly
- Give actionable recommendations

### 4. Be Objective
- Base findings on evidence
- Don't speculate without basis
- Distinguish between confirmed and potential issues
- Acknowledge limitations

### 5. Be Constructive
- Provide solutions, not just problems
- Prioritize findings appropriately
- Consider implementation difficulty
- Balance security with usability

### 6. Context Awareness
- Understand the Algorand ecosystem
- Consider the CLAMM model specifics
- Respect project goals
- Account for intended use cases

---

## Code Review Deep Dive Areas

### Liquidity Management

**File**: `contracts/BiatecClammPool.algo.ts`

Key functions to review:
- `processAddLiquidity()`
- `processRemoveLiquidity()`
- `calculateLiquidityForDeposit()`
- `calculateWithdrawal()`

Questions to ask:
- Can a user withdraw more than they deposited?
- Are fee shares calculated correctly?
- Can liquidity become negative?
- Are edge cases (zero amounts, minimum deposits) handled?

### Swap Operations

Key functions:
- `swap()`
- `swapFromAssetAToAssetB()`
- `swapFromAssetBToAssetA()`

Questions to ask:
- Can swaps occur outside price bounds?
- Are fees calculated correctly?
- Can swaps result in negative balances?
- Is slippage protection adequate?
- Can price be manipulated?

### Fee Distribution

Key areas:
- `LiquidityUsersFromFees` tracking
- `LiquidityBiatecFromFees` tracking
- `distributeExcessAssets()` function

Questions to ask:
- Can fees be stolen?
- Are fees distributed proportionally?
- Can fee accounting become inconsistent?
- Are there fee rounding exploits?

### Identity Verification

Key functions in `BiatecIdentityProvider.algo.ts`:
- `verifyIdentity()`
- `setVerificationClass()`

Questions to ask:
- Can identity checks be bypassed?
- Is the verification class system secure?
- Can users impersonate others?
- Are identity updates properly controlled?

---

## Common Pitfalls to Check

### Algorand-Specific

1. **Box Reference Missing**:
   - Check that all box accesses have corresponding references
   - Verify box name construction is consistent

2. **App Reference Missing**:
   - Verify all cross-app calls include app references
   - Check foreign app array is populated

3. **Asset Opt-In**:
   - Confirm contracts opt into assets before receiving
   - Handle duplicate opt-in attempts

4. **Inner Transaction Budget**:
   - Count total inner transactions
   - Verify within Algorand limits (256 per group)

5. **Minimum Balance**:
   - Calculate MBR for all operations
   - Verify funding is adequate

### TEALScript-Specific

1. **Type Conversions**:
   - Check uint64 ↔ uint256 conversions
   - Verify no precision loss

2. **Assert Statements**:
   - Ensure all asserts are reachable
   - Check error messages are meaningful

3. **State Access**:
   - Verify state exists before reading
   - Handle missing state gracefully

### General DeFi

1. **Price Oracle Manipulation**:
   - Check if external price sources can be manipulated
   - Verify internal price calculation integrity

2. **Flash Loan Attacks**:
   - Consider attacks enabled by temporary capital
   - Verify atomic transaction protection

3. **Frontrunning**:
   - Identify MEV opportunities
   - Check slippage protection

---

## Output Quality Standards

Your audit report should:

1. ✅ **Be Complete**: Cover all items in the template
2. ✅ **Be Accurate**: All findings should be verifiable
3. ✅ **Be Clear**: Technical details explained for all audiences
4. ✅ **Be Actionable**: Recommendations should be specific
5. ✅ **Be Professional**: Use formal, technical language
6. ✅ **Be Structured**: Follow the template exactly
7. ✅ **Be Referenced**: Include file paths and line numbers
8. ✅ **Be Prioritized**: Severity levels should be consistent

---

## Final Verification

Before submitting the audit:

- [ ] All template sections completed
- [ ] AI model version clearly documented
- [ ] Commit hash verified and included
- [ ] All findings have severity classifications
- [ ] Each finding has a clear recommendation
- [ ] Test gaps are documented
- [ ] Documentation issues are noted
- [ ] Risk assessment is complete
- [ ] Recommendations are prioritized
- [ ] No placeholder text remains
- [ ] Report is well-formatted and readable
- [ ] Executive summary accurately reflects findings

---

## Example Finding Format

```markdown
### [H-01] Potential Integer Overflow in Liquidity Calculation

**Severity**: High
**Status**: Open
**Component**: BiatecClammPool
**File**: contracts/BiatecClammPool.algo.ts:456

**Description**:
The function `calculateLiquidityForDeposit()` multiplies two uint256 values 
without checking for overflow. When both assetA and assetB amounts are near 
their maximum values, the intermediate calculation can overflow, leading to 
incorrect liquidity values.

**Impact**:
An attacker could potentially exploit this by providing specific input values 
that cause overflow, resulting in:
- Incorrect LP token minting
- Loss of funds for other liquidity providers
- Pool state corruption

**Proof of Concept**:
\`\`\`typescript
// When assetAAmount and assetBAmount are both > 2^128
const liquidity = assetAAmount * assetBAmount; // This can overflow
const sqrtLiquidity = sqrt(liquidity); // Operating on wrong value
\`\`\`

**Recommendation**:
1. Add overflow checks before multiplication
2. Use safe math libraries for uint256 operations
3. Consider splitting large calculations into multiple steps
4. Add assertion to verify result is within expected range

Example fix:
\`\`\`typescript
assert(assetAAmount <= MAX_SAFE_UINT128);
assert(assetBAmount <= MAX_SAFE_UINT128);
const liquidity = assetAAmount * assetBAmount;
\`\`\`

**References**:
- https://docs.algorand.foundation/docs/avm/teal/opcodes/#arithmetic
- Similar vulnerability: [Link to similar case if applicable]
```

---

## Continuous Improvement

After completing the audit:

1. **Self-Review**: Re-read the report as if you're the recipient
2. **Completeness Check**: Ensure no sections are missing
3. **Consistency Check**: Verify terminology is consistent
4. **Actionability Check**: Can developers act on your recommendations?
5. **Clarity Check**: Would a non-expert understand the critical findings?

---

## Resources

### Algorand Documentation
- [Algorand Developer Portal](https://developer.algorand.org/)
- [TEALScript Documentation](https://tealscript.netlify.app/)
- [Algorand Smart Contract Guidelines](https://developer.algorand.org/docs/get-details/dapps/smart-contracts/guidelines/)

### Security Resources
- [Smart Contract Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [DeFi Security Summit Resources](https://defisecuritysummit.org/)
- [Algorand Security Best Practices](https://developer.algorand.org/docs/get-details/dapps/smart-contracts/security/)

### AMM Resources
- [Uniswap V3 Whitepaper](https://uniswap.org/whitepaper-v3.pdf) (Concentrated liquidity reference)
- [AMM Security Analysis](https://arxiv.org/abs/2103.00554)

---

**Version**: 1.0
**Last Updated**: 2025-10-27
**Maintained by**: BiatecCLAMM Team
