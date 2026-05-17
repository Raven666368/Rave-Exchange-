class RiskEngine:
    def __init__(self, max_risk_per_trade=0.02):
        self.max_risk = max_risk_per_trade

    def validate(self, order, account_balance):
        risk = order.volume * 0.01  # simplified
        if risk > account_balance * self.max_risk:
            raise Exception("Risk too high")
        return True
