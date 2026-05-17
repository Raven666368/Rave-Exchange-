class ReconciliationEngine:

    def reconcile(self, broker_positions, internal_positions):

        mismatches = []

        for bp in broker_positions:
            match = next(
                (p for p in internal_positions if p["id"] == bp.get("id", bp.get("symbol"))),
                None
            )

            if not match:
                mismatches.append({
                    "type": "missing_internal",
                    "broker": bp
                })

        for p in internal_positions:
            match = next(
                (bp for bp in broker_positions if bp.get("id", bp.get("symbol")) == p["id"]),
                None
            )
            
            if not match:
                mismatches.append({
                    "type": "missing_broker",
                    "internal": p
                })

        return mismatches
