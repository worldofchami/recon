# Transaction Seeder Quick Guide

## Quick Start

```bash
# Basic usage - 500 transaction groups
python3 seed_transactions.py

# Custom count
python3 seed_transactions.py --count 1000

# Clear existing and seed fresh
python3 seed_transactions.py --count 500 --clear
```

## Options

- `--count, -c` - Number of transaction groups (default: 500)
- `--clear, -x` - Delete existing transactions first
- `--match-rate` - % auto-matching transactions (default: 0.55)
- `--review-rate` - % requiring manual review (default: 0.30)
- `--orphan-rate` - % orphan/incomplete (default: 0.15)

## What Gets Created

The seeder generates diverse transaction scenarios:

- **Perfect Matches** (35%) - Auto-settle candidates with `DIRELA_VERIFIED` status
- **High Confidence** (20%) - Should auto-match with slight variations
- **Manual Review** (30%) - Timing issues, amount discrepancies, fraud indicators
- **Orphan/Incomplete** (15%) - Missing parties, standalone transactions

## Transaction Types

- **Airtime** - 3-party (Merchant, POS Provider, Telco)
- **Electricity** - 3-party prepaid utility
- **EFT** - 2-party bank transfers
- **Remittance** - 5-party cross-border
- **Marketplace** - Variable-party (3-5 parties)

## Examples

```bash
# Small test dataset
python3 seed_transactions.py --count 20

# Large production-like dataset
python3 seed_transactions.py --count 5000 --clear

# More matches, fewer reviews
python3 seed_transactions.py --count 1000 --match-rate 0.70 --review-rate 0.20
```

## Notes

- Transactions are created with appropriate `match_status` for dashboard accuracy
- Matching rules are auto-created if none exist in database
- All transactions include realistic SA phone numbers, amounts, and timestamps

