"""
Test Bob AI Simulator with Real Beanstalk GovernanceFacet
"""

from api.bob_ai_simulator import create_bob_simulator
from pathlib import Path

# Load the real Beanstalk contract
contract_path = Path("GovernanceFacet.sol")
with open(contract_path, 'r') as f:
    contract_code = f.read()

# Create Bob AI
bob_ai = create_bob_simulator()

# Run analysis
print("=" * 80)
print("BOB AI ANALYSIS - Beanstalk GovernanceFacet.sol")
print("=" * 80)
print()

result = bob_ai.analyze_contract(contract_code, "Beanstalk GovernanceFacet")

# Print structure
print("📊 CONTRACT STRUCTURE")
print(f"Functions: {len(result['structure']['functions'])}")
print(f"State Variables: {len(result['structure']['state_vars'])}")
print(f"Modifiers: {len(result['structure']['modifiers'])}")
print()

# Print vulnerabilities
print("🔍 VULNERABILITIES DETECTED")
print(f"Total: {len(result['vulnerabilities'])}")
print(f"Risk Level: {result['overall_risk'].upper()}")
print()

for vuln in result['vulnerabilities']:
    print(f"  ⚠️  {vuln['type'].replace('_', ' ').title()}")
    print(f"      Severity: {vuln['severity'].upper()}")
    print(f"      Location: {vuln['location']}")
    print(f"      Description: {vuln['description']}")
    print()
    print("      Evidence:")
    for evidence in vuln['evidence']:
        print(f"        - {evidence}")
    print()
    print(f"      Attack Scenario: {vuln['attack_scenario']}")
    print(f"      Impact: {vuln['impact']}")
    print()

# Print semantic issues
if result['semantic_issues']:
    print("💡 SEMANTIC ANALYSIS")
    for issue in result['semantic_issues']:
        print(f"  {issue['category'].replace('_', ' ').title()}")
        print(f"  Reasoning:")
        for step in issue['reasoning']:
            print(f"    → {step}")
        print(f"  Implication: {issue['implication']}")
        print()

# Print reasoning explanation
print("=" * 80)
print("BOB'S REASONING PROCESS")
print("=" * 80)
for line in bob_ai.explain_reasoning():
    print(line)

print()
print("=" * 80)
print("FULL REPORT")
print("=" * 80)
print(result['report'])

# Made with Bob
