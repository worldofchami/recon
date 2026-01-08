#!/usr/bin/env python3
"""
Transaction Seeder Script for Multi-Party Reconciliation Testing

Generates diverse transaction scenarios based on matching rules:
- Perfect matches (auto-settlement candidates)
- Near matches requiring manual verification  
- Timing discrepancies
- Amount mismatches
- Missing party scenarios
- Single orphan transactions
"""
import uuid
import random
import hashlib
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import sys
import os

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.orm import Session
from shared.database import SessionLocal, engine
from shared.models import Transaction, MatchingRule
from shared.direla_matching import SouthAfricanMatchingRules


class ScenarioType(Enum):
    """Transaction scenario types for seeding."""
    PERFECT_MATCH = "perfect_match"              # All parties, exact amounts, good timing
    HIGH_CONFIDENCE = "high_confidence"           # Slight variations but should auto-match
    MANUAL_REVIEW_TIMING = "manual_review_timing" # Timing outside window
    MANUAL_REVIEW_AMOUNT = "manual_review_amount" # Amount discrepancies
    MANUAL_REVIEW_PHONE = "manual_review_phone"   # Phone number variations
    MISSING_PARTY = "missing_party"               # Incomplete multi-party flow
    ORPHAN = "orphan"                             # Single transaction, no match
    FRAUD_INDICATOR = "fraud_indicator"           # High risk patterns


@dataclass
class TransactionGroup:
    """A group of related transactions for multi-party matching."""
    direla_id: str
    scenario_type: ScenarioType
    transactions: List[Dict[str, Any]] = field(default_factory=list)
    expected_confidence: float = 0.0
    expected_status: str = "UNMATCHED"


class TransactionSeeder:
    """Generates test transactions based on matching rules."""
    
    # South African phone prefixes
    SA_PHONE_PREFIXES = ["082", "083", "084", "072", "073", "074", "060", "061", "062"]
    
    # Product types by category
    PRODUCT_TYPES = {
        "airtime": ["MTN_AIRTIME", "VODACOM_AIRTIME", "CELL_C_AIRTIME", "TELKOM_AIRTIME"],
        "data": ["MTN_DATA", "VODACOM_DATA", "CELL_C_DATA"],
        "electricity": ["ESKOM_ELECTRICITY", "CITY_POWER_ELECTRICITY", "JOBURG_WATER"],
        "banking": ["EFT_PAYMENT", "CARD_PAYMENT", "INSTANT_PAYMENT"],
    }
    
    # Source systems by party type
    SOURCE_SYSTEMS = {
        "MERCHANT": ["kazang_merchant", "flash_retail", "selpal_pos", "blu_merchant"],
        "POS_PROVIDER": ["kazang_pos", "flash_pos", "selpal_system", "blu_voucher"],
        "TELCO": ["mtn_sa_core", "vodacom_prepaid", "cell_c_airtime", "telkom_mobile"],
        "UTILITY": ["eskom_prepaid", "city_power_vend", "joburg_water"],
        "BANK": ["standard_bank", "fnb_core", "absa_banking", "nedbank_eft", "capitec"],
        "FOREX_PROVIDER": ["forex_za", "cambio_sa", "money_gram_za"],
    }
    
    # Common amounts for different product types (in ZAR)
    COMMON_AMOUNTS = {
        "airtime": [10, 12, 20, 29, 30, 50, 60, 100, 150, 200, 300, 500],
        "data": [29, 49, 99, 149, 199, 299, 499, 999],
        "electricity": [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000],
        "banking": [500, 1000, 2500, 5000, 7500, 10000, 15000, 25000],
    }
    
    def __init__(self, db: Session):
        self.db = db
        self.rules = self._load_rules()
        self.seeded_count = 0
        self.groups_created = 0
        
    def _load_rules(self) -> List[Dict[str, Any]]:
        """Load matching rules from database, creating defaults if none exist."""
        try:
            rules = self.db.query(MatchingRule).filter(
                MatchingRule.is_active == "true"
            ).order_by(MatchingRule.priority.asc()).all()
            
            if rules:
                print(f"📋 Loaded {len(rules)} matching rules from database")
                return [r.to_dict() for r in rules]
            
            # No rules in DB - create defaults from SA rules
            print("⚠️  No matching rules found, creating default SA rules...")
            self._seed_default_rules()
            
            # Reload
            rules = self.db.query(MatchingRule).filter(
                MatchingRule.is_active == "true"
            ).order_by(MatchingRule.priority.asc()).all()
            return [r.to_dict() for r in rules]
        except Exception as e:
            # Table doesn't exist - create it
            if "does not exist" in str(e) or "relation" in str(e).lower():
                print("⚠️  matching_rules table not found, creating it...")
                self.db.rollback()  # Rollback failed transaction
                self._create_matching_rules_table()
                # Try again
                return self._load_rules()
            else:
                raise
    
    def _create_matching_rules_table(self):
        """Create matching_rules table if it doesn't exist."""
        from sqlalchemy import text
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS matching_rules (
            rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            priority INTEGER NOT NULL,
            criteria JSON NOT NULL,
            break_category VARCHAR(100),
            is_active VARCHAR(10) DEFAULT 'true' NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE
        );
        """
        create_index_sql = """
        CREATE INDEX IF NOT EXISTS ix_matching_rules_priority ON matching_rules(priority);
        """
        try:
            self.db.execute(text(create_table_sql))
            self.db.execute(text(create_index_sql))
            self.db.commit()
            print("✅ Created matching_rules table")
        except Exception as e:
            self.db.rollback()
            raise
    
    def _seed_default_rules(self):
        """Seed default South African matching rules."""
        sa_rules = SouthAfricanMatchingRules()
        default_rules = [
            sa_rules.get_airtime_rule(),
            sa_rules.get_electricity_rule(),
            sa_rules.get_eft_rule(),
            sa_rules.get_remittance_rule(),
            sa_rules.get_marketplace_rule(),
        ]
        
        for rule_data in default_rules:
            rule = MatchingRule(
                rule_id=uuid.uuid4(),
                name=rule_data["name"],
                type=rule_data["type"],
                priority=rule_data["priority"],
                criteria=rule_data.get("criteria", {}),
                break_category=f"BREAK_{rule_data['type']}",
                is_active="true"
            )
            self.db.add(rule)
        
        self.db.commit()
        print(f"✅ Created {len(default_rules)} default matching rules")
    
    def generate_direla_id(self, base_ref: str = None) -> str:
        """Generate a unique Direla ID."""
        timestamp = datetime.utcnow()
        date_part = timestamp.strftime("%Y%m%d")
        hash_data = f"{base_ref or uuid.uuid4()}{timestamp.isoformat()}"
        hash_part = hashlib.md5(hash_data.encode()).hexdigest()[:6].upper()
        sequence = random.randint(100000, 999999)
        return f"DIRELA-{date_part}-{hash_part}-{sequence:06d}"
    
    def generate_phone_number(self, variant: str = "normal") -> str:
        """Generate a SA phone number with optional variations."""
        prefix = random.choice(self.SA_PHONE_PREFIXES)
        number = "".join([str(random.randint(0, 9)) for _ in range(7)])
        
        if variant == "normal":
            return f"0{prefix[1:]}{number}"
        elif variant == "international":
            return f"+27{prefix[1:]}{number}"
        elif variant == "spaces":
            return f"{prefix} {number[:3]} {number[3:]}"
        elif variant == "dashes":
            return f"{prefix}-{number[:3]}-{number[3:]}"
        else:
            return f"0{prefix[1:]}{number}"
    
    def generate_source_ref(self, system: str) -> str:
        """Generate a realistic source reference ID."""
        prefix = system.upper()[:3]
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        seq = random.randint(1000, 9999)
        return f"{prefix}-{timestamp}-{seq}"
    
    def _create_transaction(
        self,
        direla_id: Optional[str],
        source_system: str,
        party_type: str,
        amount: Decimal,
        currency: str = "ZAR",
        timestamp: datetime = None,
        phone_number: str = None,
        product_type: str = None,
        commission: Decimal = None,
        match_status: str = None,
        confidence_score: float = None,
    ) -> Transaction:
        """Create a transaction record."""
        timestamp = timestamp or datetime.utcnow()
        
        txn = Transaction(
            transaction_uuid=uuid.uuid4(),
            direla_id=direla_id,
            source_system=source_system,
            source_ref_id=self.generate_source_ref(source_system),
            transaction_datetime_utc=timestamp,
            amount_local=amount,
            currency_code_iso=currency,
            party_type=party_type,
            phone_number=phone_number,
            product_type=product_type,
            commission_amount=commission,
            raw_data_uri=f"gs://recon-data/{source_system}/{timestamp.strftime('%Y/%m/%d')}/{uuid.uuid4()}.json",
            match_status=match_status,
            confidence_score=confidence_score,
        )
        return txn
    
    # =========================================================================
    # SCENARIO GENERATORS
    # =========================================================================
    
    def generate_perfect_airtime_match(self) -> TransactionGroup:
        """Generate a perfect 3-party airtime transaction group."""
        direla_id = self.generate_direla_id()
        base_time = datetime.utcnow() - timedelta(hours=random.randint(1, 48))
        phone = self.generate_phone_number("normal")
        amount = Decimal(str(random.choice(self.COMMON_AMOUNTS["airtime"])))
        product = random.choice(self.PRODUCT_TYPES["airtime"])
        
        # Commission structure (typical SA breakdown)
        merchant_commission = amount * Decimal("0.05")  # 5%
        pos_commission = amount * Decimal("0.02")       # 2%
        
        transactions = []
        
        # Merchant transaction (initial sale)
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["MERCHANT"]),
            party_type="MERCHANT",
            amount=amount,
            timestamp=base_time,
            phone_number=phone,
            product_type=product,
            commission=merchant_commission,
        ))
        
        # POS Provider transaction (processing)
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["POS_PROVIDER"]),
            party_type="POS_PROVIDER",
            amount=amount,
            timestamp=base_time + timedelta(seconds=random.randint(1, 10)),
            phone_number=phone,
            product_type=product,
            commission=pos_commission,
        ))
        
        # Telco transaction (fulfillment)
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["TELCO"]),
            party_type="TELCO",
            amount=amount,
            timestamp=base_time + timedelta(seconds=random.randint(15, 25)),
            phone_number=phone,
            product_type=product,
        ))
        
        return TransactionGroup(
            direla_id=direla_id,
            scenario_type=ScenarioType.PERFECT_MATCH,
            transactions=transactions,
            expected_confidence=92.0,
            expected_status="DIRELA_VERIFIED",
        )
    
    def generate_perfect_electricity_match(self) -> TransactionGroup:
        """Generate a perfect electricity prepaid transaction."""
        direla_id = self.generate_direla_id()
        base_time = datetime.utcnow() - timedelta(hours=random.randint(1, 72))
        meter_number = f"0{random.randint(100000000, 999999999)}"
        amount = Decimal(str(random.choice(self.COMMON_AMOUNTS["electricity"])))
        product = random.choice(self.PRODUCT_TYPES["electricity"])
        
        transactions = []
        
        # Merchant
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["MERCHANT"]),
            party_type="MERCHANT",
            amount=amount,
            timestamp=base_time,
            phone_number=meter_number,  # Using phone_number field for meter
            product_type=product,
        ))
        
        # POS Provider
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["POS_PROVIDER"]),
            party_type="POS_PROVIDER",
            amount=amount,
            timestamp=base_time + timedelta(seconds=random.randint(2, 8)),
            phone_number=meter_number,
            product_type=product,
        ))
        
        # Utility
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["UTILITY"]),
            party_type="UTILITY",
            amount=amount,
            timestamp=base_time + timedelta(seconds=random.randint(30, 90)),
            phone_number=meter_number,
            product_type=product,
        ))
        
        return TransactionGroup(
            direla_id=direla_id,
            scenario_type=ScenarioType.PERFECT_MATCH,
            transactions=transactions,
            expected_confidence=95.0,
            expected_status="DIRELA_VERIFIED",
        )
    
    def generate_timing_discrepancy(self) -> TransactionGroup:
        """Generate transactions with timing issues (outside window)."""
        direla_id = self.generate_direla_id()
        base_time = datetime.utcnow() - timedelta(hours=random.randint(24, 96))
        phone = self.generate_phone_number()
        amount = Decimal(str(random.choice(self.COMMON_AMOUNTS["airtime"])))
        product = random.choice(self.PRODUCT_TYPES["airtime"])
        
        transactions = []
        
        # Merchant - on time
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["MERCHANT"]),
            party_type="MERCHANT",
            amount=amount,
            timestamp=base_time,
            phone_number=phone,
            product_type=product,
        ))
        
        # POS Provider - on time
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["POS_PROVIDER"]),
            party_type="POS_PROVIDER",
            amount=amount,
            timestamp=base_time + timedelta(seconds=5),
            phone_number=phone,
            product_type=product,
        ))
        
        # Telco - DELAYED (15+ minutes outside window)
        delay_minutes = random.randint(15, 60)
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["TELCO"]),
            party_type="TELCO",
            amount=amount,
            timestamp=base_time + timedelta(minutes=delay_minutes),
            phone_number=phone,
            product_type=product,
        ))
        
        return TransactionGroup(
            direla_id=direla_id,
            scenario_type=ScenarioType.MANUAL_REVIEW_TIMING,
            transactions=transactions,
            expected_confidence=55.0,
            expected_status="DIRELA_REVIEW_REQUIRED",
        )
    
    def generate_amount_discrepancy(self) -> TransactionGroup:
        """Generate transactions with amount mismatches."""
        direla_id = self.generate_direla_id()
        base_time = datetime.utcnow() - timedelta(hours=random.randint(1, 48))
        phone = self.generate_phone_number()
        base_amount = Decimal(str(random.choice(self.COMMON_AMOUNTS["airtime"])))
        product = random.choice(self.PRODUCT_TYPES["airtime"])
        
        # Variance of 5-20% (should flag for review)
        variance = Decimal(str(random.uniform(0.05, 0.20)))
        telco_amount = base_amount * (1 + variance if random.choice([True, False]) else 1 - variance)
        
        transactions = []
        
        # Merchant
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["MERCHANT"]),
            party_type="MERCHANT",
            amount=base_amount,
            timestamp=base_time,
            phone_number=phone,
            product_type=product,
        ))
        
        # POS Provider (matches merchant)
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["POS_PROVIDER"]),
            party_type="POS_PROVIDER",
            amount=base_amount,
            timestamp=base_time + timedelta(seconds=3),
            phone_number=phone,
            product_type=product,
        ))
        
        # Telco (MISMATCHED AMOUNT)
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["TELCO"]),
            party_type="TELCO",
            amount=round(telco_amount, 2),
            timestamp=base_time + timedelta(seconds=20),
            phone_number=phone,
            product_type=product,
        ))
        
        return TransactionGroup(
            direla_id=direla_id,
            scenario_type=ScenarioType.MANUAL_REVIEW_AMOUNT,
            transactions=transactions,
            expected_confidence=60.0,
            expected_status="DIRELA_REVIEW_REQUIRED",
        )
    
    def generate_phone_variation(self) -> TransactionGroup:
        """Generate transactions with phone number format variations."""
        direla_id = self.generate_direla_id()
        base_time = datetime.utcnow() - timedelta(hours=random.randint(1, 24))
        base_phone = self.generate_phone_number("normal")
        amount = Decimal(str(random.choice(self.COMMON_AMOUNTS["airtime"])))
        product = random.choice(self.PRODUCT_TYPES["airtime"])
        
        # Different phone formats for same number
        phone_variants = [
            base_phone,                                    # Normal: 0821234567
            f"+27{base_phone[1:]}",                       # International: +27821234567
            f"{base_phone[:3]} {base_phone[3:6]} {base_phone[6:]}",  # Spaced
        ]
        
        transactions = []
        
        for i, (party_type, source_key) in enumerate([
            ("MERCHANT", "MERCHANT"),
            ("POS_PROVIDER", "POS_PROVIDER"),
            ("TELCO", "TELCO"),
        ]):
            transactions.append(self._create_transaction(
                direla_id=direla_id,
                source_system=random.choice(self.SOURCE_SYSTEMS[source_key]),
                party_type=party_type,
                amount=amount,
                timestamp=base_time + timedelta(seconds=i * 5),
                phone_number=phone_variants[i % len(phone_variants)],
                product_type=product,
            ))
        
        return TransactionGroup(
            direla_id=direla_id,
            scenario_type=ScenarioType.HIGH_CONFIDENCE,  # Should still match
            transactions=transactions,
            expected_confidence=88.0,
            expected_status="DIRELA_VERIFIED",
        )
    
    def generate_missing_party(self) -> TransactionGroup:
        """Generate incomplete multi-party flow (missing one party)."""
        direla_id = self.generate_direla_id()
        base_time = datetime.utcnow() - timedelta(hours=random.randint(1, 48))
        phone = self.generate_phone_number()
        amount = Decimal(str(random.choice(self.COMMON_AMOUNTS["airtime"])))
        product = random.choice(self.PRODUCT_TYPES["airtime"])
        
        transactions = []
        
        # Only 2 parties instead of 3 (missing Telco)
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["MERCHANT"]),
            party_type="MERCHANT",
            amount=amount,
            timestamp=base_time,
            phone_number=phone,
            product_type=product,
        ))
        
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=random.choice(self.SOURCE_SYSTEMS["POS_PROVIDER"]),
            party_type="POS_PROVIDER",
            amount=amount,
            timestamp=base_time + timedelta(seconds=5),
            phone_number=phone,
            product_type=product,
        ))
        
        return TransactionGroup(
            direla_id=direla_id,
            scenario_type=ScenarioType.MISSING_PARTY,
            transactions=transactions,
            expected_confidence=0.0,
            expected_status="UNMATCHED",  # Waiting for more parties
        )
    
    def generate_orphan_transaction(self) -> TransactionGroup:
        """Generate a single orphan transaction with no matching counterparts."""
        base_time = datetime.utcnow() - timedelta(hours=random.randint(1, 72))
        
        category = random.choice(list(self.COMMON_AMOUNTS.keys()))
        amount = Decimal(str(random.choice(self.COMMON_AMOUNTS[category])))
        
        party_type = random.choice(["MERCHANT", "POS_PROVIDER", "BANK"])
        source_system = random.choice(self.SOURCE_SYSTEMS.get(party_type, ["unknown_system"]))
        
        txn = self._create_transaction(
            direla_id=None,  # No Direla ID - standalone transaction
            source_system=source_system,
            party_type=party_type,
            amount=amount,
            timestamp=base_time,
            phone_number=self.generate_phone_number() if category in ["airtime", "data"] else None,
            product_type=random.choice(self.PRODUCT_TYPES.get(category, ["UNKNOWN"])),
        )
        
        return TransactionGroup(
            direla_id=None,
            scenario_type=ScenarioType.ORPHAN,
            transactions=[txn],
            expected_confidence=0.0,
            expected_status="UNMATCHED",
        )
    
    def generate_fraud_indicator(self) -> TransactionGroup:
        """Generate transactions with potential fraud indicators."""
        direla_id = self.generate_direla_id()
        
        # Late night/weekend transaction with round high value
        base_time = datetime.utcnow().replace(hour=2, minute=30)  # 2:30 AM
        if base_time.weekday() < 5:
            base_time += timedelta(days=(5 - base_time.weekday()))  # Move to Saturday
        
        phone = self.generate_phone_number()
        amount = Decimal("5000.00")  # Round high value
        product = random.choice(self.PRODUCT_TYPES["airtime"])
        
        transactions = []
        
        for i, (party_type, source_key) in enumerate([
            ("MERCHANT", "MERCHANT"),
            ("POS_PROVIDER", "POS_PROVIDER"),
            ("TELCO", "TELCO"),
        ]):
            transactions.append(self._create_transaction(
                direla_id=direla_id,
                source_system=random.choice(self.SOURCE_SYSTEMS[source_key]),
                party_type=party_type,
                amount=amount,
                timestamp=base_time + timedelta(seconds=i * 3),
                phone_number=phone,
                product_type=product,
            ))
        
        return TransactionGroup(
            direla_id=direla_id,
            scenario_type=ScenarioType.FRAUD_INDICATOR,
            transactions=transactions,
            expected_confidence=65.0,  # Lowered due to fraud indicators
            expected_status="DIRELA_REVIEW_REQUIRED",
        )
    
    def generate_eft_cross_bank(self) -> TransactionGroup:
        """Generate a 2-party bank EFT transaction."""
        direla_id = self.generate_direla_id()
        base_time = datetime.utcnow() - timedelta(hours=random.randint(1, 24))
        amount = Decimal(str(random.choice(self.COMMON_AMOUNTS["banking"])))
        
        banks = random.sample(self.SOURCE_SYSTEMS["BANK"], 2)
        
        transactions = []
        
        # Originating bank
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=banks[0],
            party_type="ORIGINATING_BANK",
            amount=amount,
            timestamp=base_time,
            product_type="EFT_PAYMENT",
        ))
        
        # Destination bank (slight delay typical for EFT)
        transactions.append(self._create_transaction(
            direla_id=direla_id,
            source_system=banks[1],
            party_type="DESTINATION_BANK",
            amount=amount,
            timestamp=base_time + timedelta(minutes=random.randint(30, 180)),
            product_type="EFT_PAYMENT",
        ))
        
        return TransactionGroup(
            direla_id=direla_id,
            scenario_type=ScenarioType.PERFECT_MATCH,
            transactions=transactions,
            expected_confidence=95.0,
            expected_status="DIRELA_VERIFIED",
        )
    
    def generate_remittance_flow(self) -> TransactionGroup:
        """Generate a 5-party cross-border remittance transaction."""
        direla_id = self.generate_direla_id()
        base_time = datetime.utcnow() - timedelta(hours=random.randint(6, 48))
        amount_zar = Decimal(str(random.choice([1000, 2500, 5000, 10000])))
        
        # Simulate USD equivalent
        fx_rate = Decimal("18.50")
        amount_usd = round(amount_zar / fx_rate, 2)
        
        transactions = []
        
        party_configs = [
            ("SENDER_BANK", "BANK", amount_usd, "USD", 0),
            ("SA_CORRESPONDENT", "BANK", amount_zar, "ZAR", random.randint(60, 180)),
            ("FOREX_PROVIDER", "FOREX_PROVIDER", amount_zar, "ZAR", random.randint(180, 300)),
            ("DESTINATION_BANK", "BANK", amount_zar, "ZAR", random.randint(300, 600)),
            ("RECIPIENT", "BANK", amount_zar * Decimal("0.98"), "ZAR", random.randint(600, 900)),  # Less fees
        ]
        
        for party_type, source_key, amount, currency, delay_sec in party_configs:
            # Handle FOREX_PROVIDER not in SOURCE_SYSTEMS
            if source_key == "FOREX_PROVIDER":
                source = random.choice(self.SOURCE_SYSTEMS.get("FOREX_PROVIDER", ["forex_za"]))
            else:
                source = random.choice(self.SOURCE_SYSTEMS[source_key])
                
            transactions.append(self._create_transaction(
                direla_id=direla_id,
                source_system=source,
                party_type=party_type,
                amount=amount,
                currency=currency,
                timestamp=base_time + timedelta(seconds=delay_sec),
                product_type="CROSS_BORDER_REMITTANCE",
            ))
        
        return TransactionGroup(
            direla_id=direla_id,
            scenario_type=ScenarioType.HIGH_CONFIDENCE,
            transactions=transactions,
            expected_confidence=82.0,
            expected_status="DIRELA_VERIFIED",
        )
    
    def generate_marketplace_flow(self) -> TransactionGroup:
        """Generate a variable-party marketplace transaction."""
        direla_id = self.generate_direla_id()
        base_time = datetime.utcnow() - timedelta(hours=random.randint(1, 24))
        amount = Decimal(str(random.choice([150, 299, 499, 999, 1499, 2999])))
        
        # Marketplace fees
        marketplace_fee = amount * Decimal("0.10")
        seller_payout = amount - marketplace_fee
        
        transactions = []
        num_parties = random.randint(3, 5)  # Variable parties
        
        base_parties = [
            ("BUYER", "BANK", amount, 0),
            ("MARKETPLACE", "POS_PROVIDER", amount, 5),
            ("SELLER", "MERCHANT", seller_payout, 15),
        ]
        
        optional_parties = [
            ("PAYMENT_GATEWAY", "BANK", amount, 3),
            ("LOGISTICS", "MERCHANT", Decimal("50.00"), 120),
        ]
        
        # Add base parties
        for party_type, source_key, amt, delay in base_parties[:num_parties]:
            transactions.append(self._create_transaction(
                direla_id=direla_id,
                source_system=random.choice(self.SOURCE_SYSTEMS[source_key]),
                party_type=party_type,
                amount=amt,
                timestamp=base_time + timedelta(seconds=delay),
                product_type="MARKETPLACE_SALE",
            ))
        
        # Maybe add optional parties
        for party_type, source_key, amt, delay in random.sample(optional_parties, min(num_parties - 3, len(optional_parties))):
            transactions.append(self._create_transaction(
                direla_id=direla_id,
                source_system=random.choice(self.SOURCE_SYSTEMS[source_key]),
                party_type=party_type,
                amount=amt,
                timestamp=base_time + timedelta(seconds=delay),
                product_type="MARKETPLACE_SALE",
            ))
        
        return TransactionGroup(
            direla_id=direla_id,
            scenario_type=ScenarioType.HIGH_CONFIDENCE,
            transactions=transactions,
            expected_confidence=78.0,
            expected_status="DIRELA_VERIFIED",
        )
    
    # =========================================================================
    # MAIN SEEDING LOGIC
    # =========================================================================
    
    def seed_transactions(
        self,
        total_count: int = 1000,
        scenario_distribution: Dict[ScenarioType, float] = None,
        clear_existing: bool = False,
    ) -> Dict[str, Any]:
        """
        Seed transactions based on specified distribution.
        
        Args:
            total_count: Total number of transaction groups to create
            scenario_distribution: Dict mapping ScenarioType to percentage (0-1)
            clear_existing: Whether to clear existing transactions first
        
        Returns:
            Statistics about seeded transactions
        """
        if clear_existing:
            print("🗑️  Clearing existing transactions...")
            self.db.query(Transaction).delete()
            self.db.commit()
        
        # Default distribution if not specified
        if scenario_distribution is None:
            scenario_distribution = {
                ScenarioType.PERFECT_MATCH: 0.35,          # 35% perfect matches
                ScenarioType.HIGH_CONFIDENCE: 0.20,        # 20% high confidence
                ScenarioType.MANUAL_REVIEW_TIMING: 0.10,   # 10% timing issues
                ScenarioType.MANUAL_REVIEW_AMOUNT: 0.10,   # 10% amount issues
                ScenarioType.MANUAL_REVIEW_PHONE: 0.05,    # 5% phone variations
                ScenarioType.MISSING_PARTY: 0.08,          # 8% incomplete
                ScenarioType.ORPHAN: 0.07,                 # 7% orphan
                ScenarioType.FRAUD_INDICATOR: 0.05,        # 5% fraud indicators
            }
        
        # Generator mapping
        generators = {
            ScenarioType.PERFECT_MATCH: [
                self.generate_perfect_airtime_match,
                self.generate_perfect_electricity_match,
                self.generate_eft_cross_bank,
            ],
            ScenarioType.HIGH_CONFIDENCE: [
                self.generate_phone_variation,
                self.generate_remittance_flow,
                self.generate_marketplace_flow,
            ],
            ScenarioType.MANUAL_REVIEW_TIMING: [self.generate_timing_discrepancy],
            ScenarioType.MANUAL_REVIEW_AMOUNT: [self.generate_amount_discrepancy],
            ScenarioType.MANUAL_REVIEW_PHONE: [self.generate_phone_variation],
            ScenarioType.MISSING_PARTY: [self.generate_missing_party],
            ScenarioType.ORPHAN: [self.generate_orphan_transaction],
            ScenarioType.FRAUD_INDICATOR: [self.generate_fraud_indicator],
        }
        
        stats = {scenario.value: {"groups": 0, "transactions": 0} for scenario in ScenarioType}
        stats["total_groups"] = 0
        stats["total_transactions"] = 0
        
        print(f"\n🌱 Seeding {total_count} transaction groups...")
        print("=" * 60)
        
        for scenario_type, percentage in scenario_distribution.items():
            count = int(total_count * percentage)
            available_generators = generators.get(scenario_type, [])
            
            if not available_generators:
                continue
            
            for i in range(count):
                generator = random.choice(available_generators)
                group = generator()
                
                # Add transactions to database with expected match status
                for txn in group.transactions:
                    # Set match_status based on expected outcome for dashboard accuracy
                    if group.expected_status:
                        txn.match_status = group.expected_status
                    else:
                        # Default to UNMATCHED if no expected status
                        txn.match_status = "UNMATCHED"
                    
                    # Set confidence score if available
                    if group.expected_confidence > 0:
                        txn.confidence_score = group.expected_confidence
                    
                    self.db.add(txn)
                
                stats[scenario_type.value]["groups"] += 1
                stats[scenario_type.value]["transactions"] += len(group.transactions)
                stats["total_groups"] += 1
                stats["total_transactions"] += len(group.transactions)
                
                # Commit in batches for performance
                if stats["total_transactions"] % 500 == 0:
                    self.db.commit()
                    print(f"  ✓ Committed {stats['total_transactions']} transactions...")
        
        # Final commit
        self.db.commit()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 SEEDING SUMMARY")
        print("=" * 60)
        for scenario_type in ScenarioType:
            s = stats[scenario_type.value]
            if s["groups"] > 0:
                icon = "✅" if "PERFECT" in scenario_type.value or "HIGH" in scenario_type.value else "⚠️"
                print(f"  {icon} {scenario_type.value}: {s['groups']} groups, {s['transactions']} txns")
        print("-" * 60)
        print(f"  📦 TOTAL: {stats['total_groups']} groups, {stats['total_transactions']} transactions")
        print("=" * 60)
        
        return stats


def main():
    """Main entry point for transaction seeding."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Seed transactions for multi-party reconciliation testing")
    parser.add_argument(
        "--count", "-c",
        type=int,
        default=500,
        help="Number of transaction groups to create (default: 500)"
    )
    parser.add_argument(
        "--clear", "-x",
        action="store_true",
        help="Clear existing transactions before seeding"
    )
    parser.add_argument(
        "--match-rate",
        type=float,
        default=0.55,
        help="Percentage of perfect/high-confidence matches (0-1, default: 0.55)"
    )
    parser.add_argument(
        "--review-rate", 
        type=float,
        default=0.30,
        help="Percentage requiring manual review (0-1, default: 0.30)"
    )
    parser.add_argument(
        "--orphan-rate",
        type=float,
        default=0.15,
        help="Percentage of orphan/incomplete transactions (0-1, default: 0.15)"
    )
    
    args = parser.parse_args()
    
    # Normalize rates
    total_rate = args.match_rate + args.review_rate + args.orphan_rate
    match_rate = args.match_rate / total_rate
    review_rate = args.review_rate / total_rate  
    orphan_rate = args.orphan_rate / total_rate
    
    # Build distribution
    distribution = {
        ScenarioType.PERFECT_MATCH: match_rate * 0.65,
        ScenarioType.HIGH_CONFIDENCE: match_rate * 0.35,
        ScenarioType.MANUAL_REVIEW_TIMING: review_rate * 0.35,
        ScenarioType.MANUAL_REVIEW_AMOUNT: review_rate * 0.35,
        ScenarioType.MANUAL_REVIEW_PHONE: review_rate * 0.15,
        ScenarioType.FRAUD_INDICATOR: review_rate * 0.15,
        ScenarioType.MISSING_PARTY: orphan_rate * 0.5,
        ScenarioType.ORPHAN: orphan_rate * 0.5,
    }
    
    print("\n" + "=" * 60)
    print("🔄 TRANSACTION SEEDER - Multi-Party Reconciliation")
    print("=" * 60)
    print(f"  Database: {os.getenv('DATABASE_URL', 'postgresql://localhost/recon_dev')[:50]}...")
    print(f"  Target groups: {args.count}")
    print(f"  Clear existing: {args.clear}")
    print(f"  Match rate: {match_rate:.1%}")
    print(f"  Review rate: {review_rate:.1%}")
    print(f"  Orphan rate: {orphan_rate:.1%}")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        seeder = TransactionSeeder(db)
        stats = seeder.seed_transactions(
            total_count=args.count,
            scenario_distribution=distribution,
            clear_existing=args.clear,
        )
        
        print("\n✅ Seeding complete!")
        return stats
        
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

