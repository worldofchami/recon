"""Direla-specific multi-party matching logic for South African payment flows."""
import re
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import phonenumbers
from rapidfuzz import fuzz


class DirelaMatchingEngine:
    """AI-powered multi-party transaction matching for real-time settlement."""
    
    def __init__(self):
        self.confidence_threshold = 85.0  # Minimum confidence for auto-match
        
    def calculate_confidence(
        self,
        transactions: List[Dict],
        direla_id: str
    ) -> float:
        """Calculate AI confidence score for multi-party matching."""
        if len(transactions) < 2:
            return 0.0
            
        # Extract features
        phone_score = self._phone_similarity_score(transactions)
        amount_score = self._amount_flow_score(transactions) 
        timing_score = self._timing_proximity_score(transactions)
        pattern_score = self._pattern_recognition_score(transactions)
        fraud_score = self._fraud_detection_score(transactions)
        
        # Weighted scoring
        confidence = (
            phone_score * 0.25 +      # Phone number matching
            amount_score * 0.30 +     # Amount flow validation  
            timing_score * 0.20 +     # Timing proximity
            pattern_score * 0.15 +    # Historical patterns
            fraud_score * 0.10        # Fraud indicators
        )
        
        return min(confidence, 100.0)
    
    def _phone_similarity_score(self, transactions: List[Dict]) -> float:
        """Score phone number similarity across transactions."""
        phones = [t.get('phone_number') for t in transactions if t.get('phone_number')]
        
        if len(phones) < 2:
            return 50.0  # Neutral score if no phone data
            
        # Normalize all phone numbers
        normalized = []
        for phone in phones:
            try:
                parsed = phonenumbers.parse(phone, "ZA")
                normalized.append(phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164))
            except:
                normalized.append(self._clean_phone(phone))
        
        # Check if all normalized phones match
        unique_phones = set(normalized)
        if len(unique_phones) == 1:
            return 100.0  # Perfect match
        elif len(unique_phones) == 2:
            # Fuzzy match for slight variations
            phone1, phone2 = list(unique_phones)
            similarity = fuzz.ratio(phone1, phone2)
            return similarity
        else:
            return 0.0  # Too many different phones
    
    def _amount_flow_score(self, transactions: List[Dict]) -> float:
        """Validate amount flows make sense across parties (dynamic party count)."""
        if len(transactions) < 2:
            return 0.0
            
        try:
            # Calculate total amounts by party type
            party_amounts = {}
            for txn in transactions:
                party_type = txn.get('party_type')
                if party_type:
                    party_amounts[party_type] = party_amounts.get(party_type, 0) + float(txn.get('amount_local', 0))
            
            # Basic validation: amounts should be consistent across parties
            amounts = list(party_amounts.values())
            if not amounts:
                return 10.0
                
            # Check if amounts are within reasonable tolerance
            max_amount = max(amounts)
            min_amount = min(amounts)
            
            # For multi-party flows, amounts might differ due to commissions
            # Allow up to 20% difference (configurable)
            tolerance_ratio = 0.20
            if max_amount > 0:
                variance_ratio = (max_amount - min_amount) / max_amount
                if variance_ratio <= tolerance_ratio:
                    return 100.0 - (variance_ratio * 100)  # Penalize variance
                else:
                    return 30.0  # Too much variance
            
            return 50.0  # Default score
                
        except (ValueError, KeyError):
            return 10.0  # Bad data
    
    def _timing_proximity_score(self, transactions: List[Dict]) -> float:
        """Score how close in time the transactions occurred."""
        try:
            timestamps = []
            for t in transactions:
                ts = datetime.fromisoformat(t['transaction_datetime_utc'].replace('Z', '+00:00'))
                timestamps.append(ts)
            
            if len(timestamps) < 2:
                return 50.0
                
            # Calculate max time difference
            min_time = min(timestamps)
            max_time = max(timestamps)
            diff_seconds = (max_time - min_time).total_seconds()
            
            # Scoring: 0-30 sec = perfect, 30-60 sec = good, 60+ sec = poor
            if diff_seconds <= 30:
                return 100.0
            elif diff_seconds <= 60:
                return 90.0
            elif diff_seconds <= 180:  # 3 minutes
                return 70.0
            elif diff_seconds <= 600:  # 10 minutes  
                return 40.0
            else:
                return 10.0  # Too far apart
                
        except:
            return 30.0  # Bad timestamp data
    
    def _pattern_recognition_score(self, transactions: List[Dict]) -> float:
        """Score based on historical merchant patterns."""
        # For now, basic heuristics - would be ML model in production
        merchant_txn = next((t for t in transactions if t.get('party_type') == 'MERCHANT'), None)
        
        if not merchant_txn:
            return 50.0
            
        source_system = merchant_txn.get('source_system', '')
        product_type = merchant_txn.get('product_type', '')
        
        # Known good patterns
        if 'MTN' in product_type.upper() and 'AIRTIME' in product_type.upper():
            return 90.0  # MTN airtime is common and predictable
        elif any(telco in product_type.upper() for telco in ['VODACOM', 'CELL_C']):
            return 85.0  # Other telcos also good
        elif 'ELECTRICITY' in product_type.upper():
            return 80.0  # Prepaid electricity common
        else:
            return 60.0  # Unknown product type
    
    def _fraud_detection_score(self, transactions: List[Dict]) -> float:
        """Detect potential fraud indicators."""
        # Basic fraud checks - would be ML model in production
        score = 100.0
        
        for txn in transactions:
            amount = float(txn.get('amount_local', 0))
            
            # High value transactions (over R5000)
            if amount > 5000:
                score -= 20
            
            # Very round amounts might be testing
            if amount % 100 == 0 and amount > 1000:
                score -= 10
                
            # Weekend/late night transactions
            try:
                ts = datetime.fromisoformat(txn['transaction_datetime_utc'].replace('Z', '+00:00'))
                if ts.weekday() >= 5 or ts.hour < 6 or ts.hour > 22:  # Weekend or late night
                    score -= 5
            except:
                pass
                
        return max(score, 0.0)
    
    def _clean_phone(self, phone: str) -> str:
        """Clean and normalize phone number."""
        if not phone:
            return ""
            
        # Remove all non-digits
        digits_only = re.sub(r'\D', '', phone)
        
        # Handle SA numbers
        if digits_only.startswith('27'):
            return '+' + digits_only
        elif digits_only.startswith('0') and len(digits_only) == 10:
            return '+27' + digits_only[1:]
        else:
            return '+27' + digits_only
    
    def should_auto_settle(self, confidence: float) -> bool:
        """Determine if transaction is safe for automatic settlement."""
        return confidence >= self.confidence_threshold
    
    def generate_direla_id(self, base_txn: Dict) -> str:
        """Generate universal Direla ID for transaction group."""
        from datetime import datetime
        import hashlib
        
        timestamp = datetime.utcnow()
        date_part = timestamp.strftime("%Y%m%d")
        
        # Create hash from key transaction data
        hash_data = f"{base_txn.get('source_ref_id', '')}{timestamp.isoformat()}"
        hash_part = hashlib.md5(hash_data.encode()).hexdigest()[:6]
        
        # Generate sequence (would be from database counter in production)
        sequence = timestamp.microsecond % 999999
        
        return f"DIRELA-{date_part}-{hash_part}-{sequence:06d}"


class SouthAfricanMatchingRules:
    """SA-specific matching rules for different payment flows."""
    
    @staticmethod
    def get_remittance_rule() -> Dict:
        """5-party cross-border remittance matching."""
        return {
            "name": "SA Cross-Border Remittance",
            "type": "REMITTANCE",
            "priority": 4,
            "parties_required": ["SENDER_BANK", "SA_CORRESPONDENT", "FOREX_PROVIDER", "DESTINATION_BANK", "RECIPIENT"],
            "min_parties": 4,
            "max_parties": 6,
            "criteria": {
                "time_window_minutes": 1440,  # 24 hours for international
                "amount_tolerance": 0.01,
                "require_swift_reference": True,
                "currencies": ["ZAR", "USD", "EUR", "GBP"],
                "min_confidence": 80.0  # Lower due to complexity
            }
        }
    
    @staticmethod
    def get_marketplace_rule() -> Dict:
        """Variable party marketplace matching (2-8 parties)."""
        return {
            "name": "SA Marketplace Multi-Party",
            "type": "MARKETPLACE",
            "priority": 5,
            "parties_required": ["BUYER", "MARKETPLACE"],  # Minimum required
            "parties_optional": ["SELLER", "PAYMENT_GATEWAY", "LOGISTICS", "INSURANCE"],
            "min_parties": 2,
            "max_parties": 8,
            "criteria": {
                "time_window_minutes": 60,
                "amount_tolerance": 0.05,  # Slightly higher for complex flows
                "require_order_reference": True,
                "min_confidence": 75.0
            }
        }
    
    @staticmethod
    def get_airtime_rule() -> Dict:
        """3-party matching rule for airtime transactions."""
        return {
            "name": "SA Airtime Multi-Party Match",
            "type": "MULTI_PARTY",
            "priority": 1,
            "parties_required": ["MERCHANT", "POS_PROVIDER", "TELCO"],
            "min_parties": 3,
            "max_parties": 3,
            "criteria": {
                "time_window_minutes": 5,
                "amount_tolerance": 0.01,
                "require_phone_match": True,
                "product_types": ["MTN_AIRTIME", "VODACOM_AIRTIME", "CELL_C_AIRTIME"],
                "min_confidence": 85.0
            }
        }
    
    @staticmethod 
    def get_electricity_rule() -> Dict:
        """Multi-party matching for prepaid electricity."""
        return {
            "name": "SA Electricity Multi-Party Match", 
            "type": "MULTI_PARTY",
            "priority": 2,
            "parties_required": ["MERCHANT", "POS_PROVIDER", "UTILITY"],
            "min_parties": 3,
            "max_parties": 3,
            "criteria": {
                "time_window_minutes": 10,  # Electricity can be slower
                "amount_tolerance": 0.00,   # Must be exact
                "require_meter_number": True,
                "product_types": ["ESKOM_ELECTRICITY", "CITY_POWER_ELECTRICITY"],
                "min_confidence": 90.0      # Higher threshold for utilities
            }
        }
    
    @staticmethod
    def get_eft_rule() -> Dict:
        """Bank-to-bank EFT matching."""
        return {
            "name": "SA EFT Cross-Bank Match",
            "type": "CROSS_BANK", 
            "priority": 3,
            "parties_required": ["ORIGINATING_BANK", "DESTINATION_BANK"],
            "min_parties": 2,
            "max_parties": 2,
            "criteria": {
                "time_window_minutes": 240,  # EFTs can take hours
                "amount_tolerance": 0.00,
                "require_reference_match": True,
                "banks": ["STANDARD_BANK", "FNB", "ABSA", "NEDBANK", "CAPITEC"],
                "min_confidence": 95.0
            }
        }